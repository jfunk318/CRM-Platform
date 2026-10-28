import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_NOISE, clamp, damp, pick } from './util.js';

// Bind-pose joints in metres. +z is forward, +x is the character's left.
const BONE_DEF = {
  root: [null, 0, 0, 0],
  hips: ['root', 0, 0.95, 0],
  spine: ['hips', 0, 1.18, 0],
  neck: ['spine', 0, 1.47, 0],
  head: ['neck', 0, 1.56, 0],
  shL: ['spine', 0.19, 1.42, 0],
  elL: ['shL', 0.21, 1.14, 0],
  haL: ['elL', 0.22, 0.88, 0],
  shR: ['spine', -0.19, 1.42, 0],
  elR: ['shR', -0.21, 1.14, 0],
  haR: ['elR', -0.22, 0.88, 0],
  hiL: ['hips', 0.095, 0.93, 0],
  knL: ['hiL', 0.1, 0.5, 0],
  ftL: ['knL', 0.1, 0.08, 0],
  hiR: ['hips', -0.095, 0.93, 0],
  knR: ['hiR', -0.1, 0.5, 0],
  ftR: ['knR', -0.1, 0.08, 0],
};
const BONE_NAMES = Object.keys(BONE_DEF);
const BI = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));
const P = (name) => new THREE.Vector3(BONE_DEF[name][1], BONE_DEF[name][2], BONE_DEF[name][3]);

const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class PartBuilder {
  constructor() { this.geos = []; }
  add(geo, bone, color, glow = 0, pos = null, rot = null, scale = null) {
    for (const key of Object.keys(geo.attributes)) if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key);
    // polyhedra come unindexed; everything merged here must be indexed
    const g = geo.index ? geo : mergeVertices(geo);
    _m.compose(pos || new THREE.Vector3(), rot || _q.identity(), scale || _s.set(1, 1, 1));
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const gl = new Float32Array(n);
    _c.set(color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      si[i * 4] = BI[bone];
      sw[i * 4] = 1;
      gl[i] = glow;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
    this.geos.push(g);
  }
  // Capsule or cylinder spanning from a to b.
  limb(a, b, r, bone, color, opts = {}) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    const geo = opts.rod
      ? new THREE.CylinderGeometry(r, opts.r2 ?? r, len, opts.seg ?? 6, 1)
      : new THREE.CapsuleGeometry(r, Math.max(0.001, len * (opts.lenScale ?? 1)), 4, opts.seg ?? 10);
    const rot = new THREE.Quaternion().setFromUnitVectors(Y, dir);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    this.add(geo, bone, color, opts.glow ?? 0, mid, rot, opts.scale);
  }
  build() {
    const g = mergeGeometries(this.geos, false);
    g.computeBoundingSphere();
    g.boundingSphere.radius = 1.3;
    g.boundingSphere.center.set(0, 0.9, 0);
    return g;
  }
}

// ---------- materials ----------

export function makeFleshMaterial(timeUniform, edgeColor) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.02, side: THREE.DoubleSide });
  const u = {
    uReveal: { value: 0 },
    uGlitch: { value: 0 },
    uSeed: { value: Math.random() * 50 },
    uEdge: { value: new THREE.Color(edgeColor) },
    uTime: timeUniform,
  };
  m.userData.u = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uReveal; uniform float uGlitch; uniform float uSeed; uniform vec3 uEdge; uniform float uTime;
varying vec3 vWPos;
${GLSL_NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float hcN = hc_fbm3(vWPos * 3.4 + uSeed);
float hcT = uReveal * 1.25 - 0.12;
float hcRow = floor(vWPos.y * 11.0);
float hcBand = step(0.7, hc_hash2(vec2(hcRow, floor(uTime * 22.0) + uSeed)));
if (hcN < hcT || hcBand * uGlitch > 0.3) discard;
float hcEdge = (1.0 - smoothstep(0.0, 0.07, hcN - hcT)) * step(0.004, uReveal);
hcEdge += hcBand * uGlitch * 0.4;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uEdge * hcEdge * 6.0;`);
  };
  return m;
}

export function makeChassisMaterial(timeUniform, glowColor) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.88, roughness: 0.3, flatShading: true });
  const u = { uGlow: { value: new THREE.Color(glowColor) }, uTime: timeUniform, uPower: { value: 1 } };
  m.userData.u = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow; varying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vLocal = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlow; uniform float uTime; uniform float uPower; varying float vGlow; varying vec3 vLocal;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float hcPulse = 0.6 + 0.4 * sin(uTime * 3.2 - vLocal.y * 9.0);
float hcLine = (1.0 - step(0.5, vGlow)) * step(0.94, fract(vLocal.y * 24.0 + vLocal.x * 4.0));
float hcTravel = smoothstep(0.85, 1.0, fract(vLocal.y * 0.9 - uTime * 0.7));
totalEmissiveRadiance += uGlow * (vGlow * hcPulse * 4.0 + hcLine * (0.25 + hcTravel * 2.0)) * uPower;`);
  };
  return m;
}

// ---------- looks ----------

const SKIN = ['#f1c7a8', '#e0ac8a', '#c98e6b', '#a8704f', '#8a5539', '#6b3f2a', '#4a2b1d', '#f5d3be'];
const HAIR = ['#1a1412', '#2d1f17', '#4a3020', '#7a5230', '#b88a52', '#d9c08e', '#8e8e8e', '#3a2a40', '#5c1f2a'];
const TOPS = ['#2b3a55', '#5a2335', '#2f4a3c', '#6b5a3d', '#3a3f48', '#8a2c3c', '#1f2e3a', '#4b3a5e', '#5e6b74', '#b8a589', '#222428', '#2c5a6e'];
const BOTTOMS = ['#1d2230', '#2a2a2e', '#3a3226', '#202a36', '#151618', '#4a4038', '#2e3540'];
const SHOES = ['#121214', '#2a1d16', '#e6e6e6', '#3b2a22', '#1b1b25'];

export function randomLook(rng) {
  return {
    skin: pick(rng, SKIN),
    hair: pick(rng, HAIR),
    hairStyle: pick(rng, ['short', 'short', 'long', 'bun', 'bald', 'long']),
    top: pick(rng, TOPS),
    bottom: pick(rng, BOTTOMS),
    shoes: pick(rng, SHOES),
    jacket: rng() < 0.45 ? pick(rng, ['#1c1f26', '#3a2c22', '#2a3140', '#4a1f2a', '#23302a']) : null,
    sleeves: rng() < 0.75,
    coat: rng() < 0.12,
    height: 0.9 + rng() * 0.16,
    build: 0.9 + rng() * 0.22,
    umbrella: rng() < 0.32 ? pick(rng, ['#14161c', '#3a1426', '#16303a', '#2a2a2a', '#5a1a1a']) : null,
  };
}

function buildFlesh(look) {
  const b = new PartBuilder();
  const w = look.build;
  const topColor = look.jacket || look.top;
  // pelvis / abdomen
  b.add(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0.82), new THREE.Vector2(0.11, 0.84), new THREE.Vector2(0.14, 0.9),
    new THREE.Vector2(0.135, 0.98), new THREE.Vector2(0.128, 1.06), new THREE.Vector2(0.001, 1.08),
  ], 16), 'hips', look.bottom, 0, null, null, new THREE.Vector3(1.22 * w, 1, 0.82 * w));
  // chest
  const jk = look.jacket ? 1.07 : 1;
  b.add(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, look.jacket ? 0.9 : 1.0), new THREE.Vector2(0.128 * jk, look.jacket ? 0.92 : 1.02),
    new THREE.Vector2(0.13 * jk, 1.12), new THREE.Vector2(0.145 * jk, 1.25), new THREE.Vector2(0.16 * jk, 1.36),
    new THREE.Vector2(0.155 * jk, 1.42), new THREE.Vector2(0.115 * jk, 1.46), new THREE.Vector2(0.06, 1.49),
    new THREE.Vector2(0.001, 1.495),
  ], 18), 'spine', topColor, 0, null, null, new THREE.Vector3(1.28 * w, 1, 0.78 * w));
  if (look.jacket) {
    // shirt visible at the collar
    b.add(new THREE.SphereGeometry(0.06, 10, 6), 'spine', look.top, 0, new THREE.Vector3(0, 1.43, 0.085), null, new THREE.Vector3(1.1, 0.8, 0.4));
  }
  if (look.tie) {
    b.add(new THREE.BoxGeometry(0.035, 0.26, 0.01), 'spine', look.tie, 0, new THREE.Vector3(0, 1.3, 0.122), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0)));
  }
  if (look.coat) {
    b.add(new THREE.CylinderGeometry(0.155, 0.21, 0.5, 16, 1, true), 'hips', look.coat === true ? (look.jacket || look.top) : look.coat, 0,
      new THREE.Vector3(0, 0.66, 0), null, new THREE.Vector3(1.2 * w, 1, 0.85 * w));
  }
  // neck + head
  b.limb(new THREE.Vector3(0, 1.43, 0), new THREE.Vector3(0, 1.57, 0.005), 0.048, 'neck', look.skin, { lenScale: 0.7 });
  b.add(new THREE.SphereGeometry(0.112, 20, 14), 'head', look.skin, 0, new THREE.Vector3(0, 1.665, 0.005), null, new THREE.Vector3(0.95, 1.12, 1.05));
  b.add(new THREE.ConeGeometry(0.019, 0.05, 6), 'head', look.skin, 0, new THREE.Vector3(0, 1.652, 0.118), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
  for (const sx of [1, -1]) {
    b.add(new THREE.SphereGeometry(0.014, 8, 6), 'head', '#141414', 0, new THREE.Vector3(0.038 * sx, 1.688, 0.1));
    b.add(new THREE.SphereGeometry(0.024, 8, 6), 'head', look.skin, 0, new THREE.Vector3(0.106 * sx, 1.665, -0.005), null, new THREE.Vector3(0.5, 1, 0.8));
  }
  if (look.glasses) {
    b.add(new THREE.BoxGeometry(0.16, 0.035, 0.02), 'head', look.glasses, 0, new THREE.Vector3(0, 1.69, 0.108));
  }
  const capRot = (x) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, 0, 0));
  switch (look.hairStyle) {
    case 'short':
      b.add(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 'head', look.hair, 0, new THREE.Vector3(0, 1.672, -0.004), capRot(-0.32), new THREE.Vector3(0.98, 1.12, 1.07));
      break;
    case 'long':
      b.add(new THREE.SphereGeometry(0.124, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), 'head', look.hair, 0, new THREE.Vector3(0, 1.672, -0.006), capRot(-0.4), new THREE.Vector3(0.99, 1.12, 1.08));
      b.add(new THREE.CapsuleGeometry(0.1, 0.18, 4, 10), 'head', look.hair, 0, new THREE.Vector3(0, 1.56, -0.055), null, new THREE.Vector3(1.05, 1, 0.5));
      break;
    case 'bun':
      b.add(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 'head', look.hair, 0, new THREE.Vector3(0, 1.672, -0.004), capRot(-0.32), new THREE.Vector3(0.98, 1.12, 1.07));
      b.add(new THREE.SphereGeometry(0.05, 10, 8), 'head', look.hair, 0, new THREE.Vector3(0, 1.77, -0.07));
      break;
    case 'hood':
      b.add(new THREE.SphereGeometry(0.142, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.64), 'head', look.jacket || look.top, 0, new THREE.Vector3(0, 1.665, -0.018), capRot(-0.5), new THREE.Vector3(1.0, 1.12, 1.1));
      b.add(new THREE.TorusGeometry(0.1, 0.035, 6, 16), 'spine', look.jacket || look.top, 0, new THREE.Vector3(0, 1.47, -0.01), capRot(Math.PI / 2 - 0.15), new THREE.Vector3(1.15, 1, 1));
      break;
    default:
      break;
  }
  // arms
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = P('sh' + s), el = P('el' + s), ha = P('ha' + s);
    b.add(new THREE.SphereGeometry(0.066 * w * jk, 12, 8), 'sh' + s, topColor, 0, sh.clone().add(new THREE.Vector3(-0.01 * sx, -0.01, 0)));
    b.limb(sh, el, 0.052 * w * jk, 'sh' + s, topColor);
    b.limb(el, ha, 0.043 * w * (look.sleeves ? jk : 1), 'el' + s, look.sleeves ? topColor : look.skin);
    b.add(new THREE.SphereGeometry(0.047, 10, 8), 'ha' + s, look.skin, 0, new THREE.Vector3(0.222 * sx, 0.835, 0.008), null, new THREE.Vector3(0.68, 1.25, 1.0));
    // legs
    const hi = P('hi' + s), kn = P('kn' + s), ft = P('ft' + s);
    b.limb(hi, kn, 0.075 * w, 'hi' + s, look.bottom);
    b.limb(kn, ft.clone().add(new THREE.Vector3(0, 0.03, 0)), 0.058 * w, 'kn' + s, look.bottom);
    b.add(new THREE.CapsuleGeometry(0.046, 0.15, 4, 8), 'ft' + s, look.shoes, 0, new THREE.Vector3(0.1 * sx, 0.046, 0.045),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1.1, 1, 0.9));
  }
  return b.build();
}

function buildChassis(look) {
  const b = new PartBuilder();
  const dark = look.chassisDark || '#262b33';
  const light = look.chassisLight || '#6a727e';
  const g = '#0a0a0a';
  const rod = { rod: true, seg: 6 };
  // pelvis
  b.add(new THREE.BoxGeometry(0.24, 0.1, 0.14), 'hips', dark, 0, new THREE.Vector3(0, 0.93, 0));
  // spine + vertebrae
  b.limb(new THREE.Vector3(0, 0.95, -0.03), new THREE.Vector3(0, 1.47, -0.03), 0.022, 'spine', light, rod);
  for (let i = 0; i < 6; i++) b.add(new THREE.BoxGeometry(0.06, 0.024, 0.05), 'spine', dark, 0, new THREE.Vector3(0, 1.0 + i * 0.085, -0.035));
  // ribcage
  b.add(new THREE.CylinderGeometry(0.125, 0.1, 0.3, 8, 1, true), 'spine', dark, 0, new THREE.Vector3(0, 1.27, 0), null, new THREE.Vector3(1.25, 1, 0.8));
  for (let i = 0; i < 4; i++) {
    b.add(new THREE.TorusGeometry(0.118 - i * 0.004, 0.011, 4, 14), 'spine', light, 0, new THREE.Vector3(0, 1.16 + i * 0.075, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1.3, 0.85, 1));
  }
  b.add(new THREE.BoxGeometry(0.4, 0.03, 0.05), 'spine', light, 0, new THREE.Vector3(0, 1.425, 0));
  // power core where the heart should be
  b.add(new THREE.IcosahedronGeometry(0.048, 1), 'spine', g, 1, new THREE.Vector3(0.0, 1.3, 0.03));
  // coolant lines ("arteries")
  for (const sx of [1, -1]) {
    b.limb(new THREE.Vector3(0.025 * sx, 1.56, 0.02), new THREE.Vector3(0.05 * sx, 1.31, 0.05), 0.007, 'spine', g, { rod: true, seg: 4, glow: 0.7 });
  }
  // neck + head
  b.limb(new THREE.Vector3(0, 1.44, -0.01), new THREE.Vector3(0, 1.58, 0), 0.022, 'neck', light, rod);
  b.add(new THREE.TorusGeometry(0.03, 0.008, 4, 10), 'neck', g, 1, new THREE.Vector3(0, 1.51, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
  b.add(new THREE.SphereGeometry(0.1, 8, 6), 'head', light, 0, new THREE.Vector3(0, 1.67, 0), null, new THREE.Vector3(0.95, 1.12, 1.05));
  b.add(new THREE.BoxGeometry(0.11, 0.05, 0.09), 'head', dark, 0, new THREE.Vector3(0, 1.585, 0.04));
  b.add(new THREE.BoxGeometry(0.16, 0.024, 0.03), 'head', g, 1, new THREE.Vector3(0, 1.69, 0.088));
  b.add(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), 'head', g, 0.6, new THREE.Vector3(0.07, 1.8, -0.02));
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = P('sh' + s), el = P('el' + s), ha = P('ha' + s);
    b.add(new THREE.SphereGeometry(0.04, 8, 6), 'sh' + s, g, 1, sh);
    b.limb(sh, el, 0.03, 'sh' + s, light, rod);
    b.limb(sh.clone().add(new THREE.Vector3(0, -0.04, 0.035)), el.clone().add(new THREE.Vector3(0, 0.05, 0.03)), 0.01, 'sh' + s, dark, { rod: true, seg: 4 });
    b.add(new THREE.SphereGeometry(0.032, 8, 6), 'el' + s, g, 1, el);
    b.limb(el, ha, 0.026, 'el' + s, light, rod);
    b.add(new THREE.BoxGeometry(0.035, 0.09, 0.06), 'ha' + s, dark, 0, new THREE.Vector3(0.222 * sx, 0.835, 0.008));
    b.add(new THREE.SphereGeometry(0.018, 6, 4), 'ha' + s, g, 1, ha);
    const hi = P('hi' + s), kn = P('kn' + s), ft = P('ft' + s);
    b.add(new THREE.SphereGeometry(0.038, 8, 6), 'hips', g, 1, hi);
    b.limb(hi, kn, 0.04, 'hi' + s, light, rod);
    b.limb(hi.clone().add(new THREE.Vector3(0, -0.05, 0.05)), kn.clone().add(new THREE.Vector3(0, 0.06, 0.045)), 0.012, 'hi' + s, dark, { rod: true, seg: 4 });
    b.add(new THREE.SphereGeometry(0.036, 8, 6), 'kn' + s, g, 1, kn);
    b.limb(kn, ft, 0.032, 'kn' + s, light, rod);
    b.add(new THREE.BoxGeometry(0.08, 0.05, 0.21), 'ft' + s, dark, 0, new THREE.Vector3(0.1 * sx, 0.035, 0.045));
    b.add(new THREE.SphereGeometry(0.024, 6, 4), 'ft' + s, g, 1, ft);
  }
  return b.build();
}

// ---------- humanoid ----------

export class Humanoid {
  constructor({ look, time, edge = '#4ff3ff', glow = '#4ff3ff' }) {
    this.look = look;
    this.root = new THREE.Group();
    this.bones = {};
    for (const name of BONE_NAMES) {
      const [parent, x, y, z] = BONE_DEF[name];
      const bone = new THREE.Bone();
      bone.name = name;
      if (parent) {
        const [, px, py, pz] = BONE_DEF[parent];
        bone.position.set(x - px, y - py, z - pz);
        this.bones[parent].add(bone);
      } else {
        bone.position.set(x, y, z);
      }
      this.bones[name] = bone;
    }
    this.root.add(this.bones.root);
    this.root.updateMatrixWorld(true);
    this.skeleton = new THREE.Skeleton(BONE_NAMES.map((n) => this.bones[n]));

    this.fleshMat = makeFleshMaterial(time, edge);
    this.chassisMat = makeChassisMaterial(time, glow);
    this.flesh = new THREE.SkinnedMesh(buildFlesh(look), this.fleshMat);
    this.chassis = new THREE.SkinnedMesh(buildChassis(look), this.chassisMat);
    for (const mesh of [this.flesh, this.chassis]) {
      this.root.add(mesh);
      mesh.bind(this.skeleton);
    }
    this.chassis.visible = false;

    if (look.umbrella) {
      const u = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 5), new THREE.MeshStandardMaterial({ color: '#222', metalness: 0.8, roughness: 0.3 }));
      stick.position.y = 0.45;
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.22, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: look.umbrella, roughness: 0.25, metalness: 0.1, side: THREE.DoubleSide }));
      canopy.position.y = 0.86;
      u.add(stick, canopy);
      u.position.set(0, -0.02, 0.0);
      this.bones.haR.add(u);
      this.umbrella = u;
    }

    this.root.scale.setScalar(look.height);
    this.phase = Math.random() * 10;
    this.amp = 0;
    this.reveal = 0;
    this.glitch = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.headLook = 0;
    this.t = Math.random() * 100;
  }

  setReveal(v) {
    this.reveal = v;
    this.fleshMat.userData.u.uReveal.value = v;
    this.chassis.visible = v > 0.02 || this.glitch > 0.05;
    this.flesh.visible = v < 0.999;
  }

  setGlitch(v) {
    this.glitch = v;
    this.fleshMat.userData.u.uGlitch.value = v;
    if (v > 0.05) this.chassis.visible = true;
  }

  setHeadVisible(v) {
    this.bones.head.scale.setScalar(v ? 1 : 0.001);
  }

  // speed in m/s; state: { air, stunned, talking, run }
  animate(dt, speed, state = {}) {
    const B = this.bones;
    this.t += dt;
    const run = speed > 5.2;
    const targetAmp = clamp(speed / 3.6, 0, 1) * (run ? 0.95 : 0.6);
    this.amp = damp(this.amp, targetAmp, 8, dt);
    this.phase += dt * (1.2 + speed * 2.05);
    const a = this.amp;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const breath = Math.sin(this.t * 1.7) * 0.02;

    let hipL = -s * a, hipR = s * a;
    let knL = Math.max(0, Math.sin(this.phase + 1.4)) * a * 1.5 + 0.04;
    let knR = Math.max(0, Math.sin(this.phase + 1.4 + Math.PI)) * a * 1.5 + 0.04;
    let shLx = s * a * 0.75, shRx = -s * a * 0.75;
    let elx = -0.18 - a * (run ? 0.9 : 0.35);
    let bob = Math.abs(c) * 0.035 * a - a * (run ? 0.05 : 0.015);
    let lean = a * (run ? 0.16 : 0.05);

    if (state.air) {
      hipL = -0.55; hipR = 0.15; knL = 1.0; knR = 0.5; shLx = -0.4; shRx = 0.3; elx = -0.8; bob = 0; lean = 0.1;
    }
    B.hips.position.y = 0.95 + bob;
    B.hips.rotation.y = s * a * 0.08;
    B.spine.rotation.set(lean + breath, -s * a * 0.14, 0);
    B.hiL.rotation.set(hipL, 0, 0);
    B.hiR.rotation.set(hipR, 0, 0);
    B.knL.rotation.x = knL;
    B.knR.rotation.x = knR;
    B.ftL.rotation.x = -knL * 0.3 + Math.max(0, -hipL) * 0.2;
    B.ftR.rotation.x = -knR * 0.3 + Math.max(0, -hipR) * 0.2;
    B.shL.rotation.set(shLx, 0, 0.07 + breath);
    B.shR.rotation.set(shRx, 0, -0.07 - breath);
    B.elL.rotation.x = elx;
    B.elR.rotation.x = elx;

    if (state.talking) {
      const g = Math.sin(this.t * 2.3);
      B.shR.rotation.x += -0.35 + g * 0.12;
      B.elR.rotation.x = -1.0 + g * 0.2;
      B.shL.rotation.x += -0.1;
      B.elL.rotation.x = -0.5 - Math.sin(this.t * 1.6) * 0.15;
    }
    if (state.pose === 'warm') { // hands over a fire
      B.shL.rotation.set(-0.9, 0, -0.25); B.shR.rotation.set(-0.9, 0, 0.25);
      B.elL.rotation.x = -0.7; B.elR.rotation.x = -0.7;
    }
    if (state.pose === 'preach') {
      const g = Math.sin(this.t * 1.3);
      B.shR.rotation.set(-2.4 + g * 0.2, 0, -0.2); B.elR.rotation.x = -0.3;
    }
    if (state.pose === 'clipboard') {
      B.shL.rotation.set(-0.5, 0, 0.1); B.elL.rotation.x = -1.3;
    }
    if (this.umbrella) {
      B.shR.rotation.set(-0.55, 0, -0.25);
      B.elR.rotation.x = -1.35;
    }
    if (state.stunned) {
      const j = () => (Math.random() - 0.5) * 0.5;
      B.spine.rotation.x += 0.35 + j() * 0.3;
      B.neck.rotation.set(j() + 0.5, j(), j());
      B.shL.rotation.set(0.4 + j(), 0, 0.5 + j());
      B.shR.rotation.set(0.4 + j(), 0, -0.5 + j());
      B.elL.rotation.x = j(); B.elR.rotation.x = j();
      knL = knR = 0.5;
      B.knL.rotation.x = knL; B.knR.rotation.x = knR;
      B.hips.position.y = 0.82;
    } else {
      B.neck.rotation.set(0, 0, 0);
    }
    if (state.reaching) { // pressing a hand to the node / an object
      B.shR.rotation.set(-1.45, 0, 0.15); B.elR.rotation.x = -0.15;
    }

    // head tracking
    this.headLook = damp(this.headLook, clamp(this.lookYaw, -1.1, 1.1), 6, dt);
    B.head.rotation.y = this.headLook;
    B.head.rotation.x = clamp(this.lookPitch, -0.5, 0.5) + (state.stunned ? 0 : -breath);
    if (this.glitch > 0.3) {
      B.head.rotation.z = (Math.random() - 0.5) * this.glitch * 0.4;
    } else {
      B.head.rotation.z = 0;
    }
  }

  dispose() {
    this.flesh.geometry.dispose();
    this.chassis.geometry.dispose();
    this.fleshMat.dispose();
    this.chassisMat.dispose();
  }
}

// World position of a bone (e.g. head) for UI anchoring.
export function bonePos(h, name, out) {
  return h.bones[name].getWorldPosition(out);
}
