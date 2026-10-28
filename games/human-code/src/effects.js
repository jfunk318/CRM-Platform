import * as THREE from 'three';

export class Sparks {
  constructor(scene, max = 800) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(at, n, color, speed = 4, up = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.i;
      this.i = (this.i + 1) % this.max;
      this.pos[i * 3] = at.x; this.pos[i * 3 + 1] = at.y; this.pos[i * 3 + 2] = at.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.3 + Math.random() * 0.7);
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      this.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s * up + 0.5;
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      this.life[i] = 0.5 + Math.random() * 0.8;
      this.col[i * 3] = c.r * 3; this.col[i * 3 + 1] = c.g * 3; this.col[i * 3 + 2] = c.b * 3;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i]);
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.02, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (f <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      const k = Math.min(1, f * 2);
      this.col[i * 3] *= 0.985 + 0.015 * k; this.col[i * 3 + 1] *= 0.985 + 0.015 * k; this.col[i * 3 + 2] *= 0.985 + 0.015 * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Shockwaves {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(at, color, maxR = 13, dur = 0.7) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 64), mat);
    m.rotation.x = Math.PI / 2;
    m.position.copy(at);
    m.position.y += 1;
    this.scene.add(m);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
    sphere.position.copy(m.position);
    this.scene.add(sphere);
    this.list.push({ m, sphere, t: 0, dur, maxR });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i];
      w.t += dt;
      const k = w.t / w.dur;
      const r = 0.5 + (1 - (1 - k) ** 3) * w.maxR;
      w.m.scale.setScalar(r);
      w.sphere.scale.setScalar(r * 0.98);
      w.m.material.opacity = 1 - k;
      w.sphere.material.opacity = (1 - k) * 0.35;
      if (k >= 1) {
        this.scene.remove(w.m, w.sphere);
        w.m.geometry.dispose(); w.m.material.dispose();
        w.sphere.geometry.dispose(); w.sphere.material.dispose();
        this.list.splice(i, 1);
      }
    }
  }
}
