// Foes jump up a ledge to reach a hero above them, even when the ledge runs along the depth.
localStorage.removeItem('ga-rpg.save');
game.go('title'); advance(2);
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'world') await sleep(50);
await game.loadArea(3, true);
while (game.overlay) { tap('KeyJ'); advance(30); }
const s = game.stage, h = game.heroes[0];
s.actors = s.actors.filter((a) => a.isHero); s.spawnIndex = s.data.spawns.length; s.nextEncounter = 1e9;
// a step of 24-60px along the depth, anywhere in the area (then the view moved to it)
let spot = null;
for (let x = 0x1000 + 200; x < 0x1000 + 0x700 && !spot; x += 8) for (let z = 0xf90; z < 0x1140; z += 4) {
  const up = s.groundAt(x, z), down = s.groundAt(x, z + 8);
  if (up > 0xf00 && up < 0x1480 && down - up >= 24 && down - up <= 60 && down < 0x1480 && s.groundAt(x, z + 30) === down && s.groundAt(x - 50, z + 30) === down && s.groundAt(x, z - 20) === up) { spot = [x, z, up, down]; break; }
}
if (spot) { s.camx = Math.max(s.camLimits[0], Math.min(s.camLimits[1], 0x1000 - 8 - (spot[0] - 160))); s.camy = s.camYRangeFor(s.camx, spot[0])[0]; }
if (!spot) return ['no ledge found'];
const [x, z, up, down] = spot;
h.x = x; h.z = z - 12; h.y = h.ground; h.invuln = 9999;
const e = new mods.Enemy(s, mods.KINDS.skeleton, x - 50, z + 24, 0x73); e.entering = false; e.y = e.ground; s.actors.push(e);
const before = e.ground;
let reached = false;
for (let i = 0; i < 400 && !reached; i++) { advance(1); h.hp = h.maxHp; if (e.ground === h.ground && !e.airborne) reached = true; }
await shot('ledge');
return [['ledge', (down - up), 'px'], ['skeleton ground', before.toString(16), '->', e.ground.toString(16), 'hero', h.ground.toString(16)], ["reached the hero", reached]];
