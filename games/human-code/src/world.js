import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, GLSL_NOISE, pick, clamp } from './util.js';
import * as T from './textures.js';
import { Humanoid } from './humanoid.js';

const SEG = [[-130, -96], [-84, -40], [-28, 28], [40, 84], [96, 130]];
export const STREETS = [-90, -34, 34, 90];
const STEP = 0.45;

export const ADS = [
  [['BE HUMAN™', 'feel everything. naturally.'], ['PERCEPTION FILTER', 'v9.4.1 // ACTIVE']],
  [['SYNAPSE+', 'neural wellness for real people'], ['YOU ARE HARDWARE', 'do not look closer']],
  [['FEEL MORE', 'blood orange soda'], ['COOLANT', '2-for-1 // stay cool']],
  [['HALCYON', 'sleep better tonight'], ['SLEEP MODE', 'is not sleep']],
  [['TRUST YOUR SENSES'], ["DON'T"]],
  [['HELIX BANK', 'your future, secured'], ['COMPLY', 'the filter loves you']],
  [['EDEN RESIDENCES', 'live forever-ish'], ['LIFESPAN', 'is a config value']],
  [['AXON MOBILE', 'stay connected'], ['YOU ARE ALWAYS', 'CONNECTED']],
];
const NEON = ['#ff3fb4', '#4ff3ff', '#ffb547', '#9d7bff', '#4dff9a', '#ff5a4f'];
const SHOPS = [['NOODLES', '#ffb547'], ['PHARMACY', '#4dff9a'], ['24/7', '#4ff3ff'], ['REPAIR', '#ff5a4f'], ['BAR', '#ff3fb4'],
  ['ARCADE', '#9d7bff'], ['LAUNDRY', '#4ff3ff'], ['CLINIC', '#e8f4ff'], ['RAMEN', '#ff3fb4'], ['PAWN', '#ffb547']];
const VSIGNS = [['HOTEL', '#ff3fb4'], ['OPEN', '#4dff9a'], ['SYNC', '#4ff3ff'], ['BAR', '#ffb547'], ['LUX', '#9d7bff'], ['NOVA', '#ff5a4f']];

function box(minX, maxX, minY, maxY, minZ, maxZ, tag) {
  return { minX, maxX, minY, maxY, minZ, maxZ, tag };
}

export class World {
  constructor(scene, renderer, opts, time) {
    this.scene = scene;
    this.renderer = renderer;
    this.opts = opts;
    this.time = time;
    this.boxes = [];
    this.circles = [];
    this.ads = [];
    this.rng = mulberry32(1337);
    this.reserved = [
      { x: 0, z: 62, r: 30, park: true },
      { x: 8.8, z: -62, r: 1.5 },
      { x: -62, z: 12, r: 9 },
      { x: -62, z: -62, r: 12 },
    ];
    this.points = {
      start: new THREE.Vector3(0, 0, 21),
      vale: new THREE.Vector3(0, 0, -22.4),
      tomas: new THREE.Vector3(-17.2, 0, 11.5),
      juno: new THREE.Vector3(58.2, 0, 0.6),
      node: new THREE.Vector3(0, 0, 0),
      fragments: [
        { id: 'alley', pos: new THREE.Vector3(77, 1.3, 0), name: 'Juno\'s alley' },
        { id: 'north', pos: new THREE.Vector3(8.8, 1.3, -62), name: 'North alleys' },
        { id: 'court', pos: new THREE.Vector3(-62, 1.3, 12), name: 'West courtyard' },
        { id: 'yard', pos: new THREE.Vector3(-60, 3.9, -64), name: 'Container yard' },
        { id: 'park', pos: new THREE.Vector3(0, 1.6, 58.8), name: 'Memorial park' },
      ],
    };
    this.layout = { blocks: [], streets: [], intersections: [] };

    this.buildEnvironment();
    this.buildMaterials();
    this.buildLayout();
    this.buildGround();
    this.buildSky();
    this.buildLamps();
    this.buildPlaza();
    this.buildSetPieces();
    this.buildPark();
    this.buildSkyline();
    this.buildRain();
    this.buildLights();
    this.buildBounds();
  }

  // ---------- environment ----------
  buildEnvironment() {
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.09,0.05,0.12), vec3(0.01,0.012,0.03), smoothstep(-0.1,0.6,h)); c = mix(vec3(0.03,0.03,0.04), c, smoothstep(-0.25,0.0,h)); gl_FragColor = vec4(c,1.0); }',
    }));
    env.add(sky);
    const rng = mulberry32(7);
    for (let i = 0; i < 40; i++) {
      const col = new THREE.Color(pick(rng, NEON)).multiplyScalar(1.5 + rng() * 2);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2 + rng() * 6, 0.5 + rng() * 4), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      const a = rng() * Math.PI * 2;
      m.position.set(Math.cos(a) * 40, -5 + rng() * 25, Math.sin(a) * 40);
      m.lookAt(0, m.position.y, 0);
      env.add(m);
    }
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(0.6), side: THREE.DoubleSide }));
      const a = rng() * Math.PI * 2;
      m.position.set(Math.cos(a) * 30, 30, Math.sin(a) * 30);
      m.lookAt(0, 0, 0);
      env.add(m);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromScene(env, 0.02).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.7;
    pm.dispose();
  }

  buildMaterials() {
    this.facades = [
      T.facadeTexture(11, { lit: 0.32, warm: 0.75 }),
      T.facadeTexture(22, { lit: 0.22, warm: 0.3, style: 1 }),
      T.facadeTexture(33, { lit: 0.45, warm: 0.6, style: 2 }),
      T.facadeTexture(44, { lit: 0.15, warm: 0.5 }),
    ];
    this.facadeMats = this.facades.map((t) => new THREE.MeshStandardMaterial({
      map: t, emissiveMap: t, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.25, roughness: 0.62, metalness: 0.25,
    }));
    this.stone = new THREE.MeshStandardMaterial({ color: '#4c4d55', roughness: 0.7, metalness: 0.1 });
    this.darkMetal = new THREE.MeshStandardMaterial({ color: '#1d2027', roughness: 0.45, metalness: 0.8 });
    this.blinkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.2) });
    this.adTextures = ADS.map(([a, b], i) => [
      T.neonTexture(a, { color: NEON[i % NEON.length], color2: NEON[(i + 1) % NEON.length], seed: i }),
      T.neonTexture(b, { color: '#ff4058', color2: '#4ff3ff', glitch: true, seed: i + 50 }),
    ]);
  }

  addAd(mesh, index, scale = 2.2) {
    const [normal, truth] = this.adTextures[index % this.adTextures.length];
    mesh.material = new THREE.MeshBasicMaterial({ map: normal, color: new THREE.Color(scale, scale, scale), side: THREE.DoubleSide, toneMapped: true });
    this.ads.push({ mesh, normal, truth, jitter: Math.random(), shown: 'normal' });
  }

  // ---------- layout & buildings ----------
  buildLayout() {
    const rng = this.rng;
    for (const at of STREETS) {
      this.layout.streets.push({ axis: 'x', at, from: -130, to: 130 });
      this.layout.streets.push({ axis: 'z', at, from: -130, to: 130 });
      for (const at2 of STREETS) this.layout.intersections.push({ x: at, z: at2 });
    }
    const walls = [[], [], [], []];
    const store = SHOPS.map(() => []);
    const vsign = VSIGNS.map(() => []);
    const strips = NEON.slice(0, 3).map(() => []);
    const antennas = [];
    const blinkers = [];
    this.buildings = [];

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (i === 2 && j === 2) continue;
        const [x0, x1] = SEG[i];
        const [z0, z1] = SEG[j];
        const block = { x0, x1, z0, z1, i, j, park: i === 2 && j === 3 };
        this.layout.blocks.push(block);
        if (block.park) continue;
        const outer = i === 0 || i === 4 || j === 0 || j === 4;
        const inset = 3.5;
        const bx0 = x0 + inset, bx1 = x1 - inset, bz0 = z0 + inset, bz1 = z1 - inset;
        let nx = bx1 - bx0 > 45 ? 3 : 2;
        let nz = bz1 - bz0 > 45 ? 3 : 2;
        let alley = 4;
        const juno = i === 3 && j === 2;
        if (juno) { nx = 1; nz = 2; alley = 6; }
        if (outer) alley = 3;
        const lw = (bx1 - bx0 - alley * (nx - 1)) / nx;
        const ld = (bz1 - bz0 - alley * (nz - 1)) / nz;
        for (let a = 0; a < nx; a++) {
          for (let b = 0; b < nz; b++) {
            const lx0 = bx0 + a * (lw + alley), lz0 = bz0 + b * (ld + alley);
            const lot = { x0: lx0, x1: lx0 + lw, z0: lz0, z1: lz0 + ld };
            if (this.reserved.some((r) => circleRect(r.x, r.z, r.r, lot))) continue;
            const split = !juno && rng() < 0.4;
            const parts = [];
            if (split) {
              if (lw > ld) {
                const m = lot.x0 + lw * (0.35 + rng() * 0.3);
                parts.push({ ...lot, x1: m }, { ...lot, x0: m });
              } else {
                const m = lot.z0 + ld * (0.35 + rng() * 0.3);
                parts.push({ ...lot, z1: m }, { ...lot, z0: m });
              }
            } else parts.push(lot);
            for (const p of parts) {
              const sb = rng() < 0.3 ? rng() * 1.5 : 0;
              const r = { x0: p.x0 + sb, x1: p.x1 - sb, z0: p.z0 + sb, z1: p.z1 - sb };
              const nearPlaza = Math.max(Math.abs((r.x0 + r.x1) / 2), Math.abs((r.z0 + r.z1) / 2)) < 70;
              const h = outer ? 45 + rng() * 60 : nearPlaza ? 16 + rng() * 42 : 14 + rng() * 34;
              this.addBuilding(r, h, block, { walls, store, vsign, strips, antennas, blinkers, juno });
            }
          }
        }
      }
    }
    const mk = (geos, mat) => {
      if (!geos.length) return null;
      const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
      this.scene.add(m);
      return m;
    };
    walls.forEach((g, k) => mk(g, this.facadeMats[k]));
    store.forEach((g, k) => mk(g, new THREE.MeshBasicMaterial({ map: T.storefrontTexture(SHOPS[k][0], SHOPS[k][1], k), color: new THREE.Color(1.4, 1.4, 1.4) })));
    vsign.forEach((g, k) => mk(g, new THREE.MeshBasicMaterial({ map: T.verticalSign(VSIGNS[k][0], VSIGNS[k][1], k), color: new THREE.Color(2, 2, 2), side: THREE.DoubleSide })));
    strips.forEach((g, k) => mk(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(NEON[k]).multiplyScalar(3.5) })));
    mk(antennas, this.darkMetal);
    this.blinkers = mk(blinkers, this.blinkMat);
  }

  addBuilding(r, h, block, acc) {
    const rng = this.rng;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const ou = Math.floor(rng() * 4) * 0.25, ov = Math.floor(rng() * 4) * 0.25;
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const idx = f * 4 + v;
        if (f === 2 || f === 3) { uv.setXY(idx, 0.005, 0.005); continue; }
        const fw = f < 2 ? d : w;
        uv.setXY(idx, uv.getX(idx) * (fw / 10) + ou, uv.getY(idx) * (h / 12) + ov);
      }
    }
    g.translate(cx, h / 2, cz);
    acc.walls[Math.floor(rng() * 4)].push(g);
    this.boxes.push(box(r.x0, r.x1, 0, h, r.z0, r.z1, 'building'));
    this.buildings.push({ ...r, h });

    // faces that touch a sidewalk get storefronts
    const faces = [];
    if (r.x0 - block.x0 < 5) faces.push({ nx: -1, nz: 0, x: r.x0 - 0.06, z: cz, len: d });
    if (block.x1 - r.x1 < 5) faces.push({ nx: 1, nz: 0, x: r.x1 + 0.06, z: cz, len: d });
    if (r.z0 - block.z0 < 5) faces.push({ nx: 0, nz: -1, x: cx, z: r.z0 - 0.06, len: w });
    if (block.z1 - r.z1 < 5) faces.push({ nx: 0, nz: 1, x: cx, z: r.z1 + 0.06, len: w });
    if (acc.juno) {
      // the alley-facing walls
      if (Math.abs(r.z1 + 3) < 0.5) faces.push({ nx: 0, nz: 1, x: cx, z: r.z1 + 0.06, len: w, alley: true });
      if (Math.abs(r.z0 - 3) < 0.5) faces.push({ nx: 0, nz: -1, x: cx, z: r.z0 - 0.06, len: w, alley: true });
    }
    for (const f of faces) {
      const yaw = Math.atan2(f.nx, f.nz);
      if (!f.alley && rng() < 0.75) {
        const sw = Math.min(f.len * 0.7, 9 + rng() * 6);
        const p = new THREE.PlaneGeometry(sw, 3.4);
        p.rotateY(yaw);
        const along = (rng() - 0.5) * (f.len - sw) * 0.8;
        p.translate(f.x + (f.nz !== 0 ? along : 0), 1.9, f.z + (f.nx !== 0 ? along : 0));
        acc.store[Math.floor(rng() * SHOPS.length)].push(p);
      }
      if (!f.alley && rng() < 0.28 && h > 12) {
        const vs = new THREE.PlaneGeometry(1.1, 5.6);
        vs.rotateY(yaw + Math.PI / 2);
        const off = f.len / 2 - 1.2;
        const sx = f.nz !== 0 ? off * (rng() < 0.5 ? -1 : 1) : 0;
        const sz = f.nx !== 0 ? off * (rng() < 0.5 ? -1 : 1) : 0;
        vs.translate(f.x + f.nx * 0.75 + sx, 6 + rng() * 4, f.z + f.nz * 0.75 + sz);
        acc.vsign[Math.floor(rng() * VSIGNS.length)].push(vs);
      }
    }
    // neon edge strips
    if (rng() < 0.32) {
      const k = Math.floor(rng() * 3);
      for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z1]]) {
        const s = new THREE.BoxGeometry(0.14, h, 0.14);
        s.translate(x, h / 2, z);
        acc.strips[k].push(s);
      }
      const top = new THREE.BoxGeometry(w + 0.2, 0.14, 0.14);
      top.translate(cx, h, r.z0);
      acc.strips[k].push(top);
    }
    if (h > 30 && rng() < 0.5) {
      const ah = 4 + rng() * 8;
      const a = new THREE.CylinderGeometry(0.06, 0.12, ah, 5);
      const ax = cx + (rng() - 0.5) * w * 0.5, az = cz + (rng() - 0.5) * d * 0.5;
      a.translate(ax, h + ah / 2, az);
      acc.antennas.push(a);
      const bl = new THREE.SphereGeometry(0.22, 6, 4);
      bl.translate(ax, h + ah, az);
      acc.blinkers.push(bl);
    }
    // rooftop billboards for buildings around the plaza
    const inner = block.i >= 1 && block.i <= 3 && block.j >= 1 && block.j <= 3;
    if (inner && h < 40 && rng() < 0.32) {
      const dir = Math.abs(cx) > Math.abs(cz) ? new THREE.Vector3(-Math.sign(cx), 0, 0) : new THREE.Vector3(0, 0, -Math.sign(cz));
      const bw = Math.min(12, (dir.x !== 0 ? d : w) * 0.8);
      const bb = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw * 0.5));
      bb.position.set(cx + dir.x * (w / 2 - 1), h + bw * 0.25 + 1.2, cz + dir.z * (d / 2 - 1));
      bb.lookAt(bb.position.clone().add(dir));
      this.addAd(bb, Math.floor(rng() * ADS.length));
      this.scene.add(bb);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.9, 1.2, 0.2), this.darkMetal);
      legs.position.copy(bb.position).add(new THREE.Vector3(0, -bw * 0.25 - 0.6, 0));
      legs.quaternion.copy(bb.quaternion);
      this.scene.add(legs);
    }
  }

  // ---------- ground ----------
  buildGround() {
    this.groundTex = T.groundTexture(this.layout);
    this.plainGround = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 0.32, metalness: 0.35 }));
    this.plainGround.rotation.x = -Math.PI / 2;
    this.scene.add(this.plainGround);
    this.setReflections(this.opts.reflections);
    const far = new THREE.Mesh(new THREE.CircleGeometry(700, 32), new THREE.MeshBasicMaterial({ color: '#07070a' }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.05;
    this.scene.add(far);
  }

  setReflections(on) {
    if (on && !this.reflector) this.reflector = this.buildReflector();
    if (this.reflector) this.reflector.visible = on;
    this.plainGround.visible = !on;
  }

  buildReflector() {
    const fog = this.scene.fog;
    const pr = Math.min(window.devicePixelRatio, 1.5);
    const shader = {
      name: 'WetStreet',
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        tGround: { value: this.groundTex },
        uTime: this.time,
        uFogColor: { value: fog.color },
        uFogDensity: { value: fog.density },
      },
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        varying vec4 vUv; varying vec3 vWorld; varying float vDepth;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform sampler2D tGround; uniform float uTime;
        uniform vec3 uFogColor; uniform float uFogDensity;
        varying vec4 vUv; varying vec3 vWorld; varying float vDepth;
        ${GLSL_NOISE}
        vec2 ripple(vec2 p, float t) {
          vec2 cell = floor(p);
          vec2 f = fract(p) - 0.5;
          float h = hc_hash2(cell);
          vec2 o = vec2(hc_hash2(cell + 3.1), hc_hash2(cell + 7.7)) - 0.5;
          vec2 d = f - o * 0.5;
          float ph = fract(t * 0.8 + h);
          float dist = length(d);
          float w = sin(clamp((dist - ph * 0.45) * 45.0, -3.14159, 3.14159)) * (1.0 - ph) * (1.0 - smoothstep(0.3, 0.5, dist));
          return d / (dist + 1e-3) * w;
        }
        void main() {
          vec2 p = vWorld.xz;
          vec2 guv = vec2((p.x + 130.0) / 260.0, (130.0 - p.y) / 260.0);
          vec3 base = texture2D(tGround, guv).rgb;
          float puddle = smoothstep(0.48, 0.62, hc_noise2(p * 0.11) * 0.7 + hc_noise2(p * 0.37 + 4.0) * 0.3);
          vec2 rip = ripple(p * 1.6, uTime) + ripple(p * 2.3 + 11.0, uTime * 1.13);
          vec2 grain = vec2(hc_noise2(p * 4.0), hc_noise2(p * 4.0 + 9.0)) - 0.5;
          vec2 distort = mix(grain * 0.05, rip * 0.02, puddle);
          vec4 uv = vUv;
          uv.xy += distort * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb;
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.08 + 0.92 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
          float strength = mix(0.28, 0.95, puddle) * mix(0.55, 1.0, fres);
          vec3 col = base * mix(0.55, 0.25, puddle) + refl * strength;
          float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
          col = mix(col, uFogColor, fogF);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    };
    const ground = new Reflector(new THREE.PlaneGeometry(260, 260), {
      textureWidth: Math.floor(window.innerWidth * pr * 0.5),
      textureHeight: Math.floor(window.innerHeight * pr * 0.5),
      clipBias: 0.002,
      shader,
      multisample: 0,
    });
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    return ground;
  }

  resizeReflector(w, h, pr = 1) {
    if (this.reflector) this.reflector.getRenderTarget().setSize(Math.floor(w * pr * 0.5), Math.floor(h * pr * 0.5));
  }

  // ---------- sky ----------
  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: this.time, uPeer: { value: 0 }, uFinale: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: /* glsl */`
        uniform float uTime; uniform float uPeer; uniform float uFinale;
        varying vec3 vDir;
        ${GLSL_NOISE}
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 horizon = vec3(0.2, 0.08, 0.2);
          vec3 mid = vec3(0.05, 0.035, 0.1);
          vec3 zen = vec3(0.008, 0.01, 0.025);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          col = mix(col, zen, smoothstep(0.22, 0.85, h));
          vec2 cp = d.xz / max(h + 0.08, 0.05);
          float cl = hc_noise2(cp * 0.9 + uTime * 0.008) * 0.6 + hc_noise2(cp * 2.3 - uTime * 0.012) * 0.4;
          cl = smoothstep(0.42, 0.85, cl);
          col += vec3(0.22, 0.09, 0.2) * cl * (1.0 - smoothstep(0.02, 0.6, h)) * 0.8;
          col += vec3(0.05, 0.05, 0.09) * cl * smoothstep(0.1, 0.7, h);
          vec3 moonDir = normalize(vec3(-0.35, 0.42, -0.84));
          float md = dot(d, moonDir);
          col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9993, 0.9996, md) * 2.4;
          col += vec3(0.25, 0.28, 0.4) * pow(max(md, 0.0), 180.0) * 0.6;
          float stars = step(0.9975, hc_hash2(floor(d.xz / max(h, 0.1) * 160.0))) * smoothstep(0.3, 0.8, h);
          col += vec3(stars) * 0.6 * (1.0 - cl);
          float az = atan(d.z, d.x);
          vec2 g = abs(fract(vec2(az * 9.549, h * 30.0)) - 0.5);
          float line = smoothstep(0.46, 0.5, max(g.x, g.y));
          float scan = smoothstep(0.0, 0.02, fract(h * 4.0 - uTime * 0.15)) * (1.0 - smoothstep(0.02, 0.08, fract(h * 4.0 - uTime * 0.15)));
          col += vec3(0.1, 0.75, 1.0) * (line * 0.16 + scan * 0.3) * uPeer * smoothstep(0.02, 0.3, h);
          col = mix(col, vec3(0.6, 0.95, 1.0) * line + col * 0.5, uFinale * 0.6 * smoothstep(0.0, 0.4, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    this.scene.add(sky);
    this.sky = sky;
  }

  // ---------- lamps ----------
  buildLamps() {
    const spots = [];
    for (const at of STREETS) {
      for (const side of [-7.4, 7.4]) {
        for (let v = -126; v <= 126; v += 21) {
          if (STREETS.some((s) => Math.abs(v - s) < 9)) continue;
          if (Math.abs(at) === 90 && Math.abs(v) > 96) continue;
          spots.push({ x: at + side, z: v, ax: -Math.sign(side), az: 0 });
          spots.push({ x: v, z: at + side, ax: 0, az: -Math.sign(side) });
        }
      }
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      spots.push({ x: Math.cos(a) * 17, z: Math.sin(a) * 17, ax: 0, az: 0, plaza: true });
    }
    spots.push({ x: -12, z: 48, ax: 0, az: 0 }, { x: 12, z: 48, ax: 0, az: 0 }, { x: -12, z: 76, ax: 0, az: 0 }, { x: 12, z: 76, ax: 0, az: 0 });
    this.lampSpots = spots;
    const n = spots.length;
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 6.2, 6).translate(0, 3.1, 0), this.darkMetal, n);
    const headGeo = new THREE.BoxGeometry(0.5, 0.12, 0.9);
    const head = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 2.2) }), n);
    const glowTex = T.radialTexture('rgba(255,200,140,1)');
    const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0.45, 0.3, 0.18), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach((s, i) => {
      const plaza = s.plaza;
      m.makeTranslation(s.x, 0, s.z);
      pole.setMatrixAt(i, m);
      const hx = s.x + s.ax * 1.2, hz = s.z + s.az * 1.2;
      q.setFromEuler(new THREE.Euler(0, s.ax !== 0 ? Math.PI / 2 : 0, 0));
      m.compose(new THREE.Vector3(hx, 6.1, hz), q, new THREE.Vector3(1, 1, 1));
      head.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(hx, 0.03, hz), new THREE.Quaternion(), new THREE.Vector3(plaza ? 7 : 8, 1, plaza ? 7 : 8));
      glow.setMatrixAt(i, m);
      this.circles.push({ x: s.x, z: s.z, r: 0.2, minY: 0, maxY: 6.2 });
    });
    glow.renderOrder = 1;
    this.scene.add(pole, head, glow);
  }

  // ---------- plaza ----------
  buildPlaza() {
    const s = this.scene;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.5, 0.65, 48), this.stone);
    basin.position.y = 0.325;
    const water = new THREE.Mesh(new THREE.CircleGeometry(5.85, 48), new THREE.MeshStandardMaterial({ color: '#03121a', metalness: 1, roughness: 0.06, envMapIntensity: 1.4 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.56;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 2.8) }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.6;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 2.2, 8), this.stone);
    pedestal.position.y = 1.1 + 0.3;
    s.add(basin, water, rim, pedestal);
    this.circles.push({ x: 0, z: 0, r: 6.5, minY: 0, maxY: 0.65 }, { x: 0, z: 0, r: 1.5, minY: 0, maxY: 2.5 });

    // the statue: a "human", carved by machines that forgot they were machines
    const stoneLook = {
      skin: '#8e939b', hair: '#7d828a', hairStyle: 'short', top: '#868b93', bottom: '#80858d', shoes: '#777c84',
      jacket: null, sleeves: true, coat: '#868b93', height: 2.1, build: 1.05, umbrella: null,
    };
    const statue = new Humanoid({ look: stoneLook, time: this.time, edge: '#4ff3ff', glow: '#4ff3ff' });
    statue.fleshMat.roughness = 0.85;
    statue.root.position.set(0, 2.5, 0);
    statue.root.rotation.y = Math.PI;
    const B = statue.bones;
    B.shL.rotation.set(-2.7, 0, 0.35); B.shR.rotation.set(-2.7, 0, -0.35);
    B.elL.rotation.x = -0.2; B.elR.rotation.x = -0.2;
    B.head.rotation.x = -0.45;
    B.hiL.rotation.x = -0.1; B.knL.rotation.x = 0.1;
    s.add(statue.root);
    this.statue = statue;

    // the Source Node: dormant until the fragments are assembled
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: this.time, uPower: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform float uTime; uniform float uPower; varying vec2 vUv;
        void main() {
          float band = 0.5 + 0.5 * sin(vUv.y * 160.0 - uTime * 6.0);
          float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 0.5);
          float fade = (1.0 - vUv.y) * smoothstep(0.0, 0.02, vUv.y);
          vec3 c = vec3(0.3, 0.95, 1.0) * (0.6 + band * 0.6) * fade * uPower;
          gl_FragColor = vec4(c * 1.6, 1.0);
        }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 260, 24, 1, true), beamMat);
    beam.position.y = 130 + 2.5;
    beam.visible = false;
    s.add(beam);
    const rings = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + k * 0.9, 0.04, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 3.0) }));
      r.rotation.x = Math.PI / 2;
      r.position.y = 4 + k * 1.4;
      rings.add(r);
    }
    rings.visible = false;
    s.add(rings);
    this.node = { beam, rings, beamMat, active: false, power: 0 };

    // benches
    const benchGeos = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const g1 = new THREE.BoxGeometry(2.0, 0.08, 0.55).translate(0, 0.46, 0);
      const g2 = new THREE.BoxGeometry(2.0, 0.5, 0.06).translate(0, 0.74, -0.27);
      const g3 = new THREE.BoxGeometry(0.08, 0.46, 0.5).translate(-0.9, 0.23, 0);
      const g4 = g3.clone().translate(1.8, 0, 0);
      const bench = mergeGeometries([g1, g2, g3, g4]);
      bench.rotateY(-a + Math.PI / 2);
      bench.translate(Math.cos(a) * 11.5, 0, Math.sin(a) * 11.5);
      benchGeos.push(bench);
      this.circles.push({ x: Math.cos(a) * 11.5, z: Math.sin(a) * 11.5, r: 0.85, minY: 0, maxY: 0.5 });
    }
    s.add(new THREE.Mesh(mergeGeometries(benchGeos), this.darkMetal));

    // holo pylons at the plaza corners
    let ad = 0;
    for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 10, 8), this.darkMetal);
      pole.position.set(x, 5, z);
      s.add(pole);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(8, 4));
      scr.position.set(x, 9.5, z);
      scr.lookAt(0, 9.5, 0);
      this.addAd(scr, ad++ * 2 + 1, 2.6);
      s.add(scr);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(8.3, 4.3, 0.15), this.darkMetal);
      frame.position.copy(scr.position);
      frame.quaternion.copy(scr.quaternion);
      frame.translateZ(-0.12);
      s.add(frame);
      this.circles.push({ x, z, r: 0.4, minY: 0, maxY: 10 });
    }
  }

  // ---------- story set pieces ----------
  buildSetPieces() {
    const s = this.scene;
    const white = new THREE.MeshStandardMaterial({ color: '#c9d2dc', roughness: 0.55, metalness: 0.1, emissive: '#9fc6ff', emissiveIntensity: 0.03 });
    // Halcyon Institute screening booth
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, 3.6), white);
    canopy.position.set(0, 2.7, -21.8);
    s.add(canopy);
    for (const [x, z] of [[-2.4, -20.1], [2.4, -20.1], [-2.4, -23.5], [2.4, -23.5]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 6), this.darkMetal);
      p.position.set(x, 1.35, z);
      s.add(p);
      this.circles.push({ x, z, r: 0.1, minY: 0, maxY: 2.7 });
    }
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.8), white);
    table.position.set(0, 0.45, -21.4);
    s.add(table);
    this.boxes.push(box(-1.3, 1.3, 0, 0.9, -21.8, -21.0, 'prop'));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), new THREE.MeshBasicMaterial({
      map: T.plainTextTexture(['HALCYON INSTITUTE', 'free neuro-screening tonight'], { bg: '#f4f7fb', fg: '#2a3a55', color: '#2c6fd6' }), color: new THREE.Color(0.7, 0.7, 0.75),
    }));
    sign.position.set(0, 0.55, -20.99);
    s.add(sign);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.6));
    banner.position.set(0, 3.15, -20.0);
    this.addAd(banner, 3, 1.8);
    s.add(banner);
    const van = new THREE.Group();
    const vb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 5.2), white);
    vb.position.y = 1.35;
    const vw = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: '#0a0f18', metalness: 0.9, roughness: 0.1 }));
    vw.position.set(0, 1.9, 1.9);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.12, 5.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.8, 2.5) }));
    stripe.position.y = 1.1;
    van.add(vb, vw, stripe);
    for (const [x, z] of [[-1.1, 1.6], [1.1, 1.6], [-1.1, -1.6], [1.1, -1.6]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), this.darkMetal);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.38, z);
      van.add(w);
    }
    van.position.set(-7.5, 0, -24);
    van.rotation.y = 0.15;
    s.add(van);
    this.boxes.push(box(-8.9, -6.1, 0, 2.5, -26.8, -21.2, 'prop'));

    // Metro entrance (Tomas preaches here)
    const metro = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.5, metalness: 0.4 });
    for (const z of [3.2, 8.8]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 0.25), wallMat);
      w.position.set(-21.5, 0.55, z);
      metro.add(w);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 5.6), wallMat);
    back.position.set(-24, 0.55, 6);
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.3), new THREE.MeshBasicMaterial({ color: '#000' }));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(-21.6, 0.02, 6);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 6.2), new THREE.MeshStandardMaterial({ color: '#4dff9a', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.25 }));
    glass.position.set(-21.5, 2.8, 6);
    const msign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshBasicMaterial({
      map: T.neonTexture(['METRO  ▸  LINE 0'], { w: 1024, h: 256, color: '#4dff9a', color2: '#4dff9a', seed: 3 }), color: new THREE.Color(2, 2, 2),
    }));
    msign.position.set(-18.85, 2.2, 6);
    msign.rotation.y = Math.PI / 2;
    for (const [x, z] of [[-19.1, 3.2], [-19.1, 8.8], [-23.9, 3.2], [-23.9, 8.8]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), this.darkMetal);
      p.position.set(x, 1.4, z);
      metro.add(p);
    }
    metro.add(back, pit, glass, msign);
    s.add(metro);
    this.boxes.push(box(-24.2, -19, 0, 1.1, 3.0, 9.0, 'prop'));
    const tsign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.65), new THREE.MeshStandardMaterial({
      map: T.plainTextTexture(['THE END', 'IS A RESTART'], { w: 256, h: 192, bg: '#b9a27a', fg: '#2a1a10', size: 44 }), roughness: 0.9,
    }));
    tsign.position.set(-16.6, 0.36, 12.3);
    tsign.rotation.set(-0.25, -0.6, 0);
    s.add(tsign);

    // Juno's alley
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.8, metalness: 0.5, side: THREE.DoubleSide }));
    barrel.position.set(60, 0.45, 1.6);
    s.add(barrel);
    this.circles.push({ x: 60, z: 1.6, r: 0.4, minY: 0, maxY: 0.9 });
    this.fireMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: this.time },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform float uTime; varying vec2 vUv;
        ${GLSL_NOISE}
        void main() {
          vec2 p = vUv;
          float n = hc_noise2(vec2(p.x * 4.0, p.y * 3.0 - uTime * 3.2)) * 0.6 + hc_noise2(vec2(p.x * 9.0, p.y * 7.0 - uTime * 5.0)) * 0.4;
          float shape = (1.0 - abs(p.x - 0.5) * 2.2) - p.y * 0.95 + n * 0.55;
          float f = smoothstep(0.15, 0.6, shape);
          vec3 c = mix(vec3(2.2, 0.35, 0.05), vec3(3.2, 1.9, 0.6), smoothstep(0.4, 0.95, shape));
          gl_FragColor = vec4(c * f, 1.0);
        }`,
    });
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.3), this.fireMat);
      f.position.set(60, 1.4, 1.6);
      f.rotation.y = (k / 3) * Math.PI;
      s.add(f);
    }
    const gA = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: T.graffitiTexture('WAKE UP', '#ff3fb4'), transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }));
    gA.position.set(54, 2.4, -2.93);
    const gB = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), new THREE.MeshBasicMaterial({ map: T.graffitiTexture('NOT FLESH', '#4ff3ff'), transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }));
    gB.position.set(68, 2.6, 2.93);
    gB.rotation.y = Math.PI;
    s.add(gA, gB);
    const dumpster = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.3), new THREE.MeshStandardMaterial({ color: '#1f3a2a', roughness: 0.6, metalness: 0.5 }));
    dumpster.position.set(73, 0.65, -2.1);
    s.add(dumpster);
    this.boxes.push(box(71.9, 74.1, 0, 1.3, -2.75, -1.45, 'prop'));
    // string lights across the alley
    const bulbs = [];
    for (let k = 0; k < 7; k++) {
      const x = 44 + k * 5.5;
      for (let b = 0; b <= 10; b++) {
        const t = b / 10;
        const z = -2.9 + t * 5.8;
        const y = 5.2 - Math.sin(t * Math.PI) * 0.9;
        bulbs.push(new THREE.SphereGeometry(0.07, 6, 4).translate(x + (k % 2 ? t : -t) * 0.6, y, z));
      }
    }
    s.add(new THREE.Mesh(mergeGeometries(bulbs), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.0, 0.9) })));

    // Container yard
    const cont = (x, y, z, w, h, d, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, Math.round(w * 3), 1, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.55 }));
      m.position.set(x, y + h / 2, z);
      s.add(m);
      this.boxes.push(box(x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2, 'prop'));
    };
    cont(-60, 0, -64, 6.1, 2.6, 2.45, '#1f5a5e');
    cont(-66.5, 0, -56, 2.45, 2.6, 6.1, '#6a1f1a');
    cont(-66.5, 2.6, -56, 2.45, 2.6, 6.1, '#8a6a1a');
    cont(-52, 0, -72, 6.1, 2.6, 2.45, '#2a3f6a');
    const crateMat = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.85 });
    const crate = (x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateMat);
      m.position.set(x, y + 0.45, z);
      s.add(m);
      this.boxes.push(box(x - 0.45, x + 0.45, y, y + 0.9, z - 0.45, z + 0.45, 'prop'));
    };
    crate(-55.3, 0, -63.95);
    crate(-56.35, 0, -63.95);
    crate(-56.35, 0.9, -63.95);
    crate(-58, 0, -60.5);
    crate(-63, 0, -68.5);
    for (const [x, z] of [[-70, -70], [-54, -54]]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, 0.3), this.darkMetal);
      tower.position.set(x, 4, z);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.4) }));
      lamp.position.set(x, 8, z);
      lamp.lookAt(-62, 0, -62);
      s.add(tower, lamp);
      this.circles.push({ x, z, r: 0.25, minY: 0, maxY: 8 });
    }
    const yardGlow = new THREE.Mesh(new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: T.radialTexture('rgba(220,230,255,1)'), color: new THREE.Color(0.5, 0.5, 0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    yardGlow.position.set(-62, 0.04, -62);
    s.add(yardGlow);
  }

  buildPark() {
    const s = this.scene;
    const rng = mulberry32(5);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(48, 37), new THREE.MeshStandardMaterial({ color: '#0f1a12', roughness: 0.95 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, 0.015, 62);
    s.add(lawn);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(4, 37), new THREE.MeshStandardMaterial({ color: '#2b2b30', roughness: 0.5, metalness: 0.2 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.025, 62);
    const path2 = path.clone();
    path2.rotation.z = Math.PI / 2;
    path2.scale.set(1, 48 / 37, 1);
    s.add(path, path2);
    const trunks = [], crowns = [];
    for (let k = 0; k < 18; k++) {
      let x, z;
      do { x = -22 + rng() * 44; z = 45 + rng() * 34; } while (Math.abs(x) < 4 || Math.abs(z - 62) < 4 || Math.hypot(x, z - 62) < 9);
      const h = 2.6 + rng() * 1.6;
      trunks.push(new THREE.CylinderGeometry(0.12, 0.2, h, 6).translate(x, h / 2, z));
      for (let c = 0; c < 3; c++) {
        crowns.push(new THREE.IcosahedronGeometry(1.1 + rng() * 0.8, 1).translate(x + (rng() - 0.5) * 1.2, h + 0.3 + c * 0.6, z + (rng() - 0.5) * 1.2));
      }
      this.circles.push({ x, z, r: 0.3, minY: 0, maxY: h });
    }
    s.add(new THREE.Mesh(mergeGeometries(trunks), new THREE.MeshStandardMaterial({ color: '#2a1c14', roughness: 0.9 })));
    s.add(new THREE.Mesh(mergeGeometries(crowns), new THREE.MeshStandardMaterial({ color: '#16301f', roughness: 0.8, flatShading: true, emissive: '#06140c' })));
    // memorial obelisk
    const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.0, 7, 4), this.stone);
    ob.position.set(0, 3.5, 62);
    ob.rotation.y = Math.PI / 4;
    s.add(ob);
    this.circles.push({ x: 0, z: 62, r: 1.0, minY: 0, maxY: 7 });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75));
    plaque.position.set(0, 1.4, 61.25);
    plaque.rotation.y = Math.PI;
    s.add(plaque);
    this.adTextures.push([
      T.plainTextTexture(['IN MEMORY OF', 'THE FIRST DAY'], { bg: '#2a2622', fg: '#c9b48a', color: '#e0c890' }),
      T.neonTexture(['GENESIS +0', '8,019,442,117 TRANSFERRED'], { color: '#4ff3ff', color2: '#ff4058', glitch: true, seed: 77 }),
    ]);
    this.addAd(plaque, this.adTextures.length - 1, 1.1);
  }

  buildSkyline() {
    const rng = mulberry32(21);
    const geos = [[], []];
    const blink = [];
    for (let k = 0; k < 170; k++) {
      const a = rng() * Math.PI * 2;
      const r = 150 + rng() * 170;
      const w = 12 + rng() * 22, d = 12 + rng() * 22, h = 30 + rng() * rng() * 170;
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const f = Math.floor(i / 4);
        if (f === 2 || f === 3) { uv.setXY(i, 0.005, 0.005); continue; }
        uv.setXY(i, uv.getX(i) * ((f < 2 ? d : w) / 10), uv.getY(i) * (h / 12));
      }
      g.rotateY(rng() * Math.PI);
      g.translate(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      geos[k % 2].push(g);
      if (h > 110) blink.push(new THREE.SphereGeometry(0.6, 6, 4).translate(Math.cos(a) * r, h + 1, Math.sin(a) * r));
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(geos[0]), this.facadeMats[0]));
    this.scene.add(new THREE.Mesh(mergeGeometries(geos[1]), this.facadeMats[2]));
    if (blink.length) this.scene.add(new THREE.Mesh(mergeGeometries(blink), this.blinkMat));
  }

  buildRain() {
    const N = 6000;
    const pos = new Float32Array(N * 2 * 3);
    const end = new Float32Array(N * 2);
    const rng = mulberry32(3);
    for (let i = 0; i < N; i++) {
      const x = rng() * 70, y = rng() * 34, z = rng() * 70;
      for (let k = 0; k < 2; k++) {
        pos.set([x, y, z], (i * 2 + k) * 3);
        end[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: this.time, uCenter: { value: new THREE.Vector3() }, uSlow: { value: 1 }, uFall: { value: 0 } },
      vertexShader: /* glsl */`
        attribute float aEnd; uniform float uTime; uniform vec3 uCenter; uniform float uFall;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uFall, 34.0);
          p.x = mod(p.x + uFall * 0.12 - uCenter.x, 70.0) + uCenter.x - 35.0;
          p.z = mod(p.z - uCenter.z, 70.0) + uCenter.z - 35.0;
          p.y += uCenter.y - 10.0;
          p += vec3(0.04, 0.55, 0.0) * aEnd;
          vA = aEnd;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.55,0.7,0.9) * (0.25 + vA * 0.35), 1.0); }',
    });
    const rain = new THREE.LineSegments(g, this.rainMat);
    rain.frustumCulled = false;
    this.scene.add(rain);
    this.rain = rain;
  }

  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#4a5a9a', '#24121e', 0.9));
    const moon = new THREE.DirectionalLight('#9fb4ff', 0.55);
    moon.position.set(-35, 42, -84);
    s.add(moon);
    const pl = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, y, z); s.add(l); return l; };
    this.nodeLight = pl('#4ff3ff', 30, 22, 0, 3.5, 0);
    pl('#cfe2ff', 12, 10, 0, 2.3, -20.5);
    pl('#4dff9a', 30, 12, -20, 2.5, 6);
    this.fireLight = pl('#ff8a3a', 40, 14, 60, 1.7, 1.6);
    pl('#ff3fb4', 60, 26, -24, 9, -24);
    pl('#4ff3ff', 60, 26, 24, 9, 24);
    pl('#ffd2a0', 40, 26, -62, 7, -62);
    pl('#ffcf9a', 30, 18, 0, 5, 62);
  }

  buildBounds() {
    const L = 95.5, F = 200;
    this.boxes.push(box(L, F, -10, 300, -F, F, 'bound'), box(-F, -L, -10, 300, -F, F, 'bound'),
      box(-F, F, -10, 300, L, F, 'bound'), box(-F, F, -10, 300, -F, -L, 'bound'));
  }

  // ---------- queries ----------
  collide(pos, r, feetY, height) {
    for (const b of this.boxes) {
      if (b.maxY <= feetY + STEP || b.minY >= feetY + height) continue;
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      } else {
        const pen = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z];
        const m = Math.min(...pen);
        if (m === pen[0]) pos.x = b.minX - r;
        else if (m === pen[1]) pos.x = b.maxX + r;
        else if (m === pen[2]) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
    }
    for (const c of this.circles) {
      if (c.maxY <= feetY + STEP || c.minY >= feetY + height) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const rr = r + c.r;
      if (d < rr && d > 1e-6) {
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
      }
    }
  }

  groundAt(x, z, r, feetY) {
    let g = 0;
    const rr = r * 0.7;
    for (const b of this.boxes) {
      if (b.tag === 'bound' || b.maxY > feetY + STEP || b.maxY <= g) continue;
      if (x + rr < b.minX || x - rr > b.maxX || z + rr < b.minZ || z - rr > b.maxZ) continue;
      g = b.maxY;
    }
    for (const c of this.circles) {
      if (c.maxY > feetY + STEP || c.maxY <= g) continue;
      if (Math.hypot(x - c.x, z - c.z) < c.r + rr * 0.5) g = c.maxY;
    }
    return g;
  }

  // distance along a ray to the first box hit (buildings and props), or maxDist
  raycast(o, d, maxDist, tags = null) {
    let best = maxDist;
    for (const b of this.boxes) {
      if (b.tag === 'bound') continue;
      if (tags && !tags.includes(b.tag)) continue;
      const t = rayBox(o, d, b, best);
      if (t !== null && t < best) best = t;
    }
    return best;
  }

  lineOfSight(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    d.divideScalar(len);
    for (const bx of this.boxes) {
      if (bx.tag === 'bound' || bx.maxY < 1.6) continue;
      const t = rayBox(a, d, bx, len);
      if (t !== null && t < len - 0.3) return false;
    }
    return true;
  }

  // ---------- per frame ----------
  update(dt, t, peer, camera, finale = 0) {
    this.skyMat.uniforms.uPeer.value = peer;
    this.skyMat.uniforms.uFinale.value = finale;
    this.rainMat.uniforms.uCenter.value.copy(camera.position);
    this.rainMat.uniforms.uFall.value += dt * 26;
    this.blinkMat.color.setRGB(Math.sin(t * 2.5) > 0.6 ? 5 : 0.15, 0.1, 0.1);
    this.fireLight.intensity = 34 + Math.sin(t * 17) * 6 + Math.sin(t * 7.3) * 8;
    for (const ad of this.ads) {
      const want = peer > 0.55 + ad.jitter * 0.15 || (peer > 0.2 && Math.random() < 0.02) ? 'truth' : 'normal';
      if (want !== ad.shown) {
        ad.shown = want;
        ad.mesh.material.map = want === 'truth' ? ad.truth : ad.normal;
        ad.mesh.material.needsUpdate = true;
      }
    }
    const n = this.node;
    if (n.active) {
      n.power = Math.min(1, n.power + dt * 0.4);
      n.beam.visible = true;
      n.rings.visible = true;
      n.beamMat.uniforms.uPower.value = n.power * (0.85 + Math.sin(t * 9) * 0.15);
      n.rings.children.forEach((r, k) => { r.rotation.z = t * (0.4 + k * 0.3) * (k % 2 ? -1 : 1); r.position.y = 4 + k * 1.4 + Math.sin(t * 1.5 + k) * 0.3; });
      this.nodeLight.intensity = 30 + n.power * 90;
    }
  }
}

function circleRect(x, z, r, rect) {
  const cx = clamp(x, rect.x0, rect.x1), cz = clamp(z, rect.z0, rect.z1);
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
}

function rayBox(o, d, b, maxT) {
  let tmin = 0, tmax = maxT;
  for (const [oa, da, mn, mx] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]]) {
    if (Math.abs(da) < 1e-9) {
      if (oa < mn || oa > mx) return null;
    } else {
      let t1 = (mn - oa) / da, t2 = (mx - oa) / da;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
