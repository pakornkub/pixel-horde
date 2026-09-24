// Title screen (ticket 43): animated Hero, current Hero + Weapon, Hero panel, background picture.
import { t } from '@pixel-horde/i18n';
import { META } from '../meta';
import { HERO_SPR } from '../render/sprites';
import { $, hide, renderChars, show } from './overlays';
import { heroName } from './text';

/**
 * Chosen title backgrounds (16:9 and 9:16 pixel-art WebP ≤ ~300 KB in `public/bg/`). Until the
 * owner picks them, the title shows the live Greenvale tile scene instead.
 */
export const TITLE_BG: { wide: string | null; tall: string | null } = { wide: null, tall: null };

function applyBackground(): void {
  const el = $('titleBg');
  const tall = innerHeight > innerWidth;
  const file = tall ? TITLE_BG.tall ?? TITLE_BG.wide : TITLE_BG.wide ?? TITLE_BG.tall;
  el.classList.toggle('img', !!file);
  if (!file) { el.style.backgroundImage = ''; return; }
  const url = import.meta.env.BASE_URL + 'bg/' + file;
  const im = new Image(); // solid colour until the picture has loaded
  im.onload = () => { el.style.backgroundImage = `url("${url}")`; };
  im.src = url;
}

/** Hero name + Weapon under the animated Hero. */
export function renderTitleSel(): void {
  $('titleSel').textContent = heroName(META.ch) + ' · ' + t(`weapon.${META.weapon}.name`);
}

function drawHero(now: number): void {
  if ($('ovTitle').classList.contains('on')) {
    const c = $('titleHero') as HTMLCanvasElement, x = c.getContext('2d')!;
    const spr = HERO_SPR[META.ch] || HERO_SPR.mage, fr = Math.floor(now / 260) & 1, bob = fr ? -4 : 0;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(30,27,51,.35)';
    x.beginPath(); x.ellipse(32, 58, 16, 4, 0, 0, Math.PI * 2); x.fill();
    const im = spr.r[fr], k = Math.floor(64 / Math.max(im.width, im.height));
    x.drawImage(im, Math.round((64 - im.width * k) / 2), 60 - im.height * k + bob, im.width * k, im.height * k);
  }
  requestAnimationFrame(drawHero);
}

export function initTitle(): void {
  const open = (): void => { renderChars(); hide('ovTitle'); show('ovHero'); };
  $('heroBtn').addEventListener('click', open);
  $('heroBtn2').addEventListener('click', open);
  $('heroDone').addEventListener('click', () => { hide('ovHero'); renderTitleSel(); show('ovTitle'); });
  addEventListener('resize', applyBackground);
  applyBackground();
  renderTitleSel();
  requestAnimationFrame(drawHero);
}
