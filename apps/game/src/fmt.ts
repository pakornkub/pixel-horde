// One number format for every screen and the HUD: grouped with commas ("1,248") whatever the browser locale
// (toLocaleString() alone gave "1.248" on de-DE and the HUD had no separator at all).
export const fmtN = (n: number): string => Math.round(n).toLocaleString('en-US');
