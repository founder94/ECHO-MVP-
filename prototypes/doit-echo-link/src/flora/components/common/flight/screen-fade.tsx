"use client";

/**
 * One screen of the flight, shown over its own stretch of the scroll.
 *
 * The frames of the design are moments of a single camera move (Figma "01
 * Hero" is the scene at 00:01, "02 The leak" at 00:06), so each screen's
 * interface is hung in the same sticky frame and given the window of stage
 * progress it belongs to. Fading is spring-driven off that progress rather
 * than mapped to it directly, so a flick of the wheel arrives as motion
 * instead of a jump.
 *
 * Arriving and leaving are two values, not one: a screen fades in where it
 * stands, and lifts a little as it goes. Two dense screens dissolving through
 * each other in the same corner is unreadable, so the windows are set to hand
 * over rather than overlap — and the rise is what makes the hand-over read as
 * one leaving rather than both smearing.
 *
 * The bands a screen reads against are drawn here rather than inside it, in a
 * layer that fades but never moves. They are the frame's own darkening: a band
 * that rose with the copy would carry its bottom edge up into view and draw a
 * seam across the scene.
 */

import { animated, config, to, useSpring } from "@react-spring/web";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ArrivalProvider } from "@flora/components/common/flight/arrival";
import { useRobot } from "@flora/components/common/robot-view";
import { useStageProgress } from "@flora/hooks/use-stage-progress";
import { onCurtainUp } from "@flora/lib/loading/curtain";
import { ramp } from "@flora/lib/scene/stage-progress";

/** How deep a screen's bands are — the frame of the scene behind it decides. */
export type ScrimDepth = "hero" | "veil" | "haze";

export interface ScreenWindowContent {
  /** Stage progress over which the screen arrives. Omitted: it starts on. */
  enter?: [number, number];
  /** Stage progress over which it leaves. */
  leave: [number, number];
}

export interface ScreenFadeProps extends ScreenWindowContent {
  scrim?: ScrimDepth;
  /**
   * For the screens that are already on when the page opens: they wait for
   * the preloader to lift and then arrive, this many ms after it starts. A
   * screen further down the flight has no use for it — the scroll is what
   * brings it in.
   */
  curtain?: number;
  /**
   * How the screen goes.
   *
   * `fade` — the default — takes the whole block out as one: it fades and lifts
   * a little, which is what a screen handing over to the next one should do.
   *
   * `inverse` plays the arrival backwards instead. The block **sinks** by the
   * distance it rose from rather than lifting off the top of it, and the
   * arrival is taken back from everything inside, so whatever assembled itself
   * on the way in comes apart the same way on the way out. It is for the screen
   * the page opens on, where the entrance is the thing the reader watched.
   *
   * `own` leaves the going to the screen itself. The block stays whole and in
   * place through the leave window — only its bands fade — and whatever is
   * inside reads the same window and takes itself out its own way. It is for a
   * screen whose exit is motion of its parts rather than of the block: the
   * amounts that fly off round the flower (`FluffScreen`).
   */
  exit?: "fade" | "inverse" | "own";
  /**
   * How the screen comes in. `fade` — the default — fades the block up over
   * the enter window. `own` leaves the block at full strength and lets the
   * screen bring its own parts in, reading the same window: for a screen whose
   * copy assembles itself, where a fade on top would only dim the first
   * letters of it. The arrival is then **not latched** — scrolled back above
   * the window, the screen takes its contents back — because nothing else is
   * hiding them there.
   */
  entry?: "fade" | "own";
  children: ReactNode;
}

/** How far a screen lifts on its way out, in rem. */
const RISE = 2;
/** And how far below its place it starts, on the way in. */
const ARRIVE = 1.5;

/** Where the block goes as it leaves, in rem, per kind of exit. */
const LEAVE_SHIFT: Record<NonNullable<ScreenFadeProps["exit"]>, number> = {
  fade: -RISE,
  inverse: ARRIVE,
  own: 0,
};

/**
 * Softer than it was (150/30). A screen that is *placed* rather than arriving
 * is the difference between an interface that comes up and one that appears,
 * and the extra couple of hundred milliseconds cost nothing: the screens
 * overlap by design, so a longer arrival simply has more of the one before it
 * to cross.
 */
const ARRIVING = { tension: 110, friction: 28 };

/**
 * Written out, never built: Tailwind reads these class names from source.
 *
 * Both the depth and the height are the screen's own and are read again on
 * every frame — the narrow ones darken different screens by different amounts
 * and over different distances — so each is a token the media queries re-set
 * rather than a measure written here.
 */
const BANDS: Record<ScrimDepth, { top: string; bottom: string }> = {
  hero: {
    top: "from-scrim-hero-top h-scrim-hero-top",
    bottom: "to-scrim-hero-bottom h-scrim-hero-bottom",
  },
  veil: {
    top: "from-scrim-veil-top h-scrim-veil-top",
    bottom: "to-scrim-veil-bottom h-scrim-veil-bottom",
  },
  haze: {
    top: "from-scrim-haze-top h-scrim-haze-top",
    bottom: "to-scrim-haze-bottom h-scrim-haze-bottom",
  },
};

/**
 * **The arrival lives in a child, so the animated frame never re-renders.**
 *
 * It used to be state on `ScreenFade` itself, set from the scroll — and every
 * time it flipped, the frame re-rendered with fresh interpolations. React then
 * diffs the style against *its own* last render, not against the DOM
 * react-spring has been writing straight into since, and where the two
 * disagree it writes nothing: after one jump down the page the opening
 * screen's frame was left at opacity 1 over the rest of the flight while its
 * spring read 0. Held here, the flag re-renders only the provider and what
 * reads it; the frame and its styles are rendered once.
 */
const ArrivalGate = ({
  gateRef,
  initial,
  children,
}: {
  gateRef: RefObject<((live: boolean) => void) | null>;
  initial: boolean;
  children: ReactNode;
}) => {
  const [live, setLive] = useState(initial);
  useEffect(() => {
    gateRef.current = setLive;
    return () => {
      gateRef.current = null;
    };
  }, [gateRef]);
  return <ArrivalProvider value={live}>{children}</ArrivalProvider>;
};

export const ScreenFade = ({
  enter,
  leave,
  scrim,
  curtain,
  exit = "fade",
  entry = "fade",
  children,
}: ScreenFadeProps) => {
  const ref = useRef<HTMLDivElement>(null);
  /* The robot form (D-016) has no curtain: a screen waiting on it is up and
     arrived from the first render, so the served HTML carries it visible. */
  const robot = useRobot();
  const [enterStart, enterEnd] = enter ?? [0, 0];
  const [leaveStart, leaveEnd] = leave;
  const [{ arrived, gone }, api] = useSpring(() => ({
    arrived: enter ? 0 : 1,
    gone: 0,
  }));
  const [{ raised }, raisedApi] = useSpring(() => ({
    raised: curtain === undefined || robot ? 1 : 0,
    config: ARRIVING,
  }));
  /* What the blocks inside are waiting for: a screen with a window opens when
     the scroll reaches it, a screen that is already on opens when the curtain
     goes up, and one with neither is simply open. Refs, not state — see
     `ArrivalGate`. */
  const openFromStart =
    enter === undefined && (curtain === undefined || robot);
  const arrivedHere = useRef(openFromStart);
  const leavingHere = useRef(false);
  const gate = useRef<((live: boolean) => void) | null>(null);
  const shownLive = useRef(openFromStart);
  const publish = useCallback(() => {
    const live = arrivedHere.current && !leavingHere.current;
    if (live === shownLive.current) return;
    shownLive.current = live;
    gate.current?.(live);
  }, []);

  useEffect(() => {
    if (curtain === undefined) return;
    return onCurtainUp(() => {
      raisedApi.start({ raised: 1, delay: curtain });
      if (enter === undefined) {
        arrivedHere.current = true;
        publish();
      }
    });
  }, [curtain, enter, raisedApi, publish]);

  const onProgress = useCallback(
    (progress: number) => {
      /* **Set, not sprung** — see `MigrationScreen`. A spring re-targeted every
         frame lags the page and, chasing a moving target, rings around it. The
         scroll is already smoothed once, upstream. */
      api.set({
        arrived: enter ? ramp(enterStart, enterEnd, progress) : 1,
        gone: ramp(leaveStart, leaveEnd, progress),
      });
      /* The blocks inside start the moment the window opens, not when the
         fade finishes: their own motion is the arrival. */
      /* A screen that brings itself in holds nothing up while the reader is
         above it — the block is not faded — so its arrival is not a latch:
         scrolled back above the window, it takes its contents back. */
      if (enter && entry === "own")
        arrivedHere.current = progress >= enterStart;
      else if (enter && progress >= enterStart) arrivedHere.current = true;
      /* …and it is taken back the moment the leave window opens, so they run
         their own arrival backwards while the screen goes. */
      if (exit === "inverse") leavingHere.current = progress >= leaveStart;
      publish();
    },
    [
      api,
      enter,
      enterStart,
      enterEnd,
      entry,
      exit,
      leaveStart,
      leaveEnd,
      publish,
    ],
  );

  useStageProgress(ref, onProgress);

  /* Built once: the same interpolations for the life of the frame. */
  const { shown, held, shift, hit } = useMemo(() => {
    const shown = to(
      [arrived, gone, raised],
      (here, away, up) => here * (1 - away) * up,
    );
    /* A screen that brings itself in, or takes itself out, is left at full
       strength while it does. */
    const held = to([arrived, gone, raised], (here, away, up) => {
      const coming = entry === "own" ? 1 : here;
      const going = exit === "own" ? 0 : away;
      return coming * (1 - going) * up;
    });
    /* Leaving in reverse, it goes back the way it came: down by the distance
       it rose from, not up off the top of it. Leaving on its own, it does not
       move at all. */
    const shift = to(
      [gone, raised],
      (away, up) =>
        `translate3d(0, ${away * LEAVE_SHIFT[exit] + (1 - up) * ARRIVE}rem, 0)`,
    );
    const hit = shown.to((value) => (value > 0.5 ? "auto" : "none"));
    return { shown, held, shift, hit };
  }, [arrived, gone, raised, entry, exit]);
  const band = scrim ? BANDS[scrim] : null;

  return (
    <>
      {band ? (
        <animated.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ opacity: shown }}
        >
          <div
            className={`${band.top} absolute inset-x-0 top-0 bg-gradient-to-b to-transparent`}
          />
          <div
            className={`${band.bottom} absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent`}
          />
        </animated.div>
      ) : null}

      {/* **The frame never catches anything; what stands in it does.** Every
          screen is a full-viewport layer, so the last one rendered lies over
          all the others — and the header is deliberately last. A frame that
          took the pointer itself would put a sheet of glass over the screen
          beneath it: the opening screen's call to action sat under exactly
          that and could be neither hovered nor clicked. So the layer is
          `none` and its children are `auto` — and `pointer-events` inherits,
          so that reaches everything inside them. A screen on its way out gives
          its children up too, because a thing at zero opacity is still a thing
          the pointer can find. */}
      <animated.div
        ref={ref}
        className="pointer-events-none absolute inset-0 [&>*]:[pointer-events:var(--screen-hit)]"
        style={{
          opacity: held,
          transform: shift,
          ...({ "--screen-hit": hit } as object),
        }}
      >
        <ArrivalGate gateRef={gate} initial={openFromStart}>
          {children}
        </ArrivalGate>
      </animated.div>
    </>
  );
};
