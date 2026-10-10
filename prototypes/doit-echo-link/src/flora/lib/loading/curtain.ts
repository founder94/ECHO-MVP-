/**
 * Whether the preloader is still over the page.
 *
 * The opening screen should not arrive behind a curtain and be found already
 * standing there when it lifts — it should arrive *as* it lifts. That needs
 * one bit of shared state, because the preloader and the hero are siblings
 * with no way to see each other.
 *
 * Up is the default, and deliberately so: a page with no preloader on it — a
 * crawler's, or any later route — has nothing to wait for, and everything
 * that asks simply arrives at once.
 */

let up = true;
const waiting = new Set<() => void>();

/** Called by the preloader as it renders, before anything else has mounted. */
export const holdCurtain = (): void => {
  up = false;
};

export const raiseCurtain = (): void => {
  if (up) return;
  up = true;
  for (const listener of waiting) listener();
  waiting.clear();
};

export const curtainIsUp = (): boolean => up;

/** Fires once, immediately if the curtain is already up. */
export const onCurtainUp = (listener: () => void): (() => void) => {
  if (up) {
    listener();
    return () => {};
  }
  waiting.add(listener);
  return () => {
    waiting.delete(listener);
  };
};
