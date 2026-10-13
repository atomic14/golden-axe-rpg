// The world map: the original's parchment map of Yuria (from its story scenes between areas, with
// the route painted out) and the journey on it: the five areas and the camps between them. The
// party walks from place to place along the route; the way on opens as each area's boss falls.
import { assets } from '../assets';
import { input } from '../input';
import { audio } from '../audio';
import { ctx, drawSprite, drawText, fillRect, wrap, W, H } from '../gfx';
import { HEROES } from './hero';

export interface Place {
  kind: 'area' | 'camp';
  /** the area, or for a camp the area it follows */
  area: number;
  name: string;
  /** on the map, in screen pixels */
  x: number;
  y: number;
  story: string;
}

export const AREA_NAMES = ['WILDERNESS', 'TURTLE VILLAGE', 'STONE TOWN', 'FIENDS PATH', 'THE CASTLE'];

/** the journey, in order: the original's route from the wilderness down the coast to the castle */
export const ROUTE: Place[] = [
  { kind: 'area', area: 0, name: AREA_NAMES[0], x: 127, y: 33, story: 'OUR SWORN ENEMY DEATH ADDER IS IN HIS CASTLE. HIS MEN ROAM THESE WILD LANDS.' },
  { kind: 'camp', area: 0, name: 'FOREST CAMP', x: 106, y: 58, story: 'REST BY THE FIRE TO HEAL AND SAVE YOUR JOURNEY. BEWARE OF THIEVES.' },
  { kind: 'area', area: 1, name: AREA_NAMES[1], x: 120, y: 84, story: 'THE VILLAGE IS ON THE BACK OF A GIANT TURTLE.' },
  { kind: 'camp', area: 1, name: 'TURTLE CAMP', x: 134, y: 112, story: 'REST BY THE FIRE TO HEAL AND SAVE YOUR JOURNEY. BEWARE OF THIEVES.' },
  { kind: 'area', area: 2, name: AREA_NAMES[2], x: 132, y: 140, story: 'THE TURTLE TOOK US SOUTH, ACROSS THE SEA. THE WAY IS PACKED BY ENEMY LINES.' },
  { kind: 'camp', area: 2, name: 'COAST CAMP', x: 136, y: 168, story: 'REST BY THE FIRE TO HEAL AND SAVE YOUR JOURNEY. BEWARE OF THIEVES.' },
  { kind: 'area', area: 3, name: AREA_NAMES[3], x: 62, y: 170, story: 'THE FIENDS PATH WAS A GREAT GREAT EAGLE. IT TAKES US ACROSS THE SKIES.' },
  { kind: 'camp', area: 3, name: 'CLIFF CAMP', x: 58, y: 126, story: 'REST BY THE FIRE TO HEAL AND SAVE YOUR JOURNEY. BEWARE OF THIEVES.' },
  { kind: 'area', area: 4, name: AREA_NAMES[4], x: 75, y: 80, story: 'NOW THE FINAL BATTLE BEGINS.' },
];

/** the route's index of an area */
export function placeOf(area: number) {
  return ROUTE.findIndex((p) => p.kind === 'area' && p.area === area);
}

export class WorldMap {
  /** where the party stands (or last stood) on the route */
  at = 0;
  /** the place it's walking to, and its position on the way */
  private to = 0;
  private px: number;
  private py: number;
  /** which way it last walked: into an area from its left end (going on) or right (going back) */
  side: 'left' | 'right' = 'left';
  t = 0;
  /** a locked place the party just tried to walk to (shown with why), and for how long */
  private blocked = -1;
  private blockedTimer = 0;

  constructor(public cleared: Set<number>, at = 0, side: 'left' | 'right' = 'left') {
    this.at = this.to = at;
    this.side = side;
    [this.px, this.py] = [ROUTE[at].x, ROUTE[at].y];
  }

  /** Can the party go here? The first area, and anything past a beaten area (up to the next). */
  open(i: number) {
    const p = ROUTE[i];
    if (!p) return false;
    return p.kind === 'camp' ? this.cleared.has(p.area) : p.area === 0 || this.cleared.has(p.area - 1);
  }

  get moving() {
    return this.to !== this.at || this.px !== ROUTE[this.to].x || this.py !== ROUTE[this.to].y;
  }

  /** Walk the route; returns the place the party chooses to go into. */
  update(): Place | null {
    this.t++;
    if (this.blockedTimer > 0) this.blockedTimer--;
    if (this.t === 1) audio.music('map');
    const target = ROUTE[this.to];
    if (this.moving) {
      const dx = target.x - this.px, dy = target.y - this.py, d = Math.hypot(dx, dy);
      const step = 1.25;
      if (d <= step) {
        [this.px, this.py] = [target.x, target.y];
        this.at = this.to;
      } else {
        this.px += (dx / d) * step;
        this.py += (dy / d) * step;
      }
      return null;
    }
    // along the route: on (right / down) or back (left / up)
    const dir = input.pad.x || input.pad.y;
    if (dir && dir !== this.lastDir && this.t > 15) this.walk(this.at + dir);
    this.lastDir = dir;
    const tap = input.tapAt;
    if (tap) {
      const i = ROUTE.findIndex((p) => Math.hypot(p.x - tap.x, p.y - tap.y) < 12);
      if (i === this.at) return ROUTE[i];
      if (i >= 0) this.walk(this.at + Math.sign(i - this.at));
      else if (tap.x > 160 && tap.y > 180) return ROUTE[this.at];
    }
    const pr = input.pressed;
    if ((pr.attack || pr.start || pr.jump) && this.t > 15) return ROUTE[this.at];
    return null;
  }

  private lastDir = 0;

  private walk(i: number) {
    if (i < 0 || i >= ROUTE.length) return;
    if (!this.open(i)) {
      this.blocked = i;
      this.blockedTimer = 150;
      audio.sfx('knock');
      return;
    }
    this.blockedTimer = 0;
    this.side = i > this.at ? 'left' : 'right';
    this.to = i;
    audio.sfx('swing');
  }

  draw(party: { hero: number; prog: { level: number } }[]) {
    fillRect(0, 0, W, H, '#000');
    if (assets.world) ctx.drawImage(assets.world, 0, 0);
    // the route: walked stretches in red (as the original's quill drew it), the way on dotted
    // (the way not yet open faintly, so the whole journey can be seen)
    for (let i = 0; i + 1 < ROUTE.length; i++) {
      const a = ROUTE[i], b = ROUTE[i + 1];
      const open = this.open(i + 1);
      const done = open && this.cleared.has(b.area);
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
      for (let k = 1; k < n; k++) {
        if (!done && k % 2) continue;
        fillRect(Math.round(a.x + ((b.x - a.x) * k) / n), Math.round(a.y + ((b.y - a.y) * k) / n), 1, 1, open ? '#c00' : 'rgba(70,40,20,0.8)');
      }
    }
    ROUTE.forEach((p, i) => {
      if (!this.open(i)) {
        fillRect(p.x - 2, p.y - 2, 5, 5, 'rgba(60,40,20,0.6)');
        if (i === this.blocked && this.blockedTimer > 0 && (this.t >> 3) & 1) fillRect(p.x - 3, p.y - 3, 7, 7, 'rgba(255,60,60,0.6)');
        return;
      }
      const c = p.kind === 'camp' ? '#f80' : this.cleared.has(p.area) ? '#fd0' : '#e00';
      fillRect(p.x - 3, p.y - 3, 7, 7, '#200');
      fillRect(p.x - 2, p.y - 2, 5, 5, c);
      if (i === this.at && !this.moving && (this.t >> 4) & 1) fillRect(p.x - 4, p.y - 4, 9, 9, 'rgba(255,255,255,0.5)');
    });
    // the party: the leader's portrait walking the route
    const lead = party[0];
    if (lead) {
      ctx.save();
      ctx.translate(Math.round(this.px), Math.round(this.py) - 4 - ((this.t >> 3) & 1));
      ctx.scale(0.5, 0.5);
      drawSprite(HEROES[lead.hero].face, HEROES[lead.hero].pal, 0, 0, false);
      ctx.restore();
    }
    // the place: its name, what's known of it, and the party
    const p = ROUTE[this.moving ? this.to : this.at];
    const x0 = 166;
    drawText(p.name, x0, 12, p.kind === 'camp' ? '#f80' : '#ff0');
    const status = p.kind === 'camp' ? 'REST AND SAVE' : this.cleared.has(p.area) ? 'CLEARED' : 'DANGER';
    drawText(status, x0, 24, p.kind === 'camp' ? '#8cf' : this.cleared.has(p.area) ? '#4f4' : '#f44');
    wrap(p.story, 19).forEach((l, i) => drawText(l, x0, 42 + i * 11, '#aac'));
    // tried to go somewhere locked: what opens it
    if (this.blockedTimer > 0) {
      const b = ROUTE[this.blocked];
      const why = `THE WAY ON IS BLOCKED. DEFEAT THE BOSS OF ${AREA_NAMES[b.kind === 'camp' ? b.area : b.area - 1]} TO OPEN IT.`;
      wrap(why, 19).forEach((l, i) => drawText(l, x0, 110 + i * 11, '#f66'));
    }
    party.forEach((m, i) => drawText(`${HEROES[m.hero].name.split(' ')[0]} LV${m.prog.level}`, x0, 160 + i * 11, '#fff'));
    const help = input.touch ? ['TAP A PLACE TO GO', 'TAP HERE TO ENTER'] : ['ARROWS: TRAVEL', 'ATTACK: ENTER'];
    help.forEach((l, i) => drawText(l, x0, 192 + i * 11, '#8af'));
  }
}
