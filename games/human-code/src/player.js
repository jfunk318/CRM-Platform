import * as THREE from 'three';
import { Humanoid } from './humanoid.js';
import { clamp, damp, angleLerp } from './util.js';

const PLAYER_LOOK = {
  skin: '#c98e6b', hair: '#1a1412', hairStyle: 'hood', top: '#1e2430', bottom: '#15171c', shoes: '#e6e6e6',
  jacket: '#2a2e38', sleeves: true, coat: null, height: 1.0, build: 1.0, umbrella: null,
};

const WALK = 4.2;
const SPRINT = 7.4;
const GRAVITY = 21;
const JUMP_V = 6.8;

export class Player {
  constructor(scene, world, time) {
    this.world = world;
    this.h = new Humanoid({ look: PLAYER_LOOK, time, edge: '#4ff3ff', glow: '#9ffcff' });
    scene.add(this.h.root);
    this.pos = world.points.start.clone();
    this.vel = new THREE.Vector3();
    this.velY = 0;
    this.grounded = true;
    this.yaw = Math.PI;
    this.camYaw = Math.PI;
    this.camPitch = -0.08;
    this.mode = 'third';
    this.camDist = 3.6;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camShake = 0;
    this.focus = null;
    this.speed = 0;
    this.radius = 0.32;
    this.dash = 0;
    this.dashDir = new THREE.Vector3();
    this.frozen = false;
    this.sensitivity = 0.0022;
    this.lastSafe = this.pos.clone();
  }

  get head() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z); }

  forward() { return new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); }

  look() {
    const cp = Math.cos(this.camPitch);
    return new THREE.Vector3(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
  }

  toggleView() {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    this.h.setHeadVisible(this.mode === 'third');
  }

  startDash() {
    const f = this.moveDir.lengthSq() > 0.01 ? this.moveDir.clone() : this.forward();
    this.dashDir.copy(f.normalize());
    this.dash = 0.2;
  }

  update(dt, input, opts = {}) {
    const [mx, my] = input.consumeMouse();
    if (!this.focus) {
      this.camYaw -= mx * this.sensitivity;
      this.camPitch = clamp(this.camPitch - my * this.sensitivity, -1.2, 1.1);
    }
    if (input.wheel && this.mode === 'third') this.camDist = clamp(this.camDist + input.wheel * 0.4, 2.2, 6);

    const f = this.forward();
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if (!this.frozen && !this.focus) {
      if (input.down('KeyW') || input.down('ArrowUp')) wish.add(f);
      if (input.down('KeyS') || input.down('ArrowDown')) wish.sub(f);
      if (input.down('KeyD') || input.down('ArrowRight')) wish.add(r);
      if (input.down('KeyA') || input.down('ArrowLeft')) wish.sub(r);
    }
    if (wish.lengthSq() > 0) wish.normalize();
    this.moveDir = wish;
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const target = wish.multiplyScalar(sprint ? SPRINT : WALK);
    const accel = this.grounded ? 12 : 3;
    this.vel.x = damp(this.vel.x, target.x, accel, dt);
    this.vel.z = damp(this.vel.z, target.z, accel, dt);

    if (this.dash > 0) {
      this.dash -= dt;
      this.vel.x = this.dashDir.x * 24;
      this.vel.z = this.dashDir.z * 24;
    }

    if (!this.frozen && !this.focus && input.hit('Space') && this.grounded) {
      this.velY = JUMP_V;
      this.grounded = false;
    }
    this.velY -= GRAVITY * dt;

    const next = this.pos.clone();
    next.x += this.vel.x * dt;
    next.z += this.vel.z * dt;
    next.y += this.velY * dt;
    this.world.collide(next, this.radius, Math.max(next.y, this.pos.y), 1.75);
    const g = this.world.groundAt(next.x, next.z, this.radius, Math.max(this.pos.y, next.y));
    if (next.y <= g) {
      if (!this.grounded && this.velY < -9) this.camShake = Math.max(this.camShake, 0.15);
      next.y = g;
      this.velY = 0;
      this.grounded = true;
    } else if (next.y > g + 0.05) {
      this.grounded = false;
    }
    if (this.grounded && next.y - g < 0.5) next.y = damp(next.y, g, 30, dt);
    this.pos.copy(next);
    if (this.grounded && this.pos.y < 0.1) this.lastSafe.copy(this.pos);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    if (this.mode === 'first') {
      this.yaw = this.camYaw;
    } else if (this.focus) {
      const d = new THREE.Vector3().subVectors(this.focus, this.pos);
      this.yaw = angleLerp(this.yaw, Math.atan2(d.x, d.z), 1 - Math.exp(-8 * dt));
    } else if (hs > 0.3) {
      this.yaw = angleLerp(this.yaw, Math.atan2(this.vel.x, this.vel.z), 1 - Math.exp(-12 * dt));
    }
    this.h.root.position.copy(this.pos);
    this.h.root.rotation.y = this.yaw;
    this.h.lookPitch = this.mode === 'first' ? 0 : -this.camPitch * 0.4;
    this.h.lookYaw = 0;
    this.h.animate(dt, hs, { air: !this.grounded, run: sprint, reaching: opts.reaching });
  }

  updateCamera(dt, camera) {
    let desiredPos, desiredLook;
    if (this.focus) {
      const head = this.head;
      const dir = new THREE.Vector3().subVectors(this.focus, head);
      dir.y = 0;
      dir.normalize();
      const right = new THREE.Vector3(-dir.z, 0, dir.x);
      desiredPos = head.clone().addScaledVector(dir, -1.9).addScaledVector(right, -0.9).add(new THREE.Vector3(0, 0.25, 0));
      // aim low so the speaker sits in the upper half, clear of the dialogue box
      desiredLook = head.clone().lerp(this.focus, 0.72).add(new THREE.Vector3(0, -0.55, 0));
      const blocked = this.world.raycast(head, desiredPos.clone().sub(head).normalize(), head.distanceTo(desiredPos));
      if (blocked < head.distanceTo(desiredPos)) desiredPos = head.clone().lerp(desiredPos, Math.max(0.2, blocked / head.distanceTo(desiredPos) - 0.1));
      this.camPos.lerp(desiredPos, 1 - Math.exp(-4 * dt));
      this.camLook.lerp(desiredLook, 1 - Math.exp(-5 * dt));
    } else if (this.mode === 'first') {
      const hp = new THREE.Vector3();
      this.h.bones.head.getWorldPosition(hp);
      desiredPos = hp.add(this.forward().multiplyScalar(0.14)).add(new THREE.Vector3(0, 0.06, 0));
      this.camPos.copy(desiredPos);
      this.camLook.copy(desiredPos).add(this.look());
    } else {
      const d = this.look();
      const pivot = this.pos.clone().add(new THREE.Vector3(0, 1.58, 0));
      const right = new THREE.Vector3(-d.z, 0, d.x).normalize();
      const shoulder = pivot.clone().addScaledVector(right, 0.55);
      const back = d.clone().negate();
      const dist = this.camDist;
      const hit = this.world.raycast(shoulder, back, dist + 0.3);
      const actual = Math.max(0.4, Math.min(dist, hit - 0.3));
      desiredPos = shoulder.clone().addScaledVector(back, actual);
      if (desiredPos.y < 0.25) desiredPos.y = 0.25;
      this.camPos.lerp(desiredPos, 1 - Math.exp(-25 * dt));
      this.camLook.copy(shoulder).addScaledVector(d, 10);
    }
    camera.position.copy(this.camPos);
    if (this.camShake > 0) {
      this.camShake = Math.max(0, this.camShake - dt);
      const s = this.camShake * 0.25;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(this.camLook);
  }

  snapCamera(camera) {
    this.camPos.copy(this.pos).add(new THREE.Vector3(0, 2.2, 3.6));
    this.updateCamera(1, camera);
  }
}
