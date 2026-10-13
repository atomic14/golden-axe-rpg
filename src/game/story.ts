// The story's words: who lives where (and comes out once an area is freed), the quests they
// give, and what's said on first coming into an area and on beating its boss. The tale follows
// the original's: Death Adder holds the king and princess and the Golden Axe in his castle.
import type { NpcDef } from './npc';
import type { Line } from './talk';

const VILLAGER = { boy: 0x9fe8, elder: 0xa04a, man: 0xa0ac, woman: 0xa10e, sitMan: 0xa342, sitWoman: 0xa35c };
const GNOME = 0x1873a;

export interface Town {
  /** only once the area's boss is beaten (a freed town); otherwise there from the start */
  freed: boolean;
  npcs: NpcDef[];
}

/** People in each area. */
export const PEOPLE: Record<number, Town[]> = {
  0: [{
    freed: false,
    npcs: [
      {
        name: 'OLD WOMAN', anim: VILLAGER.sitWoman, pal: 0x4d, x: 300, z: -20, animate: true, quest: 'heningers',
        lines: ['DEATH ADDER HAS TAKEN THE KING AND THE PRINCESS, AND THE GOLDEN AXE WITH THEM.',
          'YOU WILL GROW STRONGER WITH EVERY FIGHT. PAUSE TO LEARN NEW SKILLS WHEN YOU DO.'],
      },
    ],
  }],
  1: [{
    freed: true,
    npcs: [
      {
        name: 'VILLAGE ELDER', anim: VILLAGER.elder, pal: 0x4d, x: 1060, quest: 'longmoans',
        lines: ['YOU HAVE DRIVEN DEATH ADDERS MEN FROM OUR VILLAGE. WE ARE IN YOUR DEBT.',
          'THIS VILLAGE STANDS ON THE BACK OF A GIANT TURTLE. IT WILL CARRY YOU SOUTH, ACROSS THE SEA.'],
      },
      {
        name: 'GNOME TRADER', anim: GNOME, pal: 0x3c, x: 980, z: 24, animate: true, shop: { name: 'GNOME TRADER', tiers: 2 },
        lines: ['HEH HEH. NO MORE STEALING, I SWEAR IT. NOW I SELL! TAKE A LOOK.'],
      },
      {
        name: 'FISHERMAN', anim: VILLAGER.sitMan, pal: 0x4d, x: 1160, z: -10, animate: true, quest: 'thieves',
        lines: ['THOSE LITTLE THIEVES WITH THE BIG SACKS STEAL FROM EVERYONE.'],
      },
      {
        name: 'VILLAGE BOY', anim: VILLAGER.boy, pal: 0x4d, x: 1260, z: 14,
        lines: ['I WANT TO BE A WARRIOR LIKE YOU!', 'THEY SAY YOU CAN RIDE THE BEASTS THE SOLDIERS USE. JUMP ON WHEN ONE IS FREE.'],
      },
      {
        name: 'WEAVER', anim: VILLAGER.sitWoman, pal: 0x4d, x: 1380, animate: true,
        lines: ['MY HUSBAND WAS TAKEN TO THE CASTLE TO WORK IN CHAINS. PLEASE, BRING HIM HOME.'],
      },
    ],
  }],
  2: [{
    freed: true,
    npcs: [
      {
        name: 'BLUE TRADER', anim: GNOME, pal: 0x3d, x: 980, z: -28, animate: true, shop: { name: 'BLUE GNOME WARES', tiers: 4 },
        lines: ['THE GREEN ONE IS MY COUSIN. HIS PRICES ARE ROBBERY. MINE ARE ONLY THEFT.'],
      },
      {
        name: 'TOWN GUARD', anim: VILLAGER.man, pal: 0x4d, x: 1080, z: -40, quest: 'amazons',
        lines: ['THE AMAZONS THAT SERVE DEATH ADDER STILL HOLD THE ROADS AROUND THE TOWN.'],
      },
      {
        name: 'OLD SAGE', anim: VILLAGER.elder, pal: 0x4d, x: 1200, z: -56, quest: 'eagle',
        lines: ['THE FIENDS PATH IS NO ROAD. IT IS A GREAT GREAT EAGLE, AND IT FLIES TO THE CASTLE.'],
      },
      {
        name: 'WIDOW', anim: VILLAGER.sitWoman, pal: 0x4d, x: 1320, z: -70, animate: true, quest: 'skeletons',
        lines: ['DEATH ADDER RAISES THE DEAD TO FIGHT FOR HIM. THEY RISE WHEREVER WARRIORS TARRY.'],
      },
    ],
  }],
};

export type Goal =
  | { kind: 'kill'; foes: string[]; count: number }
  | { kind: 'thieves'; count: number }
  | { kind: 'clear'; area: number };

export interface QuestDef {
  id: string;
  title: string;
  /** asked when given, and said when the reward is handed over */
  ask: string;
  thanks: string;
  goal: Goal;
  reward: { gold: number; xp: number; item?: 'meat' | 'tonic' | 'elixir' };
}

export const QUESTS: QuestDef[] = [
  {
    id: 'heningers', title: 'THIN THEIR RANKS',
    ask: 'HENINGERS PATROL THESE LANDS. DEFEAT SIX OF THEM AND COME BACK TO ME.',
    thanks: 'YOU WILL DO. TAKE THIS, AND GO WITH THE GODS.',
    goal: { kind: 'kill', foes: ['heninger'], count: 6 }, reward: { gold: 60, xp: 60, item: 'meat' },
  },
  {
    id: 'longmoans', title: 'THE RAIDERS',
    ask: 'LONGMOANS STILL RAID OUR BOATS. DEFEAT EIGHT OF THEM, WHEREVER YOU FIND THEM.',
    thanks: 'OUR BOATS ARE SAFE. HERE, IT IS ALL WE HAVE.',
    goal: { kind: 'kill', foes: ['longmoan'], count: 8 }, reward: { gold: 160, xp: 150, item: 'tonic' },
  },
  {
    id: 'thieves', title: 'STOLEN GOODS',
    ask: 'KICK FIVE OF THEM AND MAKE THEM DROP WHAT THEY TOOK. THEN TELL ME.',
    thanks: 'HA! THAT WILL TEACH THEM. HAVE THIS, FOR YOUR TROUBLE.',
    goal: { kind: 'thieves', count: 5 }, reward: { gold: 100, xp: 80, item: 'elixir' },
  },
  {
    id: 'amazons', title: 'THE AMAZON ROADS',
    ask: 'DEFEAT TEN AMAZONS AND THE ROADS WILL BE OURS AGAIN.',
    thanks: 'THE ROADS ARE OPEN. THE TOWN THANKS YOU.',
    goal: { kind: 'kill', foes: ['amazon'], count: 10 }, reward: { gold: 320, xp: 320 },
  },
  {
    id: 'eagle', title: 'THE FIENDS PATH',
    ask: 'RIDE THE EAGLE AND CLEAR THE FIENDS PATH. ONLY THEN CAN THE CASTLE BE REACHED.',
    thanks: 'YOU RODE THE EAGLE AND LIVED! THE CASTLE AWAITS. TAKE THIS GOLD FOR ARMOUR.',
    goal: { kind: 'clear', area: 3 }, reward: { gold: 600, xp: 500, item: 'elixir' },
  },
  {
    id: 'skeletons', title: 'LAY THEM TO REST',
    ask: 'PUT TWELVE OF THE RISEN DEAD BACK IN THEIR GRAVES.',
    thanks: 'MAY THEY SLEEP NOW. BLESS YOU.',
    goal: { kind: 'kill', foes: ['skeleton'], count: 12 }, reward: { gold: 400, xp: 450, item: 'tonic' },
  },
];

/** Said on first coming into an area. */
export const ARRIVAL: Record<number, Line[]> = {
  0: [{ who: 'THE WILDERNESS', text: 'DEATH ADDERS SOLDIERS HOLD THE WILD LANDS. THE ROAD TO HIS CASTLE BEGINS HERE.' }],
  1: [{ who: 'TURTLE VILLAGE', text: 'THE VILLAGE IS ON THE BACK OF A GIANT TURTLE. DEATH ADDERS MEN HAVE TAKEN IT.' }],
  2: [{ who: 'STONE TOWN', text: 'THE TURTLE TOOK US SOUTH, ACROSS THE SEA. THE WAY TO THE CASTLE IS PACKED BY ENEMY LINES.' }],
  3: [{ who: 'THE FIENDS PATH', text: 'THE FIENDS PATH WAS A GREAT GREAT EAGLE. IT TAKES US ACROSS THE SKIES TO THE CASTLE.' }],
  4: [{ who: 'THE CASTLE', text: 'NOW THE FINAL BATTLE BEGINS. DEATH ADDER WAITS ON HIS THRONE.' }],
};

/** Said when an area's boss falls. */
export const VICTORY: Record<number, Line[]> = {
  0: [{ who: 'THE WILDERNESS', text: 'THE BAD BROTHERS FALL. THE ROAD SOUTH IS OPEN, AND A CAMP AWAITS ON THE MAP.' }],
  1: [{ who: 'TURTLE VILLAGE', text: 'THE VILLAGE IS FREE! ITS PEOPLE WILL COME OUT OF HIDING. COME BACK AND MEET THEM.' }],
  2: [{ who: 'STONE TOWN', text: 'THE TOWN IS FREE. TRADERS AND TOWNSFOLK WILL RETURN. VISIT THEM BEFORE THE EAGLE.' }],
  3: [{ who: 'THE FIENDS PATH', text: 'THE EAGLE LANDS AT THE CASTLE WALLS. REST, AND MAKE READY.' }],
};
