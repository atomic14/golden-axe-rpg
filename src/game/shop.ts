// A trader's goods: things for the bag, and the next weapon and armour for each hero (up to the
// best this trader stocks).
import { input } from '../input';
import { audio } from '../audio';
import { drawText, fillRect, W, H } from '../gfx';
import type { Hero } from './hero';
import type { Overlay } from './talk';
import { ITEMS, party, gearName, gearPrice, gearDesc, GEAR_TIERS, type ItemDef, type GearSlot } from './party';

type Ware =
  | { kind: 'item'; item: ItemDef }
  | { kind: 'gear'; hero: Hero; slot: GearSlot; tier: number };

const TOP = 44, ROW_H = 13;

export class Shop implements Overlay {
  row = 0;
  private lastY = 0;
  private t = 0;
  private note = '';
  private noteTimer = 0;

  constructor(public name: string, public heroes: Hero[], public maxTier: number) {}

  /** what's for sale now (gear moves on a tier as each is bought) */
  get wares(): Ware[] {
    const out: Ware[] = ITEMS.map((item) => ({ kind: 'item', item }));
    for (const h of this.heroes) {
      for (const slot of ['weapon', 'armour'] as const) {
        const tier = (slot === 'weapon' ? h.prog.weapon : h.prog.armour) + 1;
        if (tier < GEAR_TIERS && tier <= this.maxTier) out.push({ kind: 'gear', hero: h, slot, tier });
      }
    }
    return out;
  }

  private price(w: Ware) {
    return w.kind === 'item' ? w.item.price : gearPrice(w.slot, w.tier);
  }

  update(): boolean {
    this.t++;
    if (this.noteTimer > 0) this.noteTimer--;
    const wares = this.wares, pr = input.pressed;
    const y = input.pad.y;
    if (y && y !== this.lastY) this.row = (this.row + y + wares.length) % wares.length;
    this.lastY = y;
    this.row = Math.min(this.row, wares.length - 1);
    const tap = input.tapAt;
    if (tap) {
      const r = Math.floor((tap.y - TOP + 3) / ROW_H);
      if (tap.y > 200) return true;
      if (r >= 0 && r < wares.length) {
        if (r === this.row) this.buy(wares[r]);
        else this.row = r;
      }
    }
    if (this.t > 8 && pr.attack) this.buy(wares[this.row]);
    return this.t > 8 && (pr.jump || pr.pause || pr.start);
  }

  private say(text: string) {
    this.note = text;
    this.noteTimer = 100;
  }

  private buy(w: Ware | undefined) {
    if (!w) return;
    const cost = this.price(w);
    if (party.gold < cost) return this.say('NOT ENOUGH GOLD');
    party.gold -= cost;
    audio.sfx('coin');
    if (w.kind === 'item') {
      party.bag[w.item.id]++;
      this.say(`BOUGHT ${w.item.name}`);
    } else {
      if (w.slot === 'weapon') w.hero.prog.weapon = w.tier;
      else w.hero.prog.armour = w.tier;
      this.say(`${w.hero.def.name.split(' ')[0]}: ${gearName(w.slot, w.hero.index, w.tier)}`);
    }
  }

  draw() {
    fillRect(0, 0, W, H, 'rgba(10,6,0,0.92)');
    drawText(this.name, 8, 6, '#ff0');
    drawText(`GOLD ${party.gold}`, 312, 6, '#fd0', 'right');
    drawText('ITEM', 16, 28, '#f80');
    drawText('PRICE', 312, 28, '#f80', 'right');
    const wares = this.wares;
    wares.forEach((w, i) => {
      const y = TOP + i * ROW_H, sel = i === this.row;
      if (sel) fillRect(4, y - 3, W - 8, ROW_H - 1, '#332');
      const label = w.kind === 'item'
        ? `${w.item.name} (${party.bag[w.item.id]})`
        : `${w.hero.def.name.split(' ')[0]}: ${gearName(w.slot, w.hero.index, w.tier)}`;
      const cost = this.price(w);
      drawText(label, 16, y, sel ? '#fff' : '#bbb');
      drawText(String(cost), 312, y, party.gold >= cost ? '#fd0' : '#844', 'right');
    });
    if (!wares.some((w) => w.kind === 'gear')) drawText('NO BETTER GEAR HERE', 16, TOP + wares.length * ROW_H + 4, '#666');
    const w = wares[this.row];
    if (w) drawText(w.kind === 'item' ? w.item.desc : gearDesc(w.slot, w.tier), 8, 176, '#8cf');
    if (this.noteTimer > 0) drawText(this.note, W / 2, 190, '#ff0', 'center');
    drawText(input.touch ? 'TAP TWICE: BUY   TAP HERE: LEAVE' : 'ATTACK: BUY   JUMP: LEAVE', W / 2, 208, '#8af', 'center');
  }
}
