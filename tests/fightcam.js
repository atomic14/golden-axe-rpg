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
const first = [['engaged', s.engaged], ['camera moved', cam0, '->', s.camx], ['rider screen x', Math.round(sx)]];
// Turtle Village's slope: walk down at the right of the view (where the ground falls away) and stay on screen
foe.gone = true; h.dismount?.();
await game.loadArea(1, true);
while (game.overlay) { tap('KeyJ'); advance(30); }
const t = game.stage, g = game.heroes[0];
t.actors = t.actors.filter((a) => a.isHero); t.spawnIndex = t.data.spawns.length; t.nextEncounter = 1e9;
const pin = new mods.Enemy(t, mods.KINDS.heninger, 0, 0x1000, 0x1b); pin.update = () => {}; t.actors.push(pin);
t.camx = -255; t.camy = t.camYRange(t.camx)[0];
g.x = t.left + 260; g.z = t.floorZ(g.x, 0x1060); g.y = g.ground;
pin.x = g.x + 40; pin.z = g.z;
K('KeyS', true);
for (let i = 0; i < 200; i++) advance(1);
K('KeyS', false);
for (let i = 0; i < 60; i++) advance(1);
const feet = t.project(g.x, g.z, g.y)[1];
await shot('fightcam-slope');
const slope = ['slope: feet on screen', Math.round(feet), feet <= 222, 'z', g.z.toString(16)];
return [...first, slope];
