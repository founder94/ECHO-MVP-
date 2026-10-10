/**
 * Builds the dandelion clock as a particle cloud, on the CPU, once.
 *
 * The form is static — there is no path to walk, so every particle's rest
 * position is baked here and the vertex shader only adds sway, the reveal and
 * the dust drift. Ten parts share one buffer:
 *
 *   hairs      the pappus — one plumose parachute per seed, barbs and all
 *   stalks     the rays from the receptacle out to each parachute
 *   bodies     the seed grains: the warm speckles inside the ball
 *   core       the dense brown receptacle every ray converges on
 *   pattern    the lattice inside the head — what the camera flies through
 *   glow       the core burning at its centre — what the camera flies at
 *   bloom      the blue flower that opens once the core has gone
 *   stem       a shaded tube, micro-spined, running out of frame
 *   dust       airborne motes, drifting across frame in the shader
 *
 * > The dust and the core are written first, at fixed counts, so a smaller tier's
 * > draw-range prefix always contains all of them. **Everything after them is
 * > shuffled**: an unshuffled buffer would hand a phone every hair and no stem at
 * > all. Only things you could count in the frame get a fixed size — masses take
 * > a share, or they eat the whole budget. ADR-0028, optimize-3d-scene §7.
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

/** Changing this grows a different, but equally plausible, dandelion. */
export const DANDELION_SEED = 0x5ed9c104;

/** Particle kinds, as read by the shader's palette. */
export const PART = {
  hair: 0,
  stem: 1,
  body: 2,
  core: 3,
  pattern: 4,
  dust: 5,
  glow: 6,
  bloom: 7,
  iris: 8,
  pollen: 9,
} as const;

export interface DandelionGeometryOptions {
  /** Buffer size — the largest tier's particle count. */
  total: number;
  /** Seeds in the head; each carries one stalk and one parachute. */
  seedCount: number;
  /** Bristles per parachute. */
  hairsPerSeed: number;
  headRadius: number;
  headCenter: readonly [number, number, number];
  /** Where the stem runs to; it starts at the head centre. */
  stemBottom: readonly [number, number, number];
  stemRadius: number;
  /** How far the stem bows out of the straight line between its ends. */
  stemBow: number;
  /** Half-width of the box the airborne motes drift through. */
  dustSpan: number;
  /** Particles of airborne dust — an absolute count, not a share. */
  dustParticles: number;
  /** Particles in the burning core — an absolute count, not a share. */
  glowParticles: number;
  /** Motes adrift around the head. Countable, so an absolute count too. */
  pollenParticles: number;
  /** Radius of the core's bright centre, as a fraction of the head radius. */
  glowRadius: number;
  /** The flower that opens at the end. */
  bloomShare: number;
  bloomPetals: number;
  /** Its stem: length below the head, and half-thickness — flower units. */
  bloomStemLength: number;
  bloomStemRadius: number;
  /** Petal length and half-width, in world units, before `uBloomScale`. */
  bloomLength: number;
  bloomWidth: number;
  /** How the spiral changes from the outermost petal to the innermost: the
   *  petal's scale, where it attaches on the receptacle, and how far its spine
   *  bends up. `bloomAttach*` is mirrored in the vertex shader, which hinges
   *  each petal about its own attachment. */
  bloomInnerScale: number;
  bloomAttachOuter: number;
  bloomAttachInner: number;
  bloomBendOuter: number;
  bloomBendInner: number;
  /** One roll for every petal — alternating it turns each petal's margin into
   *  its neighbour's, and the two edges cross. */
  bloomRoll: number;
  /** The iris that gathers out of the dark at the very end. Radii are in its
   *  own units, where the fibres reach 1. */
  irisShare: number;
  irisPupil: number;
  irisRim: number;
  /** Share of the tier's budget the inner lattice takes. */
  patternShare: number;
  /** Radius of the inner lattice, as a fraction of the head radius. */
  patternRadius: number;
}

export interface DandelionGeometry {
  position: Float32Array;
  /** Baked brightness: light, self-shadowing, and the fade along each bristle. */
  shade: Float32Array;
  /** Point-size multiplier — barbs are finer than the stem. */
  size: Float32Array;
  /** Per-particle randomness: reveal delay, shimmer, dust drift. */
  seed: Float32Array;
  /** Which part this particle belongs to (see `PART`). */
  type: Float32Array;
  /**
   * How close the camera has to be before this particle is drawn, 0–1 along the
   * approach. 0 is always visible; the lattice's finer layers carry higher
   * values so the interior keeps resolving as the camera flies in.
   */
  detail: Float32Array;
  /**
   * This structure's own animation parameter, **shared by every particle in it**.
   * For the lattice it is a signed rotation rate: give two particles of one ring
   * different rates and the ring smears into a band as it turns. For the bloom it
   * is the petal's phase, so a whole petal hinges open as one piece. 0 elsewhere.
   */
  spin: Float32Array;
  /**
   * Where a particle sits in its part's own colour range, 0–1. Only the bloom
   * uses it, and it is keyed to how the surface is **lit**: 0 in a shaded crease,
   * 1 on a face turned to the light.
   */
  tone: Float32Array;
  /**
   * The cloud's bounding sphere, as three's `computeBoundingSphere` would find
   * it (the box's centre, the farthest point's distance). The renderer asks for
   * it on the first frame to sort the transparent points, and on a phone that
   * walk over the whole buffer was a 50 ms piece of the first frame — so the
   * worker works it out with the buffers. Absent, three computes it as before.
   */
  sphere?: { center: [number, number, number]; radius: number };
}

/**
 * Share of the *remaining* budget each part of the plant receives — what is left
 * once the fixed-size parts are written. Sums to 1.
 */
const SHARE = {
  hairs: 0.696,
  stalks: 0.072,
  bodies: 0.021,
  core: 0.021,
  stem: 0.19,
} as const;

/** Key light, upper-left and slightly toward the camera. */
const LIGHT: readonly [number, number, number] = [-0.46, 0.58, 0.67];

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const TAU = Math.PI * 2;

/** Hermite ease over 0–1, clamped — the petal shape is built out of these. */
const smoothstep01 = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
/** π · (3 − √5) — the step that spreads points evenly over a sphere. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const normalize = (v: number[]): number[] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

const cross = (a: number[], b: number[]): number[] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const dot = (a: number[], b: readonly number[]): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Two unit vectors perpendicular to `d` and to each other. */
const basis = (d: number[]): [number[], number[]] => {
  const helper = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(d, helper));
  return [u, cross(d, u)];
};

/**
 * One parachute: bristles fanning out of `origin` around `axis`, each of them
 * **plumose** — a shaft with barbs feathering off it.
 *
 * The feathering is the whole look. A parachute of bare shafts reads as a
 * starburst; it is the barbs that make the head lacy and let the light catch in
 * it the way the reference does. Roughly a third of the particles draw the
 * shafts, the rest draw barbs hanging off them in a per-bristle plane.
 *
 * Returns how many particles it wrote, so the caller can keep its cursor in step.
 */
const writeParachute = (
  out: DandelionGeometry,
  cursor: number,
  count: number,
  random: () => number,
  origin: number[],
  axis: number[],
  bristles: number,
  bristleLength: number,
  type: number,
): number => {
  const [u, v] = basis(axis);
  const perBristle = Math.max(1, Math.floor(count / bristles));
  let index = cursor;

  for (let h = 0; h < bristles && index < cursor + count; h += 1) {
    const phi = (TAU * h) / bristles + random() * 0.2;
    // A shallow bowl, but a *small* one. In the reference a parachute spans
    // roughly 8° of the head against ~13° of spacing between seeds, so the
    // florets read individually with dark gaps between them. Open the cone or
    // lengthen the bristles much past that and the whole head turns to fog.
    const theta = 0.55 + random() * 0.26;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const dir = normalize([
      axis[0] * cosTheta +
        (u[0] * Math.cos(phi) + v[0] * Math.sin(phi)) * sinTheta,
      axis[1] * cosTheta +
        (u[1] * Math.cos(phi) + v[1] * Math.sin(phi)) * sinTheta,
      axis[2] * cosTheta +
        (u[2] * Math.cos(phi) + v[2] * Math.sin(phi)) * sinTheta,
    ]);

    // A few bristles run long — a perfectly even silhouette reads as CG.
    const stray = random() < 0.08 ? 1.3 + random() * 0.3 : 1;
    const length = bristleLength * (0.78 + random() * 0.38) * stray;
    const facing = 0.76 + 0.24 * Math.max(0, dot(dir, LIGHT));

    // The plane the barbs feather in, and the bristle's own slight curve.
    const [bu, bv] = basis(dir);
    const psi = random() * TAU;
    const plane = [
      bu[0] * Math.cos(psi) + bv[0] * Math.sin(psi),
      bu[1] * Math.cos(psi) + bv[1] * Math.sin(psi),
      bu[2] * Math.cos(psi) + bv[2] * Math.sin(psi),
    ];
    const curl = 0.12 + random() * 0.14;

    for (
      let p = 0;
      p < perBristle && index < cursor + count;
      p += 1, index += 1
    ) {
      const shaft = random() < 0.45;
      const s = shaft ? Math.pow(random(), 0.85) : 0.16 + random() * 0.84;

      // Point on the shaft, bending gently away from the parachute's axis.
      const bend = curl * s * s;
      let x = origin[0] + dir[0] * length * s + axis[0] * length * bend;
      let y = origin[1] + dir[1] * length * s + axis[1] * length * bend;
      let z = origin[2] + dir[2] * length * s + axis[2] * length * bend;
      let shade = facing * (0.5 + 0.85 * s);
      let size = 0.8 + random() * 0.4;

      if (!shaft) {
        // A barb: out of the shaft at a steep angle, in the feather plane,
        // leaning toward the tip. Longest mid-bristle, shortest at the end.
        const side = random() < 0.5 ? 1 : -1;
        const tilt = 0.95 + random() * 0.3;
        const barb = Math.pow(random(), 0.8);
        const barbLength =
          length * 0.17 * (1 - 0.4 * s) * (0.6 + random() * 0.7);
        const barbDir = normalize([
          dir[0] * Math.cos(tilt) + plane[0] * side * Math.sin(tilt),
          dir[1] * Math.cos(tilt) + plane[1] * side * Math.sin(tilt),
          dir[2] * Math.cos(tilt) + plane[2] * side * Math.sin(tilt),
        ]);
        x += barbDir[0] * barbLength * barb;
        y += barbDir[1] * barbLength * barb;
        z += barbDir[2] * barbLength * barb;
        // Barbs are finer and dimmer than the shaft they hang off.
        shade *= 0.55 + 0.3 * (1 - barb);
        size *= 0.82;
      }

      const fray = 0.008 * s;
      out.position[index * 3] = x + (random() - 0.5) * fray;
      out.position[index * 3 + 1] = y + (random() - 0.5) * fray;
      out.position[index * 3 + 2] = z + (random() - 0.5) * fray;
      out.shade[index] = shade;
      out.size[index] = size;
      out.seed[index] = random();
      out.type[index] = type;
    }
  }

  return index - cursor;
};

export const buildDandelion = (
  options: DandelionGeometryOptions,
): DandelionGeometry => {
  const {
    total,
    seedCount,
    hairsPerSeed,
    headRadius,
    headCenter,
    stemBottom,
    stemRadius,
    stemBow,
    dustSpan,
    dustParticles,
    patternShare,
    patternRadius,
    glowParticles,
    pollenParticles,
    glowRadius,
    bloomShare,
    bloomPetals,
    bloomStemLength,
    bloomStemRadius,
    bloomLength,
    bloomWidth,
    bloomInnerScale,
    bloomAttachOuter,
    bloomAttachInner,
    bloomBendOuter,
    bloomBendInner,
    bloomRoll,
    irisShare,
    irisPupil,
    irisRim,
  } = options;

  const random = mulberry32(DANDELION_SEED);
  const out: DandelionGeometry = {
    position: new Float32Array(total * 3),
    shade: new Float32Array(total),
    size: new Float32Array(total),
    seed: new Float32Array(total),
    type: new Float32Array(total),
    detail: new Float32Array(total),
    spin: new Float32Array(total),
    tone: new Float32Array(total),
  };

  // Only the dust and the core are fixed-size. The lattice and the flower are
  // **masses**, not countable objects, so they take a share of the tier's budget
  // like the plant does — pinning them meant a phone spent its whole draw range
  // on them and rendered a dandelion you could see through. Fixed size is for
  // things you could count in the frame; everything else scales. ADR-0028.
  const remainder = Math.max(
    0,
    total - dustParticles - glowParticles - pollenParticles,
  );
  const patternParticles = Math.floor(remainder * patternShare);
  const bloomParticles = Math.floor(remainder * bloomShare);
  const irisParticles = Math.floor(remainder * irisShare);
  const plant = Math.max(
    0,
    remainder - patternParticles - bloomParticles - irisParticles,
  );
  const budget = {
    hairs: Math.floor(plant * SHARE.hairs),
    stalks: Math.floor(plant * SHARE.stalks),
    bodies: Math.floor(plant * SHARE.bodies),
    core: Math.floor(plant * SHARE.core),
    stem: Math.floor(plant * SHARE.stem),
  };

  let i = 0;

  // The dust is **fixed-size and written first**; every other part is a share of
  // what is left. A smaller tier draws a prefix of the buffer, so anything at the
  // front survives every tier at full count — which is what the motes need: they
  // are sparse, individually countable objects, and thinning them makes a phone
  // show a different composition rather than a softer one. The plant behind them
  // thins evenly instead. ADR-0028.

  // ── Airborne motes ───────────────────────────────────────────────────────
  // Spread deep in z on purpose: most of them fall outside the depth of field,
  // so they render as soft bokeh and give the frame air around the flower.
  for (let p = 0; p < dustParticles; p += 1, i += 1) {
    out.position[i * 3] = (random() * 2 - 1) * dustSpan;
    out.position[i * 3 + 1] = -2 + random() * 5;
    out.position[i * 3 + 2] = (random() * 2 - 1) * 2.6;
    out.shade[i] = 0.1 + Math.pow(random(), 2.4) * 0.42;
    out.size[i] = 0.9 + random() * 1.1;
    out.seed[i] = random();
    out.type[i] = PART.dust;
  }

  // ── The core ─────────────────────────────────────────────────────────────
  // What the camera is flying at. A tight, very bright ball with a soft halo
  // around it: additive blending turns the ball into a glowing point, and the
  // halo is what stops it looking like a dot pasted on top.
  {
    const heart = Math.floor(glowParticles * 0.55);
    const radius = headRadius * glowRadius;

    for (let n = 0; n < glowParticles && i < total; n += 1, i += 1) {
      const core = n < heart;
      const u = random() * 2 - 1;
      const theta = random() * TAU;
      // The heart is packed hard toward its middle; the halo falls away.
      const r = core
        ? radius * Math.pow(random(), 1.8)
        : radius * (1 + Math.pow(random(), 0.6) * 3.4);
      const sn = Math.sqrt(Math.max(0, 1 - u * u));

      out.position[i * 3] = headCenter[0] + Math.cos(theta) * sn * r;
      out.position[i * 3 + 1] = headCenter[1] + u * r;
      out.position[i * 3 + 2] = headCenter[2] + Math.sin(theta) * sn * r;
      out.shade[i] = core
        ? 0.4 + random() * 0.35
        : 0.05 + Math.pow(random(), 2) * 0.16;
      out.size[i] = core ? 1 + random() * 0.5 : 1.6 + random() * 1.5;
      out.seed[i] = random();
      out.type[i] = PART.glow;
      // Present from the start: it is the thing being flown at.
      out.detail[i] = 0;
      out.spin[i] = 0;
    }
  }

  const fixedEnd = i;

  // ── The head: one stalk + one parachute per seed ──────────────────────────
  const hairsPerSeedBudget = Math.floor(budget.hairs / seedCount);
  const stalkPerSeed = Math.floor(budget.stalks / seedCount);
  const bodyPerSeed = Math.floor(budget.bodies / seedCount);

  for (let s = 0; s < seedCount; s += 1) {
    // Spherical Fibonacci — an even head with no visible spiral.
    const k = (s + 0.5) / seedCount;
    const cosTheta = 1 - 2 * k;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    // The golden *angle* steps per seed. Multiplying the normalised index by
    // the golden ratio instead only wraps ~1.6 turns over the whole head, which
    // lays every seed on one spiral ribbon rather than over the sphere.
    const phi = s * GOLDEN_ANGLE + random() * 0.2;
    const d = normalize([
      sinTheta * Math.cos(phi) + (random() - 0.5) * 0.05,
      cosTheta + (random() - 0.5) * 0.05,
      sinTheta * Math.sin(phi) + (random() - 0.5) * 0.05,
    ]);

    const tipRadius = headRadius * (0.78 + random() * 0.07);
    const tip = [
      headCenter[0] + d[0] * tipRadius,
      headCenter[1] + d[1] * tipRadius,
      headCenter[2] + d[2] * tipRadius,
    ];

    // The rays. Brown where they leave the receptacle, pale further out — this
    // is the radial structure that shows through the fluff in the reference.
    for (let p = 0; p < stalkPerSeed; p += 1, i += 1) {
      const t = 0.1 + random() * 0.9;
      const jitter = 0.004;
      out.position[i * 3] =
        headCenter[0] + d[0] * tipRadius * t + (random() - 0.5) * jitter;
      out.position[i * 3 + 1] =
        headCenter[1] + d[1] * tipRadius * t + (random() - 0.5) * jitter;
      out.position[i * 3 + 2] =
        headCenter[2] + d[2] * tipRadius * t + (random() - 0.5) * jitter;
      out.shade[i] = 0.22 + 0.45 * t;
      out.size[i] = 0.75 + random() * 0.3;
      out.seed[i] = random();
      out.type[i] = t < 0.5 ? PART.body : PART.hair;
    }

    // The seed grains, clustered part-way out.
    const bodyAt = tipRadius * (0.4 + random() * 0.16);
    for (let p = 0; p < bodyPerSeed; p += 1, i += 1) {
      const spread = 0.014;
      out.position[i * 3] =
        headCenter[0] + d[0] * bodyAt + (random() - 0.5) * spread;
      out.position[i * 3 + 1] =
        headCenter[1] + d[1] * bodyAt + (random() - 0.5) * spread;
      out.position[i * 3 + 2] =
        headCenter[2] + d[2] * bodyAt + (random() - 0.5) * spread;
      out.shade[i] = 0.45 + random() * 0.5;
      out.size[i] = 1 + random() * 0.6;
      out.seed[i] = random();
      out.type[i] = PART.body;
    }

    i += writeParachute(
      out,
      i,
      hairsPerSeedBudget,
      random,
      tip,
      d,
      hairsPerSeed,
      headRadius * 0.2,
      PART.hair,
    );
  }

  // ── The receptacle: the dense brown disc every ray converges on ───────────
  // Tilted well off the horizontal, and thick enough to have a body.
  //
  // It used to be a disc flattened along world Y, which put it exactly edge-on
  // to a camera sitting at head height — a razor-thin bright line across the
  // frame, and the radial scatter then pulled that line out sideways instead of
  // breaking it up. Anything flat inside the head has to be tilted.
  const receptacleAxis = normalize([0.34, 1, 0.26]);
  const [receptacleU, receptacleV] = basis(receptacleAxis);
  for (let p = 0; p < budget.core; p += 1, i += 1) {
    const theta = random() * TAU;
    const r = headRadius * 0.14 * Math.sqrt(random());
    const thickness = (random() - 0.5) * headRadius * 0.16;
    out.position[i * 3] =
      headCenter[0] +
      (receptacleU[0] * Math.cos(theta) + receptacleV[0] * Math.sin(theta)) *
        r +
      receptacleAxis[0] * thickness;
    out.position[i * 3 + 1] =
      headCenter[1] +
      (receptacleU[1] * Math.cos(theta) + receptacleV[1] * Math.sin(theta)) *
        r +
      receptacleAxis[1] * thickness;
    out.position[i * 3 + 2] =
      headCenter[2] +
      (receptacleU[2] * Math.cos(theta) + receptacleV[2] * Math.sin(theta)) *
        r +
      receptacleAxis[2] * thickness;
    out.shade[i] = 0.35 + random() * 0.55;
    out.size[i] = 0.9 + random() * 0.5;
    out.seed[i] = random();
    out.type[i] = PART.core;
  }

  // ── The stem: it starts at the head centre, so the flower hangs off it ────
  for (let p = 0; p < budget.stem; p += 1, i += 1) {
    const t = random();
    // The bow. A dead straight stem reads as a CG cylinder; this arcs the whole
    // length one way and lets the tip settle back, so it looks grown.
    const bend =
      Math.sin(t * Math.PI * 0.92) * stemBow -
      Math.sin(t * Math.PI * 2) * stemBow * 0.22;
    const cx = headCenter[0] + (stemBottom[0] - headCenter[0]) * t + bend;
    const cy = headCenter[1] + (stemBottom[1] - headCenter[1]) * t;
    const cz = headCenter[2] + (stemBottom[2] - headCenter[2]) * t;

    const angle = random() * TAU;
    // sqrt keeps the volume evenly filled instead of clumping at the axis.
    const radial = Math.sqrt(random());
    // A tenth of the stem particles are the fine spines along it.
    const spine = random() < 0.1;
    const radius =
      stemRadius * (0.55 + t * 0.75) * (spine ? 1.4 + random() * 1.5 : radial);
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);

    out.position[i * 3] = cx + nx * radius;
    out.position[i * 3 + 1] = cy + (spine ? (random() - 0.5) * 0.01 : 0);
    out.position[i * 3 + 2] = cz + nz * radius;

    // Lambert against the key light, so the tube looks round.
    const lambert = Math.max(0, nx * LIGHT[0] + nz * LIGHT[2]);
    out.shade[i] =
      (0.1 + 0.62 * lambert * (0.5 + 0.5 * radial)) * (spine ? 0.45 : 1);
    out.size[i] = spine ? 0.7 : 1.05 + random() * 0.5;
    out.seed[i] = random();
    out.type[i] = PART.stem;
  }

  // ── The lattice inside the head ──────────────────────────────────────────
  // The camera flies through the centre on scroll, so the receptacle needs
  // something to *be* at close range. It is drawn as an armillary sphere: few
  // structures, each a **thick, continuous, densely drawn band**, with air
  // between them. The rings turn with the scroll, each at its own rate, which is
  // what makes the cage read as an instrument rather than a static prop.
  //
  // Dotting the lines and jittering them — an early version did both — turns the
  // whole thing into a speckle field at close range: busy, and not legibly
  // geometric. Weight belongs in the rings; everything else is support.
  //
  // Every layer carries a `detail` value: the point in the approach where it
  // starts being drawn, so the interior keeps resolving as the camera closes in.
  const latticeRadius = headRadius * patternRadius;
  {
    const ringBudget = Math.floor(patternParticles * 0.56);
    const hoopBudget = Math.floor(patternParticles * 0.32);
    const spokeBudget = Math.floor(patternParticles * 0.06);
    const nodeBudget = Math.floor(patternParticles * 0.04);
    const hazeBudget =
      patternParticles - ringBudget - hoopBudget - spokeBudget - nodeBudget;
    // Thickness comes from the **sprite size**, not from scattering particles
    // across a cross-section. Spreading them fattens the band and thins its
    // density at the same time, which reads as fuzz; overlapping larger sprites
    // strung along one line reads as a solid ribbon. So: a hair of a tube, and
    // big points.
    const tube = 0.004;

    /** Writes one continuous band: a circle swept into a thin tube. */
    // Three fixed families of concentric bands, tilted well off the view axis so
    // none of them can present edge-on as a bar across the frame. Each family
    // turns at its own rate.
    const families = [
      { axis: normalize([0.26, 0.15, 1]), spin: 1 },
      { axis: normalize([1, 0.22, -0.3]), spin: -0.62 },
      { axis: normalize([0.2, 1, 0.34]), spin: 0.34 },
    ];
    const shells = [0.46, 0.95];
    const hoops = 5;
    const spokes = 30;
    const nodes = 30;

    // **When this structure arrives, as a fraction of the lattice's window.**
    // The rings come in one after another rather than all together, and a band
    // is the unit that arrives — so the order is baked per structure, like
    // everything else here that moves as a piece. `aTone` is free on the
    // lattice, so it carries it.
    //
    // The order is **assigned, not the write order**. Counted off as they are
    // written, the six big bands take the first six slots out of seventy-odd and
    // land together at the very start of the window, and the rest of the queue
    // is spokes and haze nobody can see arriving. The structures that carry the
    // shape are spread across the whole of it instead, with the small ones
    // interleaved.
    const spread = (index: number, count: number, from: number, to: number) =>
      count <= 1 ? from : from + ((to - from) * index) / (count - 1);

    const writeBand = (
      count: number,
      radius: number,
      axis: number[],
      brightness: number,
      detail: number,
      spin: number,
      arrival: number,
    ): void => {
      const [u, v] = basis(axis);
      for (let n = 0; n < count && i < total; n += 1, i += 1) {
        const a = (n / count) * TAU;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        // Radial and axial offsets inside the tube — sqrt keeps the section
        // evenly filled rather than clustered on its axis.
        const ta = random() * TAU;
        const tr = tube * Math.sqrt(random());
        const outward = tr * Math.cos(ta);
        const along = tr * Math.sin(ta);
        const rr = radius + outward;

        out.position[i * 3] =
          headCenter[0] + (u[0] * cosA + v[0] * sinA) * rr + axis[0] * along;
        out.position[i * 3 + 1] =
          headCenter[1] + (u[1] * cosA + v[1] * sinA) * rr + axis[1] * along;
        out.position[i * 3 + 2] =
          headCenter[2] + (u[2] * cosA + v[2] * sinA) * rr + axis[2] * along;

        // Brightest along the band's spine, so it has a core and an edge.
        const core = 1 - (tr / tube) * 0.35;
        out.shade[i] =
          brightness * core * (0.9 + 0.1 * Math.sin(a * 3 + detail * 9));
        out.size[i] = 1.35 + random() * 0.35;
        out.seed[i] = random();
        out.type[i] = PART.pattern;
        out.detail[i] = detail;
        out.spin[i] = spin;
        out.tone[i] = arrival;
      }
    };

    const perRing = Math.max(
      1,
      Math.floor(ringBudget / (families.length * shells.length)),
    );
    const bands = families.length * shells.length;
    families.forEach((family, fi) => {
      shells.forEach((shell, index) => {
        writeBand(
          perRing,
          latticeRadius * shell,
          family.axis,
          0.3 + 0.15 * index,
          index === 1 ? 0.04 : 0.2 + index * 0.22,
          // Inner shells turn faster, the way an orrery's inner rings do.
          family.spin * (1.35 - index * 0.22),
          spread(fi * shells.length + index, bands, 0, 0.62),
        );
      });
    });

    // Great circles at golden-angle tilts — what turns concentric rings into a
    // woven cage rather than a set of targets.
    const perHoop = Math.max(1, Math.floor(hoopBudget / hoops));
    for (let h = 0; h < hoops; h += 1) {
      const k = (h + 0.5) / hoops;
      // Kept away from vertical for the same reason as the families.
      const cosTheta = (1 - 2 * k) * 0.78;
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const phi = h * GOLDEN_ANGLE;
      writeBand(
        perHoop,
        latticeRadius * (0.66 + (h % 3) * 0.14),
        normalize([
          sinTheta * Math.cos(phi),
          cosTheta,
          sinTheta * Math.sin(phi),
        ]),
        0.24 + (h % 2) * 0.12,
        h < 3 ? 0.06 : 0.3 + (h % 4) * 0.16,
        (h % 2 === 0 ? 1 : -1) * (0.45 + (h % 3) * 0.3),
        spread(h, hoops, 0.1, 0.78),
      );
    }

    // Spokes: few, thin, and dim — they mark the centre, nothing more.
    const perSpoke = Math.max(1, Math.floor(spokeBudget / spokes));
    for (let sp = 0; sp < spokes; sp += 1) {
      const k = (sp + 0.5) / spokes;
      const cosTheta = 1 - 2 * k;
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const phi = sp * GOLDEN_ANGLE;
      const d = [sinTheta * Math.cos(phi), cosTheta, sinTheta * Math.sin(phi)];
      const length = latticeRadius * (0.75 + random() * 0.3);
      const detail = sp % 3 === 0 ? 0.12 : 0.46 + (sp % 5) * 0.1;
      const arrival = spread(sp, spokes, 0.3, 0.9);

      for (let n = 0; n < perSpoke && i < total; n += 1, i += 1) {
        const t = 0.08 + (n / perSpoke) * 0.92;
        const jitter = 0.0015;
        out.position[i * 3] =
          headCenter[0] + d[0] * length * t + (random() - 0.5) * jitter;
        out.position[i * 3 + 1] =
          headCenter[1] + d[1] * length * t + (random() - 0.5) * jitter;
        out.position[i * 3 + 2] =
          headCenter[2] + d[2] * length * t + (random() - 0.5) * jitter;
        out.shade[i] = 0.4 * (1 - t * 0.6);
        out.size[i] = 0.45 + random() * 0.18;
        out.seed[i] = random();
        out.type[i] = PART.pattern;
        out.detail[i] = detail;
        out.spin[i] = 0.18;
        out.tone[i] = arrival;
      }
    }

    // Nodes riding the outermost band of each family, so they travel with it.
    const perNode = Math.max(1, Math.floor(nodeBudget / nodes));
    for (let n = 0; n < nodes; n += 1) {
      const family = families[n % families.length];
      const [u, v] = basis(family.axis);
      const a = (n / nodes) * TAU;
      const r = latticeRadius * shells[(n + 1) % shells.length];
      const cx = headCenter[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r;
      const cy = headCenter[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r;
      const cz = headCenter[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r;
      const shellIndex = (n + 1) % shells.length;
      const arrival = spread(n, nodes, 0.4, 1);

      for (let q = 0; q < perNode && i < total; q += 1, i += 1) {
        const spread = 0.008;
        out.position[i * 3] = cx + (random() - 0.5) * spread;
        out.position[i * 3 + 1] = cy + (random() - 0.5) * spread;
        out.position[i * 3 + 2] = cz + (random() - 0.5) * spread;
        out.shade[i] = 0.62 + random() * 0.4;
        out.size[i] = 0.8 + random() * 0.4;
        out.seed[i] = random();
        out.type[i] = PART.pattern;
        out.detail[i] = 0.5 + (n % 3) * 0.18;
        out.spin[i] = family.spin * (1.35 - shellIndex * 0.22);
        out.tone[i] = arrival;
      }
    }

    // A whisper of dust in the volume. Deliberately slight: this is the layer
    // that reads as noise the moment there is any quantity of it.
    const hazeArrival = 0.16;
    for (let q = 0; q < hazeBudget && i < total; q += 1, i += 1) {
      const u = random() * 2 - 1;
      const theta = random() * TAU;
      const r = latticeRadius * Math.cbrt(random());
      const sn = Math.sqrt(Math.max(0, 1 - u * u));
      out.position[i * 3] = headCenter[0] + Math.cos(theta) * sn * r;
      out.position[i * 3 + 1] = headCenter[1] + u * r;
      out.position[i * 3 + 2] = headCenter[2] + Math.sin(theta) * sn * r;
      out.shade[i] = 0.05 + Math.pow(random(), 3) * 0.25;
      out.size[i] = 0.4 + random() * 0.25;
      out.seed[i] = random();
      out.type[i] = PART.pattern;
      out.detail[i] = 0.3 + random() * 0.45;
      out.spin[i] = 0.1;
      out.tone[i] = hazeArrival;
    }
  }

  // ── The flower that opens at the end ─────────────────────────────────────
  // Positions here are **local to the flower's own plane**, not world space: the
  // shader pitches that plane back from the vertical and stands it on a stem, so
  // the flower is seen from the side the way the dandelion is (x, y across the
  // face, z out of it). Anything that reads `position` as a world coordinate —
  // sway, growth, the scatter — skips it.
  //
  // **One spiral of petals at the golden angle, not rings of them.** Every petal
  // is the *same shape*. Only four things change along the spiral, and all four
  // change monotonically: the petal gets smaller, its spine bends up more, it
  // sits higher (`lift`, added by the shader) and it attaches nearer the middle.
  //
  // That is what stops petals passing through each other, and nothing else does.
  // Petals have to overlap — a flower whose petals do not touch is a star with
  // gaps — so the only question is whether the overlap is a *stack* or an
  // *intersection*. Two surfaces that differ by a translation along the axis can
  // never intersect, however far they overlap. Give each petal its own random
  // length, width, bend, roll and frill, which is what this did, and
  // neighbouring petals are different shapes in the same place: they cross.
  //
  // The golden angle earns its keep twice over here. Consecutive petals in the
  // spiral are 137.5° apart, so the ones that actually overlap are 3 and 5 steps
  // away — and a small step in lift therefore puts a large gap between exactly
  // the petals that need one.
  //
  // `aDetail` carries the petal's place in the spiral (0 outermost → 1 inner),
  // which is its lift, its opening phase and its identity; `aSeed` carries its
  // attachment radius; `aSpin` carries its **azimuth**, which is the axis the
  // shader has to decompose the petal along to bend it without deforming it.
  {
    const stalkBudget = Math.floor(bloomParticles * 0.12);
    const heartShare = Math.floor(bloomParticles * 0.05);
    const petalBudget = bloomParticles - stalkBudget - heartShare;
    const petalCount = Math.max(6, bloomPetals);

    const place = (n: number): number =>
      petalCount > 1 ? n / (petalCount - 1) : 0;
    const scaleAt = (u: number): number =>
      1 + (bloomInnerScale - 1) * Math.pow(u, 0.85);
    // Mirrored in the vertex shader, which needs the same pivot to hinge about.
    // The two read the same two config numbers, and must keep doing so.
    const attachAt = (u: number): number =>
      bloomAttachOuter + (bloomAttachInner - bloomAttachOuter) * u;

    // Area, not count, decides how many particles a petal needs.
    let weightTotal = 0;
    for (let n = 0; n < petalCount; n += 1) {
      const sc = scaleAt(place(n));
      weightTotal += sc * sc;
    }

    for (let petal = 0; petal < petalCount; petal += 1) {
      const u = place(petal);
      // A hair off the exact golden angle. This is the one variation that is
      // safe: turning a petal about the axis cannot make it cross one stacked
      // above it, where changing its shape can.
      const angle = petal * GOLDEN_ANGLE + (random() - 0.5) * 0.08;
      const ax = Math.cos(angle);
      const ay = Math.sin(angle);

      const scale = scaleAt(u);
      const attach = attachAt(u);
      const length = bloomLength * scale;
      const bend = bloomBendOuter + (bloomBendInner - bloomBendOuter) * u;
      const perPetal = Math.floor((petalBudget * scale * scale) / weightTotal);

      /** Half-width at `t` along the petal: obovate, clawed, frilled. */
      const halfWidth = (t: number): number => {
        const claw = 0.08 + 0.92 * smoothstep01(t / 0.3);
        // Lance-shaped: widest below the middle and drawn out to a point, which
        // is what makes the closed bud read as a bud. A blunt, near-elliptical
        // petal gives a bud with a flat top.
        const body = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.86)), 0.66);
        const frill =
          1 + 0.12 * Math.sin(t * 11) * smoothstep01((t - 0.25) / 0.75);
        const notch = 1 - 0.05 * smoothstep01((t - 0.92) / 0.08);
        return bloomWidth * scale * claw * body * frill * notch;
      };

      /**
       * A point on the petal. The spine starts at the **attachment radius** and
       * arcs out and up; the section rolls about it, so the margins face
       * different ways along its length. `z` is the petal's own relief only —
       * the lift is added by the shader, which hinges the petal there.
       */
      const surface = (t: number, across: number): number[] => {
        const sideways = across * halfWidth(t);
        const spineR = attach + length * t * Math.cos(bend * t);
        const spineZ = length * t * Math.sin(bend * t);

        const edge = Math.min(1, Math.abs(across));
        const cup = 0.5 * scale * sideways * sideways;
        const ruffle =
          0.04 *
          scale *
          Math.sin(across * 8) *
          Math.pow(edge, 2.2) *
          smoothstep01((t - 0.25) / 0.75);
        const height = cup + ruffle;

        const twist = bloomRoll * t;
        const ct = Math.cos(twist);
        const st = Math.sin(twist);
        const sw = sideways * ct - height * st;
        const zz = sideways * st + height * ct;

        return [ax * spineR - ay * sw, ay * spineR + ax * sw, spineZ + zz];
      };

      // **Each petal is drawn as three populations, not as a cloud.** A petal
      // filled with evenly scattered particles has no boundary, and a flower of
      // them is a haze with no shape in it:
      //   margin  a bright line right along the edge — this is what makes one
      //           petal legible against the one behind it
      //   veins   a midrib and ribs fanning off it
      //   tissue  a dim field between them, so the petal is a surface and not a
      //           wireframe — and *dim*, or it drowns the two above
      const marginCount = Math.floor(perPetal * 0.26);
      const veinCount = Math.floor(perPetal * 0.3);

      for (let n = 0; n < perPetal && i < total; n += 1, i += 1) {
        const kind = n < marginCount ? 0 : n < marginCount + veinCount ? 1 : 2;

        let t;
        let across;
        if (kind === 0) {
          t = 0.07 + Math.pow(random(), 0.85) * 0.93;
          across = (n % 2 === 0 ? 1 : -1) * (0.985 + random() * 0.03);
        } else if (kind === 1) {
          t = Math.pow(random(), 0.8);
          const rib = Math.floor(random() * 9);
          const side =
            rib === 0 ? 0 : ((rib % 2 === 0 ? 1 : -1) * Math.ceil(rib / 2)) / 4;
          across = side * Math.pow(t, 0.7) * 0.92 + (random() - 0.5) * 0.04;
        } else {
          t = Math.pow(random(), 0.6);
          across = (random() * 2 - 1) * 0.97;
        }

        const point = surface(t, across);
        // Normal from the surface itself, by finite difference in both
        // parameters. Deriving it by hand would mean keeping two versions of
        // the shape in step, and they would drift.
        const h = 0.01;
        const dt = surface(Math.min(1, t + h), across);
        const da = surface(t, across + h);
        const tu = [dt[0] - point[0], dt[1] - point[1], dt[2] - point[2]];
        const tv = [da[0] - point[0], da[1] - point[1], da[2] - point[2]];
        const nx = tu[1] * tv[2] - tu[2] * tv[1];
        const ny = tu[2] * tv[0] - tu[0] * tv[2];
        const nz = tu[0] * tv[1] - tu[1] * tv[0];
        const nl = Math.hypot(nx, ny, nz) || 1;
        const lambert = Math.abs(
          (nx / nl) * LIGHT[0] + (ny / nl) * LIGHT[1] + (nz / nl) * LIGHT[2],
        );

        // Petals deeper in the spiral sit in the shade of the ones outside them,
        // and every petal is darker where it tucks under its neighbour.
        const shelter = 1 - u * 0.3;
        const tuck = 0.4 + 0.6 * smoothstep01(t / 0.35);
        const weight = kind === 0 ? 3.6 : kind === 1 ? 2 : 0.8;

        const jitter = kind === 2 ? 0.007 : 0.0025;
        out.position[i * 3] = point[0] + (random() - 0.5) * jitter;
        out.position[i * 3 + 1] = point[1] + (random() - 0.5) * jitter;
        out.position[i * 3 + 2] = point[2] + (random() - 0.5) * jitter;

        out.shade[i] = weight * (0.3 + 1.15 * lambert) * shelter * tuck;
        // Colour follows the light: lit faces pale, creases and throats deep.
        // The margin runs paler still — a real petal edge is thin enough to glow
        // slightly against whatever is behind it.
        out.tone[i] = Math.min(
          1,
          Math.max(
            0,
            0.16 + 0.8 * lambert + 0.16 * t + (kind === 0 ? 0.25 : 0),
          ) * (kind === 1 ? 0.6 : 1),
        );
        out.size[i] =
          kind === 0
            ? 0.8 + random() * 0.25
            : kind === 1
              ? 0.66 + random() * 0.2
              : 1 + random() * 0.45;
        out.seed[i] = attach;
        out.type[i] = PART.bloom;
        // Its place in the spiral: lift, identity, and the opening phase.
        // Outermost first — the **only** order that does not tear the flower
        // apart, since an inner petal laying back while the ones outside it are
        // still standing would have to pass through them to get there, which a
        // real flower cannot do either. The tight middle opens last.
        out.detail[i] = u;
        // Its azimuth, turns rather than radians. The shader splits the petal
        // into along/across/up about this direction, because a petal has to bend
        // about **one** axis — the tangent at its attachment — and a fold worked
        // out per point from that point's own radius shears it instead.
        out.spin[i] = (((angle % TAU) + TAU) % TAU) / TAU;
      }
    }

    // ── The heart of the flower ────────────────────────────────────────────
    // A low dome where the petals meet the stem, marked `spin = -2`. Without it
    // the attachment ring is an empty hole: the stem arrives at nothing and the
    // petals appear to float around a gap. Real flowers have a receptacle there
    // and it is what the eye reads as the centre.
    //
    // It sits in the face plane like the petals, but takes no fold — it is the
    // thing they hinge *on*.
    const heartBudget = Math.floor(bloomParticles * 0.05);
    const heartRadius = bloomAttachOuter * 1.05;
    for (let n = 0; n < heartBudget && i < total; n += 1, i += 1) {
      const a = random() * TAU;
      const rr = heartRadius * Math.sqrt(random());
      const shell = rr / heartRadius;
      // A dome, denser toward its skin so the silhouette has an edge.
      const dome = Math.cos(shell * Math.PI * 0.5);
      const height =
        heartRadius * 0.7 * dome * (0.55 + 0.45 * Math.pow(random(), 0.4));

      out.position[i * 3] = Math.cos(a) * rr;
      out.position[i * 3 + 1] = Math.sin(a) * rr;
      out.position[i * 3 + 2] = height;

      const lambert = Math.max(
        0,
        Math.cos(a) * shell * LIGHT[0] +
          Math.sin(a) * shell * LIGHT[1] +
          dome * LIGHT[2],
      );
      // Dimmer than a petal: it is the centre, not a bead sitting under the
      // flower, and at full brightness that is exactly what it looks like.
      out.shade[i] = 0.35 + 1.4 * lambert;
      out.size[i] = 0.65 + random() * 0.25;
      out.tone[i] = Math.min(1, 0.06 + 0.45 * lambert);
      out.seed[i] = 0;
      out.type[i] = PART.bloom;
      out.detail[i] = 0;
      out.spin[i] = -2;
    }

    // ── Its stem ───────────────────────────────────────────────────────────
    // Marked by `spin = -1` and `tone = 2`: the shader reads those as "this is
    // the stalk" and gives it the stem colour, the world vertical and a growth
    // of its own instead of a petal's hinge. Coordinates here are
    // **world-aligned** (x across, y up, z out), not in the face plane — the
    // head is pitched back to be seen from the side, and a stem pitched with it
    // would hang out of the bottom of the frame at an angle.
    for (let n = 0; n < stalkBudget && i < total; n += 1, i += 1) {
      const t = random();
      // A gentle bow, the same idea as the dandelion's — a ruler-straight stem
      // is the one thing that reads as drawn rather than grown.
      const bow = Math.sin(t * Math.PI * 0.85) * bloomStemLength * 0.07;
      const angle = random() * TAU;
      // Three populations, like the petals — a stem drawn as an even scatter
      // through a cylinder is a column of sand, because the density is the same
      // everywhere and there is no line in it anywhere.
      //   core   a tight bright axis, which is what the eye follows
      //   skin   the lit side of the tube, so it reads as round
      //   stray  a few off the surface, so the silhouette is not a hard edge
      const draw = random();
      const kind = draw < 0.55 ? 0 : draw < 0.94 ? 1 : 2;
      const radial =
        kind === 0
          ? Math.pow(random(), 1.8) * 0.4
          : kind === 1
            ? 0.7 + random() * 0.35
            : 1.4 + random() * 1.6;
      // Tapering: thicker at the base, drawn in under the head.
      const radius = bloomStemRadius * (0.55 + t * 0.6) * radial;

      out.position[i * 3] = Math.cos(angle) * radius + bow;
      out.position[i * 3 + 1] = -bloomStemLength * t;
      out.position[i * 3 + 2] = Math.sin(angle) * radius;

      // Lit from the same side as everything else, so the tube reads as round.
      const lambert = Math.max(
        0,
        Math.cos(angle) * LIGHT[0] + Math.sin(angle) * LIGHT[2],
      );
      const shading =
        kind === 0 ? 1.6 : kind === 1 ? 0.35 + 1.3 * lambert : 0.28;
      out.shade[i] = shading * (1 - t * 0.3);
      out.size[i] =
        kind === 0
          ? 0.75 + random() * 0.3
          : kind === 1
            ? 0.62 + random() * 0.25
            : 0.5 + random() * 0.2;
      out.seed[i] = random();
      out.type[i] = PART.bloom;
      out.detail[i] = 0;
      out.spin[i] = -1;
      out.tone[i] = 2;
    }
  }

  // ── Pollen ───────────────────────────────────────────────────────────────
  // Motes adrift around the head, bright enough to earn a halo of their own.
  // Unlike the dust they sit **near** the plant, in focus, and orbit it — they
  // are part of the plant's air, not the room's.
  //
  // `aSpin` carries each one's orbit rate, signed, and `aSeed` its drift phase.
  for (let n = 0; n < pollenParticles && i < total; n += 1, i += 1) {
    const u = random() * 2 - 1;
    const theta = random() * TAU;
    const r = headRadius * (1.04 + Math.pow(random(), 0.8) * 1.05);
    const sn = Math.sqrt(Math.max(0, 1 - u * u));

    out.position[i * 3] = headCenter[0] + Math.cos(theta) * sn * r;
    out.position[i * 3 + 1] = headCenter[1] + u * r * 0.85;
    out.position[i * 3 + 2] = headCenter[2] + Math.sin(theta) * sn * r;
    // A few are much brighter than the rest — an even field of motes reads as
    // sensor noise, a few bright ones read as pollen catching the light.
    const bright = Math.pow(random(), 2.8);
    out.shade[i] = 0.3 + bright * 2.2;
    out.size[i] = 0.65 + bright * 1.1 + random() * 0.3;
    out.seed[i] = random();
    out.type[i] = PART.pollen;
    out.detail[i] = 0;
    out.spin[i] = (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.8);
    out.tone[i] = 0;
  }

  // ── The iris that gathers out of the dark ────────────────────────────────
  // The last figure of the scroll: a ring of fibres around an empty pupil, drawn
  // face-on. Positions are **local to its own plane** (x, y across it, z a sliver
  // of depth); the shader places that plane square in the camera's basis and
  // draws each particle in from far out as it assembles.
  //
  // It is three populations, because a field of radial lines is a bicycle wheel
  // and nothing else. What makes an iris an iris is that the lines *lose their
  // discipline* the further out they go:
  //
  //   fibres  strands running from the pupil to the rim, straight and tight at
  //           the pupil and meandering more the further out they get
  //   curls   short turbulent arcs across the outer half — the smoky whorls
  //           that break the radial rhythm up
  //   rim     a feathered edge, short tufts crossing the boundary, so the
  //           silhouette is torn rather than cut
  {
    const fibreBudget = Math.floor(irisParticles * 0.66);
    const curlBudget = Math.floor(irisParticles * 0.2);
    const rimBudget = Math.max(0, irisParticles - fibreBudget - curlBudget);

    /** When this particle arrives, as a fraction of the gathering. Inner first,
     *  so the ring grows outward instead of appearing all at once. */
    const arrival = (r: number): number =>
      Math.min(0.85, 0.45 * (r / 1.15) + 0.28 * random());

    // ── Fibres ──────────────────────────────────────────────────────────
    const perFibre = 220;
    const fibres = Math.max(40, Math.floor(fibreBudget / perFibre));
    for (let f = 0; f < fibres && i < total; f += 1) {
      const theta0 = random() * TAU;
      const w1 = 3 + Math.floor(random() * 4);
      const w2 = 8 + Math.floor(random() * 7);
      const p1 = random() * TAU;
      const p2 = random() * TAU;
      const amp = 0.05 + random() * 0.1;
      const sway = random() < 0.5 ? -1 : 1;
      const startR = irisPupil * (0.99 + random() * 0.05);
      const endR = 0.86 + random() * 0.2;
      // A few fibres carry most of the light; the rest are the field they sit in.
      const bright = 0.3 + Math.pow(random(), 1.7) * 1.7;

      for (let n = 0; n < perFibre && i < total; n += 1, i += 1) {
        const t = n / (perFibre - 1);
        const r = startR + (endR - startR) * Math.pow(t, 0.92);
        // The meander swells outward, and past the collarette the strand turns.
        const swell = Math.pow(t, 1.7);
        const turbulence = Math.pow(Math.max(0, t - 0.5) / 0.5, 2);
        const theta =
          theta0 +
          sway *
            (amp *
              swell *
              (Math.sin(t * w1 * 2 + p1) + 0.55 * Math.sin(t * w2 * 2 + p2)) +
              0.11 * turbulence);
        const rr = r * (1 + 0.013 * Math.sin(t * 17 + p2));

        out.position[i * 3] = Math.cos(theta) * rr;
        out.position[i * 3 + 1] = Math.sin(theta) * rr;
        out.position[i * 3 + 2] = (random() - 0.5) * 0.03;

        // Crisp at the pupil — that boundary is a circle and should look like
        // one — and fading out at the rim, so no strand ends on a hard stop
        // there, which is what would read as a wheel spoke.
        const ends =
          smoothstep01(t / 0.03) * (1 - 0.55 * smoothstep01((t - 0.86) / 0.14));
        // Only a little per-point variation: at full strength it breaks the
        // strand into a dotted line and the whole iris reads as noise.
        out.shade[i] = bright * ends * (0.82 + 0.3 * random());
        out.size[i] = 0.55 + random() * 0.35;
        out.seed[i] = random();
        out.type[i] = PART.iris;
        out.detail[i] = 0;
        out.spin[i] = arrival(rr);
        out.tone[i] = 0;
      }
    }

    // ── Curls ───────────────────────────────────────────────────────────
    const perCurl = 40;
    const curls = Math.max(20, Math.floor(curlBudget / perCurl));
    for (let c = 0; c < curls && i < total; c += 1) {
      const centreR = 0.6 + random() * 0.36;
      const centreA = random() * TAU;
      const span = 0.1 + random() * 0.28;
      const bow = (random() - 0.5) * 0.28;
      const dir = random() < 0.5 ? -1 : 1;
      const phase = random() * TAU;
      const bright = 0.35 + Math.pow(random(), 1.5) * 1.3;

      for (let n = 0; n < perCurl && i < total; n += 1, i += 1) {
        const t = n / (perCurl - 1);
        const a = centreA + dir * span * (t - 0.5);
        const rr =
          centreR +
          bow * Math.sin(t * Math.PI) +
          0.02 * Math.sin(t * 9 + phase);

        out.position[i * 3] = Math.cos(a) * rr;
        out.position[i * 3 + 1] = Math.sin(a) * rr;
        out.position[i * 3 + 2] = (random() - 0.5) * 0.04;

        const ends = Math.sin(Math.PI * t);
        out.shade[i] = bright * (0.3 + 0.9 * ends) * (0.8 + 0.3 * random());
        out.size[i] = 0.5 + random() * 0.3;
        out.seed[i] = random();
        out.type[i] = PART.iris;
        out.detail[i] = 0;
        out.spin[i] = arrival(rr);
        out.tone[i] = 0;
      }
    }

    // ── Rim ─────────────────────────────────────────────────────────────
    const perTuft = 16;
    const tufts = Math.max(30, Math.floor(rimBudget / perTuft));
    for (let k = 0; k < tufts && i < total; k += 1) {
      const a0 = random() * TAU;
      const base = 0.9 + random() * 0.07;
      const reach = base + irisRim * (0.3 + random() * 0.9);
      const lean = (random() - 0.5) * 0.09;
      const phase = random() * TAU;
      const bright = 0.5 + Math.pow(random(), 1.4) * 1.6;

      for (let n = 0; n < perTuft && i < total; n += 1, i += 1) {
        const t = n / (perTuft - 1);
        const rr = base + (reach - base) * t;
        const a = a0 + lean * t + 0.03 * Math.sin(t * 4 + phase);

        out.position[i * 3] = Math.cos(a) * rr;
        out.position[i * 3 + 1] = Math.sin(a) * rr;
        out.position[i * 3 + 2] = (random() - 0.5) * 0.05;

        out.shade[i] = bright * (1 - Math.pow(t, 1.4) * 0.85);
        out.size[i] = 0.45 + random() * 0.3;
        out.seed[i] = random();
        out.type[i] = PART.iris;
        out.detail[i] = 0;
        out.spin[i] = arrival(rr);
        out.tone[i] = 0;
      }
    }
  }

  // Anything left over from the floor() rounding joins the fluff.
  for (; i < total; i += 1) {
    const u = random() * 2 - 1;
    const theta = random() * TAU;
    const r = headRadius * (0.7 + random() * 0.3);
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    out.position[i * 3] = headCenter[0] + Math.cos(theta) * s * r;
    out.position[i * 3 + 1] = headCenter[1] + u * r;
    out.position[i * 3 + 2] = headCenter[2] + Math.sin(theta) * s * r;
    out.shade[i] = 0.3 + random() * 0.4;
    out.size[i] = 0.8 + random() * 0.4;
    out.seed[i] = random();
    out.type[i] = PART.hair;
  }

  // Only the plant is shuffled — the fixed-size parts must stay at the front.
  shuffle(out, fixedEnd, total, random);

  return out;
};

/** Fisher–Yates over every attribute at once, so a draw-range prefix is a
 *  uniform sample of the whole flower rather than one part of it. */
const shuffle = (
  out: DandelionGeometry,
  from: number,
  total: number,
  random: () => number,
): void => {
  for (let a = total - 1; a > from; a -= 1) {
    const b = from + Math.floor(random() * (a - from + 1));
    if (a === b) continue;

    for (let c = 0; c < 3; c += 1) {
      const tmp = out.position[a * 3 + c];
      out.position[a * 3 + c] = out.position[b * 3 + c];
      out.position[b * 3 + c] = tmp;
    }
    for (const attribute of [
      out.shade,
      out.size,
      out.seed,
      out.type,
      out.detail,
      out.spin,
      out.tone,
    ]) {
      const tmp = attribute[a];
      attribute[a] = attribute[b];
      attribute[b] = tmp;
    }
  }
};

/** Every buffer of a built dandelion, for `postMessage`'s transfer list. */
export const dandelionTransferables = (
  geometry: DandelionGeometry,
): ArrayBuffer[] =>
  [
    geometry.position,
    geometry.shade,
    geometry.size,
    geometry.seed,
    geometry.type,
    geometry.detail,
    geometry.spin,
    geometry.tone,
  ].map((array) => array.buffer as ArrayBuffer);

/** `computeBoundingSphere`'s own arithmetic, over a position buffer. */
export const sphereOf = (
  position: Float32Array,
): { center: [number, number, number]; radius: number } => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.length; i += 3) {
    for (let c = 0; c < 3; c += 1) {
      const v = position[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  let farthest = 0;
  for (let i = 0; i < position.length; i += 3) {
    const dx = position[i] - center[0];
    const dy = position[i + 1] - center[1];
    const dz = position[i + 2] - center[2];
    farthest = Math.max(farthest, dx * dx + dy * dy + dz * dz);
  }
  return { center, radius: Math.sqrt(farthest) };
};
