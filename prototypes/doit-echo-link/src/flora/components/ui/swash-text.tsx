// 📖 Docs: obsidian/frontend/components/ui.md

import type { ReactNode } from "react";

/**
 * Tracking for one swash pair, hand-set: what the letter in front of the
 * swash is given, and what the swash itself is. Either half may be left empty
 * to keep the standing rule.
 */
export type SwashKern = readonly [before: string, swash: string];

export interface SwashTextProps {
  /**
   * The copy, with a capital **S** wherever the design draws a swash and a
   * lowercase one where it does not — the same mark the Figma layers carry
   * ("Send firSt.", "to an address"). The caller decides on upper-casing.
   */
  text: string;
  /** Extra classes for the swash glyphs; the wordmark sets them larger. */
  scriptClassName?: string;
  /**
   * Tracking for a swash that opens a word, where there is nothing to tuck it
   * under. It keeps the line's own tracking unless the caller says otherwise —
   * only the heading kerns this one.
   */
  leadClassName?: string;
  /**
   * Where the design kerns by hand rather than by the standing rule. One pair
   * kerns every swash in the text; a list gives each swash its own, in the
   * order they appear. The closing heading is set this way — see
   * `ConnectScreen`.
   */
  kerning?: SwashKern | readonly SwashKern[];
  /**
   * Wraps every glyph, in reading order, for a caller that animates letter by
   * letter. Without it the copy is emitted as runs of text, which is what it
   * should be — one element per character is a lot of DOM for text that only
   * has to sit still.
   *
   * Kerning is unaffected: the pairs are decided here first and the wrapper is
   * handed whatever each glyph turned out to be, swash spans included.
   */
  glyph?: (node: ReactNode, index: number) => ReactNode;
}

const NO_KERN: SwashKern = ["", ""];

/** One pair covers the whole text; a list is read swash by swash. */
const readKern = (
  kerning: SwashTextProps["kerning"],
  index: number,
): SwashKern => {
  if (!kerning) return NO_KERN;
  if (typeof kerning[0] === "string") return kerning as SwashKern;
  return (kerning as readonly SwashKern[])[index] ?? NO_KERN;
};

/**
 * What a swash can be tucked under: a letter, or the apostrophe the closing
 * heading gives it to lean on.
 */
const TUCKABLE = /[\p{L}\u2019]/u;

/**
 * Stemline's signature: a My Soul swash set into Chakra Petch copy (Figma "01
 * Hero" 4337:5410, "02 The leak" 4204:3135).
 *
 * Which S is a swash is a decision the design makes word by word — "addreSS"
 * keeps both of its own — so it is carried in the copy as the capital, never
 * guessed from the letter.
 *
 * The swash is drawn wide and is meant to sit *under* the letter before it, so
 * the design kerns the pair from both sides by the same amount at every size —
 * hence `tracking-swash` on the letter and on the S. A swash that opens a word
 * has nothing to tuck under and keeps the line's tracking instead.
 *
 * That is the standing rule, not a law: the headings and the copy the design
 * has been back over are kerned pair by pair by eye — the letter in front
 * giving a flat `tracking-swash-tuck` and the swash giving back whatever the
 * letter after it asks for. `kerning` is how a caller hands those readings in.
 */
export const SwashText = ({
  text,
  scriptClassName = "",
  leadClassName = "",
  kerning,
  glyph,
}: SwashTextProps) => {
  const nodes: ReactNode[] = [];
  let run = "";
  let swashes = 0;
  let glyphs = 0;

  /* A run is a string when nothing is wrapping it, and one element per letter
     when something is. */
  const push = (node: ReactNode): void => {
    if (!glyph) {
      nodes.push(node);
      return;
    }
    if (typeof node === "string") {
      for (const char of node) nodes.push(glyph(char, glyphs++));
      return;
    }
    nodes.push(glyph(node, glyphs++));
  };

  [...text].forEach((char, index) => {
    if (char !== "S") {
      run += char;
      return;
    }

    const [byHandBefore, byHandSwash] = readKern(kerning, swashes);
    swashes += 1;

    const tucked = TUCKABLE.test(text[index - 1] ?? "");
    if (tucked) {
      const kerned = run.slice(-1);
      run = run.slice(0, -1);
      if (run) push(run);
      push(
        <span
          key={`kern-${index}`}
          className={byHandBefore || "tracking-swash"}
        >
          {kerned}
        </span>,
      );
    } else if (run) {
      push(run);
    }
    run = "";

    push(
      // `leading-swash` is a zero line-height, which flattens the swash's own
      // inline box to nothing. My Soul carries an ascender half again as tall
      // as the copy's, and a glyph that tall asks every line it lands on for a
      // few px more than the strut — enough to walk a paragraph off the
      // design's line grid. The glyph still paints in full: line-height sets
      // the box, never the letter.
      <span
        key={`swash-${index}`}
        className={`font-script leading-swash ${byHandSwash || (tucked ? "tracking-swash" : leadClassName)} ${scriptClassName}`}
      >
        {char}
      </span>,
    );
  });

  if (run) push(run);

  return <>{nodes}</>;
};
