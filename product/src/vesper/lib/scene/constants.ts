/**
 * Scene constants that live outside CSS.
 *
 * Originally ported from the source scenes (`orb.html`, `spiral-galaxy.html`),
 * since retuned via the colour panel (see `lib/scene/color-store.ts`). They are
 * WebGL colours, not styles — they cannot reference a CSS custom property.
 * `ORB.bg` also seeds the canvas clear colour; it is only visible for one frame
 * before the backdrop draws, so it need not match `--color-void` in
 * `globals.css` (the page background) exactly, though keeping them close avoids a
 * first-paint flash.
 */

export interface ScenePalette {
  bg: string;
  flameA: string;
  flameB: string;
  flameAmt: number;
  atmo: string;
  /** Camera-attached mote spread, in world units. */
  atmoSpread: number;
  /** Radius at which motes begin / finish fading out. */
  atmoFadeNear: number;
  atmoFadeFar: number;
  atmoAlpha: number;
}

/** Ice-blue → indigo jewel. The hero form. */
export const ORB: ScenePalette = {
  bg: "#000000",
  flameA: "#8b98fe",
  flameB: "#6bfdff",
  flameAmt: 0.5,
  atmo: "#c9a8ff",
  atmoSpread: 2.2,
  atmoFadeNear: 2.0,
  atmoFadeFar: 3.2,
  atmoAlpha: 0.5,
};

/** Blue core → mint arms. The second scene. */
export const GALAXY: ScenePalette = {
  bg: "#000000",
  flameA: "#8b98fe",
  flameB: "#6bfdff",
  flameAmt: 0.195,
  atmo: "#c9a8ff",
  atmoSpread: 4.0,
  atmoFadeNear: 5.0,
  atmoFadeFar: 6.5,
  atmoAlpha: 0.6,
};

/** Canvas clear colour. Behind the backdrop, so only seen for the first frame. */
export const SCENE_BACKGROUND = ORB.bg;

/** Orb form. */
export const ORB_CONFIG = {
  colorTop: "#52ffa5",
  colorBottom: "#582eff",
  colorEdge: "#582eff",
  deform: 0.135,
  brightness: 1.24,
  opacity: 1,
  spin: 0.17,
  tilt: 0.39,
  pointerRadius: 1.76,
  oilBulge: 0.46,
  oilRipple: 0.34,
  oilDrag: 0.95,
  rippleFreq: 11,
  rippleSpeed: 4,
  iridescence: 0.6,
  /** Radius of the point sphere, in world units. */
  radius: 1,
  /** World units the orb rushes toward the camera across "Enter the unknown". */
  approach: 2.6,
  /** How much the displacement noise swells as the orb approaches (× deform). */
  distortGain: 3.4,
} as const;

/** Spiral galaxy form. */
export const GALAXY_CONFIG = {
  // Blue core → mint arms — the orb's palette (`ORB_CONFIG.colorBottom`/`colorTop`),
  // so the disc reads as the same blue→mint radial gradient, radiating from centre.
  colorEdge: "#52ffa5",
  colorCore: "#582eff",
  opacity: 0.55,
  pointSize: 6,
  brightness: 1.02,
  armSpin: 0.4,
  tilt: -0.5,
  scale: 0.18,
  /** Camera distance at dive 0, and how far the dive pulls it in. */
  cameraZ: 48,
  dive: 30,
  /** Extra tilt applied across the dive — tips the disc toward edge-on. */
  diveTilt: 0.5,
  /** Cursor orbital sway, in world units. */
  parallax: 4,
  pointerRadius: 5,
  pointerStrength: 2,
} as const;

/**
 * Brain point cloud — the third form, in place of the returning orb + logo.
 *
 * Geometry is area-sampled from a GLB (see `scene/brain/`). Colours are the
 * source scene's, recoloured to the orb's (first scene's) form gradient: the
 * cool→warm vertical tint runs indigo (`ORB_CONFIG.colorBottom`) → mint
 * (`colorTop`), with the same indigo edge, so the brain reads as the same soft
 * gradient as the hero orb. The scalar flow/synapse/size values are the source's.
 */
export const BRAIN_CONFIG = {
  /** Vertical tint: bottom (cool) → top (warm) — the orb's indigo→mint. */
  colorCool: "#582eff",
  colorWarm: "#52ffa5",
  /** Bright silhouette edge — the orb's edge. */
  colorEdge: "#582eff",
  /** Dark interior the edge fades toward. */
  colorCenter: "#000000",
  /** White-hot synapse flash. */
  colorSynapse: "#eafff8",
  /** Occluded/deep fade colour. */
  colorDeep: "#02040e",
  /** Cursor "neuron" highlight. */
  colorCursor: "#6bfdff",
  centerRadius: 0.37,
  centerFalloff: 4,
  size: 0.067,
  synapseRate: 0.1,
  flowSpeed: 2.3,
  flowAmount: 0.025,
  glow: 1.4,
  depthDarkness: 1,
  /** Bounding radius the sampled cloud is scaled to — sized to the hero camera. */
  radius: 1.15,
  /** Points sampled across the surface (desktop; scaled per tier in adaptive). */
  count: 140000,
  /** Radians the brain swivels toward the cursor. */
  cursorTilt: 0.22,
  /** How far scrolling past the assembled brain turns it, in radians. */
  scrollSpin: 2.4,
  /**
   * Resting rotation about the vertical axis, tuned so the formed brain reads as
   * a lateral (side) profile as it comes in. (The source's own "-90° profile" was
   * front-on for this GLB; this turns it a further ~90°.) Flip the sign of the
   * added term (± ~1.57) to show the other profile.
   */
  baseRotationY: -1.309 - 1.5708,
  /** World units the brain rushes toward the camera as it bursts on exit. */
  approach: 2.5,
} as const;

/** Pointer sway of the orb camera. Far smaller — the orb sits close. */
export const ORB_PARALLAX = 0.35;

/** How far the intro pulls the camera back before dollying in. */
export const INTRO_DOLLY = 10;
