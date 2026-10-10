/**
 * Scene colours come from the design tokens, not from the scene code.
 *
 * Hard rule #4: no hardcoded values. The Tier 1 primitives and Tier 2 semantic
 * roles live in `globals.css`; this reads the resolved Tier 2 values off the
 * element so a re-theme is still a one-line change in CSS.
 *
 * 📖 Docs: obsidian/frontend/design-system.md · obsidian/frontend/dandelion-scene.md
 */

export interface SceneTokens {
  /** Canvas clear colour. */
  backdrop: string;
  /** The pappus — the white hairs that make up the clock. */
  fluff: string;
  /** The seed grains part-way along each ray. */
  seedBody: string;
  /** The receptacle at the centre of the head. */
  core: string;
  /** The stem. */
  stem: string;
  /** The core burning at the centre of the head. */
  glow: string;
  /** The pollen adrift around it — separate, so the two can be set apart. */
  pollen: string;
  /** The petal of the flower that opens at the end: rim, and throat. */
  petalLight: string;
  petalDeep: string;
  /** The second flower's stem — cooler than the dandelion's, to match it. */
  bloomStem: string;
  /** The closing iris's outer fibres: the two ends of their gradient. */
  irisLime: string;
  irisSky: string;
  /** The pappus cools to this at the rim of the head. */
  fluffEdge: string;
  /** …and comes up this colour, before the head goes to seed. */
  fluffYoung: string;
  /** The cards that leave with the petals — see `fly-cards.ts`. */
  card: {
    /** The page's display face, as the browser resolved it. */
    font: string;
    surface: string;
    border: string;
    value: string;
    label: string;
    accent: string;
    surfaceGhost: string;
    valueGhost: string;
    labelGhost: string;
  };
}

/**
 * Last-resort fallbacks, used only if the stylesheet has not applied yet (a
 * blank string from `getPropertyValue`). CSS named colours, never a literal that
 * would compete with a token as a source of truth.
 */
const FALLBACKS: SceneTokens = {
  backdrop: "black",
  fluff: "white",
  seedBody: "tan",
  core: "darkolivegreen",
  stem: "forestgreen",
  glow: "gold",
  pollen: "goldenrod",
  petalLight: "lightsteelblue",
  petalDeep: "darkslateblue",
  bloomStem: "darkseagreen",
  irisLime: "palegreen",
  irisSky: "lightskyblue",
  fluffEdge: "lightsteelblue",
  fluffYoung: "gold",
  card: {
    font: "sans-serif",
    surface: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.18)",
    value: "white",
    label: "silver",
    accent: "greenyellow",
    surfaceGhost: "rgba(255, 255, 255, 0.05)",
    valueGhost: "gainsboro",
    labelGhost: "gray",
  },
};

/** The gradient behind the flower — a separate scene, so a separate palette. */
export interface BackdropTokenSet {
  ground: string;
  deep: string;
  mid: string;
  hot: string;
  light: string;
}

const BACKDROP_FALLBACKS: BackdropTokenSet = {
  ground: "black",
  deep: "midnightblue",
  mid: "navy",
  hot: "royalblue",
  light: "lightsteelblue",
};

export const readSceneTokens = (element: Element): SceneTokens => {
  const styles = getComputedStyle(element);
  const read = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    backdrop: read("--scene-backdrop", FALLBACKS.backdrop),
    fluff: read("--scene-fluff", FALLBACKS.fluff),
    seedBody: read("--scene-seed-body", FALLBACKS.seedBody),
    core: read("--scene-seed-core", FALLBACKS.core),
    stem: read("--scene-stem", FALLBACKS.stem),
    glow: read("--scene-glow", FALLBACKS.glow),
    pollen: read("--scene-pollen", FALLBACKS.pollen),
    petalLight: read("--scene-petal-light", FALLBACKS.petalLight),
    petalDeep: read("--scene-petal-deep", FALLBACKS.petalDeep),
    bloomStem: read("--scene-bloom-stem", FALLBACKS.bloomStem),
    irisLime: read("--scene-iris-lime", FALLBACKS.irisLime),
    irisSky: read("--scene-iris-sky", FALLBACKS.irisSky),
    fluffEdge: read("--scene-fluff-edge", FALLBACKS.fluffEdge),
    fluffYoung: read("--scene-fluff-young", FALLBACKS.fluffYoung),
    card: {
      font: read("--font-chakra-petch", FALLBACKS.card.font),
      surface: read("--card-surface", FALLBACKS.card.surface),
      border: read("--card-border", FALLBACKS.card.border),
      value: read("--card-value", FALLBACKS.card.value),
      label: read("--card-label", FALLBACKS.card.label),
      accent: read("--accent", FALLBACKS.card.accent),
      surfaceGhost: read("--card-surface-ghost", FALLBACKS.card.surfaceGhost),
      valueGhost: read("--card-value-ghost", FALLBACKS.card.valueGhost),
      labelGhost: read("--card-label-ghost", FALLBACKS.card.labelGhost),
    },
  };
};

export const readBackdropTokens = (element: Element): BackdropTokenSet => {
  const styles = getComputedStyle(element);
  const read = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    ground: read("--scene-field-ground", BACKDROP_FALLBACKS.ground),
    deep: read("--scene-field-deep", BACKDROP_FALLBACKS.deep),
    mid: read("--scene-field-mid", BACKDROP_FALLBACKS.mid),
    hot: read("--scene-field-hot", BACKDROP_FALLBACKS.hot),
    light: read("--scene-field-light", BACKDROP_FALLBACKS.light),
  };
};
