// A beast leaps when its rider jumps; jumping again mid-leap hops off.
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
advance(5);
const log = [];
const x0 = b.x, g0 = b.ground;
K('KeyD', true);
tap('KeyK');
let peak = 0;
for (let i = 0; i < 60; i++) { advance(1); peak = Math.max(peak, g0 - b.y); if (i === 10) await shot('leap'); }
K('KeyD', false);
log.push(['leapt', 'height', Math.round(peak), 'moved', Math.round(b.x - x0), 'landed', !b.airborne, 'riding', h.mount?.type]);
tap('KeyK'); advance(8); tap('KeyK');
for (let i = 0; i < 60; i++) advance(1);
log.push(['jump twice: off', h.mount ?? null, h.state]);
return log;
