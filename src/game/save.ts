// The saved journey (in the browser's storage, which can be unavailable: private windows, blocked
// sites): the party and how each has grown, the areas beaten, and where on the map they stand.
import type { ProgressData } from './rpg';
import type { PartyData } from './party';
import type { QuestState } from './quests';

const KEY = 'ga-rpg.save';

export interface SaveData {
  v: 1;
  /** the player's hero, and the computer partner's (if any) */
  party: { hero: number; cpu: boolean; prog: ProgressData }[];
  visited: number[];
  cleared: number[];
  /** the place on the route, and which end of an area they'd walk in at */
  at: number;
  side: 'left' | 'right';
  /** gold and the bag, and the quest log (missing in saves from before they existed) */
  purse?: PartyData;
  quests?: Record<string, QuestState>;
}

export function loadSave(): SaveData | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SaveData | null;
    return d?.v === 1 && d.party?.length ? d : null;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}
