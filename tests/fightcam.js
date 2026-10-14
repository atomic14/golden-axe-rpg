// The camera keeps following in a fight: riding at a foe never pins the hero to the screen's edge.
localStorage.removeItem('ga-rpg.save');
game.go('title'); advance(2);
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'world') await sleep(50);
advance(30); tap('KeyJ');
while (game.state !== 'play') await sleep(50);
while (game.overlay) { tap('KeyJ'); advance(30); }
const s = game.stage, h = game.heroes[0];
s.actors = s.actors.filter((a) => a.isHero); s.spawnIndex = s.data.spawns.length; s.nextEncounter = 1e9;
const b = new mods.Beast(s, 'chicken', h.x + 20, h.z, null); s.actors.push(b);
h.mountBeast(b);
const foe = new mods.Enemy(s, mods.KINDS.heninger, h.x + 260, h.z, 0x1b); foe.entering = false; s.actors.push(foe);
foe.update = () => {};   // stands its ground, out of the way
foe.z += 40;
const cam0 = s.camx;
K('KeyD', true);
for (let i = 0; i < 160; i++) advance(1);
K('KeyD', false);
const sx = b.x - s.left;
await shot('fightcam');
return [['engaged', s.engaged], ['camera moved', cam0, '->', s.camx], ['rider screen x', Math.round(sx)]];
