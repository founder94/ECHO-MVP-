/**
 * "07 Connect" — Figma 4209:752. The last screen of the flight, over the iris
 * the scene closes on, and the page's footer with it.
 *
 * The heading is set three lines at 0.92, the middle one stepped in by 204, in
 * the accent — the only place on the page the lime carries type this size. At
 * 80 the design stops kerning the swashes by rule and does it by eye, pair by
 * pair, so each line hands `SwashText` its own readings. The
 * column on the right holds the same aside the copy screens use and the same
 * call to action the opening screen does. Everything below is the footer
 * proper: three columns of links, a rule, and the small print.
 *
 * The design draws this frame 784 tall rather than 800 — it is trimmed at the
 * bottom — so everything below the fold is hung off the bottom edge: the rule
 * and the small print 24 up from it, the columns 105. The heading and the
 * column beside it keep to the top, as the rest of the flight does.
 *
 * It arrives the way the opening screen does once the preloader lifts: the
 * heading a letter at a time out of focus, each line a beat behind the one
 * above; the aside rising a word at a time; the button coming into focus where
 * it stands; then the footer — its links in one run, the rule drawn, the small
 * print last. Its `ScreenFade` does not fade it (`entry="own"`), so all of that
 * plays on a screen at full strength, and scrolling back above it plays it out.
 *
 * The narrow frames are 4434:743 (1024), 4434:826 (768) and 4434:909 (390).
 * 1024 keeps the shape and only tightens it. From 768 down the aside and the
 * button leave the right-hand corner and fall in under the heading, left
 * aligned with it, and at 390 the step in front of the heading's middle line
 * goes and the button takes the opening screen's smaller 220.
 */

"use client";

import { animated, useSpring, useSprings } from "@react-spring/web";
import { useEffect } from "react";

import { useArrived } from "@flora/components/common/flight/arrival";
import { CtaButton } from "@flora/components/ui/cta-button";
import { SwashText } from "@flora/components/ui/swash-text";
import { WordFlight } from "@flora/components/ui/word-flight";
import type { ConnectContent } from "@flora/data/mocks/home";
import { publicUrl } from "@shared/paths";

export type ConnectScreenProps = Omit<ConnectContent, "window"> & {
  /** 운영사 표기(ECHO by DOIT COMPANY) — 마지막 화면 아래 작은 글씨 옆 D 심볼과 함께. */
  operator: string;
  /** CTA 를 누를 때(이야기 화면으로 넘어가기 전 처리). */
  onCta?: () => void;
};

/** The footer's links come in one after another, as one run. */
const LINK = 44;
/**
 * The beat between the heading's lines — the opening heading's, so the two
 * read as the same voice.
 */
const LINE = 260;
const FOCUS = { tension: 170, friction: 28 };
const SETTLING = { tension: 200, friction: 28 };

export const ConnectScreen = ({
  headline,
  lead,
  cta,
  columns,
  mark,
  legal,
  operator,
  onCta,
}: ConnectScreenProps) => {
  const live = useArrived();
  const links = columns.flatMap((column) => column.links);

  const [{ sharp }] = useSpring(
    () => ({ sharp: live ? 1 : 0, delay: live ? 760 : 0, config: FOCUS }),
    [live],
  );
  const [{ drawn }] = useSpring(
    () => ({ drawn: live ? 1 : 0, delay: live ? 900 : 0, config: SETTLING }),
    [live],
  );
  /* The small print, after the last link has landed. */
  const [{ fine }] = useSpring(
    () => ({
      fine: live ? 1 : 0,
      delay: live ? 860 + links.length * LINK : 0,
      config: SETTLING,
    }),
    [live, links.length],
  );
  const [heads, headsApi] = useSprings(columns.length, () => ({
    on: 0,
    config: SETTLING,
  }));
  const [rows, rowsApi] = useSprings(links.length, () => ({
    on: 0,
    config: SETTLING,
  }));

  useEffect(() => {
    /* Scrolled back above the screen, the footer goes the way it came — the
       run reversed, last link first. */
    if (!live) {
      headsApi.start(() => ({ on: 0, delay: 0 }));
      rowsApi.start((index) => ({
        on: 0,
        delay: (links.length - 1 - index) * (LINK / 2),
      }));
      return;
    }
    headsApi.start((index) => ({ on: 1, delay: 780 + index * LINK }));
    rowsApi.start((index) => ({ on: 1, delay: 860 + index * LINK }));
  }, [live, headsApi, rowsApi, links.length]);

  /** A link's place in the one continuous run down the three columns. */
  const runOf = (column: number, row: number) =>
    columns.slice(0, column).reduce((sum, c) => sum + c.links.length, 0) + row;

  return (
    <div className="absolute inset-0">
      <h2 className="font-display text-closing leading-headline tracking-closing text-title max-laptop:top-8 max-laptop:left-8 max-laptop:w-[26.75rem] max-tablet:top-6 max-tablet:left-6 max-tablet:w-[30.5rem] max-phone:top-5 max-phone:left-5 max-phone:w-[21.875rem] absolute top-[2.5rem] left-10 w-max uppercase">
        {/* Every line held to one line: a letter is its own box, and a word
            of them could otherwise break between two glyphs. */}
        <span className="block whitespace-nowrap">
          <WordFlight
            text={headline[0]}
            mode="letters"
            leadClassName="tracking-swash-lead"
          />
        </span>
        <span className="max-laptop:pl-[11.3125rem] max-tablet:pl-[8rem] max-phone:pl-0 block pl-[12.75rem] whitespace-nowrap">
          <WordFlight
            text={headline[1]}
            mode="letters"
            offset={LINE}
            kerning={[
              ["tracking-swash-tuck", "tracking-closing-swash-else"],
              ["tracking-swash-tuck", "tracking-swash-lead"],
            ]}
          />
        </span>
        {headline[2] ? (
          <span className="block whitespace-nowrap">
            <WordFlight
              text={headline[2]}
              mode="letters"
              offset={LINE * 2}
              kerning={[["tracking-swash-tuck", "tracking-closing-swash"]]}
            />
          </span>
        ) : null}
      </h2>

      {/* The aside and the button: off the right corner on the wide frames, under
        the heading and left aligned from 768 down. Both are measured from the
        right edge rather than from a share of the width, which is the same 40
        or 32 gutter every other block keeps. */}
      <div className="max-laptop:top-[2.125rem] max-laptop:right-8 max-laptop:w-[19.0625rem] max-laptop:gap-[4.8125rem] max-tablet:top-[19.375rem] max-tablet:right-auto max-tablet:left-6 max-tablet:w-[18.875rem] max-tablet:items-start max-tablet:gap-6 max-phone:top-[11.875rem] max-phone:left-5 max-phone:w-[21.875rem] absolute top-10 right-10 flex w-[26.4375rem] flex-col items-end gap-[4.875rem]">
        {lead ? (
          <p className="font-display text-closing-aside leading-desc-ko text-foreground-desc max-phone:text-[18px] max-tablet:text-left w-full text-right whitespace-pre-wrap text-balance font-semibold uppercase">
            <WordFlight text={lead} mode="rise" offset={420} />
          </p>
        ) : null}

        {/* The cell and its icon are two shapes with a 2px gutter, as the opening
          screen sets them — this one is just wider. */}
        <animated.span
          style={{
            opacity: sharp,
            filter: sharp.to((value) => `blur(${(1 - value) * 7}px)`),
          }}
        >
          <CtaButton
            href={cta.href}
            label={cta.label}
            onClick={onCta}
            className="max-phone:w-[13.75rem] w-[16.375rem]"
            plateClassName="max-phone:w-[10.5625rem] max-phone:pl-5 w-[13.1875rem] pl-[1.375rem]"
          />
        </animated.span>
      </div>

      <nav
        aria-label="Footer"
        className="font-display max-laptop:bottom-[6.0625rem] max-laptop:left-8 max-laptop:gap-16 max-tablet:bottom-[5.0625rem] max-tablet:left-6 max-tablet:gap-14 max-phone:left-5 max-phone:gap-[3.3125rem] absolute bottom-[6.5625rem] left-10 flex items-center gap-20"
      >
        {/* One run, not three: the numbering carries on across the columns, so
          the links arrive as a single stream rather than three little bursts. */}
        {columns.map((column, c) => (
          <div key={column.title} className="flex flex-col items-start gap-4">
            <animated.h3
              className="text-foot tracking-foot text-foreground-quiet leading-normal uppercase"
              style={{ opacity: heads[c].on }}
            >
              {column.title}
            </animated.h3>
            <ul className="text-link leading-nav tracking-label text-scene-foreground flex flex-col items-start gap-2">
              {column.links.map((link, r) => (
                <animated.li
                  key={link.href}
                  style={{
                    opacity: rows[runOf(c, r)].on,
                    transform: rows[runOf(c, r)].on.to(
                      (value) => `translate3d(0, ${(1 - value) * 0.55}rem, 0)`,
                    ),
                  }}
                >
                  <a
                    href={link.href}
                    /* The lime runs through the letters, as it does in the
                     header — one hover for every link on the page. */
                    className="ink-fill [--ink-from:var(--color-scene-foreground)]"
                  >
                    {link.label}
                  </a>
                </animated.li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="max-laptop:left-8 max-laptop:w-[60rem] max-tablet:bottom-4 max-tablet:left-6 max-tablet:w-[45rem] max-phone:left-5 max-phone:w-[21.875rem] max-phone:gap-4 absolute bottom-6 left-10 flex w-[85rem] flex-col gap-6">
        <animated.span
          aria-hidden
          className="bg-rule h-px w-full origin-left"
          style={{ transform: drawn.to((value) => `scaleX(${value})`) }}
        />
        <animated.div
          className="font-display flex items-end justify-between whitespace-nowrap"
          style={{
            opacity: fine,
            transform: fine.to(
              (value) => `translate3d(0, ${(1 - value) * 0.55}rem, 0)`,
            ),
          }}
        >
          <p className="text-foot tracking-mark text-foreground-note flex items-center gap-2 leading-normal font-medium">
            <img src={publicUrl("brand/doit-symbol.png")} alt="" aria-hidden="true" className="h-[1.1rem] w-auto" />
            <span>{operator}</span>
            <span aria-hidden="true" className="text-foreground-faint">·</span>
            <SwashText text={mark} />
          </p>
          <ul className="text-foot tracking-foot text-foreground-faint flex items-center gap-8 leading-normal uppercase">
            {legal.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="ink-fill [--ink-from:var(--color-scene-foreground)]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </animated.div>
      </div>
    </div>
  );
};
