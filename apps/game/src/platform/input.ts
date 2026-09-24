import type { InputFrame } from '@pixel-horde/sim';

export const keys = new Set<string>();
export type Joy = { id: number; ox: number; oy: number; cx: number; cy: number; act: boolean };
export const touch: { joy: Joy | null } = { joy: null };

/** Quantize to 1/127 steps so recorded replays stay small and exact. */
const q = (v: number): number => Math.round(v * 127) / 127;

/** Keyboard + drag-joystick → one InputFrame. */
export function readInput(): InputFrame {
  let mx = 0, my = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) mx--;
  if (keys.has('ArrowRight') || keys.has('KeyD')) mx++;
  if (keys.has('ArrowUp') || keys.has('KeyW')) my--;
  if (keys.has('ArrowDown') || keys.has('KeyS')) my++;
  const joy = touch.joy;
  if (joy && joy.act) {
    const dx = joy.cx - joy.ox, dy = joy.cy - joy.oy, l = Math.hypot(dx, dy);
    if (l > 6) { const m = Math.min(1, l / 40); mx = (dx / l) * m; my = (dy / l) * m; }
  }
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  return { mx: q(mx), my: q(my) };
}
