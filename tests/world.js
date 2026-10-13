// The journey: a new game opens on the world map; area 0 entered, its boss "beaten", out the right
// end to the map; on to the camp (rest and save); the save continued from the title; on into area 1.
localStorage.removeItem('ga-rpg.save');
game.go('title'); advance(2);
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'world') await sleep(50);
advance(30);
const log = [['new game', game.state, game.world.at, game.party.map((m) => m.hero)]];
// the way on is locked until the wilderness boss falls
tap('ArrowRight'); advance(60);
log.push(['locked: still at', game.world.at]);
await shot('world-start');
tap('KeyJ');
while (game.state !== 'play') await sleep(50);
advance(40);
let s = game.stage;
log.push(['entered', game.area, s.scripted]);
// the boss beaten: jump to the area's end with the script spent and nobody about
s.camx = s.camLimits[0]; s.spawnIndex = s.data.spawns.length;
s.actors = s.actors.filter((a) => a.isHero);
for (const h of game.heroes) { h.x = s.left + 200; h.z = s.floorZ(h.x, 0x1080); h.y = h.ground; }
advance(5);
log.push(['cleared', [...game.cleared], 'saved', !!localStorage.getItem('ga-rpg.save')]);
const h = game.heroes[0];
h.prog.xp = 30; h.hp = 50; h.prog.level = 3; h.refreshStats();
K('KeyD', true);
for (let i = 0; i < 400 && game.state !== 'world'; i++) { advance(1); await sleep(0); }
K('KeyD', false);
while (game.state !== 'world') await sleep(50);
log.push(['out to map', game.world.at, game.world.side]);
// on to the camp
advance(20); tap('ArrowRight'); advance(80);
log.push(['walked to', game.world.at]);
await shot('world-camp');
tap('KeyJ');
while (game.state !== 'camp') await sleep(50);
advance(200);
await shot('camp');
for (let i = 0; i < 1500 && game.state !== 'world'; i++) {
  // kick the thieves along
  for (const a of game.stage?.actors ?? []) if (a.constructor.name === 'Thief') a.gone = true;
  advance(1);
  if (game.state === 'travel') { while (game.state !== 'world') await sleep(20); }
}
log.push(['after camp', game.state, game.world.at, 'hp', h.hp, '/', h.maxHp]);
const save = JSON.parse(localStorage.getItem('ga-rpg.save'));
log.push(['save', save.at, save.cleared, save.party.map((m) => [m.hero, m.prog.level])]);
// continue from the title
game.heroes = []; game.go('title'); advance(30);
await shot('title-continue');
tap('KeyJ');
while (game.state !== 'world') await sleep(50);
advance(30);
log.push(['continued', game.world.at, game.party.map((m) => m.prog.level)]);
// on into area 1, at its left end
tap('ArrowRight'); advance(90);
tap('KeyJ');
while (game.state !== 'play') await sleep(50);
advance(40);
log.push(['area 1', game.area, game.stage.scripted, game.heroes[0].prog.level, game.heroes[0].x - game.stage.left]);
await shot('world-area1');
return log;
