// Game flow: title (continue a saved journey or start anew), character select, the world map, the
// five areas (roamed both ways, walking off an end back to the map), camps to rest and save at,
// game over.
import { input } from '../input';
import { assets } from '../assets';
import { audio } from '../audio';
import { ctx, drawSprite, drawSpriteTinted, drawText, fillRect, W, H } from '../gfx';
import { Stage, END } from './stage';
import { Hero, HEROES } from './hero';
import { Brain } from './partner';
import { drawHud } from './hud';
import { Thief, Campfire, CampPotion } from './props';
import { Menu } from './menu';
import { events, Progress } from './rpg';
import { FloatText } from './fx';
import { WorldMap, ROUTE, AREA_NAMES, placeOf, type Place } from './world';
import { loadSave, writeSave, type SaveData } from './save';

export const AREAS = 5;

/** settings kept between visits (storage can be unavailable: private windows, blocked sites) */
function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered, then
  }
}
/** hero indices from left to right on the select screen */
const SELECT_ORDER = [2, 0, 1];

type State = 'title' | 'select' | 'loading' | 'world' | 'play' | 'travel' | 'clear' | 'camp' | 'continue' | 'gameover' | 'ending';

export class Game {
  state: State = 'title';
  t = 0;
  choice = 0;
  stage: Stage | null = null;
  heroes: Hero[] = [];
  area = 0;
  paused = false;
  /** a computer-controlled second player (chosen on the select screen, remembered) */
  partner = load('ga.partner') === 'on' || new URLSearchParams(location.search).has('cpu');
  /** areas the heroes have been to (their scripted fights only play the first time) */
  visited = new Set<number>();
  /** areas whose boss is beaten: the way on (and the camp after) open */
  cleared = new Set<number>();
  world: WorldMap | null = null;
  /** what happens once the view has closed into a box */
  private next: (() => void) | null = null;
  /** a saved party waiting for the heroes to be made (they need a stage) */
  private pending: SaveData['party'] | null = null;
  /** the title screen's choice when there's a saved journey: 0 continue, 1 new */
  titleChoice = 0;
  private titleMove = 0;
  /** the character sheet, open while paused */
  menu: Menu | null = null;

  constructor() {
    events.levelUp = (h) => {
      audio.sfx('pickup');
      const s = this.stage;
      if (s) s.actors.push(new FloatText(s, h, 'LEVEL UP!', '#ff0', 84, 90));
      if (!h.cpu) this.toast(`${h.def.name.split(' ')[0]} REACHED LEVEL ${h.prog.level}`);
    };
  }

  /** Pause opens the character sheet; pause again closes it. */
  private togglePause() {
    this.paused = !this.paused;
    const p = this.players[0];
    this.menu = this.paused && p ? new Menu(p) : null;
  }

  update() {
    this.t++;
    const pr = input.pressed;
    switch (this.state) {
      case 'title': {
        const saved = loadSave();
        if (!saved) {
          if (pr.start || pr.attack || pr.any) this.go('select');
          break;
        }
        if (input.pad.y && !this.titleMove) this.titleChoice = 1 - this.titleChoice;
        this.titleMove = input.pad.y;
        const tap = input.tapAt;
        if (tap) this.titleChoice = tap.y < 134 ? 0 : 1;
        if (tap || pr.start || pr.attack || pr.jump) {
          if (this.titleChoice === 0) this.continueGame(saved);
          else this.go('select');
        }
        break;
      }
      case 'world': {
        const place = this.world!.update();
        if (place) this.enter(place);
        break;
      }
      case 'select': {
        if (this.t === 1) audio.music('select');
        if (this.t > 10) {
          // left to right on screen: Gilius, Ax, Tyris
          if (input.pad.x && this.selMove === 0) {
            const slot = SELECT_ORDER.indexOf(this.choice);
            this.choice = SELECT_ORDER[Math.max(0, Math.min(2, slot + input.pad.x))];
          }
          this.selMove = input.pad.x;
          // up / down (or a tap on the line at the top) switches the computer partner
          if (input.pad.y && this.selMoveY === 0) this.togglePartner();
          this.selMoveY = input.pad.y;
          // touch: tap a hero to pick them, tap them again to start
          const tap = input.tapAt;
          if (tap && tap.y < 30) this.togglePartner();
          else if (tap && tap.y > 30 && tap.y < 200) {
            const i = SELECT_ORDER[Math.max(0, Math.min(2, Math.floor(tap.x / (W / 3))))];
            if (i === this.choice) this.startGame();
            else this.choice = i;
          } else if (pr.attack || pr.start || pr.jump) this.startGame();
        }
        break;
      }
      case 'play': {
        if (pr.pause) this.togglePause();
        if (this.paused) {
          this.menu?.update();
          return;
        }
        const s = this.stage!;
        if (this.opening > 0) this.opening--;
        s.update();
        if (s.roam && s.scripted && s.progress >= END && !s.enemiesAlive && s.spawnIndex >= s.data.spawns.length && !this.areaCleared) {
          this.areaCleared = true;
          this.cleared.add(this.area);
          if (this.area + 1 < AREAS) this.toast('AREA CLEAR! A CAMP AWAITS ON THE MAP');
          else this.go('clear');
          s.scripted = false;
          this.save();
          audio.music(`area${this.area}`);
        }
        if (s.progress >= 0x1431 && !this.bossMusic && s.scripted) {
          this.bossMusic = true;
          audio.music('boss');
        }
        // a computer partner that runs out of lives rejoins after a while
        for (const h of this.heroes) {
          if (h.cpu && h.state === 'gameover' && ++h.respawnTimer > 300) {
            h.lives = 2;
            h.respawn();
          }
        }
        if (this.players.every((h) => h.state === 'gameover')) this.go('continue');
        else if (s.roam) this.checkExits(s);
        else if (s.progress >= END && !s.enemiesAlive && s.spawnIndex >= s.data.spawns.length && this.t > 60) this.go('clear');
        break;
      }
      case 'travel':
        // the view closes into a box, then on to what's next
        if (this.t >= 30 && this.next) {
          const next = this.next;
          this.next = null;
          next();
        }
        break;
      case 'clear':
        this.stage!.update();
        if (this.t > 150) {
          this.startEnding();
        }
        break;
      case 'camp': {
        const s = this.stage!;
        if (pr.pause) this.paused = !this.paused;
        if (this.paused) return;
        s.update();
        // the thieves creep in after a while; the heroes wake when they arrive
        if (this.t === 150) {
          // the heroes' potions lie beside them (two at most), for the thief to steal
          this.heroes.forEach((h, i) => {
            if (h.state !== 'sleep' || h.potions <= 0) return;
            const offsets = i === 0 ? (h.potions >= 2 ? [-28, -16] : [-22]) : (h.potions >= 2 ? [-26, -14] : [-20]);
            for (const dx of offsets) s.actors.push(new CampPotion(s, h, dx));
          });
          for (const [, x, z, param, init] of s.data.camp ?? []) {
            if (init === 0x17c7c || init === 0x17d00 || init === 0x17d24) {
              const t = new Thief(s, x, z, param || 0x2300, init === 0x17d00);
              t.camp = true;
              s.actors.push(t);
            }
          }
        }
        if (this.t === 170) for (const h of this.heroes) if (h.state === 'sleep') h.setState('getup', h.anims.getup);
        const thieves = s.actors.some((a) => a instanceof Thief);
        // jars left untouched go back to their owners
        if (this.t > 400 && !thieves) for (const a of s.actors) if (a instanceof CampPotion) a.gone = true;
        if (this.t > 400 && !thieves) this.finishCamp();
        break;
      }
      case 'ending':
        if (this.t > 60 && (pr.start || pr.attack || pr.any)) this.endEnding();
        break;
      case 'continue':
        // like feeding the arcade another coin: carry on where you fell
        this.stage!.update();
        if (this.t > 30 && (pr.start || pr.attack || pr.jump)) {
          for (const h of this.heroes) {
            if (h.state !== 'gameover') continue;
            h.lives = 2;
            h.respawn();
          }
          this.go('play');
        } else if (this.t >= 600) {
          this.go('gameover');
          audio.music('gameover');
        }
        break;
      case 'gameover':
        if (this.t > 120 && (pr.start || pr.attack)) this.go('title');
        break;
    }
  }

  /** Is the left (-1) or right (1) end of the area a way out? The right opens with the boss beaten. */
  exitOpen(dir: number): boolean {
    return dir < 0 || !this.stage!.scripted;
  }

  /** The player walks off an end of the area (with no fight on): back to the map. */
  private checkExits(s: Stage) {
    if (s.engaged) return;
    const p = this.players.find((h) => !h.dead && h.state !== 'gameover');
    if (!p || !p.pad.x) return;
    const sx = (p.mount ?? p).x - s.left;
    const [lo, hi] = s.camLimits;
    const dir = p.pad.x < 0 && sx < 20 && s.camx >= hi ? -1 : p.pad.x > 0 && sx > 300 && s.camx <= lo ? 1 : 0;
    if (!dir || !this.exitOpen(dir)) return;
    // on the map they stand at this area, and walk back in at the end they left by
    const at = placeOf(this.area);
    this.close(() => this.openWorld(at, dir > 0 ? 'right' : 'left'));
  }

  /** Close the view into a box, then do `next`. */
  private close(next: () => void) {
    this.next = next;
    this.go('travel');
  }

  /** The world map, with the party at a place on the route; saved on arrival. */
  openWorld(at: number, side: 'left' | 'right' = 'left') {
    this.world = new WorldMap(this.cleared, at, side);
    this.stage = null;
    this.go('world');
    this.save();
  }

  /** Into a place chosen on the map: an area (at the end the party walked up to) or a camp. */
  private enter(p: Place) {
    if (p.kind === 'camp') void this.enterCamp(p.area);
    else void this.loadArea(p.area, false, this.world!.side);
  }

  /** the party as it stands, for the map and the save: the heroes, or a saved party not yet made */
  get party(): SaveData['party'] {
    if (this.heroes.length) return this.heroes.map((h) => ({ hero: h.index, cpu: h.cpu, prog: h.prog.snapshot() }));
    return this.pending ?? [];
  }

  save() {
    if (!this.party.length || !this.world) return;
    writeSave({ v: 1, party: this.party, visited: [...this.visited], cleared: [...this.cleared], at: this.world.at, side: this.world.side });
  }

  /** Carry on a saved journey from the map. */
  continueGame(d: SaveData) {
    this.heroes = [];
    this.pending = d.party;
    this.choice = d.party[0].hero;
    this.visited = new Set(d.visited);
    this.cleared = new Set(d.cleared);
    this.openWorld(Math.min(d.at, ROUTE.length - 1), d.side);
  }

  private selMove = 0;
  private toastText = '';
  private toastTimer = 0;

  /** a short message across the top of the screen */
  toast(text: string) {
    this.toastText = text;
    this.toastTimer = 90;
  }
  private selMoveY = 0;

  /** the heroes people play (all of them when the computer plays alone, in tests) */
  get players() {
    const people = this.heroes.filter((h) => !h.cpu);
    return people.length ? people : this.heroes;
  }

  togglePartner() {
    this.partner = !this.partner;
    save('ga.partner', this.partner ? 'on' : 'off');
  }

  /** the partner takes the next hero along from the player's */
  get partnerChoice() {
    return SELECT_ORDER[(SELECT_ORDER.indexOf(this.choice) + 1) % 3];
  }

  /** the party as chosen on the select screen, fresh */
  private freshParty(): SaveData['party'] {
    const fresh = (hero: number, cpu: boolean) => ({ hero, cpu, prog: new Progress(hero).snapshot() });
    return [fresh(this.choice, false), ...(this.partner ? [fresh(this.partnerChoice, true)] : [])];
  }

  /** Make the heroes (they need a stage) from the party waiting for them, grown as they were. */
  private makeHeroes(s: Stage): Hero[] {
    const party = this.pending ?? this.freshParty();
    this.pending = null;
    const hs = party.map((m) => {
      const h = new Hero(s, m.hero);
      h.prog.restore(m.prog);
      h.refreshStats();
      h.hp = h.maxHp;
      return h;
    });
    party.forEach((m, i) => { if (m.cpu) hs[i].brain = new Brain(hs[i], hs[0]); });
    // ?auto: the computer plays player 1 too (for tests)
    if (new URLSearchParams(location.search).has('auto')) hs[0].brain = new Brain(hs[0], null);
    return hs;
  }
  /** an area opens out of a box, as the original does after the map */
  private opening = 0;
  private bossMusic = false;
  private areaCleared = false;

  go(s: State) {
    this.state = s;
    this.t = 0;
  }

  /** A camp on the map: the night scene at the end of the area it follows. */
  async enterCamp(n: number) {
    this.go('loading');
    const s = new Stage(n);
    await s.load();
    s.roam = false;
    s.scripted = false;
    // the arcade camera, held at the area's end (past its last scroll stop)
    s.camx = s.camLimits[0];
    s.stopIndex = s.data.stops.length - 1;
    this.area = n;
    if (!this.heroes.length) this.heroes = this.makeHeroes(s);
    for (const h of this.heroes) {
      h.stage = s;
      h.dead = false;
      h.gone = false;
    }
    s.heroes = this.heroes;
    s.actors.push(...this.heroes);
    this.stage = s;
    this.startCamp();
  }

  /** Morning: rested (health and magic full), saved, and back to the map. */
  private finishCamp() {
    for (const h of this.heroes) {
      h.hp = h.maxHp;
      h.prog.mp = h.prog.maxMp;
      if (h.state === 'gameover' || h.lives < 2) h.lives = 2;
    }
    const at = ROUTE.findIndex((p) => p.kind === 'camp' && p.area === this.area);
    this.close(() => {
      this.openWorld(at);
      this.world!.t = -60;
      this.toast('RESTED. JOURNEY SAVED');
    });
  }

  /** Night falls: the camp. */
  startCamp() {
    const s = this.stage!;
    this.go('camp');
    audio.music('camp');
    s.camp = true;
    s.shown++; // the HUD counts the camp as a stage of its own
    s.buildLayers();
    s.actors = s.actors.filter((a) => a.isHero);
    // the camp script places the sleepers (0x2b0ae, 0x2b0b4)
    const spots = (s.data.camp ?? []).filter((c) => c[4] === 0x2b0ae || c[4] === 0x2b0b4);
    const [cx, cz] = spots.length ? [spots[0][1], spots[0][2]] : [0x1000 - s.camx + 130, 0x1080];
    this.heroes.forEach((h, i) => {
      if (h.mount) {
        h.mount.setRider(null);
        h.mount = null;
      }
      h.x = spots[i]?.[1] ?? cx;
      h.z = s.floorZ(h.x, spots[i]?.[2] ?? cz);
      h.y = h.ground;
      h.facing = 1;
      h.setState('sleep', h.anims.lie);
    });
    s.actors.push(new Campfire(s, cx + 24, s.floorZ(cx + 24, cz + 2)));
  }

  /** The original's ending, rendered from a recording into a video with its music. */
  startEnding() {
    this.go('ending');
    audio.music(null);
    const v = document.getElementById('ending') as HTMLVideoElement;
    const c = document.getElementById('screen')!.getBoundingClientRect();
    Object.assign(v.style, { left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, height: `${c.height}px` });
    v.src = `${import.meta.env.BASE_URL}assets/ending.mp4`;
    v.classList.add('show');
    v.onended = () => this.endEnding();
    v.onerror = () => this.endEnding();
    void v.play().catch(() => this.endEnding());
  }

  endEnding() {
    const v = document.getElementById('ending') as HTMLVideoElement;
    v.pause();
    v.classList.remove('show');
    v.removeAttribute('src');
    this.go('title');
  }

  /** Near an open end of the area: where it leads. */
  private drawSigns(s: Stage) {
    if (!s.roam || s.engaged) return;
    const [lo, hi] = s.camLimits;
    if (s.camx >= hi && this.exitOpen(-1)) drawText('< MAP', 8, 44, '#ff0');
    if (s.camx <= lo && this.exitOpen(1)) drawText('MAP >', W - 8, 44, '#ff0', 'right');
  }

  /** A new journey: from the map's first place (or straight into ?area=n, for tests). */
  startGame() {
    this.heroes = [];
    this.pending = null;
    this.visited.clear();
    this.cleared.clear();
    // the party as chosen (the heroes themselves are made on entering an area)
    this.pending = this.freshParty();
    const area = new URLSearchParams(location.search).get('area');
    if (area !== null) {
      this.world = new WorldMap(this.cleared, placeOf(Number(area)));
      void this.loadArea(Number(area), true);
    } else this.openWorld(0);
  }

  /** Open an area, the heroes coming in from its left end (or its right, walking back). */
  async loadArea(n: number, fresh = false, from: 'left' | 'right' = 'left') {
    this.go('loading');
    const s = new Stage(n);
    await s.load();
    this.area = n;
    s.scripted = !this.visited.has(n);
    this.visited.add(n);
    if (from === 'right') s.camx = s.camLimits[0];
    if (fresh || !this.heroes.length) this.heroes = this.makeHeroes(s);
    this.heroes.forEach((h, i) => {
      if (h.mount) {
        h.mount.setRider(null);
        h.mount = null;
      }
      h.stage = s;
      h.x = from === 'right' ? s.left + 260 + i * 24 : 0x1000 - s.camx + 60 - i * 24;
      h.z = 0x1080;
      // find solid ground near the left of the screen
      for (let z = 0x1040 + i * 24; z < 0x1100; z += 4) {
        const g = s.groundAt(h.x, z);
        if (g > 0xf00 && g < 0x1480) { h.z = z; break; }
      }
      h.y = h.ground;
      h.facing = from === 'right' ? -1 : 1;
      h.setState('stand', h.anims.idle);
    });
    s.heroes = this.heroes;
    s.actors.push(...this.heroes);
    this.stage = s;
    this.bossMusic = false;
    this.areaCleared = false;
    this.go('play');
    this.opening = 30;
    audio.music(`area${n}`);
  }

  draw() {
    fillRect(0, 0, W, H, '#000');
    switch (this.state) {
      case 'title': {
        if (assets.title) ctx.drawImage(assets.title, 0, 0);
        const saved = loadSave();
        if (saved) {
          const lead = saved.party[0];
          ['CONTINUE', 'NEW GAME'].forEach((l, i) => {
            const on = i === this.titleChoice;
            drawText(`${on ? '> ' : ''}${l}${on ? ' <' : ''}`, W / 2, 112 + i * 14, on ? '#ff0' : '#36f', 'center');
          });
          drawText(`${HEROES[lead.hero].name.split(' ')[0]} LV${lead.prog.level}  ${ROUTE[Math.min(saved.at, ROUTE.length - 1)].name}`, W / 2, 144, '#8af', 'center');
        } else if ((this.t >> 5) & 1) drawText(input.touch ? 'TAP TO START' : 'PRESS START', W / 2, 116, '#36f', 'center');
        break;
      }
      case 'world':
        this.world!.draw(this.party.map((m) => ({ hero: m.hero, prog: m.prog })));
        break;
      case 'select': {
        // the original's skull, with the heroes standing on its hands
        if (assets.select) ctx.drawImage(assets.select, 0, 0);
        SELECT_ORDER.forEach((i, slot) => {
          const h = HEROES[i], x = 62 + slot * 98, on = i === this.choice;
          drawSprite(0x1c2 + i, h.pal, x, 176 - (on ? 4 : 0), false);
          if (!on) drawSpriteTinted(0x1c2 + i, x, 176, false, '#000', 0.5);
          drawText(h.name.split(' ')[0], x, 180, on ? '#ff0' : '#aaa', 'center');
        });
        // how to play, for whatever the player is holding
        const pad = (navigator.getGamepads?.() ?? []).some((g) => g);
        const help = input.touch
          ? ['TAP A HERO TWICE TO START', 'FLICK THE STICK TWICE TO RUN']
          : pad
            ? ['X ATTACK  A JUMP  Y MAGIC  B BACK ATTACK', 'HOLD RB TO RUN (OR TAP TWICE)']
            : ['ARROWS/WASD  J ATTACK  K JUMP  L MAGIC', 'TAP TWICE TO RUN  J+K: BACK ATTACK'];
        help.forEach((l, i) => drawText(l, W / 2, 202 + i * 10, '#8af', 'center'));
        const how = input.touch ? 'TAP HERE' : 'UP OR DOWN';
        drawText(this.partner ? `CPU PARTNER: ${HEROES[this.partnerChoice].name.split(' ')[0]}` : 'CPU PARTNER: OFF', W / 2, 6,
          this.partner ? '#ff0' : '#888', 'center');
        drawText(`${how} TO CHANGE`, W / 2, 16, '#8af', 'center');
        break;
      }
      case 'loading':
        drawText('LOADING', W / 2, H / 2, '#888', 'center');
        break;
      case 'camp':
        this.stage!.draw();
        drawHud(this.stage!, this.heroes, AREA_NAMES[this.area]);
        if (this.t < 240) {
          drawText(ROUTE.find((p) => p.kind === 'camp' && p.area === this.area)?.name ?? 'CAMP', W / 2, 40, '#f80', 'center');
          drawText('REST UNTIL MORNING', W / 2, 54, '#fff', 'center');
        }
        if (this.paused) drawText('PAUSED', W / 2, 100, '#fff', 'center');
        break;
      case 'travel': {
        this.stage!.draw();
        const k = 1 - Math.min(30, this.t) / 30, bw = W * k, bh = H * k;
        fillRect(0, 0, W, (H - bh) / 2, '#000');
        fillRect(0, (H + bh) / 2, W, (H - bh) / 2 + 1, '#000');
        fillRect(0, 0, (W - bw) / 2, H, '#000');
        fillRect((W + bw) / 2, 0, (W - bw) / 2 + 1, H, '#000');
        break;
      }
      case 'play':
      case 'clear':
        this.stage!.draw();
        drawHud(this.stage!, this.heroes, AREA_NAMES[this.area]);
        if (this.state === 'play') this.drawSigns(this.stage!);
        if (this.state === 'clear') drawText('STAGE CLEAR', W / 2, 90, '#ff0', 'center');
        if (this.opening > 0) {
          const k = 1 - this.opening / 30, bw = W * k, bh = H * k;
          fillRect(0, 0, W, (H - bh) / 2, '#000');
          fillRect(0, (H + bh) / 2, W, (H - bh) / 2 + 1, '#000');
          fillRect(0, 0, (W - bw) / 2, H, '#000');
          fillRect((W + bw) / 2, 0, (W - bw) / 2 + 1, H, '#000');
        }
        if (this.paused) {
          if (this.menu) this.menu.draw();
          else drawText('PAUSED', W / 2, 100, '#fff', 'center');
        }
        break;
      case 'continue': {
        this.stage!.draw();
        drawHud(this.stage!, this.heroes, AREA_NAMES[this.area]);
        fillRect(0, 70, W, 70, 'rgba(0,0,0,0.6)');
        drawText('CONTINUE?', W / 2, 84, '#ff0', 'center');
        drawText(String(9 - Math.floor(this.t / 60)), W / 2, 100, '#fff', 'center');
        if ((this.t >> 4) & 1) drawText(input.touch ? 'TAP TO CONTINUE' : 'PRESS ATTACK TO CONTINUE', W / 2, 118, '#8af', 'center');
        break;
      }
      case 'gameover':
        drawText('GAME OVER', W / 2, H / 2, '#f22', 'center');
        break;
    }
    if (this.state === 'title' || this.state === 'select') this.toastTimer = 0;
    if (this.toastTimer > 0 && !this.paused) {
      this.toastTimer--;
      fillRect(0, 26, W, 13, 'rgba(0,0,0,0.6)');
      drawText(this.toastText, W / 2, 29, '#ff0', 'center');
    }
    void ctx;
  }
}
