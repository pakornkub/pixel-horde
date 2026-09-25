// Sprite data format (ticket 33). Sprites are hand-authored character rows: each char maps to a
// palette colour, '.' is transparent. Pure data: no DOM, so the validator runs in tests.

export const TRANSPARENT = '.';
export const OUTLINE = '#1e1b33';

export interface SpriteDef {
  /** Animation frames; every frame has the same size. */
  frames: string[][];
  /** char → CSS colour */
  pal: Record<string, string>;
  /** Short note for the Sprite Lab list. */
  note?: string;
}

/** One Realm's sprite file: a shared palette for the Lab plus its sprites. */
export interface RealmSprites {
  realm: string;
  /** Realm palette (≤ ~12 colours) offered in the Sprite Lab. */
  palette: string[];
  /** Colour used as ground in the Lab preview. */
  ground: number;
  sprites: Record<string, SpriteDef>;
}

export interface SpriteProblem { sprite: string; frame: number; row: number; message: string }

/** Rows of every frame must have equal length (and frames equal size); chars must be in the palette. */
export function validateSprite(name: string, def: SpriteDef): SpriteProblem[] {
  const out: SpriteProblem[] = [];
  if (!def.frames.length) out.push({ sprite: name, frame: -1, row: -1, message: 'no frames' });
  const w = def.frames[0]?.[0]?.length ?? 0, h = def.frames[0]?.length ?? 0;
  def.frames.forEach((rows, f) => {
    if (rows.length !== h) out.push({ sprite: name, frame: f, row: -1, message: `frame has ${rows.length} rows, expected ${h}` });
    rows.forEach((r, y) => {
      if (r.length !== w) out.push({ sprite: name, frame: f, row: y, message: `row length ${r.length}, expected ${w}` });
      for (const ch of r) {
        if (ch !== TRANSPARENT && !(ch in def.pal)) out.push({ sprite: name, frame: f, row: y, message: `char '${ch}' is not in the palette` });
      }
    });
  });
  for (const [ch, col] of Object.entries(def.pal)) {
    if (ch.length !== 1 || ch === TRANSPARENT) out.push({ sprite: name, frame: -1, row: -1, message: `bad palette key '${ch}'` });
    if (!/^#[0-9a-fA-F]{6}$/.test(col)) out.push({ sprite: name, frame: -1, row: -1, message: `bad colour '${col}' for '${ch}'` });
  }
  return out;
}

export function validateRealm(r: RealmSprites): SpriteProblem[] {
  return Object.entries(r.sprites).flatMap(([n, d]) => validateSprite(`${r.realm}/${n}`, d));
}

/** Parse rows pasted into the Lab (one row per line; quotes, commas and brackets are ignored). */
export function parseRows(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim().replace(/^[[\s]*["'`]?/, '').replace(/["'`]?[\s,\]]*;?$/, '')).filter((l) => l.length > 0);
}

/** Format rows as a TypeScript array literal for copy-out. */
export function formatRows(rows: string[]): string {
  return '[\n' + rows.map((r) => `  "${r}",`).join('\n') + '\n]';
}
