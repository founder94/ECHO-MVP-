/**
 * Viewport-adaptive scene parameters, resolved once on mount.
 *
 * The last entry the viewport width fits under wins, so order matters:
 * widest first.
 *
 * The particle counts are the whole performance story. Point sprites are
 * fill-rate bound, so cost scales with `count × pointSize² × dpr²` — halving any
 * one of the three is worth more than any amount of CPU tuning.
 */
export interface Adaptive {
  point: number;
  /** Points on the orb's Fibonacci sphere. */
  orbCount: number;
  orbPointSize: number;
  /** Camera distance while the orb owns the frame. */
  orbCameraZ: number;
  /** World units the orb rushes toward the camera across "Enter the unknown". */
  orbMoveY: number;
  /** Galaxy source sphere tessellation — this sets the point count. */
  galaxyWidthSegments: number;
  galaxyHeightSegments: number;
  /** Points area-sampled across the brain surface (the third form). */
  brainCount: number;
  atmoCount: number;
  atmoSize: number;
  /** Pointer-reactive oil / repel / parallax. Off on touch-sized viewports. */
  pointerReaction: boolean;
  /** `[min, max]` device pixel ratio handed to the renderer. */
  dpr: [number, number];
  /**
   * Frames per second the scene is driven at, via the shared ticker's frame gate.
   *
   * This is a **ceiling that must be reachable by skipping whole rAF frames**, so
   * the honest values on a 60 Hz panel are 60 (every frame) and 30 (every other).
   * 45 is only representable on a 90/120 Hz display; elsewhere it degrades to 30,
   * which is the intent — a tablet spending its budget on fewer, complete frames.
   *
   * (Until the gate's jitter tolerance was fixed, *none* of these were delivered:
   * asking for 60 got ~40 fps with an alternating 16.7/33 ms cadence. See
   * `lib/animation/ticker.ts`.)
   */
  targetFps: number;
  /**
   * Per-frame lerp factor for the scroll clock, 0→1. Below 1 the scene eases
   * toward the scroll position, so a low frame rate reads as smooth motion
   * rather than as steps. 1 is instant.
   */
  progressLerp: number;
  /** Bloom is the most expensive pass; drop it on the weakest tier. */
  bloom: boolean;
}

const adaptive: Adaptive[] = [
  {
    // Desktop. Halved from 46k — at this point size the sphere reads identically.
    point: Infinity,
    orbCount: 23000,
    orbPointSize: 28,
    orbCameraZ: 3.8,
    orbMoveY: 0.8,
    galaxyWidthSegments: 160,
    galaxyHeightSegments: 420,
    brainCount: 130000,
    atmoCount: 260,
    atmoSize: 23,
    pointerReaction: true,
    // Render at the display's native density (up to 2×) — capped at 1.5 the
    // point sprites were upscaled and read soft on Retina/HiDPI screens. Cost is
    // fill-rate bound (∝ dpr²), so 2 is the ceiling a desktop GPU absorbs.
    dpr: [1, 2],
    targetFps: 60,
    // Ease the clock toward the scroll position instead of snapping to it, so the
    // orb→galaxy handoff reads as a slow, continuous glide rather than tracking
    // every scroll tick. Low on purpose (~0.25 s time constant) — the scene
    // deliberately trails the scroll a beat so the transition feels fluid rather
    // than scrubbed. See obsidian ADR-0023.
    progressLerp: 0.07,
    bloom: true,
  },
  {
    // Laptop / small desktop.
    point: 1440,
    orbCount: 17000,
    orbPointSize: 27,
    orbCameraZ: 3.8,
    orbMoveY: 0.8,
    galaxyWidthSegments: 130,
    galaxyHeightSegments: 330,
    brainCount: 90000,
    atmoCount: 210,
    atmoSize: 22,
    pointerReaction: true,
    dpr: [1, 1.75],
    targetFps: 60,
    progressLerp: 0.08,
    bloom: true,
  },
  {
    // Tablet.
    point: 1024,
    orbCount: 11000,
    orbPointSize: 24,
    // Pull back on narrow viewports so the orb does not crowd the copy.
    orbCameraZ: 4.5,
    orbMoveY: 0.9,
    galaxyWidthSegments: 100,
    galaxyHeightSegments: 250,
    brainCount: 50000,
    atmoCount: 150,
    atmoSize: 20,
    pointerReaction: false,
    dpr: [0.9, 1.25],
    targetFps: 45,
    progressLerp: 0.13,
    bloom: true,
  },
  {
    // Phone. Bloom off: a full mipmap chain at any dpr dominates the frame.
    point: 640,
    orbCount: 6500,
    orbPointSize: 21,
    orbCameraZ: 5.4,
    orbMoveY: 1.0,
    galaxyWidthSegments: 70,
    galaxyHeightSegments: 170,
    brainCount: 26000,
    atmoCount: 90,
    atmoSize: 18,
    pointerReaction: false,
    dpr: [0.75, 1.1],
    targetFps: 30,
    progressLerp: 0.15,
    bloom: false,
  },
];

export const getParams = (width: number): Adaptive => {
  let result = adaptive[0];
  for (const entry of adaptive) {
    if (width <= entry.point) result = entry;
  }
  return result;
};

/**
 * The viewport width the scene sizes itself by. On the page it is
 * `window.innerWidth`; in the scene worker (`scene.worker.tsx`) — which has no
 * `window` — the page hands it over before the scene mounts.
 */
let workerWidth: number | null = null;

export const setSceneWidth = (width: number): void => {
  workerWidth = width;
};

export const sceneWidth = (): number => workerWidth ?? window.innerWidth;
