// Updates page: the game's changelog (patch notes), read live from the database so balance updates
// published from the Admin Console show here without a new deploy.
import { CAT_LABEL, CHANGE_KINDS, KIND_LABEL, groupItems, type ChangeEntry, type ChangeKind } from '@pixel-horde/config';
import { el, enemy, hero } from '../art';
import { lang, s } from '../lang';
import { live, shell } from '../shell';
import { T, pageHead } from '../ui';

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://jqvgmkhzdhjreikjqhxt.supabase.co';
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_g90qGZet0U9BylLeZrPnNQ_iYjBfDPA';

shell('updates');
const main = document.getElementById('main')!;
main.append(pageHead('up.h', 'up.p', 1, [hero('mage', 3), hero('knight', 3), enemy('boss', 3)]));
const body = el('div.wrap.updates');
main.append(el('section', null, body));

let entries: ChangeEntry[] | null = null;
let failed = false;
let kind: ChangeKind | '' = '';

const KIND_COL: Record<ChangeKind, string> = { balance: 'var(--gold)', feature: '#6fe36a', fix: '#ff8a8a', content: '#8fdcff', system: 'var(--paper2)' };
const dateFmt = (iso: string): string => new Date(iso).toLocaleDateString(lang() === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function render(): void {
  body.innerHTML = '';
  if (failed) { body.append(T('up.error', undefined, 'p', 'lead')); return; }
  if (!entries) { body.append(T('up.loading', undefined, 'p', 'lead')); return; }
  const th = lang() === 'th';
  const filters = el('div.upfilters', { role: 'group' }, ...([''] as (ChangeKind | '')[]).concat(CHANGE_KINDS.filter((k) => entries!.some((e) => e.kind === k))).map((k) => {
    const b = el('button.chip.st', { type: 'button', 'aria-pressed': String(kind === k) }, k ? KIND_LABEL[k][th ? 'th' : 'en'] : s('up.all'));
    b.addEventListener('click', () => { kind = k; render(); });
    return b;
  }));
  body.append(filters);
  const list = entries.filter((e) => !kind || e.kind === kind);
  if (!list.length) { body.append(T('up.empty', undefined, 'p', 'lead')); return; }
  for (const e of list) {
    const title = (th ? e.titleTh : e.titleEn) || e.titleTh;
    const k = el('span.chip', { style: `background:${KIND_COL[e.kind]};color:var(--ink)` }, KIND_LABEL[e.kind][th ? 'th' : 'en']);
    const head = el('div.uphead', null, el('time', { datetime: e.at }, dateFmt(e.at)), k, e.configVersion != null ? el('span.chip.st', null, s('up.config', { v: e.configVersion })) : null);
    const groups = groupItems(e.items).map(([c, items]) => el('div.upgroup', null,
      el('h4', null, CAT_LABEL[c][th ? 'th' : 'en']),
      el('ul', null, ...items.map((i) => el('li', null, (th ? i.th : i.en) || i.th)))));
    body.append(el('article.panel.upentry', null, head, el('h3', null, title), ...(groups.length ? groups : [T('up.small', undefined, 'p', 'muted')])));
  }
}

live(render);
fetch(`${SUPABASE_URL}/rest/v1/rpc/get_changelog`, {
  method: 'POST',
  headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_limit: 200 }),
}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then((d: ChangeEntry[]) => { entries = Array.isArray(d) ? d : []; render(); })
  .catch(() => { failed = true; render(); });
