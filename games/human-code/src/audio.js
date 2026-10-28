// Everything is synthesized: rain, the city drone, the veil's hum and every effect.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.beat = 0;
    this.trace = 0;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w;
      d[i] = w * 0.6 + b * 2.0;
    }

    // rain
    const rain = this.loopNoise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.4;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.11;
    rain.connect(bp).connect(this.rainGain).connect(this.master);
    const rumble = this.loopNoise();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 260;
    const rg = ctx.createGain();
    rg.gain.value = 0.09;
    rumble.connect(lp).connect(rg).connect(this.master);

    // city drone
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass'; this.droneFilter.frequency.value = 240; this.droneFilter.Q.value = 3;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.045;
    this.droneOsc = [];
    for (const f of [55, 55.35, 82.6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(this.droneFilter);
      o.start();
      this.droneOsc.push(o);
    }
    this.droneFilter.connect(this.droneGain).connect(this.master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 90;
    lfo.connect(lfoG).connect(this.droneFilter.frequency);
    lfo.start();

    // the veil's hum, audible only while peering
    this.peerGain = ctx.createGain();
    this.peerGain.gain.value = 0;
    this.peerGain.connect(this.master);
    for (const [f, g] of [[880, 0.2], [1318.5, 0.12], [41, 0.9], [2637, 0.05]]) {
      const o = ctx.createOscillator();
      o.type = f < 100 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.peerGain);
      o.start();
    }
    const trem = ctx.createOscillator();
    trem.frequency.value = 7;
    const tg = ctx.createGain();
    tg.gain.value = 0.3;
    trem.connect(tg).connect(this.peerGain.gain);
    trem.start();
  }

  loopNoise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  get t() { return this.ctx.currentTime; }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.t, 0.05);
    return this.muted;
  }

  update(dt, { peer = 0, trace = 0, slow = 0 } = {}) {
    if (!this.ctx) return;
    this.peerGain.gain.setTargetAtTime(peer * 0.07, this.t, 0.08);
    this.droneFilter.frequency.setTargetAtTime(240 + peer * 500 - slow * 120, this.t, 0.2);
    for (const o of this.droneOsc) o.detune.setTargetAtTime(-slow * 600, this.t, 0.2);
    this.rainGain.gain.setTargetAtTime(0.11 * (1 - slow * 0.7), this.t, 0.2);
    this.trace = trace;
    if (trace > 0) {
      this.beat -= dt;
      if (this.beat <= 0) {
        this.beat = trace >= 2 ? 0.48 : 0.95;
        this.thump(0.5);
        setTimeout(() => this.thump(0.32), 150);
      }
    }
  }

  env(node, peak, a, dcy, at = this.t) {
    node.gain.setValueAtTime(0.0001, at);
    node.gain.exponentialRampToValueAtTime(peak, at + a);
    node.gain.exponentialRampToValueAtTime(0.0001, at + a + dcy);
  }

  tone(type, f0, f1, dur, peak, at = this.t, dest = this.master) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    this.env(g, peak, 0.005, dur, at);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  burst(dur, peak, type = 'highpass', f0 = 800, f1 = 800, q = 0.7, at = this.t) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = this.ctx.createGain();
    this.env(g, peak, 0.01, dur, at);
    s.connect(f).connect(g).connect(this.master);
    s.start(at, Math.random());
    s.stop(at + dur + 0.05);
  }

  thump(v = 0.5) {
    if (!this.ctx) return;
    this.tone('sine', 90, 38, 0.22, v * 0.5);
  }

  glitch(strength = 1) {
    if (!this.ctx) return;
    const n = Math.floor(6 + strength * 6);
    for (let i = 0; i < n; i++) {
      const at = this.t + i * 0.028;
      this.tone('square', 80 + Math.random() * 2400, 60 + Math.random() * 900, 0.03, 0.05 * strength, at);
    }
    this.burst(0.25, 0.12 * strength, 'bandpass', 3000, 400, 2);
  }

  blip() {
    if (!this.ctx) return;
    this.tone('sine', 1800 + Math.random() * 300, 1800, 0.018, 0.012);
  }

  pickup() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5, 1567.98].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.08, this.t + i * 0.07));
    this.tone('sine', 110, 55, 1.4, 0.2);
  }

  alert() {
    if (!this.ctx) return;
    this.tone('sawtooth', 240, 120, 0.5, 0.12);
    this.tone('sawtooth', 247, 118, 0.5, 0.09);
    this.thump(0.8);
  }

  override() {
    if (!this.ctx) return;
    this.burst(0.6, 0.35, 'bandpass', 200, 5000, 3);
    this.tone('sine', 600, 50, 0.7, 0.3);
    this.tone('square', 1200, 80, 0.3, 0.05);
  }

  dash() {
    if (!this.ctx) return;
    this.burst(0.3, 0.25, 'highpass', 400, 4000, 1);
  }

  hit() {
    if (!this.ctx) return;
    this.tone('square', 140, 50, 0.18, 0.12);
    this.burst(0.15, 0.2, 'lowpass', 2000, 300);
  }

  slowmo(on) {
    if (!this.ctx) return;
    if (on) this.tone('sine', 400, 60, 1.2, 0.25);
    else this.tone('sine', 60, 400, 0.6, 0.15);
  }

  swell() {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.t);
    g.gain.exponentialRampToValueAtTime(0.16, this.t + 4);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 14);
    g.connect(this.master);
    for (const f of [55, 82.5, 110, 164.8, 220, 329.6]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(g);
      o.start();
      o.stop(this.t + 14.5);
    }
  }
}
