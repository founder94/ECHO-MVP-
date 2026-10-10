/**
 * Shared animation ticker.
 *
 * A single, app-wide `requestAnimationFrame` loop. Every animation hook that
 * needs per-frame work subscribes here instead of starting its own rAF — so a
 * page with N scroll-driven components runs **one** loop, not N.
 *
 * The loop is reference-counted: it starts on the first subscriber and stops
 * (`cancelAnimationFrame`) when the last one leaves, so an idle page costs
 * nothing. Each subscriber is throttled independently by its own framerate.
 *
 * 📖 Docs: obsidian/frontend/animation-system.md
 */

export type TickerCallback = (time: number) => void;

/**
 * Run order within a frame. Lower runs first.
 *
 * Smooth scroll must advance **before** anything that measures the document,
 * or every scroll-driven trigger spends the frame reading the previous frame's
 * position and the whole page trails the scroll by one frame.
 */
export const TICKER_PRIORITY = {
  /** Lenis — writes the scroll position. */
  scroll: -100,
  /** Everything that reads it. */
  default: 0,
} as const;

interface Subscriber {
  callback: TickerCallback;
  /** Read live each frame so framerate prop changes take effect. */
  getFramerate: () => number;
  /** Timestamp of this subscriber's last invocation. */
  last: number;
  /** Run order within a frame; lower first. */
  priority: number;
}

/** Kept sorted by priority — re-sorted on subscribe, not per frame. */
let subscribers: Subscriber[] = [];
let rafId: number | null = null;

/**
 * Slack on the frame-gap test, in milliseconds.
 *
 * `requestAnimationFrame` timestamps jitter either side of the display's period:
 * a 60 Hz panel delivers 16.4 ms, 16.9 ms, 16.6 ms, not a clean 16.67 ms. A
 * subscriber asking for 60 fps has an interval of 16.667 ms, so a strict
 * `elapsed <= interval` test **rejects every frame that arrives a fraction
 * early** — and because a rejected frame does not advance `last`, the next one is
 * measured across a double gap and always passes. The subscriber settles into an
 * alternating render / skip pattern: ~40 fps with 16.7 / 33 ms gaps, which the
 * eye reads as stutter rather than as a lower frame rate.
 *
 * One millisecond of slack absorbs the jitter. It is far below the 16.7 ms
 * spacing of the next real frame, so it cannot let a 30 fps subscriber sneak an
 * extra frame through — it only stops the gate from rejecting frames it meant to
 * accept.
 */
const JITTER_MS = 1;

const frame = (time: number): void => {
  // Snapshot first: a callback may subscribe/unsubscribe during iteration.
  for (const sub of [...subscribers]) {
    if (!subscribers.includes(sub)) continue;
    if (time - sub.last < sub.getFramerate() - JITTER_MS) continue;
    sub.last = time;
    try {
      sub.callback(time);
    } catch (error) {
      // Isolate failures — one bad subscriber must not kill the shared loop.
      console.error("[ticker] subscriber threw:", error);
    }
  }
  rafId = requestAnimationFrame(frame);
};

const start = (): void => {
  if (rafId === null) rafId = requestAnimationFrame(frame);
};

const stop = (): void => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

/**
 * Subscribe a callback to the shared rAF loop.
 *
 * @param callback - invoked with the rAF timestamp, no more often than `getFramerate()` ms apart.
 * @param getFramerate - returns the current minimum gap (ms) between invocations; read live every frame.
 * @param priority - run order within a frame, lower first. See {@link TICKER_PRIORITY}.
 * @returns an unsubscribe function.
 */
export const subscribeToTicker = (
  callback: TickerCallback,
  getFramerate: () => number,
  priority: number = TICKER_PRIORITY.default,
): (() => void) => {
  const subscriber: Subscriber = {
    callback,
    getFramerate,
    last: performance.now(),
    priority,
  };
  subscribers.push(subscriber);
  subscribers.sort((a, b) => a.priority - b.priority);
  start();

  return () => {
    subscribers = subscribers.filter((entry) => entry !== subscriber);
    if (subscribers.length === 0) stop();
  };
};
