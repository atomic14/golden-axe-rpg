// The heads-up display: the area and the equipped spell at the top; each hero's level, health,
// magic and experience at the bottom beside their portrait.
import { ctx, drawSprite, drawText, fillRect } from '../gfx';
import { input } from '../input';
import type { Hero } from './hero';
import type { Stage } from './stage';
import { xpToNext } from './rpg';
import { party } from './party';

function bar(x: number, y: number, w: number, h: number, v: number, max: number, color: string) {
  fillRect(x - 1, y - 1, w + 2, h + 2, '#000');
  fillRect(x, y, w, h, '#223');
  if (v > 0) fillRect(x, y, Math.max(1, Math.round((w * Math.min(v, max)) / max)), h, color);
}

export function drawHud(stage: Stage, heroes: Hero[], areaName: string) {
  drawText(areaName, 8, 6, '#f80');
  const p1 = heroes.find((h) => !h.cpu) ?? heroes[0];
  if (p1) {
    const s = p1.spell;
    drawText(`${s.name} ${s.mp}MP`, 312, 6, p1.canCast ? '#8cf' : '#646', 'right');
    drawText(`${party.gold}G`, 8, 16, '#fd0');
    if (p1.prog.points > 0 && (stage.time >> 5) & 1) {
      drawText(`SKILL POINT! ${input.touch ? 'TAP II' : 'PRESS P'}`, 312, 16, '#ff0', 'right');
    }
  }
  heroes.forEach((h, i) => {
    const x0 = 12 + i * 160;
    const p = h.prog;
    drawText(`LV${p.level}`, x0, 190, '#ff0');
    drawText(`${Math.max(0, Math.ceil(h.hp))}`, x0 + 96, 190, h.hp < h.maxHp / 4 ? '#f44' : '#fff', 'right');
    bar(x0, 200, 96, 5, h.hp, h.maxHp, h.hp < h.maxHp / 4 ? '#e22' : '#2c4');
    bar(x0, 208, 96, 3, p.mp, p.maxMp, '#38f');
    bar(x0, 214, 96, 1, p.xp, xpToNext(p.level), '#dd4');
    drawText(String(Math.max(0, h.lives)), x0 + 104, 205, '#ff0');
    if (h.cpu && heroes.some((o) => !o.cpu)) drawText('CPU', x0 + 40, 190, '#8af');
    // the portrait at half size, as the original shows it
    ctx.save();
    ctx.translate(x0 + 128, 214);
    ctx.scale(0.5, 0.5);
    drawSprite(h.def.face, h.def.pal, 0, 0, false);
    ctx.restore();
  });
}
