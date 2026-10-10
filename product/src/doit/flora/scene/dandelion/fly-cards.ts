/**
 * The cards that leave with the petals — Figma "РАЗЛЁТ 25/50/75/100 %"
 * (4369:743, 4369:840, 4369:937, 4354:6698).
 *
 * They are **in** the scene: each card is a plane in the same space as the
 * flower, seen by the same camera, so it takes the perspective of wherever it
 * is. A DOM layer over the canvas could only ever slide in the page's own flat
 * plane. They are drawn in a pass of their own, over the composed image — a
 * card is a printed surface and the design keeps it crisp, where the bloom
 * would pile sixteen sheets of glass into one white blot.
 *
 * Nothing about the motion is invented. The design draws the scatter four
 * times, and each card carries what it is at each of those frames: where its
 * box sits, how big it is against its own final size, how far it is turned,
 * how far out of focus, and how much ink it is given. The size says how far
 * away the card must be for the camera to draw it that big, and the box says
 * where on that plane it sits — so a drawn frame becomes a place in space, and
 * the card is flown between those places. Out of focus is a real blur, taken
 * around the sample — a mip bias is cheaper, but a mip is a shrunken copy, and
 * blown back up to the size of a card near the camera it shows its own pixels.
 *
 * Each card is drawn once into a canvas at `TEXTURE_SCALE`, in the setting the
 * last frame gives it, and uploaded; nothing is allocated after that
 * (optimize-3d-scene §3). Fonts arriving late are the one exception.
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from "three";

/** What the design makes of a card at one of its four frames. */
export interface FlyCardKey {
  /** The middle of its box, in the frame's own px. */
  x: number;
  y: number;
  /** The card's own size at that frame, in the frame's px. */
  w: number;
  h: number;
  /** Degrees it is turned in the frame. */
  turn: number;
  /** How far out of focus, in the frame's px. */
  blur: number;
  /** How much ink it is given, 0–1. */
  ink: number;
}

/** A card's own setting, at the frame it is drawn at. */
export interface FlyCardType {
  value: number;
  label: number;
  padX: number;
  padTop: number;
  padBottom: number;
  gap: number;
}

export interface FlyCardSpec {
  /** The reading, large. */
  value: string;
  /** What it is a reading of, small. */
  label: string;
  /** Whether the lime bar runs down its leading edge. */
  accent: boolean;
  type: FlyCardType;
  /** The design's four frames, at 25, 50, 75 and 100 % of the scatter. */
  keys: [FlyCardKey, FlyCardKey, FlyCardKey, FlyCardKey];
}

export interface FlyCardsLook {
  /** Resolved family name — the page's display face, as the browser named it. */
  font: string;
  surface: string;
  border: string;
  value: string;
  label: string;
  accent: string;
}

export interface FlyCardsConfig {
  /** The frame the boxes were measured in. */
  frame: { width: number; height: number };
  specs: FlyCardSpec[];
}

/** The camera, as everything here needs it. */
export interface FlyCardsView {
  position: Vector3;
  right: Vector3;
  up: Vector3;
  forward: Vector3;
  facing: Quaternion;
  tanHalfFov: number;
  aspect: number;
}

/** Where the design's frames sit on the scatter. */
const KEY_AT = [0.25, 0.5, 0.75, 1] as const;

/** Shared by every card. */
const CARD = {
  valueTracking: 0.2,
  labelTracking: 1.3,
  /** Chakra Petch's own line box, which the design sets the type solid in. */
  leading: 1.31,
  radius: 4,
  border: 1,
  accentWidth: 3,
} as const;

/** Drawn this many times over, so a card close to the camera stays crisp. */
const TEXTURE_SCALE = 4;

/** How big a card is when it leaves the middle, against its first drawn box. */
const BORN = 0.25;

/**
 * **Further out of focus than the design draws it**, by this much: at the
 * drawn radii the cards read as printed things flying past rather than as
 * things too near and too quick to hold in focus.
 */
const BLUR_GAIN = 2.2;
/** …and they keep going soft as they leave, to this many times more by the end. */
const BLUR_LEAVING = 2.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Uniform Catmull-Rom between `b` and `c`, into `out`. */
const catmullRom = (
  a: Vector3,
  b: Vector3,
  c: Vector3,
  d: Vector3,
  t: number,
  out: Vector3,
): Vector3 => {
  const t2 = t * t;
  const t3 = t2 * t;
  const ka = -0.5 * t3 + t2 - 0.5 * t;
  const kb = 1.5 * t3 - 2.5 * t2 + 1;
  const kc = -1.5 * t3 + 2 * t2 + 0.5 * t;
  const kd = 0.5 * t3 - 0.5 * t2;
  return out.set(
    a.x * ka + b.x * kb + c.x * kc + d.x * kd,
    a.y * ka + b.y * kb + c.y * kc + d.y * kd,
    a.z * ka + b.z * kb + c.z * kc + d.z * kd,
  );
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

const CARD_SHADER = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /**
   * **Three rings of twelve and the middle, each ring turned against the one
   * inside it, over a mip chosen for the radius.** Thirteen taps was enough
   * while the blur was small; opened up, the rings showed as ghost copies of
   * the card around it. More rings fill the disc, the stagger keeps any two
   * rings from lining up into spokes, and reading the rings off a mip already
   * shrunk to about the gap between taps (uBias) smooths what is left.
   * Colour is carried premultiplied through the sum, or the transparent texels
   * around the card's corners would drag a dark fringe into it.
   */
  fragment: /* glsl */ `
    uniform sampler2D uMap;
    uniform float uInk;
    uniform vec2 uBlur;
    uniform float uBias;
    varying vec2 vUv;

    void tap(inout vec4 sum, vec2 uv, float weight) {
      vec4 texel = texture2D(uMap, uv, uBias);
      sum.rgb += texel.rgb * texel.a * weight;
      sum.a += texel.a * weight;
    }

    void main() {
      vec4 sum = vec4(0.0);
      float count = 1.0;
      tap(sum, vUv, 1.0);

      if (uBlur.x > 0.0) {
        for (int ring = 1; ring <= 3; ring++) {
          float r = float(ring) / 3.0;
          float twist = float(ring) * 0.2618;
          // Outer rings cover more of the disc, so they count for less each:
          // a flat average over rings pulls the light outward.
          float weight = 1.0 - r * 0.45;
          for (int i = 0; i < 12; i++) {
            float angle = float(i) * 0.5236 + twist;
            tap(sum, vUv + vec2(cos(angle), sin(angle)) * r * uBlur, weight);
            count += weight;
          }
        }
      }

      vec3 colour = sum.a > 0.0 ? sum.rgb / sum.a : vec3(0.0);
      gl_FragColor = vec4(colour, (sum.a / count) * uInk);
    }
  `,
};

/** Letter-spaced text, which canvas has no property for. */
const trackedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void => {
  let cursor = x;
  for (const glyph of text) {
    ctx.fillText(glyph, cursor, y);
    cursor += ctx.measureText(glyph).width + tracking;
  }
};

const trackedWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number =>
  [...text].reduce(
    (total, glyph) => total + ctx.measureText(glyph).width + tracking,
    -tracking,
  );

interface Card {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  spec: FlyCardSpec;
  /** The card's own px, as it was drawn. */
  width: number;
  height: number;
}

export class FlyCards {
  readonly object = new Group();
  private readonly cards: Card[] = [];
  private readonly look: FlyCardsLook;
  private readonly frame: { width: number; height: number };
  private readonly spin = new Quaternion();
  private readonly axis = new Vector3();
  private readonly turn = new Quaternion();
  private readonly here = new Vector3();
  /** Where it is born, the four drawn places, and a phantom at either end. */
  private readonly stops = [0, 1, 2, 3, 4, 5, 6].map(() => new Vector3());
  /** Whether any card is on screen — the scene skips its pass when none is. */
  private shown = false;
  /** Kept from the prewarm, so a redraw can be uploaded rather than deferred. */
  private renderer: WebGLRenderer | null = null;

  constructor(config: FlyCardsConfig, look: FlyCardsLook) {
    this.look = look;
    this.frame = config.frame;
    this.object.frustumCulled = false;

    for (const spec of config.specs) {
      const canvas = document.createElement("canvas");
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.generateMipmaps = true;

      const card: Card = {
        canvas,
        texture,
        spec,
        width: 1,
        height: 1,
        mesh: new Mesh(
          new PlaneGeometry(1, 1),
          new ShaderMaterial({
            uniforms: {
              uMap: { value: texture },
              uInk: { value: 0 },
              uBlur: { value: new Vector2() },
              uBias: { value: 0 },
            },
            vertexShader: CARD_SHADER.vertex,
            fragmentShader: CARD_SHADER.fragment,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
          }),
        ),
      };
      card.mesh.visible = false;
      card.mesh.frustumCulled = false;
      this.draw(card);
      this.cards.push(card);
      this.object.add(card.mesh);
    }

    // A card set in a fallback face is the wrong width, and its texture is the
    // only thing that says how wide it is. The redraw is pushed to the GPU on
    // the spot: left to the first frame that shows a card, sixteen texture
    // uploads would land in the middle of the scatter (optimize-3d-scene §3.3).
    void document.fonts?.ready.then(() => {
      for (const card of this.cards) {
        this.draw(card);
        this.renderer?.initTexture(card.texture);
      }
    });
  }

  /** Paint one card into its own canvas and build its plane at its own shape. */
  private draw(card: Card): void {
    const probe = card.canvas.getContext("2d");
    if (!probe) return;
    const type = card.spec.type;

    probe.font = `500 ${type.value}px ${this.look.font}`;
    const valueWidth = trackedWidth(
      probe,
      card.spec.value.toUpperCase(),
      CARD.valueTracking,
    );
    probe.font = `400 ${type.label}px ${this.look.font}`;
    const labelWidth = trackedWidth(
      probe,
      card.spec.label.toUpperCase(),
      CARD.labelTracking,
    );

    const valueLine = type.value * CARD.leading;
    const labelLine = type.label * CARD.leading;
    const width = Math.ceil(type.padX * 2 + Math.max(valueWidth, labelWidth));
    const height =
      type.padTop + valueLine + type.gap + labelLine + type.padBottom;

    card.canvas.width = Math.round(width * TEXTURE_SCALE);
    card.canvas.height = Math.round(height * TEXTURE_SCALE);
    card.width = width;
    card.height = height;

    const ctx = card.canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE);
    ctx.clearRect(0, 0, width, height);

    const inset = CARD.border / 2;
    ctx.beginPath();
    ctx.roundRect(
      inset,
      inset,
      width - CARD.border,
      height - CARD.border,
      CARD.radius,
    );
    ctx.fillStyle = this.look.surface;
    ctx.fill();
    ctx.lineWidth = CARD.border;
    ctx.strokeStyle = this.look.border;
    ctx.stroke();

    if (card.spec.accent) {
      ctx.fillStyle = this.look.accent;
      ctx.fillRect(0, 0, CARD.accentWidth, height);
    }

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.look.value;
    ctx.font = `500 ${type.value}px ${this.look.font}`;
    trackedText(
      ctx,
      card.spec.value.toUpperCase(),
      type.padX,
      type.padTop + type.value,
      CARD.valueTracking,
    );

    ctx.fillStyle = this.look.label;
    ctx.font = `400 ${type.label}px ${this.look.font}`;
    trackedText(
      ctx,
      card.spec.label.toUpperCase(),
      type.padX,
      type.padTop + valueLine + type.gap + type.label,
      CARD.labelTracking,
    );

    // One world unit tall, at the card's own proportions. Distance does the
    // rest, which is the whole point of putting it in the scene.
    card.mesh.geometry.dispose();
    card.mesh.geometry = new PlaneGeometry(width / height, 1);
    card.texture.needsUpdate = true;
  }

  /**
   * Put a card where the camera would have to hold it for the design's box to
   * come out: far enough away to be drawn that size, and off the axis by as
   * much as the box sits off the middle of the frame.
   */
  private place(
    card: Card,
    x: number,
    y: number,
    height: number,
    view: FlyCardsView,
    into: Vector3,
  ): void {
    const drawn = Math.max(height, 1);
    // The camera draws 2·tan(fov/2) of world at distance 1, so this is the
    // distance at which a one-unit card covers `drawn` of the frame's height.
    const distance = this.frame.height / drawn / (2 * view.tanHalfFov);
    const ndcX = (x / this.frame.width) * 2 - 1;
    const ndcY = 1 - (y / this.frame.height) * 2;

    into
      .copy(view.position)
      .addScaledVector(view.forward, distance)
      .addScaledVector(
        view.right,
        ndcX * view.tanHalfFov * view.aspect * distance,
      )
      .addScaledVector(view.up, ndcY * view.tanHalfFov * distance);
  }

  /**
   * Place every card for this frame. `scatter` is the petals' own ramp, and
   * `spent` is how far past the end of it the stage has gone — the last drawn
   * frame is the end of the scatter, and the cards leave over the breath after
   * it rather than hanging in the air.
   */
  update(
    scatter: number,
    spent: number,
    view: FlyCardsView,
    /** How many of the scatter's legs the breath after it lasts. */
    breathLegs = 1,
  ): void {
    this.shown = scatter > 0 && spent < 1;
    for (const card of this.cards) {
      if (scatter <= 0 || spent >= 1) {
        card.mesh.visible = false;
        continue;
      }
      card.mesh.visible = true;

      const keys = card.spec.keys;
      const opening = scatter < KEY_AT[0];
      /* Past the last drawn frame the card **keeps going**: the breath after
         the scatter is more legs of the same flight, at the speed and turn of
         the last one, while it fades. It does not arrive at its last box and
         wait there to be switched off. */
      const leaving = spent > 0;
      let leg = 0;
      while (leg < KEY_AT.length - 2 && scatter > KEY_AT[leg + 1]) leg += 1;

      const from = opening ? keys[0] : keys[leg];
      const to = opening ? keys[0] : keys[leg + 1];
      const span = opening
        ? KEY_AT[0]
        : Math.max(KEY_AT[leg + 1] - KEY_AT[leg], 0.0001);
      const t = opening
        ? clamp01(scatter / span)
        : clamp01((scatter - KEY_AT[leg]) / span);
      const beyond = spent * breathLegs;

      const last = keys[3];
      const before = keys[2];
      const w = opening ? from.w : leaving ? last.w : mix(from.w, to.w, t);
      const h = opening ? from.h : leaving ? last.h : mix(from.h, to.h, t);
      const turn = opening
        ? from.turn
        : leaving
          ? last.turn + (last.turn - before.turn) * beyond
          : mix(from.turn, to.turn, t);
      const drawnBlur = opening
        ? from.blur
        : leaving
          ? last.blur
          : mix(from.blur, to.blur, t);
      const blur =
        drawnBlur * BLUR_GAIN * (1 + (BLUR_LEAVING - 1) * clamp01(spent));
      const ink = opening
        ? from.ink
        : leaving
          ? last.ink
          : mix(from.ink, to.ink, t);

      // The plane is one unit tall and the distance is what draws it at `h`;
      // its width is then stretched to whatever proportions the design gives
      // the card at this frame, which are its own and not a scaling of the
      // frame before it.
      const stretch = w / h / (card.width / card.height);

      /* **One curve for the whole flight, not a line from each place to the
         next.** Straight legs change speed and heading at every drawn frame,
         and the card visibly kinks there — worst where it leaves the middle
         of the flower for its first box, measured as a turn from climbing to
         sliding in one step. Catmull-Rom through where it is born (the middle
         of the frame, at a quarter of its first size — which is further away)
         and the four drawn places, with a phantom either end, passes through
         every one of them exactly and has no corner at any. The phantom after
         the last is also the course it leaves on, so the flight and the
         leaving are one. */
      const s = this.stops;
      this.place(
        card,
        this.frame.width / 2,
        this.frame.height / 2,
        keys[0].h * BORN,
        view,
        s[1],
      );
      for (let k = 0; k < 4; k += 1) {
        this.place(card, keys[k].x, keys[k].y, keys[k].h, view, s[k + 2]);
      }
      s[0].copy(s[1]).multiplyScalar(2).sub(s[2]);
      s[6].copy(s[5]).multiplyScalar(2).sub(s[4]);
      if (leaving) {
        /* On along the course the curve arrives on (its tangent at the last
           frame is the last leg) at the same speed, for as long as the breath
           lasts. */
        card.mesh.position
          .copy(s[5])
          .addScaledVector(this.here.copy(s[5]).sub(s[4]), beyond);
      } else {
        const at = opening ? 0 : leg + 1;
        catmullRom(
          s[at],
          s[at + 1],
          s[at + 2],
          s[at + 3],
          t,
          card.mesh.position,
        );
      }
      card.mesh.scale.set(stretch, 1, 1);

      // Square to the camera and turned by as much as the design turns it.
      // Screen y runs down and the scene's does not, so the sign flips.
      this.axis.set(0, 0, 1).applyQuaternion(view.facing);
      this.spin.setFromAxisAngle(this.axis, (-turn * Math.PI) / 180);
      this.turn.copy(view.facing).premultiply(this.spin);
      card.mesh.quaternion.copy(this.turn);

      const uniforms = card.mesh.material.uniforms;
      // Ink comes up over the whole of the first leg. Anything shorter and a
      // card announces itself rather than arriving.
      /* Eased out, so it is still plainly there while it moves off and thins
         only toward the end of the breath. */
      const fading = clamp01(spent);
      uniforms.uInk.value = ink * (opening ? t : 1) * (1 - fading * fading);
      // The blur the design gives the card, as a share of the card — so it
      // holds whatever the card's size on screen turns out to be.
      const radius = uniforms.uBlur.value as Vector2;
      radius.set(blur / Math.max(w, 1), blur / Math.max(h, 1));
      /* The mip to read the taps off: about the gap between neighbouring taps
         on the outer ring, in texels of this card's own texture. */
      const texels =
        (radius.y * (card.texture.image as HTMLCanvasElement).height) / 4;
      uniforms.uBias.value = Math.max(
        0,
        Math.min(5, Math.log2(Math.max(texels, 1))),
      );
    }
  }

  /** True while any card is placed — see `DandelionScene.drawCards`. */
  get showing(): boolean {
    return this.shown;
  }

  /**
   * Make every card real, and upload every texture, while the loader still owns
   * the screen. The caller compiles and draws one frame off the back of this
   * and then calls `hide`: the card material is a program of its own, and a
   * program that links the first time a card appears is a stall in the middle
   * of the scatter (optimize-3d-scene §3.1).
   */
  /**
   * One step per card, rather than one for all sixteen. Uploading a texture is
   * a synchronous stall in the driver, and sixteen of them in a row is a frame
   * nothing else can happen in — see `DandelionScene.prewarmSteps`.
   */
  prewarmSteps(renderer: WebGLRenderer): (() => void)[] {
    this.renderer = renderer;
    return this.cards.map((card) => () => {
      card.mesh.visible = true;
      renderer.initTexture(card.texture);
    });
  }

  /**
   * Every card on, for a warming compile or draw. Called **in the same task**
   * as that compile or draw: the scene's loop runs between prewarm steps, and
   * its `update` puts every card away while the scatter is still ahead — so
   * cards made visible one step earlier were hidden again by the time the
   * compile walked the scene (three compiles visible objects only), the card
   * program was never built, and it linked on the first frame of the scatter:
   * a 40–60 ms frame mid-scroll on desktop.
   */
  showAll(): void {
    for (const card of this.cards) card.mesh.visible = true;
  }

  /** Put them away again — the flight starts before the scatter does. */
  hide(): void {
    this.shown = false;
    for (const card of this.cards) card.mesh.visible = false;
  }

  dispose(): void {
    for (const card of this.cards) {
      card.mesh.geometry.dispose();
      card.mesh.material.dispose();
      card.texture.dispose();
    }
    this.cards.length = 0;
    this.object.clear();
    this.renderer = null;
  }
}
