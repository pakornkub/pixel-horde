import { DEFAULT_RESOLVED, HERO_IDS, REALMS, REALM_IDS, signatureOf, type HeroId } from '@pixel-horde/sim';
import { el, enemy, groundURL, hero, pickup, skillIcon, weaponIcon } from '../art';
import { siteConfig } from '../backend';
import { heroScene } from '../hero-scene';
import { g, s } from '../lang';
import { live, reveals, shell } from '../shell';
import type { TextKey } from '../text';

shell('home');
heroScene(document.querySelector<HTMLCanvasElement>('canvas.scene')!);

// Section backgrounds painted with the game's own tiles.
document.querySelectorAll<HTMLElement>('[data-ground]').forEach((sec, i) => {
  sec.style.backgroundImage = `url(${groundURL(Number(sec.dataset.ground), 16, 10, i * 7)})`;
});

// ── 3 steps ──
{
  const a1 = document.getElementById('step1')!;
  a1.style.backgroundImage = `url(${groundURL(0, 8, 6, 3)})`;
  const keys = el('div.keycaps', null, ...['W', 'A', 'S', 'D'].map((k) => el('span.key', null, k)));
  a1.append(el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:12px' }, hero('knight', 4, 'r'), keys));
  let i = 0;
  setInterval(() => { keys.querySelectorAll('.key').forEach((k, j) => k.classList.toggle('on', j === i % 4)); i++; }, 600);

  const a2 = document.getElementById('step2')!;
  a2.style.backgroundImage = `url(${groundURL(1, 8, 6, 5)})`;
  const ring = el('div', { style: 'position:relative;width:170px;height:120px' });
  ring.append(el('div', { style: 'position:absolute;left:61px;top:28px' }, hero('mage', 3)));
  (['bolt', 'nova', 'chain', 'frost'] as const).forEach((id, k) => {
    const ic = skillIcon(id, 'sm');
    ic.style.cssText = `position:absolute;left:${[8, 132, 8, 132][k]}px;top:${[8, 8, 84, 84][k]}px`;
    ring.append(ic);
  });
  ring.append(el('div', { style: 'position:absolute;left:0;top:44px' }, enemy('scorp', 2)), el('div', { style: 'position:absolute;right:0;top:48px' }, enemy('sslime', 2)));
  a2.append(ring);

  const a3 = document.getElementById('step3')!;
  a3.style.backgroundImage = `url(${groundURL(3, 8, 6, 2)})`;
  a3.append(el('div', { style: 'display:flex;gap:10px;align-items:center' }, pickup('gem', 4), pickup('gemBig', 4), el('span', { style: 'font:400 20px var(--pix);color:#fff;text-shadow:2px 2px 0 var(--ink)' }, '→'),
    el('div', { style: 'display:flex;flex-direction:column;gap:6px' }, skillIcon('meteor', 'sm'), skillIcon('orbit', 'sm'), skillIcon('lance', 'sm'))));
}

// ── screenshots ──
const SHOTS: [string, TextKey, boolean?][] = [
  ['play', 'shot.play', true], ['level', 'shot.level'], ['king', 'shot.king'], ['moon', 'shot.moon'], ['realm', 'shot.realm'], ['hero', 'shot.hero'], ['title', 'shot.title'],
];
const lightbox = document.getElementById('lightbox')!;
lightbox.addEventListener('click', () => { lightbox.hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox.hidden = true; });
live(() => {
  const grid = document.getElementById('shotGrid')!;
  grid.replaceChildren(...SHOTS.map(([f, key, feature]) => {
    const img = el('img', { src: `./shots/${f}.png`, alt: s(key), loading: 'lazy', width: '1280', height: '720' });
    const fig = el(`figure.shot${feature ? '.feature' : ''}.reveal.in`, { tabindex: '0' }, img, el('figcaption', null, s(key)));
    const open = (): void => {
      lightbox.querySelector('img')!.src = img.src;
      lightbox.querySelector('img')!.alt = s(key);
      lightbox.querySelector('p')!.textContent = s(key);
      lightbox.hidden = false;
    };
    fig.addEventListener('click', open);
    fig.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    return fig;
  }));
});

// ── heroes ──
const HERO_GROUND: Record<HeroId, number> = { mage: 2, knight: 0, ranger: 7, alchemist: 6 };
let H = DEFAULT_RESOLVED.heroes; // prices follow the live Balance Config once it arrives
const drawHeroes = (): void => {
  document.getElementById('heroGrid')!.replaceChildren(...HERO_IDS.map((id) => {
    const cost = H[id].cost;
    const stage = el('div.stage', null, hero(id, 6));
    stage.style.backgroundImage = `url(${groundURL(HERO_GROUND[id], 8, 6, 1)})`;
    const sig = signatureOf(id);
    return el('article.panel.hero-card.reveal.in', null,
      el('span.price', null, cost ? `${cost}G` : s('home.free')),
      stage,
      el('p.name', null, g(`hero.${id}.name`)),
      el('p.role', null, g(`hero.${id}.role`)),
      el('div.sigrow', null, skillIcon(sig, 'sm'), el('span', null, `${s('home.sig')}: ${g(`skill.${sig}.name`)}`)),
      el('p.muted', { style: 'font-size:14px' }, g(`hero.${id}.desc`)));
  }));
};
live(drawHeroes);
void siteConfig().then((c) => { H = c.heroes; drawHeroes(); });

// ── features ──
type Feat = [TextKey, TextKey, () => Node, number];
const FEATS: Feat[] = [
  ['home.f.combo.h', 'home.f.combo.p', () => el('div', { style: 'display:flex;gap:4px' }, skillIcon('frost', 'sm'), skillIcon('meteor', 'sm')), 3],
  ['home.f.kings.h', 'home.f.kings.p', () => enemy('boss', 2), 0],
  ['home.f.route.h', 'home.f.route.p', () => el('span', { style: 'font:400 22px var(--pix);color:var(--gold)' }, '8'), 1],
  ['home.f.moon.h', 'home.f.moon.p', () => enemy('dragon', 1), 5],
  ['home.f.coop.h', 'home.f.coop.p', () => el('div', { style: 'display:flex' }, hero('ranger', 2), hero('alchemist', 2)), 7],
  ['home.f.weapon.h', 'home.f.weapon.p', () => weaponIcon('glacierLance', 6), 3],
  ['home.f.board.h', 'home.f.board.p', () => pickup('coin', 5), 1],
  ['home.f.save.h', 'home.f.save.p', () => pickup('chest', 4), 0],
];
live(() => {
  document.getElementById('featGrid')!.replaceChildren(...FEATS.map(([h, p, art, th]) => {
    const box = el('div.fart', null, art());
    box.style.backgroundImage = `url(${groundURL(th, 4, 4, 9)})`;
    return el('div.feat.reveal.in', null, box, el('div', null, el('h3', null, s(h)), el('p', null, s(p))));
  }));
});

// ── realms strip ──
live(() => {
  document.getElementById('realmStrip')!.replaceChildren(...REALM_IDS.map((r, i) => {
    const R = REALMS[r];
    const g1 = el('div.rg', null, enemy(R.pool[0], 2), enemy(R.king, 2), enemy(R.pool[1], 2));
    g1.style.backgroundImage = `url(${groundURL(R.theme, 8, 6, i)})`;
    return el('a.realm-tile', { href: `./world.html#realm-${r}` }, g1, el('div.rn', null, el('b', null, g(`realm.${r}.name`)), el('span', null, g(`realm.${r}.king`))));
  }));
});

document.getElementById('endHeroes')!.append(...HERO_IDS.map((id) => hero(id, 4)));
reveals();
