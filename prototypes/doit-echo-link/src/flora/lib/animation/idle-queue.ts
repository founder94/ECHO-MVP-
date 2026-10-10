/**
 * One piece of deferred work per idle period, in the order it was asked for.
 *
 * Hydrating a block costs what its first render costs; for the flight's word
 * springs that was a few hundred springs created in the hydration task, for
 * screens nobody can see yet. Queued here, each block hydrates its motion in a
 * short task of its own once the page is idle — after load, well before anyone
 * scrolls to it — instead of all of them in one long task at load, or at
 * arrival mid-scroll (aerra's lesson, optimize-performance).
 */

type Job = () => void;

const queue: Job[] = [];
let scheduled = false;

/**
 * Soon, not "whenever": a page whose scene draws every frame has few idle
 * periods, and a queue left to wait for them trickled its jobs out one per
 * two-second timeout — into the visitor's first scroll. The shorter timeout
 * finishes it behind the preloader, still one short task at a time.
 */
const IDLE_TIMEOUT = 500;

const requestIdle = (run: () => void): void => {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT });
  } else {
    window.setTimeout(run, 16);
  }
};

const drain = (): void => {
  scheduled = false;
  // One job per period: a job is one flight's springs, and several run back
  // to back in one period were one long task again (mobile TBT 184 → 937 ms
  // when the drain took several per period).
  queue.shift()?.();
  if (queue.length > 0) schedule();
};

const schedule = (): void => {
  if (scheduled) return;
  scheduled = true;
  requestIdle(drain);
};

/** Runs `job` in an idle period of its own; returns a cancel. */
export const whenIdle = (job: Job): (() => void) => {
  queue.push(job);
  schedule();
  return () => {
    const at = queue.indexOf(job);
    if (at >= 0) queue.splice(at, 1);
  };
};
