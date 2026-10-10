/**
 * GLSL for the dandelion.
 *
 * The form is baked (see `dandelion-geometry.ts`), so the vertex shader's job is
 * everything that moves: the plant growing in on load, the sway, a per-particle
 * shimmer, and the dust drifting across frame.
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

/** 3D simplex noise — Ashima Arts / Stefan Gustavson, MIT, the standard port. */
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 snoise3(vec3 p) {
  return vec3(
    snoise(p),
    snoise(p + vec3(31.416, 0.0, 17.234)),
    snoise(p + vec3(0.0, 57.204, 91.877))
  );
}
`;

export const dandelionVertexShader = /* glsl */ `
precision highp float;

in float aShade;
in float aSize;
in float aSeed;     // random, except on the flower's petals: the attachment radius
in float aType;
in float aDetail;   // when this particle joins in, along the approach — or,
                    // on the flower, which petal of its whorl this belongs to
in float aSpin;     // its share of the lattice's scroll-driven rotation
in float aTone;     // where it sits in its part's colour range

uniform float uTime;
// Brushed by the pointer: how much the head is being brushed, and how far the
// plant brightens for it. Nothing here moves the plant — see the note where the
// wind used to be.
uniform float uTouch;
uniform float uTouchLit;   // how far it brightens under the hand
uniform float uGrowth;       // 0–1, the plant growing in
uniform float uStemShare;    // share of the growth spent extending the stem
uniform float uStartLength;  // stem length at the start, as a fraction
uniform float uBudScale;     // head size at the start, as a fraction
uniform float uOpenAt;       // share of the growth the bud stays shut for
uniform float uBudAlpha;     // how much of its light a shut bud keeps
uniform float uSize;
uniform float uMinSize;
uniform float uMaxSize;      // sprites at the camera would otherwise be unbounded
uniform float uPixelRatio;
uniform float uPerspective;
uniform float uIntensity;
uniform float uInsideGain;   // the plant's close-up exposure — not the closing figures'
uniform float uFade;         // the blackout at the end of the fly-through
uniform float uDetail;       // how much of the lattice's filigree is drawn, 0–1
uniform float uLatticeSpin;  // radians the lattice has turned, from the scroll
uniform float uScatter;      // everything blowing apart as the core is reached
uniform float uGlowScatter;    // the core disperses on its own clock, slowly
uniform float uPatternScatter; // and the rings on theirs, once the camera is past
uniform float uLattice;        // the rings fading in as the camera closes
uniform float uLatticeStagger; // …one structure at a time, over this much of it
uniform float uThin;           // the head loosening on the way in, well before it leaves
uniform float uThinFade;
uniform float uThinDrift;
uniform float uScatterDistance;
uniform float uGlowGain;     // the core brightening as the camera closes on it
uniform vec3 uColorGlow;
uniform vec3 uColorPollen;
uniform vec3 uColorPetalLight;
uniform vec3 uColorPetalDeep;
uniform float uBloom;        // the flower opening, 0–1
uniform float uBloomScale;
uniform float uBloomSpan;    // how far a petal reaches, for the opening lag
uniform float uFoldAngle;    // how far the petals hinge up when closed
uniform float uOpenFold;     // …and how far they still stand at full open
uniform float uBloomTwist;
uniform float uBloomTilt;    // how far the open face is pitched back from the vertical
uniform float uBloomBudTilt;  // …and where the closed bud starts, near-vertical
uniform float uBloomRoll;
uniform float uBloomStack;      // total lift from the outermost petal to the innermost
uniform float uBloomStemLength;
uniform float uBloomStemReach;  // stretched so it still leaves frame on a tall viewport
uniform float uBloomSpin;       // radians the flower has turned on its own axis
uniform float uBloomScatter;    // the flower coming apart at the very end, 0–1
uniform float uBloomScatterDistance;
uniform float uBloomBreak;      // where whole petals give way to loose particles
uniform float uBloomFly;        // how far a petal travels while it is still whole
uniform float uBloomTumble;     // and how far it turns on the way
uniform float uBloomFall;       // how much it sinks as it drifts out
uniform float uBloomStagger;    // share of the ending spent letting petals go
uniform float uBloomHeartBreak; // where the heart gives way, and the stem after it
uniform float uBloomVortex;     // radians the departing petals wind round the middle
uniform float uBloomDrift;      // radians a loose petal rocks by, scroll or no scroll
uniform float uBloomSpinRate;   // radians the flower turns per unit of the scatter
uniform float uPetalLength;     // the outermost petal's length, as the geometry built it
uniform float uPetalInnerScale; // and the innermost's size against it
uniform float uPetalBendOuter;  // how far a petal's spine arcs, outermost to innermost
uniform float uPetalBendInner;
uniform float uIris;            // the last figure gathering out of the dark, 0-1
uniform float uIrisScale;
uniform float uIrisGather;      // how far out its particles start
uniform float uIrisGrain;       // its own sprite scale, like the flower's
uniform float uIrisGain;
uniform float uBloomExposure;
uniform float uIrisTurn;        // radians the iris has turned, from the clock
uniform vec3 uIrisCenter;
uniform float uIrisPupil;       // the pupil's radius, in the iris's own units
uniform vec3 uColorIrisLime;    // the outer fibres' gradient, one end…
uniform vec3 uColorIrisSky;     // …and the other
uniform float uBloomStemShare; // share of the opening spent raising the stem
uniform float uBloomPerspective; // the flower's own, fixed — see below
uniform vec3 uColorBloomStem;
uniform float uBudTighten;   // how far the closed bud draws in on itself
uniform float uBloomViewZ;   // view-space z of the flower's centre
uniform float uBloomDepth;   // and how deep the flower is, for its own depth cue
uniform float uBloomBack;
uniform float uBloomFront;
uniform vec3 uBloomCenter;
uniform vec3 uBloomRight;    // the camera's basis, so the flower faces the viewer
uniform vec3 uBloomUp;
uniform vec3 uBloomForward;
uniform float uHeadRadius;
uniform float uHeadViewZ;    // view-space z of the head centre, for the depth cue
uniform vec3 uHeadCenter;
uniform float uSpin;         // rad/s, head only — the stem stays put
uniform vec3 uStemBase;      // the plant bends around this point
uniform float uWind;         // where the one sway has the top of the stem, world units, signed
uniform float uFocus;        // view-space distance that is in focus
uniform float uDofRange;     // how far out of focus the frame goes
uniform float uDofSpread;    // how much an out-of-focus sprite grows
uniform float uDepthBack;    // brightness at the back of the head
uniform float uDepthFront;
uniform float uDepthMix;     // how much of the depth cue applies, 1 outside → 0 inside
uniform float uDustSpeed;
uniform float uDustSpan;
uniform vec3 uColorFluff;
uniform vec3 uColorFluffEdge;  // the head cools to blue at its rim
uniform vec3 uColorFluffYoung; // …and starts the growth yellow, before it seeds
uniform float uEdgeAt;         // where the white gives way to the blue
uniform float uEdgeWidth;      // and how hard that boundary is
uniform float uGlowStagger;    // spread of the core's departure, particle to particle
uniform float uGlowReach;      // and how far it drifts, as a fraction of the rest
uniform float uPollenDrift;
uniform float uPollenClose;  // how tightly the cloud hugs the bud at the start
uniform float uPollenSpin;
uniform vec3 uColorStem;
uniform vec3 uColorBody;
uniform vec3 uColorCore;

out vec3 vColor;
out float vBrightness;

${SIMPLEX_3D}

const float TAU = 6.2831853;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float easeOutCubic(float x) {
  return 1.0 - pow(1.0 - x, 3.0);
}

/**
 * The plant's own curve: it gathers itself, runs, and settles.
 *
 * Easing only *out* starts at full speed, which is the one thing a thing that
 * grows does not do — it was the fastest at the instant it began and crept for
 * the rest. Easing in as well costs nothing and is what makes the whole of it
 * read as one movement rather than as a release.
 */
float easeInOutCubic(float x) {
  return x < 0.5
    ? 4.0 * x * x * x
    : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}

/**
 * A linear ramp, clamped at both ends. Everything the **scroll** drives is
 * staged with this: an eased ramp speeds up and slows down while the wheel turns
 * at a constant rate, and the scene reads as fighting the scroll. The load-time
 * growth keeps its easing — nothing is driving that but the clock.
 */
float ramp(float edge0, float edge1, float x) {
  return clamp((x - edge0) / max(edge1 - edge0, 0.0001), 0.0, 1.0);
}

/** Overshoots a little and settles — the head springs open rather than inflating. */
float easeOutBack(float x) {
  float c1 = 1.70158;
  float c3 = c1 + 1.0;
  return 1.0 + c3 * pow(x - 1.0, 3.0) + c1 * pow(x - 1.0, 2.0);
}

vec3 rotateX(vec3 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

vec3 rotateZ(vec3 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

/** Rodrigues — a turn about an arbitrary axis, for a petal tumbling as it goes. */
vec3 rotateAxis(vec3 v, vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}

vec3 rotateY(vec3 p, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 palette(float type) {
  if (type < 0.5) return uColorFluff;
  if (type < 1.5) return uColorStem;
  if (type < 2.5) return uColorBody;
  if (type < 3.5) return uColorCore;
  if (type < 4.5) return uColorBody;  // the inner lattice
  if (type < 5.5) return uColorFluff; // dust
  if (type < 7.5) return uColorGlow;  // the core
  if (type < 8.5) return uColorFluff; // the iris
  return uColorPollen;                // pollen
}

void main() {
  vec3 pos = position;
  float alpha = 1.0;
  bool dust = aType > 4.5 && aType < 5.5;
  bool glow = aType > 5.5 && aType < 6.5;
  bool bloom = aType > 6.5 && aType < 7.5;
  bool iris = aType > 7.5 && aType < 8.5;
  bool stem = aType > 0.5 && aType < 1.5;
  bool lattice = aType > 3.5 && aType < 4.5;
  bool pollen = aType > 8.5;

  // ── Growth ────────────────────────────────────────────────────────────────
  // The stem elongates from its base and carries the bud up with it; the bud
  // then springs open into the clock. Both phases overlap slightly, so the head
  // starts unfurling while the stem is still rising.
  // **One eased clock for the whole plant.** The growth is driven by the clock,
  // not by the reader, so it may ease — and it should: linear, it stopped dead.
  // Easing it once here rather than per phase is what keeps the stem and the
  // head finishing together, however the curve is shaped.
  float grown = easeInOutCubic(uGrowth);
  // **Each phase lands on its own.** The one eased clock only slows to a stop
  // at the end of the *whole* growth; a phase that ends before that — the
  // stem, at uStemShare — used to stop there at full speed, and the plant
  // visibly braked. So each phase is eased out onto its own end as well:
  // quadratic out for the stem (its start is already slow — the clock eases
  // in), and a smoothstep for the opening, which begins mid-growth at speed
  // and so has to ease in as well as out. Measured on the per-frame curves:
  // the sharpest change of pace fell from 32 to 2.6 on the stem and from 41
  // to 5 on the opening.
  float stemRaw = clamp(grown / max(uStemShare, 0.001), 0.0, 1.0);
  float stemPhase = stemRaw * (2.0 - stemRaw);
  float stemLength = mix(uStartLength, 1.0, stemPhase);
  // **The stem carries a shut bud up, and then the bud opens.** It used to
  // start opening 8 % in, while the head was still below the frame, and most
  // of the growth ran behind the preloader — so by the time the keyhole had
  // opened the head was nearly open and nobody ever saw a bud. Now the stem
  // brings the bud into the frame over uStemShare of the growth, the bud holds
  // shut until uOpenAt, and opens over the rest. The two overlap a little, so
  // it is still one plant growing and not a stem and then a flower.
  float openStart = uOpenAt;
  float openEnd = 1.0;
  float openLinear =
    clamp((grown - openStart) / max(openEnd - openStart, 0.001), 0.0, 1.0);
  float openRaw = openLinear * openLinear * (3.0 - 2.0 * openLinear);
  // Where the head sits while the stem is still growing.
  vec3 headNow = uStemBase + (uHeadCenter - uStemBase) * stemLength;

  if (bloom) {
    // The second plant **stands in the frame** rather than facing the lens: a
    // stem drops from the head down out of shot, and the face is pitched back
    // from the vertical, so we look at the flower from the side the way we look
    // at the dandelion. Squared up to the camera it read as a decal.
    vec3 local = position;
    bool stalk = aSpin < -0.5 && aSpin > -1.5;
    // Where this petal will go when it detaches. It has to be worked out **per
    // petal** — from its azimuth and its lift, both of which every particle of
    // the petal shares — never from the particle's own position. Derived per
    // particle, the near and far ends of a petal head off in different
    // directions and the petal stretches and folds as it leaves.
    vec3 petalDir = uBloomUp;
    // And the point it turns about once it is free: its own middle. Only a
    // petal sets it; the stem and the heart never fly.
    vec3 petalCentre = uBloomCenter;
    // The receptacle: what the petals stand on and the stem arrives at. It sits
    // in the face plane like a petal but takes no fold — it is the thing they
    // hinge on, so it only shares the bud's tightening and the flower's turn.
    bool heart = aSpin < -1.5;

    // Two phases, the same shape of growth the dandelion has on load: the stem
    // rises carrying a closed bud, and the petals open over the rest, starting
    // before the stem has finished.
    float rise = clamp(uBloom / max(uBloomStemShare, 0.001), 0.0, 1.0);
    float openStart = uBloomStemShare * 0.6;
    float openRaw = clamp((uBloom - openStart) / max(1.0 - openStart, 0.001), 0.0, 1.0);
    // Pushed back for a narrow viewport the flower is smaller in a taller frame,
    // so the stem is stretched to match — otherwise it stops in mid-air.
    float stemLen = uBloomStemLength * uBloomStemReach;
    // Where the top of the stem has got to. The head rides it up.
    float top = -stemLen * (1.0 - rise);

    if (stalk) {
      // Elongates from its base, which stays put below the frame, and turns
      // with the head — it is one plant, so the bow has to sweep round with it.
      float cs = cos(-uBloomSpin);
      float ss = sin(-uBloomSpin);
      vec3 grown = vec3(
        local.x * cs - local.z * ss,
        -stemLen + (local.y * uBloomStemReach + stemLen) * rise,
        local.x * ss + local.z * cs
      );
      pos = uBloomCenter
        + uBloomRight * grown.x * uBloomScale
        + uBloomUp * grown.y * uBloomScale
        + uBloomForward * grown.z * uBloomScale;
      alpha = ramp(0.0, 0.05, uBloom) * uBloomExposure;
    } else if (heart) {
      float open0 = openRaw;
      float squeeze = mix(uBudTighten, 1.0, open0);
      float turn0 = (1.0 - open0) * uBloomTwist - uBloomSpin + uBloomRoll;
      float cz = cos(turn0);
      float sz = sin(turn0);
      vec3 shaped = vec3(
        (local.x * cz - local.y * sz) * squeeze,
        (local.x * sz + local.y * cz) * squeeze,
        local.z * squeeze
      );

      float tilt = mix(uBloomBudTilt, uBloomTilt, openRaw);
      vec3 faceUp = uBloomUp * cos(tilt) - uBloomForward * sin(tilt);
      vec3 faceOut = uBloomUp * sin(tilt) + uBloomForward * cos(tilt);
      pos = uBloomCenter
        + uBloomUp * top * uBloomScale
        + uBloomRight * shaped.x * uBloomScale
        + faceUp * shaped.y * uBloomScale
        + faceOut * shaped.z * uBloomScale;
      petalDir = faceOut;
      alpha = ramp(0.0, 0.05, uBloom) * uBloomExposure;
    } else {
      // **The petal is split along its own axis, not the flower's radius.**
      // A petal bends about one line: the tangent where it meets the
      // receptacle. Working the bend out from each point's distance to the
      // middle of the flower — which is what this did — bends the wide part of
      // the petal further than its spine, and the petal comes out sheared and
      // creased instead of turned. Here it is decomposed into distance along
      // the petal, offset across it, and height, and only the first two of
      // those ever move.
      float az = aSpin * TAU;
      vec2 axis = vec2(cos(az), sin(az));
      vec2 side = vec2(-axis.y, axis.x);
      float along = dot(local.xy, axis);
      float across = dot(local.xy, side);

      // Petals go in turn — aDetail runs 0 at the rim to 1 at the heart, so the
      // wave travels inward — and the far end of a petal lags its own base.
      float lag = clamp(along / max(uBloomSpan, 0.001), 0.0, 1.0);
      float delay = aDetail * 0.45 + lag * 0.15;
      float open = clamp((openRaw - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);

      // **Hinged, not scaled.** Each point swings out of the plane about an axis
      // through the centre perpendicular to its own radius, so a closed bud is
      // the petals standing on end along the stem, and opening lays them back.
      // The open flower keeps a little of the fold: laid all the way flat, the
      // outer whorl becomes a horizontal disc seen edge-on and the whole thing
      // reads as a wide flat plate rather than a cup with petals in it.
      float fold = mix(uOpenFold, uFoldAngle, 1.0 - open);
      float cf = cos(fold);
      float sf = sin(fold);
      // Drawn in on itself as well as stood on end, or a "closed" bud is a tall
      // splayed spike rather than the tight packed thing a bud actually is.
      float tighten = mix(uBudTighten, 1.0, open);

      // **Each petal hinges about its own attachment**, at radius aSeed and
      // height lift on the receptacle — not about the middle of the flower. A
      // petal pivoting on the axis swings its tip across to the far side and
      // through every petal over there, and no amount of stacking fixes that.
      // The receptacle itself does not tighten: the ring the petals stand on is
      // what keeps the closed bud a set of nested cups rather than a spike.
      //
      // This is a **rigid** turn: one rotation about one line, plus one uniform
      // scale. The petal keeps its shape exactly, whatever the fold — which is
      // the whole point, because a petal is stiff. It does not stretch open.
      float pivot = aSeed;
      float lift = aDetail * uBloomStack;
      float reach = (along - pivot) * tighten;
      float rise2 = local.z * tighten;
      float alongOut = pivot + reach * cf - rise2 * sf;
      float upOut = lift * tighten + reach * sf + rise2 * cf;

      // The whole flower turns on its own axis as it arrives, clockwise from
      // the viewer's side, and keeps turning while it comes apart; the bud's
      // packing unwinds through the same axis. Both are rotations of the petal
      // about the flower's middle, so they are one angle added to its azimuth
      // — and adding it there keeps them rigid too.
      float turn = (1.0 - open) * uBloomTwist - uBloomSpin + uBloomRoll;
      // **A petal that has let go stops turning with the flower** — gradually.
      // It leaves carrying the flower's spin and the air takes it off: of what
      // the flower has turned since, it keeps only (1 - e^-ks)/k worth. Carried
      // on at the flower's rate, a petal in the air kept orbiting the head. The
      // release is the same one the departure below works out, from the same
      // per-petal hash, so the two agree to the frame.
      float relSeed = hash11(aDetail * 53.7 + aSpin * 29.3 + 7.1);
      float relAt = clamp(aDetail * 0.85 + relSeed * 0.15, 0.0, 1.0) * uBloomStagger;
      float freed = max(uBloomScatter - relAt, 0.0);
      const float SPIN_DRAG = 3.0;
      turn += uBloomSpinRate * (freed - (1.0 - exp(-SPIN_DRAG * freed)) / SPIN_DRAG);
      vec2 axisNow = vec2(cos(az + turn), sin(az + turn));
      vec2 sideNow = vec2(-axisNow.y, axisNow.x);

      vec3 shaped = vec3(axisNow * alongOut + sideNow * (across * tighten), upOut);

      // The head **nods**: a bud points up along its stem, and tips toward the
      // viewer as it opens. The whole head moves as one here — this is the
      // flower's own attitude, not a per-petal hinge.
      float headOpen = openRaw;
      float tilt = mix(uBloomBudTilt, uBloomTilt, headOpen);
      vec3 faceUp = uBloomUp * cos(tilt) - uBloomForward * sin(tilt);
      vec3 faceOut = uBloomUp * sin(tilt) + uBloomForward * cos(tilt);

      pos = uBloomCenter
        + uBloomUp * top * uBloomScale
        + uBloomRight * shaped.x * uBloomScale
        + faceUp * shaped.y * uBloomScale
        + faceOut * shaped.z * uBloomScale;

      // **The petal's own middle**, put through exactly the hinge its particles
      // were: a point on its spine a little under half-way out, worked from the
      // same length, size and bend the geometry built the petal with. Every
      // particle of the petal gets the same answer, so a petal turning about it
      // turns as one rigid piece about its own centre, not about the flower.
      float petalScale = 1.0 + (uPetalInnerScale - 1.0) * pow(aDetail, 0.85);
      float petalLength = uPetalLength * petalScale;
      float petalBend = mix(uPetalBendOuter, uPetalBendInner, aDetail);
      float midT = 0.45;
      float midAlong = aSeed + petalLength * midT * cos(petalBend * midT);
      float midRise = petalLength * midT * sin(petalBend * midT) * tighten;
      float midReach = (midAlong - pivot) * tighten;
      vec3 midShaped = vec3(
        axisNow * (pivot + midReach * cf - midRise * sf),
        lift * tighten + midReach * sf + midRise * cf
      );
      petalCentre = uBloomCenter
        + uBloomUp * top * uBloomScale
        + uBloomRight * midShaped.x * uBloomScale
        + faceUp * midShaped.y * uBloomScale
        + faceOut * midShaped.z * uBloomScale;

      // Out along its own azimuth and up out of the face, the deeper in the
      // spiral the steeper — which is roughly where a real petal goes when it
      // lets go.
      vec3 away = vec3(axisNow, 0.35 + aDetail * 0.8);
      petalDir = normalize(
        uBloomRight * away.x + faceUp * away.y + faceOut * away.z
      );

      // A closed petal is still a petal, so it does not fade in with its own
      // opening — that left the bud a faint smudge instead of the dense thing it
      // should be. But a bud is the same particles packed into a fraction of the
      // volume, so at the same brightness its middle clips to white and the
      // petals in it disappear. This is the compromise: dimmer while packed.
      alpha = ramp(0.0, 0.05, uBloom) * mix(0.45, 1.0, open) * uBloomExposure;
    }

    // ── And then it leaves ───────────────────────────────────────────────
    // In two stages, because a flower that dissolves straight into a cloud of
    // dust never looked like it came apart — it looked like it was switched
    // off. First the **petals detach whole**: each one keeps its shape, tumbles
    // about its own axis and sails away. Only then do they break up into loose
    // particles and fade, and the stem with them.
    if (uBloomScatter > 0.0) {
      vec3 head = uBloomCenter + uBloomUp * top * uBloomScale;

      // Everything from here works on the **offset from the head**, so the whole
      // departure can be wound about the middle at the end in one move.
      vec3 offset = pos - head;

      // aSpin is the azimuth and aDetail the place in the spiral, so the pair is
      // unique per petal — and every particle of one petal hashes to the same
      // numbers, which is the whole reason the petal moves as one piece.
      float ps = hash11(aDetail * 53.7 + aSpin * 29.3 + 7.1);
      float ps2 = hash11(aDetail * 41.3 + aSpin * 17.9 + 19.7);
      float ps3 = hash11(aDetail * 67.1 + aSpin * 23.1 + 31.3);
      vec3 wobble = vec3(ps, ps2, ps3) - 0.5;

      // **Petals let go one at a time**, outermost first — the flower unravels
      // in the order it opened, and a whole ring leaving at once reads as an
      // explosion rather than a flower coming apart. A little per-petal jitter
      // on top, or the queue is a metronome. The heart waits for the stem.
      float lead = heart ? 1.0 : clamp(aDetail * 0.85 + ps * 0.15, 0.0, 1.0);
      float release = stalk ? 0.0 : lead * uBloomStagger;
      // This petal's own clock, from the moment it lets go. **Everything** that
      // moves it has to run off this and not off the scatter, or a petal still
      // attached to the flower drifts off with the ones that have gone.
      float own = clamp(
        (uBloomScatter - release) / max(1.0 - release, 0.001), 0.0, 1.0
      );
      float live = ramp(0.0, 0.06, own);
      float flyRaw = clamp((uBloomScatter - release) / max(uBloomBreak, 0.001), 0.0, 1.0);

      // **The plant comes apart from the heart downward, and the heart does not
      // fly.** It is the socket the petals sit in, not one of them — sent off
      // with them it reads as a bead tumbling through the frame among the
      // petals, which is exactly what it looked like. It crumbles where it
      // stands, first, and the stem follows it down its own length: the one
      // part with a length to travel along, and a stem that vanishes all at once
      // reads as a light being switched off.
      float along = clamp(-local.y / max(uBloomStemLength, 0.001), 0.0, 1.0);
      float breakStart = heart
        ? uBloomHeartBreak
        : stalk
          ? mix(uBloomHeartBreak + 0.04, uBloomHeartBreak + 0.04 + uBloomBreak, along)
          : release + uBloomBreak;
      float breakRaw =
        clamp((uBloomScatter - breakStart) / max(1.0 - breakStart, 0.001), 0.0, 1.0);

      if (!stalk && !heart) {
        // **A petal that lets go falls like a leaf.** Three things, all of them
        // about the petal itself and none about the flower:
        //
        // - It **turns about its own middle**. Turned about the head, which is
        //   what this did, a petal swung round the flower like a door on a
        //   hinge and folded under it on the way.
        // - It **starts from rest and glides**. The distance is a drag curve,
        //   s - (1 - e^-ks)/k: no velocity when it lets go, then settling to a
        //   steady drift, the way something light is carried off by air. A
        //   square law kept accelerating for as long as the petal was in shot.
        // - It **sways and rocks together** — the falling-leaf flutter: a
        //   sideways swing, and a rock a quarter-beat ahead of it, building up
        //   as the petal gets moving.
        //
        // Every one of them runs off the petal's own scroll clock, so the whole
        // departure is smooth, reversible, and still when the page is still.
        // The one thing on the wall clock is a small bounded rock, so a petal
        // hanging in the air is not frozen.
        float s = max(uBloomScatter - release, 0.0) / max(uBloomBreak, 0.001);
        const float DRAG = 2.2;
        float glideNow = s - (1.0 - exp(-DRAG * s)) / DRAG;
        float glideAtBreak = 1.0 - (1.0 - exp(-DRAG)) / DRAG;
        float drift = glideNow / glideAtBreak;
        float wake = ramp(0.0, 0.45, s);
        float phase = ps * TAU;
        float beat = s * (4.2 + ps2 * 1.6) + phase;

        vec3 centre = petalCentre - head;
        vec3 rel = offset - centre;

        // Rocking about the line across the petal, a quarter-beat ahead of the
        // sway, with a slow steady turn under it — well under a revolution.
        vec3 across = normalize(cross(petalDir, uBloomForward) + wobble * 0.25);
        float rock =
          cos(beat) * 0.42 * wake
          + s * uBloomTumble * (0.5 + ps * 0.5)
          + sin(uTime * 0.8 + phase) * uBloomDrift * live;
        rel = rotateAxis(rel, across, rock);
        // And a slow twist about its own spine.
        rel = rotateAxis(rel, petalDir, (ps3 - 0.5) * 1.1 * drift);

        // Its middle drifts outward from the axis and settles downward as it
        // goes, and a little toward or away from the eye.
        vec3 spinAxis = uBloomForward;
        vec3 outward =
          normalize(petalDir - spinAxis * dot(petalDir, spinAxis) + wobble * 0.12);
        float reach = drift * uBloomFly * uBloomScale * (0.7 + ps2 * 0.5);
        centre += outward * reach;
        centre -= uBloomUp * reach * uBloomFall;
        centre += spinAxis * (ps3 - 0.5) * reach * 0.35;
        centre += uBloomRight * sin(beat) * 0.16 * uBloomScale * wake;

        // Carried a little way round the flower's axis, on the same glide —
        // the group swings as it leaves, rigidly, petal and all.
        float swing = -drift * uBloomVortex * (0.7 + ps3 * 0.6);
        centre = rotateAxis(centre, spinAxis, swing);
        rel = rotateAxis(rel, spinAxis, swing);

        offset = centre + rel;
      }

      if (breakRaw > 0.0) {
        // Now every particle goes its own way, from wherever its petal had got
        // to. Distinct additive offsets, never close multipliers of one seed —
        // those correlate, and the scatter comes out as a bar.
        float grit = position.x * 31.7 + position.y * 57.1 + position.z * 91.3;
        vec3 jitter = normalize(vec3(
          hash11(grit * 91.7 + 3.1) - 0.5,
          hash11(grit * 57.3 + 11.7) - 0.5,
          hash11(grit * 33.9 + 27.3) - 0.5
        ) + vec3(0.001, 0.002, 0.003));
        float speed = 0.35 + hash11(grit * 12.7 + 5.5) * 1.0;
        // Eased in, so a petal comes apart from where it is going rather than
        // bursting: the grains leave it slowly and pick up.
        float loosen = breakRaw * breakRaw * (2.0 - breakRaw);
        offset += jitter * loosen * uBloomScatterDistance * uBloomScale * speed;
        // Loose particles never quite settle.
        offset += jitter * sin(uTime * 0.7 + grit) * 0.012 * uBloomScale;
        alpha *= 1.0 - ramp(0.25, 1.0, breakRaw);
      }

      pos = head + offset;
    }
  } else if (iris) {
    // Drawn in from far out, each particle on its own seeded line, and in its
    // own time — inner fibres first, so the ring grows outward rather than
    // switching on. Square in the camera's basis: this one is looked at, not
    // stood in the world like the plants are.
    float delay = aSpin;
    float gathered = clamp((uIris - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);
    float ease = gathered;
    vec3 drift = vec3(
      hash11(aSeed * 71.3 + 2.9) - 0.5,
      hash11(aSeed * 43.7 + 13.1) - 0.5,
      hash11(aSeed * 97.1 + 29.7) - 0.5
    );
    // It turns, slowly and for ever — this figure has no scroll left to drive
    // it, so its motion has to come off the clock.
    float ci = cos(uIrisTurn);
    float si = sin(uIrisTurn);
    vec3 turned = vec3(
      position.x * ci - position.y * si,
      position.x * si + position.y * ci,
      position.z
    );
    vec3 local = turned
      + normalize(drift + vec3(0.001, 0.002, 0.003)) * (1.0 - ease) * uIrisGather;
    // And breathes: each fibre drifts along itself, so the strands crawl the way
    // the reference's do rather than standing still.
    float pulse = sin(uTime * 0.6 + aSeed * 40.0);
    local += turned * pulse * 0.012 * ease;
    local.z += cos(uTime * 0.45 + aSeed * 23.0) * 0.01 * ease;

    pos = uIrisCenter
      + uBloomRight * local.x * uIrisScale
      + uBloomUp * local.y * uIrisScale
      + uBloomForward * local.z * uIrisScale;
    alpha = ramp(0.0, 0.3, gathered) * uIrisGain;
  } else if (dust) {
    // Motes hanging in the air, drifting across frame and wrapping round. They
    // sit well outside the depth of field, so they read as soft bokeh.
    pos.x = mod(pos.x + uTime * uDustSpeed + uDustSpan, uDustSpan * 2.0) - uDustSpan;
    pos += snoise3(pos * 0.35 + vec3(uTime * 0.05)) * 0.05;
    alpha = 0.7 * ramp(0.0, 0.3, grown);
  } else {
    if (stem) {
      // Elongation: the stem scales away from its base, so nothing pops in.
      pos = uStemBase + (pos - uStemBase) * stemLength;
      // Denser while short, so compressing it does not make it glare.
      alpha = mix(0.45, 1.0, stemPhase);
    } else if (pollen) {
      // Adrift around the head: a slow orbit of its own, plus a noise wander.
      // All of it off the clock, so the air round the plant is never still.
      //
      // The offset is taken from the head's **baked** centre and re-hung on
      // where the head is *now*, so the cloud rides the bud up the stem. Measured
      // against the moving centre instead — which it was — the shell inflates
      // and slides as the plant grows, and the pollen is left behind in the air
      // the plant used to be in. It tightens with the bud, too.
      // It turns **with the head**, plus a drift of its own: the plant and the
      // air around it are one thing, and pollen orbiting the other way reads as
      // a separate effect layered on top.
      vec3 orbit = rotateY(
        position - uHeadCenter,
        uTime * (uSpin + uPollenSpin * aSpin)
      );
      orbit *= mix(uPollenClose, 1.0, grown);
      orbit += snoise3(orbit * 0.9 + vec3(0.0, 0.0, uTime * 0.25)) * uPollenDrift;

      pos = headNow + orbit;
      // Mote by mote, over the whole growth — the air fills as the plant does.
      // Arriving together, at a third of the way in, they read as a layer
      // switched on rather than as something gathering.
      float wake = hash11(aSeed * 13.9 + 2.3) * 0.75;
      alpha = ramp(wake, wake + 0.25, grown);
    } else {
      // The head turns on the stem as it goes.
      vec3 headOffset = rotateY(pos - uHeadCenter, uTime * uSpin);

      // The lattice turns with the scroll, each band at its own rate. The rate
      // is per *structure*, not per particle — see aSpin in the geometry.
      if (aSpin != 0.0) {
        headOffset = rotateY(headOffset, uLatticeSpin * aSpin);
      }

      // The outer florets open last: a wave runs out from the receptacle.
      float radial = clamp(length(headOffset) / max(uHeadRadius, 0.001), 0.0, 1.4);
      float delay = radial * 0.22 + hash11(aSeed * 5.3) * 0.07;
      // Linear, so the head opens at a steady rate for the whole of the growth
      // rather than springing open early and then waiting.
      float open = clamp((openRaw - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);
      float headScale = mix(uBudScale, 1.0, open);

      pos = headNow + headOffset * headScale;
      // A closed bud packs the same particles into a fraction of the area, so
      // without this it would read as a hot white bead.
      alpha = mix(uBudAlpha, 1.0, pow(clamp(open, 0.0, 1.0), 1.25));
    }

    /* **One sway as it comes up** — and nothing else moves it. uWind is
       where the swing has the top of the stem, signed, and zero once it has
       come to rest (see DandelionScene.update); the first scroll takes it
       away. The head is the thing being read once the reader is moving.

       The stem bends as a rod fixed at its base does: carried sideways by the
       square of the height up it, so the foot stays planted and the top goes
       furthest. The head rides the top of the stem and tips with it — turned
       to the stem's slope there, 2A/H — rigidly, hairs and all: one body
       swaying, not a cloud shaking. */
    if (uWind != 0.0) {
      float carry = uWind;
      vec3 rise = headNow - uStemBase;
      float span = max(length(rise), 0.001);
      vec3 up = rise / span;
      vec3 downwind = normalize(vec3(1.0, 0.0, 0.35));
      downwind = normalize(downwind - up * dot(downwind, up));
      if (stem) {
        float h = clamp(dot(pos - uStemBase, up) / span, 0.0, 1.0);
        pos += downwind * carry * h * h;
      } else {
        vec3 hinge = normalize(cross(up, downwind));
        vec3 rel = rotateAxis(pos - headNow, hinge, atan(2.0 * carry / span));
        pos = headNow + downwind * carry + rel;
      }
    }
  }

  // ── Everything blows apart as the camera reaches the core ─────────────────
  // **Three clocks, because three things have to happen at different times.**
  // The camera flies *at* the core, *through* the rings, and the pappus is the
  // thing it is inside for the whole pass. On one schedule you always lose one
  // of them: the core is still a hard bead when the camera lands on it, or the
  // rings have gone before it arrives among them.
  float leaving = glow
    ? uGlowScatter
    : lattice ? uPatternScatter : uScatter;
  // **The head loosens before it leaves.** A pappus that is perfectly solid
  // right up to the moment it blows apart reads as a prop. This is a separate,
  // much smaller quantity on its own ramp — a little drift and a little less
  // light — running while the camera is still on its way in. Borrowing the
  // scatter's ramp for it instead would blow the head apart before the camera
  // was inside it, because that one is sized to clear the frame.
  if (uThin > 0.0 && !bloom && !iris && !glow && !lattice) {
    vec3 loosen = normalize(vec3(
      hash11(aSeed * 17.3 + 1.7) - 0.5,
      hash11(aSeed * 29.1 + 9.3) - 0.5,
      hash11(aSeed * 41.9 + 23.1) - 0.5
    ) + vec3(0.0001, 0.0002, 0.0003));
    pos += loosen * uThin * uThinDrift * (0.4 + hash11(aSeed * 7.7 + 3.3));
    alpha *= 1.0 - uThin * uThinFade;
  }

  if (leaving > 0.0 && !bloom && !iris) {
    vec3 away = pos - uHeadCenter;
    float reach = length(away);
    vec3 seeded = normalize(vec3(
      hash11(aSeed * 1.31) - 0.5,
      hash11(aSeed * 2.97) - 0.5,
      hash11(aSeed * 5.73) - 0.5
    ) + vec3(0.0001, 0.0002, 0.0003));
    // A particle sitting on the centre has no outward direction of its own, and
    // nudging the vector before normalising sends every one of them the same
    // way — a clump that reads as a streak. Give those a seeded direction.
    vec3 dir = reach > 0.001 ? away / reach : seeded;
    // **And mix a seeded direction into every one of them.** A purely radial
    // scatter is an expansion about the centre: anything that is already a line
    // through the centre — a spoke, a rib, the core's own axis — stays exactly
    // that line, just longer, and hangs in the frame as a razor streak long
    // after everything around it has turned to haze.
    dir = normalize(dir + seeded * 0.5);
    float speed = 0.55 + hash11(aSeed * 2.71) * 1.1;
    // **The core frays rather than bursting.** Every particle of it leaves on
    // its own delay inside the window, and travels a fraction of the distance
    // the pappus does: a bright, tight thing that all goes at once reads as a
    // flashbulb, however long you give it.
    float held = glow ? hash11(aSeed * 3.17 + 5.9) * uGlowStagger : 0.0;
    float gone = clamp((leaving - held) / max(1.0 - held, 0.001), 0.0, 1.0);
    pos += dir * gone * uScatterDistance * (glow ? uGlowReach : 1.0) * speed;
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  float viewDistance = max(-mvPosition.z, 0.001);

  // Depth cue: the back of the head sits behind the front of it, and additive
  // blending has no depth test to say so. A wide range is what gives the ball
  // its volume — flatten it and the head reads as a printed disc.
  float cue = smoothstep(-uHeadRadius, uHeadRadius, mvPosition.z - uHeadViewZ);
  // Biased so the far half falls away quickly. Additive blending gives no
  // occlusion at all, so this curve is standing in for everything the near
  // fluff would otherwise hide.
  // Faded out as the camera enters the head: the cue reads "further from the
  // viewer = darker", which is right from outside and nonsense from within,
  // where everything ahead counts as the far side and the whole interior goes
  // black. uDepthMix carries the camera's distance to the centre.
  float depth = mix(1.0, mix(uDepthBack, uDepthFront, pow(cue, 1.55)), uDepthMix);

  // The flower gets its own depth cue, measured against its own centre and its
  // own thickness. It is what gives the dandelion its volume, and without it a
  // tilted rosette is a flat pattern with a perspective outline.
  if (bloom) {
    float bloomCue = smoothstep(
      -uBloomDepth,
      uBloomDepth,
      mvPosition.z - uBloomViewZ
    );
    depth = mix(uBloomBack, uBloomFront, pow(bloomCue, 1.3));
  }

  // Depth of field, the cheap way: a sprite away from the focal plane spreads
  // over more pixels and dims by the same area, so its total energy is
  // preserved and it reads as defocused rather than faded. This is most of
  // what makes the head look photographed instead of rendered.
  float blur = pow(clamp(abs(viewDistance - uFocus) / uDofRange, 0.0, 1.0), 1.3);
  float spread = 1.0 + blur * uDofSpread;

  // uPerspective tracks the fly-through's own camera distance. The flower is
  // not part of that journey — it sits at a fixed distance of its own — so its
  // grain is fixed too, and moving the flower nearer or further changes how big
  // it is in frame without changing how coarse it is.
  float persp = iris ? uIrisGrain : bloom ? uBloomPerspective : uPerspective;
  float perspective =
    uSize * aSize * uPixelRatio * (persp / viewDistance) * spread;
  // The perspective term is 1/distance, so a particle the camera is flying
  // through resolves to a sprite the size of the screen. A few of those and the
  // fill cost of one frame is larger than the whole scene's.
  float pixels = clamp(perspective, uMinSize * uPixelRatio, uMaxSize * uPixelRatio);
  float clampCompensation = (perspective / pixels) * (perspective / pixels);

  vColor = palette(aType);
  // The pappus is warm-white at the middle and cools to blue at the rim, which
  // is what the light does through a head this deep — and it ties the dandelion
  // to the flower that replaces it.
  if (aType < 0.5) {
    float rim = clamp(length(position - uHeadCenter) / max(uHeadRadius, 0.001), 0.0, 1.0);
    // A **band**, not a falloff. A power curve gives a wash with no boundary in
    // it anywhere; this puts the change at uEdgeAt and lets uEdgeWidth say how
    // hard it lands.
    vec3 seeded = mix(
      uColorFluff,
      uColorFluffEdge,
      ramp(uEdgeAt - uEdgeWidth, uEdgeAt + uEdgeWidth, rim)
    );
    // And it comes up **yellow**: the head is a flower before it is a clock, so
    // the whole thing whitens as it grows.
    vColor = mix(uColorFluffYoung, seeded, ramp(0.2, 0.9, uGrowth));
  }

  // Level of detail. Every particle carries the point in the approach at which
  // it starts being drawn: the coarse lattice is there from the start, the
  // filigree arrives as the camera closes in, so the interior keeps resolving
  // instead of arriving all at once.
  // carries a positive value, so only the lattice resolves progressively.
  // The flower carries a petal id in aDetail rather than a detail threshold, so
  // it is exempt: only the lattice resolves progressively.
  if (!bloom && aDetail > 0.0) alpha *= ramp(aDetail, aDetail + 0.22, uDetail);
  // The rings belong to the inside of the head. They have no business being
  // legible through the pappus from across the frame — they arrive with the
  // zoom, as the camera closes far enough to be looking into the head, and
  // **one structure at a time**: aTone carries which one this is, so a band
  // comes in whole rather than the whole cage fading up together.
  if (lattice) {
    float due = aTone * (1.0 - uLatticeStagger);
    alpha *= ramp(due, due + uLatticeStagger, uLattice);
  }
  // The core burns brighter the closer the camera gets.
  if (glow) alpha *= uGlowGain;

  if (bloom) {
    // Lit faces pale, creases and throats deep.
    // Three stops, not two: most of a petal should stay blue, with the pale
    // only at the rim. A single mix weighted toward the light end washes the
    // whole flower out to silver; weighted toward the dark end it disappears
    // into the backdrop.
    vec3 petalMid = mix(uColorPetalDeep, uColorPetalLight, 0.42);
    vec3 petal = aTone < 0.62
      ? mix(uColorPetalDeep, petalMid, aTone / 0.62)
      : mix(petalMid, uColorPetalLight, (aTone - 0.62) / 0.38);
    vColor = aTone > 1.5 ? uColorBloomStem : petal;
  }

  if (iris) {
    // **Light at the rim, nothing at the pupil.** A fibre's place across the
    // iris runs 0 at the pupil's edge to 1 at the outer rim. Inward it goes
    // out, so the figure is a ring of light closing on the dark rather than a
    // grey disc with a hole cut in it. Outward it takes a colour: a soft
    // gradient across the figure from lime at the top left to sky at the bottom
    // right, laid in the frame rather than on the fibres, so it stays put as the
    // iris turns — the way light falling on it would.
    float irisR = length(position.xy);
    float across = clamp((irisR - uIrisPupil) / max(1.0 - uIrisPupil, 0.001), 0.0, 1.0);
    alpha *= mix(0.04, 1.0, smoothstep(0.0, 0.9, across));
    float ci = cos(uIrisTurn);
    float si = sin(uIrisTurn);
    vec2 onFrame = vec2(
      position.x * ci - position.y * si,
      position.x * si + position.y * ci
    );
    float sweep = clamp(0.5 + 0.5 * dot(onFrame, normalize(vec2(-0.6, 1.0))), 0.0, 1.0);
    vec3 rim = mix(uColorIrisSky, uColorIrisLime, sweep);
    vColor = mix(vColor, rim, smoothstep(0.3, 1.0, across) * 0.9);
  }

  // The close-up exposure is the plant's; the flower and the iris carry their
  // own, because they are not on that journey.
  /* **Under the hand it lights up.** One multiplier on the brightness of the
     plant itself, so the whole of it comes up together — hairs, seeds, stem and
     the core with them — rather than some part of it being picked out. The air
     around it is left alone: the dust belongs to the room, and the flower
     catching the light while the room does not is the difference between the
     plant answering and the scene doing something. */
  float lit = 1.0 + uTouch * uTouchLit * ((dust || bloom || iris) ? 0.0 : 1.0);

  float exposure = (bloom || iris) ? 1.0 : uInsideGain;
  vBrightness =
    uIntensity * exposure * aShade * depth * alpha * clampCompensation * lit
      / pow(spread, 1.7);
  // The blackout clears the old scene away; it must not take the flower — or the
  // iris that follows it — with it.
  if (!bloom && !iris) vBrightness *= uFade;

  /* A point that adds exactly nothing is not rasterised. Additive blending
     makes a zero-brightness sprite a no-op on the frame, but it still cost its
     whole square of fragments — and on most stages a large share of the cloud
     is at exactly zero (the bloom's points before the flower opens, the old
     plant after the blackout). Only an exact zero: a dim point still counts,
     because thousands of them overlap. */
  if (vBrightness <= 0.0) {
    gl_PointSize = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  gl_PointSize = pixels;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const dandelionFragmentShader = /* glsl */ `
precision highp float;

in vec3 vColor;
in float vBrightness;

out vec4 fragColor;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float mask = smoothstep(0.5, 0.0, d);
  mask *= mask;

  fragColor = vec4(vColor * vBrightness * mask, 1.0);
}
`;

/**
 * Final tone curve, `c = 1 − exp(−c · exposure)`, then the sRGB transfer
 * function — a raw `ShaderMaterial` writing to the default framebuffer gets no
 * colour-space conversion from three, so it is done here.
 */
export const toneCurveShader = {
  name: "DandelionToneCurve",
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.15 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    varying vec2 vUv;

    vec3 toSRGB(vec3 c) {
      return mix(
        c * 12.92,
        1.055 * pow(max(c, vec3(0.0)), vec3(0.4166666667)) - 0.055,
        step(vec3(0.0031308), c)
      );
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color = 1.0 - exp(-color * uExposure);
      gl_FragColor = vec4(toSRGB(color), 1.0);
    }
  `,
};
