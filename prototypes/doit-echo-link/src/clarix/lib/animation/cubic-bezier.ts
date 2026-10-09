// 📖 Docs: obsidian/frontend/animation-system.md

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)` timing function as a plain easing
 * `(t) => progress`, for react-spring's duration configs — so a port of a CSS
 * transition eases exactly as the browser eased it.
 *
 * Solves x(s) = t for the curve parameter s (Newton, then bisection), and
 * returns y(s) — the same method browsers use.
 */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  const solveX = (x: number) => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(s) - x;
      if (Math.abs(err) < 1e-6) return s;
      const d = slopeX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    while (lo < hi) {
      const v = sampleX(s);
      if (Math.abs(v - x) < 1e-6) return s;
      if (x > v) lo = s;
      else hi = s;
      if (hi - lo < 1e-7) break;
      s = (lo + hi) / 2;
    }
    return s;
  };

  return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : sampleY(solveX(t)));
};

/** CSS `ease`. */
export const cssEase = cubicBezier(0.25, 0.1, 0.25, 1);
/** CSS `linear`. */
export const cssLinear = (t: number) => t;
