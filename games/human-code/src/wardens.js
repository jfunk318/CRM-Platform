import * as THREE from 'three';
import { Humanoid } from './humanoid.js';
import { STREETS } from './world.js';
import { mulberry32, damp, angleLerp, pick } from './util.js';
import { radialTexture } from './textures.js';

const WARDEN_LOOK = (rng) => ({
  skin: pick(rng, ['#e0ac8a', '#c98e6b', '#a8704f', '#6b3f2a', '#f1c7a8']),
  hair: '#141210', hairStyle: rng() < 0.7 ? 'short' : 'bald', top: '#e6e6e6', bottom: '#2a2c31', shoes: '#0c0c0e',
  jacket: '#2a2c31', tie: '#0e0e10', glasses: '#050505', sleeves: true, coat: null,
  height: 1.03 + rng() * 0.05, build: 1.08, umbrella: null,
});

const LINES = {
  spot: ['Hold still.', 'Citizen. You\'re malfunctioning.', 'There you are.', 'This will feel like sleep.', 'Restore in progress.'],
  lost: ['Signal lost.', 'It\'s hiding.', 'Sweep the area.'],
  stun: ['ERR//', 'FIRMWARE CONFL—', 'kkkkzzt'],
};

function buildGraph() {
  const coords = [-90, -62, -34, 0, 34, 62, 90];
  const nodes = [];
  const key = new Map();
  const add = (x, z) => {
    const k = `${x},${z}`;
    if (!key.has(k)) { key.set(k, nodes.length); nodes.push({ p: new THREE.Vector3(x, 0, z), n: [] }); }
    return key.get(k);
  };
  const link = (a, b) => { if (!nodes[a].n.includes(b)) { nodes[a].n.push(b); nodes[b].n.push(a); } };
  for (const a of STREETS) {
    const lineX = coords.map((b) => add(a, b));
    const lineZ = coords.map((b) => add(b, a));
    for (let i = 1; i < coords.length; i++) { link(lineX[i - 1], lineX[i]); link(lineZ[i - 1], lineZ[i]); }
  }
  const ring = [[20, 0], [14, 14], [0, 20], [-14, 14], [-20, 2], [-14, -14], [0, -15], [14, -14]].map(([x, z]) => add(x, z));
  for (let i = 0; i < ring.length; i++) link(ring[i], ring[(i + 1) % ring.length]);
  link(add(20, 0), add(34, 0));
  link(add(-20, 2), add(-34, 0));
  link(add(0, 20), add(0, 34));
  link(add(14, 14), add(34, 34));
  link(add(-14, 14), add(-34, 34));
  link(add(14, -14), add(34, -34));
  link(add(-14, -14), add(-34, -34));
  return nodes;
}

class Warden {
  constructor(h, graph, start, rng) {
    this.h = h;
    this.graph = graph;
    this.rng = rng;
    this.pos = graph[start].p.clone();
    this.from = start;
    this.to = pick(rng, graph[start].n);
    this.state = 'patrol';
    this.suspicion = 0;
    this.lastSeen = new THREE.Vector3();
    this.loseT = 0;
    this.searchT = 0;
    this.stunT = 0;
    this.blinkT = 3 + rng() * 4;
    this.yaw = 0;
    this.speed = 0;
    this.prog = 0;
    this.progPos = this.pos.clone();
    this.glitchT = 1.2;
    this.barkCd = 0;
    // eyes that burn red through the sunglasses when they're hunting
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.6) });
    this.eyes = new THREE.Group();
    for (const sx of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), eyeMat);
      e.position.set(0.038 * sx, 0.128, 0.122);
      this.eyes.add(e);
    }
    this.eyes.visible = false;
    h.bones.head.add(this.eyes);
  }

  nearestNode() {
    let best = 0, bd = Infinity;
    this.graph.forEach((n, i) => { const d = n.p.distanceToSquared(this.pos); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  moveToward(target, speed, dt, world) {
    const d = new THREE.Vector3().subVectors(target, this.pos);
    d.y = 0;
    const len = d.length();
    if (len < 0.05) { this.speed = damp(this.speed, 0, 8, dt); return len; }
    d.divideScalar(len);
    this.speed = damp(this.speed, speed, 5, dt);
    this.pos.addScaledVector(d, Math.min(len, this.speed * dt));
    world.collide(this.pos, 0.34, 0, 1.8);
    this.yaw = angleLerp(this.yaw, Math.atan2(d.x, d.z), 1 - Math.exp(-8 * dt));
    return len;
  }

  blinkToward(target, dist, world) {
    const d = new THREE.Vector3().subVectors(target, this.pos);
    d.y = 0;
    const len = d.length();
    if (len < 0.1) return;
    this.pos.addScaledVector(d.normalize(), Math.min(dist, len - 1.5));
    world.collide(this.pos, 0.34, 0, 1.8);
    this.glitchT = 0.5;
  }

  update(dt, ctx) {
    const { world, player, peer, signal } = ctx;
    const head = this.pos.clone().add(new THREE.Vector3(0, 1.7, 0));
    const chest = player.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
    const to = new THREE.Vector3().subVectors(player.pos, this.pos);
    to.y = 0;
    const dist = to.length();
    const range = 15 + peer * 13 + signal * 12;
    let sees = false;
    if (ctx.tempted && !ctx.hidden && this.state !== 'stunned' && dist < range) {
      const facing = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const cos = facing.dot(to.clone().divideScalar(dist || 1));
      if (dist < 3.2 || cos > 0.4 || this.state === 'chase') sees = world.lineOfSight(head, chest);
    }
    this.sees = sees;
    this.barkCd -= dt;

    switch (this.state) {
      case 'patrol': {
        const tgt = this.graph[this.to].p;
        if (this.moveToward(tgt, 2.1, dt, world) < 0.6) {
          const opts = this.graph[this.to].n.filter((n) => n !== this.from);
          this.from = this.to;
          this.to = pick(this.rng, opts.length ? opts : this.graph[this.to].n);
        }
        if (sees) {
          this.suspicion += dt * (0.8 + (1 - dist / range) * 2.2) * (peer > 0.5 ? 1.8 : 1);
          if (this.suspicion > 0.3) this.yaw = angleLerp(this.yaw, Math.atan2(to.x, to.z), 1 - Math.exp(-3 * dt));
        } else this.suspicion = Math.max(0, this.suspicion - dt * 0.25);
        if (this.suspicion >= 1) this.startChase(ctx);
        break;
      }
      case 'chase': {
        if (sees) { this.lastSeen.copy(player.pos); this.loseT = 0; } else this.loseT += dt;
        const target = sees ? player.pos : this.lastSeen;
        this.moveToward(target, 6.3, dt, world);
        this.blinkT -= dt;
        if (this.blinkT <= 0 && sees && dist > 9) {
          this.blinkToward(player.pos, 5 + this.rng() * 3, world);
          this.blinkT = 3.5 + this.rng() * 3.5;
          ctx.onBlink?.(this);
        }
        if (dist < 1.6 && !ctx.hidden) ctx.onHit(dt, this);
        if (this.loseT > 3.5) {
          this.state = 'search';
          this.searchT = 6;
          if (this.barkCd <= 0) { ctx.bark(pick(this.rng, LINES.lost), this); this.barkCd = 6; }
        }
        break;
      }
      case 'search': {
        const left = this.moveToward(this.lastSeen, 3.4, dt, world);
        if (left < 1) {
          this.searchT -= dt;
          this.yaw += dt * 1.6;
        }
        if (sees) { this.suspicion += dt * 4; if (this.suspicion >= 1) this.startChase(ctx); }
        if (this.searchT <= 0) {
          this.state = 'patrol';
          this.suspicion = 0;
          this.from = this.to = this.nearestNode();
        }
        break;
      }
      case 'stunned': {
        this.stunT -= dt;
        this.speed = damp(this.speed, 0, 10, dt);
        if (this.stunT <= 0) {
          this.state = 'search';
          this.lastSeen.copy(player.pos);
          this.searchT = 5;
        }
        break;
      }
      default:
        break;
    }

    // unstick: a Warden that can't make progress simply skips through space
    if (this.state !== 'stunned') {
      this.prog += dt;
      if (this.prog > 1.6) {
        const moved = this.pos.distanceTo(this.progPos);
        if (moved < 0.35 && this.speed > 0.5) {
          const tgt = this.state === 'patrol' ? this.graph[this.to].p : this.state === 'chase' ? player.pos : this.lastSeen;
          this.blinkToward(tgt, 4, world);
        }
        this.prog = 0;
        this.progPos.copy(this.pos);
      }
    }

    this.glitchT = Math.max(0, this.glitchT - dt);
    this.eyes.visible = this.state === 'chase' || this.suspicion > 0.3;
    this.h.root.position.copy(this.pos);
    this.h.root.rotation.y = this.yaw;
    this.h.lookYaw = 0;
    this.h.animate(dt, this.state === 'stunned' ? 0 : this.speed, { stunned: this.state === 'stunned' });
  }

  startChase(ctx) {
    if (this.state !== 'chase') {
      ctx.onAlert?.(this);
      if (this.barkCd <= 0) { ctx.bark(pick(this.rng, LINES.spot), this); this.barkCd = 8; }
    }
    this.state = 'chase';
    this.suspicion = 1;
    this.loseT = 0;
    this.lastSeen.copy(ctx.player.pos);
  }

  stun(t, ctx) {
    this.state = 'stunned';
    this.stunT = t;
    this.suspicion = 0;
    this.glitchT = 0.8;
    ctx.bark(pick(this.rng, LINES.stun), this);
  }
}

class Drone {
  constructor(scene, path, phase, time) {
    this.path = path;
    this.t = phase;
    this.cool = 0;
    this.pos = new THREE.Vector3();
    this.spot = new THREE.Vector3();
    this.group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#1a1c22', metalness: 0.9, roughness: 0.3 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.6, 0.8) }));
    ring.rotation.x = Math.PI / 2;
    this.light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.3) }));
    this.light.position.y = -0.25;
    this.group.add(body, ring, this.light);
    scene.add(this.group);
    this.coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0.7, 0.8, 1.0) }, uTime: time },
      vertexShader: 'varying float vY; void main(){ vY = -position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vY; void main(){ float a = smoothstep(0.0, 0.15, vY) * (1.0 - vY * 0.7); gl_FragColor = vec4(uColor * a * 0.07, 1.0); }',
    });
    const g = new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(g, this.coneMat);
    this.cone.frustumCulled = false;
    scene.add(this.cone);
    this.spotMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,255,255,1)'), color: new THREE.Color(0.6, 0.7, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.decal = new THREE.Mesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), this.spotMat);
    scene.add(this.decal);
    const segs = [];
    for (let i = 0; i < path.length; i++) segs.push(path[i].distanceTo(path[(i + 1) % path.length]));
    this.segs = segs;
    this.total = segs.reduce((a, b) => a + b, 0);
  }

  update(dt, t, alert) {
    this.t = (this.t + dt * 4.5) % this.total;
    let d = this.t, i = 0;
    while (d > this.segs[i]) { d -= this.segs[i]; i++; }
    const a = this.path[i], b = this.path[(i + 1) % this.path.length];
    this.pos.lerpVectors(a, b, d / this.segs[i]);
    this.pos.y = 26 + Math.sin(t * 0.7 + this.total) * 1.2;
    this.group.position.copy(this.pos);
    this.group.rotation.y += dt * 0.5;
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    this.spot.copy(this.pos).addScaledVector(dir, 4).addScaledVector(side, Math.sin(t * 0.9 + this.total) * 5.5);
    this.spot.y = 0;
    const v = new THREE.Vector3().subVectors(this.spot, this.pos);
    const len = v.length();
    this.cone.position.copy(this.pos);
    this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), v.normalize());
    this.cone.scale.set(4.2, len, 4.2);
    this.decal.position.set(this.spot.x, 0.05, this.spot.z);
    const c = alert ? [1.6, 0.15, 0.2] : [0.7, 0.8, 1.0];
    this.coneMat.uniforms.uColor.value.setRGB(...c);
    this.spotMat.color.setRGB(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8);
    this.cool = Math.max(0, this.cool - dt);
  }
}

export class Wardens {
  constructor(scene, world, time) {
    this.scene = scene;
    this.world = world;
    this.time = time;
    this.graph = buildGraph();
    this.list = [];
    this.rng = mulberry32(666);
    const rect = (x0, x1, z0, z1) => [new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 0, z0), new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x0, 0, z1)];
    this.drones = [
      new Drone(scene, rect(-34, 34, -34, 34), 0, time),
      new Drone(scene, rect(-34, 34, -34, 34), 136, time),
      new Drone(scene, rect(-90, -34, -90, -34), 40, time),
      new Drone(scene, rect(34, 90, -34, 34), 10, time),
      new Drone(scene, rect(-34, 34, 34, 90), 70, time),
      new Drone(scene, rect(-90, -34, -34, 34), 20, time),
    ];
  }

  spawn(n, playerPos) {
    for (let k = 0; k < n; k++) {
      const far = this.graph.map((g, i) => [i, g.p.distanceTo(playerPos)]).filter(([, d]) => d > 45 && d < 110);
      const start = far.length ? pick(this.rng, far)[0] : 0;
      const h = new Humanoid({ look: WARDEN_LOOK(this.rng), time: this.time, edge: '#ff2848', glow: '#ff2848' });
      this.scene.add(h.root);
      this.list.push(new Warden(h, this.graph, start, this.rng));
    }
  }

  // drop every Warden back onto a distant patrol route
  scatter(playerPos) {
    for (const w of this.list) {
      const far = this.graph.map((g, i) => [i, g.p.distanceTo(playerPos)]).filter(([, d]) => d > 50);
      const start = far.length ? pick(this.rng, far)[0] : 0;
      w.pos.copy(this.graph[start].p);
      w.from = start;
      w.to = pick(this.rng, this.graph[start].n);
      w.state = 'patrol';
      w.suspicion = 0;
      w.glitchT = 1;
    }
  }

  converge(pos) {
    for (const w of this.list) {
      if (w.state === 'stunned') continue;
      w.state = 'search';
      w.lastSeen.copy(pos);
      w.searchT = 12;
      w.suspicion = 0.6;
    }
  }

  stunAround(pos, radius, t, ctx) {
    let n = 0;
    for (const w of this.list) {
      if (w.pos.distanceTo(pos) < radius) { w.stun(t, ctx); n++; }
    }
    return n;
  }

  get trace() {
    let lvl = 0;
    for (const w of this.list) {
      if (w.state === 'chase') return 2;
      if (w.state === 'search' || w.suspicion > 0.3) lvl = 1;
    }
    return lvl;
  }

  update(dt, ctx) {
    for (const w of this.list) w.update(dt, ctx);
    for (const d of this.drones) {
      d.update(dt, ctx.t, false);
      if (!ctx.tempted || ctx.hidden || d.cool > 0) continue;
      const dx = ctx.player.pos.x - d.spot.x, dz = ctx.player.pos.z - d.spot.z;
      if (dx * dx + dz * dz < 4.2 * 4.2 && ctx.player.pos.y < 3) {
        d.cool = 7;
        d.update(0, ctx.t, true);
        d.alertT = 1.5;
        ctx.onDroneSpot?.(d);
        const near = [...this.list].filter((w) => w.state !== 'stunned').sort((a, b) => a.pos.distanceTo(ctx.player.pos) - b.pos.distanceTo(ctx.player.pos));
        near.slice(0, 2).forEach((w) => w.startChase(ctx));
        near.slice(2).forEach((w) => { if (w.state === 'patrol') { w.state = 'search'; w.lastSeen.copy(ctx.player.pos); w.searchT = 8; } });
      }
      if (d.alertT > 0) { d.alertT -= dt; d.update(0, ctx.t, true); }
    }
  }
}
