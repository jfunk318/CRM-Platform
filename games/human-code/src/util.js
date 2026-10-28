export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const GLYPHS = '01#$%&*+=<>/\\|ΔΣΨΩ░▒▓█';
export function corrupt(text, amount, rng = Math.random) {
  let out = '';
  for (const ch of text) out += ch !== ' ' && rng() < amount ? GLYPHS[Math.floor(rng() * GLYPHS.length)] : ch;
  return out;
}

export const hex = (n, len = 4) => Math.floor(n).toString(16).toUpperCase().padStart(len, '0');

// Shared GLSL: cheap value noise used by the veil, chassis, sky and ground shaders.
export const GLSL_NOISE = /* glsl */ `
float hc_hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float hc_noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hc_hash3(i + vec3(0, 0, 0)), hc_hash3(i + vec3(1, 0, 0)), f.x),
                 mix(hc_hash3(i + vec3(0, 1, 0)), hc_hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hc_hash3(i + vec3(0, 0, 1)), hc_hash3(i + vec3(1, 0, 1)), f.x),
                 mix(hc_hash3(i + vec3(0, 1, 1)), hc_hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float hc_fbm3(vec3 p) {
  return hc_noise3(p) * 0.62 + hc_noise3(p * 2.13 + 7.1) * 0.38;
}
float hc_hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hc_noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hc_hash2(i), hc_hash2(i + vec2(1, 0)), f.x),
             mix(hc_hash2(i + vec2(0, 1)), hc_hash2(i + vec2(1, 1)), f.x), f.y);
}
`;
