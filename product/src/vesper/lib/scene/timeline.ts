/**
 * Scene timeline — the 0→4 progress clock that drives the WebGL scene and HUD.
 *
 * Four full-viewport scroll tracks each contribute a clamped 0→1 progress; the
 * global clock is their sum. Track 4 measures track 3 against the viewport
 * *bottom* rather than its top, which makes it resolve to the same value as
 * track 2. The clock is therefore `p1 + 2·p2 + p3` and advances at double rate
 * across its middle segment. That shape is load-bearing — the keyframes below
 * were authored against it.
 *
 * The scene samples this store imperatively inside `useFrame`, so it is a plain
 * mutable singleton rather than React state: a per-frame `setState` would drive
 * a re-render on every animation frame.
 */

/** Per-frame scene state, interpolated between {@link KEYFRAMES}. */
export interface SceneState {
  /** 0 = orb whole, 1 = orb fully scattered. */
  orbOut: number;
  /** 0 → 1 as the galaxy assembles. Fades in over the second half. */
  galaxyIn: number;
  /** 0 → 1 as the galaxy disperses. Blows apart past the halfway point. */
  galaxyOut: number;
  /** 0 → 1 dive: pulls the camera toward the core and tips the disc edge-on. */
  galaxyDive: number;
}

/** Number of scroll tracks feeding the clock. */
export const TRACK_COUNT = 4;

/** Upper bound of the global clock — one unit per track. */
export const TIMELINE_END = TRACK_COUNT;

/**
 * Scene state at global progress 0, 1, 2, 3, 4.
 *
 * The third act was the returning orb opening its core over a spinning logo; it
 * is now the {@link brainAppear} point-cloud brain. The orb therefore stays
 * scattered once dissolved (`orbOut` holds at 1 through keyframes 3 and 4 instead
 * of falling back to 0), and the brain assembles across 2.6→3.4 as the galaxy
 * blows apart. `orbCoreOpen`/`orbApproach` are dormant while the orb is absent.
 */
const KEYFRAMES: readonly SceneState[] = [
  { orbOut: 0, galaxyIn: 0, galaxyOut: 0, galaxyDive: 0 },
  { orbOut: 1, galaxyIn: 1, galaxyOut: 0, galaxyDive: 0.5 },
  { orbOut: 1, galaxyIn: 1, galaxyOut: 0.5, galaxyDive: 1 },
  { orbOut: 1, galaxyIn: 1, galaxyOut: 1, galaxyDive: 1 },
  { orbOut: 1, galaxyIn: 1, galaxyOut: 1, galaxyDive: 1 },
];

const KEYS = Object.keys(KEYFRAMES[0]) as (keyof SceneState)[];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Linearly interpolate the keyframe track at global progress `g`, clamped. */
export const sampleScene = (g: number): SceneState => {
  const clamped = Math.min(Math.max(g, 0), TIMELINE_END);
  const lower = Math.min(Math.floor(clamped), KEYFRAMES.length - 2);
  const t = clamped - lower;
  const from = KEYFRAMES[lower];
  const to = KEYFRAMES[lower + 1];

  const out = {} as SceneState;
  for (const key of KEYS) out[key] = lerp(from[key], to[key], t);
  return out;
};

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);

/** Hermite ramp between `a` and `b`. */
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Ken Perlin's smootherstep — zero 1st *and* 2nd derivative at both ends. */
const smootherstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Orb dissolve, 0 → 1. Eased at both ends so the hero neither snaps apart on the
 * first pixel of scroll nor pops out of existence at the end.
 */
export const orbDissolve = (state: SceneState): number =>
  smootherstep(state.orbOut);

/** Orb opacity. Reaches 0 only once the blow-out has fully carried it away. */
export const orbAlpha = (state: SceneState): number => 1 - orbDissolve(state);

/**
 * The core cut-out, 0 → 1. Opens across the final section, *before* the orb
 * sinks, so the logo has the frame to itself for a beat.
 */
export const orbCoreOpen = (progress: number): number =>
  smoothstep(2.9, 3.6, progress);

/**
 * The orb's exit across "Enter the unknown", 0 → 1. Instead of sinking away it
 * rushes toward the camera and its displacement noise swells — see `orb.tsx`.
 * Held until the core has finished opening.
 */
export const orbApproach = (progress: number): number =>
  smoothstep(3.4, 4.0, progress);

/**
 * How much of the frame the galaxy owns, 0→1.
 *
 * Drives the camera, backdrop palette, and atmosphere crossfade. It releases as
 * the galaxy blows apart, so the camera retreats to the orb exactly as the orb
 * re-forms.
 *
 * Note it tracks {@link galaxyAppear}, *not* raw `galaxyIn`. Keyed to the raw
 * value the camera began retreating on the very first pixel of scroll, yanking
 * the orb into the distance while it was still half-visible — it read as the orb
 * vanishing instantly rather than dissolving.
 */
export const galaxyPresence = (state: SceneState): number =>
  galaxyAppear(state) * (1 - galaxyBlow(state));

/**
 * Galaxy opacity ramp. The source snapped this on over `in` 0.5→0.75; a longer,
 * smoother ramp lets the stars stream in rather than flick on.
 */
export const galaxyAppear = (state: SceneState): number =>
  smootherstep(smoothstep(0.55, 0.95, state.galaxyIn));

/**
 * How far the galaxy's stars still are from their resting places, 1 → 0.
 *
 * Deliberately trails {@link galaxyAppear} slightly: the stars become faintly
 * visible while still inbound, so the disc is seen to gather out of drifting
 * dust rather than materialise already-formed. It must not start much earlier
 * than that, or the inbound cloud swamps the hero while the orb is still there.
 */
export const galaxyAssemble = (state: SceneState): number =>
  1 - smootherstep(smoothstep(0.5, 1.0, state.galaxyIn));

/** Galaxy dispersal amount, eased. */
export const galaxyBlow = (state: SceneState): number =>
  smootherstep(clamp01((state.galaxyOut - 0.5) * 2));

/**
 * Brain presence, 0 → 1. The third form assembles across the clock's 2.6→3.4
 * span — as the galaxy blows apart — and holds through the end. Drives the
 * brain's opacity, its explode→converge assembly, and its scroll spin.
 */
export const brainAppear = (progress: number): number =>
  smootherstep(smoothstep(2.6, 3.4, progress));

type ProgressListener = (progress: number) => void;

const tracks = new Array<number>(TRACK_COUNT).fill(0);
const state: SceneState = { ...KEYFRAMES[0] };
const listeners = new Set<ProgressListener>();

/** Where the scroll position says we are. */
let target = 0;
/** Where the scene actually is. Eases toward `target` when smoothing < 1. */
let progress = 0;
/** Per-60fps-frame lerp factor. 1 snaps. */
let smoothing = 1;

/** Below this the clock is treated as settled and listeners stop firing. */
const EPSILON = 0.00005;

/**
 * How hard the clock eases toward the scroll position.
 *
 * At a low frame rate an un-smoothed clock steps: each frame jumps to wherever
 * the finger has dragged to. Easing it turns those steps back into motion. The
 * lower the frame rate, the lower this wants to be — see `adaptive.ts`.
 */
export const configureTimeline = (factor: number): void => {
  smoothing = Math.min(Math.max(factor, 0.02), 1);
};

const publish = () => {
  Object.assign(state, sampleScene(progress));
  for (const listener of listeners) listener(progress);
};

/**
 * Step the clock toward its target. Driven by the shared ticker rather than by
 * the render loop, so the HUD keeps moving even while the scene is not drawing.
 */
export const advanceTimeline = (deltaSeconds: number): void => {
  const distance = target - progress;
  if (Math.abs(distance) < EPSILON) {
    if (progress !== target) {
      progress = target;
      publish();
    }
    return;
  }

  if (smoothing >= 1) {
    progress = target;
  } else {
    // Frame-rate independent: `smoothing` is the fraction closed per 1/60 s.
    const alpha = 1 - Math.pow(1 - smoothing, deltaSeconds * 60);
    progress += distance * alpha;
  }
  publish();
};

/**
 * Mirror the page's clock in another realm — the scene worker
 * (`views/home/scene/scene.worker.tsx`) — which has no scroll to measure. The
 * page sends its eased `progress` each frame; this republishes the same state.
 */
export const syncTimeline = (nextProgress: number, nextTarget: number): void => {
  target = nextTarget;
  if (progress === nextProgress) return;
  progress = nextProgress;
  publish();
};

/**
 * The live scene clock. `getState()` returns a stable object that is mutated in
 * place — read it every frame, never cache its fields.
 */
export const sceneTimeline = {
  getState: (): SceneState => state,
  getProgress: (): number => progress,
  /** The un-smoothed scroll position, for anything that must not lag. */
  getTarget: (): number => target,

  /** Report a single track's clamped 0→1 progress and recompute the target. */
  setTrack(index: number, value: number): void {
    if (tracks[index] === value) return;
    tracks[index] = value;

    let sum = 0;
    for (const track of tracks) sum += track;
    target = sum;
  },

  subscribe(listener: ProgressListener): () => void {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};
