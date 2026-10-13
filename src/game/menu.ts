// The character sheet, shown while paused: the hero's level and three skill trees (Weapon,
// Element, Survival) to spend skill points in, and the spell to equip.
import { input } from '../input';
import { audio } from '../audio';
import { drawText, fillRect, wrap, W, H } from '../gfx';
import type { Hero } from './hero';
import { BRANCHES, ROW_LEVEL, SPELLS, elementOf, treeOf, xpToNext, type Skill } from './rpg';

const COL_X = [8, 112, 216], COL_W = 98, TOP = 50, ROW_H = 19;

export class Menu {
  col = 1;
  row = 0;
  private lastX = 0;
  private lastY = 0;
  /** a line of feedback under the trees */
  private note = '';
  private noteTimer = 0;

  constructor(public hero: Hero) {}

  private get tree() {
    return treeOf(this.hero.index);
  }

  private at(col: number, row: number): Skill | undefined {
    return this.tree.find((s) => s.branch === col && s.row === row);
  }

  private rows(col: number) {
    return this.tree.filter((s) => s.branch === col).length;
  }

  update() {
    const pad = input.pad, pr = input.pressed;
    if (this.noteTimer > 0) this.noteTimer--;
    if (pad.x && pad.x !== this.lastX) {
      this.col = (this.col + pad.x + 3) % 3;
      this.row = Math.min(this.row, this.rows(this.col) - 1);
    }
    if (pad.y && pad.y !== this.lastY) this.row = (this.row + pad.y + this.rows(this.col)) % this.rows(this.col);
    this.lastX = pad.x;
    this.lastY = pad.y;
    // touch: tap a skill to pick it, tap it again to learn it (or equip a learned spell)
    const tap = input.tapAt;
    if (tap) {
      for (let c = 0; c < 3; c++) {
        const r = Math.floor((tap.y - TOP + 4) / ROW_H);
        if (tap.x >= COL_X[c] - 4 && tap.x < COL_X[c] + COL_W && r >= 0 && r < this.rows(c)) {
          if (c === this.col && r === this.row) this.activate();
          else [this.col, this.row] = [c, r];
        }
      }
    }
    if (pr.attack) this.activate();
    else if (pr.magic) this.equip();
  }

  private say(text: string) {
    this.note = text;
    this.noteTimer = 120;
  }

  /** learn the selected skill, or equip it if it's a spell that can't be raised further */
  private activate() {
    const s = this.at(this.col, this.row);
    if (!s) return;
    const p = this.hero.prog;
    if (p.learn(s)) {
      this.hero.refreshStats();
      audio.sfx('pickup');
      this.say(`${s.name} RANK ${p.rank(s.id)}`);
    } else if (s.spell && p.rank(s.id) > 0) this.equip();
    else if (p.points <= 0) this.say('NO SKILL POINTS: LEVEL UP TO EARN MORE');
    else if (p.rank(s.id) >= s.ranks) this.say('ALREADY MASTERED');
    else if (p.level < ROW_LEVEL[s.row]) this.say(`NEEDS LEVEL ${ROW_LEVEL[s.row]}`);
    else this.say('LEARN THE SKILL ABOVE FIRST');
  }

  private equip() {
    const s = this.at(this.col, this.row);
    const p = this.hero.prog;
    if (!s?.spell) return;
    if (p.rank(s.id) <= 0) return this.say('NOT LEARNED YET');
    p.spell = s.spell - 1;
    audio.sfx('magic');
    this.say(`${s.name} EQUIPPED`);
  }

  draw() {
    const h = this.hero, p = h.prog;
    fillRect(0, 0, W, H, 'rgba(0,0,16,0.92)');
    drawText(h.def.name, 8, 4, '#ff0');
    drawText(`LV${p.level}`, 312, 4, '#ff0', 'right');
    drawText(`HP ${Math.ceil(h.hp)}/${h.maxHp}  MP ${p.mp}/${p.maxMp}  XP ${p.xp}/${xpToNext(p.level)}`, 8, 14, '#ccc');
    drawText(`SKILL POINTS ${p.points}`, 8, 24, p.points ? '#4f4' : '#888');
    for (let c = 0; c < 3; c++) {
      const title = c === 1 ? elementOf(h.index) : BRANCHES[c];
      drawText(title, COL_X[c], TOP - 13, '#f80');
    }
    const equipped = SPELLS[h.index][p.spell];
    for (const s of this.tree) {
      const x = COL_X[s.branch], y = TOP + s.row * ROW_H;
      const r = p.rank(s.id);
      const color = r >= s.ranks ? '#ff0' : p.canLearn(s) ? '#4f4' : r > 0 ? '#dd8' : p.level < ROW_LEVEL[s.row] ? '#555' : '#999';
      const sel = s.branch === this.col && s.row === this.row;
      if (sel) {
        fillRect(x - 3, y - 3, COL_W + 2, ROW_H - 2, '#335');
        fillRect(x - 3, y - 3, 2, ROW_H - 2, '#ff0');
      }
      drawText(s.name.length > 12 ? s.name.slice(0, 12) : s.name, x, y, color);
      // rank pips, and the level a locked row needs
      for (let k = 0; k < s.ranks; k++) fillRect(x + k * 7, y + 10, 5, 3, k < r ? '#ff0' : '#444');
      if (p.level < ROW_LEVEL[s.row]) drawText(`LV${ROW_LEVEL[s.row]}`, x + COL_W - 6, y + 8, '#555', 'right');
      if (s.spell && s.spell === equipped.tier) drawText('EQ', x + COL_W - 6, y + 8, '#8cf', 'right');
    }
    // the selected skill's description
    const s = this.at(this.col, this.row);
    fillRect(0, 167, W, 1, '#446');
    if (s) wrap(s.desc, 36).forEach((l, i) => drawText(l, 8, 172 + i * 10, '#fff'));
    if (this.noteTimer > 0) drawText(this.note, W / 2, 196, '#ff0', 'center');
    const help = input.touch ? 'TAP TWICE: LEARN/EQUIP  II: CLOSE' : 'ATTACK LEARN  MAGIC EQUIP  P CLOSE';
    drawText(help, W / 2, 210, '#8af', 'center');
  }
}
