/**
 * Placeholder content and scene parameters for the home page.
 *
 * Components take everything through props — this is the only place the values
 * live, so replacing the copy or retuning the flower never means editing a
 * component. 📖 obsidian/frontend/component-conventions.md → "Data rules"
 */

import type { DandelionSceneConfig } from "@flora/lib/scene/dandelion/dandelion-scene";
import type { BackdropConfig } from "@flora/lib/scene/backdrop/backdrop-gradient";

export interface NavLink {
  label: string;
  href: string;
}

export interface HeroNavContent {
  brand: string;
  links: NavLink[];
  connect: NavLink & { count: string };
  /**
   * What the menu button opens on the narrow frames. The five links above are
   * the menu's own list; this is only what the list does not already carry —
   * the call to action, and the places the site keeps outside itself.
   */
  menu: { cta: NavLink; social: NavLink[] };
  /** Stage progress over which the header goes — "07 Connect" has none. */
  leave: [number, number];
}

export interface HeroPanelContent {
  title: string;
  status: string;
  /** Rendered as written — the hex and the units are not upper-cased copy. */
  broadcast: string;
  age: string;
  hop: string;
  stats: string;
}

/**
 * A screen's stretch of the stage, in scroll progress (0 → 1 over the whole
 * flight). Both frames of the design are moments of the one camera move, so
 * this is how they take their turns — and the numbers are set against the
 * scene's own journey below, not against a clock.
 */
export interface ScreenWindow {
  /** Omitted for the screen that is already on when the page opens. */
  enter?: [number, number];
  leave: [number, number];
}

export interface MigrationContent {
  /** Which of the design's column pairs the screen is set in. */
  layout: "leak" | "stem" | "integrate";
  /** Copy already settled top left — a screen that captions rather than moves. */
  settled?: string;
  /**
   * The rest of it, in the pieces it travels in: one line of the waiting
   * stack each. They leave that stack in order and join the settled text.
   */
  phrases: string[];
  /** Stage progress over which all of them make the trip; absent: none do. */
  run?: [number, number];
  /**
   * For a screen whose copy arrives and leaves **on the scroll** rather than
   * on a timer: the stretch its words and letters land over, and the stretch
   * they take themselves back over — the arrival run backwards.
   */
  scrub?: { arrive: [number, number]; depart: [number, number] };
  /** How deep the screen's bands are — the frame behind decides. */
  scrim: "veil" | "haze";
  window: ScreenWindow;
}

export interface FluffContent {
  /** Eleven values a column, in the order the design lists them. */
  left: string[];
  right: string[];
  /** The line the beam splits: what falls left of it, and what falls right. */
  split: [string, string];
  /** Stage progress over which the columns turn one full loop. */
  run: [number, number];
  window: ScreenWindow;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface ConnectContent {
  /** Three lines, the middle one stepped in. A capital S marks a swash.
      연결 시안: 두 마디 문장은 두 줄(세 번째 줄 생략 가능 — 대표 지시 「두 문항이면 두 줄」). */
  headline: [string, string, string?];
  lead: string;
  cta: NavLink;
  columns: FooterColumn[];
  /** The copyright line, as it is set. */
  mark: string;
  legal: NavLink[];
  window: ScreenWindow;
}

export interface HeroContent {
  /**
   * The page's `h1`, set two lines as the design breaks it. A capital S marks
   * a swash — see `SwashText`.
   */
  headline: [string, string];
  lead: string;
  cta: NavLink;
  nav: HeroNavContent;
  panel: HeroPanelContent;
  window: ScreenWindow;
  leak: MigrationContent;
  stem: MigrationContent;
  integrate: MigrationContent;
  connect: ConnectContent;
  fluff: FluffContent;
}

/**
 * The preloader — Figma 4264:3434 / 3446 / 3458. The sentence the page opens
 * on while it is still closing, and the three marks along the bar under it.
 */
export interface PreloaderContent {
  lines: readonly string[];
  /** Bottom left, and bottom centre — the centre goes on the narrow frames. */
  mark: string;
  note: string;
  /** What the counter is doing: "CLOSING 08%". */
  status: string;
}

export const homePreloader: PreloaderContent = {
  lines: [
    "Someone iS alwayS the firSt",
    "to See where a tranSaction began.",
    "Not for much longer.",
  ],
  mark: "Stemline protocol",
  note: "© 2026 · All relays independent",
  status: "Closing",
};

export const homeHero: HeroContent = {
  headline: ["Send firSt.", "Be Seen later"],
  lead: "Stemline carrieS your tranSaction along a private relay path before it ever toucheS the public mempool",
  cta: { label: "Connect a node", href: "#connect" },
  nav: {
    brand: "Stemline",
    links: [
      { label: "Protocol", href: "#protocol" },
      { label: "Network", href: "#network" },
      { label: "Docs", href: "#docs" },
      { label: "Pricing", href: "#pricing" },
      { label: "About", href: "#about" },
    ],
    connect: { label: "Connect", href: "#connect", count: "340" },
    menu: {
      cta: { label: "Connect a node", href: "#connect" },
      social: [
        { label: "Github", href: "#github" },
        { label: "X", href: "#x" },
        { label: "Discord", href: "#discord" },
      ],
    },
    leave: [0.8616, 0.9031],
  },
  panel: {
    title: "Last relay broadcast",
    status: "Live",
    broadcast: "0x7a4f · 9d2e · 41b8 · e21c",
    age: "0.4s AGO",
    hop: "Hop 3 / 4",
    stats: "340 RELAYS  ·  41 COUNTRIES  ·  +180 ms",
  },
  /* Every window below is set against the scene itself, not against the
     journey's numbers: the stage was swept frame by frame and the states the
     design asks for matched to the progress that draws them. Two of those are
     fixed points — the head centred with its rings at 0.22, where the copy
     starts, and the bud on its beam at 0.51, where the fourth screen does —
     and the two copy screens share everything in between. The opening screen
     is on from the first frame, its own backdrop being the plant at 0.03, and
     leaves while the head is still whole. */
  window: { leave: [0.0554, 0.09] },
  leak: {
    layout: "leak",
    scrim: "veil",
    phrases: [
      "You Send an amount",
      /* "and" rides along rather than travelling on its own: the settled text
         flows, so it loses nothing there, and alone it would sit as a line of
         its own in the waiting stack. */
      "to an address and",
      "the firSt node to See",
      "it learnS your city,",
      "your provider,",
      "everything you ever",
      "Sent and your name",
    ],
    /* The copy starts where the head stands centred with its rings inside —
       the frame of "02 The leak" — and takes the first share of the stretch. */
    run: [0.1765, 0.2872],
    window: { enter: [0.128, 0.1765], leave: [0.2872, 0.308] },
  },
  stem: {
    layout: "stem",
    /* Both sentences make the trip, so the screen opens on an empty column and
       fills it — the same machine the leak runs, which is what carries the
       reader across the hand-over. Figma draws the half-way state: the first
       sentence settled, the second still waiting. */
    phrases: [
      "It walkS  firSt: each",
      "relay passeS it to",
      "exactly one other,",
      "So the firSt node to",
      "See it iS never you.",
      "Four to Seven hopS,",
      "and no relay can tell",
      "whether it iS talking",
      "to the Sender or to",
      "another relay.",
    ],
    scrim: "haze",
    /* It opens on the last of the golden field and carries the rest of the
       stretch, finishing in hand before the bud arrives at 0.51. */
    run: [0.3356, 0.5017],
    window: { enter: [0.3218, 0.3356], leave: [0.5017, 0.5225] },
  },
  integrate: {
    layout: "integrate",
    /* "06 Integrate" (4209:743) captions the scatter: both sides hold still
       while the flower comes apart and the cards leave with it. */
    settled: "MeaSured on mainnet over thirty dayS, not modelled.",
    phrases: ["You pay in time,", "and nothing elSe"],
    scrim: "haze",
    /* The copy is the screen's whole arrival and its whole exit, so both are
       on the scroll: it assembles over the enter window and a little past it,
       and comes apart over the leave window, last letter first. */
    scrub: { arrive: [0.7439, 0.79], depart: [0.8616, 0.9031] },
    window: { enter: [0.7439, 0.7647], leave: [0.8616, 0.9031] },
  },
  connect: {
    headline: ["Be Someone", "elSe’S", "firSt hop"],
    lead: "A relay runS  on any machine that stayS online. One command, no Stake, no permission.",
    cta: { label: "Connect a node", href: "#connect" },
    columns: [
      {
        title: "Protocol",
        links: [
          { label: "Docs", href: "#docs" },
          { label: "Spec", href: "#spec" },
          { label: "Changelog", href: "#changelog" },
        ],
      },
      {
        title: "Network",
        links: [
          { label: "Relays", href: "#relays" },
          { label: "Endpoint", href: "#endpoint" },
          { label: "Status", href: "#status" },
        ],
      },
      {
        title: "Elsewhere",
        links: [
          { label: "Github", href: "#github" },
          { label: "X", href: "#x" },
          { label: "Discord", href: "#discord" },
        ],
      },
    ],
    mark: "© 2026 Stemline",
    legal: [
      { label: "Terms of Use", href: "#terms" },
      { label: "Privacy Policy", href: "#privacy" },
    ],
    /* The scene closes on its iris (`journey.irisStart` 0.86), and the last
       screen comes up on it. */
    window: { enter: [0.9308, 0.9585], leave: [1.0, 1.0] },
  },
  fluff: {
    left: [
      "12.80 ETH",
      "340 GWEI",
      "1.05 ETH",
      "0.08 ETH",
      "88.4 ETH",
      "2.10 ETH",
      "0.55 ETH",
      "19.2 ETH",
      "0.03 ETH",
      "7.66 ETH",
      "0.91 ETH",
    ],
    right: [
      "3.42 ETH",
      "210 GWEI",
      "0.27 ETH",
      "46.9 ETH",
      "1.88 ETH",
      "0.06 ETH",
      "11.3 ETH",
      "0.74 ETH",
      "25.5 ETH",
      "0.12 ETH",
      "5.09 ETH",
    ],
    split: ["Only then does it Spread,", "from another address."],
    /* The run sets the wheel's rate and its phase: at its start every value
       sits on its own sample — the frame Figma draws — but the columns are
       already turning through the enter window and keep turning through the
       leave one. */
    run: [0.5779, 0.7024],
    window: { enter: [0.5225, 0.5779], leave: [0.7024, 0.7439] },
  },
};

/**
 * The flower. Counts are per device tier; the largest is allocated once and
 * smaller tiers draw a shuffled prefix of it (optimize-3d-scene §7).
 *
 * World units: the head is a unit sphere centred a little above the origin, the
 * stem runs out of the bottom of frame, and the camera pulls back on a narrow
 * viewport so `framingRadius` always fits.
 */
/* ─────────────────────────────────────────────────────────────────────────
   LOOK — the knobs to reach for first.

   **Colour lives in `src/app/globals.css`**, under "Dandelion palette": the
   backdrop (`--scene-backdrop`), the pappus and its blue rim (`--scene-fluff`,
   `--scene-fluff-edge`), the stem, the seeds, the gold core and the closing
   flower's blues. `src/lib/scene/tokens.ts` reads them at construction, so a
   re-theme is a CSS change and nothing else.

   Everything else that is look rather than geometry or timing is gathered here
   and spread into the scene config below.
   ───────────────────────────────────────────────────────────────────────── */
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
export const homeHeroBackdrop: BackdropConfig = {
  /* Field zoom, how fast it evolves, and how fast the front creeps across it. */
  scale: 0.585,
  speed: 0.33,
  spread: 0.07,
  /* How fast the licks climb off the ember line. */
  rise: 0.3,
  /* The fuel level the front sits at, and how thick the ember line is. A
     threshold that ramps would have to wrap, and a wrap in a fire is a seam —
     so the fuel scrolls past this instead. */
  threshold: 0.63,
  ember: 0.15,
  lick: 0.53,
  /* fBm gain and octave spacing. */
  roughness: 0.5,
  lacunarity: 1.8,
  /* Tone curve over the finished field, and how far up the ramp the unlit
     ground gives way to fire. */
  contrast: 1.5,
  midpoint: 0.85,
  sink: 0.42,
  glow: 0.95,
  /* Grain off; the dither stays, because a field this smooth bands on an 8-bit
     display without it. It is not decoration. */
  grain: 0,
  grainAnim: 0,
  dither: 1.2,
  vignette: 0.5,
  /* Fire leans toward a draught: the front bulges toward the hand, and the gap
     between the pointer's two poles gives it a wake. */
  cursor: 1,
  pointerRadius: 0.9,
  pointerStrength: 0.36,
  wake: 4,
  parallax: 0.01,
  /* A full-screen fragment shader, so the cost is quadratic in this. */
  maxDpr: 0.7,
};

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
  cards: {
    frame: { width: 1440, height: 800 },
    specs: [
      {
        value: "이야기",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 30,
          label: 14,
          padX: 25,
          padTop: 22,
          padBottom: 24,
          gap: 7,
        },
        keys: [
          {
            x: 669.21,
            y: 60.56,
            w: 181,
            h: 60.5,
            turn: 41.54,
            blur: 5.2,
            ink: 0.12,
          },
          {
            x: 495.4,
            y: 47.45,
            w: 284,
            h: 98.9,
            turn: 32.3,
            blur: 6.25,
            ink: 0.35,
          },
          {
            x: 320.85,
            y: 34.07,
            w: 386,
            h: 136.8,
            turn: 27.56,
            blur: 5.55,
            ink: 0.57,
          },
          {
            x: 263.72,
            y: 30.84,
            w: 420,
            h: 111.8,
            turn: 26.69,
            blur: 3.5,
            ink: 0.8,
          },
        ],
      },
      {
        value: "관심사",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 34,
          label: 15,
          padX: 32,
          padTop: 29,
          padBottom: 31,
          gap: 7,
        },
        keys: [
          {
            x: 775.43,
            y: 63.05,
            w: 233,
            h: 94.1,
            turn: -41.2,
            blur: 5.25,
            ink: 0.12,
          },
          {
            x: 920.79,
            y: 57.85,
            w: 365,
            h: 144.9,
            turn: -32.96,
            blur: 6.5,
            ink: 0.34,
          },
          {
            x: 1065.68,
            y: 52.89,
            w: 496,
            h: 195.3,
            turn: -28.01,
            blur: 6,
            ink: 0.56,
          },
          {
            x: 1115.38,
            y: 51.27,
            w: 540,
            h: 145.0,
            turn: -26.95,
            blur: 4,
            ink: 0.78,
          },
        ],
      },
      {
        value: "생활 리듬",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 24,
          label: 11,
          padX: 23,
          padTop: 20,
          padBottom: 22,
          gap: 7,
        },
        keys: [
          {
            x: 868.29,
            y: 102.15,
            w: 188,
            h: 77.2,
            turn: -34.11,
            blur: 2.1,
            ink: 1,
          },
          {
            x: 534.28,
            y: 154.06,
            w: 270,
            h: 98.0,
            turn: 29.41,
            blur: 3,
            ink: 1,
          },
          {
            x: 198.54,
            y: 205.62,
            w: 353,
            h: 132.9,
            turn: 18.43,
            blur: 2.1,
            ink: 1,
          },
          {
            x: 88.87,
            y: 223.68,
            w: 380,
            h: 98.8,
            turn: 17.38,
            blur: 0,
            ink: 1,
          },
        ],
      },
      {
        value: "관계의 속도",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 16,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 687.65,
            y: 80.14,
            w: 97,
            h: 43.2,
            turn: 42.62,
            blur: 4.95,
            ink: 0.09,
          },
          {
            x: 568.95,
            y: 125.83,
            w: 116,
            h: 49.2,
            turn: 32.97,
            blur: 5.25,
            ink: 0.26,
          },
          {
            x: 450.32,
            y: 171.5,
            w: 136,
            h: 54.9,
            turn: 24.42,
            blur: 3.8,
            ink: 0.43,
          },
          {
            x: 411.01,
            y: 186.9,
            w: 142,
            h: 61.2,
            turn: 27.47,
            blur: 1.5,
            ink: 0.6,
          },
        ],
      },
      {
        value: "중요한 가치",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 24,
          label: 11,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 546.43,
            y: 100.46,
            w: 163,
            h: 58.7,
            turn: 32.71,
            blur: 2.1,
            ink: 1,
          },
          {
            x: 805.81,
            y: 148.11,
            w: 173,
            h: 71.1,
            turn: -36.95,
            blur: 3,
            ink: 1,
          },
          {
            x: 1065.01,
            y: 195.82,
            w: 182,
            h: 72.4,
            turn: -20.78,
            blur: 2.1,
            ink: 1,
          },
          {
            x: 1151.86,
            y: 211.6,
            w: 185,
            h: 77.4,
            turn: -18.82,
            blur: 0,
            ink: 1,
          },
        ],
      },
      {
        value: "편안한 대화",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 30,
          label: 14,
          padX: 19,
          padTop: 16,
          padBottom: 18,
          gap: 7,
        },
        keys: [
          {
            x: 883.59,
            y: 73.71,
            w: 154,
            h: 62.4,
            turn: -34.28,
            blur: 3.45,
            ink: 0.54,
          },
          {
            x: 1053.92,
            y: 227.52,
            w: 225,
            h: 85.3,
            turn: -18.95,
            blur: 5.25,
            ink: 0.63,
          },
          {
            x: 1223.73,
            y: 381.27,
            w: 296,
            h: 109.4,
            turn: -9.06,
            blur: 5.3,
            ink: 0.71,
          },
          {
            x: 1282.07,
            y: 432.24,
            w: 320,
            h: 100.8,
            turn: -7.28,
            blur: 3.5,
            ink: 0.8,
          },
        ],
      },
      {
        value: "이야기",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 15,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 664.83,
            y: 111.91,
            w: 94,
            h: 44.3,
            turn: 40.45,
            blur: 4.85,
            ink: 0.09,
          },
          {
            x: 477.71,
            y: 252.92,
            w: 105,
            h: 50.3,
            turn: 19.48,
            blur: 5,
            ink: 0.27,
          },
          {
            x: 290.46,
            y: 393.93,
            w: 116,
            h: 51.4,
            turn: 7.2,
            blur: 3.35,
            ink: 0.44,
          },
          {
            x: 228.58,
            y: 440.98,
            w: 120,
            h: 60.8,
            turn: 2.03,
            blur: 1,
            ink: 0.62,
          },
        ],
      },
      {
        value: "관심사",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 24,
          label: 11,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 655.24,
            y: 155.08,
            w: 120,
            h: 51.0,
            turn: 38.62,
            blur: 3.85,
            ink: 0.37,
          },
          {
            x: 409.41,
            y: 333.45,
            w: 150,
            h: 58.6,
            turn: 10.97,
            blur: 4,
            ink: 0.58,
          },
          {
            x: 162.97,
            y: 511.78,
            w: 180,
            h: 68.4,
            turn: 3.09,
            blur: 2.35,
            ink: 0.79,
          },
          { x: 82.17, y: 571.32, w: 190, h: 72.8, turn: 2.65, blur: 0, ink: 1 },
        ],
      },
      {
        value: "생활 리듬",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 16,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 642.12,
            y: 139.4,
            w: 95,
            h: 45.3,
            turn: 37.92,
            blur: 5.1,
            ink: 0.09,
          },
          {
            x: 387.24,
            y: 362.91,
            w: 110,
            h: 51.4,
            turn: 8.46,
            blur: 6,
            ink: 0.26,
          },
          {
            x: 131.9,
            y: 586.33,
            w: 125,
            h: 50.8,
            turn: 0.46,
            blur: 5.1,
            ink: 0.43,
          },
          {
            x: 47.84,
            y: 660.88,
            w: 130,
            h: 59.6,
            turn: -0.07,
            blur: 3,
            ink: 0.6,
          },
        ],
      },
      {
        value: "관계의 속도",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 14,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 687.72,
            y: 130.43,
            w: 93,
            h: 44.1,
            turn: 42.09,
            blur: 4.95,
            ink: 0.08,
          },
          {
            x: 569.3,
            y: 326.97,
            w: 100,
            h: 50.2,
            turn: 15.33,
            blur: 5.25,
            ink: 0.24,
          },
          {
            x: 451.03,
            y: 523.48,
            w: 108,
            h: 48.8,
            turn: -8.07,
            blur: 3.8,
            ink: 0.39,
          },
          {
            x: 411.83,
            y: 588.98,
            w: 110,
            h: 56.6,
            turn: -10.88,
            blur: 1.5,
            ink: 0.55,
          },
        ],
      },
      {
        value: "중요한 가치",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 14,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 704.86,
            y: 138.43,
            w: 91,
            h: 43.9,
            turn: 43.57,
            blur: 5,
            ink: 0.07,
          },
          {
            x: 637.88,
            y: 358.96,
            w: 95,
            h: 48.1,
            turn: 14.59,
            blur: 5.5,
            ink: 0.22,
          },
          {
            x: 571.04,
            y: 579.41,
            w: 99,
            h: 45.7,
            turn: -22.79,
            blur: 4.25,
            ink: 0.36,
          },
          {
            x: 548.83,
            y: 652.92,
            w: 100,
            h: 54.7,
            turn: -25.25,
            blur: 2,
            ink: 0.5,
          },
        ],
      },
      {
        value: "편안한 대화",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 15,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 726.13,
            y: 139.04,
            w: 94,
            h: 52.2,
            turn: -44.42,
            blur: 5,
            ink: 0.07,
          },
          {
            x: 723.59,
            y: 361.45,
            w: 105,
            h: 50.7,
            turn: -42.43,
            blur: 5.5,
            ink: 0.22,
          },
          {
            x: 721.03,
            y: 583.75,
            w: 116,
            h: 54.1,
            turn: 44.84,
            blur: 4.25,
            ink: 0.36,
          },
          {
            x: 720.13,
            y: 657.91,
            w: 120,
            h: 66.2,
            turn: 45,
            blur: 2,
            ink: 0.5,
          },
        ],
      },
      {
        value: "이야기",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 30,
          label: 14,
          padX: 25,
          padTop: 22,
          padBottom: 24,
          gap: 7,
        },
        keys: [
          {
            x: 672.71,
            y: 150.02,
            w: 181,
            h: 62.6,
            turn: 40.39,
            blur: 5.25,
            ink: 0.1,
          },
          {
            x: 509.5,
            y: 405.47,
            w: 284,
            h: 103.1,
            turn: 2.6,
            blur: 6.5,
            ink: 0.3,
          },
          {
            x: 345.6,
            y: 660.78,
            w: 386,
            h: 130.0,
            turn: -11.55,
            blur: 6,
            ink: 0.5,
          },
          {
            x: 292.39,
            y: 745.96,
            w: 420,
            h: 102.9,
            turn: -12.79,
            blur: 4,
            ink: 0.7,
          },
        ],
      },
      {
        value: "관심사",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 30,
          label: 14,
          padX: 25,
          padTop: 22,
          padBottom: 24,
          gap: 7,
        },
        keys: [
          {
            x: 775.58,
            y: 151.31,
            w: 181,
            h: 72.3,
            turn: -39.58,
            blur: 5.25,
            ink: 0.1,
          },
          {
            x: 921.21,
            y: 410.64,
            w: 284,
            h: 103.0,
            turn: -1.69,
            blur: 6.5,
            ink: 0.3,
          },
          {
            x: 1066.42,
            y: 669.34,
            w: 386,
            h: 138.0,
            turn: 13.41,
            blur: 6,
            ink: 0.5,
          },
          {
            x: 1115.82,
            y: 756.25,
            w: 420,
            h: 112.4,
            turn: 14.69,
            blur: 4,
            ink: 0.7,
          },
        ],
      },
      {
        value: "생활 리듬",
        label: "내가 들려주는 것",
        accent: false,
        type: {
          value: 24,
          label: 11,
          padX: 14,
          padTop: 11,
          padBottom: 13,
          gap: 7,
        },
        keys: [
          {
            x: 696.93,
            y: 111.99,
            w: 143,
            h: 51.8,
            turn: 43.06,
            blur: 3,
            ink: 0.57,
          },
          {
            x: 893.14,
            y: 341.67,
            w: 180,
            h: 69.9,
            turn: -12.06,
            blur: 3.5,
            ink: 0.72,
          },
          {
            x: 1089.2,
            y: 571.09,
            w: 218,
            h: 80.5,
            turn: 6.56,
            blur: 2.25,
            ink: 0.86,
          },
          {
            x: 1155.24,
            y: 647.74,
            w: 230,
            h: 77.6,
            turn: 7.91,
            blur: 0,
            ink: 1,
          },
        ],
      },
      {
        value: "관계의 속도",
        label: "ECHO가 살펴보는 것",
        accent: false,
        type: {
          value: 15,
          label: 9,
          padX: 12,
          padTop: 9,
          padBottom: 11,
          gap: 7,
        },
        keys: [
          {
            x: 769.53,
            y: 125.77,
            w: 93,
            h: 52.2,
            turn: -40.66,
            blur: 4.95,
            ink: 0.09,
          },
          {
            x: 897.26,
            y: 308.47,
            w: 103,
            h: 51.0,
            turn: -16.47,
            blur: 5.25,
            ink: 0.25,
          },
          {
            x: 1025,
            y: 491.04,
            w: 112,
            h: 50.8,
            turn: 3.46,
            blur: 3.8,
            ink: 0.42,
          },
          {
            x: 1067.79,
            y: 551.93,
            w: 115,
            h: 60.6,
            turn: 6.28,
            blur: 1.5,
            ink: 0.58,
          },
        ],
      },
    ],
  },
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
