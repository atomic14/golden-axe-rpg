// One area of the game: its background layers, height map, camera and the spawn script.
// The camera follows the original's conventions: an object at x is drawn at
// x - 0x1000 + camx + 8, and progress (0xffed32) = 0x1000 - camx - 7.
import { decode8, loadArea, hdArea, loadHdArea, type AreaData } from '../assets';
import { ctx, renderLayer, scale, tilePalette, W, H, type TileLayer } from '../gfx';
import type { Actor } from './actor';
import { spawnActor, isFoe } from './spawn';
import type { Hero } from './hero';
import { Fighter } from './fighter';
import { assets } from '../assets';
import { MagicEffect } from './magic';
import { Enemy, KINDS } from './enemy';
import { SPELLS, spellDamage } from './rpg';
import { FloatText } from './fx';

export const END = 0x14c0;

export class Stage {
  data!: AreaData;
  height!: Uint8Array;
  fg!: TileLayer;
  bg!: TileLayer;
  camx = -71;
  camy = -704;
  time = 0;
  actors: Actor[] = [];
  heroes: Hero[] = [];
  /** index of the next scroll stop */
  stopIndex = 0;
  spawnIndex = 0;
  /** displayed stage number (the HUD's "STAGE n") */
  shown = 1;
  private paletteKey = '';
  /** frames since the last enemy was seen, for releasing scroll stops */
  clearTimer = 0;
  /** while a hero casts magic everything else stands still */
  frozen: Actor | null = null;
  private frozenTimer = 0;
  /** screen flash and shake for magic */
  flashTimer = 0;


  /**
   * Roaming (the RPG): the camera follows the heroes both ways and holds still while they fight,
   * and away from the area's scripted fights enemies turn up as random encounters.
   */
  roam = true;
  /** the area's scripted fights still play (its first visit) */
  scripted = true;
  /** the spawn script's ordinary foes (not its boss wave), for random encounters */
  table: [number, number, number, number, number][] = [];
  /** camera travel since the last fight, and how far until the next */
  private travel = 0;
  private nextEncounter = 0;
  /** which way the camera last moved: 1 right, -1 left */
  heading = 1;

  constructor(public area: number) {}

  async load() {
    this.data = await loadArea(this.area);
    this.height = decode8(this.data.height);
    const stages = Object.keys(this.data.palettes).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
    this.shown = stages[0];
    this.camx = this.data.cam[1][0];
    this.camy = this.camYRange(this.camx)[0];
    if (scale > 1) await loadHdArea(this.area);
    this.buildLayers();
    this.table = this.data.spawns.filter((e) => e[0] < END - 0x40 && isFoe(e[4]));
    this.nextEncounter = this.encounterGap();
  }

  /** the camera's limits: [rightmost, leftmost] (camx falls as the view moves right) */
  get camLimits(): [number, number] {
    return [this.data.cam[0][0], this.data.cam[1][0]];
  }

  /** world x of the screen's left edge */
  get left() {
    return 0x1000 - this.camx - 8;
  }

  /** A fight is on: a living foe in or near the view. */
  get engaged() {
    return this.actors.some((a) => {
      if (!a.isEnemy || !a.hostile || a.dead || a.gone) return false;
      const sx = a.x - this.left;
      return sx > -48 && sx < 368;
    });
  }

  private encounterGap() {
    return 360 + Math.floor(Math.random() * 360);
  }

  /** Follow the player both ways (with a little slack), but never while a fight is on. */
  private roamCamera(lead: Hero | undefined) {
    if (!lead || this.engaged) return;
    const sx = (lead.mount ?? lead).x - this.left;
    let want = this.camx;
    if (sx > 176) want = this.camx - (sx - 176);
    else if (sx < 144) want = this.camx + (144 - sx);
    const [lo, hi] = this.camLimits;
    want = Math.max(lo, Math.min(hi, want));
    const d = Math.round(Math.max(-6, Math.min(6, want - this.camx)));
    if (!d) return;
    this.camx += d;
    this.heading = d < 0 ? 1 : -1;
    // the scripted fights still to come keep random ones away
    const next = this.scripted ? this.data.spawns[this.spawnIndex] : undefined;
    if (!next || next[0] > this.progress + 0x180) this.travel += Math.abs(d);
  }

  /** A random encounter: a few of the area's own foes walk in from the way the heroes are going. */
  private encounter() {
    if (this.travel < this.nextEncounter || this.frozen || this.engaged) return;
    this.travel = 0;
    this.nextEncounter = this.encounterGap();
    const pool = this.table.length ? this.table : [[0, 0, 0, 0, 0x18b28] as [number, number, number, number, number]];
    const n = 1 + Math.floor(Math.random() * Math.min(3, 2 + this.area));
    const lead = this.heroes.find((h) => !h.cpu) ?? this.heroes[0];
    for (let i = 0; i < n; i++) {
      // mostly from ahead, now and then from behind
      const side = Math.random() < 0.75 ? this.heading : -this.heading;
      for (const dir of [side, -side]) {
        const x = dir > 0 ? this.left + 340 + i * 20 : this.left - 20 - i * 20;
        const z = this.floorZ(x, (lead?.z ?? 0x1080) + Math.floor(Math.random() * 40) - 20);
        const g = this.groundAt(x, z);
        if (g <= 0xf00 || g >= 0x1480) continue;
        const [, , , param, init] = pool[Math.floor(Math.random() * pool.length)];
        const a = spawnActor(this, init, x, z, param);
        if (a) this.actors.push(a);
        break;
      }
    }
  }

  /** night falls for the bonus camp */
  camp = false;
  boss = false;

  buildLayers() {
    // palettes: the action stage, its boss fight (key 100 + stage, the sky turns) and the camp (0)
    const p = this.data.palettes;
    const key = this.camp && p['0'] ? '0' : this.boss && p[String(100 + this.shown)] ? String(100 + this.shown) : String(this.shown);
    // with HD art on, the AI-upscaled layers (when this area has them)
    const hd = scale > 1 ? hdArea.get(this.area) : undefined;
    if (key + !!hd === this.paletteKey) return;
    this.paletteKey = key + !!hd;
    const pal = tilePalette(this.data.palettes[key] ?? Object.values(this.data.palettes)[0]);
    this.bg = renderLayer(this.data.bg, pal, true, hd?.bg);
    this.fg = renderLayer(this.data.fg, pal, false, hd?.fg);
  }

  get progress() {
    return 0x1000 - this.camx - 7;
  }

  /** Ground height under (x, z); outside the map is wall. */
  groundAt(x: number, z: number): number {
    const c = (x - 0x1000) >> 3, r = (z - 0xf80) >> 3;
    if (c < 0 || c > 255 || r < 0 || r > 63) return 0xe00;
    return this.height[c * 64 + r] * 8 + 0xe00;
  }

  /** The nearest depth to z with walkable floor at x. */
  floorZ(x: number, z: number): number {
    for (let d = 0; d < 96; d += 2) {
      for (const zz of [z + d, z - d]) {
        const g = this.groundAt(x, zz);
        if (g > 0xf00 && g < 0x1480 && this.groundAt(x, zz + 6) === g && this.groundAt(x, zz - 6) === g) return zz;
      }
    }
    return z;
  }

  project(x: number, z: number, y: number): [number, number] {
    const zz = z - 0x1000;
    return [x - 0x1000 + this.camx + 8, zz - Math.floor(zz / 4) + (y - 0x1000) + this.camy];
  }

  /** The camera's vertical range at a horizontal position, from the original's camera path. */
  camYRange(camx: number): [number, number] {
    const p = this.data.camPath;
    const k = camx >> 3;
    for (let d = 0; d < 64; d++) {
      const e = p[k + d] ?? p[k - d];
      if (e) return e;
    }
    return [this.data.cam[0][1], this.data.cam[1][1]];
  }

  get enemiesAlive() {
    return this.actors.some((a) => a.isEnemy && a.hostile && !a.dead && !a.gone);
  }

  /**
   * The original's hidden timer (0xffeca6): 60 seconds that only run out if the heroes go a minute
   * without landing a blow (each hit tops it back up). Then two skeletons turn up (0xc20e).
   */
  timer = 60 * 60;
  private refill = false;
  heroHit() {
    this.refill = true;
  }
  private updateTimer() {
    if (this.frozen || this.roam) return;
    if (this.refill) {
      this.timer = Math.min(3600, this.timer + 15);
      if (this.timer >= 3600) this.refill = false;
    } else this.timer--;
    if (this.timer > 0) return;
    this.timer = 3600;
    for (const dx of [0x80, 0xc0]) {
      const x = this.progress + dx;
      const e = new Enemy(this, KINDS.skeleton, x, this.floorZ(x, 0x1070), 0x73);
      e.entering = false;
      this.actors.push(e);
    }
  }

  freezeFor(n: number, who: Actor) {
    this.frozen = who;
    this.frozenTimer = n;
  }

  /** Start a hero's spell: the original's effect replayed around them, then damage at its peak. */
  castMagic(h: Hero, spell: number): number {
    const names = ['ax', 'tyris', 'gilius'];
    const ticks = assets.magic[names[h.index]]?.[SPELLS[h.index][spell].tier - 1] ?? [];
    const fx = new MagicEffect(this, h, ticks, spell);
    this.actors.push(fx);
    this.freezeFor(fx.length, h);
    return fx.length;
  }

  /** A spell lands: damage (and burning or stunning) for the foes in its reach; some heal. */
  magicDamage(h: Hero, index: number) {
    const spell = SPELLS[h.index][index];
    const dmg = spellDamage(h, spell, index);
    for (const a of this.actors) {
      if (!a.isEnemy || !(a instanceof Fighter) || !a.vulnerable || !a.hostile) continue;
      const sx = a.x - this.left;
      if (sx < -20 || sx > 340) continue;
      if (spell.radius && Math.hypot(a.x - h.x, (a.z - h.z) * 2) > spell.radius) continue;
      a.wound(h, dmg, 'magic');
      a.flash = 6;
      if (a instanceof Enemy) {
        if (spell.burn) {
          a.burn = spell.burn;
          a.burnDamage = Math.max(1, Math.round(dmg * 0.12));
        }
        if (spell.stun && a.hp > 0) a.stun = spell.stun;
      }
      // stunning spells leave them standing, dazed; the rest knock them flying
      if (!spell.stun || a.hp <= 0) a.knockDown(a.x > h.x ? 1 : -1, 1.5, 4);
    }
    if (spell.heal) {
      for (const o of this.heroes) {
        if (o.dead || o.state === 'gameover') continue;
        const n = Math.round(o.maxHp * spell.heal);
        o.hp = Math.min(o.maxHp, o.hp + n);
        this.actors.push(new FloatText(this, o, `+${n}`, '#4f4'));
      }
    }
  }

  update() {
    this.time++;
    if (this.flashTimer > 0) this.flashTimer--;
    if (this.frozenTimer > 0 && --this.frozenTimer === 0) this.frozen = null;
    this.updateTimer();
    // scroll: keep the leading hero around screen x 160, never back, never past the next stop
    const stop = this.data.stops[this.stopIndex] ?? END;
    // (people drive the camera: a computer partner gets carried along)
    const people = this.heroes.filter((h) => !h.cpu && !h.gone && h.state !== 'respawn' && h.state !== 'gameover');
    const drivers = people.length ? people : this.heroes.filter((h) => !h.gone);
    const lead = drivers.reduce((m, h) => Math.max(m, h.x), 0);
    if (this.roam) this.roamCamera(drivers[0]);
    else if (lead) {
      const sx = lead - 0x1000 + this.camx + 8;
      if (sx > 160) {
        const maxCam = 0x1000 - 7 - stop; // camx at the stop
        this.camx = Math.max(maxCam, this.camx - Math.min(4, sx - 160));
      }
    }
    // release the stop once its enemies are dealt with
    if (!this.roam && this.progress >= stop) {
      const pending = this.data.spawns.slice(this.spawnIndex).some((s) => s[0] <= stop);
      this.clearTimer = this.enemiesAlive || pending ? 0 : this.clearTimer + 1;
      if (this.clearTimer > 30 && this.stopIndex < this.data.stops.length - 1) this.stopIndex++;
    }
    // vertical camera: follow the hero within the range the original used here
    const [lo, hi] = this.camYRange(this.camx);
    const h = drivers[0];
    if (h) {
      const zz = h.z - 0x1000;
      const want = 150 - (zz - Math.floor(zz / 4) + (Math.min(h.y, h.ground) - 0x1000));
      const target = Math.max(lo, Math.min(hi, want));
      this.camy += Math.max(-2, Math.min(2, target - this.camy));
    }
    // spawns
    const sp = this.data.spawns;
    if (!this.scripted) this.spawnIndex = sp.length;
    if (this.roam) this.encounter();
    while (this.spawnIndex < sp.length && this.progress >= sp[this.spawnIndex][0]) {
      const [, x, z, param, init] = sp[this.spawnIndex++];
      const a = spawnActor(this, init, x, z, param);
      if (a) this.actors.push(a);
    }
    // the boss fight at the end of the area: the sky changes
    if (this.progress >= END && !this.boss && this.scripted) {
      this.boss = true;
      this.buildLayers();
    }
    for (const a of this.actors) if (!a.gone) a.update();
    // roaming: foes left far behind wander off
    if (this.roam) {
      for (const a of this.actors) {
        const sx = a.x - this.left;
        if (a.isEnemy && (sx < -360 || sx > 680)) a.gone = true;
      }
    }
    this.actors = this.actors.filter((a) => !a.gone);
  }

  draw() {
    const fgU = -7 - this.camx, fgV = -512 - this.camy;
    const [[ax, bx], [ay, by]] = this.data.parallax;
    const bgU = Math.floor(ax * fgU + bx), bgV = Math.floor(ay * fgV + by);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const layer = (c: HTMLCanvasElement, l: TileLayer, x: number, y: number) => ctx.drawImage(c, x, y, c.width / l.scale, c.height / l.scale);
    layer(this.bg.low, this.bg, Math.round(this.bg.x - bgU), Math.round(this.bg.y - bgV));
    const fx = Math.round(this.fg.x - fgU), fy = Math.round(this.fg.y - fgV);
    layer(this.fg.low, this.fg, fx, fy);
    const order = [...this.actors].sort((a, b) => a.z - b.z || b.y - a.y);
    for (const a of order) a.draw();
    if (this.fg.high) layer(this.fg.high, this.fg, fx, fy);
    if (this.flashTimer > 0 && this.flashTimer % 8 < 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 0, W, H);
    }
  }
}

