// Roaming: walk the first area (enemies cleared by cheating), out the right end into area 1,
// then back left into area 0, where random encounters replace the scripted fights.
tap('Enter'); advance(20); tap('Enter');
while (game.state !== 'play') await sleep(50);
advance(5);
const log = [];
const clear = () => { for (const a of game.stage.actors) if (a.isEnemy && a.hostile) a.gone = true; };
// hold a direction; when stuck against a ledge, try stepping down in depth, then up, then jumping
const walk = async (key, ticks, cheat = true, until = () => false) => {
  K(key, true);
  let lastX = 0, still = 0, dodge = 0;
  for (let i = 0; i < ticks; i++) {
    if (cheat) clear();
    advance(1);
    if (game.state !== 'play' || until()) break;
    const h = game.heroes[0];
    still = Math.abs(h.x - lastX) < 0.5 ? still + 1 : 0;
    lastX = h.x;
    if (still > 8) {
      const k = ['KeyS', 'KeyW', 'KeyK'][dodge++ % 3];
      K(k, true); advance(k === 'KeyK' ? 4 : 40); K(k, false);
      still = 0;
    }
  }
  K(key, false); advance(2);
};
await walk('KeyD', 2400);
log.push(['end of area 0', game.state, game.area, game.stage.camx, game.stage.scripted]);
await shot('roam-end0');
// walk out the right end
await walk('KeyD', 200);
while (game.state !== 'play') await sleep(50);
advance(10);
log.push(['in area 1', game.area, game.stage.camx, game.stage.scripted]);
await shot('roam-area1');
// back left into area 0, arriving at its right end
await walk('KeyA', 200);
while (game.state !== 'play') await sleep(50);
advance(10);
log.push(['back in area 0', game.area, game.stage.camx, game.stage.scripted, game.heroes[0].facing]);
await shot('roam-back0');
// walk left without cheating until a random encounter turns up
const cam0 = game.stage.camx;
game.stage.nextEncounter = 200;
await walk('KeyA', 3000, false, () => game.stage.engaged);
const met = game.stage.engaged ? game.stage.camx - cam0 : null;
const camLocked = game.stage.camx;
advance(60);
log.push(['camera held during the fight', camLocked === game.stage.camx]);
log.push(['encounter after', met, game.stage.camx, game.stage.actors.filter(a => a.isEnemy).map(a => a.kind?.name ?? a.constructor.name)]);
await shot('roam-encounter');
return log;
