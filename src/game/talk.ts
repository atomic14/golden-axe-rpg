// Screens drawn over a stopped game (conversations, the shop): the game waits while one is open.
// A conversation types its lines out in a box at the bottom; attack (or a tap) moves it on.
import { input } from '../input';
import { audio } from '../audio';
import { drawText, fillRect, wrap, W } from '../gfx';

export interface Overlay {
  /** returns true once it's finished */
  update(): boolean;
  draw(): void;
}

export interface Line {
  who: string;
  text: string;
}

const PER_LINE = 37;

export class Dialogue implements Overlay {
  private index = 0;
  private shown = 0;
  private t = 0;

  constructor(public lines: Line[], private onDone?: () => void) {}

  private get line() {
    return this.lines[this.index];
  }

  update(): boolean {
    this.t++;
    const total = this.line.text.length;
    if (this.shown < total) this.shown = Math.min(total, this.shown + 1.5);
    const pr = input.pressed;
    if (this.t > 8 && (pr.attack || pr.jump || pr.start || input.tapAt)) {
      if (this.shown < total) this.shown = total;
      else if (++this.index >= this.lines.length) {
        audio.sfx('swing');
        this.onDone?.();
        return true;
      } else this.shown = 0;
    }
    return false;
  }

  draw() {
    const l = this.line;
    fillRect(4, 144, W - 8, 76, '#000');
    fillRect(5, 145, W - 10, 74, '#11203a');
    fillRect(6, 146, W - 12, 72, '#000814');
    drawText(l.who, 12, 150, '#ff0');
    const text = l.text.slice(0, Math.floor(this.shown));
    // wrap the whole line so words don't jump between rows as they type
    let left = text.length;
    wrap(l.text, PER_LINE).forEach((row, i) => {
      if (left <= 0) return;
      drawText(row.slice(0, left), 12, 164 + i * 11, '#fff');
      left -= row.length + 1;
    });
    if (this.shown >= l.text.length && (this.t >> 4) & 1) fillRect(W - 18, 208, 6, 4, '#ff0');
  }
}
