// The RPG rules: levels and experience, the three skill trees each hero grows (Weapon, Element,
// Survival), the spells, and the damage sums. The fighting engine keeps the original's raw
// damage (2-8 a blow from each script's header); everything here scales it.
import type { Fighter } from './fighter';
import type { Hero } from './hero';
import type { Enemy } from './enemy';

/** the original's damage and health, multiplied up to RPG-sized numbers */
export const POINTS = 5;

export const MAX_LEVEL = 30;
/** experience needed to go from `level` to the next */
export function xpToNext(level: number) {
  return Math.round(40 * Math.pow(level, 1.5));
}
/** hero level each row of a skill tree opens at */
export const ROW_LEVEL = [1, 2, 4, 6, 8, 10];

export type Branch = 0 | 1 | 2;
export const BRANCHES = ['WEAPON', 'ELEMENT', 'SURVIVAL'];

export interface Skill {
  id: string;
  name: string;
  /** one-line description for the menu (what each rank gives) */
  desc: string;
  ranks: number;
  branch: Branch;
  row: number;
  /** an Element skill: the spell tier it teaches (1 = the hero's first) */
  spell?: number;
}

export interface Spell {
  name: string;
  /** the original's magic level whose effect it replays */
  tier: number;
  mp: number;
  /** damage at rank 1, before level scaling */
  dmg: number;
  /** reach from the caster in px; 0 is the whole screen */
  radius: number;
  /** seconds of burning */
  burn?: number;
  /** ticks stunned */
  stun?: number;
  /** heals the party by this share of their health */
  heal?: number;
}

const ELEMENT = ['EARTH', 'FIRE', 'THUNDER'];
export function elementOf(hero: number) {
  return ELEMENT[hero];
}

/** Each hero's spells, one per magic level of the original, in order. */
export const SPELLS: Spell[][] = [
  // Ax Battler: earth
  [
    { name: 'TREMOR', tier: 1, mp: 8, dmg: 20, radius: 110, stun: 60 },
    { name: 'ROCKSLIDE', tier: 2, mp: 14, dmg: 45, radius: 0, stun: 90 },
    { name: 'QUAKE', tier: 3, mp: 22, dmg: 95, radius: 0 },
    { name: 'VOLCANO', tier: 4, mp: 32, dmg: 150, radius: 0, heal: 0.3 },
  ],
  // Tyris Flare: fire
  [
    { name: 'EMBER', tier: 1, mp: 6, dmg: 20, radius: 100, burn: 3 },
    { name: 'FLAME WALL', tier: 2, mp: 10, dmg: 35, radius: 160, burn: 4 },
    { name: 'FIRESTORM', tier: 3, mp: 16, dmg: 70, radius: 0, burn: 3 },
    { name: 'PILLARS', tier: 4, mp: 22, dmg: 100, radius: 0, burn: 4 },
    { name: 'HELLFIRE', tier: 5, mp: 30, dmg: 150, radius: 0, burn: 5 },
    { name: 'FIRE DRAGON', tier: 6, mp: 40, dmg: 240, radius: 0, burn: 6 },
  ],
  // Gilius Thunderhead: thunder
  [
    { name: 'SPARK', tier: 1, mp: 8, dmg: 30, radius: 120, stun: 90 },
    { name: 'THUNDER', tier: 2, mp: 16, dmg: 80, radius: 0, stun: 120 },
    { name: 'STORM', tier: 3, mp: 28, dmg: 170, radius: 0, stun: 150 },
  ],
];

function describe(s: Spell) {
  const fx = [s.radius ? 'NEAR' : 'ALL ON SCREEN', s.burn ? `BURNS ${s.burn}S` : '', s.stun ? 'STUNS' : '', s.heal ? 'HEALS PARTY' : '']
    .filter(Boolean).join(', ');
  return `${s.mp} MP. ${fx}. RANK 2: +40%`;
}

const WEAPON: Skill[] = [
  { id: 'power', name: 'POWER STRIKE', desc: '+15% MELEE DAMAGE A RANK', ranks: 3, branch: 0, row: 0 },
  { id: 'crit', name: 'KEEN EYE', desc: '+7% CRITICAL CHANCE A RANK', ranks: 3, branch: 0, row: 1 },
  { id: 'whirl', name: 'WHIRLWIND', desc: 'BACK ATTACKS DO DOUBLE AND KNOCK DOWN', ranks: 1, branch: 0, row: 2 },
  { id: 'charge', name: 'CHARGE', desc: 'DASH ATTACKS +50% A RANK, ALWAYS KNOCK DOWN', ranks: 2, branch: 0, row: 3 },
  { id: 'grip', name: 'IRON GRIP', desc: 'KNEES AND THROWS +50% A RANK', ranks: 2, branch: 0, row: 4 },
  { id: 'blood', name: 'BLOODLUST', desc: 'HEAL 8% OF MELEE DAMAGE A RANK', ranks: 2, branch: 0, row: 5 },
];

const SURVIVAL: Skill[] = [
  { id: 'vit', name: 'VITALITY', desc: '+40 MAX HP A RANK', ranks: 3, branch: 2, row: 0 },
  { id: 'tough', name: 'TOUGHNESS', desc: '-8% DAMAGE TAKEN A RANK', ranks: 3, branch: 2, row: 1 },
  { id: 'medit', name: 'MEDITATION', desc: '+10 MAX MP, +50% MP REGEN A RANK', ranks: 2, branch: 2, row: 2 },
  { id: 'wind', name: 'SECOND WIND', desc: 'REGAIN HEALTH WHEN NO FIGHT IS ON', ranks: 1, branch: 2, row: 3 },
  { id: 'beast', name: 'BEAST MASTER', desc: 'MOUNTED: +40% DAMAGE, -25% TAKEN A RANK', ranks: 2, branch: 2, row: 4 },
  { id: 'stand', name: 'LAST STAND', desc: 'SURVIVE A DEADLY BLOW (ONCE A MINUTE)', ranks: 1, branch: 2, row: 5 },
];

/** A hero's whole tree: Weapon and Survival are shared, Element is their own spells. */
export function treeOf(hero: number): Skill[] {
  const element = SPELLS[hero].map((s, i): Skill => ({
    id: `spell${i}`, name: s.name, desc: describe(s), ranks: 2, branch: 1, row: i, spell: s.tier,
  }));
  return [...WEAPON, ...element, ...SURVIVAL];
}

export interface ProgressData {
  level: number;
  xp: number;
  points: number;
  ranks: Record<string, number>;
  mp: number;
  spell: number;
}

/** What a hero has grown into: kept apart from the fighter so it carries between areas. */
export class Progress {
  level = 1;
  xp = 0;
  points = 0;
  /** skill id -> rank */
  ranks: Record<string, number> = { spell0: 1 };
  mp = 20;
  /** the equipped spell: an index into the hero's SPELLS */
  spell = 0;
  /** ticks until Last Stand can save them again */
  standCooldown = 0;
  /** fractional regeneration carried between ticks */
  mpRegen = 0;
  hpRegen = 0;

  constructor(public hero: number) {}

  /** what a save game keeps */
  snapshot(): ProgressData {
    const { level, xp, points, ranks, mp, spell } = this;
    return { level, xp, points, ranks: { ...ranks }, mp, spell };
  }

  restore(d: ProgressData) {
    Object.assign(this, { level: d.level, xp: d.xp, points: d.points, ranks: { ...d.ranks }, mp: d.mp, spell: d.spell });
  }

  rank(id: string) {
    return this.ranks[id] ?? 0;
  }

  get maxMp() {
    return 20 + 3 * (this.level - 1) + 10 * this.rank('medit');
  }

  maxHp() {
    return 48 * POINTS + 30 * (this.level - 1) + 40 * this.rank('vit');
  }

  /** the spells learned so far (indices into SPELLS) */
  get spells(): number[] {
    return SPELLS[this.hero].map((_, i) => i).filter((i) => this.rank(`spell${i}`) > 0);
  }

  /** Can this skill take another rank now? */
  canLearn(s: Skill): boolean {
    if (this.points <= 0 || this.rank(s.id) >= s.ranks || this.level < ROW_LEVEL[s.row]) return false;
    if (s.row === 0) return true;
    const above = treeOf(this.hero).find((o) => o.branch === s.branch && o.row === s.row - 1);
    return !above || this.rank(above.id) > 0;
  }

  learn(s: Skill): boolean {
    if (!this.canLearn(s)) return false;
    this.ranks[s.id] = this.rank(s.id) + 1;
    this.points--;
    // a newly learned spell is equipped straight away
    if (s.spell && this.rank(s.id) === 1) this.spell = s.spell - 1;
    return true;
  }

  /** Spend points the way a computer partner would: spells first, then alternate the others. */
  autoSpend() {
    const tree = treeOf(this.hero);
    const order = (s: Skill) => (s.branch === 1 ? 0 : 1) * 100 + s.row * 3 + this.rank(s.id) * 20 + s.branch;
    while (this.points > 0) {
      const next = tree.filter((s) => this.canLearn(s)).sort((a, b) => order(a) - order(b))[0];
      if (!next) break;
      this.learn(next);
    }
    // the computer casts its strongest spell
    const spells = this.spells;
    this.spell = spells[spells.length - 1] ?? 0;
  }
}

/** Raised by the rules for the game to show (a level up, a skill point to spend). */
export const events = {
  levelUp: (_h: Hero) => {},
};

/** Give a hero experience; returns the levels gained. */
export function gainXp(h: Hero, xp: number): number {
  const p = h.prog;
  let gained = 0;
  p.xp += xp;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.points++;
    gained++;
  }
  if (gained) {
    h.refreshStats();
    h.hp = h.maxHp;
    p.mp = p.maxMp;
    if (h.cpu) p.autoSpend();
    events.levelUp(h);
  }
  return gained;
}

// ---- enemies ---------------------------------------------------------------------------------

/** how much tougher an area's foes are than the first's */
export function enemyLevel(area: number) {
  return 1 + area * 3;
}
export function enemyHpScale(level: number) {
  return POINTS * (1 + 0.15 * (level - 1));
}
function enemyDmgScale(level: number) {
  return POINTS * (1 + 0.1 * (level - 1));
}
const XP: Record<string, number> = { badbro: 40, knight: 45, adder: 300 };
export function xpFor(e: Enemy) {
  return Math.round((XP[e.kind.name] ?? 10) * (1 + 0.3 * (e.level - 1)));
}

// ---- the damage sums -------------------------------------------------------------------------

export type Blow = 'melee' | 'magic' | 'burn' | 'fall';
export interface Roll {
  dmg: number;
  crit: boolean;
  /** this blow knocks down whatever the script says */
  knock: boolean;
}

/** How hard a blow lands: raw is the original's damage (or a spell's own number for magic). */
export function roll(from: Fighter | null, to: Fighter, raw: number, blow: Blow): Roll {
  let dmg = raw, crit = false, knock = false;
  if (blow === 'melee' || blow === 'fall') {
    const hero = from?.isHero ? (from as Hero) : null;
    if (hero) {
      const p = hero.prog;
      dmg = raw * POINTS * (1 + 0.1 * (p.level - 1)) * (1 + 0.15 * p.rank('power'));
      if (hero.state === 'back' && p.rank('whirl')) { dmg *= 2; knock = true; }
      if (hero.state === 'dash' && p.rank('charge')) { dmg *= 1 + 0.5 * p.rank('charge'); knock = true; }
      if ((hero.state === 'grab' || hero.state === 'throw') && p.rank('grip')) dmg *= 1 + 0.5 * p.rank('grip');
      if (hero.mount) dmg *= 1 + 0.4 * p.rank('beast');
      if (Math.random() < 0.05 + 0.07 * p.rank('crit')) { dmg *= 1.6; crit = true; }
      dmg *= 0.9 + Math.random() * 0.2;
    } else {
      const lvl = (from as Enemy | null)?.level ?? 1;
      dmg = raw * enemyDmgScale(lvl);
    }
  }
  if (to.isHero) {
    const p = (to as Hero).prog;
    dmg *= 1 - 0.08 * p.rank('tough');
    if ((to as Hero).mount) dmg *= 1 - 0.25 * p.rank('beast');
  }
  return { dmg: Math.max(1, Math.round(dmg)), crit, knock };
}

/** After a blow lands: Bloodlust heals the hero who struck. */
export function landed(from: Fighter | null, dmg: number, blow: Blow) {
  if (!from?.isHero || blow !== 'melee') return;
  const h = from as Hero;
  const r = h.prog.rank('blood');
  if (r) h.hp = Math.min(h.maxHp, h.hp + Math.round(dmg * 0.08 * r));
}

/** A spell's damage for this hero: grows with level and its second rank. */
export function spellDamage(h: Hero, s: Spell, index: number) {
  return s.dmg * (1 + 0.08 * (h.prog.level - 1)) * (h.prog.rank(`spell${index}`) >= 2 ? 1.4 : 1);
}

/** Every tick: magic comes back slowly; Second Wind heals out of a fight; Last Stand recharges. */
export function regenerate(h: Hero, fighting: boolean) {
  const p = h.prog;
  if (p.standCooldown > 0) p.standCooldown--;
  if (h.dead) return;
  p.mpRegen += (1 + 0.5 * p.rank('medit')) / 90;
  if (p.mpRegen >= 1) {
    p.mpRegen -= 1;
    p.mp = Math.min(p.maxMp, p.mp + 1);
  }
  if (p.rank('wind') && !fighting && h.hp < h.maxHp) {
    p.hpRegen += h.maxHp / 1200;
    if (p.hpRegen >= 1) {
      const n = Math.floor(p.hpRegen);
      p.hpRegen -= n;
      h.hp = Math.min(h.maxHp, h.hp + n);
    }
  }
}

/** Last Stand: a blow that would kill leaves the hero on 1 instead (once a minute). */
export function lastStand(h: Hero, dmg: number): number {
  const p = h.prog;
  if (dmg < h.hp || !p.rank('stand') || p.standCooldown > 0) return dmg;
  p.standCooldown = 60 * 60;
  h.invuln = 90;
  return h.hp - 1;
}
