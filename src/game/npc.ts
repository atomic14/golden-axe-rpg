// People to talk to in the towns (once freed): villagers drawn with the original's villager
// sprites, and gnome thieves turned traders.
import { drawText } from '../gfx';
import { Actor } from './actor';
import type { Stage } from './stage';
import type { Hero } from './hero';

export interface NpcDef {
  name: string;
  /** the animation script to show (villagers have only their running; the first frame stands) */
  anim: number;
  pal: number;
  /** where along the area, in px from its left end, and how far back or forward of the middle */
  x: number;
  z?: number;
  /** scripts that loop in place (sitting, the gnomes' shuffle) play; running ones hold a frame */
  animate?: boolean;
  /** what they say when spoken to */
  lines: string[];
  /** a trader: the shop's name and the best gear tier it stocks */
  shop?: { name: string; tiers: number };
  /** a quest they give (story.ts) */
  quest?: string;
}

export const TALK_RANGE = 34;

export class Npc extends Actor {
  hostile = false;

  constructor(stage: Stage, public def: NpcDef) {
    super(stage);
    this.x = 0x1000 + def.x;
    this.z = stage.floorZ(this.x, 0x1080 + (def.z ?? 0));
    this.y = this.ground;
    this.pal = def.pal;
    this.anim.set(def.anim);
    this.facing = -1;
  }

  /** can this hero talk to them? */
  near(h: Hero) {
    return !h.dead && Math.abs(h.x - this.x) < TALK_RANGE && Math.abs(h.z - this.z) < 14;
  }

  update() {
    if (this.def.animate) this.anim.tick();
    // turn to face whoever comes close
    const h = this.stage.heroes.find((o) => !o.cpu) ?? this.stage.heroes[0];
    if (h && Math.abs(h.x - this.x) < 80) this.facing = h.x > this.x ? 1 : -1;
  }

  draw() {
    super.draw();
    const h = this.stage.heroes.find((o) => !o.cpu);
    if (h && this.near(h) && !this.stage.engaged) {
      const [sx, sy] = this.screen();
      drawText(this.def.shop ? 'SHOP' : 'TALK', sx, sy - 74, (this.stage.time >> 4) & 1 ? '#ff0' : '#fff', 'center');
    }
  }
}
