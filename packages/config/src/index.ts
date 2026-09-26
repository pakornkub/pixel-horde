import { z } from 'zod';
import { BalanceConfigSchema, type BalanceConfig, type BalanceConfigInput, type ResolvedConfig, type WorldId } from './schema';
import { applyDifficulty } from './difficulty';

export * from './schema';
export * from './flags';
export { FIELD_TH, GROUP_TH } from './desc-th';
export * from './difficulty';
export * from './balance-pass';
export * from './changelog';
export * from './pass-stack';

export class BalanceConfigError extends Error {
  constructor(public issues: { path: string; message: string }[]) {
    super('Invalid Balance Config: ' + issues.map((i) => `${i.path}: ${i.message}`).join('; '));
  }
}

/** Validate (and fill defaults). Out-of-range or wrong-type values throw BalanceConfigError. */
export function parseBalanceConfig(input: unknown): BalanceConfig {
  const r = BalanceConfigSchema.safeParse(input ?? {});
  if (!r.success) throw new BalanceConfigError(r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

/** The built-in defaults (the game ships these so it runs offline). */
export const DEFAULT_CONFIG: BalanceConfig = parseBalanceConfig({});

/** Shared rules ∪ one World's content (World keys never collide with shared keys), with the base difficulty applied. */
export function resolveConfig(cfg: BalanceConfig = DEFAULT_CONFIG, world: WorldId = 'lumora'): ResolvedConfig {
  return applyDifficulty({ ...cfg.shared, ...cfg.worlds[world], version: cfg.version, world });
}

export const DEFAULT_RESOLVED: ResolvedConfig = resolveConfig();

/** Deep-merge a partial override onto a config, then validate (used by the Admin tuning lab). */
export function withOverrides(base: BalanceConfig, patch: BalanceConfigInput): BalanceConfig {
  const merge = (a: unknown, b: unknown): unknown => {
    if (b && typeof b === 'object' && !Array.isArray(b) && a && typeof a === 'object') {
      const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
      for (const [k, v] of Object.entries(b)) out[k] = merge(out[k], v);
      return out;
    }
    return b === undefined ? a : b;
  };
  return parseBalanceConfig(merge(base, patch));
}

/** Flat list of every tunable field (path, default, min, max, description) for Admin forms. */
export interface FieldInfo {
  path: string; def: number; min: number; max: number; desc: string; group: string;
  /** Description of the closest object around this field (e.g. "Damage" for `bolt.dmg.base`). */
  parent: string;
}
export function listFields(): FieldInfo[] {
  const out: FieldInfo[] = [];
  const walk = (schema: z.ZodType, path: string[], group: string, parent = ''): void => {
    let s: z.ZodType = schema;
    let desc = s.description || '';
    // unwrap default/prefault/pipe wrappers
    for (;;) {
      const def = (s as unknown as { def: { type: string; innerType?: z.ZodType; in?: z.ZodType } }).def;
      if ((def.type === 'default' || def.type === 'prefault' || def.type === 'optional') && def.innerType) { s = def.innerType; desc = desc || s.description || ''; continue; }
      if (def.type === 'pipe' && def.in) { s = def.in; desc = desc || s.description || ''; continue; }
      break;
    }
    if (s instanceof z.ZodObject) {
      const g = path.length <= 2 ? (desc || group) : group;
      for (const [k, v] of Object.entries(s.shape)) walk(v as z.ZodType, [...path, k], g, desc || parent);
      return;
    }
    if (s instanceof z.ZodNumber) {
      const p = path.join('.');
      const value = path.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], DEFAULT_CONFIG);
      if (typeof value !== 'number') return; // unset optional limit
      out.push({ path: p, def: value, min: s.minValue ?? -Infinity, max: s.maxValue ?? Infinity, desc, group, parent });
    }
  };
  walk(BalanceConfigSchema, [], '');
  return out.filter((f) => f.path !== 'version');
}
