"use client";

// 📖 Docs: obsidian/frontend/components/clarix.md

import { easings, useSpring } from "@react-spring/web";
import { Fragment, useCallback, useEffect, useRef, type ReactNode } from "react";

import type { TitleLines } from "@clarix/data/mocks/home";
import { useDynamicInView } from "@clarix/hooks/animation/use-dynamic-in-view";
import { useMobileFlow } from "@clarix/hooks/use-mobile-flow";
import { useRobot } from "@clarix/components/common/robot-view";
import { useStage } from "@clarix/hooks/use-stage";
import { cssEase, cubicBezier } from "@clarix/lib/animation/cubic-bezier";

/**
 * A title split into masked characters that rise, sharpen and fade in one by
 * one — the shipped page's `initTitles()` + `.hero-char.revealed` CSS
 * transitions, as springs with the same curves (hard rule #1):
 *   transform 1.6 s cubic-bezier(.2,.8,.2,1) · filter 1.6 s ease · opacity 1.2 s ease
 * for the hero (25 ms stagger, 150 ms after the preloader); 0.8 / 0.8 / 0.6 s
 * and a 10 ms stagger for every other title (`.animated-title`).
 *
 * One spring per title drives it: its value is the time since the reveal
 * began, and every character's three curves are read off that clock with its
 * own stagger — the same per-character delays, durations and easings the
 * per-character springs had, written to the characters' styles each frame.
 * The characters themselves are plain server-rendered spans at their start
 * look. A spring trio per character (×3 SpringValues + 2 interpolations ×
 * every character on the page) was the page's hydration: ~240 ms of a phone's
 * main thread in one task (~940 ms at 4× CPU).
 *
 * `trigger` is what fired it on the shipped page:
 * - `preloader` — the hero, when the preloader finishes;
 * - `inview`    — a title in the scrolling flow, at 30 % visible, once;
 * - `stage`     — a title on a fixed layer, when the frame loop says so —
 *                 on phones, where those layers are ordinary flow content
 *                 after the scene (D-033), in view like `inview`.
 */
const RISE = cubicBezier(0.2, 0.8, 0.2, 1);
const PACE = {
  hero: { delay: 150, stagger: 25, rise: 1600, blur: 1600, fade: 1200 },
  fast: { delay: 0, stagger: 10, rise: 800, blur: 800, fade: 600 },
} as const;
const OBSERVER = { threshold: 0.3 };

type Trigger = { on: "preloader" } | { on: "inview" } | { on: "stage"; id: string };
type Tag = "h1" | "h2" | "h3" | "div";

const WEIGHT = { medium: "font-medium", regular: "font-normal text-ink" } as const;

/** A character's look at progress (0 hidden → 1 at rest) per curve. */
const look = (t: number, b: number, o: number) => ({
  transform: `translateY(${110 * (1 - t)}%) translateZ(${-60 * (1 - t)}px) rotateX(${-65 * (1 - t)}deg)`,
  filter: `blur(${14 * (1 - b)}px)`,
  opacity: String(o),
});

/**
 * A character is a compositor layer only while it moves. Every character of
 * every title used to be one for the whole visit — `will-change` in CSS and a
 * 3D transform at rest and while waiting — so each scrolled frame re-layerized
 * and re-rastered hundreds of them (on portrait each with the halo's
 * text-shadow): ~7 ms of layerize + commit per frame on a 4× phone, and the
 * mobile scroll's long render frames. A waiting character is only invisible
 * (opacity 0 — what it looked like anyway); a settled one has no transform or
 * filter (the same pixels as translateZ(0) rotateX(0) blur(0)).
 */
const ANIMATING = "transform, filter, opacity";
const ANIMATING_LINE = "transform, opacity";
const REST = { transform: "none", filter: "none", opacity: "1", willChange: "auto" } as const;
const WAITING = { opacity: 0 } as const;

const progress = (elapsed: number, duration: number) => Math.min(1, Math.max(0, elapsed / duration));

export const SplitTitle = ({
  lines,
  tag: Tag,
  id,
  className,
  trigger,
  pace = "fast",
}: {
  lines: TitleLines;
  tag: Tag;
  id?: string;
  className?: string;
  trigger: Trigger;
  pace?: keyof typeof PACE;
}) => {
  // The robot form (D-016) is served every title at rest — in the server HTML too.
  const robot = useRobot();
  const preloaderDone = useStage((s) => s.preloaderDone);
  const stageFired = useStage((s) => (trigger.on === "stage" ? Boolean(s.revealed[trigger.id]) : false));
  const [observe, inView] = useDynamicInView(OBSERVER);
  const mobileFlow = useMobileFlow();
  const watches = trigger.on === "inview" || (trigger.on === "stage" && mobileFlow);
  const go =
    trigger.on === "preloader" ? preloaderDone : trigger.on === "stage" ? stageFired || (mobileFlow && inView) : inView;

  const root = useRef<HTMLElement | null>(null);
  const setRoot = useCallback(
    (el: HTMLElement | null) => {
      root.current = el;
      if (watches) observe(el);
    },
    [observe, watches],
  );

  const [, api] = useSpring(() => ({ elapsed: 0 }));
  // Once per title, as shipped: an in-view title that leaves and re-enters
  // the viewport stays at rest (restarting the clock would replay it).
  const played = useRef(false);
  // The reveal's observer and timer outlive a `go` flip (the reveal plays to
  // the end); they are released when settled, or on unmount.
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);

  useEffect(() => {
    if (robot || !go || played.current || !root.current) return;
    played.current = true;
    const p = PACE[pace];
    const chars = Array.from(root.current.querySelectorAll<HTMLElement>(".hero-char"));
    const longest = Math.max(p.rise, p.blur, p.fade);
    const total = p.delay + Math.max(0, chars.length - 1) * p.stagger + longest;
    let settled = 0; // characters before this index are at rest and written
    let elapsed = 0;
    // Only an on-screen title writes its characters. The clock keeps time
    // regardless, so a title that scrolls back into view mid-reveal shows the
    // frame it would have shown — and one that finished off-screen lands at
    // rest the moment it is seen.
    let visible = true;
    // **Portrait (phones): one blur per line, not per character** (rule:
    // optimize-performance, "blur once per line"). Every character carrying
    // its own animated `filter` is its own filtered surface on the GPU each
    // frame, and on a phone the reveals of the fixed-stage titles were the
    // page's longest frames (D-031: per-character filters off → the GPU's
    // render-pass time −47 %, its swap wait −56 %). The characters keep their
    // staggered rise and fade; each line sharpens on the clock of the character a quarter of the way
    // in (the cascade's leading edge — later characters are still fading in) and drops the filter once its last character has sharpened.
    // Landscape keeps the shipped per-character blur — it is already ideal.
    // The hero (`preloader`) plays under the lifting curtain, before any
    // scroll, and is the phone's LCP — a line-sized blurred box would become
    // the late LCP candidate; it keeps the per-character blur.
    const perLine = trigger.on !== "preloader" && window.matchMedia("(orientation: portrait)").matches;
    const lines = perLine
      ? Array.from(root.current.querySelectorAll<HTMLElement>(".title-line")).map((el) => {
          const own = chars.filter((c) => el.contains(c));
          return { el, first: chars.indexOf(own[0]), last: chars.indexOf(own[own.length - 1]), done: own.length === 0 };
        })
      : [];
    const writeLines = () => {
      for (const line of lines) {
        if (line.done) continue;
        const style = line.el.style;
        const lead = Math.floor(line.first + (line.last - line.first) / 4);
        const local = elapsed - p.delay - lead * p.stagger;
        const lastLocal = elapsed - p.delay - line.last * p.stagger;
        if (lastLocal >= p.blur) {
          style.filter = "none";
          style.willChange = "auto";
          line.done = true;
          continue;
        }
        style.willChange = "filter";
        style.filter = look(0, cssEase(progress(local, p.blur)), 0).filter;
      }
    };
    const write = () => {
      for (let i = settled; i < chars.length; i++) {
        const local = elapsed - p.delay - i * p.stagger;
        if (local <= 0) break; // later characters have not started yet
        if (local >= longest && i === settled) settled++;
        const style = chars[i].style;
        if (local >= longest) {
          // At rest: the same pixels as translateZ(0) rotateX(0) blur(0),
          // without the 3D transform and filter that keep it a layer.
          Object.assign(style, REST);
          continue;
        }
        const s = look(RISE(progress(local, p.rise)), cssEase(progress(local, p.blur)), cssEase(progress(local, p.fade)));
        style.willChange = perLine ? ANIMATING_LINE : ANIMATING;
        style.transform = s.transform;
        if (!perLine) style.filter = s.filter;
        style.opacity = s.opacity;
      }
      if (perLine) writeLines();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) write();
    });
    io.observe(root.current);
    void api.start({
      from: { elapsed: 0 },
      to: { elapsed: total },
      config: { duration: total, easing: easings.linear },
      onChange: ({ value }) => {
        elapsed = value.elapsed;
        if (visible) write();
      },
      onRest: () => {
        elapsed = total;
        if (visible) write();
      },
    });
    // The observer lives until every character has been written at rest.
    const stop = () => {
      io.disconnect();
      window.clearInterval(done);
    };
    const done = window.setInterval(() => {
      if (settled >= chars.length) stop();
    }, 500);
    release.current = stop;
  }, [go, api, pace, robot, trigger.on]);

  const at = robot ? 1 : 0;
  return (
    <Tag id={id} ref={setRoot} className={className}>
      <Chars lines={lines} render={(c, k) => <Char key={k} c={c} at={at} />} />
    </Tag>
  );
};

const Char = ({ c, at }: { c: string; at: number }) => (
  <span className="char-mask">
    <span className="hero-char" style={at === 1 ? REST : WAITING}>
      {c}
    </span>
  </span>
);

/**
 * The title's markup: lines, weighted segments, and each word's characters
 * kept together — an inline-block is a line-break opportunity, so where a
 * title may wrap (narrow screens) a bare run of character masks would break
 * mid-word. On a nowrap title it changes nothing.
 */
const Chars = ({ lines, render }: { lines: TitleLines; render: (c: string, key: string) => ReactNode }) => {
  const chars = (text: string, k: string) =>
    text.split(/(\s+)/).map((part, w) =>
      /^\s*$/.test(part) ? (
        part
      ) : (
        <span key={`${k}-w${w}`} className="whitespace-nowrap">
          {Array.from(part).map((c, i) => render(c, `${k}-${w}-${i}`))}
        </span>
      ),
    );
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          <span className="title-line">
          {line.map((seg, si) =>
            seg.weight ? (
              <span key={si} className={WEIGHT[seg.weight]}>
                {chars(seg.text, `${li}-${si}`)}
              </span>
            ) : (
              <Fragment key={si}>{chars(seg.text, `${li}-${si}`)}</Fragment>
            ),
          )}
          </span>
        </Fragment>
      ))}
    </>
  );
};
