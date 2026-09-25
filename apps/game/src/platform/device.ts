// Device class: phones and tablets (coarse pointer, no hover) get lower monster/particle caps.
export const isMobile = (): boolean => {
  try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches; } catch { return false; }
};
