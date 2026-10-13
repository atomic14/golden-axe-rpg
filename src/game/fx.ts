// Floating numbers and words over the fighters: damage dealt, heals, level ups.
import { drawText } from '../gfx';
import { Actor } from './actor';
import type { Stage } from './stage';

export class FloatText extends Actor {
  life = 0;
  /** drift sideways a little so numbers from quick hits don't stack exactly */
  private drift = (Math.random() - 0.5) * 0.4;

  constructor(stage: Stage, at: Actor, public text: string, public color: string, public rise = 56, public length = 45) {
    super(stage);
    this.x = at.x;
    // in front of whoever it's over, so it draws on top
    this.z = at.z + 0.75;
    this.y = at.y - rise;
    this.isEnemy = false;
    this.hostile = false;
  }

  update() {
    this.life++;
    this.y -= this.life < 12 ? 1.2 : 0.3;
    this.x += this.drift;
    if (this.life >= this.length) this.gone = true;
  }

  draw() {
    if (this.life > this.length - 10 && (this.life >> 1) & 1) return;
    const [sx, sy] = this.screen();
    drawText(this.text, sx, sy, this.color, 'center');
  }
}
