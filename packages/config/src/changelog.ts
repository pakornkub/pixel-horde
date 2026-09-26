// Changelog (patch notes): what changed in each update, in words players understand, shared by the
// Admin Console (writes) and the website (reads). Entries live in the database (`public.changelog`);
// every Balance Config publish adds one, code releases are written in Admin → บันทึกการอัปเดต.
import { listFields, type FieldInfo } from './index';
import { FIELD_TH, GROUP_TH } from './desc-th';

export const CHANGE_KINDS = ['balance', 'feature', 'fix', 'content', 'system'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export const CHANGE_CATS = ['hero', 'skill', 'boss', 'monster', 'event', 'difficulty', 'economy', 'coop', 'ui', 'system'] as const;
export type ChangeCat = (typeof CHANGE_CATS)[number];

export const KIND_LABEL: Record<ChangeKind, { th: string; en: string }> = {
  balance: { th: 'ปรับสมดุล', en: 'Balance' },
  feature: { th: 'ของใหม่', en: 'New' },
  fix: { th: 'แก้บั๊ก', en: 'Fixes' },
  content: { th: 'เนื้อหา', en: 'Content' },
  system: { th: 'ระบบ', en: 'System' },
};
export const CAT_LABEL: Record<ChangeCat, { th: string; en: string }> = {
  hero: { th: 'ตัวละคร', en: 'Heroes' },
  skill: { th: 'สกิล', en: 'Skills' },
  boss: { th: 'ราชาและบอส', en: 'Kings & bosses' },
  monster: { th: 'มอนสเตอร์', en: 'Monsters' },
  event: { th: 'อีเวนต์', en: 'Events' },
  difficulty: { th: 'ความยาก', en: 'Difficulty' },
  economy: { th: 'ทองและรางวัล', en: 'Gold & rewards' },
  coop: { th: 'เล่นด้วยกัน', en: 'Co-op' },
  ui: { th: 'หน้าจอและการควบคุม', en: 'Screens & controls' },
  system: { th: 'ระบบ', en: 'System' },
};

/** One line of a changelog entry. */
export interface ChangeItem { cat: ChangeCat; th: string; en: string }
/** A changelog entry as the website shows it (admins also get `note`, `public`, `id`). */
export interface ChangeEntry {
  id?: number;
  /** Release date (ISO). */
  at: string;
  kind: ChangeKind;
  /** Balance Config version this entry belongs to (balance entries). */
  configVersion?: number | null;
  titleTh: string; titleEn: string;
  items: ChangeItem[];
  /** Admin only: details not shown to players. */
  note?: string;
  public?: boolean;
}

export const isChangeKind = (v: unknown): v is ChangeKind => typeof v === 'string' && (CHANGE_KINDS as readonly string[]).includes(v);
export const isChangeCat = (v: unknown): v is ChangeCat => typeof v === 'string' && (CHANGE_CATS as readonly string[]).includes(v);

/** Which part of the game a Balance Config value belongs to. */
export function catOfPath(path: string): ChangeCat {
  const p = path.replace(/^shared\./, '').replace(/^worlds\.\w+\./, '');
  if (/^enemies\.(boss\w*|umbra|dragon|frostDragon|stormDragon|rival)\./.test(p) || /^(kings|umbra|dragon|guardians|rival|stage\.(bossHpGrowth|enrage\w*|overtime|bossAt))\b/.test(p)) return 'boss';
  if (/^enemies\./.test(p) || /^(caster|charger|hop|leech|splitter|realms)\./.test(p)) return 'monster';
  if (/^(heroes|player|passives)\./.test(p)) return 'hero';
  if (/^(skills|combos|status|awaken|ult|pet|companion|clone|weapons)\./.test(p)) return 'skill';
  if (/^(events|heartCrack|endless)\./.test(p)) return 'event';
  if (/^(loot|shop|economy|chest|bench|score)\./.test(p)) return 'economy';
  if (/^coop\./.test(p)) return 'coop';
  if (/^(spawn|scaling|director|stage|xp|levelup|difficulty|tutorial)\./.test(p)) return 'difficulty';
  if (/^fx\./.test(p)) return 'ui';
  return 'system';
}

let FIELDS: FieldInfo[] | null = null;
/** Thai name of a Balance Config value, as the Admin Console shows it. */
export function fieldNameTh(path: string): string {
  FIELDS ??= listFields();
  const f = FIELDS.find((x) => x.path === path);
  if (!f) return path;
  const name = FIELD_TH[f.desc]?.th ?? f.desc;
  const ctx = f.parent && f.parent !== f.group ? GROUP_TH[f.parent] ?? f.parent : '';
  return ctx ? `${ctx} · ${name}` : name;
}
function fieldNameEn(path: string): string {
  FIELDS ??= listFields();
  const f = FIELDS.find((x) => x.path === path);
  if (!f) return path;
  return f.parent && f.parent !== f.group ? `${f.parent} · ${f.desc}` : f.desc;
}

const num = (v: number | undefined): string => (v === undefined ? '–' : String(Math.round(v * 1000) / 1000));

/** Changelog lines for changed values when nobody wrote friendlier ones: "name: old → new (up/down)". */
export function autoItems(changes: { path: string; from: number | undefined; to: number | undefined }[]): ChangeItem[] {
  return changes.map((c) => {
    const up = (c.to ?? 0) > (c.from ?? 0);
    return {
      cat: catOfPath(c.path),
      th: `${fieldNameTh(c.path)}: ${num(c.from)} → ${num(c.to)} (${up ? 'เพิ่มขึ้น' : 'ลดลง'})`,
      en: `${fieldNameEn(c.path)}: ${num(c.from)} → ${num(c.to)} (${up ? 'up' : 'down'})`,
    };
  });
}

/** Entry items grouped by category, in CHANGE_CATS order (for display). */
export function groupItems(items: ChangeItem[]): [ChangeCat, ChangeItem[]][] {
  return CHANGE_CATS.map((c) => [c, items.filter((i) => i.cat === c)] as [ChangeCat, ChangeItem[]]).filter(([, l]) => l.length > 0);
}
