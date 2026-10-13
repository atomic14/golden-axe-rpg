// Champions and their treasure; a beast that grows with the foes beaten from its back and comes
// along to the next area (and into the save).
localStorage.removeItem('ga-rpg.save');
game.go('title'); advance(2);
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'world') await sleep(50);
advance(30); tap('KeyJ');
while (game.state !== 'play') await sleep(50);
while (game.overlay) { tap('KeyJ'); advance(30); }
const s = game.stage, h = game.heroes[0];
s.actors = s.actors.filter((a) => a.isHero); s.spawnIndex = s.data.spawns.length;
const log = [];
// a champion
const c = new mods.Enemy(s, mods.KINDS.heninger, h.x + 60, h.z, 0x1b); c.entering = false; s.actors.push(c);
const plain = c.maxHp;
c.makeChampion();
log.push(['champion hp', plain, '->', c.maxHp, 'level', c.level]);
advance(20);
await shot('loot-champion');
const gold0 = mods.party.gold, bag0 = JSON.stringify(mods.party.bag);
const rnd = Math.random; Math.random = () => 0.1;   // the lucky drop: an item and gear
c.wound(h, 9999); c.gone = true;
Math.random = rnd;
advance(10);
log.push(['treasure', 'gold', gold0, '->', mods.party.gold, 'bag', bag0, '->', JSON.stringify(mods.party.bag), 'gear', h.prog.weapon, h.prog.armour]);
await shot('loot-found');
// a beast to ride, growing with kills
const b = new mods.Beast(s, 'chicken', h.x + 20, h.z, null); s.actors.push(b);
h.mountBeast(b);
for (let i = 0; i < 8; i++) { const e = new mods.Enemy(s, mods.KINDS.longmoan, h.x + 200, h.z, 0x79); s.actors.push(e); e.wound(h, 9999); e.gone = true; }
advance(10);
log.push(['beast', JSON.stringify(mods.party.beasts), 'riding', h.mount?.type]);
await shot('loot-beast');
// out to the map and back in: still riding
game.cleared.add(0);
game.openWorld(0, 'right');
advance(30);
log.push(['saved mount', JSON.parse(localStorage.getItem('ga-rpg.save')).party[0].mount]);
tap('KeyJ');
while (game.state !== 'play') await sleep(50);
advance(10);
log.push(['back in, riding', game.heroes[0].mount?.type, game.stage.actors.filter((a) => a.constructor.name === 'Beast').length]);
return log;
