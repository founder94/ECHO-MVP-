/**
 * Placeholder copy for the home view. Passed in via props — never imported
 * directly by a component.
 */

/** A glassy metric card, shown beside a HUD section. */
export interface MetricCard {
  label: string;
  value: string;
  detail: string;
}

/** A key/value row in a section's right-hand spec panel. */
export interface MetaRow {
  label: string;
  value: string;
}

export interface SectionCopy {
  eyebrow: string;
  /** Rendered one element per entry, so the line breaks are authored, not wrapped. */
  title: string[];
  body: string[];
  tag: string;
  /** Metric cards, floated in the centre of the frame. */
  cards?: MetricCard[];
  /** Spec rows, pinned to the right of the frame. */
  meta?: MetaRow[];
}

export interface BrandCopy {
  name: string;
  suffix: string;
}

export interface StatusCopy {
  label: string;
  detail: string;
  scrollHint: string;
}

export interface LoaderCopy {
  brand: string;
  brandDetail: string;
  bootLabel: string;
  bootState: string;
  initializing: string;
  loading: string;
  coordinates: string;
  version: string;
}

export const homeBrand: BrandCopy = {
  name: "VESPER",
  suffix: "/ V—0RB",
};

export const homeSections: SectionCopy[] = [
  {
    eyebrow: "01 — ORIGIN",
    title: ["A living", "interface."],
    body: [
      "Pure motion shaped by intent.",
      "The seed of an environment that breathes back.",
    ],
    tag: "CORE / IDLE",
  },
  {
    eyebrow: "02 — EXPANSION",
    title: ["Beyond", "the core."],
    body: [
      "Every particle a thought.",
      "Every pulse a signal.",
      "The space between, alive.",
    ],
    tag: "SIGNAL / OPEN",
    cards: [
      { label: "Frame budget", value: "8.3", detail: "ms · p99" },
      { label: "Particles", value: "91k", detail: "live, per frame" },
      { label: "Cold start", value: "0.9", detail: "seconds to first light" },
    ],
  },
  {
    eyebrow: "03 — HORIZON",
    title: ["Enter", "the unknown."],
    body: [
      "Built for the edge of what comes next.",
      "Now boarding for everywhere.",
    ],
    tag: "EDGE / READY",
    meta: [
      { label: "Core", value: "V—0RB" },
      { label: "Build", value: "2026.07.10" },
      { label: "Channel", value: "Beta" },
      { label: "Region", value: "EU–CENTRAL" },
      { label: "Uptime", value: "99.98%" },
    ],
  },
];

export const homeStatus: StatusCopy = {
  label: "SYS.LINK ESTABLISHED",
  detail: "· FRAME LOCKED",
  scrollHint: "SCROLL TO ADVANCE",
};

export interface OutroCopy {
  eyebrow: string;
  /** One line — the whole point of the headline is that it does not break. */
  title: string;
  body: string[];
  points: { label: string; value: string }[];
  cta: { label: string; href: string };
}

export interface FaqCopy {
  eyebrow: string;
  title: string;
  items: { question: string; answer: string }[];
}

export interface FooterCopy {
  wordmark: string;
  tagline: string;
  columns: { heading: string; links: { label: string; href: string }[] }[];
  legal?: string;
}

export const homeOutro: OutroCopy = {
  eyebrow: "04 — SIGNAL",
  title: "Built to be felt.",
  body: [
    "An interface that reads the room before it reads the input.",
    "Motion as language, not decoration.",
  ],
  points: [
    { label: "Latency", value: "< 8 ms" },
    { label: "Surfaces", value: "Web · Native · XR" },
    { label: "Status", value: "In residency" },
  ],
  cta: { label: "Request access", href: "/" },
};

export const homeFaq: FaqCopy = {
  eyebrow: "05 — QUESTIONS",
  title: "Frequently asked",
  items: [
    {
      question: "What exactly is Vesper?",
      answer:
        "A rendering and interaction layer. It reads presence — pointer, scroll, dwell — and answers in motion rather than in chrome. The particle work you just scrolled through is the engine talking about itself.",
    },
    {
      question: "Does it run on low-end hardware?",
      answer:
        "Yes. Point counts, tessellation, pointer reactivity and device pixel ratio all step down by viewport class, and the render loop yields rather than starving the frame. On integrated graphics it drops geometry before it drops frames.",
    },
    {
      question: "Is any of this accessible?",
      answer:
        "The scene is decorative and marked aria-hidden; every word on the page is real text in the DOM. Reduced-motion is honoured globally — springs resolve instantly and the particle field stops.",
    },
    {
      question: "Can I use it in my own product?",
      answer:
        "Not yet. Vesper is in residency while the engine settles. Request access and we will write when the surface stops moving.",
    },
  ],
};

export const homeFooter: FooterCopy = {
  wordmark: "Vesper",
  tagline:
    "A living interface that reads your presence and answers in motion, not chrome.",
  columns: [
    {
      heading: "Engine",
      links: [
        { label: "Overview", href: "/" },
        { label: "The renderer", href: "/" },
        { label: "Interaction", href: "/" },
        { label: "Performance", href: "/" },
        { label: "Roadmap", href: "/" },
      ],
    },
    {
      heading: "Studio",
      links: [
        { label: "Origin story", href: "/" },
        { label: "The team", href: "/" },
        { label: "Journal", href: "/" },
        { label: "In residency", href: "/" },
      ],
    },
    {
      heading: "Connect",
      links: [
        { label: "Get in touch", href: "/#contact" },
        { label: "Privacy", href: "/" },
        { label: "Terms", href: "/" },
        { label: "Report an issue", href: "/" },
      ],
    },
  ],
};

export const homeLoader: LoaderCopy = {
  brand: "VESPER",
  brandDetail: "V—0RB / SYS.04",
  bootLabel: "BOOT SEQUENCE",
  bootState: "● INIT",
  initializing: "INITIALIZING ENVIRONMENT",
  loading: "LOADING ASSETS",
  coordinates: "42.0192°N / 23.3219°E",
  version: "v0.4.1 — beta channel",
};
