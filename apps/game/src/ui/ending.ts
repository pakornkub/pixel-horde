// Ending after beating Umbra (ticket 55): four story pictures, then what this win really unlocked.
// The first win shows the whole story; a later win opens on the "Unlocked" page (the story can be replayed).
import { onLangChange, t } from '@pixel-horde/i18n';
import { HERO_IDS, newAchievements, runFacts, type HeroId, type SimState, type WeaponId } from '@pixel-horde/sim';
import { active } from '../config';
import { META, metaSync, ownsHero } from '../meta';
import { HELD_SPR } from '../render/sprites';
import { $, charImg, show } from './overlays';
import { unlocksOf, unlockText, type Unlock } from './unlocks';

/** Hero sold after the first win (ticket 57); its line shows only once the build has it. */
const AFTER_WIN_HERO = 'necromancer';

/**
 * What this win unlocked, read at the victory screen BEFORE the win is recorded (Heart Crack unlock,
 * lifetime totals). `craterWeapons` = Weapons found in the Heart Crater this Run (Umbra's).
 */
export function winUnlocks(v: Readonly<SimState>, craterWeapons: WeaponId[]): { firstWin: boolean; unlocks: Unlock[] } {
  const firstWin = !metaSync.hasWon();
  const heroIn = (HERO_IDS as readonly string[]).includes(AFTER_WIN_HERO) && !ownsHero(AFTER_WIN_HERO as HeroId);
  const heroCost = (active.cfg.heroes as Record<string, { cost?: number } | undefined>)[AFTER_WIN_HERO]?.cost ?? 0;
  return {
    firstWin,
    unlocks: unlocksOf({
      firstWin,
      crack: v.crack, crackMaxBefore: META.crackMax,
      maxTier: v.cfg.heartCrack.maxTier,
      weapons: craterWeapons, umbraGold: v.cfg.weapons.umbraGold,
      ach: newAchievements(runFacts(v), META.life, META.ach),
      special: true, // the special shop opens with the first win (ticket 56)
      hero: heroIn ? { id: AFTER_WIN_HERO, name: t(`hero.${AFTER_WIN_HERO}.name`), cost: heroCost } : null,
    }),
  };
}

/** Pixel sprite as an <img> (weapon held in hand, Hero), else a coloured glyph tile. */
function unlockIcon(u: Unlock): HTMLElement {
  const sprite = (src: HTMLCanvasElement | undefined): string => {
    if (!src) return '';
    const c = document.createElement('canvas'), k = Math.max(1, Math.floor(32 / Math.max(src.width, src.height)));
    c.width = src.width * k; c.height = src.height * k;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    try { return c.toDataURL(); } catch { return ''; }
  };
  const url = u.k === 'weapon' ? sprite(HELD_SPR[u.id]?.[0]) : u.k === 'special' ? sprite(HELD_SPR.judgement?.[0]) : u.k === 'hero' ? charImg(u.id) : '';
  const el = document.createElement('span');
  el.className = 'uico ' + u.k;
  if (url) { const im = document.createElement('img'); im.src = url; im.alt = ''; el.append(im); }
  else el.textContent = { crack: '♥', crackTop: '♛', endless: '∞', gold: 'G', ach: '★', achs: '★' }[u.k as string] ?? '•';
  return el;
}

const PANELS = ['ending.p1', 'ending.l1', 'ending.l2', 'ending.l3'] as const;
const picUrl = (i: number): string => `${import.meta.env.BASE_URL}ending/p${i + 1}-${innerHeight > innerWidth ? 'tall' : 'wide'}.webp`;
let step = 0;
let shown: Unlock[] = [];

/** Start fetching the pictures (called when the Heart Crater Stage starts), so the story never waits on the network. */
export function preloadEnding(): void {
  for (let i = 0; i < PANELS.length; i++) { const im = new Image(); im.src = picUrl(i); }
}

function render(): void {
  const story = step < PANELS.length, i = Math.min(step, PANELS.length - 1);
  $('ovEnding').classList.toggle('story', story);
  $('endPic').style.backgroundImage = `url("${picUrl(i)}")`;
  $('endStory').hidden = !story;
  $('endUnlock').hidden = story;
  if (story) {
    $('endHead').hidden = i !== 1; // "Lumora is saved" over the whole, beating Heart
    $('endCap').textContent = t(PANELS[i]);
    $('endDots').innerHTML = PANELS.map((_, n) => `<span${n === i ? ' class="on"' : ''}></span>`).join('');
    $('endNext').textContent = i === PANELS.length - 1 ? t('ending.toUnlocks') : t('ending.next');
    $('endNext').focus({ preventScroll: true });
  } else {
    const list = $('endList');
    list.textContent = '';
    for (const u of shown) {
      const li = document.createElement('li');
      const tx = document.createElement('span'); tx.textContent = unlockText(u);
      li.append(unlockIcon(u), tx);
      list.append(li);
    }
    $('endNone').hidden = shown.length > 0;
    $('endlessBtn').focus({ preventScroll: true });
  }
}

function advance(): void { if (step < PANELS.length) { step++; render(); } }

/** Open the ending: the story first on the account's first win, else straight to the "Unlocked" page. */
export function openEnding(firstWin: boolean, unlocks: Unlock[]): void {
  step = firstWin ? 0 : PANELS.length;
  shown = unlocks;
  show('ovEnding');
  render();
}

/** `?debug=ending` (first win) or `?debug=ending:later` (a later win on Heart Crack 1): the ending over the title, with sample unlocks, for art review and tests. */
export function debugEnding(search: string): void {
  const flags = (new URLSearchParams(search).get('debug') || '').split(',');
  const later = flags.includes('ending:later');
  if (!later && !flags.includes('ending')) return;
  const maxTier = active.cfg.heartCrack.maxTier;
  const heroIn = (HERO_IDS as readonly string[]).includes(AFTER_WIN_HERO);
  openEnding(!later, unlocksOf({
    firstWin: !later, crack: later ? 1 : 0, crackMaxBefore: later ? 1 : 0, maxTier,
    weapons: later ? [] : ['glacierLance'], umbraGold: active.cfg.weapons.umbraGold, ach: later ? ['winBram'] : ['firstKing', 'chapter4', 'crater', 'heartKeeper', 'kingslayer', 'winLyra'], // a real first win earns about this many
    special: true,
    hero: heroIn ? { id: AFTER_WIN_HERO, name: t(`hero.${AFTER_WIN_HERO}.name`), cost: 0 } : null,
  }));
}

export function initEnding(): void {
  $('endNext').addEventListener('click', advance);
  $('endPic').addEventListener('click', advance);
  $('endSkip').addEventListener('click', () => { step = PANELS.length; render(); });
  $('endReplay').addEventListener('click', () => { step = 0; render(); });
  onLangChange(() => { if ($('ovEnding').classList.contains('on')) render(); });
  addEventListener('resize', () => { if ($('ovEnding').classList.contains('on')) $('endPic').style.backgroundImage = `url("${picUrl(Math.min(step, PANELS.length - 1))}")`; });
}
