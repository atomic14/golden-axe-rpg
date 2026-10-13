// Towns and quests: the arrival words, a quest from the old woman in the wilderness (taken, done,
// handed in), the freed Turtle Village's people, a trader's shop, and the menu's items and quests.
localStorage.removeItem('ga-rpg.save');
game.go('title'); advance(2);
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'world') await sleep(50);
advance(30); tap('KeyJ');
while (game.state !== 'play') await sleep(50);
advance(80);
const log = [['arrival words', game.overlay?.constructor.name]];
await shot('town-arrival');
while (game.overlay) { tap('KeyJ'); advance(30); }
let s = game.stage;
const h = game.heroes[0];
s.actors = s.actors.filter((a) => a.isHero || a.constructor.name === 'Npc');
s.spawnIndex = s.data.spawns.length;
const npc = s.actors.find((a) => a.constructor.name === 'Npc');
log.push(['npc', npc?.def.name, Math.round(npc.x - s.left)]);
// walk up to her and talk
h.x = npc.x - 24; h.z = npc.z; h.y = h.ground; h.facing = 1;
advance(4);
await shot('town-near');
tap('KeyJ'); advance(60);
await shot('town-talk');
let pages = 0;
while (game.overlay && pages++ < 10) { tap('KeyJ'); advance(80); }
log.push(['quest', JSON.stringify(mods.quests.log)]);
// six heningers
for (let i = 0; i < 6; i++) { const e = new mods.Enemy(s, mods.KINDS.heninger, h.x + 200, h.z, 0x1b); s.actors.push(e); e.wound(h, 999); e.gone = true; }
advance(10);
log.push(['after kills', JSON.stringify(mods.quests.log), 'gold', mods.party.gold]);
const gold0 = mods.party.gold, xp0 = h.prog.xp + h.prog.level * 1000;
tap('KeyJ'); advance(60);
await shot('town-reward');
while (game.overlay) { tap('KeyJ'); advance(60); }
log.push(['handed in', mods.quests.log.heningers.state, 'gold', gold0, '->', mods.party.gold, 'meat', mods.party.bag.meat, 'xp up', h.prog.xp + h.prog.level * 1000 > xp0]);
// Turtle Village, freed
game.cleared.add(0); game.cleared.add(1); game.visited.add(1);
await game.loadArea(1);
advance(40);
s = game.stage;
const people = s.actors.filter((a) => a.constructor.name === 'Npc');
log.push(['village', s.peaceful, s.scripted, people.map((p) => p.def.name)]);
const trader = people.find((p) => p.def.shop);
s.camx = Math.max(s.camLimits[0], Math.min(s.camLimits[1], 0x1000 - 8 - (trader.x - 150)));
s.camy = s.camYRange(s.camx)[0];
h.x = trader.x - 26; h.z = trader.z; h.y = h.ground; h.facing = 1;
advance(4);
await shot('town-village');
mods.party.gold = 500;
tap('KeyJ'); advance(60);
while (game.overlay?.constructor.name === 'Dialogue') { tap('KeyJ'); advance(60); }
log.push(['shop open', game.overlay?.constructor.name]);
await shot('town-shop');
// buy: roast meat, then down to the hero's weapon
tap('KeyJ'); advance(4);
for (let i = 0; i < 3; i++) tap('ArrowDown');
tap('KeyJ'); advance(4);
await shot('town-bought');
log.push(['bought', 'gold', mods.party.gold, 'meat', mods.party.bag.meat, 'weapon', h.prog.weapon]);
tap('KeyK'); advance(4);
log.push(['shop closed', game.overlay]);
// the menu's items and quests
h.hp = 100;
tap('KeyP'); advance(2); tap('KeyK'); advance(2);
await shot('menu-items');
tap('KeyJ'); advance(2);
log.push(['ate', h.hp, '/', h.maxHp, 'meat', mods.party.bag.meat]);
tap('KeyK'); advance(2);
await shot('menu-quests');
tap('KeyP'); advance(2);
return log;
