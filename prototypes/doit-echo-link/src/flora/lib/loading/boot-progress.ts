/**
 * How far the page is from being ready to look at.
 *
 * The preloader shows a real measure, not a timed animation: each of the three
 * things a visitor is actually waiting for reports in when it is done, and the
 * progress is the weight of what has reported. The scene is most of that
 * weight because it is most of the wait — a WebGL context, its shaders and the
 * first frame are what the opening screen is.
 *
 * Anything on this page may call `markBooted` more than once; only the first
 * call for a step counts. Nothing here touches the DOM, so the module is safe
 * to import from a server component's tree — it simply has no steps until the
 * browser starts marking them.
 */

export type BootStep = "fonts" | "chunk" | "scene" | "page";

/**
 * The scene counts twice, and on purpose. Fetching and evaluating its chunk is
 * one wait; building the context and compiling its shaders is another, and the
 * second one blocks the main thread — nothing can animate while it runs. Split
 * in two, the counter gets to climb before the freeze instead of sitting on a
 * low number through it.
 */
const WEIGHT: Record<BootStep, number> = {
  fonts: 0.15,
  chunk: 0.25,
  scene: 0.35,
  page: 0.25,
};

const done = new Set<BootStep>();
const listeners = new Set<(progress: number) => void>();

const measure = (): number => {
  let sum = 0;
  for (const step of done) sum += WEIGHT[step];
  // Floating point: three weights that add to 1 can land on 0.9999999.
  return Math.min(1, Math.round(sum * 1000) / 1000);
};

export const bootProgress = (): number => measure();

export const markBooted = (step: BootStep): void => {
  if (done.has(step)) return;
  done.add(step);
  const progress = measure();
  for (const listener of listeners) listener(progress);
};

/** Marks every step at once — the way out when something never reports. */
export const finishBoot = (): void => {
  (Object.keys(WEIGHT) as BootStep[]).forEach(markBooted);
};

export const onBootProgress = (
  listener: (progress: number) => void,
): (() => void) => {
  listeners.add(listener);
  listener(measure());
  return () => {
    listeners.delete(listener);
  };
};
