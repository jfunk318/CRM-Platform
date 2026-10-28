import { DIALOGUE, SPEAKERS } from './story.js';
import { markup } from './hud.js';

const $ = (id) => document.getElementById(id);

export class Dialogue {
  constructor(audio, state, hooks) {
    this.audio = audio;
    this.state = state;
    this.hooks = hooks;
    this.active = null;
    this.el = $('dialogue');
    this.textEl = $('dlg-text');
    this.speakerEl = $('dlg-speaker');
    this.choicesEl = $('dlg-choices');
    this.hintEl = $('dlg-hint');
  }

  open(id) {
    const tree = DIALOGUE[id];
    this.active = { id, tree, node: null, typed: 0, full: '', done: false };
    this.el.classList.remove('hidden');
    this.go(tree.start(this.state));
  }

  close() {
    const id = this.active?.id;
    this.active = null;
    this.el.classList.add('hidden');
    this.hooks.onClose?.(id);
  }

  go(nodeId) {
    const a = this.active;
    let node = a.tree.nodes[nodeId];
    if (!node) { this.close(); return; }
    if (node.ifPeer && this.hooks.isPeering()) node = a.tree.nodes[node.ifPeer];
    a.node = node;
    node.fx?.(this.state);
    const text = typeof node.text === 'function' ? node.text(this.state) : node.text;
    a.full = text;
    a.plainLen = text.replace(/\*/g, '').length;
    a.typed = 0;
    a.done = false;
    this.speakerEl.textContent = SPEAKERS[node.who] || node.who;
    this.speakerEl.className = node.who;
    this.choicesEl.innerHTML = '';
    this.hintEl.style.display = 'none';
    this.render();
    if (node.action) this.hooks.onAction?.(node.action, node);
  }

  render() {
    const a = this.active;
    const n = Math.floor(a.typed);
    let left = n;
    let html = '';
    a.full.split('*').forEach((seg, i) => {
      if (left <= 0) return;
      const part = seg.slice(0, left);
      left -= part.length;
      html += i % 2 ? `<em>${markup(part)}</em>` : markup(part);
    });
    this.textEl.innerHTML = html;
  }

  finishTyping() {
    const a = this.active;
    a.typed = a.plainLen;
    a.done = true;
    this.textEl.innerHTML = markup(a.full);
    const node = a.node;
    if (node.choices) {
      const list = node.choices.filter((c) => !c.cond || c.cond(this.state));
      a.choices = list;
      list.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.innerHTML = `<span class="num">${i + 1}</span>${markup(c.text)}${c.tag ? `<span class="tag">[${c.tag}]</span>` : ''}`;
        b.addEventListener('click', () => this.choose(i));
        this.choicesEl.appendChild(b);
      });
      this.hintEl.style.display = 'none';
    } else {
      this.hintEl.style.display = '';
      this.hintEl.textContent = node.end ? '[E / Space] end' : '[E / Space] continue';
    }
  }

  choose(i) {
    const a = this.active;
    if (!a || !a.done || !a.choices || !a.choices[i]) return;
    const c = a.choices[i];
    this.audio.blip();
    c.fx?.(this.state);
    this.go(c.next);
  }

  advance() {
    const a = this.active;
    if (!a) return;
    if (!a.done) { this.finishTyping(); return; }
    if (a.node.choices) return;
    if (a.node.end) { this.close(); return; }
    this.go(a.node.next);
  }

  update(dt, input) {
    const a = this.active;
    if (!a) return;
    if (!a.done) {
      const before = Math.floor(a.typed);
      a.typed += dt * 55;
      if (Math.floor(a.typed) !== before && before % 4 === 0) this.audio.blip();
      if (a.typed >= a.plainLen) this.finishTyping();
      else this.render();
    }
    if (input.hit('KeyE') || input.hit('Space') || input.hit('Enter')) this.advance();
    for (let k = 0; k < 4; k++) if (input.hit(`Digit${k + 1}`)) this.choose(k);
  }
}
