"use client";

/**
 * The client leaf that owns the dandelion scene's lifecycle.
 *
 * React holds the canvas and the gates; `DandelionScene` holds the WebGL. The
 * loop is on demand — the scene draws only while it is on screen and the tab is
 * visible, through the app-wide ticker, throttled by the device tier's frame
 * budget (optimize-3d-scene §4, §5).
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

import { useEffect, useRef, useState } from "react";

import { subscribeToTicker } from "@flora/lib/animation/ticker";
import { markBooted } from "@flora/lib/loading/boot-progress";
import { backdropIsReady, onBackdropReady } from "@flora/lib/loading/backdrop";
import {
  COARSE_POINTER_QUERY,
  frameBudget,
  readTier,
  sceneShouldFreeze,
} from "@flora/lib/scene/device";
import type { DandelionGeometry } from "@flora/lib/scene/dandelion/dandelion-geometry";
import { buildDandelionOffThread } from "@flora/lib/scene/dandelion/dandelion-geometry-off-thread";
import {
  DandelionScene,
  dandelionGeometryOptions,
  type DandelionSceneConfig,
} from "@flora/lib/scene/dandelion/dandelion-scene";
import {
  EMPTY_STAGE,
  measureStage,
  stageProgress,
} from "@flora/lib/scene/stage-progress";
import { readSceneTokens } from "@flora/lib/scene/tokens";

export interface DandelionCanvasProps {
  config: DandelionSceneConfig;
}

/** Start drawing a viewport early, so the scene is warm when it arrives. */
const IN_VIEW_MARGIN = "100% 0px";

/**
 * A beat between the backdrop painting and the plant starting to grow.
 *
 * Both land at once otherwise — the keyhole is cut and the thing inside it is
 * already moving in the same frame, which reads as the two being one event. A
 * held breath first, and the growth is something that happens *in* the hole
 * rather than something the hole arrived with.
 */
const GROWTH_DELAY = 700;

/**
 * How long after the last movement the plant counts the page as still, in ms.
 *
 * Long enough to cover the gaps between a wheel's notches — a plant that stood
 * up between two clicks of a mouse wheel would be twitching, not settling.
 */
const STILL_AFTER = 260;

/** How fast the tilt catches up with the pointer, per 60ths of a second. */
const POINTER_EASE = 0.08;

export const DandelionCanvas = ({ config }: DandelionCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DandelionScene | null>(null);
  const budgetRef = useRef(frameBudget(readTier()));
  const lastTimeRef = useRef(0);
  const progressRef = useRef(0);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const frozenRef = useRef(false);
  /** No hover to read on a touch screen — the head simply stands back up. */
  const coarseRef = useRef(false);
  /** The last progress the plant was told about, and when it last changed. */
  const movedAtRef = useRef(0);
  const lastProgressRef = useRef(-1);
  /**
   * **The plant waits for something to grow in front of.**
   *
   * Its growth is wall-clock, so left to itself behind a curtain it spends
   * itself unseen and the page opens on a flower that has already finished.
   * But waiting for the curtain is too late the other way: by then the keyhole
   * has been showing the page for seconds, and the one thing in it stands
   * still.
   *
   * So it starts the moment the **backdrop** has painted — which is the moment
   * the keyhole is cut, and the first moment anything of the page can be seen
   * at all. It grows through the wait, in the hole, and is well along by the
   * time the hole opens. Held before that the scene still draws, so the first
   * frame is ready and `prewarm` still counts toward the boot; nothing of the
   * plant advances.
   */
  const awakeRef = useRef(backdropIsReady());
  /** Stage geometry, measured on mount and on resize — never per frame. */
  const stageRef = useRef(EMPTY_STAGE);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /** Everything the scene needs once its buffers exist; returns its teardown. */
    function start(
      canvas: HTMLCanvasElement,
      particles: DandelionGeometry,
    ): (() => void) | undefined {
      let scene: DandelionScene;
      try {
        scene = new DandelionScene({
          canvas,
          tokens: readSceneTokens(document.documentElement),
          config,
          particles,
        });
      } catch (error) {
        // No WebGL, or the context was refused — the section's backdrop stands in.
        console.error("[dandelion] scene failed to start:", error);
        // The preloader is waiting on this; a scene that will never come is
        // still an answer, and the backdrop behind it is what there is to show.
        markBooted("scene");
        return undefined;
      }

      sceneRef.current = scene;

      /* **One step per frame, not all of them in one.** Compiling the programs,
         uploading the cards' textures and warming the composer is about a second
         of solid main thread; run in a single call it is a second in which
         nothing else on the page can move — measured at 1.1 s, and the preloader
         froze for exactly that long in the middle of its own count. Spread over
         frames the work is the same and the screen stays alive through it
         (optimize-3d-scene §3). */
      const steps = scene.prewarmSteps();
      let step = 0;
      let warming = requestAnimationFrame(function warm() {
        /* A step may be a promise — the shader compiles are handed to the driver
           to do off-thread where it can. Either way the next one waits for it. */
        void Promise.resolve(steps[step]()).then(() => {
          step += 1;
          if (step < steps.length) {
            warming = requestAnimationFrame(warm);
            return;
          }
          warming = 0;
          // Shaders compiled and the first frame drawn: this is the moment the
          // opening screen exists, and what the preloader has been counting.
          markBooted("scene");
        });
      });

      const tier = readTier();
      budgetRef.current = frameBudget(tier);
      // Reduced motion stops the scene animating *itself*; it does not freeze the
      // camera, because that motion is the visitor's own scrolling. The loop keeps
      // running with a zero delta, so the fly-through still answers the scroll
      // while the growth, sway and drift stay put.
      const frozen = sceneShouldFreeze(tier);
      frozenRef.current = frozen;
      if (frozen) scene.settle();

      let resizeFrame = 0;
      let lastWidth = window.innerWidth;
      const coarse = window.matchMedia(COARSE_POINTER_QUERY);
      coarseRef.current = coarse.matches;

      // Measured here, not in the loop — see `stage-progress.ts`. The gradient
      // behind reads the same stage the same way, so the two can never disagree
      // about where the page is.
      stageRef.current = measureStage(canvas);

      const applyResize = (): void => {
        resizeFrame = 0;
        stageRef.current = measureStage(canvas);
        scene.resize();
        budgetRef.current = frameBudget(readTier());
        if (frozen) scene.settle();
      };

      const onResize = (): void => {
        // iOS collapses the URL bar on scroll, which fires resize with a new
        // height and the same width. Re-allocating the framebuffer for that reads
        // as a whole-scene flash, so height-only changes are ignored on touch.
        const widthChanged = window.innerWidth !== lastWidth;
        lastWidth = window.innerWidth;
        if (coarse.matches && !widthChanged) return;
        if (resizeFrame) return;
        resizeFrame = requestAnimationFrame(applyResize);
      };

      const observer = new IntersectionObserver(
        ([entry]) => setRunning(entry.isIntersecting && !document.hidden),
        { rootMargin: IN_VIEW_MARGIN },
      );
      observer.observe(canvas);

      const onVisibility = (): void => {
        if (document.hidden) setRunning(false);
        else
          setRunning(canvas.getBoundingClientRect().top < window.innerHeight);
      };

      // **The pointer tilt.** Only for a fine pointer: there is no hover on touch,
      // and a tilt that never moves is a uniform doing nothing. The raw position
      // is stored here and eased in the loop — a tilt this small reads as jitter
      // if it tracks the pointer exactly.
      const onPointer = (event: PointerEvent): void => {
        if (coarse.matches) return;
        pointerTargetRef.current = {
          x: (event.clientX / window.innerWidth) * 2 - 1,
          y: (event.clientY / window.innerHeight) * 2 - 1,
        };
      };

      /* Not attached at all on touch, rather than attached and ignored: there is
         no hover on a phone, and the tilt is the only thing this listener feeds
         (optimize-3d-scene §11). */
      if (!coarse.matches)
        window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      const onPointerKind = (): void => {
        coarseRef.current = coarse.matches;
      };
      coarse.addEventListener("change", onResize);
      coarse.addEventListener("change", onPointerKind);

      return () => {
        if (warming) cancelAnimationFrame(warming);
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        observer.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        coarse.removeEventListener("change", onResize);
        coarse.removeEventListener("change", onPointerKind);
        setRunning(false);
        sceneRef.current = null;
        scene.dispose();
      };
    }

    /* **The flower grows in a worker.** `buildDandelion` is about a second of
       arithmetic on a phone — the largest task of the whole load, and on the
       page's thread it blocked hydration and the preloader's count. The worker
       hands back the same buffers, bit for bit; the scene starts when they
       land (optimize-3d-scene §3.5). */
    let cancelled = false;
    let teardown: (() => void) | undefined;
    void buildDandelionOffThread(dandelionGeometryOptions(config)).then(
      (particles) => {
        if (!cancelled) teardown = start(canvas, particles);
      },
    );
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [config]);

  useEffect(() => {
    let waking = 0;
    const stop = onBackdropReady(() => {
      waking = window.setTimeout(() => {
        awakeRef.current = true;
      }, GROWTH_DELAY);
    });
    return () => {
      stop();
      window.clearTimeout(waking);
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    lastTimeRef.current = performance.now();

    return subscribeToTicker(
      (time) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        // Scroll position only — cheap, and no layout is forced
        // (optimize-3d-scene §9). The stage's own geometry is cached, and the
        // read is straight: no second low-pass on top of Lenis.
        progressRef.current = stageProgress(stageRef.current, time);

        /* **Scrolling is read from the progress itself**, not from a listener
           on the wheel: what matters to the plant is whether the frame it
           stands in is moving, and that is this number changing. Lenis coasts
           for a while after the hand has gone, and a plant that stood up in
           the middle of that coast would be answering an event nobody sent. */
        if (Math.abs(progressRef.current - lastProgressRef.current) > 1e-5) {
          lastProgressRef.current = progressRef.current;
          movedAtRef.current = time;
        }
        const scrolling = time - movedAtRef.current < STILL_AFTER;

        scene.setProgress(progressRef.current);

        // Frame-rate independent, so the tilt settles at the same speed on a
        // capped tier. A frozen scene never follows the pointer at all.
        if (!frozenRef.current) {
          const target = pointerTargetRef.current;
          const eased = pointerRef.current;
          const k = 1 - Math.pow(1 - POINTER_EASE, Math.max(delta, 0) * 60);
          eased.x += (target.x - eased.x) * k;
          eased.y += (target.y - eased.y) * k;
          scene.setPointer(eased.x, eased.y);
        }

        /* The head answers the **raw** pointer, not the eased one the camera
           tilts with: that follower is slow on purpose, and a hover that lags
           half a second behind the hand is a hover nobody believes. The scene
           does its own settling. On a touch screen there is no hover to read,
           so it is told so and the plant stands back up. */
        scene.brush(
          frozenRef.current || coarseRef.current
            ? null
            : pointerTargetRef.current.x,
          pointerTargetRef.current.y,
          delta,
          scrolling,
        );

        scene.update(frozenRef.current || !awakeRef.current ? 0 : delta);
      },
      () => budgetRef.current,
    );
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // `lvh`/`lvw` size the drawing buffer against the largest viewport, so a
      // collapsing URL bar never re-allocates it. The compositor hints keep a
      // neighbouring repaint from invalidating the WebGL layer on WebKit.
      // `screen` composites the scene onto the gradient behind it the way
      // additive light works: the near-black clear leaves the gradient alone and
      // the particles only ever add to it.
      className="pointer-events-none absolute inset-0 block h-lvh w-lvw mix-blend-screen transform-gpu backface-hidden will-change-transform"
    />
  );
};
