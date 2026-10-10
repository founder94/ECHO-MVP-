/**
 * A CSS-compatible `cubic-bezier()` easing, for use as a react-spring `easing`.
 *
 * `@react-spring/web` ships a named easing dictionary but no bezier factory, and
 * a few curves ported from CSS have no named equivalent.
 *
 * Solves x(t) = progress for t by bisection, then returns y(t). Bisection over
 * 20 iterations lands within ~1e-6 — imperceptible at any frame rate, and the
 * curve is monotonic in x so it always converges.
 */

const ITERATIONS = 20;

/** One axis of the bezier, with implicit p0 = 0 and p3 = 1. */
const axis = (t: number, a: number, b: number): number => {
  const inv = 1 - t;
  return 3 * inv * inv * t * a + 3 * inv * t * t * b + t * t * t;
};

export const cubicBezier =
  (x1: number, y1: number, x2: number, y2: number) =>
  (progress: number): number => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    let lower = 0;
    let upper = 1;
    let t = progress;

    for (let i = 0; i < ITERATIONS; i++) {
      const x = axis(t, x1, x2);
      if (x < progress) lower = t;
      else upper = t;
      t = (lower + upper) / 2;
    }

    return axis(t, y1, y2);
  };
