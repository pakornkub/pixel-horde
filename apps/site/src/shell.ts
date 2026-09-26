// Header, footer and language switch shared by every page.
import { hero } from './art';
import { applyStatic, lang, onLang, s, switchLang } from './lang';
import type { TextKey } from './text';
import './style.css';

/** The game lives at /play/ next to the site; in dev it runs on its own Vite server. */
export const PLAY_URL: string = import.meta.env.DEV ? 'http://localhost:5173/' : './play/';
export const REPO_URL = 'https://github.com/pakornkub/pixel-horde';

type Page = 'home' | 'guide' | 'skills' | 'world' | 'updates';
const LINKS: [Page, string, TextKey][] = [
  ['home', './', 'nav.home'],
  ['guide', './guide.html', 'nav.guide'],
  ['skills', './skills.html', 'nav.skills'],
  ['world', './world.html', 'nav.world'],
  ['updates', './updates.html', 'nav.updates'],
];

export function shell(page: Page): void {
  const head = document.createElement('header');
  head.className = 'top';
  head.innerHTML = `
    <a class="brand" href="./" aria-label="Pixel Horde"><span class="brand-hero"></span><span class="brand-name">PIXEL<br>HORDE</span></a>
    <button class="menu-btn" aria-expanded="false" aria-controls="nav" data-t-aria="nav.menu"><span></span><span></span><span></span></button>
    <nav id="nav" class="nav">
      ${LINKS.map(([id, href, key]) => `<a href="${href}"${id === page ? ' aria-current="page"' : ''} data-t="${key}"></a>`).join('')}
      <button class="lang-btn" type="button" data-t="nav.lang" data-t-aria="nav.langAria"></button>
      <a class="btn btn-play sm" href="${PLAY_URL}" data-t="nav.play"></a>
    </nav>`;
  head.querySelector('.brand-hero')!.append(hero('mage', 2));
  const menu = head.querySelector<HTMLButtonElement>('.menu-btn')!;
  menu.addEventListener('click', () => {
    const open = head.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  head.querySelector('.lang-btn')!.addEventListener('click', () => switchLang(lang() === 'th' ? 'en' : 'th'));
  document.body.prepend(head);

  const foot = document.createElement('footer');
  foot.className = 'foot';
  foot.innerHTML = `
    <div class="wrap foot-in">
      <div><p class="foot-logo">PIXEL HORDE</p><p data-t="foot.tag"></p></div>
      <div class="foot-links">
        <a href="${PLAY_URL}" data-t="foot.play"></a>
        ${LINKS.slice(1).map(([, href, key]) => `<a href="${href}" data-t="${key}"></a>`).join('')}
        <a href="${PLAY_URL}privacy.html" data-t="foot.privacy"></a>
        <a href="${REPO_URL}" rel="noopener" data-t="foot.source"></a>
      </div>
    </div>
    <p class="wrap foot-note" data-t="foot.data"></p>`;
  document.body.append(foot);

  // Play links placed in page markup.
  document.querySelectorAll<HTMLAnchorElement>('a[data-play]').forEach((a) => { a.href = PLAY_URL; });
  applyStatic();
  onLang(() => applyStatic());
}

/** Re-render a page part now and whenever the language changes. */
export function live(render: () => void): void {
  render();
  onLang(render);
}

/** Scroll to the URL's #section once a page has built its content (it may wait for the live config first). */
export function toHash(): void {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id) document.getElementById(id)?.scrollIntoView();
}

/** Section helper: reveal-on-scroll for elements with .reveal. */
export function reveals(): void {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach((e) => io.observe(e));
}

export { s };
