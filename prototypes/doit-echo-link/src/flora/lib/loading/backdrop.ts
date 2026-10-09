/**
 * Whether the gradient behind the page has drawn anything yet.
 *
 * The preloader's keyhole is a hole cut in a black field, and a hole only
 * reads as one when what shows through it is lighter than what surrounds it.
 * Until the backdrop canvas has painted its first frame there is nothing
 * behind the field but a flat colour, so the cut would be invisible — and a
 * shape that appears out of nothing once the gradient arrives is worse than
 * one that was never there. So the keyhole waits for this and fades in.
 *
 * One bit of shared state, for the same reason as `curtain.ts`: the preloader
 * and the backdrop are siblings with no way to see each other. It touches no
 * DOM, so it imports cleanly into a server component's tree.
 *
 * **Ready is not the default.** A page with no backdrop on it never fires
 * this, which is correct: there is nothing to show through the keyhole there
 * either. The canvas marks it on its failure path as well, so a browser
 * without WebGL2 does not leave the keyhole waiting for ever.
 *
 * 📖 Docs: obsidian/frontend/preloader.md
 */

let painted = false;
const waiting = new Set<() => void>();

/** Called by the backdrop canvas once it has drawn, or given up drawing. */
export const markBackdropReady = (): void => {
  if (painted) return;
  painted = true;
  for (const listener of waiting) listener();
  waiting.clear();
};

export const backdropIsReady = (): boolean => painted;

/** Fires once, immediately if the backdrop has already painted. */
export const onBackdropReady = (listener: () => void): (() => void) => {
  if (painted) {
    listener();
    return () => {};
  }
  waiting.add(listener);
  return () => {
    waiting.delete(listener);
  };
};
