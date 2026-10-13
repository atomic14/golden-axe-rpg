// What the party carries: gold, a bag of things to use, and the gear each hero wears (a weapon
// and armour, in tiers bought from traders).

/** Things in the bag. */
export interface ItemDef {
  id: 'meat' | 'tonic' | 'elixir';
  name: string;
  desc: string;
  price: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'meat', name: 'ROAST MEAT', desc: 'HEALS 40% OF HEALTH', price: 30 },
  { id: 'tonic', name: 'MAGIC TONIC', desc: 'RESTORES 20 MP', price: 40 },
  { id: 'elixir', name: 'ELIXIR', desc: 'THE WHOLE PARTY: FULL HEALTH AND MAGIC', price: 220 },
];

/** what each hero calls their weapon */
const WEAPON_NOUN = ['SWORD', 'BLADE', 'AXE'];
const WEAPON_TIER = ['RUSTY', 'IRON', 'STEEL', 'MITHRIL', 'RUNE'];
const ARMOUR_TIER = ['RAGS', 'LEATHER', 'CHAIN MAIL', 'PLATE', 'DRAGON MAIL'];
/** damage dealt and taken for each tier */
export const WEAPON_BONUS = [0, 0.15, 0.3, 0.5, 0.75];
export const ARMOUR_GUARD = [0, 0.08, 0.15, 0.22, 0.3];
const WEAPON_PRICE = [0, 120, 320, 700, 1400];
const ARMOUR_PRICE = [0, 100, 280, 620, 1250];
export const GEAR_TIERS = WEAPON_TIER.length;

export type GearSlot = 'weapon' | 'armour';

export function gearName(slot: GearSlot, hero: number, tier: number) {
  return slot === 'weapon' ? `${WEAPON_TIER[tier]} ${WEAPON_NOUN[hero]}` : ARMOUR_TIER[tier];
}
export function gearPrice(slot: GearSlot, tier: number) {
  return slot === 'weapon' ? WEAPON_PRICE[tier] : ARMOUR_PRICE[tier];
}
export function gearDesc(slot: GearSlot, tier: number) {
  return slot === 'weapon' ? `+${Math.round(WEAPON_BONUS[tier] * 100)}% DAMAGE` : `-${Math.round(ARMOUR_GUARD[tier] * 100)}% DAMAGE TAKEN`;
}

/** The beasts the party has ridden, by kind: they grow with the foes beaten from their backs. */
export type BeastKind = 'chicken' | 'blue' | 'red';
export const BEAST_NAMES: Record<BeastKind, string> = { chicken: 'CHICKEN LEG', blue: 'BLUE DRAGON', red: 'RED DRAGON' };
export interface BeastBond {
  level: number;
  xp: number;
}
/** experience a beast needs to grow from `level` */
export function beastXpToNext(level: number) {
  return 60 * level;
}
/** how much harder a beast of this level hits */
export function beastPower(level: number) {
  return 1 + 0.2 * (level - 1);
}

export interface PartyData {
  gold: number;
  bag: Record<ItemDef['id'], number>;
  /** missing in saves from before mounts grew */
  beasts?: Partial<Record<BeastKind, BeastBond>>;
}

/** The party's purse and bag (one journey at a time). */
export const party: PartyData & { beasts: Partial<Record<BeastKind, BeastBond>> } = { gold: 0, bag: { meat: 0, tonic: 0, elixir: 0 }, beasts: {} };

export function resetParty(d?: PartyData) {
  party.gold = d?.gold ?? 0;
  party.bag = { meat: 0, tonic: 0, elixir: 0, ...d?.bag };
  party.beasts = structuredClone(d?.beasts ?? {});
}

export function bond(kind: BeastKind): BeastBond {
  return (party.beasts[kind] ??= { level: 1, xp: 0 });
}

/** Raised for the game to show: treasure found, a beast grown. */
export const partyEvents = {
  found: (_text: string) => {},
};

/** A beast learns from a fight won on its back; returns true if it grew. */
export function beastXp(kind: BeastKind, xp: number): boolean {
  const b = bond(kind);
  b.xp += xp;
  let grew = false;
  while (b.level < 10 && b.xp >= beastXpToNext(b.level)) {
    b.xp -= beastXpToNext(b.level);
    b.level++;
    grew = true;
  }
  if (grew) partyEvents.found(`${BEAST_NAMES[kind]} GREW TO LEVEL ${b.level}`);
  return grew;
}

/** A champion's treasure: something for the bag. */
export function lootItem(): ItemDef {
  const r = Math.random();
  return ITEMS[r < 0.45 ? 0 : r < 0.9 ? 1 : 2];
}

/** gold a foe of this level carries */
export function goldFor(level: number, big: boolean) {
  const base = 3 + level * 2;
  return Math.round((big ? base * 4 : base) * (0.75 + Math.random() * 0.5));
}
