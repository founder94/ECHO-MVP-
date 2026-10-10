import { WordFlight } from "@flora/components/ui/word-flight";

export interface HeroHeadlineProps {
  id: string;
  lines: [string, string];
}

/**
 * The page heading — Figma "01 Hero" 4337:5414 / 4337:5466, and the narrow
 * frames 4380:8077 (1024), 4380:8155 (768), 4382:1111 (390).
 *
 * Two lines, the second stepped in behind the first. Where the pair sits is
 * the one thing the frames disagree on: 1440 and 1024 rest it on the bottom
 * edge, 768 hangs it from the top under the header, and 390 makes it the head
 * of the block the copy and the button finish — there it is laid out by the
 * stack in `Hero` rather than by itself, and the step in front of the second
 * line goes, because 350 has no room to give it.
 *
 * On the wide frames it hangs off the bottom edge, where the design rests it:
 * 27 under the second line's box on the 800 frame. The screen is always the
 * viewport's own height, so a measure taken from the middle would drift off
 * that edge on every other height — from the bottom it cannot.
 *
 * Both the size and the step from line to line are tokens the narrow frames
 * re-set, so they are read from the theme rather than written here: 1024 and
 * 390 pull the two lines closer than their own leading, which no leading on
 * its own would do.
 *
 * It arrives a **letter at a time**, each one rising into place out of focus
 * and out of nothing. The second line follows the first by a beat rather than
 * starting with it, so the two read as one sentence being said rather than as
 * two lines being placed.
 */
export const HeroHeadline = ({ id, lines }: HeroHeadlineProps) => (
  <h1
    id={id}
    className="font-display text-display leading-headline tracking-display text-title max-laptop:bottom-[1.35rem] max-laptop:left-8 max-tablet:top-[8.0625rem] max-tablet:bottom-auto max-tablet:left-[0.875rem] max-phone:static absolute bottom-[1.7125rem] left-10 uppercase"
  >
    {/* Each line is held to exactly its step. The swash is a tall glyph and
        its inline box asks the line box it sits in for a few px more than the
        strut — harmless where it paints, but it would push the second line off
        the measure the design steps by. */}
    <span className="block h-[calc(1em*var(--line-headline-step))] whitespace-nowrap">
      {/* "firSt." is kerned by hand: the swash opening the line keeps the
          rule, the one tucked under the "r" is read again on every frame. */}
      <WordFlight
        text={lines[0]}
        mode="letters"
        leadClassName="tracking-swash-lead"
        kerning={[
          ["", ""],
          ["tracking-display-tuck", "tracking-display-swash"],
        ]}
      />
    </span>
    <span className="max-laptop:pl-[3.875rem] max-tablet:pl-[5.215625rem] max-phone:pl-0 block h-[calc(1em*var(--line-headline))] pl-[8.125rem] whitespace-nowrap">
      <WordFlight
        text={lines[1]}
        mode="letters"
        offset={260}
        leadClassName="tracking-swash-lead"
      />
    </span>
  </h1>
);
