// Route card picture: the Realm's own ground with its King standing on it (was the name's first letter,
// which in Thai is often a leading vowel such as "เ" or "ไ", and ink on the dark Realms' colour).
import { REALMS, type RealmId } from '@pixel-horde/sim';
import { tileAtT } from '../render/tiles';
import { ENEMY_SPR } from '../render/sprites';

const URLS: Partial<Record<RealmId, string>> = {};

export function realmIcon(id: RealmId): string {
  const hit = URLS[id];
  if (hit !== undefined) return hit;
  const realm = REALMS[id];
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) x.drawImage(tileAtT(realm.theme, tx + 1, ty + 1), tx * 16, ty * 16);
  const king = ENEMY_SPR[realm.king]?.[0]?.n;
  if (king) {
    const k = Math.min(30 / king.width, 30 / king.height);
    const w = Math.round(king.width * k), h = Math.round(king.height * k);
    x.drawImage(king, Math.round((32 - w) / 2), 32 - h - 1, w, h);
  }
  let url = '';
  try { url = c.toDataURL(); } catch { /* tainted canvas: keep the colour square */ }
  return (URLS[id] = url);
}
