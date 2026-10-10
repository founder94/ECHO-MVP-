// 📖 Docs: obsidian/frontend/content.md

/**
 * Clarix's page copy — the shipped page's text (clarix-old/3d-website/
 * index.html), verbatim. Content lives here, never in the view (hard rule #4).
 *
 * A split title is lines of segments; a segment with a `weight` was a
 * `<span style="font-weight: …">` on the shipped page (500 → "medium",
 * 400 → "regular"), each line break a `<br>`.
 */

export interface TitleSegment {
  text: string;
  weight?: "medium" | "regular";
}
export type TitleLines = readonly (readonly TitleSegment[])[];

export interface FooterColumn {
  title: string;
  links: readonly string[];
}

export interface Stat {
  value: string;
  desc: readonly string[];
  sub?: string;
  tall?: boolean;
}

const LOGOS = [
  { file: "Discord.png", name: "Discord" },
  { file: "Facebook.png", name: "Facebook" },
  { file: "Snapchat.png", name: "Snapchat" },
  { file: "Spotify.png", name: "Spotify" },
  { file: "TikTok.png", name: "TikTok" },
  { file: "WhatsApp.png", name: "WhatsApp" },
  { file: "YouTube.png", name: "YouTube" },
  { file: "dribbble.png", name: "Dribbble" },
  { file: "ebay.png", name: "eBay" },
  { file: "instagram.png", name: "Instagram" },
  { file: "twitter.png", name: "Twitter" },
] as const;

export const clarixContent = {
  logo: { src: "/assets/logo.svg", alt: "Clarix logo" },
  preloader: { total: 100 },
  nav: ["home", "plans", "services", "contact us"],
  navArrow: "↗",
  hero: {
    title: [[{ text: "The clarity your business" }], [{ text: "has been missing", weight: "regular" }]] as TitleLines,
    index: ["( A )", "[ 001 /004 ]"],
    text: "Clarix is where your boldest ideas meet their full potential. We give you the tools not just to see the future.",
    cta: "GET STARTED",
  },
  empower: {
    title: [
      [{ text: "Empowering visionaries" }],
      [{ text: "to shape tomorrow's" }],
      [{ text: "digital landscapes", weight: "medium" }],
    ] as TitleLines,
  },
  clients: {
    label: "OUR CLIENTS",
    /** Listed twice in the track so the loop is seamless. */
    logos: LOGOS.map((l) => ({ src: `/assets/companies/${l.file}`, alt: l.name })),
  },
  redefine: {
    title: [
      [{ text: "Redefining digital experiences" }],
      [{ text: "through art and" }],
      [{ text: "technology", weight: "medium" }],
    ] as TitleLines,
  },
  /**
   * Phones (owner review, D-033): the scene stops at "growth"; what it showed
   * after that — the figure's phase-4 pose, the particle logo, the finale
   * figure — is these stills, captured from the running scene at 390 px (2×).
   */
  stills: {
    phase4: { src: "/assets/mobile/phase4-model.webp", width: 780, height: 1400, alt: "" },
    phase5: { src: "/assets/mobile/phase5-logo.webp", width: 780, height: 700, alt: "The Clarix logo, formed from particles" },
    phase6: { src: "/assets/mobile/phase6-model.webp", width: 780, height: 1400, alt: "" },
  },
  /** The three words that fly across the screen behind the model. */
  words: ["Tools", "kill", "growth"],
  glass: {
    title: [[{ text: "Every project is a fusion of strategy," }], [{ text: "creativity and passion" }]] as TitleLines,
    label: "Innovation philosophy",
    // gradient.png (3420×1920, 3.6 MB) as a half-size 4:4:4 JPEG (61 KB): a
    // soft gradient at 50 % opacity under the glass — no visible difference.
    gradient: { src: "/assets/gradient.jpg", alt: "Gradient" },
    stats: [
      { value: "200+", desc: ["universes created"], sub: "*or maybe more", tall: true },
      { value: "97%", desc: ["clients trust us for their", "next project"] },
      { value: "10X", desc: ["team turnover"], sub: "*or maybe more" },
    ] as readonly Stat[],
    statArrow: "→",
  },
  phase4: {
    index: ["( A )", "[ 001 /004 ]"],
    title: [[{ text: "Clarix unlocks a faster," }], [{ text: "smarter way to create", weight: "medium" }]] as TitleLines,
    text: "With just a prompt, you can bring any idea to life instantly, cut down production time, eliminate repetitive tasks, and stay fully in control of your creative vision.",
    cta: "LAUNCH NOW",
  },
  phase5: {
    index: ["( A )", "[ 001 /004 ]"],
    titleLeft: [[{ text: "The pinnacle of generative art" }]] as TitleLines,
    text: "Experience a new paradigm where your imagination meets our computational engine. Build entire worlds without writing a single line of code.",
    titleRight: [[{ text: "Designed for" }], [{ text: "visionaries", weight: "medium" }]] as TitleLines,
  },
  phase6: {
    title: [[{ text: "The future of" }], [{ text: "digital art", weight: "regular" }]] as TitleLines,
  },
  footer: {
    brand: "Clarix",
    heading: "Sign up to receive updates.",
    placeholder: "Enter your email",
    submit: "Submit",
    subtext:
      "By subscribing you agree to our Privacy Policy and provide consent to receive updates from our company.",
    columns: [
      { title: "Products", links: ["Studio", "Engine", "Enterprise"] },
      { title: "Learn", links: ["Blog", "Research", "Documentation"] },
      { title: "About", links: ["Company", "Careers", "Contact"] },
      { title: "Legal", links: ["Terms & Conditions", "Privacy Policy"] },
    ] as readonly FooterColumn[],
    copyright: "© 2026 Clarix, All rights reserved.",
  },
} as const;
