// The pause menu: the hero's sheet with three tabs (jump switches between them). SKILLS: the
// three skill trees (Weapon, Element, Survival) to spend points in, and the spell to equip.
// ITEMS: the bag, to use things from, and the party's gear. QUESTS: the quest log.
import { input } from '../input';
import { audio } from '../audio';
import { drawText, fillRect, wrap, W, H } from '../gfx';
import type { Hero } from './hero';
import { BRANCHES, ROW_LEVEL, SPELLS, elementOf, treeOf, xpToNext, type Skill } from './rpg';
import { ITEMS, party, gearName, gearDesc, type ItemDef } from './party';
import { log, questDef, progressText } from './quests';
import { FloatText } from './fx';

const COL_X = [8, 112, 216], COL_W = 98, TOP = 50, ROW_H = 19;
const TABS = ['SKILLS', 'ITEMS', 'QUESTS'] as const;
/** where each tab's name is drawn (x of its left edge), right of the skill points */
const TAB_X = [160, 216, 264];

export class Menu {
  tab = 0;
  col = 1;
  row = 0;
  /** the selected line on the items and quests tabs */
  line = 0;
  private lastX = 0;
  private lastY = 0;
  /** a line of feedback under the trees */
  private note = '';
  private noteTimer = 0;

  constructor(public hero: Hero, public heroes: Hero[] = [hero]) {}

  private get questIds() {
    return Object.keys(log);
  }

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
    const tap = input.tapAt;
    if (pr.jump) this.tab = (this.tab + 1) % TABS.length;
    if (tap && tap.y < 34 && tap.x >= TAB_X[0] - 4) {
      this.tab = TAB_X.reduce((best, x, i) => (tap.x >= x - 4 ? i : best), 0);
      return;
    }
    if (this.tab === 1) return this.updateItems();
    if (this.tab === 2) return this.updateQuests();
    if (pad.x && pad.x !== this.lastX) {
      this.col = (this.col + pad.x + 3) % 3;
      this.row = Math.min(this.row, this.rows(this.col) - 1);
    }
    if (pad.y && pad.y !== this.lastY) this.row = (this.row + pad.y + this.rows(this.col)) % this.rows(this.col);
    this.lastX = pad.x;
    this.lastY = pad.y;
    // touch: tap a skill to pick it, tap it again to learn it (or equip a learned spell)
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

  /** up and down through a list of n lines (the items or quests tab); returns a tapped line */
  private moveLine(n: number): number | null {
    const y = input.pad.y;
    if (n && y && y !== this.lastY) this.line = (this.line + y + n) % n;
    this.lastY = y;
    this.line = Math.max(0, Math.min(this.line, n - 1));
    const tap = input.tapAt;
    if (!tap) return null;
    const r = Math.floor((tap.y - TOP + 3) / 14);
    return r >= 0 && r < n ? r : null;
  }

  private updateItems() {
    const tapped = this.moveLine(ITEMS.length);
    if (tapped !== null) {
      if (tapped === this.line) this.use(ITEMS[tapped]);
      else this.line = tapped;
    }
    if (input.pressed.attack) this.use(ITEMS[this.line]);
  }

  private updateQuests() {
    const tapped = this.moveLine(this.questIds.length);
    if (tapped !== null) this.line = tapped;
  }

  /** Use something from the bag: meat and tonic on this hero, an elixir on everyone. */
  private use(item: ItemDef) {
    if (party.bag[item.id] <= 0) return this.say(`NO ${item.name} LEFT`);
    const h = this.hero, p = h.prog;
    const lift = (who: Hero, text: string, color: string) => who.stage.actors.push(new FloatText(who.stage, who, text, color));
    if (item.id === 'meat') {
      if (h.hp >= h.maxHp) return this.say('ALREADY AT FULL HEALTH');
      const n = Math.min(h.maxHp - h.hp, Math.round(h.maxHp * 0.4));
      h.hp += n;
      lift(h, `+${n}`, '#4f4');
    } else if (item.id === 'tonic') {
      if (p.mp >= p.maxMp) return this.say('ALREADY AT FULL MAGIC');
      const n = Math.min(p.maxMp - p.mp, 20);
      p.mp += n;
      lift(h, `+${n} MP`, '#8cf');
    } else {
      const alive = this.heroes.filter((o) => !o.dead && o.state !== 'gameover');
      if (alive.every((o) => o.hp >= o.maxHp && o.prog.mp >= o.prog.maxMp)) return this.say('EVERYONE IS AT FULL STRENGTH');
      for (const o of alive) {
        o.hp = o.maxHp;
        o.prog.mp = o.prog.maxMp;
        lift(o, 'RESTORED', '#4f4');
      }
    }
    party.bag[item.id]--;
    audio.sfx('pickup');
    this.say(`USED ${item.name}`);
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
    if (this.tab === 0) drawText(`POINTS ${p.points}`, 8, 24, p.points ? '#4f4' : '#888');
    else drawText(`GOLD ${party.gold}`, 8, 24, '#fd0');
    TABS.forEach((t, i) => drawText(t, TAB_X[i], 24, i === this.tab ? '#ff0' : '#557'));
    fillRect(TAB_X[this.tab], 33, TABS[this.tab].length * 8 - 1, 1, '#ff0');
    if (this.tab === 1) this.drawItems();
    else if (this.tab === 2) this.drawQuests();
    else this.drawSkills();
    if (this.noteTimer > 0) drawText(this.note, W / 2, 196, '#ff0', 'center');
    const help = input.touch
      ? ['TAP TWICE: LEARN/EQUIP  II: CLOSE', 'TAP TWICE: USE  II: CLOSE', 'II: CLOSE'][this.tab]
      : ['ATTACK LEARN  MAGIC EQUIP  JUMP TABS', 'ATTACK USE  JUMP TABS  P CLOSE', 'JUMP TABS  P CLOSE'][this.tab];
    drawText(help, W / 2, 210, '#8af', 'center');
  }

  private drawItems() {
    ITEMS.forEach((it, i) => {
      const y = TOP + i * 14, sel = i === this.line;
      if (sel) fillRect(4, y - 3, W - 8, 13, '#335');
      drawText(it.name, 16, y, party.bag[it.id] ? '#fff' : '#777');
      drawText(`X${party.bag[it.id]}`, 312, y, '#ff0', 'right');
    });
    drawText(ITEMS[this.line].desc, 16, TOP + 46, '#8cf');
    drawText('GEAR', 8, 112, '#f80');
    this.heroes.forEach((o, i) => {
      const y = 126 + i * 22, q = o.prog;
      drawText(`${o.def.name.split(' ')[0]}: ${gearName('weapon', o.index, q.weapon)}`, 16, y, '#ccc');
      drawText(`${gearName('armour', o.index, q.armour)}  ${gearDesc('armour', q.armour)}`, 40, y + 10, '#999');
    });
  }

  private drawQuests() {
    const ids = this.questIds;
    if (!ids.length) {
      wrap('NO QUESTS YET. TOWNSFOLK WITH TROUBLES WILL ASK FOR YOUR HELP.', 36).forEach((l, i) => drawText(l, 16, TOP + i * 11, '#888'));
      return;
    }
    ids.forEach((id, i) => {
      const q = questDef(id)!, s = log[id];
      const y = TOP + i * 14, sel = i === this.line;
      if (sel) fillRect(4, y - 3, W - 8, 13, '#335');
      const color = s.state === 'rewarded' ? '#666' : s.state === 'done' ? '#4f4' : '#fff';
      drawText(q.title, 16, y, color);
      drawText(progressText(q, s), 312, y, color, 'right');
    });
    const q = questDef(ids[this.line]);
    if (q) {
      fillRect(0, 167, W, 1, '#446');
      wrap(q.ask, 36).forEach((l, i) => drawText(l, 8, 172 + i * 10, '#aac'));
    }
  }

  private drawSkills() {
    const h = this.hero, p = h.prog;
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
  }
}
