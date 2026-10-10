// 2026-10-10 대표 「모바일웹 = Flora 그대로」: Flora 원본 src/data/mocks/home.ts 의 장면 값(homeHeroLook · homeHeroScene)을 그대로 옮겼다.
// 바꾼 것: 날아가는 카드(cards · Stemline 숫자) 제외. 나머지 숫자는 한 글자도 바꾸지 않았다.
import type { DandelionSceneConfig } from "./dandelion/dandelion-scene";

export const homeHeroLook = {
  /* The halo. `strength` is how much of it, `radius` how far it spreads,
     `threshold` how bright a particle must be to earn one. */
  /* The threshold has to sit **below** what the scene's particles actually reach,
     or `strength` has nothing to act on and the knob feels dead — which is how
     0.5 felt against a head whose particles sit around 0.3–1.5. */
  bloom: { strength: 0.75, radius: 0.7, threshold: 0.14 },
  /* The halo is computed at this height whatever the viewport is, so it scales
     with the flower instead of with the window. See `bloomSize()`. */
  bloomHeight: 620,
  /* The whole scene's brightness, through the tone curve. */
  exposure: 1.45,
  /* Tuned at this drawing-buffer height; brightness scales with the square of
     the ratio to it, so a 4K screen renders the same image finely rather than a
     darker one. See `resolutionFactor()`. */
  referenceHeight: 900,
  /* Where the plant sits across the frame, in half-widths of it. Positive is
     right of centre; it goes to nothing on its own as the camera closes. */
  frameOffsetX: 0.3,
  /* How much of the rings' arrival one structure takes. Small: the rest of the
     ramp is the queue of structures behind it, so they come in one by one. */
  latticeStagger: 0.14,
  /* Where the pappus turns from white to blue, as a fraction of the head's
     radius, and how hard that boundary lands. A narrow width is a crisp edge. */
  fluffEdgeAt: 0.93,
  fluffEdgeWidth: 0.04,
  /* The core frays rather than bursting: how far apart its particles leave, and
     how far they travel next to the pappus. */
  glowStagger: 0.65,
  glowReach: 0.4,
  /* Motes adrift around the head. `pollenClose` is how tightly the cloud hugs
     the bud before the plant has grown — it rides the head up the stem. */
  pollenParticles: 1_300,
  pollenDrift: 0.09,
  pollenSpin: 0.12,
  pollenClose: 0.3,
  /* The head loosening on the way in: how far its particles drift, and how much
     light that costs. Small on purpose — this is not the scatter. */
  thinDrift: 0.16,
  thinFade: 0.45,
} as const;

/**
 * The gradient behind the flower — **Kindle**: a fire front creeping across a
 * field, char behind it, an ember line, licks above.
 *
 * Colours are **not** here: they are design tokens (`--scene-field-*`), read at
 * construction. Everything below is shape and pace.
 */

export const homeHeroScene: DandelionSceneConfig = {
  /* Kept close together on purpose: the tiers should differ in cost, not in
     composition. See ADR-0028. */
  particleCount: {
    desktop: 780_000,
    tablet: 580_000,
    mobile: 420_000,
  },
  referenceCount: 780_000,
  seedCount: 330,
  hairsPerSeed: 18,
  headRadius: 1,
  headCenter: [0, 0.75, 0],
  stemBottom: [0.46, -3.4, 0],
  stemRadius: 0.034,
  stemBow: 0.26,
  dustSpan: 3.6,
  dustSpeed: 0.05,
  /* Absolute count: sparse, individually countable things must not thin with
     the tier, or a phone shows a different composition. */
  dustParticles: 3_400,
  /* The lattice the camera flies through — see the journey below. */
  patternShare: 0.17,
  patternRadius: 0.46,
  /* The core the camera flies at. */
  glowParticles: 26_000,
  glowRadius: 0.16,
  glowGain: 3.2,
  /* The flower that opens once the core has gone — see the reference in the
     scene note. Its geometry is local to the camera's plane. */
  flower: {
    share: 0.36,
    /* One spiral of petals at the golden angle — see the scene note. */
    petals: 26,
    length: 1.05,
    width: 0.26,
    /* Outermost petal → innermost. All four run monotonically, which is what
       keeps the petals a stack instead of a tangle. */
    innerScale: 0.26,
    /* Small on purpose: the petals converge on the heart of the flower, where
       the stem arrives. A wide attachment ring leaves a hole there, and it also
       makes the closed bud squat — the bud's width is the attachment radius and
       the petal's half-width in quadrature. */
    attachOuter: 0.1,
    attachInner: 0.02,
    bendOuter: -0.05,
    bendInner: 1.0,
    stack: 0.34,
    scale: 0.42,
    /* Just past a right angle, but no further than the attachment radius
       allows: past that the tips lean back over the axis and out the far side. */
    /* Just past vertical, and capped by the attachment radius: past
       acos(-attachOuter / (length x budTighten)) the tips lean back over the
       axis and out the far side of the flower. */
    foldAngle: 1.74,
    /* Still a little raised when open, so the flower is a cup, not a plate. */
    openFold: 0.36,
    /* Kept small: the petals unwind as the bud opens, and a wide sweep takes
       each one past its neighbours on the way. */
    twist: 0.3,
    /* Pitched most of the way back to the vertical: we look at this flower from
       the side, on its stem, the way we look at the dandelion. */
    tilt: 1.02,
    /* The closed bud stands a little more upright, and the head nods toward the
       viewer as it opens. Keep the two close: a wide swing turns the silhouette
       over mid-opening, and the flower reads as closing rather than opening. */
    budTilt: 1.16,
    /* The whole flower's turn in its own face plane. */
    roll: 0.2,
    /* How far a petal's section rolls about its own spine — one sign for every
       petal, or each one's margin turns into its neighbour's and they cross. */
    petalRoll: 0.22,
    grain: 0.72,
    /* Its own exposure, since it no longer rides the fly-through's. */
    exposure: 3.4,
    /* Turns on its own axis between arriving and the end of the scroll. Just
       over half of one: the petals inherit this on their way out, and at more
       than that the departure is spinning before it has begun. */
    spinTurns: 0.55,
    scatterDistance: 4.2,
    /* The ending: whole petals sail off and tumble for the first 55 %, then
       break into particles for the rest. Keep `flyDistance` short enough that a
       petal is still in frame when it breaks, or the second stage happens
       offscreen and the flower just disappears. */
    /* Petals let go one at a time over this much of the ending, outermost
       first. `stagger + breakPoint` has to stay clear of 1, or the last petals
       never finish breaking up. */
    stagger: 0.45,
    breakPoint: 0.38,
    /* The heart gives way first and the stem follows it down, so the plant
       comes apart from the top. The heart does not fly with the petals — it is
       the socket they sat in. */
    heartBreak: 0.06,
    flyDistance: 2.1,
    /* A slow flutter about the petal's own short axis — under half a turn over
       the whole flight. It was most of a turn, about a random axis, on top of
       the swirl and the flower's own spin. */
    tumble: 0.8,
    /* Radians a petal is carried round the flower's axis over its flight. About
       a sixth of a turn: enough that the group swings as it leaves, far short of
       a whirlpool. The radius accelerating under it is what makes the departure
       smooth; the angle does not have to be large to read. */
    vortex: 1.0,
    /* And it sinks as it drifts out. Without this the petals radiate like a
       firework, which is the one thing a falling petal never does. */
    fall: 0.5,
    /* Nothing in this scene is ever still: these keep it turning with the scroll
       standing still. They are in scene time, so `timeScale` scales them. */
    idleDrift: 0.07,
    idleSpin: 0.16,
    stemLength: 1.9,
    stemRadius: 0.042,
    stemShare: 0.42,
    lift: 0.12,
    budTighten: 0.52,
    depth: 0.9,
    depthBack: 0.42,
    depthFront: 1.55,
  },
  /* The iris that gathers out of the dark once the flower has gone — the last
     figure of the scroll. Its radii are in its own units, where the fibres
     reach 1. */
  iris: {
    share: 0.24,
    pupil: 0.38,
    rim: 0.07,
    scale: 0.5,
    /* Far enough out that they arrive rather than fade up on the spot. */
    gather: 2.4,
    /* Big enough that a sprite clears `minPointSize` on its own. Below it the
       clamp kicks in, the compensation term squares the shortfall, and the whole
       figure comes out several times too dim. */
    grain: 2.4,
    gain: 3.9,
    idleSpin: 0.12,
  },
  /* The focal plane sits just in front of the head centre, so the near bristles
     are sharp and both the far side and the foreground go soft. */
  focusOffset: 0.55,
  dofRange: 1.2,
  dofSpread: 3.0,
  depthBack: 0.14,
  depthFront: 1.5,
  pointSize: 2,
  minPointSize: 1,
  maxPointSize: 42,
  glowDensity: 1,
  /* Brushed by the pointer: the stem bends off the hand and the plant
     brightens. `reach` is in head radii, so the target is the plant's own size
     on screen rather than a fixed patch of it, and the rest is the stem's own
     physics — see obsidian/frontend/dandelion-scene.md. */
  touch: {
    reach: 1.9,
    /* How much brighter it is under the hand. Enough to notice, well short of
       picking the flower out of its own night. */
    lit: 0.5,
  },
  /* One sway as the plant comes up on load, and only then: out, back, and
     still at the centre. Gone for good the moment the reader scrolls. */
  wind: {
    /* Scale of the swing at the top of the stem, world units. The first
       swing out reaches about three fifths of it. */
    bend: 0.75,
    /* One full swing, there and back: slow, a tall stem in still air. */
    period: 3.8,
    /* How fast it dies: out, back by about two fifths, a trace out, at rest. */
    settle: 2.0,
    /* How long the push takes to come on. Long and C2-smooth, so the swing
       gathers rather than starts. */
    onset: 1.1,
  },

  /* The head turns on its stem for ever — the whole of it, rings and core
     included, and the pollen with it. */
  spinSpeed: 0.16,
  timeScale: 0.45,
  /* The plant grows in on load: the stem rises carrying a shut bud, the bud
     holds, and opens (`growthStemShare`, `growthOpenAt`).
     Long enough that the opening lands after the keyhole has opened on it —
     at 2.8 s the keyhole opened at 73 % of the growth and was gone at 90 %. */
  growthDuration: 3.8,
  /* The stem brings a shut bud up into the frame over the first 80 % of the
     growth, and the bud opens from 30 % to the end — overlapping, so it reads
     as a bud growing open rather than rise, pause, open (which the first cut
     at 60 % / 45 % did, and was reported as stepped). (It used to be
     stem and head together across the whole of it, and the bud was never
     seen: it was below the frame until it was already opening.) */
  growthStemShare: 0.8,
  growthStartLength: 0.18,
  budScale: 0.18,
  growthOpenAt: 0.3,
  /* A shut bud is the same particles in a fraction of the space, so it keeps
     less of its light — but enough to be seen: at 0.035 it was invisible, and
     the growth read as a flower appearing rather than a bud opening. */
  budAlpha: 0.2,
  /* The scroll: the camera orbits the flower through a half turn, dives through
     the head and out the far side, the frame fades to black, a flower opens and
     comes apart in a vortex, and an iris gathers in the dark. The stage is six
     viewports tall — see views/home/hero.tsx. */
  /* The readings that leave with the petals — Figma "РАЗЛЁТ 25/50/75/100 %"
     (4369:743, 4369:840, 4369:937, 4354:6698). Every number is read off those
     four frames: the middle of the card's box, the card's own width there, how
     far it is turned, how far out of focus, and how much ink it is given. The
     height is what is left of the box once the turn is taken out of it — the
     design re-sets a card between frames rather than scaling it, so its
     proportions are its own at each one. `type` is its setting at the last
     frame, which is the one it is drawn at. The scene flies it between those
     readings through space — see src/lib/scene/dandelion/fly-cards.ts. */
  /* 연결 시안: 카드 글은 ECHO 설명용 단어(대표 지시 §8 · 실제 추천처럼 보이는 이름·점수 0). 원본: ETH 값·Relay 번호. */
  // 날아가는 숫자 카드(cards)는 넣지 않는다 — Stemline 의 ETH 금액·릴레이 숫자이고(가짜 수치 금지), 앱은 꽃이 흩어지는 단계까지 가지 않는다.
  journey: {
    /* Half a turn, over the **orbit** leg only — the dive that follows goes
       straight, which is what makes it read as a dive. */
    turnDegrees: 180,
    travelStart: 0.0173,
    /* The orbit takes a quarter of the stage and closes only as far as
       `orbitDistance`, which is still outside the pappus: the whole plant stays
       in frame while it turns, and the zoom is slow. */
    orbitEnd: 0.218,
    orbitDistance: 2.4,
    /* The dive: from `orbitDistance` straight through and out. The camera is
       inside the pappus from about 0.37, among the rings by 0.39, past the
       centre at 0.41 and out the far side by 0.46. */
    travelEnd: 0.4118,
    /* **Negative**: the camera comes out the far side rather than parking
       nose-against the core, so the rings sweep by and fall behind. */
    endDistance: -1.8,
    fadeStart: 0.4533,
    fadeEnd: 0.5917,
    insideFocus: 0.55,
    insideDofSpread: 1.6,
    insideGain: 3.5,
    /* The filigree resolves over the approach, so the interior keeps gaining
       detail as the camera closes in rather than arriving all at once. */
    /* The backdrop is a colour at the start and black by the time the camera is
       among the rings: the interior is lit by the scene, not by the room. */
    darkenStart: 0.0208,
    darkenEnd: 0.1903,
    /* The plant is off-centre in the opening composition and centred by the
       time the zoom starts — the camera has to fly into the middle of the frame. */
    centreStart: 0.0277,
    centreEnd: 0.1176,
    /* The rings arrive with the zoom, not from across the frame… */
    latticeStart: 0.0484,
    latticeEnd: 0.218,
    /* …and their filigree resolves as the camera closes the rest of the way. */
    detailStart: 0.1246,
    detailEnd: 0.2872,
    /* The head loosens long before it leaves. */
    thinStart: 0.1765,
    thinEnd: 0.4256,
    latticeTurns: 0.85,
    latticeIdle: 0.16,
    /* The core dissolves slowly, finishing with the stem… */
    glowScatterStart: 0.1488,
    glowScatterEnd: 0.564,
    /* …the pappus and the stem go once the camera is out the far side… */
    scatterStart: 0.4256,
    scatterEnd: 0.564,
    /* …and the rings last of all, so they are whole for the whole pass. */
    patternScatterStart: 0.4256,
    patternScatterEnd: 0.5917,
    scatterDistance: 9,
    /* The flower starts from the dark the dandelion leaves — the stem screen's
       last third, not after it — and finishes opening exactly where it did,
       as the ETH screen hands over. Starting earlier on the same end is a
       longer, slower growth, not a later bloom. */
    bloomStart: 0.44,
    bloomEnd: 0.7024,
    /* The flower keeps turning, then comes apart into the dark — whole petals
       first, loose particles after. */
    /* The ending gets nearly a third of the stage. The petals have a spiral to
       describe and then a break to play out, and both were being rushed. */
    flowerScatterStart: 0.7163,
    /* The petals are gone with a tenth of the stage to spare: the iris has to
       gather in the dark they leave, and the closing screen reads against a
       whole one, not one still forming. */
    flowerScatterEnd: 0.8754,
    /* And the iris gathers in the dark it leaves behind. */
    irisStart: 0.8754,
    irisEnd: 0.9446,
  },
  ...homeHeroLook,
  fov: 40,
  /* The pointer tilt: radians at the edge of the viewport. Small — it is a
     breath of parallax, not a camera control. */
  pointerTilt: { yaw: 0.055, pitch: 0.04, roll: 0.022 },
  cameraDistance: 5.4,
  /* Raised: the camera looks above the head's centre, so the plant sits lower
     in the opening composition. */
  cameraTarget: [0, 0.55, 0],
  framingRadius: 1.35,
};
