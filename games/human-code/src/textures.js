import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

// 4 windows across, 4 floors up. Each tile covers 10m x 12m of facade.
export function facadeTexture(seed, { lit = 0.35, warm = 0.7, style = 0 } = {}) {
  const rng = mulberry32(seed);
  const [c, g] = canvas(512, 512);
  const base = style === 1 ? '#0d1016' : style === 2 ? '#14121a' : '#0f1117';
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(255,255,255,${rng() * 0.025})`;
    g.fillRect(rng() * 512, rng() * 512, 2, 2);
  }
  const cols = 4, rows = 4, cw = 512 / cols, rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    // floor slab line
    g.fillStyle = 'rgba(255,255,255,0.035)';
    g.fillRect(0, r * rh + rh - 6, 512, 3);
    for (let k = 0; k < cols; k++) {
      const x = k * cw + (style === 1 ? 6 : 16), y = r * rh + 18;
      const w = cw - (style === 1 ? 12 : 32), h = rh - 40;
      const on = rng() < lit;
      if (on) {
        const hue = rng() < warm ? [255, 196 + rng() * 40, 120 + rng() * 60] : rng() < 0.75 ? [150, 210, 255] : [255, 120, 210];
        const grad = g.createLinearGradient(x, y, x, y + h);
        const a = 0.55 + rng() * 0.45;
        grad.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${a})`);
        grad.addColorStop(1, `rgba(${hue[0] * 0.7},${hue[1] * 0.6},${hue[2] * 0.6},${a * 0.8})`);
        g.fillStyle = grad;
        g.fillRect(x, y, w, h);
        // blinds / silhouettes
        if (rng() < 0.4) {
          g.fillStyle = 'rgba(0,0,0,0.35)';
          for (let b = 0; b < h; b += 6) g.fillRect(x, y + b, w, 2);
        }
        if (rng() < 0.2) {
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fillRect(x + w * rng() * 0.6, y + h * 0.35, w * 0.18, h * 0.65);
        }
      } else {
        const grad = g.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, '#141a26');
        grad.addColorStop(1, '#07090e');
        g.fillStyle = grad;
        g.fillRect(x, y, w, h);
      }
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.strokeRect(x, y, w, h);
    }
  }
  return tex(c, { repeat: true });
}

export function neonTexture(lines, { w = 1024, h = 512, color = '#ff3fb4', color2 = '#4ff3ff', bg = '#07040c', font = 'Chakra Petch', glitch = false, seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const [c, g] = canvas(w, h);
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // scanlines
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.strokeStyle = color2;
  g.lineWidth = 6;
  g.shadowColor = color2;
  g.shadowBlur = 24;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    const big = i === 0;
    const size = big ? Math.min(h * (n > 1 ? 0.36 : 0.5), (w * 1.5) / Math.max(4, line.length)) : h * 0.12;
    g.font = `700 ${size}px "${font}", sans-serif`;
    const y = n === 1 ? h / 2 : big ? h * 0.42 : h * 0.42 + h * 0.2 * i + 10;
    const col = big ? color : color2;
    g.shadowColor = col;
    g.shadowBlur = big ? 40 : 18;
    g.fillStyle = col;
    if (glitch) {
      g.globalAlpha = 0.6;
      g.fillStyle = '#ff2050';
      g.fillText(line, w / 2 - 8, y);
      g.fillStyle = '#20f0ff';
      g.fillText(line, w / 2 + 8, y);
      g.globalAlpha = 1;
      g.fillStyle = '#ffffff';
    }
    g.fillText(line, w / 2, y);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(line, w / 2, y);
  });
  if (glitch) {
    for (let i = 0; i < 14; i++) {
      const y = rng() * h, hh = 4 + rng() * 24;
      const slice = g.getImageData(0, y, w, hh);
      g.putImageData(slice, (rng() - 0.5) * 80, y);
    }
  }
  return tex(c);
}

export function verticalSign(text, color, seed) {
  const rng = mulberry32(seed);
  const [c, g] = canvas(96, 512);
  g.fillStyle = '#05030a';
  g.fillRect(0, 0, 96, 512);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.strokeRect(6, 6, 84, 500);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 64px "Chakra Petch", sans-serif';
  const letters = [...text];
  const step = 480 / letters.length;
  letters.forEach((ch, i) => {
    g.shadowBlur = 22;
    g.fillStyle = color;
    if (rng() < 0.08) g.globalAlpha = 0.35; // a dead tube
    g.fillText(ch, 48, 20 + step * (i + 0.5));
    g.globalAlpha = 1;
  });
  return tex(c);
}

export function storefrontTexture(name, color, seed) {
  const rng = mulberry32(seed);
  const [c, g] = canvas(512, 256);
  // interior glow
  const grad = g.createLinearGradient(0, 80, 0, 256);
  grad.addColorStop(0, '#2a2018');
  grad.addColorStop(1, '#5a4430');
  g.fillStyle = '#08070a';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = grad;
  g.fillRect(16, 86, 480, 160);
  // shelves and silhouettes
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(0,0,0,${0.25 + rng() * 0.3})`;
    g.fillRect(20 + rng() * 460, 120 + rng() * 60, 20 + rng() * 60, 6 + rng() * 60);
  }
  g.fillStyle = 'rgba(255,240,220,0.08)';
  for (let x = 16; x < 496; x += 120) g.fillRect(x, 86, 3, 160);
  // sign band
  g.fillStyle = '#0b0910';
  g.fillRect(0, 0, 512, 80);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 54px "Chakra Petch", sans-serif';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(name, 256, 42);
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillText(name, 256, 42);
  return tex(c);
}

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const [c, g] = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.35)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return tex(c, { srgb: false });
}

export function plainTextTexture(lines, { w = 512, h = 256, bg = '#e8e3d4', fg = '#1a1a1a', font = 'Chakra Petch', size = 46, color = null } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((line, i) => {
    g.font = `${i === 0 ? 700 : 400} ${i === 0 ? size : size * 0.55}px "${font}", sans-serif`;
    g.fillStyle = i === 0 && color ? color : fg;
    g.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.05);
  });
  return tex(c);
}

export function graffitiTexture(text, color) {
  const [c, g] = canvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 italic 120px "Chakra Petch", sans-serif';
  g.shadowColor = color;
  g.shadowBlur = 30;
  g.fillStyle = color;
  g.save();
  g.translate(256, 128);
  g.rotate(-0.08);
  g.fillText(text, 0, 0);
  g.restore();
  // drips
  for (let i = 0; i < 18; i++) {
    const x = 60 + Math.random() * 390;
    g.fillRect(x, 150 + Math.random() * 20, 3, 20 + Math.random() * 60);
  }
  return tex(c);
}

// Ground texture covering world x,z in [-130,130]. Canvas top = -z (north).
export function groundTexture(layout) {
  const S = 2048, W = 260;
  const [c, g] = canvas(S, S);
  const rng = mulberry32(99);
  const px = (v) => ((v + 130) / W) * S;
  g.fillStyle = '#17181d';
  g.fillRect(0, 0, S, S);
  // asphalt speckle
  for (let i = 0; i < 90000; i++) {
    const v = 20 + rng() * 24;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + rng() * 0.3})`;
    g.fillRect(rng() * S, rng() * S, 1.5, 1.5);
  }
  // sidewalks: block footprints
  for (const b of layout.blocks) {
    const x0 = px(b.x0), z0 = px(b.z0), x1 = px(b.x1), z1 = px(b.z1);
    g.fillStyle = '#2b2c33';
    g.fillRect(x0, z0, x1 - x0, z1 - z0);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    for (let x = x0; x < x1; x += 15.75) { g.beginPath(); g.moveTo(x, z0); g.lineTo(x, z1); g.stroke(); }
    for (let z = z0; z < z1; z += 15.75) { g.beginPath(); g.moveTo(x0, z); g.lineTo(x1, z); g.stroke(); }
    g.strokeStyle = '#4a4b52';
    g.lineWidth = 3;
    g.strokeRect(x0, z0, x1 - x0, z1 - z0);
  }
  // plaza
  const pc = px(0);
  g.fillStyle = '#26262d';
  g.fillRect(px(-28), px(-28), px(28) - px(-28), px(28) - px(-28));
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 2;
  for (let r = 8; r < 28; r += 3) { g.beginPath(); g.arc(pc, pc, (r / W) * S, 0, Math.PI * 2); g.stroke(); }
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2;
    g.beginPath();
    g.moveTo(pc + Math.cos(ang) * (8 / W) * S, pc + Math.sin(ang) * (8 / W) * S);
    g.lineTo(pc + Math.cos(ang) * (27 / W) * S, pc + Math.sin(ang) * (27 / W) * S);
    g.stroke();
  }
  g.strokeStyle = 'rgba(79,243,255,0.25)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(pc, pc, (7.5 / W) * S, 0, Math.PI * 2); g.stroke();
  // lane markings
  g.setLineDash([22, 26]);
  g.strokeStyle = 'rgba(210,180,90,0.5)';
  g.lineWidth = 3;
  for (const s of layout.streets) {
    g.beginPath();
    if (s.axis === 'x') { g.moveTo(px(s.from), px(s.at)); g.lineTo(px(s.to), px(s.at)); }
    else { g.moveTo(px(s.at), px(s.from)); g.lineTo(px(s.at), px(s.to)); }
    g.stroke();
  }
  g.setLineDash([]);
  // crosswalks at intersections
  g.fillStyle = 'rgba(220,220,225,0.32)';
  for (const p of layout.intersections) {
    for (const [dx, dz, horiz] of [[0, -8, true], [0, 8, true], [-8, 0, false], [8, 0, false]]) {
      for (let k = -5; k <= 5; k += 1.4) {
        if (horiz) g.fillRect(px(p.x + k), px(p.z + dz - 1.2), 6, (2.4 / W) * S);
        else g.fillRect(px(p.x + dx - 1.2), px(p.z + k), (2.4 / W) * S, 6);
      }
    }
  }
  // manholes and stains
  for (let i = 0; i < 70; i++) {
    const x = rng() * S, z = rng() * S;
    g.fillStyle = `rgba(0,0,0,${0.15 + rng() * 0.2})`;
    g.beginPath(); g.ellipse(x, z, 10 + rng() * 40, 6 + rng() * 25, rng() * 3, 0, Math.PI * 2); g.fill();
  }
  const t = tex(c, { aniso: 16 });
  return t;
}
