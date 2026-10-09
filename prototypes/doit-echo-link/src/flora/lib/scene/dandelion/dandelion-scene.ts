/**
 * The dandelion scene — plain TypeScript, no React.
 *
 * React owns the canvas element and the lifecycle; this owns the WebGL. Shape:
 * construct → `prewarm()` (everything compiles and uploads here) → `update(dt)`
 * per visible frame → `dispose()`. Nothing is allocated, compiled or uploaded
 * after the prewarm (optimize-3d-scene §3).
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  GLSL3,
  HalfFloatType,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Quaternion,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three-flora";
import { EffectComposer } from "three-flora/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three-flora/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three-flora/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three-flora/examples/jsm/postprocessing/UnrealBloomPass.js";

import { clampPixelRatio, readTier, type DeviceTier } from "@flora/lib/scene/device";
import {
  buildDandelion,
  type DandelionGeometry,
  type DandelionGeometryOptions,
} from "@flora/lib/scene/dandelion/dandelion-geometry";
import {
  dandelionFragmentShader,
  dandelionVertexShader,
  toneCurveShader,
} from "@flora/lib/scene/dandelion/shaders";
import type { SceneTokens } from "@flora/lib/scene/tokens";

import {
  FlyCards,
  type FlyCardsConfig,
  type FlyCardsView,
} from "@flora/lib/scene/dandelion/fly-cards";

export interface DandelionSceneConfig {
  /** The readings that leave with the petals. See `fly-cards.ts`. */
  cards?: FlyCardsConfig;
  /** Particles per tier. The largest is allocated; smaller tiers draw a prefix. */
  particleCount: Record<DeviceTier, number>;
  /** Count the glow density is quoted against, so brightness survives a tier cut. */
  referenceCount: number;
  seedCount: number;
  hairsPerSeed: number;
  headRadius: number;
  headCenter: readonly [number, number, number];
  /** The stem starts at the head centre and runs to here. */
  stemBottom: readonly [number, number, number];
  stemRadius: number;
  /** How far the stem bows out of the straight line between its ends. */
  stemBow: number;
  /** Half-width of the box the airborne motes drift through. */
  dustSpan: number;
  dustSpeed: number;
  /** Absolute particle counts — these parts do not thin with the tier. */
  dustParticles: number;
  /** Share of the tier's budget the inner lattice takes. */
  patternShare: number;
  /** Radius of the inner lattice, as a fraction of the head radius. */
  patternRadius: number;
  /** The core burning at the centre of the head. */
  glowParticles: number;
  glowRadius: number;
  /** How much brighter the core burns once the camera is on top of it. */
  glowGain: number;
  /** The flower that opens once the core has gone. */
  flower: {
    /** Share of the tier's budget the flower takes. */
    share: number;
    petals: number;
    /** The spiral, outermost petal → innermost: how the petal scales, where it
     *  attaches on the receptacle, how far its spine bends up, and the total
     *  lift across the spiral. `attachOuter/Inner` is mirrored in the shader. */
    innerScale: number;
    attachOuter: number;
    attachInner: number;
    bendOuter: number;
    bendInner: number;
    /** How far a petal's cross-section rolls about its own spine. Distinct from
     *  `roll`, which turns the whole flower in its face plane. */
    petalRoll: number;
    stack: number;
    /** Petal length and half-width, in the flower's own units. */
    length: number;
    width: number;
    /** World size of the open flower. */
    scale: number;
    /** Radians the petals hinge up out of the plane when the bud is closed. */
    foldAngle: number;
    openFold: number;
    /** Radians the whorl unwinds as it opens. */
    twist: number;
    /** Pitch of the open face back from the vertical — a side view, not
     *  square-on — and the near-vertical attitude the closed bud starts from. */
    tilt: number;
    budTilt: number;
    roll: number;
    /** Sprite scale and brightness for the flower's own particles, both
     *  independent of where the fly-through's camera ended up. */
    grain: number;
    exposure: number;
    /** Turns it makes on its own axis between arriving and the end of the
     *  scroll, and how far its particles travel once they come apart. */
    spinTurns: number;
    scatterDistance: number;
    /** The ending runs in two stages: whole petals fly off and tumble, then
     *  break into particles. `breakPoint` is where one gives way to the other. */
    breakPoint: number;
    flyDistance: number;
    tumble: number;
    /** Share of the ending spent letting petals go, one at a time. */
    stagger: number;
    /** Where the heart gives way — the stem follows it down its own length. */
    heartBreak: number;
    /** Radians the departing petals wind round the middle — the spiral vortex —
     *  and the rad/s everything keeps turning at with the scroll standing still. */
    vortex: number;
    /** How much a departing petal sinks as it drifts out. */
    fall: number;
    idleDrift: number;
    idleSpin: number;
    /** Its stem: length below the head, half-thickness, and the share of the
     *  opening spent raising it before the petals start. */
    stemLength: number;
    stemRadius: number;
    stemShare: number;
    /** How far the head sits above the frame's centre, leaving room for the
     *  stem below it. In flower units, like everything else here. */
    lift: number;
    /** How far the closed bud draws in on itself, as a fraction of full size. */
    budTighten: number;
    /** The flower's own depth cue: how thick it is, and its back/front range. */
    depth: number;
    depthBack: number;
    depthFront: number;
  };
  /** The iris that gathers out of the dark once the flower has gone. */
  iris: {
    share: number;
    /** Pupil radius and how far the rim's tufts overshoot, in its own units. */
    pupil: number;
    rim: number;
    scale: number;
    /** How far out its particles start, and their fixed sprite scale. */
    gather: number;
    grain: number;
    gain: number;
    /** rad/s it turns on its own — this figure has no scroll left to drive it. */
    idleSpin: number;
  };
  /** Where the plant sits across the frame, in half-widths. Positive is right. */
  frameOffsetX: number;
  /** How far the camera turns with the pointer, in radians at the frame's edge. */
  pointerTilt: { yaw: number; pitch: number; roll: number };
  /**
   * What happens when the pointer is on the head.
   *
   * The plant does not move for the pointer — it lights up for it.
   *
   * - `reach` — how near the pointer has to be, in **head radii**, so the
   *   target grows and shrinks with the plant instead of being a fixed patch
   *   of screen.
   * - `lit` — how much brighter the plant is under the hand.
   */
  touch: {
    reach: number;
    lit: number;
  };
  /**
   * The one sway the plant makes as it comes up — see `update`. It is the only
   * motion the plant is given besides its turn, and only while it appears.
   *
   * - `bend` — scale of the swing, in world units at the top of the stem.
   * - `period` — seconds for one full swing, there and back.
   * - `settle` — seconds for the swing to die away by e.
   * - `onset` — seconds the push takes to come on (a smootherstep).
   */
  wind: {
    bend: number;
    period: number;
    settle: number;
    onset: number;
  };
  /** How much of the rings' arrival one structure takes — the rest is the
   *  queue behind it. */
  latticeStagger: number;
  /** Where the pappus turns from white to blue, and how hard that lands. */
  fluffEdgeAt: number;
  fluffEdgeWidth: number;
  /** How far apart the core's particles leave, and how far they travel. */
  glowStagger: number;
  glowReach: number;
  /** Motes adrift around the head: how many, how far they wander, how fast
   *  they orbit. */
  pollenParticles: number;
  pollenDrift: number;
  pollenSpin: number;
  /** How tightly the pollen hugs the bud before the plant has grown. */
  pollenClose: number;
  /** How far the loosening takes, and how much light it costs. */
  thinDrift: number;
  thinFade: number;
  /** Depth of field: how far in front of the head centre the focal plane sits. */
  focusOffset: number;
  /** Distance from the focal plane at which a sprite is fully defocused. */
  dofRange: number;
  /** How much a fully defocused sprite grows. */
  dofSpread: number;
  /** Brightness at the back of the head, and at the front. */
  depthBack: number;
  depthFront: number;
  pointSize: number;
  minPointSize: number;
  /** Ceiling on a sprite's size, in CSS pixels — matters inside the fly-through. */
  maxPointSize: number;
  glowDensity: number;
  /** Head rotation, rad/s of scene time. */
  spinSpeed: number;
  timeScale: number;
  /** Seconds the plant takes to grow in, wall-clock. */
  growthDuration: number;
  /** Share of the growth spent extending the stem; the head opens over the rest. */
  growthStemShare: number;
  /** Stem length when the growth starts, as a fraction of its full length. */
  growthStartLength: number;
  /** Head size when the growth starts, as a fraction of its full radius. */
  budScale: number;
  /**
   * Where in the (eased) growth the shut bud starts to open, 0–1; it opens
   * over the rest. Set a little before `growthStemShare`, so the stem is still
   * finishing its rise as the head starts to open.
   */
  growthOpenAt: number;
  /** How much of its light the shut bud keeps, 0–1 — see the vertex shader. */
  budAlpha: number;
  /** The scroll-driven fly-through. */
  journey: {
    /** Degrees the camera arcs around the flower. */
    turnDegrees: number;
    /** Progress by which the turn is complete. */
    /** Progress at which the camera starts moving in. */
    travelStart: number;
    /** Where the orbit hands over to the dive, and the radius it hands over at. */
    orbitEnd: number;
    orbitDistance: number;
    /** Where the camera finishes its approach and holds. */
    travelEnd: number;
    /**
     * Shapes the approach. Below 1 the camera covers the far distance sooner and
     * spends longer near and inside the head; the curve stays monotonic either
     * way, which is the part that matters (see `applyCamera`).
     */
    /**
     * Where the camera comes to rest, as a distance from the head centre. It
     * stops on the core: the sequence ends with everything scattering, not with
     * an exit. Negative would carry it out the far side.
     */
    endDistance: number;
    /** Progress at which the frame starts fading to black. */
    fadeStart: number;
    fadeEnd: number;
    /** Focal distance to hold once the camera is inside the head. */
    insideFocus: number;
    /** How much the depth of field widens inside the head, as a multiplier. */
    insideDofSpread: number;
    /** Extra brightness once the camera is inside, as a multiplier. */
    insideGain: number;
    /** Progress over which the lattice's filigree resolves. */
    detailStart: number;
    detailEnd: number;
    /** Turns the lattice's fastest band makes across the whole scroll. */
    latticeTurns: number;
    /** rad/s the lattice keeps turning at without any scroll. */
    latticeIdle: number;
    /** Progress over which everything blows apart around the core. */
    scatterStart: number;
    scatterEnd: number;
    /** The core and the rings each have their own clock — see the shader. */
    glowScatterStart: number;
    glowScatterEnd: number;
    patternScatterStart: number;
    patternScatterEnd: number;
    /** Where the backdrop's colour gives way to black. */
    darkenStart: number;
    darkenEnd: number;
    /** Where the off-centre composition gives way to a centred one. */
    centreStart: number;
    centreEnd: number;
    /** Where the rings fade in, as the camera closes on the head. */
    latticeStart: number;
    latticeEnd: number;
    /** Where the head starts loosening — a long, gentle ramp before it leaves. */
    thinStart: number;
    thinEnd: number;
    /** How far a particle travels on the scatter, in world units. */
    scatterDistance: number;
    /** Progress over which the flower opens, after the scatter has cleared. */
    bloomStart: number;
    bloomEnd: number;
    /** …and where it comes apart again, into the dark. */
    flowerScatterStart: number;
    flowerScatterEnd: number;
    /** …and where the iris gathers in its place. */
    irisStart: number;
    irisEnd: number;
  };
  /**
   * Drawing-buffer height, in pixels, the look is tuned at. Brightness is scaled
   * from it — see `resolutionFactor()`.
   */
  referenceHeight: number;
  bloom: { strength: number; radius: number; threshold: number };
  /**
   * Height, in pixels, of the buffer the bloom is computed in. Fixed on purpose
   * — see `bloomSize()`.
   */
  bloomHeight: number;
  exposure: number;
  fov: number;
  cameraDistance: number;
  cameraTarget: readonly [number, number, number];
  /** Half-width the framing must always fit, in world units. */
  framingRadius: number;
}

export interface DandelionSceneOptions {
  canvas: HTMLCanvasElement;
  tokens: SceneTokens;
  config: DandelionSceneConfig;
  /**
   * The flower's buffers, already built — `buildDandelionOffThread` with
   * `dandelionGeometryOptions(config)` grows them in a worker so the page's
   * thread never carries that second of arithmetic. Built here when absent.
   */
  particles?: DandelionGeometry;
}

/**
 * What `buildDandelion` is asked for, from the scene's config. One buffer for
 * the largest tier: the builder shuffles the particle order, so a smaller
 * tier's draw-range prefix thins the whole flower evenly instead of dropping
 * the stem (optimize-3d-scene §7).
 */
export const dandelionGeometryOptions = (
  config: DandelionSceneConfig,
): DandelionGeometryOptions => ({
  total: Math.max(...Object.values(config.particleCount)),
  seedCount: config.seedCount,
  hairsPerSeed: config.hairsPerSeed,
  headRadius: config.headRadius,
  headCenter: config.headCenter,
  stemBottom: config.stemBottom,
  stemRadius: config.stemRadius,
  stemBow: config.stemBow,
  dustSpan: config.dustSpan,
  dustParticles: config.dustParticles,
  patternShare: config.patternShare,
  patternRadius: config.patternRadius,
  glowParticles: config.glowParticles,
  pollenParticles: config.pollenParticles,
  glowRadius: config.glowRadius,
  bloomShare: config.flower.share,
  bloomPetals: config.flower.petals,
  bloomStemLength: config.flower.stemLength,
  bloomStemRadius: config.flower.stemRadius,
  bloomLength: config.flower.length,
  bloomWidth: config.flower.width,
  irisShare: config.iris.share,
  irisPupil: config.iris.pupil,
  irisRim: config.iris.rim,
  bloomInnerScale: config.flower.innerScale,
  bloomAttachOuter: config.flower.attachOuter,
  bloomAttachInner: config.flower.attachInner,
  bloomBendOuter: config.flower.bendOuter,
  bloomBendInner: config.flower.bendInner,
  bloomRoll: config.flower.petalRoll,
});

/** A tab-switch otherwise hands the scene a multi-second delta. */
const MAX_DELTA = 0.05;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * A **linear** ramp from `edge0` to `edge1`, clamped at both ends.
 *
 * Everything the scroll drives is staged with this rather than with a
 * smoothstep. An eased ramp means the thing it drives speeds up and slows down
 * while the wheel turns at a constant rate, and the scene reads as fighting the
 * scroll. Linear, the scene tracks the wheel exactly — which is the same reason
 * `uLatticeSpin` has always been linear in progress.
 *
 * Load-time staging (the plant growing in) is a different thing and keeps its
 * easing: nothing is driving that but the clock.
 */
const ramp = (edge0: number, edge1: number, value: number): number =>
  clamp01((value - edge0) / Math.max(edge1 - edge0, 0.0001));

/**
 * Per-particle share of the glow density. Additive blending sums every sprite,
 * so the quoted density is spread across the reference particle count. Tuned by
 * eye at 500 000 particles: raise it and the head burns out to a flat white
 * ball, losing the individual hairs that make it read as a dandelion.
 */
const BRIGHTNESS_SCALE = 0.16;

/** How far in front of the camera the open flower sits, in flower scales. */
const FLOWER_DISTANCE = 5.4;
/** And how far in front of it the closing iris sits. */
const BLACK = new Color(0, 0, 0);
const IRIS_DISTANCE = 4.6;
/** The iris's own half-width, in its units — fibres reach 1, tufts overshoot. */
const IRIS_SPREAD = 1.12;
/** The open flower's half-width, as a multiple of a petal's length. */
const FLOWER_SPREAD = 1.05;

export class DandelionScene {
  private readonly config: DandelionSceneConfig;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly tonePass: ShaderPass;
  private readonly points: Points;
  private readonly material: ShaderMaterial;
  private readonly geometry: BufferGeometry;
  private readonly renderTarget: WebGLRenderTarget;
  private readonly headCenter: Vector3;

  private tier: DeviceTier;
  private pixelRatio: number;
  private elapsed = 0;
  private frameOffsetX: number;
  /** Where the pointer is, −1…1 from the middle of the viewport, smoothed. */
  /**
   * **How still the plant is holding, 0–1.**
   *
   * The wind and the hand are what a plant does while it is being *looked at*.
   * Under a scroll they are noise: the camera is already moving, the whole
   * frame is already moving, and a plant swaying inside that reads as drift in
   * the scene rather than as life. It goes quiet while the page is scrolling
   * and comes back when it stops — eased both ways, because a plant that
   * freezes on the first notch of a wheel is a plant that broke.
   */
  private calm = 1;
  /** Seconds into the one sway the plant makes as it comes up. */
  private swayTime = 0;
  /** Scrolled at least once: the breeze is over for good. */
  private windGone = false;
  /** …and how much of it is left while it goes, 0–1. */
  private windLeft = 1;
  /** How much the head is being brushed, 0–1. */
  private touch = 0;
  private readonly headProbe = new Vector3();
  private readonly headEdge = new Vector3();
  private pointerX = 0;
  private pointerY = 0;
  /** The backdrop as the page ships it, and the colour actually cleared to —
   *  the second is the first fading to black as the camera comes round. */
  private readonly backdrop: Color;
  private readonly clear = new Color();
  /** The bloom in force; the config seeds it. */
  private look: DandelionSceneConfig["bloom"];
  private growthElapsed = 0;
  /** Scroll through the hero stage, 0–1. */
  private progress = 0;
  /** Camera distance the composition is framed at — the start of the journey. */
  private baseDistance: number;
  /** The cards riding the scatter, if this scene was given any. */
  private readonly cards: FlyCards | null;
  /** Their own scene: they are drawn over the composed image, not into it. */
  private readonly cardsScene = new Scene();
  private readonly cameraRight = new Vector3();
  private readonly cameraUp = new Vector3();
  private readonly cameraBack = new Vector3();
  /** Scratch: the direction the camera looks, for placing the cards. */
  private readonly cardsForward = new Vector3();
  /** Scratch: the camera as the cards need it, filled in per frame. */
  private readonly cardsView: FlyCardsView = {
    position: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    forward: new Vector3(),
    facing: new Quaternion(),
    tanHalfFov: 1,
    aspect: 1,
  };

  constructor({ canvas, tokens, config, particles }: DandelionSceneOptions) {
    this.config = config;
    this.frameOffsetX = config.frameOffsetX;
    this.look = { ...config.bloom };
    this.tier = readTier();
    this.pixelRatio = clampPixelRatio(this.tier);
    this.headCenter = new Vector3(...config.headCenter);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      // Nothing depth-tests: the points are additive and unsorted.
      depth: false,
      powerPreference: this.tier === "desktop" ? "high-performance" : "default",
    });
    // The tone curve pass encodes sRGB itself — see shaders.ts.
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.backdrop = new Color(tokens.backdrop);
    this.renderer.setClearColor(this.backdrop, 1);

    const { width, height } = this.canvasSize();
    this.renderer.setSize(width, height, false);

    this.camera = new PerspectiveCamera(config.fov, width / height, 0.1, 100);
    this.baseDistance = this.framingDistance();
    const distance = this.baseDistance;
    this.cards = config.cards ? new FlyCards(config.cards, tokens.card) : null;
    if (this.cards) this.cardsScene.add(this.cards.object);

    this.applyCamera();

    this.geometry = this.buildParticles(particles);
    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: dandelionVertexShader,
      fragmentShader: dandelionFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uTouch: { value: 0 },
        uTouchLit: { value: config.touch.lit },
        uWind: { value: 0 },
        uGrowth: { value: 0 },
        uStemShare: { value: config.growthStemShare },
        uStartLength: { value: config.growthStartLength },
        uBudScale: { value: config.budScale },
        uOpenAt: { value: config.growthOpenAt },
        uBudAlpha: { value: config.budAlpha },
        uSize: { value: config.pointSize },
        uMinSize: { value: config.minPointSize },
        uMaxSize: { value: config.maxPointSize },
        uPixelRatio: { value: this.pixelRatio },
        uPerspective: { value: distance },
        uIntensity: { value: this.intensity() },
        uInsideGain: { value: 1 },
        uFade: { value: 1 },
        uDetail: { value: 0 },
        uLatticeSpin: { value: 0 },
        uScatter: { value: 0 },
        uGlowScatter: { value: 0 },
        uPatternScatter: { value: 0 },
        uLattice: { value: 0 },
        uLatticeStagger: { value: config.latticeStagger },
        uThin: { value: 0 },
        uThinFade: { value: config.thinFade },
        uThinDrift: { value: config.thinDrift },
        uScatterDistance: { value: config.journey.scatterDistance },
        uGlowGain: { value: 1 },
        uColorGlow: { value: new Color(tokens.glow) },
        uColorPollen: { value: new Color(tokens.pollen) },
        uColorPetalLight: { value: new Color(tokens.petalLight) },
        uColorPetalDeep: { value: new Color(tokens.petalDeep) },
        uColorBloomStem: { value: new Color(tokens.bloomStem) },
        uBloom: { value: 0 },
        uBloomScale: { value: config.flower.scale },
        uBloomSpan: { value: config.flower.length + config.flower.attachOuter },
        uBloomStack: { value: config.flower.stack },
        uFoldAngle: { value: config.flower.foldAngle },
        uOpenFold: { value: config.flower.openFold },
        uBloomTwist: { value: config.flower.twist },
        uBloomTilt: { value: config.flower.tilt },
        uBloomBudTilt: { value: config.flower.budTilt },
        uBloomRoll: { value: config.flower.roll },
        uBloomStemLength: { value: config.flower.stemLength },
        uBloomStemReach: { value: 1 },
        uBloomSpin: { value: 0 },
        uBloomScatter: { value: 0 },
        uBloomScatterDistance: { value: config.flower.scatterDistance },
        uBloomBreak: { value: config.flower.breakPoint },
        uBloomFly: { value: config.flower.flyDistance },
        uBloomTumble: { value: config.flower.tumble },
        uBloomFall: { value: config.flower.fall },
        uBloomStagger: { value: config.flower.stagger },
        uBloomHeartBreak: { value: config.flower.heartBreak },
        uBloomVortex: { value: config.flower.vortex },
        uBloomDrift: { value: config.flower.idleDrift },
        /* What the flower turns through per unit of the scatter ramp, so a
           freed petal can give that turn back — see the vertex shader. */
        uBloomSpinRate: {
          value:
            (config.flower.spinTurns *
              Math.PI *
              2 *
              (config.journey.flowerScatterEnd -
                config.journey.flowerScatterStart)) /
            Math.max(1 - config.journey.bloomStart, 0.001),
        },
        uPetalLength: { value: config.flower.length },
        uPetalInnerScale: { value: config.flower.innerScale },
        uPetalBendOuter: { value: config.flower.bendOuter },
        uPetalBendInner: { value: config.flower.bendInner },
        uBloomStemShare: { value: config.flower.stemShare },
        uBloomPerspective: { value: config.flower.grain },
        uBudTighten: { value: config.flower.budTighten },
        uBloomViewZ: { value: 0 },
        uBloomDepth: { value: config.flower.scale * config.flower.depth },
        uBloomBack: { value: config.flower.depthBack },
        uBloomFront: { value: config.flower.depthFront },
        uBloomCenter: { value: this.headCenter.clone() },
        uBloomRight: { value: new Vector3(1, 0, 0) },
        uBloomUp: { value: new Vector3(0, 1, 0) },
        uBloomForward: { value: new Vector3(0, 0, -1) },
        uHeadRadius: { value: config.headRadius },
        uHeadViewZ: { value: this.headViewZ() },
        uHeadCenter: { value: this.headCenter.clone() },
        uSpin: { value: config.spinSpeed },
        uStemBase: { value: new Vector3(...config.stemBottom) },
        uFocus: { value: distance - config.focusOffset },
        uDofRange: { value: config.dofRange },
        uDofSpread: { value: config.dofSpread },
        uDepthBack: { value: config.depthBack },
        uDepthFront: { value: config.depthFront },
        uDepthMix: { value: 1 },
        uDustSpeed: { value: config.dustSpeed },
        uDustSpan: { value: config.dustSpan },
        uColorFluff: { value: new Color(tokens.fluff) },
        uColorFluffEdge: { value: new Color(tokens.fluffEdge) },
        uColorFluffYoung: { value: new Color(tokens.fluffYoung) },
        uEdgeAt: { value: config.fluffEdgeAt },
        uEdgeWidth: { value: config.fluffEdgeWidth },
        uGlowStagger: { value: config.glowStagger },
        uGlowReach: { value: config.glowReach },
        uPollenDrift: { value: config.pollenDrift },
        uPollenClose: { value: config.pollenClose },
        uPollenSpin: { value: config.pollenSpin },
        uColorStem: { value: new Color(tokens.stem) },
        uColorBody: { value: new Color(tokens.seedBody) },
        uColorCore: { value: new Color(tokens.core) },
        uIris: { value: 0 },
        uIrisScale: { value: config.iris.scale },
        uIrisGather: { value: config.iris.gather },
        uIrisGrain: { value: config.iris.grain },
        uIrisGain: { value: config.iris.gain },
        uBloomExposure: { value: config.flower.exposure },
        uIrisTurn: { value: 0 },
        uIrisCenter: { value: new Vector3() },
        uIrisPupil: { value: config.iris.pupil },
        uColorIrisLime: { value: new Color(tokens.irisLime) },
        uColorIrisSky: { value: new Color(tokens.irisSky) },
      },
    });

    this.points = new Points(this.geometry, this.material);
    // Positions are displaced in the shader — a bounding sphere would be a lie.
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.renderTarget = new WebGLRenderTarget(
      width * this.pixelRatio,
      height * this.pixelRatio,
      { type: HalfFloatType, depthBuffer: false, stencilBuffer: false },
    );
    // 연결 시안: three-flora(0.186) 의 후처리 모듈 타입 선언이 내부에서 "three"(=Clarix 0.184 타입)를 가리킨다.
    // 실행 시에는 vite.config.ts 의 별칭 규칙이 그 "three" 를 three-flora 로 돌려 같은 0.186 객체만 오간다 —
    // 아래 세 곳의 `as never` 는 타입 선언끼리의 버전 차이만 넘긴다.
    this.composer = new EffectComposer(this.renderer as never, this.renderTarget as never);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(width, height);
    this.composer.addPass(new RenderPass(this.scene as never, this.camera as never));

    const bloom = this.bloomFor();
    const bloomSize = this.bloomSize();
    this.bloomPass = new UnrealBloomPass(
      new Vector2(bloomSize.width, bloomSize.height) as never,
      bloom.strength,
      bloom.radius,
      bloom.threshold,
    );
    // A pass contributing nothing still costs a full-screen chain per frame.
    this.bloomPass.enabled = bloom.strength > 0.001;
    this.composer.addPass(this.bloomPass);

    this.tonePass = new ShaderPass(toneCurveShader);
    this.tonePass.uniforms.uExposure.value = config.exposure;
    this.composer.addPass(this.tonePass);
  }

  private canvasSize(): { width: number; height: number } {
    const canvas = this.renderer.domElement;
    return {
      width: Math.max(1, canvas.clientWidth),
      height: Math.max(1, canvas.clientHeight),
    };
  }

  /**
   * Pull the camera back on a narrow viewport. The field of view is vertical, so
   * a portrait phone would otherwise crop the head; this keeps `framingRadius`
   * inside both axes.
   */
  /** How far back the composition has to sit for `framingRadius` to fit. */
  /**
   * How far the closing flower sits in front of the camera.
   *
   * Same job as `framingDistance()` does for the dandelion: the field of view is
   * vertical, so on a tall narrow viewport a flower framed by height runs off
   * both sides. Pushed back far enough, the whole plant is in shot on every
   * aspect — which is the point of the scene looking the same everywhere.
   */
  private flowerDistance(): number {
    const { fov, flower } = this.config;
    const halfFov = (fov * Math.PI) / 360;
    const base = flower.scale * FLOWER_DISTANCE;
    const radius =
      flower.scale * (flower.length + flower.attachOuter) * FLOWER_SPREAD;
    const needed =
      radius / (Math.tan(halfFov) * Math.max(this.camera.aspect, 0.01));
    return Math.max(base, needed);
  }

  /** Same job as `flowerDistance()`, for the figure that closes the scroll. */
  private irisDistance(): number {
    const { fov, iris } = this.config;
    const halfFov = (fov * Math.PI) / 360;
    const base = iris.scale * IRIS_DISTANCE;
    const needed =
      (iris.scale * IRIS_SPREAD) /
      (Math.tan(halfFov) * Math.max(this.camera.aspect, 0.01));
    return Math.max(base, needed);
  }

  private framingDistance(): number {
    const { cameraDistance, cameraTarget, fov, framingRadius } = this.config;
    void cameraTarget;
    const halfFov = (fov * Math.PI) / 360;
    // The off-centre composition eats into the half-width, so the framing has to
    // pull back for it as well as for a narrow viewport.
    const room = Math.max(0.2, 1 - Math.abs(this.frameOffsetX));
    const needed =
      framingRadius /
      (Math.tan(halfFov) * Math.max(this.camera.aspect, 0.01) * room);
    return Math.max(cameraDistance, needed);
  }

  /**
   * Places the camera for the current scroll progress.
   *
   * At `progress = 0` this is exactly the framed composition. From there the
   * camera arcs `turnDegrees` around the flower's axis — which reads as the
   * flower turning — while closing on the head, and comes to rest on the core at
   * `endDistance`, which the world then scatters away from. The look target
   * leads the camera along its own path rather than staying on the flower, or
   * the camera would spin round to face the head again the moment it passed
   * anything — which is exactly what an earlier build did.
   */
  private applyCamera(): void {
    const { cameraTarget, journey } = this.config;
    const p = this.progress;

    // **Two legs, in this order: the orbit, then the dive.**
    //
    //   orbit   the camera carries the flower through a half turn while closing
    //           slowly on it, looking at it the whole way
    //   dive    the turning stops, the closing speeds up, and the camera goes
    //           straight through the head and out the far side
    //
    // They are two legs on purpose — this is the shape of the sequence, not an
    // accident of the maths. The thing to avoid is a leg that *stops*: both are
    // linear, so at the seam the angular rate falls to nothing exactly as the
    // radial rate jumps, and the motion carries through rather than pausing.
    // Two eased legs is what the old version had, and both had zero gradient at
    // the join, so the camera came to a dead stop in the middle of every flight.
    const orbit = ramp(journey.travelStart, journey.orbitEnd, p);
    const dive = ramp(journey.orbitEnd, journey.travelEnd, p);
    // **The turn does not stop at the seam.** It runs at one rate across both
    // legs, so there is no moment where the rotation ends — ending it there is a
    // hard stop in the most visible motion on screen, and it reads as a jolt.
    // What separates the legs is the *radius*: barely moving through the orbit,
    // dropping fast through the dive. The turn carrying on through the dive also
    // curves the path into the head rather than driving it in on a rail, and
    // keeps the camera off any one viewing angle long enough for a ring to
    // present edge-on.
    const turn =
      ramp(journey.travelStart, journey.travelEnd, p) *
      ((journey.turnDegrees * Math.PI) / 180);
    // The orbit closes to `orbitDistance` — still outside the pappus, so the
    // whole plant is in frame for the turn — and the dive carries on from there
    // to `endDistance`, which is **negative**: that is what takes the camera out
    // the far side rather than parking it nose-against the core.
    //
    // Both legs are straight lines. An eased one has the camera speeding up and
    // slowing down under a wheel turning at a constant rate (ADR-0034), and two
    // eased ones meet at a dead stop.
    const closing =
      this.baseDistance + (journey.orbitDistance - this.baseDistance) * orbit;
    const distance = closing + (journey.endDistance - closing) * dive;

    // The orbit centre lifts from the composition's target onto the head, so the
    // camera circles the head rather than the composition — and is there well
    // before the turn is.
    const lift = clamp01(orbit / 0.5);
    const cx = cameraTarget[0] + (this.headCenter.x - cameraTarget[0]) * lift;
    const cy = cameraTarget[1] + (this.headCenter.y - cameraTarget[1]) * lift;
    const cz = cameraTarget[2] + (this.headCenter.z - cameraTarget[2]) * lift;

    const dirX = Math.sin(turn);
    const dirZ = Math.cos(turn);
    // **The plant sits off-centre.** The camera is translated sideways, which
    // moves the subject the other way on screen; the shift is measured in
    // half-widths of the frame and scales with the distance, so the plant holds
    // its place in the composition as the camera closes — and goes to nothing on
    // its own as the distance does, which is what has to happen before the
    // pass-through. Rotating the aim instead would swing the plant through the
    // frame as the camera arced round it.
    // It also **runs out before the zoom does**. Left to fade with the distance
    // alone it is still well off-centre halfway in, and the fly-through has to
    // start from the middle of the frame: the camera is aiming at the head it is
    // about to be inside.
    const halfFov = (this.config.fov * Math.PI) / 360;
    const lateral =
      this.frameOffsetX *
      (1 - ramp(journey.centreStart, journey.centreEnd, p)) *
      Math.max(distance, 0) *
      Math.tan(halfFov) *
      this.camera.aspect;
    const sideX = dirZ * -lateral;
    const sideZ = -dirX * -lateral;

    const px = cx + dirX * distance + sideX;
    const pz = cz + dirZ * distance + sideZ;
    this.camera.position.set(px, cy, pz);

    // **The aim stays on the flower.** The camera is orbiting it, so it looks at
    // it for the whole of the approach — that is what an orbit is. Leading the
    // aim along the path was needed only while the flight went *through* the
    // head and out the far side; with the camera circling and closing there is
    // nothing ahead to look at, and leading the aim just turned the flower out
    // of frame two thirds of the way in.
    // **The camera looks along its own inward ray**, always: one unit ahead of
    // itself, down the line it is travelling.
    //
    // For a camera outside the head this *is* "look at the orbit centre" — the
    // ray points straight at it — so the orbit keeps the flower dead centre and
    // the zoom lands on the core. Past the centre it points away from it, which
    // is a fly-through. One rule, continuous the whole way.
    //
    // Aiming at a **point** instead cannot survive the crossing. The aim was
    // `centre + (position - centre - 2·dir)·ahead`, blended onto the lead only
    // over the last third of the dive — so through the crossing it was the
    // centre itself, and `aim - position` shrank to **zero** exactly there and
    // then flipped 180°. `lookAt` has no direction to work with at that instant:
    // the camera swung away, the core left the frame for a few frames, and it
    // swung back. It read as the pass being broken, and it was.
    this.camera.lookAt(px - dirX, cy, pz - dirZ);
    this.camera.updateMatrixWorld();
    // **The closing figures take their basis from the un-nudged camera.** They
    // are placed in that basis at a fixed distance, so if it carried the pointer
    // tilt they would swing with the frame and the tilt would be invisible on
    // exactly the two figures it should be most visible on. Read here, then
    // nudged below, the camera turns past them.
    this.camera.matrixWorld.extractBasis(
      this.cameraRight,
      this.cameraUp,
      this.cameraBack,
    );

    // A small turn on all three axes, following the pointer. It is orientation
    // only — the camera does not move, so nothing about the journey's framing
    // changes and the tilt cannot fight the scroll.
    const { pointerTilt } = this.config;
    this.camera.rotateX(-this.pointerY * pointerTilt.pitch);
    this.camera.rotateY(-this.pointerX * pointerTilt.yaw);
    this.camera.rotateZ(this.pointerX * pointerTilt.roll);
    this.camera.updateMatrixWorld();

    const material = this.material as ShaderMaterial | undefined;
    if (!material) return;
    material.uniforms.uPerspective.value = Math.max(Math.abs(distance), 0.35);
    material.uniforms.uHeadViewZ.value = this.headViewZ();

    // Inside the head there is no "subject at a distance" left to focus on, so
    // the focal plane parks just ahead of the camera and the depth of field
    // opens up. Without this the fly-through is a blur of nothing: everything
    // around the camera sits far from a focal plane pinned to the head centre.
    const closeness =
      1 - clamp01(Math.abs(distance) / Math.max(this.baseDistance, 0.001));
    let focus = Math.max(
      distance - this.config.focusOffset,
      this.config.journey.insideFocus,
    );
    let dofRange =
      this.config.dofRange *
      (1 + closeness * this.config.journey.insideDofSpread);

    // Once the flower opens, the focus moves onto it. It sits well outside the
    // focal plane the fly-through leaves behind, and the depth of field dims
    // whatever it defocuses — which is why the first build of the flower looked
    // underexposed however much brightness went into its particles.
    const bloom = ramp(journey.bloomStart, journey.bloomEnd, p);
    if (bloom > 0) {
      focus = focus + (this.flowerDistance() - focus) * bloom;
      dofRange = dofRange + (this.config.dofRange - dofRange) * bloom;
    }

    material.uniforms.uFocus.value = focus;
    material.uniforms.uDofRange.value = dofRange;

    const radius = this.config.headRadius;
    material.uniforms.uDepthMix.value = clamp01(
      (Math.abs(distance) - radius * 0.6) / (radius * 1.6),
    );

    // Close up, a handful of particles have to fill the whole frame, where from
    // outside thousands did. Same reason a camera opens its aperture indoors.
    //
    // It applies to the **plant and its interior only**. The flower and the iris
    // sit at fixed distances of their own and have nothing to do with where the
    // fly-through's camera ended up — riding this, their exposure drifted with
    // the travel curve, which is how a change to the camera's pacing turned into
    // a change to how bright the closing figures are.
    material.uniforms.uInsideGain.value =
      1 + closeness * this.config.journey.insideGain;
    material.uniforms.uFade.value =
      1 - ramp(journey.fadeStart, journey.fadeEnd, p);

    // The filigree resolves as the camera closes in.
    material.uniforms.uDetail.value = ramp(
      journey.detailStart,
      journey.detailEnd,
      p,
    );
    // The bands turn with the scroll — linear in progress, so the motion tracks
    // the wheel exactly rather than easing away from it.
    // Plus a slow turn off the clock, so nothing in the frame is ever still.
    material.uniforms.uLatticeSpin.value =
      p * journey.latticeTurns * Math.PI * 2 +
      this.elapsed * journey.latticeIdle;

    // The approach ends with everything leaving: the flower, the lattice and
    // finally the core itself, into the dark.
    material.uniforms.uScatter.value = ramp(
      journey.scatterStart,
      journey.scatterEnd,
      p,
    );
    material.uniforms.uGlowScatter.value = ramp(
      journey.glowScatterStart,
      journey.glowScatterEnd,
      p,
    );
    material.uniforms.uPatternScatter.value = ramp(
      journey.patternScatterStart,
      journey.patternScatterEnd,
      p,
    );
    // The rings arrive with the zoom, not from across the frame.
    material.uniforms.uLattice.value = ramp(
      journey.latticeStart,
      journey.latticeEnd,
      p,
    );
    // And the head loosens on the way in, long before it leaves.
    material.uniforms.uThin.value = ramp(journey.thinStart, journey.thinEnd, p);
    // Dim from outside — it should only smoulder through the pappus — and
    // blazing once the camera is on top of it. Starting at full brightness turns
    // the whole flower into a golden ball from across the frame.
    material.uniforms.uGlowGain.value = 0.3 + closeness * this.config.glowGain;

    // The flower opens where the core was. Its geometry is local to the camera's
    // basis — right, up and forward — which is what keeps the stem vertical on
    // screen whatever direction the fly-through ended up pointing.
    material.uniforms.uBloom.value = bloom;
    // It turns on its own axis from the moment it arrives until the scroll ends,
    // and keeps turning while it comes apart. Linear in progress, like the
    // lattice's bands — the motion tracks the wheel instead of easing away.
    const spinSpan = Math.max(1 - journey.bloomStart, 0.001);
    material.uniforms.uBloomSpin.value =
      clamp01((p - journey.bloomStart) / spinSpan) *
        this.config.flower.spinTurns *
        Math.PI *
        2 +
      this.elapsed * this.config.flower.idleSpin;
    material.uniforms.uBloomScatter.value = ramp(
      journey.flowerScatterStart,
      journey.flowerScatterEnd,
      p,
    );
    (material.uniforms.uBloomRight.value as Vector3).copy(this.cameraRight);
    (material.uniforms.uBloomUp.value as Vector3).copy(this.cameraUp);
    (material.uniforms.uBloomForward.value as Vector3)
      .copy(this.cameraBack)
      .negate();
    // A little in front of the camera's resting place, so it fills the frame,
    // and raised, so the stem has somewhere to hang.
    const flowerDistance = this.flowerDistance();
    const bloomCenter = material.uniforms.uBloomCenter.value as Vector3;
    bloomCenter
      .copy(this.camera.position)
      .addScaledVector(this.cameraBack, -flowerDistance)
      .addScaledVector(
        this.cameraUp,
        this.config.flower.scale * this.config.flower.lift,
      );
    // Pushed back for a narrow viewport, the flower is smaller in a taller frame,
    // so its stem has further to fall before it is out of shot.
    // **The room goes out as the camera comes round.** The backdrop is a colour
    // in the opening composition and black by the time the camera is among the
    // rings: from in there the only light is the scene's own, and a lit room
    // behind it reads as a photograph of a model rather than as being inside
    // something.
    this.renderer.setClearColor(
      this.clear
        .copy(this.backdrop)
        .lerp(BLACK, ramp(journey.darkenStart, journey.darkenEnd, p)),
      1,
    );

    // The iris gathers square in front of the camera once the flower has gone.
    material.uniforms.uIris.value = ramp(journey.irisStart, journey.irisEnd, p);
    material.uniforms.uIrisTurn.value =
      this.elapsed * this.config.iris.idleSpin;
    (material.uniforms.uIrisCenter.value as Vector3)
      .copy(this.camera.position)
      .addScaledVector(this.cameraBack, -this.irisDistance());

    material.uniforms.uBloomStemReach.value =
      (flowerDistance / (this.config.flower.scale * FLOWER_DISTANCE)) * 1.15;
    // Its own depth cue needs to know where its middle sits in view space.
    material.uniforms.uBloomViewZ.value = bloomCenter
      .clone()
      .applyMatrix4(this.camera.matrixWorldInverse).z;

    // The cards leave on the petals' own ramp, flown between the boxes the
    // design draws them in — they need the camera, not the flower.
    if (this.cards) {
      this.cardsView.position = this.camera.position;
      this.cardsView.right = this.cameraRight;
      this.cardsView.up = this.cameraUp;
      this.cardsView.forward = this.cardsForward.copy(this.cameraBack).negate();
      this.cardsView.facing = this.camera.quaternion;
      this.cardsView.tanHalfFov = Math.tan((this.camera.fov * Math.PI) / 360);
      this.cardsView.aspect = this.camera.aspect;
      this.cards.update(
        material.uniforms.uBloomScatter.value as number,
        ramp(journey.flowerScatterEnd, journey.flowerScatterEnd + 0.05, p),
        this.cardsView,
        /* The breath is 0.05 of the stage and one leg of the scatter a quarter
           of its span: the cards fly on for this many legs as they fade. */
        0.05 /
          Math.max(
            (journey.flowerScatterEnd - journey.flowerScatterStart) * 0.25,
            0.0001,
          ),
      );
    }
  }

  /**
   * Where the pointer is, −1…1 from the middle of the viewport. The leaf smooths
   * it; a raw pointer reads as jitter on a tilt this small.
   */
  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  /**
   * The pointer brushing the head: the plant leans away from it and sheds
   * pollen for as long as it is there.
   *
   * Both the reach and the lean are worked in **projected** terms rather than
   * guessed at in pixels — the head is a moving object in a moving camera, and
   * a hit box in screen coordinates would be right in one frame of the flight
   * and wrong in the rest. The head's centre and a point one radius to its side
   * are both projected, so the target is the head's own size on screen whatever
   * the camera is doing.
   *
   * @param x - pointer, −1…1 across the viewport, or `null` on a touch screen,
   *   where there is no hover to read and the plant should simply settle back.
   * @param dt - seconds, for a follow that is the same speed at any framerate.
   */
  brush(x: number | null, y: number, dt: number, scrolling = false): void {
    const { touch } = this.config;
    const step = Math.min(Math.max(dt, 0), 1 / 30);

    /* Frame-rate independent, and slower coming back than going: the plant
       should settle the moment the reader starts moving and take its time
       standing up again. */
    const toward = scrolling ? 0 : 1;
    const ease = 1 - Math.pow(1 - (scrolling ? 0.14 : 0.035), step * 60);
    this.calm += (toward - this.calm) * ease;

    const u = this.material.uniforms;

    let wanted = 0;

    if (x !== null && !scrolling) {
      const head = this.headProbe.copy(this.headCenter).project(this.camera);
      const edge = this.headEdge
        .copy(this.headCenter)
        .addScaledVector(this.cameraRight, this.config.headRadius)
        .project(this.camera);
      /* Projected y runs up, the pointer's runs down. */
      const dx = x - head.x;
      const dy = y + head.y;
      const radius = Math.max(0.02, Math.abs(edge.x - head.x));
      const near = Math.hypot(dx, dy) / radius;
      wanted = 1 - clamp01((near - 1) / Math.max(touch.reach - 1, 0.001));
    }

    /* A plain follow: a brightness that overshoots is a flash. */
    const k = 1 - Math.pow(1 - 0.08, step * 60);
    this.touch += (wanted - this.touch) * k;

    u.uTouch.value = this.touch * this.calm;
  }

  /** Scroll through the hero stage, 0–1. Called once per frame by the leaf. */
  setProgress(progress: number): void {
    this.progress = clamp01(progress);
  }

  /** View-space z of the head centre — the midpoint of the depth cue. */
  private headViewZ(): number {
    return this.headCenter.clone().applyMatrix4(this.camera.matrixWorldInverse)
      .z;
  }

  /** How much brighter one particle is than on the reference tier. */
  private countFactor(): number {
    return this.config.referenceCount / this.config.particleCount[this.tier];
  }

  /**
   * Brightness per particle has to grow with the **square** of the drawing
   * buffer's height.
   *
   * A sprite is a fixed number of pixels, but the flower's projected area grows
   * with the square of the buffer height (the field of view is vertical). So the
   * same particles spread over that much more area, and the light landing on any
   * one pixel falls by the same factor. A 4K monitor was therefore rendering an
   * image several times darker than a small window — which is why its bloom, a
   * threshold against that image, looked switched off, and why the flower itself
   * read thin. Nothing about the geometry or the bloom was wrong.
   *
   * Scaling brightness rather than sprite size keeps the fill cost flat and
   * leaves the extra resolution doing what it should: a finer-grained flower.
   * ADR-0030.
   */
  private resolutionFactor(): number {
    const height = this.canvasSize().height * this.pixelRatio;
    const ratio = height / this.config.referenceHeight;
    return ratio * ratio;
  }

  private intensity(): number {
    return (
      this.config.glowDensity *
      this.countFactor() *
      this.resolutionFactor() *
      BRIGHTNESS_SCALE
    );
  }

  /**
   * Bloom is identical on every tier and at every viewport size — strength,
   * radius and threshold all come straight from the config. ADR-0028, ADR-0029.
   */
  private bloomFor(): DandelionSceneConfig["bloom"] {
    return this.config.bloom;
  }

  /**
   * The size of the buffer the bloom is computed in: a **fixed height**, at the
   * viewport's aspect ratio.
   *
   * `UnrealBloomPass` blurs with a fixed tap count over a mip chain derived from
   * this size, so its spread is a constant fraction of the buffer *per axis*.
   * Sized to the viewport, that means a 2560-wide monitor smears the same glow
   * over twice the pixels a 1280-wide window does, and the halo dilutes until it
   * looks switched off — which is exactly what was reported. Pinning the height
   * and following the aspect makes the spread track the viewport height in both
   * axes, and the flower is sized by the (vertical) field of view, so halo and
   * subject now scale together on any screen. It is cheaper than full
   * resolution, too.
   */
  private bloomSize(): { width: number; height: number } {
    const { width, height } = this.canvasSize();
    const bloomHeight = this.config.bloomHeight;
    return {
      width: Math.max(2, Math.round(bloomHeight * (width / height))),
      height: bloomHeight,
    };
  }

  /**
   * Allocated once, for the largest tier. The builder shuffles the particle
   * order, so a smaller tier's draw-range prefix thins the whole flower evenly
   * instead of dropping the stem (optimize-3d-scene §7).
   */
  private buildParticles(prebuilt?: DandelionGeometry): BufferGeometry {
    const built =
      prebuilt ?? buildDandelion(dandelionGeometryOptions(this.config));

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(built.position, 3));
    geometry.setAttribute("aShade", new BufferAttribute(built.shade, 1));
    geometry.setAttribute("aSize", new BufferAttribute(built.size, 1));
    geometry.setAttribute("aSeed", new BufferAttribute(built.seed, 1));
    geometry.setAttribute("aType", new BufferAttribute(built.type, 1));
    geometry.setAttribute("aDetail", new BufferAttribute(built.detail, 1));
    geometry.setAttribute("aSpin", new BufferAttribute(built.spin, 1));
    geometry.setAttribute("aTone", new BufferAttribute(built.tone, 1));
    geometry.setDrawRange(0, this.config.particleCount[this.tier]);
    if (built.sphere) {
      geometry.boundingSphere = new Sphere(
        new Vector3(...built.sphere.center),
        built.sphere.radius,
      );
    }

    return geometry;
  }

  /**
   * Everything that could stall a later frame happens here: buffers upload, the
   * programs link, the composer's targets allocate, and a frame is rendered at
   * each end of the growth so no branch is reached for the first time mid-animation.
   */
  /**
   * Everything that has to happen once before the flight can run, **as a list
   * of steps rather than as one call**.
   *
   * Compiling the programs, uploading sixteen card textures and rendering the
   * composer three times is on the order of a second of solid main thread, and
   * done in one go it is a second in which nothing else on the page can move —
   * measured at 1.1 s, and it is exactly the stall the preloader was supposed
   * to be covering. Handed back a step at a time, the caller can spend one per
   * frame and the screen stays alive through it (optimize-3d-scene §3).
   *
   * The work and its order are unchanged; only who decides when each piece runs.
   */
  prewarmSteps(): (() => void | Promise<void>)[] {
    /* `compileAsync` rather than `compile`: where the driver supports parallel
       shader compilation it does the work off the main thread and resolves when
       it is done, which is the only way this particular second can be given
       back — it is one call into the driver and nothing on our side can break
       it up. Where the extension is missing three falls back to the synchronous
       path and this is simply the old behaviour. */
    const steps: (() => void | Promise<void>)[] = [
      async () => {
        await this.renderer.compileAsync(this.scene, this.camera);
      },
    ];

    /**
     * **A warming draw is never the frame that is shown.** These draws go to
     * the same canvas the reader is looking at through the preloader's
     * keyhole, and the loop draws the real plant on the frames between them —
     * so a grown plant, a half-grown one and a sheet of cards each got one
     * frame on screen among the real ones, which is what the keyhole's
     * flicker was. Every warming step therefore ends by drawing the real state
     * again, in the same task: the program is compiled and bound all the same,
     * and the last thing on the canvas when the frame is presented is what is
     * really there.
     */
    const restore = () => {
      this.material.uniforms.uGrowth.value =
        this.growthElapsed / this.config.growthDuration;
      this.composer.render();
    };

    /* The cards are a second scene with a program and sixteen textures of its
       own, and nothing touches it until the scatter — two thirds of the way
       through the flight. Compiled and uploaded here it costs the loader a few
       frames; left alone it costs a stall in the middle of the one moment the
       screen is busiest. */
    if (this.cards) {
      const cards = this.cards;
      steps.push(...cards.prewarmSteps(this.renderer));
      /* `showAll` in the step itself, not left from the upload steps: the loop
         runs between steps and hides the cards again (see `FlyCards.showAll`). */
      steps.push(async () => {
        cards.showAll();
        await this.renderer.compileAsync(this.cardsScene, this.camera);
      });
      steps.push(() => {
        cards.showAll();
        this.renderer.autoClear = false;
        this.renderer.render(this.cardsScene, this.camera);
        this.renderer.autoClear = true;
        cards.hide();
        restore();
      });
    }

    for (const growth of [0, 0.5, 1]) {
      steps.push(() => {
        this.material.uniforms.uGrowth.value = growth;
        this.composer.render();
        restore();
      });
    }

    return steps;
  }

  /** Advance the scene by `delta` seconds of wall clock. */
  update(delta: number): void {
    const dt = Math.min(MAX_DELTA, Math.max(0, delta));
    this.elapsed += dt * this.config.timeScale;
    // Wall-clock, not scene time: the growth is staging with a length someone
    // chose, not part of the scene's idle motion.
    this.growthElapsed = Math.min(
      this.config.growthDuration,
      this.growthElapsed + dt,
    );

    this.material.uniforms.uTime.value = this.elapsed;
    const growth = this.growthElapsed / this.config.growthDuration;
    this.material.uniforms.uGrowth.value = growth;

    /* **One sway as it comes up, and then still.** A single push, and the
       stem answers it as a damped spring does: out one way, back past the
       middle by less, a little way out again, and at rest — dead centre.
       Carried as x(s) = bend · ease(s) · e^(−s/settle) · sin(2πs/period):
       the ease-in and the sine both start at zero, so it leaves the upright
       with no velocity at all, and the exponential brings it home without a
       last step. It starts at 60 % of the growth, on the wall clock — with
       the slower onset the first swing peaks about a second later, as the
       keyhole has opened; started much earlier, that swing happened behind
       the preloader and the reader only ever saw the way back.
       The first real scroll takes what is left of it away, over a few frames
       rather than one — a plant that stops dead mid-swing looks switched off.
       Real scroll, not the canvas's "was there a scroll event": the page
       settling its scroll on load fires one, and read that way the sway never
       started. */
    const { wind } = this.config;
    if (growth >= 0.6) this.swayTime += dt;
    const s = this.swayTime;
    /* Smootherstep, not smoothstep, and over most of the first swing rather
       than the start of it: the old 0.45 s smoothstep ran into the sine with
       a kink in its acceleration — measured, a jerk of 360 units/s³ against
       20 now — and that kink was the stutter at the start of the swing. */
    const onset = clamp01(s / Math.max(wind.onset, 0.001));
    /* Past six e-folds it is a tenth of a pixel: call it home, so the shader
       stops bending a plant that is standing straight. */
    const settled = s > 6 * wind.settle;
    const sway = settled
      ? 0
      : wind.bend *
        onset *
        onset *
        onset *
        (onset * (onset * 6 - 15) + 10) *
        Math.exp(-s / Math.max(wind.settle, 0.001)) *
        Math.sin((2 * Math.PI * s) / Math.max(wind.period, 0.001));
    if (this.progress > 0.002) this.windGone = true;
    if (this.windGone) {
      this.windLeft *= Math.pow(1 - 0.12, Math.min(dt, 1 / 30) * 60);
    }
    this.material.uniforms.uWind.value = sway * this.windLeft;

    this.applyCamera();

    this.composer.render();
    this.drawCards();
  }

  /**
   * The cards, over the top. They share the camera, so they keep the scene's
   * perspective, but not its bloom: sixteen sheets of glass through a halo
   * pass pile into one white blot, and the design keeps them crisp.
   */
  private drawCards(): void {
    /* Nothing placed, nothing to draw: the cards are on screen for a fifth of
       the flight and this pass would otherwise run on every frame of it. */
    if (!this.cards || !this.cards.showing) return;
    this.renderer.autoClear = false;
    this.renderer.render(this.cardsScene, this.camera);
    this.renderer.autoClear = true;
  }

  /** Jump straight to the settled form — the reduced-motion / frozen path. */
  settle(): void {
    this.growthElapsed = this.config.growthDuration;
    this.windGone = true;
    this.windLeft = 0;
    this.material.uniforms.uWind.value = 0;
    this.material.uniforms.uGrowth.value = 1;
    this.applyCamera();
    this.composer.render();
    this.drawCards();
  }

  /**
   * Re-apply everything the tier owns without compiling anything: no define, no
   * light count, no `transparent` flag is touched, so the program count stays
   * flat across a tier switch.
   */
  private retune(): void {
    this.pixelRatio = clampPixelRatio(this.tier);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.composer.setPixelRatio(this.pixelRatio);

    this.material.uniforms.uPixelRatio.value = this.pixelRatio;
    this.material.uniforms.uIntensity.value = this.intensity();
    this.geometry.setDrawRange(0, this.config.particleCount[this.tier]);

    const bloom = this.bloomFor();
    this.bloomPass.strength = bloom.strength;
    this.bloomPass.radius = bloom.radius;
    this.bloomPass.threshold = bloom.threshold;
    this.bloomPass.enabled = bloom.strength > 0.001;
  }

  /**
   * Called from a rAF-coalesced resize. The caller filters out iOS URL-bar
   * height-only changes; a width change or a pointer-query flip re-reads the
   * tier and retunes.
   */
  resize(): void {
    const { width, height } = this.canvasSize();
    const nextTier = readTier();

    if (nextTier !== this.tier) {
      this.tier = nextTier;
      this.retune();
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.baseDistance = this.framingDistance();
    // The buffer height just changed, so the brightness scale did too.
    this.material.uniforms.uIntensity.value = this.intensity();
    this.applyCamera();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    // `composer.setSize` resizes every pass, so the bloom's fixed buffer has to
    // be put back afterwards.
    const bloomSize = this.bloomSize();
    this.bloomPass.setSize(bloomSize.width, bloomSize.height);
  }

  dispose(): void {
    this.cards?.dispose();
    this.cardsScene.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.bloomPass.dispose();
    this.composer.dispose();
    this.renderTarget.dispose();
    this.renderer.dispose();
  }
}
