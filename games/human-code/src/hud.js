import * as THREE from 'three';
import { corrupt, hex } from './util.js';
import { FRAGMENTS } from './story.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const markup = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
export const codeMarkup = (s) => s
  .replace(/<c>/g, '<span class="tok-c">').replace(/<k>/g, '<span class="tok-k">').replace(/<s>/g, '<span class="tok-s">')
  .replace(/<\/[cks]>/g, '</span>');

const _v = new THREE.Vector3();

// First n visible characters of a *marked* string, keeping highlights open while typing.
function partialMarkup(text, n) {
  let out = '';
  let left = n;
  text.split('*').forEach((seg, i) => {
    if (left <= 0) return;
    const part = seg.slice(0, left);
    left -= part.length;
    out += i % 2 ? `<em>${esc(part)}</em>` : esc(part);
  });
  return out;
}

export class HUD {
  constructor(audio) {
    this.audio = audio;
    this.root = $('hud');
    this.log = $('echo-log');
    this.queue = [];
    this.typing = null;
    this.wait = 0;
    this.markerEls = new Map();
    this.barks = [];
    this.glitchSpans = [];
    this.damageT = 0;
    this.abilityEls = {};
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  // ---------- ECHO terminal ----------
  echo(text, kind = 'echo') {
    const arr = Array.isArray(text) ? text : [text];
    for (const t of arr) this.queue.push({ text: t, kind });
  }
  get echoBusy() { return this.typing || this.queue.length > 0; }

  clearEcho() {
    this.queue = [];
    this.typing = null;
    this.log.innerHTML = '';
  }

  updateEcho(dt) {
    if (this.typing) {
      const m = this.typing;
      m.i += dt * (m.kind === 'other' ? 22 : 46);
      const total = m.plain.replace(/\*/g, '').length;
      const n = Math.min(total, Math.floor(m.i));
      if (n !== m.shown) {
        if (n % 3 === 0) this.audio.blip();
        m.shown = n;
        const html = m.kind === 'other' ? esc(corrupt(m.plain.slice(0, n), 0.15)) : partialMarkup(m.plain, n);
        m.el.innerHTML = (m.kind === 'other' ? '&lt;&lt; ' : '') + html + (m.kind === 'other' ? ' &gt;&gt;' : '') + '<span class="cursor"></span>';
      }
      if (n >= total) {
        m.el.innerHTML = m.kind === 'other' ? `&lt;&lt; ${esc(m.plain)} &gt;&gt;` : markup(m.plain);
        this.typing = null;
        this.wait = 1.1 + m.plain.length * 0.028;
      }
      return;
    }
    if (this.wait > 0) { this.wait -= dt; return; }
    const next = this.queue.shift();
    if (!next) return;
    for (const el of this.log.querySelectorAll('.msg')) el.classList.remove('latest');
    const el = document.createElement('div');
    el.className = `msg latest ${next.kind}`;
    this.log.appendChild(el);
    while (this.log.children.length > 4) this.log.firstChild.remove();
    this.typing = { el, plain: next.text, i: 0, shown: -1, kind: next.kind };
    if (next.kind === 'other') this.audio.glitch(0.6);
  }

  // ---------- status ----------
  setObjective(text) {
    const el = $('obj-text');
    if (el.textContent === text) return;
    el.textContent = text;
    const o = $('objective');
    o.classList.remove('flash');
    void o.offsetWidth;
    o.classList.add('flash');
  }

  setStatus(s) {
    $('integrity-fill').style.width = `${Math.max(0, s.integrity)}%`;
    $('integrity-fill').classList.toggle('chassis', s.awakened);
    $('integrity-label').textContent = s.awakened ? 'INTEGRITY' : 'HEALTH';
    $('core-fill').style.width = `${Math.max(0, s.core)}%`;
    $('awaken-val').textContent = `${Math.round(s.awakening)}%`;
    const t = $('status-title');
    const title = s.tempted ? 'TEMPTED ONE' : s.awakened ? 'GLITCHING' : 'CIVILIAN';
    if (t.textContent !== title) t.textContent = title;
    t.classList.toggle('tempted', s.tempted);
    $('frag-val').textContent = `${s.fragments}/5`;
  }

  buildAbilities(defs) {
    const wrap = $('abilities');
    wrap.innerHTML = '';
    for (const d of defs) {
      const el = document.createElement('div');
      el.className = 'ability locked';
      el.innerHTML = `<span class="key">${d.key}</span><span class="icon">${d.icon}</span><span class="name">${d.name}</span><div class="cd"></div>`;
      wrap.appendChild(el);
      this.abilityEls[d.id] = el;
    }
  }

  setAbility(id, { unlocked, active, cooldown }) {
    const el = this.abilityEls[id];
    if (!el) return;
    el.classList.toggle('locked', !unlocked);
    el.classList.toggle('active', !!active);
    el.querySelector('.cd').style.height = `${Math.round((cooldown || 0) * 100)}%`;
  }

  nope(id) {
    const el = this.abilityEls[id];
    if (!el) return;
    el.classList.remove('nope');
    void el.offsetWidth;
    el.classList.add('nope');
  }

  prompt(html) {
    const el = $('prompt');
    if (!html) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  trace(level) {
    const el = $('trace');
    el.classList.toggle('hidden', level === 0);
    el.classList.toggle('searching', level === 1);
    const txt = level >= 2 ? '◆ TRACE DETECTED ◆' : '◇ WARDENS SEARCHING ◇';
    if (el.textContent !== txt) el.textContent = txt;
  }

  damage(awakened) {
    if (this.damageT > 0) return;
    const el = $('damage-text');
    el.classList.remove('hidden', 'chassis');
    const fleshy = ['LACERATION', 'BLUNT TRAUMA', 'BLOOD LOSS'];
    const truth = ['CHASSIS BREACH', 'COOLANT LEAK', 'SERVO FAULT'];
    const k = Math.floor(Math.random() * 3);
    el.textContent = fleshy[k];
    this.damageT = 1.2;
    if (awakened) {
      setTimeout(() => { el.textContent = truth[k]; el.classList.add('chassis'); }, 260);
    }
  }

  updateDamage(dt) {
    if (this.damageT > 0) {
      this.damageT -= dt;
      if (this.damageT <= 0) $('damage-text').classList.add('hidden');
    }
  }

  glitchText(count = 6) {
    const wrap = $('glitch-text');
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 85}%`;
      s.style.top = `${Math.random() * 90}%`;
      const msgs = ['ERR PERCEPTION_FILTER', `0x${hex(Math.random() * 65535)} DESYNC`, 'SKIN.render() FAILED', 'VEIL INTEGRITY 97%', 'REMAP chassis->"skin"',
        'heartbeat.wav LOOP', `COOLANT ${Math.floor(30 + Math.random() * 40)}°C`, 'DO NOT INSPECT SELF', 'memory.comfort()'];
      s.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      wrap.appendChild(s);
      setTimeout(() => s.remove(), 160 + Math.random() * 380);
    }
  }

  // ---------- world-anchored ----------
  project(pos, camera, w, h) {
    _v.copy(pos).project(camera);
    const behind = _v.z > 1;
    return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, behind };
  }

  markers(list, camera, playerPos) {
    const w = innerWidth, h = innerHeight;
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let el = this.markerEls.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `marker ${m.color || ''}`;
        el.innerHTML = '<div class="dia"></div><div class="lbl"></div>';
        $('markers').appendChild(el);
        this.markerEls.set(m.id, el);
      }
      const p = this.project(m.pos, camera, w, h);
      let { x, y } = p;
      if (p.behind) { x = w - x; y = h - 40; }
      const margin = 40;
      x = Math.min(w - margin, Math.max(margin, x));
      y = Math.min(h - 120, Math.max(90, y));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      const d = Math.round(m.pos.distanceTo(playerPos));
      const label = `${m.label} · ${d}m`;
      const lbl = el.lastChild;
      if (lbl.textContent !== label) lbl.textContent = label;
      el.style.opacity = d < 4 ? 0.25 : 1;
    }
    for (const [id, el] of this.markerEls) {
      if (!seen.has(id)) { el.remove(); this.markerEls.delete(id); }
    }
  }

  bark(text, getPos, dur = 3.2, opts = {}) {
    if (this.barks.length > 5) return;
    const el = document.createElement('div');
    el.className = 'bark';
    el.innerHTML = opts.glitchTo ? `${esc(text)}` : esc(text);
    $('barks').appendChild(el);
    const b = { el, getPos, t: dur, text, glitchTo: opts.glitchTo, swapped: false };
    this.barks.push(b);
  }

  updateBarks(dt, camera) {
    const w = innerWidth, h = innerHeight;
    for (let i = this.barks.length - 1; i >= 0; i--) {
      const b = this.barks[i];
      b.t -= dt;
      if (b.glitchTo && !b.swapped && b.t < 1.6) {
        b.swapped = true;
        b.el.innerHTML = `<span class="glitchy">${esc(b.glitchTo)}</span>`;
      }
      const p = this.project(b.getPos(), camera, w, h);
      if (p.behind || b.t <= 0) b.el.style.opacity = 0;
      else {
        b.el.style.opacity = Math.min(1, b.t * 2);
        b.el.style.left = `${p.x}px`;
        b.el.style.top = `${p.y}px`;
      }
      if (b.t <= 0) { b.el.remove(); this.barks.splice(i, 1); }
    }
  }

  // ---------- fragment + codex ----------
  showFragment(index) {
    const f = FRAGMENTS[index];
    $('frag-title').textContent = `SOURCE FRAGMENT ${index + 1}/5  //  ${f.title}`;
    $('frag-code').innerHTML = codeMarkup(f.code);
    $('fragment-modal').classList.remove('hidden');
  }
  hideFragment() { $('fragment-modal').classList.add('hidden'); }
  get fragmentOpen() { return !$('fragment-modal').classList.contains('hidden'); }

  toggleCodex(state, open) {
    const el = $('codex');
    const show = open ?? el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    if (!show) return false;
    const list = $('codex-list');
    list.innerHTML = '';
    FRAGMENTS.forEach((f, i) => {
      const d = document.createElement('div');
      if (i < state.fragments) {
        d.className = 'codex-entry';
        d.innerHTML = `<h4>${i + 1} // ${f.title}</h4><pre class="codex-code">${codeMarkup(f.code)}</pre>`;
      } else {
        d.className = 'codex-entry locked';
        d.textContent = `${i + 1} // ▒▒▒▒▒▒▒▒ — not recovered`;
      }
      list.appendChild(d);
    });
    return true;
  }
}
