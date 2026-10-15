// Enemies: soldiers, giants and beasts. Each kind maps animation roles to its block of ROM
// scripts; one AI drives them all: close in on a hero, line up in depth, attack (the script's
// header decides what it hits, see Fighter.attackHits), then back off for a while.
import { audio } from '../audio';
import { Fighter, type Anims } from './fighter';
import type { Hero } from './hero';
import type { Stage } from './stage';
import { drawText, fillRect } from '../gfx';
import { enemyLevel, enemyHpScale, gainXp, xpFor } from './rpg';
import { FloatText } from './fx';
import { party, goldFor, lootItem, partyEvents, gearName, beastXp, GEAR_TIERS } from './party';
import { questEvent } from './quests';

export interface Kind {
  name: string;
  anims: Anims;
  hp: number;
  /** how far in front [near, far] the AI starts an attack from */
  reach: [number, number];
  /** walking speed (px/tick across; depth is 3/4 of it), measured from recordings */
  speed: number;
  /** can be grabbed and kneed/thrown */
  grabbable: boolean;
  /** body radius for spacing */
  size?: number;
  /** a riderless beast: waits to be mounted rather than fighting */
  mount?: boolean;
  /** the death scream (a key of audio's SND) */
  voice?: string;
}

const a = (o: Partial<Anims> & Pick<Anims, 'idle' | 'walk' | 'attacks' | 'hurt' | 'fly' | 'collapse' | 'getup' | 'lie'>): Anims => o as Anims;

export const KINDS: Record<string, Kind> = {
  heninger: {
    name: 'heninger', hp: 16, voice: 'die-heninger', reach: [8, 44], speed: 0.6, grabbable: true,
    anims: a({ idle: 0x199e0, walk: 0x19a04, walkUp: 0x19aac, run: 0x19b54, attacks: [0x19bfc, 0x19d20, 0x19d9a], jump: 0x19e3c, jumpAttack: 0x19e84, hurt: [0x19efe, 0x19f2e, 0x19f5e], collapse: 0x19f82, fly: 0x19fca, getup: 0x1a02a, lie: 0x1a07e }),
  },
  longmoan: {
    name: 'longmoan', hp: 16, voice: 'die-longmoan', reach: [8, 44], speed: 0.75, grabbable: true,
    anims: a({ idle: 0x1d522, walk: 0x1d546, walkUp: 0x1d5ee, run: 0x1d696, attacks: [0x1d73e, 0x1d8a2, 0x1d90c], jump: 0x1d9be, jumpAttack: 0x1da06, hurt: [0x1da80, 0x1dab0, 0x1dae0], collapse: 0x1db04, fly: 0x1db4c, getup: 0x1dbac, lie: 0x1dc18 }),
  },
  longmoanFast: {
    name: 'longmoan', hp: 16, voice: 'die-longmoan', reach: [8, 44], speed: 0.85, grabbable: true,
    anims: a({ idle: 0x1e8fc, walk: 0x1e920, walkUp: 0x1e9c8, run: 0x1ea70, attacks: [0x1eb18, 0x1ec7c, 0x1ece6], jump: 0x1ed98, jumpAttack: 0x1ede0, hurt: [0x1ee5a, 0x1ee8a, 0x1eeba], collapse: 0x1eede, fly: 0x1ef26, getup: 0x1ef86, lie: 0x1eff2 }),
  },
  amazon: {
    name: 'amazon', hp: 16, voice: 'die-amazon', reach: [8, 46], speed: 0.85, grabbable: true,
    anims: a({ idle: 0x224ba, walk: 0x224de, walkUp: 0x22586, run: 0x2262e, attacks: [0x226d6, 0x22760], jump: 0x227e2, hurt: [0x2282a, 0x2284e, 0x2287e], collapse: 0x228a2, fly: 0x228ea, getup: 0x2294a, lie: 0x2299e }),
  },
  skeleton: {
    name: 'skeleton', hp: 16, voice: 'die-skeleton', reach: [8, 46], speed: 0.8, grabbable: true,
    anims: a({ idle: 0x24a54, walk: 0x24a6c, walkUp: 0x24b14, run: 0x24bbc, attacks: [0x24c64, 0x24d68, 0x24eb6], jump: 0x2508e, jumpAttack: 0x250d6, hurt: [0x251ca, 0x251ee, 0x2521e], collapse: 0x2528a, fly: 0x2528a, getup: 0x252ea, lie: 0x2533e }),
  },
  badbro: {
    name: 'badbro', hp: 32, voice: 'die-big', reach: [10, 52], speed: 0.5, grabbable: false, size: 14,
    anims: a({ idle: 0x28daa, walk: 0x28dce, walkUp: 0x28e46, run: 0x28ebe, attacks: [0x28f66, 0x28fc6, 0x29090], hurt: [0x291ba, 0x291de], collapse: 0x2920e, fly: 0x29256, getup: 0x292b6, lie: 0x2930a }),
  },
  knight: {
    name: 'knight', hp: 32, voice: 'die-big', reach: [10, 52], speed: 0.9, grabbable: false, size: 12,
    anims: a({ idle: 0x2ac72, walk: 0x2ac96, walkUp: 0x2ad3e, attacks: [0x2ade6, 0x2ae60], hurt: [0x2af62, 0x2af86, 0x2afb6], collapse: 0x2afda, fly: 0x2afda, getup: 0x2b022, lie: 0x2b076 }),
  },
  adder: {
    name: 'adder', hp: 64, voice: 'die-big', reach: [10, 56], speed: 0.9, grabbable: false, size: 14,
    anims: a({ idle: 0x35c58, walk: 0x35c70, walkUp: 0x35d18, run: 0x35dc0, attacks: [0x35e14], hurt: [0x35f20, 0x35f44, 0x35f74], collapse: 0x35f98, fly: 0x35fe0, getup: 0x36028, lie: 0x36058 }),
  },
};

/** a skeleton climbing out of the ground */
const RISE = 0x24a00;

export class Enemy extends Fighter {
  isEnemy = true;
  anims: Anims;
  cooldown = 40;
  wait = 0;
  /** which side of its target it prefers */
  side = 1;
  target: Hero | null = null;
  attackIndex = 0;
  /** walk in from off screen before fighting */
  entering = true;
  /** how tough it is: health, damage and the experience it's worth grow with it */
  level: number;
  maxHp: number;
  /** ticks left stunned (by magic), and seconds left burning */
  stun = 0;
  burn = 0;
  burnDamage = 0;
  private burnTick = 0;
  /** ticks the health bar stays up after a hit */
  private barTimer = 0;
  private rewarded = false;
  /** a champion: tougher, glowing, and carrying treasure */
  champion = false;

  makeChampion() {
    this.champion = true;
    this.level += 2;
    this.hp = this.maxHp = Math.round(this.maxHp * 2.5);
    this.glow = '#fc0';
  }

  constructor(stage: Stage, public kind: Kind, x: number, z: number, pal: number) {
    super(stage);
    this.anims = kind.anims;
    this.x = x;
    this.z = z;
    this.y = this.ground;
    this.level = enemyLevel(stage.area);
    this.hp = this.maxHp = Math.round(kind.hp * enemyHpScale(this.level));
    this.pal = pal;
    this.radius = kind.size ?? 8;
    this.facing = x > 0x1000 - stage.camx + 160 ? -1 : 1;
    this.cooldown = 30 + Math.floor(Math.random() * 60);
    if (kind.mount) this.hostile = false;
    this.setState('stand', this.anims.idle);
  }

  get grabbable() {
    return this.kind.grabbable;
  }

  /** Climb out of the ground where it stands (skeletons: 0x24a00, past its standing first step). */
  rise() {
    this.entering = false;
    this.setState('rise', RISE);
    this.anim.go(1);
    this.cooldown = Math.max(this.cooldown, 30);
  }

  get vulnerable() {
    return this.state !== 'rise' && super.vulnerable;
  }

  update() {
    if (this.stage.frozen && this.stage.frozen !== this) return;
    if (this.barTimer > 0) this.barTimer--;
    this.updateBurn();
    if (this.updateCommon()) return;
    // stunned: stands dazed, flashing
    if (this.stun > 0 && (this.state === 'stand' || this.state === 'walk' || this.state === 'run')) {
      this.stun--;
      if (this.state !== 'stand') this.setState('stand', this.anims.idle);
      if (this.stun % 16 === 0) this.flash = 3;
      return;
    }
    if (this.kind.mount) {
      this.anim.tick();
      return;
    }
    const heroes = this.stage.heroes.filter((h) => !h.dead && h.state !== 'respawn' && h.state !== 'gameover');
    if (!heroes.length) {
      this.setState('stand', this.anims.idle, false);
      this.anim.tick();
      return;
    }
    if (!this.target || !heroes.includes(this.target)) this.target = heroes[Math.floor(Math.random() * heroes.length)];
    const h = this.target;
    if (this.cooldown > 0) this.cooldown--;
    switch (this.state) {
      case 'stand':
      case 'walk': {
        const dx = h.x - this.x, dz = h.z - this.z;
        this.side = dx > 0 ? -1 : 1;
        // keep a spot at attack distance on our side of the hero, unless cooling down
        const reach = this.kind.reach;
        // a hero up on a ledge (or down off one) can't be hit from here: close in, to jump up to them
        const level = Math.abs(h.ground - this.ground) <= 12 || h.airborne;
        const want = !level ? 0 : this.cooldown > 0 ? reach[1] + 28 : (reach[0] + reach[1]) / 2;
        // take the other side of the hero if ours is off screen
        const scr = (x: number) => x - 0x1000 + this.stage.camx + 8;
        if (scr(h.x + this.side * want) > 300 || scr(h.x + this.side * want) < 20) this.side = -this.side;
        const tx = h.x + this.side * want, tz = h.z;
        let mx = Math.abs(tx - this.x) > 3 ? Math.sign(tx - this.x) : 0;
        let mz = Math.abs(tz - this.z) > 2 ? Math.sign(tz - this.z) : 0;
        // stay inside the screen once we have entered it
        const sx = this.x - 0x1000 + this.stage.camx + 8;
        if (sx > 20 && sx < 300) this.entering = false;
        if (!this.entering && ((sx < 12 && mx < 0) || (sx > 308 && mx > 0))) mx = 0;
        // far off but level with the hero: run in at 3px/tick, as the originals do
        if (level && this.anims.run && Math.abs(tx - this.x) > 90 && Math.abs(dz) < 6 && !this.entering && this.cooldown <= 0) {
          this.setState('run', this.anims.run);
          this.facing = tx > this.x ? 1 : -1;
          break;
        }
        if (mx || mz) {
          const ox = this.x, oz = this.z;
          this.move(mx * this.kind.speed, mz * this.kind.speed * 0.75);
          // walked off an edge: drop; blocked by a ledge it could clear: jump up
          if (this.ground > this.y + 4) {
            this.setState('drop', this.anims.jump ?? this.anims.hurt[0]);
            if (this.anims.jump) this.anim.go(3);
            break;
          }
          // (blocked one way while still sliding the other counts: a ledge along the depth)
          const bx = mx && this.x === ox ? mx : 0, bz = mz && this.z === oz ? mz : 0;
          if ((bx || bz) && this.anims.jump) {
            const ahead = this.stage.groundAt(this.x + bx * 12, this.z + bz * 12);
            if (ahead < this.y - 12 && ahead > this.y - 72) {
              mx = bx;
              mz = bz;
              this.setState('leap', this.anims.jump);
              this.vx = mx * 1.2;
              this.vz = mz * 0.8;
              break;
            }
          }
          this.facing = dx > 0 ? 1 : -1;
          if (this.state !== 'walk') this.setState('walk', mz < 0 && !mx ? this.anims.walkUp ?? this.anims.walk : this.anims.walk);
          this.anim.tick();
        } else {
          this.facing = dx > 0 ? 1 : -1;
          if (this.state !== 'stand') this.setState('stand', this.anims.idle);
          this.anim.tick();
        }
        const rel = (h.x - this.x) * this.facing;
        if (level && this.cooldown <= 0 && rel >= reach[0] - 4 && rel <= reach[1] && Math.abs(dz) < 6 && !h.airborne) {
          this.wait++;
          if (this.wait > 6) {
            this.wait = 0;
            this.attackIndex = Math.floor(Math.random() * this.anims.attacks.length);
            this.setState('attack');
            this.playMove(this.anims.attacks[this.attackIndex]);
            audio.sfx('grunt');
          }
        }
        break;
      }
      case 'run': {
        this.anim.tick();
        const ox = this.x;
        this.move(this.facing * 3, 0);
        const rel = (h.x - this.x) * this.facing;
        if (this.x === ox || rel < this.kind.reach[1] - 6 || Math.abs(h.z - this.z) > 10 || this.t > 120) {
          // arrive swinging when in reach
          if (rel >= this.kind.reach[0] && rel <= this.kind.reach[1] && Math.abs(h.z - this.z) < 8) {
            this.attackIndex = 0;
            this.setState('attack');
            this.playMove(this.anims.attacks[0]);
            audio.sfx('grunt');
          } else this.setState('stand', this.anims.idle);
        }
        break;
      }
      case 'rise':
        this.anim.tick();
        if (this.anim.looped) this.setState('stand', this.anims.idle);
        break;
      case 'leap':
        // the jump script: crouch, then rise and fall frames
        if (this.t < 12) { this.anim.tick(); break; }
        if (this.t === 12) this.vy = -6.5;
        this.anim.go(this.vy < 0 ? 2 : 3);
        if (this.physics()) { this.vx = this.vz = 0; this.setState('stand', this.anims.idle); }
        break;
      case 'drop':
        if (this.physics()) { this.vx = this.vz = 0; this.setState('stand', this.anims.idle); }
        if (this.y > 0x1480) this.gone = true;
        break;
      case 'attack': {
        this.anim.tick();
        // a hero on a beast is hit through it (and knocked off)
        if (this.attackHits(this.stage.heroes.map((o) => o.mount ?? o)).length) audio.sfx('hurt');
        if (this.anim.looped || this.t > 90) {
          this.cooldown = 50 + Math.floor(Math.random() * 70);
          this.setState('stand', this.anims.idle);
        }
        break;
      }
    }
  }

  onHit() {
    this.cooldown = Math.max(this.cooldown, 24);
  }

  /** burning: a little damage every second, without flinching */
  private updateBurn() {
    if (this.burn <= 0 || this.dead) return;
    if (++this.burnTick < 60) return;
    this.burnTick = 0;
    this.burn--;
    if (this.hp <= 0) return;
    this.wound(null, this.burnDamage, 'burn');
    this.barTimer = 120;
    if (this.hp <= 0 && !['fly', 'down', 'dying'].includes(this.state)) this.knockDown(this.facing > 0 ? -1 : 1, 1, 3);
  }

  wound(...args: Parameters<Fighter['wound']>) {
    this.barTimer = 120;
    return super.wound(...args);
  }

  /** The party shares the experience (and a beast that carried the blow learns from it). */
  onKilled(by: Fighter | null) {
    if (this.rewarded || !this.hostile) return;
    this.rewarded = true;
    const xp = xpFor(this) * (this.champion ? 3 : 1);
    const rider = (by as Hero | null)?.isHero ? (by as Hero) : null;
    if (rider?.mount) beastXp(rider.mount.type, xp);
    for (const h of this.stage.heroes) if (h.state !== 'gameover') gainXp(h, xp);
    this.stage.actors.push(new FloatText(this.stage, this, `+${xp} XP`, '#8f8', 72, 60));
    questEvent({ kind: 'kill', foe: this.kind.name });
    const gold = goldFor(this.level, !this.kind.grabbable || this.champion);
    party.gold += gold;
    this.stage.actors.push(new FloatText(this.stage, this, `+${gold}G`, '#fd0', 84, 60));
    if (this.champion) this.loot();
  }

  /** A champion's treasure: something for the bag, and now and then better gear for a hero. */
  private loot() {
    const item = lootItem();
    party.bag[item.id]++;
    this.stage.actors.push(new FloatText(this.stage, this, item.name, '#8cf', 96, 75));
    if (Math.random() > 0.35) return;
    // gear a tier up, no better than this part of the journey warrants
    const best = Math.min(GEAR_TIERS - 1, this.stage.area + 1);
    const options = this.stage.heroes.flatMap((h) => [
      ...(h.prog.weapon < best ? [{ h, slot: 'weapon' as const }] : []),
      ...(h.prog.armour < best ? [{ h, slot: 'armour' as const }] : []),
    ]);
    const pick = options[Math.floor(Math.random() * options.length)];
    if (!pick) return;
    const tier = (pick.slot === 'weapon' ? pick.h.prog.weapon : pick.h.prog.armour) + 1;
    if (pick.slot === 'weapon') pick.h.prog.weapon = tier;
    else pick.h.prog.armour = tier;
    partyEvents.found(`FOUND ${gearName(pick.slot, pick.h.index, tier)} FOR ${pick.h.def.name.split(' ')[0]}`);
  }

  draw() {
    super.draw();
    // a health bar over its head for a while after each hit (always, for a champion)
    if ((this.barTimer <= 0 && !this.champion) || this.dead || this.hp <= 0) return;
    const [sx, sy] = this.screen();
    const w = 24, x = Math.round(sx - w / 2), y = Math.round(sy + this.box()[2] - this.y - 8);
    if (this.champion) drawText('CHAMPION', sx, y - 10, '#fc0', 'center');
    fillRect(x - 1, y - 1, w + 2, 4, '#000');
    fillRect(x, y, Math.max(1, Math.round((w * this.hp) / this.maxHp)), 2, this.stun > 0 ? '#8cf' : this.burn > 0 ? '#f80' : '#e22');
  }

  /** knocked flying: the whoosh, and the kind's scream if the blow killed */
  cry() {
    audio.sfx('knock');
    if (this.hp <= 0 && this.kind.voice) audio.sfx(this.kind.voice);
  }

  die() {
    super.die();
  }
}
