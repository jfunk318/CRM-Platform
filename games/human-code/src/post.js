import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const VeilShader = {
  name: 'VeilShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uPeer: { value: 0 },
    uGlitch: { value: 0 },
    uDamage: { value: 0 },
    uSlow: { value: 0 },
    uFinale: { value: 0 },
    uTint: { value: new THREE.Color(0.3, 0.95, 1.0) },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uPeer, uGlitch, uDamage, uSlow, uFinale;
    uniform vec3 uTint;
    uniform vec2 uRes;
    varying vec2 vUv;
    float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec2 uv = vUv;
      float g = uGlitch;
      float tick = floor(uTime * 24.0);
      if (g > 0.001) {
        float row = floor(uv.y * 22.0);
        float r = h21(vec2(row, tick));
        if (r < g * 0.45) uv.x += (h21(vec2(row + 3.0, tick)) - 0.5) * 0.16 * g;
        float blk = h21(floor(uv * vec2(9.0, 14.0)) + tick);
        if (blk < g * 0.08) uv = fract(uv + vec2(h21(vec2(tick, 1.0)) - 0.5, 0.0) * 0.3);
      }
      vec2 dir = uv - 0.5;
      float ab = 0.0015 + g * 0.02 + uPeer * 0.004 + uDamage * 0.01;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab).b;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      // peering: a diagnostic grade, as if looking through a service display
      vec3 diag = mix(vec3(lum) * vec3(0.7, 1.05, 1.25), col, 0.6);
      col = mix(col, diag, uPeer * 0.75);
      float scan = step(0.5, fract(uv.y * uRes.y * 0.33));
      col *= 1.0 - uPeer * 0.07 * scan;
      float sweep = smoothstep(0.0, 0.01, fract(uv.y - uTime * 0.25)) * (1.0 - smoothstep(0.01, 0.03, fract(uv.y - uTime * 0.25)));
      col += uTint * sweep * uPeer * 0.06;
      // overclock: time slowed, color drained
      col = mix(col, vec3(lum) * vec3(0.75, 0.95, 1.25), uSlow * 0.55);
      // finale wash
      col = mix(col, col * 0.6 + uTint * lum * 1.4, uFinale * 0.5);
      float vig = smoothstep(0.95, 0.25, length(dir * vec2(1.0, 0.85)) * 1.25);
      col *= mix(0.45, 1.0, vig);
      col = mix(col, vec3(1.0, 0.12, 0.18) * (lum * 1.5 + 0.08), uDamage * (1.0 - vig) * 0.85);
      col += (h21(uv * uRes + fract(uTime) * 100.0) - 0.5) * 0.03;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, opts) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.9, 0.55, 0.8);
    this.bloom.enabled = opts.bloom;
    this.composer.addPass(this.bloom);
    this.veil = new ShaderPass(VeilShader);
    this.composer.addPass(this.veil);
    this.composer.addPass(new OutputPass());
    this.u = this.veil.uniforms;
    this.u.uRes.value.copy(size);
  }

  setBloom(on) {
    this.bloom.enabled = on;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.u.uRes.value.copy(size);
  }

  render(dt) {
    this.composer.render(dt);
  }
}
