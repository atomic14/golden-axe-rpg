// Skeletons climb out of the ground in view (unhittable till up); foes on foot hit a mounted hero
// through the beast, knocking them off.
localStorage.removeItem('ga-rpg.save');
game.go('title'); advance(2);
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'world') await sleep(50);
await game.loadArea(3, true);
while (game.overlay) { tap('KeyJ'); advance(30); }
const s = game.stage, h = game.heroes[0];
s.actors = s.actors.filter((a) => a.isHero); s.spawnIndex = s.data.spawns.length; s.nextEncounter = 1e9;
h.invuln = 0;
const log = [];
const x = h.x + 70, z = s.floorZ(x, h.z);
const sk = mods.spawnActor(s, 0x23bda, x, z, 0); s.actors.push(sk);
log.push(['spawned', sk.state, 'hittable', sk.vulnerable]);
advance(14); await shot('skeleton-rising');
let t = 14; while (sk.state === 'rise' && t < 200) { advance(1); t++; }
log.push(['up after', t, 'ticks', sk.state, 'hittable', sk.vulnerable]);
sk.gone = true; advance(1);
// a heninger swings at a hero on a beast
const b = new mods.Beast(s, 'chicken', h.x, h.z, null); s.actors.push(b);
h.mountBeast(b); advance(5);
const e = new mods.Enemy(s, mods.KINDS.heninger, b.x + 30, b.z, 0x1b); e.entering = false; e.cooldown = 0; e.facing = -1; s.actors.push(e);
const hp0 = h.hp;
let off = false;
for (let i = 0; i < 300 && !off; i++) { advance(1); if (!h.mount) off = true; }
log.push(['mounted hero hit', off, 'hp', hp0, '->', h.hp]);
return log;
