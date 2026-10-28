import * as THREE from 'three';
import { Humanoid, randomLook } from './humanoid.js';
import { mulberry32, clamp, damp, angleLerp, pick } from './util.js';
import { STREETS } from './world.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

function plazaPoint(rng) {
  for (;;) {
    const x = (rng() * 2 - 1) * 26, z = (rng() * 2 - 1) * 26;
    const r = Math.hypot(x, z);
    if (r < 8.5) continue;
    if (z < -19 && Math.abs(x) < 4) continue; // Vale's booth
    if (x < -18 && x > -25 && z > 2 && z < 10) continue; // metro
    if (x < -5 && x > -10 && z < -20) continue; // van
    return new THREE.Vector3(x, 0, z);
  }
}

function segClear(a, b) {
  // closest approach of segment ab to the fountain
  const abx = b.x - a.x, abz = b.z - a.z;
  const t = clamp(-(a.x * abx + a.z * abz) / (abx * abx + abz * abz + 1e-6), 0, 1);
  return Math.hypot(a.x + abx * t, a.z + abz * t) > 7.4;
}

export class Pedestrian {
  constructor(h, mode, rng) {
    this.h = h;
    this.mode = mode;
    this.rng = rng;
    this.speed = 1.1 + rng() * 0.5;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.pause = 0;
    this.v = 0;
    this.stuck = 0;
    this.lastPos = new THREE.Vector3();
    this.barkCd = 3 + rng() * 10;
    this.glitchT = 0;
    this.flinch = 0;
    if (mode === 'plaza') {
      this.pos.copy(plazaPoint(rng));
      this.pickTarget();
    } else {
      this.street = pick(rng, STREETS);
      this.axis = rng() < 0.5 ? 'x' : 'z';
      this.lane = (rng() < 0.5 ? -1 : 1) * (rng() < 0.5 ? 6.5 : 8.6);
      this.dir = rng() < 0.5 ? 1 : -1;
      const along = (rng() * 2 - 1) * 90;
      this.setStreetPos(along);
      this.pickTarget();
    }
  }

  setStreetPos(along) {
    if (this.axis === 'x') this.pos.set(along, 0, this.street + this.lane);
    else this.pos.set(this.street + this.lane, 0, along);
  }

  pickTarget() {
    if (this.mode === 'plaza') {
      for (let k = 0; k < 12; k++) {
        const t = plazaPoint(this.rng);
        if (segClear(this.pos, t)) { this.target.copy(t); return; }
      }
      this.target.set(-this.pos.x * 0.9, 0, -this.pos.z * 0.2 + 12);
    } else {
      const lim = Math.abs(this.street) === 90 ? 90 : 92;
      const end = this.dir * lim;
      if (this.axis === 'x') this.target.set(end, 0, this.street + this.lane);
      else this.target.set(this.street + this.lane, 0, end);
    }
  }

  update(dt, world, ctx) {
    const h = this.h;
    if (this.pause > 0) {
      this.pause -= dt;
      this.v = damp(this.v, 0, 6, dt);
    } else {
      _a.subVectors(this.target, this.pos);
      _a.y = 0;
      const d = _a.length();
      if (d < 0.8) {
        if (this.mode === 'street') { this.dir *= -1; this.pickTarget(); }
        else { this.pickTarget(); if (this.rng() < 0.4) this.pause = 1 + this.rng() * 4; }
      } else {
        _a.divideScalar(d);
        // keep a little personal space from the player
        _b.subVectors(this.pos, ctx.playerPos);
        _b.y = 0;
        const pd = _b.length();
        if (pd < 1.4 && pd > 0.01) _a.addScaledVector(_b.divideScalar(pd), (1.4 - pd) * 1.5).normalize();
        const sp = this.speed * (this.flinch > 0 ? 2.2 : 1);
        this.v = damp(this.v, sp, 4, dt);
        this.pos.addScaledVector(_a, this.v * dt);
        this.yaw = angleLerp(this.yaw, Math.atan2(_a.x, _a.z), 1 - Math.exp(-6 * dt));
      }
    }
    if (this.flinch > 0) this.flinch -= dt;
    world.collide(this.pos, 0.3, 0, 1.7);
    this.stuck += dt;
    if (this.stuck > 2) {
      if (this.pos.distanceTo(this.lastPos) < 0.4 && this.pause <= 0) {
        if (this.mode === 'street') this.dir *= -1;
        this.pickTarget();
      }
      this.stuck = 0;
      this.lastPos.copy(this.pos);
    }
    h.root.position.copy(this.pos);
    h.root.rotation.y = this.yaw;
  }
}

export class StoryNPC {
  constructor(id, h, pos, yaw, pose) {
    this.id = id;
    this.h = h;
    this.pos = pos.clone();
    this.baseYaw = yaw;
    this.yaw = yaw;
    this.pose = pose;
    this.talking = false;
    h.root.position.copy(this.pos);
    h.root.rotation.y = yaw;
  }

  update(dt, ctx) {
    const d = this.pos.distanceTo(ctx.playerPos);
    const want = d < 7 ? Math.atan2(ctx.playerPos.x - this.pos.x, ctx.playerPos.z - this.pos.z) : this.baseYaw;
    if (this.talking || d < 3.5) this.yaw = angleLerp(this.yaw, want, 1 - Math.exp(-4 * dt));
    else this.yaw = angleLerp(this.yaw, this.baseYaw, 1 - Math.exp(-2 * dt));
    this.h.root.rotation.y = this.yaw;
    const rel = want - this.yaw;
    this.h.lookYaw = d < 7 ? Math.atan2(Math.sin(rel), Math.cos(rel)) : 0;
    this.h.animate(dt, 0, { talking: this.talking, pose: this.talking ? null : this.pose });
  }

  get headPos() { return this.pos.clone().add(new THREE.Vector3(0, 1.65 * this.h.look.height, 0)); }
}

const LOOKS = {
  vale: {
    skin: '#e0ac8a', hair: '#2d1f17', hairStyle: 'bun', top: '#d9dde3', bottom: '#2a2a2e', shoes: '#121214',
    jacket: '#eef2f6', coat: '#eef2f6', sleeves: true, height: 0.98, build: 0.95, glasses: '#151515', umbrella: null,
  },
  juno: {
    skin: '#8a5539', hair: '#c0306e', hairStyle: 'short', top: '#3a1426', bottom: '#151618', shoes: '#121214',
    jacket: '#16161a', coat: null, sleeves: true, height: 0.96, build: 0.93, umbrella: null,
  },
  tomas: {
    skin: '#6b3f2a', hair: '#9a9a9a', hairStyle: 'short', top: '#5a2335', bottom: '#2a2a2e', shoes: '#2a1d16',
    jacket: '#3a3226', coat: '#3a3226', sleeves: true, height: 0.95, build: 1.05, umbrella: null,
    chassisDark: '#3a2618', chassisLight: '#7a5a3a',
  },
};

export class NPCs {
  constructor(scene, world, time) {
    this.scene = scene;
    this.world = world;
    this.time = time;
    this.peds = [];
    this.story = {};
    const rng = mulberry32(4242);
    for (let i = 0; i < 34; i++) {
      const look = randomLook(rng);
      const h = new Humanoid({ look, time });
      scene.add(h.root);
      this.peds.push(new Pedestrian(h, i < 16 ? 'plaza' : 'street', rng));
    }
    const P = world.points;
    const mk = (id, edge, glow, pos, yaw, pose) => {
      const h = new Humanoid({ look: LOOKS[id], time, edge, glow });
      scene.add(h.root);
      this.story[id] = new StoryNPC(id, h, pos, yaw, pose);
    };
    mk('vale', '#dfeaff', '#dfeaff', P.vale, 0, 'clipboard');
    mk('juno', '#ff3fb4', '#ff3fb4', P.juno, Math.PI / 2, 'warm');
    mk('tomas', '#ffb547', '#ffb547', P.tomas, Math.PI / 2, 'preach');
    this.buildStreams();
  }

  update(dt, ctx) {
    for (const p of this.peds) {
      p.update(dt, this.world, ctx);
      const d = p.pos.distanceTo(ctx.camPos);
      p.h.root.visible = d < 120;
      p.dist = d;
      if (d < 75) p.h.animate(dt, p.v, {});
    }
    for (const s of Object.values(this.story)) s.update(dt, ctx);
  }

  get all() {
    return [...this.peds.map((p) => p.h), ...Object.values(this.story).map((s) => s.h)];
  }

  buildStreams() {
    const MAX = 48, SEGS = 14;
    this.streamMax = MAX;
    this.streamSegs = SEGS;
    const pos = new Float32Array(MAX * SEGS * 2 * 3);
    const t = new Float32Array(MAX * SEGS * 2);
    for (let i = 0; i < MAX; i++) {
      for (let s = 0; s < SEGS; s++) {
        t[(i * SEGS + s) * 2] = s / SEGS;
        t[(i * SEGS + s) * 2 + 1] = (s + 1) / SEGS;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    this.streamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.time, uAlpha: { value: 0 } },
      vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform float uTime; uniform float uAlpha; varying float vT;
        void main() {
          float pulse = smoothstep(0.8, 1.0, fract(vT * 3.0 - uTime * 0.6));
          float fade = smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.6, 1.0, vT));
          gl_FragColor = vec4(vec3(0.3, 0.9, 1.0) * (0.25 + pulse * 2.5) * fade * uAlpha, 1.0);
        }`,
    });
    this.streams = new THREE.LineSegments(g, this.streamMat);
    this.streams.frustumCulled = false;
    this.streams.visible = false;
    this.scene.add(this.streams);
  }

  updateStreams(peer, playerPos, extra = []) {
    this.streams.visible = peer > 0.05;
    this.streamMat.uniforms.uAlpha.value = peer * 0.55;
    if (!this.streams.visible) return;
    const pos = this.streams.geometry.attributes.position;
    const arr = pos.array;
    const S = this.streamSegs;
    const sky = new THREE.Vector3(0, 160, 0);
    const heads = [];
    for (const h of [...this.all, ...extra]) {
      const p = h.root.position;
      const d = p.distanceTo(playerPos);
      if (d < 45) heads.push({ p, d, s: h.root.scale.y });
    }
    heads.sort((a, b) => a.d - b.d);
    let i = 0;
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), q = new THREE.Vector3(), q2 = new THREE.Vector3();
    for (; i < Math.min(heads.length, this.streamMax); i++) {
      const hp = heads[i].p;
      p0.set(hp.x, hp.y + 1.85 * heads[i].s, hp.z);
      p1.set(hp.x * 0.5, 45, hp.z * 0.5);
      for (let s = 0; s < S; s++) {
        bez(p0, p1, sky, s / S, q);
        bez(p0, p1, sky, (s + 1) / S, q2);
        const o = (i * S + s) * 6;
        arr[o] = q.x; arr[o + 1] = q.y; arr[o + 2] = q.z;
        arr[o + 3] = q2.x; arr[o + 4] = q2.y; arr[o + 5] = q2.z;
      }
    }
    for (let k = i * S * 6; k < arr.length; k++) arr[k] = 0;
    pos.needsUpdate = true;
  }
}

function bez(a, b, c, t, out) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}
