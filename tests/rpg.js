// The RPG layer: damage numbers and scaled health, experience and levels, the character sheet's
// skill trees, and spells costing magic. Tyris (?) is whoever the select screen starts on.
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'play') await sleep(50);
advance(40);
const s = game.stage, h = game.heroes[0];
s.scripted = false; s.spawnIndex = s.data.spawns.length;
s.actors = s.actors.filter((a) => a.isHero);
const log = [['hero', h.def.name, 'hp', h.hp, h.maxHp, 'mp', h.prog.mp, h.prog.maxMp, 'spell', h.spell.name]];
const foe = (dx) => {
  const e = new mods.Enemy(s, mods.KINDS.heninger, h.x + dx, h.z, 0x1b);
  e.entering = false; s.actors.push(e); return e;
};
// a fight: hit a heninger until it drops
const e = foe(30);
log.push(['heninger hp', e.hp, 'level', e.level]);
h.facing = 1;
for (let i = 0; i < 400 && !e.dead && !e.gone; i++) {
  if (i % 6 === 0) { K('KeyJ', true); } else if (i % 6 === 2) K('KeyJ', false);
  if (Math.abs(e.x - h.x) > 26 && e.state === 'stand') { e.x = h.x + 24 * h.facing; e.z = h.z; }
  advance(1);
  if (i === 30) await shot('rpg-numbers');
}
K('KeyJ', false); advance(5);
log.push(['after kill', 'xp', h.prog.xp, 'level', h.prog.level, 'enemy dead', e.dead || e.gone]);
// level up by experience
mods.gainXp ? 0 : 0;
const before = h.prog.level;
while (h.prog.level < 4) {
  const k = foe(200); k.hp = 1; k.wound(h, 99);
}
advance(30);
log.push(['levelled', before, '->', h.prog.level, 'points', h.prog.points, 'maxHp', h.maxHp, 'maxMp', h.prog.maxMp]);
await shot('rpg-levelup');
// the character sheet: learn Power Strike (weapon, row 0) and the second spell
tap('KeyP'); advance(2);
tap('ArrowLeft'); tap('KeyJ');           // weapon column, row 0: POWER STRIKE
tap('ArrowRight'); tap('ArrowDown'); tap('KeyJ');   // element column, row 1: second spell
advance(2);
await shot('rpg-menu');
log.push(['learned', JSON.stringify(h.prog.ranks), 'points', h.prog.points, 'equipped', h.spell.name]);
tap('KeyP'); advance(2);
// cast: costs MP, hurts everything in reach
const a = foe(50), b = foe(-60);
advance(20);
const mp0 = h.prog.mp, hp0 = [a.hp, b.hp];
tap('KeyL');
for (let i = 0; i < 200 && h.state === 'magic'; i++) { advance(1); if (i === 40) await shot('rpg-magic'); }
advance(4);
log.push(['cast', h.spell.name, 'mp', mp0, '->', h.prog.mp, 'foes', hp0, '->', [a.hp, b.hp], 'stun/burn', [a.stun, a.burn, b.stun, b.burn]]);
await shot('rpg-after-magic');
return log;
