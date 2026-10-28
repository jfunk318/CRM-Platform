// Keyboard + mouse. Pointer lock when the page allows it, drag-to-look otherwise
// (sandboxed iframes often refuse pointer lock).
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressed = new Set();
    this.dx = 0;
    this.dy = 0;
    this.rmb = false;
    this.lmbDown = false;
    this.locked = false;
    this.lockFailed = false;
    this.enabled = false;
    this.wheel = 0;
    this.lockedAt = 0;

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.rmb = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.rmb = true;
      if (e.button === 0) this.lmbDown = true;
      if (this.enabled && !this.locked) this.lock();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rmb = false;
      if (e.button === 0) this.lmbDown = false;
    });
    addEventListener('mousemove', (e) => {
      // Chrome can report a huge jump on the first event after locking
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      if (this.locked) {
        if (performance.now() - this.lockedAt < 120) return;
        this.dx += e.movementX;
        this.dy += e.movementY;
      } else if (this.enabled && this.lockFailed && (this.lmbDown || this.rmb)) {
        this.dx += e.movementX * 1.4;
        this.dy += e.movementY * 1.4;
      }
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      this.lockedAt = performance.now();
      this.dx = this.dy = 0;
      if (!this.locked) this.onUnlock?.();
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
  }

  lock() {
    try {
      const p = this.el.requestPointerLock?.();
      if (p && p.catch) p.catch(() => { this.lockFailed = true; });
    } catch {
      this.lockFailed = true;
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  consumeMouse() {
    const r = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return r;
  }
  endFrame() { this.pressed.clear(); this.wheel = 0; }
}
