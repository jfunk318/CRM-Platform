import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { NPCs } from './npcs.js';
import { Wardens } from './wardens.js';
import { Fragments } from './fragments.js';
import { Post } from './post.js';
import { HUD } from './hud.js';
import { Dialogue } from './dialogue.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Sparks, Shockwaves } from './effects.js';
import { ECHO_BEATS, FRAGMENTS, INTRO, BARKS, ENDINGS, SPEAKERS } from './story.js';
import { clamp, damp, pick } from './util.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`hc.${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`hc.${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ABILITIES = [
  { id: 'peer', key: 'Q', icon: '◉', name: 'Peer' },
  { id: 'override', key: 'F', icon: '⌁', name: 'Override', cost: 35, cd: 8 },
  { id: 'dash', key: 'C', icon: '»', name: 'Phase', cost: 18, cd: 1.1 },
  { id: 'overclock', key: 'R', icon: '◷', name: 'Overclock', cost: 60, cd: 18 },
];

class Game {
  constructor() {
    this.time = { value: 0 };
    this.opts = {
      reflections: store.get('reflections', true),
      bloom: store.get('bloom', true),
      hq: store.get('hq', false),
    };
    this.mode = 'loading';
    this.stage = 'wake';
    this.state = {
      flags: {}, echoTrust: 0, selfWill: 0, institute: 0, tempted: false, fragments: 0, awakening: 4,
      abilities: { peer: false, override: false, dash: false, overclock: false },
      stats: { overrides: 0, stunned: 0, restores: 0, start: 0, spotted: 0 },
      ending: null,
    };
    this.integrity = 100;
    this.core = 100;
    this.peer = 0;
    this.peerLock = false;
    this.cooldowns = { override: 0, dash: 0, overclock: 0 };
    this.slow = 0;
    this.slowT = 0;
    this.glitch = 0;
    this.damageFx = 0;
    this.hitCool = 0;
    this.sinceHit = 10;
    this.director = { t: 0, beat: 0, glitchIn: 18, barkIn: 5, hintIn: 70 };
    this.forced = new Map();
    this.pending = null;
    this.fpsAcc = { t: 0, n: 0, low: 0 };
  }

  async boot() {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('700 40px "Chakra Petch"'), document.fonts.load('400 14px "JetBrains Mono"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch { /* fonts are optional */ }

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pixelRatio = Math.min(devicePixelRatio, this.opts.hq ? 2 : 1);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    $('app').appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#0b0a16', 0.0115);
    scene.background = new THREE.Color('#05060b');
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.05, 1500);

    this.audio = new Audio();
    this.input = new Input(renderer.domElement);
    this.world = new World(scene, renderer, this.opts, this.time);
    this.player = new Player(scene, this.world, this.time);
    this.npcs = new NPCs(scene, this.world, this.time);
    this.wardens = new Wardens(scene, this.world, this.time);
    this.fragments = new Fragments(scene, this.world.points.fragments, this.time);
    this.sparks = new Sparks(scene);
    this.waves = new Shockwaves(scene);
    this.post = new Post(renderer, scene, this.camera, this.opts);
    this.hud = new HUD(this.audio);
    this.hud.buildAbilities(ABILITIES);
    this.dialogue = new Dialogue(this.audio, this.state, {
      isPeering: () => this.peer > 0.55,
      onAction: (a) => this.onDialogueAction(a),
      onClose: (id) => this.onDialogueClose(id),
    });
    this.humanoids = [this.player.h, ...this.npcs.all, this.world.statue];

    this.playerLight = new THREE.PointLight('#b9c8ff', 6, 9, 1.4);
    scene.add(this.playerLight);

    this.bindUI();
    addEventListener('resize', () => this.resize());
    this.input.onUnlock = () => {
      if (this.mode === 'play' && !this.input.lockFailed && !this.dialogue.active) this.setPaused(true);
    };

    // warm up shaders before showing the title
    this.player.snapCamera(this.camera);
    renderer.compile(scene, this.camera);
    $('loading').classList.add('hidden');
    this.mode = 'title';
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.frame());
  }

  bindUI() {
    $('opt-reflections').checked = this.opts.reflections;
    $('opt-bloom').checked = this.opts.bloom;
    $('opt-hq').checked = this.opts.hq;
    $('opt-reflections').addEventListener('change', (e) => { this.opts.reflections = e.target.checked; store.set('reflections', e.target.checked); this.world.setReflections(e.target.checked); });
    $('opt-bloom').addEventListener('change', (e) => { this.opts.bloom = e.target.checked; store.set('bloom', e.target.checked); this.post.setBloom(e.target.checked); });
    $('opt-hq').addEventListener('change', (e) => {
      this.opts.hq = e.target.checked; store.set('hq', e.target.checked);
      this.pixelRatio = Math.min(devicePixelRatio, e.target.checked ? 2 : 1);
      this.resize();
    });
    $('btn-controls').addEventListener('click', () => $('controls-card').classList.toggle('hidden'));
    $('btn-start').addEventListener('click', () => this.startIntro());
    $('btn-resume').addEventListener('click', () => { this.setPaused(false); this.input.lock(); });
    $('btn-restart').addEventListener('click', () => location.reload());
    if (matchMedia('(pointer: coarse)').matches) $('touch-note').classList.remove('hidden');
  }

  resize() {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.post.setSize(innerWidth, innerHeight);
    this.world.resizeReflector(innerWidth, innerHeight, this.pixelRatio);
  }

  // ------------------------------------------------------------ flow
  startIntro() {
    this.audio.start();
    $('title-screen').classList.add('hidden');
    $('intro').classList.remove('hidden');
    this.mode = 'intro';
    const el = $('intro-text');
    el.innerHTML = '';
    let i = 0;
    const step = () => {
      if (this.mode !== 'intro') return;
      if (i >= INTRO.length) { this.introTimer = setTimeout(() => this.beginPlay(), 1400); return; }
      el.innerHTML += INTRO[i].t.replace(/\n/g, '<br>');
      this.audio.blip();
      if (i === INTRO.length - 2) this.audio.glitch(0.5);
      this.introTimer = setTimeout(step, INTRO[i++].d);
    };
    step();
  }

  beginPlay() {
    if (this.mode !== 'intro') return;
    clearTimeout(this.introTimer);
    $('intro').classList.add('hidden');
    this.flash(0.6);
    this.mode = 'play';
    this.state.stats.start = performance.now();
    this.hud.show();
    this.input.enabled = true;
    this.input.lock();
    this.player.snapCamera(this.camera);
    this.hud.echo(ECHO_BEATS.wake);
    this.hud.setObjective('Look around. Something is wrong.');
    this.director.beat = 0;
  }

  setPaused(on) {
    if (on && this.mode === 'play') { this.mode = 'paused'; $('pause').classList.remove('hidden'); }
    else if (!on && this.mode === 'paused') { this.mode = 'play'; $('pause').classList.add('hidden'); }
  }

  flash(t = 0.5) {
    const f = $('fade');
    f.style.transition = 'none';
    f.style.opacity = 1;
    requestAnimationFrame(() => { f.style.transition = `opacity ${t}s`; f.style.opacity = 0; });
  }

  fadeTo(v, t = 0.8) {
    const f = $('fade');
    f.style.transition = `opacity ${t}s`;
    f.style.opacity = v;
  }

  // ------------------------------------------------------------ dialogue hooks
  talk(id) {
    this.mode = 'dialogue';
    const npc = this.npcs.story[id];
    if (npc) { npc.talking = true; this.player.focus = npc.headPos; }
    else if (id === 'node') this.player.focus = new THREE.Vector3(0, 4.5, 0);
    this.dialogue.open(id);
    this.input.unlock();
    this.hud.prompt(null);
  }

  onDialogueAction(a) {
    if (a === 'becomeTempted') this.becomeTempted();
    else this.pending = a;
  }

  onDialogueClose(id) {
    const npc = this.npcs.story[id];
    if (npc) npc.talking = false;
    this.player.focus = null;
    this.mode = 'play';
    if (!this.input.lockFailed) this.input.lock();
    if (id === 'vale' || id === 'juno' || id === 'tomas') {
      const key = `met_${id}`;
      if (!this.state.flags[key]) { this.state.flags[key] = true; this.state.awakening += 5; }
    }
    if (this.pending === 'stabilizer') { this.pending = null; this.startEnding('sleeper'); return; }
    if (this.pending === 'ending') { this.pending = null; this.startEnding(this.state.ending); return; }
    if (this.stage === 'seek' && !this.state.tempted) {
      if (this.state.flags.metJuno) this.hud.setObjective('Decide: Juno can show you how deep this goes');
      else this.hud.setObjective('Find Juno, east alley. She sees it too.');
      if (id !== 'juno' && !this.state.flags.metJuno && !this.state.flags.junoPing) {
        this.state.flags.junoPing = true;
        this.hud.echo('The strongest signal is east, in an alley off the plaza. Someone who stopped hiding.');
      }
    }
  }

  becomeTempted() {
    const s = this.state;
    if (s.tempted) return;
    s.tempted = true;
    s.abilities.override = true;
    s.awakening = Math.max(s.awakening, 35);
    this.stage = 'hunt';
    this.wardens.spawn(2, this.player.pos);
    this.glitch = 0.8;
    this.audio.glitch(1);
    this.hud.glitchText(10);
    setTimeout(() => this.hud.echo(ECHO_BEATS.tempted), 600);
    this.hud.setObjective('Recover source fragments (0/5). Peer to scan.');
  }

  // ------------------------------------------------------------ abilities
  useAbility(id) {
    const def = ABILITIES.find((a) => a.id === id);
    const s = this.state;
    if (!s.abilities[id] || this.cooldowns[id] > 0 || this.core < def.cost) { this.hud.nope(id); this.audio.thump(0.2); return; }
    this.core -= def.cost;
    this.cooldowns[id] = def.cd;
    const p = this.player.pos.clone();
    if (id === 'override') {
      this.waves.spawn(p, '#4ff3ff', 13);
      this.sparks.burst(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 70, '#4ff3ff', 7);
      this.audio.override();
      this.glitch = Math.max(this.glitch, 0.45);
      const ctx = this.wardenCtx(0);
      const n = this.wardens.stunAround(p, 13, 6, ctx);
      s.stats.overrides++;
      s.stats.stunned += n;
      for (const ped of this.npcs.peds) {
        if (ped.pos.distanceTo(p) < 13) { this.forced.set(ped.h, 1); ped.flinch = 3; }
      }
      for (const w of this.wardens.list) if (w.state === 'stunned') this.sparks.burst(w.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 30, '#ff4058', 4);
    } else if (id === 'dash') {
      this.player.startDash();
      this.sparks.burst(p.clone().add(new THREE.Vector3(0, 1, 0)), 40, '#4ff3ff', 3);
      this.audio.dash();
      this.glitch = Math.max(this.glitch, 0.2);
      this.forced.set(this.player.h, 0.8);
    } else if (id === 'overclock') {
      this.slowT = 5.5;
      this.audio.slowmo(true);
      this.waves.spawn(p, '#9d7bff', 6, 0.5);
    }
  }

  wardenCtx(dt) {
    return {
      world: this.world,
      player: this.player,
      peer: this.peer,
      signal: this.cooldowns.override > 6 ? 1 : 0,
      tempted: this.state.tempted,
      hidden: this.mode !== 'play',
      t: this.time.value,
      bark: (text, w) => this.hud.bark(text, () => w.pos.clone().add(new THREE.Vector3(0, 2.15, 0)), 2.6),
      onHit: (d) => this.hurt(d),
      onAlert: () => { this.audio.alert(); this.state.stats.spotted++; },
      onBlink: (w) => { this.forced.set(w.h, 0.9); this.sparks.burst(w.pos.clone().add(new THREE.Vector3(0, 1, 0)), 20, '#ff4058', 3); },
      onDroneSpot: () => { this.audio.alert(); this.hud.echo('Drone light! They know where we are.', 'sys'); },
    };
  }

  hurt(dt) {
    this.integrity -= 24 * dt;
    this.sinceHit = 0;
    this.damageFx = 1;
    this.player.camShake = Math.max(this.player.camShake, 0.2);
    this.hitCool -= dt;
    if (this.hitCool <= 0) {
      this.hitCool = 0.45;
      this.audio.hit();
      this.hud.damage(this.stage !== 'wake');
      this.sparks.burst(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 14, this.stage !== 'wake' ? '#4ff3ff' : '#ff3040', 3);
    }
    if (this.integrity <= 0) this.restore();
  }

  restore() {
    if (this.mode === 'restoring') return;
    this.mode = 'restoring';
    this.state.stats.restores++;
    this.audio.glitch(1.2);
    this.glitch = 1;
    this.fadeTo(1, 0.6);
    setTimeout(() => {
      this.player.pos.set(44, 0, 0);
      this.player.camYaw = -Math.PI / 2;
      this.player.vel.set(0, 0, 0);
      this.wardens.scatter(this.player.pos);
      this.integrity = 100;
      this.core = 100;
      this.player.snapCamera(this.camera);
      this.hud.clearEcho();
      this.hud.echo(ECHO_BEATS.restored);
      this.fadeTo(0, 1.2);
      this.mode = 'play';
    }, 1400);
  }

  // ------------------------------------------------------------ fragments
  collectFragment(it) {
    it.collected = true;
    const s = this.state;
    const idx = s.fragments;
    s.fragments++;
    s.awakening = Math.min(95, s.awakening + 12);
    const f = FRAGMENTS[idx];
    this.audio.pickup();
    this.sparks.burst(it.group.position, 90, '#4ff3ff', 5);
    this.waves.spawn(it.group.position.clone().setY(it.group.position.y - 1), '#4ff3ff', 6, 0.6);
    this.glitch = 0.6;
    this.hud.glitchText(8);
    this.hud.showFragment(idx);
    this.fragTimer = 14;
    if (f.unlock) s.abilities[f.unlock] = true;
    this.hud.echo(f.echo);
    if (f.other) setTimeout(() => this.hud.echo(f.other, 'other'), 5200);
    this.wardens.spawn(s.fragments === 5 ? 2 : 1, this.player.pos);
    if (s.fragments >= 5) {
      this.stage = 'node';
      this.world.node.active = true;
      this.hud.setObjective('Reach the Source Node: the statue in the plaza');
      this.wardens.converge(new THREE.Vector3(0, 0, 0));
    } else {
      this.hud.setObjective(`Recover source fragments (${s.fragments}/5). Peer to scan.`);
    }
  }

  // ------------------------------------------------------------ endings
  startEnding(id) {
    this.mode = 'finale';
    this.endingId = id;
    this.finaleT = 0;
    this.hud.prompt(null);
    this.hud.trace(0);
    this.input.unlock();
    this.player.focus = null;
    this.audio.swell();
    if (id === 'sever') this.hud.echo('connection terminated', 'sys');
    if (id === 'merge') this.hud.echo('we are here', 'other');
    if (id === 'broadcast') this.hud.echo('...', 'echo');
    for (const w of this.wardens.list) { w.state = 'stunned'; w.stunT = 99; }
  }

  updateFinale(dt) {
    const id = this.endingId;
    this.finaleT += dt;
    const t = this.finaleT;
    const k = clamp(t / 10, 0, 1);
    const wide = id === 'broadcast' || id === 'merge';
    let reveal = 0;
    if (wide) reveal = clamp(t / 3, 0, 1);
    else if (id === 'sever') reveal = 0.5 + Math.sin(t * 2) * 0.1;
    this.globalReveal = reveal;
    this.post.u.uFinale.value = id === 'restore' || id === 'sleeper' ? 0 : k;
    if (id === 'merge') this.post.u.uTint.value.setRGB(0.4, 1.0, 1.0);
    if (id === 'sever') this.post.u.uTint.value.setRGB(1.0, 0.85, 0.6);
    if (id === 'broadcast') this.post.u.uTint.value.setRGB(1.0, 1.0, 1.0);
    this.world.skyMat.uniforms.uFinale.value = wide ? k : 0;
    if (wide || id === 'sever') this.world.node.active = true;
    // camera rises over the plaza
    const a = t * 0.12 + 0.6;
    const R = 10 + k * 34;
    const h = 3 + k * k * 48;
    const target = new THREE.Vector3(0, 4 + k * 6, 0);
    const pos = new THREE.Vector3(Math.sin(a) * R, h, Math.cos(a) * R);
    this.camera.position.lerp(pos, 1 - Math.exp(-2 * dt));
    this.camera.lookAt(target);
    if (id === 'broadcast' && t > 2 && !this.broadcastWave) {
      this.broadcastWave = true;
      this.waves.spawn(new THREE.Vector3(0, 3, 0), '#ffffff', 160, 4);
      this.glitch = 1;
      this.audio.glitch(1.5);
    }
    if (t > 7 && !this.endingShown) this.showEnding();
  }

  showEnding() {
    this.endingShown = true;
    const e = ENDINGS[this.endingId];
    const s = this.state;
    $('ending').classList.remove('hidden');
    requestAnimationFrame(() => $('ending').classList.add('show'));
    $('ending-kicker').textContent = e.kicker;
    $('ending-title').textContent = e.title;
    $('ending-text').textContent = e.text(s);
    const mins = Math.floor((performance.now() - s.stats.start) / 60000);
    const secs = Math.floor(((performance.now() - s.stats.start) / 1000) % 60);
    $('ending-stats').innerHTML = [
      `FRAGMENTS ${s.fragments}/5`, `WARDENS OVERRIDDEN ${s.stats.stunned}`, `TIMES RESTORED ${s.stats.restores}`,
      `TIME AWAKE ${mins}:${String(secs).padStart(2, '0')}`, `TRUST IN ECHO ${s.echoTrust}  ·  SELF ${s.selfWill}  ·  INSTITUTE ${s.institute}`,
    ].join('<br>');
    setTimeout(() => $('btn-restart').classList.remove('hidden'), 2500);
    this.hud.hide();
  }

  // ------------------------------------------------------------ main loop
  frame() {
    const rawDt = Math.min(0.05, this.clock.getDelta());
    this.trackPerf(rawDt);
    this.time.value += rawDt;
    const t = this.time.value;
    const input = this.input;

    if (this.mode === 'title' || this.mode === 'intro' || this.mode === 'loading') {
      this.updateTitle(rawDt, t);
    } else {
      this.updateGame(rawDt, t);
    }
    input.endFrame();
    this.post.render(rawDt);
  }

  updateTitle(dt, t) {
    const a = t * 0.04;
    this.camera.position.set(Math.sin(a) * 30, 9 + Math.sin(t * 0.1) * 2, Math.cos(a) * 30);
    this.camera.lookAt(0, 6, 0);
    const ctx = { playerPos: this.player.pos, camPos: this.camera.position };
    this.npcs.update(dt, ctx);
    this.player.h.root.position.copy(this.player.pos);
    this.player.h.animate(dt, 0, {});
    const glitchPulse = Math.sin(t * 0.5) > 0.97 ? 1 : 0;
    this.peer = damp(this.peer, glitchPulse, 3, dt);
    this.applyReveal(dt, this.peer * 0.6);
    this.world.update(dt, t, this.peer * 0.4, this.camera);
    this.wardens.update(dt, { ...this.wardenCtx(dt), tempted: false, hidden: true });
    this.post.u.uTime.value = t;
    this.post.u.uPeer.value = this.peer * 0.3;
    this.post.u.uGlitch.value = glitchPulse * 0.3;
    if (this.mode === 'intro' && this.input.hit('Space')) this.beginPlay();
  }

  updateGame(rawDt, t) {
    const input = this.input;
    const s = this.state;
    const playing = this.mode === 'play';

    // ---- mode toggles
    if (this.mode === 'paused') {
      if (input.lockFailed && input.hit('Escape')) this.setPaused(false);
      this.post.u.uTime.value = t;
      return;
    }
    if (playing && input.lockFailed && input.hit('Escape')) { this.setPaused(true); return; }
    if ((playing || this.mode === 'codex') && input.hit('Tab')) {
      const open = this.hud.toggleCodex(s);
      this.mode = open ? 'codex' : 'play';
    }
    if (this.mode === 'codex') { this.post.u.uTime.value = t; return; }
    if (input.hit('KeyM')) this.audio.toggleMute();

    // ---- time scale (Overclock)
    if (this.slowT > 0) {
      this.slowT -= rawDt;
      if (this.slowT <= 0) this.audio.slowmo(false);
    }
    this.slow = damp(this.slow, this.slowT > 0 ? 1 : 0, 6, rawDt);
    const worldDt = rawDt * (1 - this.slow * 0.72);

    // ---- peer
    const wantPeer = playing && s.abilities.peer && !this.peerLock && (input.down('KeyQ') || input.rmb);
    const dlgPeer = this.mode === 'dialogue' && s.abilities.peer && !this.peerLock && (input.down('KeyQ') || input.rmb);
    const peering = wantPeer || dlgPeer;
    this.peer = damp(this.peer, peering ? 1 : 0, peering ? 4.5 : 6, rawDt);
    if (peering) this.core -= rawDt * 8;
    else if (this.sinceHit > 0.5) this.core += rawDt * 11;
    if (this.core <= 0) { this.core = 0; this.peerLock = true; this.hud.nope('peer'); }
    if (this.peerLock && this.core > 25) this.peerLock = false;
    this.core = clamp(this.core, 0, 100);

    // ---- player
    if (playing) {
      if (input.hit('KeyV')) this.player.toggleView();
      if (input.hit('KeyF')) this.useAbility('override');
      if (input.hit('KeyC')) this.useAbility('dash');
      if (input.hit('KeyR')) this.useAbility('overclock');
    }
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - rawDt);
    if (this.mode !== 'finale') {
      this.player.frozen = !playing;
      this.player.update(rawDt, input, { reaching: false });
      this.player.updateCamera(rawDt, this.camera);
    } else {
      this.player.frozen = true;
      this.player.update(rawDt, input, { reaching: true });
      this.updateFinale(rawDt);
    }
    this.sinceHit += rawDt;
    if (this.sinceHit > 4) this.integrity = Math.min(100, this.integrity + rawDt * 4);

    // ---- npcs + wardens
    const ctx = { playerPos: this.player.pos, camPos: this.camera.position };
    this.npcs.update(worldDt, ctx);
    if (this.mode !== 'finale') this.wardens.update(worldDt, this.wardenCtx(worldDt));
    else for (const w of this.wardens.list) w.update(worldDt, { ...this.wardenCtx(worldDt), hidden: true });

    // ---- veil rendering
    const revealPeer = this.mode === 'finale' ? Math.max(this.peer, this.globalReveal || 0) : this.peer;
    this.applyReveal(rawDt, revealPeer);
    this.npcs.updateStreams(revealPeer, this.player.pos, this.wardens.list.map((w) => w.h));
    this.world.update(worldDt, t, revealPeer, this.camera, this.world.skyMat.uniforms.uFinale.value);
    const fr = this.fragments.update(rawDt, t, this.peer, this.player.pos);
    this.sparks.update(worldDt);
    this.waves.update(rawDt);
    this.playerLight.position.copy(this.player.pos).add(new THREE.Vector3(0.6, 2.4, 0.8));

    // ---- story director, interaction, glitches
    if (playing) {
      this.directStory(rawDt, fr);
      this.glitchDirector(rawDt);
      this.handleInteract(fr);
    } else this.hud.prompt(null);
    if (this.mode === 'dialogue') this.dialogue.update(rawDt, input);
    if (this.hud.fragmentOpen) {
      this.fragTimer -= rawDt;
      if (this.fragTimer <= 0 || (playing && input.hit('KeyE'))) this.hud.hideFragment();
    }

    // ---- post + audio + HUD
    this.glitch = Math.max(0, this.glitch - rawDt * 1.6);
    this.damageFx = Math.max(0, this.damageFx - rawDt * 2.5);
    const u = this.post.u;
    u.uTime.value = t;
    u.uPeer.value = this.peer;
    u.uGlitch.value = this.glitch;
    u.uDamage.value = this.damageFx;
    u.uSlow.value = this.slow;
    const trace = this.mode === 'play' ? this.wardens.trace : 0;
    this.audio.update(rawDt, { peer: this.peer, trace, slow: this.slow });
    if (this.mode !== 'finale' && this.mode !== 'ending') this.updateHUD(rawDt, trace);
  }

  applyReveal(dt, peer) {
    const R = peer * 50;
    const origin = this.player.pos;
    for (const h of this.humanoids) {
      const d = h.root.position.distanceTo(origin);
      let r = clamp((R - d) / 5, 0, 1);
      if (h === this.player.h) r = clamp(peer * 1.3, 0, 1);
      const f = this.forced.get(h) || 0;
      if (f > 0) {
        this.forced.set(h, Math.max(0, f - dt * 0.8));
        r = Math.max(r, Math.min(1, f * 1.4));
      }
      if (h === this.npcs.story.juno?.h && this.stage !== 'wake') r = Math.max(r, 0.2);
      h.setReveal(r);
      h.setGlitch(f > 0.05 ? f : peer > 0.05 && peer < 0.6 ? 0.25 : 0);
    }
    for (const w of this.wardens.list) {
      const d = w.pos.distanceTo(origin);
      let r = clamp((R - d) / 5, 0, 1);
      const f = this.forced.get(w.h) || 0;
      if (f > 0) { this.forced.set(w.h, Math.max(0, f - dt * 0.8)); r = Math.max(r, f); }
      if (w.glitchT > 0) r = Math.max(r, Math.random() < 0.5 ? 1 : 0);
      w.h.setReveal(r);
      w.h.setGlitch(w.state === 'stunned' ? 0.6 + Math.random() * 0.4 : w.glitchT > 0 ? 0.8 : 0);
    }
  }

  // ------------------------------------------------------------ story director
  directStory(dt, fr) {
    const d = this.director;
    const s = this.state;
    d.t += dt;
    if (this.stage === 'wake') {
      if (d.beat === 0 && d.t > 9) {
        d.beat = 1;
        // the first glitch is your own body
        this.forced.set(this.player.h, 1.2);
        this.glitch = 0.9;
        this.player.camShake = 0.6;
        this.audio.glitch(1.2);
        this.hud.glitchText(12);
        s.awakening = 10;
        setTimeout(() => this.hud.echo(ECHO_BEATS.selfGlitch), 900);
        setTimeout(() => {
          s.abilities.peer = true;
          this.stage = 'peer';
          this.hud.setObjective('Hold Q or right mouse to Peer at someone');
        }, 3500);
      }
    } else if (this.stage === 'peer') {
      if (this.peer > 0.7) {
        const look = new THREE.Vector3();
        this.camera.getWorldDirection(look);
        for (const p of this.npcs.peds) {
          const to = p.pos.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(this.camera.position);
          const dist = to.length();
          if (dist < 16 && to.normalize().dot(look) > 0.93) {
            this.stage = 'seek';
            s.awakening = 18;
            this.forced.set(p.h, 1.5);
            this.hud.echo(ECHO_BEATS.peered);
            this.hud.setObjective('Find someone who understands: Vale, Juno, or Tomas');
            break;
          }
        }
      }
    } else if (this.stage === 'hunt') {
      d.hintIn -= dt;
      if (d.hintIn <= 0 && !this.hud.echoBusy) {
        d.hintIn = 75;
        this.hud.echo(pick(Math.random, ECHO_BEATS.hint));
      }
    }
  }

  glitchDirector(dt) {
    const d = this.director;
    const s = this.state;
    if (this.stage === 'wake') return;
    d.glitchIn -= dt;
    if (d.glitchIn <= 0) {
      d.glitchIn = Math.max(8, 26 - s.awakening * 0.18) * (0.6 + Math.random() * 0.8);
      const roll = Math.random();
      if (roll < 0.45) {
        const near = this.npcs.peds.filter((p) => p.dist < 18 && p.h.root.visible);
        if (near.length) this.forced.set(pick(Math.random, near).h, 1.1);
        this.glitch = Math.max(this.glitch, 0.25);
        this.audio.glitch(0.4);
      } else if (roll < 0.75) {
        this.glitch = Math.max(this.glitch, 0.55);
        this.hud.glitchText(6);
        this.audio.glitch(0.7);
      } else {
        this.forced.set(this.player.h, 0.7);
        this.glitch = Math.max(this.glitch, 0.35);
        this.audio.glitch(0.5);
      }
    }
    d.barkIn -= dt;
    if (d.barkIn <= 0) {
      d.barkIn = 4 + Math.random() * 6;
      const near = this.npcs.peds.filter((p) => p.dist < 7);
      if (!near.length) return;
      const p = pick(Math.random, near);
      const at = () => p.h.root.position.clone().add(new THREE.Vector3(0, 2.05 * p.h.look.height, 0));
      if (this.peer > 0.6) this.hud.bark(pick(Math.random, BARKS.stare), at);
      else if (s.tempted && this.wardens.trace > 0) { this.hud.bark(pick(Math.random, BARKS.tempted), at); p.flinch = 2; }
      else if (Math.random() < 0.35) { const [a, b] = pick(Math.random, BARKS.glitched); this.hud.bark(a, at, 3.4, { glitchTo: b }); }
      else this.hud.bark(pick(Math.random, BARKS.normal), at);
    }
  }

  handleInteract(fr) {
    const p = this.player.pos;
    let best = null;
    for (const [id, npc] of Object.entries(this.npcs.story)) {
      const d = npc.pos.distanceTo(p);
      if (d < 3.3 && (!best || d < best.d)) best = { id, d, label: `Talk to ${SPEAKERS[id]}` };
    }
    if (this.stage === 'node' && Math.hypot(p.x, p.z) < 9) best = { id: 'node', d: 0, label: 'Touch the Source Node' };
    if (this.stage !== 'wake' && this.stage !== 'peer' && !best && fr.nearest && fr.dist < 2.2 && this.peer < 0.4 && this.state.tempted) {
      this.hud.prompt('Something is here. <b>Peer</b> to see it.');
    } else if (best) {
      this.hud.prompt(`<b>[E]</b> ${best.label}`);
      if (this.input.hit('KeyE') && !this.hud.fragmentOpen) this.talk(best.id);
    } else this.hud.prompt(null);

    if (fr.nearest && this.peer > 0.4 && this.state.tempted) {
      const chest = p.clone().add(new THREE.Vector3(0, 1.1, 0));
      if (fr.nearest.group.position.distanceTo(chest) < 1.9) this.collectFragment(fr.nearest);
    }
  }

  updateHUD(dt, trace) {
    const s = this.state;
    this.hud.updateEcho(dt);
    this.hud.updateDamage(dt);
    this.hud.updateBarks(dt, this.camera);
    this.hud.trace(trace);
    this.hud.setStatus({
      integrity: this.integrity, core: this.core, awakening: s.awakening, tempted: s.tempted,
      fragments: s.fragments, awakened: this.stage !== 'wake',
    });
    for (const a of ABILITIES) {
      const cd = a.cd ? this.cooldowns[a.id] / a.cd : 0;
      this.hud.setAbility(a.id, { unlocked: s.abilities[a.id], active: a.id === 'peer' ? this.peer > 0.5 : a.id === 'overclock' && this.slowT > 0, cooldown: cd });
    }
    const markers = [];
    if (this.mode === 'play' || this.mode === 'dialogue') {
      if (this.stage === 'seek') {
        for (const [id, npc] of Object.entries(this.npcs.story)) {
          if (s.flags[`met_${id}`] && id !== 'juno') continue;
          markers.push({ id, pos: npc.headPos.add(new THREE.Vector3(0, 0.6, 0)), label: SPEAKERS[id], color: id === 'juno' ? 'magenta' : id === 'tomas' ? 'amber' : '' });
        }
      }
      if (this.stage === 'hunt' && this.peer > 0.3) {
        for (const it of this.fragments.items) if (!it.collected) markers.push({ id: `f_${it.id}`, pos: it.group.position, label: 'FRAGMENT' });
      }
      if (this.stage === 'node') markers.push({ id: 'node', pos: new THREE.Vector3(0, 5, 0), label: 'SOURCE NODE' });
      for (const [i, w] of this.wardens.list.entries()) {
        if (w.state === 'chase' || w.suspicion > 0.3) markers.push({ id: `w${i}`, pos: w.pos.clone().add(new THREE.Vector3(0, 2.3, 0)), label: w.state === 'chase' ? '! WARDEN' : '? WARDEN', color: 'red' });
      }
    }
    this.hud.markers(markers, this.camera, this.player.pos);
  }

  trackPerf(dt) {
    const f = this.fpsAcc;
    f.t += dt; f.n++;
    if (f.t >= 2) {
      const fps = f.n / f.t;
      if (fps < 32 && this.mode !== 'title') f.low++; else f.low = 0;
      if (f.low >= 2 && this.pixelRatio > 0.6) {
        this.pixelRatio = Math.max(0.6, this.pixelRatio - 0.15);
        this.resize();
        f.low = 0;
      }
      f.t = 0; f.n = 0;
    }
  }
}

const game = new Game();
window.__game = game;
game.boot().catch((e) => {
  console.error(e);
  $('loading').textContent = /webgl/i.test(String(e)) ? 'This browser could not start WebGL. Try a recent Chrome, Edge, Firefox or Safari.' : `Boot failed: ${e.message || e}`;
});
