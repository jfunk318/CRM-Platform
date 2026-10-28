import * as THREE from 'three';
import { radialTexture } from './textures.js';

export class Fragments {
  constructor(scene, defs, time) {
    this.items = [];
    const glowTex = radialTexture('rgba(120,240,255,1)');
    for (const def of defs) {
      const g = new THREE.Group();
      g.position.copy(def.pos);
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 4, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), coreMat);
      const shellMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 2.2, 3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.42, 0)), shellMat);
      const shell2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 0)), shellMat);
      const bits = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), coreMat);
        const a = (k / 6) * Math.PI * 2;
        b.position.set(Math.cos(a) * 0.85, Math.sin(a * 2) * 0.15, Math.sin(a) * 0.85);
        bits.add(b);
      }
      const spriteMat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.5, 1.6, 2.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3, 3, 1);
      const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 60, 6, 1, true), beamMat);
      beam.position.y = 30;
      g.add(core, shell, shell2, bits, sprite, beam);
      g.visible = false;
      scene.add(g);
      this.items.push({ ...def, group: g, core, shell, shell2, bits, sprite, coreMat, shellMat, spriteMat, beamMat, collected: false, baseY: def.pos.y });
    }
  }

  // returns the closest uncollected fragment and its distance
  update(dt, t, peer, playerPos) {
    let nearest = null, nd = Infinity;
    for (const it of this.items) {
      if (it.collected) { it.group.visible = false; continue; }
      const d = it.group.position.distanceTo(playerPos);
      if (d < nd) { nd = d; nearest = it; }
      const hint = d < 10 ? 0.06 * (1 - d / 10) : 0;
      const vis = Math.max(peer, hint);
      it.group.visible = vis > 0.01;
      if (!it.group.visible) continue;
      it.group.position.y = it.baseY + Math.sin(t * 1.8 + it.baseY) * 0.12;
      it.shell.rotation.set(t * 0.7, t * 1.1, 0);
      it.shell2.rotation.set(-t * 0.4, t * 0.5, t * 0.3);
      it.bits.rotation.y = t * 1.5;
      it.coreMat.opacity = vis;
      it.shellMat.opacity = vis;
      it.spriteMat.opacity = vis * (0.6 + Math.sin(t * 5) * 0.2);
      it.beamMat.opacity = peer * 0.45;
    }
    return { nearest, dist: nd };
  }
}
