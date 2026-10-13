// The quest log: quests taken from townsfolk, counted as things happen (foes defeated, thieves
// kicked, areas cleared), and rewarded when the giver is told.
import { QUESTS, type QuestDef } from './story';
import { party } from './party';
import { gainXp } from './rpg';
import type { Hero } from './hero';
import type { NpcDef } from './npc';
import type { Line } from './talk';

export interface QuestState {
  state: 'active' | 'done' | 'rewarded';
  count: number;
}

/** quest id -> how it stands (one journey at a time) */
export const log: Record<string, QuestState> = {};

export function resetQuests(d?: Record<string, QuestState>) {
  for (const k of Object.keys(log)) delete log[k];
  Object.assign(log, structuredClone(d ?? {}));
}

/** Raised for the game to show: a quest's goal reached. */
export const questEvents = {
  done: (_q: QuestDef) => {},
};

export type QuestEvent = { kind: 'kill'; foe: string } | { kind: 'thief' } | { kind: 'clear'; area: number };

function finish(q: QuestDef, s: QuestState) {
  s.state = 'done';
  questEvents.done(q);
}

/** Count something that happened towards the quests that want it. */
export function questEvent(e: QuestEvent) {
  for (const q of QUESTS) {
    const s = log[q.id];
    if (s?.state !== 'active') continue;
    const g = q.goal;
    const counts = (g.kind === 'kill' && e.kind === 'kill' && g.foes.includes(e.foe)) || (g.kind === 'thieves' && e.kind === 'thief');
    if (counts) {
      s.count++;
      if (s.count >= (g as { count: number }).count) finish(q, s);
    } else if (g.kind === 'clear' && e.kind === 'clear' && e.area === g.area) finish(q, s);
  }
}

export function questDef(id: string) {
  return QUESTS.find((q) => q.id === id);
}

/** how far along a quest is, for the log */
export function progressText(q: QuestDef, s: QuestState) {
  if (s.state !== 'active') return s.state === 'done' ? 'DONE: TELL THEM' : 'COMPLETE';
  return q.goal.kind === 'clear' ? 'NOT YET' : `${s.count}/${q.goal.count}`;
}

/**
 * What someone says when spoken to. Quest givers offer their quest (taking it on), remind of it,
 * or hand over the reward; then they say their usual lines.
 */
export function conversation(npc: NpcDef, heroes: Hero[], cleared: Set<number>): Line[] {
  const say = (text: string): Line => ({ who: npc.name, text });
  const q = npc.quest ? questDef(npc.quest) : undefined;
  if (!q) return npc.lines.map(say);
  const s = log[q.id];
  if (!s) {
    log[q.id] = { state: 'active', count: 0 };
    // a quest to clear an area already cleared is done at once
    if (q.goal.kind === 'clear' && cleared.has(q.goal.area)) log[q.id].state = 'done';
    return [...npc.lines.map(say), say(q.ask), { who: 'NEW QUEST', text: `${q.title}. SEE IT IN THE PAUSE MENU.` }];
  }
  if (s.state === 'active') return [say(`${q.ask} (${progressText(q, s)})`)];
  if (s.state === 'done') {
    s.state = 'rewarded';
    party.gold += q.reward.gold;
    for (const h of heroes) if (h.state !== 'gameover') gainXp(h, q.reward.xp);
    if (q.reward.item) party.bag[q.reward.item]++;
    const item = q.reward.item ? `, AND ${q.reward.item === 'meat' ? 'ROAST MEAT' : q.reward.item === 'tonic' ? 'A MAGIC TONIC' : 'AN ELIXIR'}` : '';
    return [say(q.thanks), { who: 'QUEST COMPLETE', text: `${q.title}: ${q.reward.gold} GOLD, ${q.reward.xp} XP${item}.` }];
  }
  return npc.lines.map(say);
}
