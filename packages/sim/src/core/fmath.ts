// Deterministic math. Only IEEE-754 basic operations (+ - * / sqrt), which every JS engine
// rounds identically, so results match bit-for-bit across Node, Chromium, Firefox and WebKit.
// Math.sin/cos/atan2/hypot/pow/exp/log are banned in the sim because engines may differ.

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

export const sqrt = Math.sqrt;

export function hypot(x: number, y: number): number {
  return sqrt(x * x + y * y);
}

/** Reduce an angle to [-PI, PI]. */
function reduce(x: number): number {
  if (x >= -PI && x <= PI) return x;
  const k = Math.round(x / TAU);
  return x - k * TAU;
}

// Polynomials on [-PI/4, PI/4] (Taylor, error < 1e-16).
function sinPoly(x: number): number {
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))));
}
function cosPoly(x: number): number {
  const x2 = x * x;
  return 1 + x2 * (-1 / 2 + x2 * (1 / 24 + x2 * (-1 / 720 + x2 * (1 / 40320 + x2 * (-1 / 3628800 + x2 * (1 / 479001600 + x2 * (-1 / 87178291200)))))));
}

export function sin(x: number): number {
  x = reduce(x);
  const q = Math.round(x / HALF_PI); // -2..2
  const r = x - q * HALF_PI;
  switch (q) {
    case 0: return sinPoly(r);
    case 1: return cosPoly(r);
    case -1: return -cosPoly(r);
    default: return -sinPoly(r); // +-2
  }
}

export function cos(x: number): number {
  x = reduce(x);
  const q = Math.round(x / HALF_PI);
  const r = x - q * HALF_PI;
  switch (q) {
    case 0: return cosPoly(r);
    case 1: return -sinPoly(r);
    case -1: return sinPoly(r);
    default: return -cosPoly(r);
  }
}

const SQRT3 = 1.7320508075688772;
const TAN_PI_12 = 0.2679491924311227;
const PI_6 = 0.5235987755982988;

function atanSmall(x: number): number {
  // |x| <= tan(pi/12); Taylor series, 12 terms
  const x2 = x * x;
  let term = x, sum = x;
  for (let n = 1; n < 14; n++) {
    term *= -x2;
    sum += term / (2 * n + 1);
  }
  return sum;
}

export function atan(x: number): number {
  let sign = 1;
  if (x < 0) { x = -x; sign = -1; }
  let inv = false;
  if (x > 1) { x = 1 / x; inv = true; }
  let r: number;
  if (x > TAN_PI_12) r = PI_6 + atanSmall((x * SQRT3 - 1) / (SQRT3 + x));
  else r = atanSmall(x);
  if (inv) r = HALF_PI - r;
  return sign * r;
}

export function atan2(y: number, x: number): number {
  if (x > 0) return atan(y / x);
  if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
  if (y > 0) return HALF_PI;
  if (y < 0) return -HALF_PI;
  return 0;
}

const LN2 = 0.6931471805599453;

export function exp(x: number): number {
  if (x === 0) return 1;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let term = 1, sum = 1;
  for (let n = 1; n < 18; n++) {
    term *= r / n;
    sum += term;
  }
  return sum * ipow(2, k);
}

/** Integer power by repeated squaring (exact for small integer exponents). */
export function ipow(base: number, n: number): number {
  if (n < 0) return 1 / ipow(base, -n);
  let result = 1, b = base, e = n | 0;
  while (e > 0) {
    if (e & 1) result *= b;
    b *= b;
    e >>= 1;
  }
  return result;
}

/** Natural log (for building constants); series on the mantissa. */
export function log(x: number): number {
  if (x <= 0) return NaN;
  let k = 0;
  while (x > 2) { x /= 2; k++; }
  while (x < 1) { x *= 2; k--; }
  // x in [1,2]: ln(x) = 2 * atanh((x-1)/(x+1))
  const y = (x - 1) / (x + 1), y2 = y * y;
  let term = y, sum = y;
  for (let n = 1; n < 30; n++) {
    term *= y2;
    sum += term / (2 * n + 1);
  }
  return 2 * sum + k * LN2;
}

/** base^e for a positive base and any real exponent. */
export function pow(base: number, e: number): number {
  if (Number.isInteger(e)) return ipow(base, e);
  return exp(e * log(base));
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
