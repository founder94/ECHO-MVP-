/**
 * A per-frame ease factor made frame-rate independent.
 *
 * `x += (target - x) * k` closes a fraction `k` of the gap **per frame**, so it
 * runs twice as fast at 120 Hz as at 60 Hz and half as fast at the phone's
 * 30 fps gate. This returns the fraction to close over `delta` seconds such
 * that `k` is what closes per 1/60 s — identical to the authored feel at 60 fps.
 */
export const perFrame = (k: number, delta: number): number =>
  1 - Math.pow(1 - k, Math.max(0, delta) * 60);
