/**
 * Live, editable scene-colour store — the authoring channel for the WebGL palette.
 *
 * The scene's colours normally live as literals in {@link ./constants} (they are
 * WebGL values that cannot reference a CSS custom property). This store shadows
 * exactly those values so a dev panel can retune them at runtime: the backdrop,
 * orb, galaxy, and atmosphere subscribe to it and refresh their shader uniforms
 * when a value changes, and the panel serialises the current state back out as a
 * config to paste into `constants.ts`.
 *
 * It is a plain zustand store so the scene can read it imperatively inside
 * `useFrame` (`useSceneColorStore.getState()`) while the panel binds to it
 * declaratively (`useSceneColorStore(selector)`), mirroring the timeline split.
 */
import { create } from "zustand";

import {
  BRAIN_CONFIG,
  GALAXY,
  GALAXY_CONFIG,
  ORB,
  ORB_CONFIG,
} from "./constants";

/** Orb scene: background flame palette plus the hero form's own gradient. */
export interface OrbColors {
  /** Radial background wash. */
  bg: string;
  /** Background domain-warp "flame", first colour. */
  flameA: string;
  /** Background domain-warp "flame", second colour. */
  flameB: string;
  /** Flame intensity, 0→~0.4. */
  flameAmt: number;
  /** Ambient mote colour. */
  atmo: string;
  /** Orb point sphere — top of the gradient. */
  colorTop: string;
  /** Orb point sphere — bottom of the gradient. */
  colorBottom: string;
  /** Orb rim / iridescent edge. */
  colorEdge: string;
  /** Orb overall brightness. */
  brightness: number;
}

/** Galaxy scene: background flame palette plus the disc's core→arm gradient. */
export interface GalaxyColors {
  bg: string;
  flameA: string;
  flameB: string;
  flameAmt: number;
  atmo: string;
  /** Galaxy arms. */
  colorEdge: string;
  /** Galaxy core. */
  colorCore: string;
  /** Galaxy overall brightness. */
  brightness: number;
}

/** Brain scene: the point-cloud form's tint, edge, synapse, and glow. */
export interface BrainColors {
  /** Vertical tint, bottom (cool). */
  colorCool: string;
  /** Vertical tint, top (warm). */
  colorWarm: string;
  /** Bright silhouette edge. */
  colorEdge: string;
  /** Dark interior. */
  colorCenter: string;
  /** White-hot synapse flash. */
  colorSynapse: string;
  /** Cursor "neuron" highlight. */
  colorCursor: string;
  /** Overall glow multiplier. */
  glow: number;
}

export interface SceneColorConfig {
  orb: OrbColors;
  galaxy: GalaxyColors;
  brain: BrainColors;
}

/** The starting palette, mirrored from {@link ./constants}. */
export const SCENE_COLOR_DEFAULTS: SceneColorConfig = {
  orb: {
    bg: ORB.bg,
    flameA: ORB.flameA,
    flameB: ORB.flameB,
    flameAmt: ORB.flameAmt,
    atmo: ORB.atmo,
    colorTop: ORB_CONFIG.colorTop,
    colorBottom: ORB_CONFIG.colorBottom,
    colorEdge: ORB_CONFIG.colorEdge,
    brightness: ORB_CONFIG.brightness,
  },
  galaxy: {
    bg: GALAXY.bg,
    flameA: GALAXY.flameA,
    flameB: GALAXY.flameB,
    flameAmt: GALAXY.flameAmt,
    atmo: GALAXY.atmo,
    colorEdge: GALAXY_CONFIG.colorEdge,
    colorCore: GALAXY_CONFIG.colorCore,
    brightness: GALAXY_CONFIG.brightness,
  },
  brain: {
    colorCool: BRAIN_CONFIG.colorCool,
    colorWarm: BRAIN_CONFIG.colorWarm,
    colorEdge: BRAIN_CONFIG.colorEdge,
    colorCenter: BRAIN_CONFIG.colorCenter,
    colorSynapse: BRAIN_CONFIG.colorSynapse,
    colorCursor: BRAIN_CONFIG.colorCursor,
    glow: BRAIN_CONFIG.glow,
  },
};

const clone = (config: SceneColorConfig): SceneColorConfig => ({
  orb: { ...config.orb },
  galaxy: { ...config.galaxy },
  brain: { ...config.brain },
});

interface SceneColorStore extends SceneColorConfig {
  setOrb: (patch: Partial<OrbColors>) => void;
  setGalaxy: (patch: Partial<GalaxyColors>) => void;
  setBrain: (patch: Partial<BrainColors>) => void;
  reset: () => void;
}

/**
 * The store. `.getState()` / `.subscribe()` drive the scene imperatively; the
 * `useSceneColorStore(selector)` hook drives the panel.
 */
export const useSceneColorStore = create<SceneColorStore>((set) => ({
  ...clone(SCENE_COLOR_DEFAULTS),
  setOrb: (patch) => set((state) => ({ orb: { ...state.orb, ...patch } })),
  setGalaxy: (patch) =>
    set((state) => ({ galaxy: { ...state.galaxy, ...patch } })),
  setBrain: (patch) => set((state) => ({ brain: { ...state.brain, ...patch } })),
  reset: () => set(clone(SCENE_COLOR_DEFAULTS)),
}));

/** Current colours, for imperative reads inside the render loop. */
export const getSceneColors = (): SceneColorConfig => {
  const { orb, galaxy, brain } = useSceneColorStore.getState();
  return { orb, galaxy, brain };
};

/** Fires whenever any colour changes. Returns an unsubscribe. */
export const subscribeSceneColors = (listener: () => void): (() => void) =>
  useSceneColorStore.subscribe(listener);

/** Serialise the live palette to the JSON shape the panel exports. */
export const serializeSceneColors = (config: SceneColorConfig): string =>
  JSON.stringify(config, null, 2);
