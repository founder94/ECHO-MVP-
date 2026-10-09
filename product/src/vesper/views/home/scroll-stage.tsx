"use client";

import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { FooterCopy, LoaderCopy } from "@vesper/data/mocks/home";
import { useProgressTrigger } from "@vesper/hooks/animation/use-progress-trigger";
import { subscribeToTicker } from "@vesper/lib/animation/ticker";
import { startIntro } from "@vesper/lib/scene/intro";
import { setOutro } from "@vesper/lib/scene/outro";
import {
  advanceTimeline,
  configureTimeline,
  sceneTimeline,
} from "@vesper/lib/scene/timeline";
import { getParams } from "./scene/adaptive";
import { Hero } from "./hero/hero";
import { HeroLattice } from "./hero/hero-lattice";
import { SectionBrain } from "./section-brain";
import { SectionGalaxy } from "./section-galaxy";
import { SiteFooter } from "./sections/site-footer";
import { SolarisSection } from "./sections/solaris-section";
import { OnyxSection } from "./sections/onyx-section";
import { toLvh } from "./hud/windows";
import { Loader } from "./loader/loader";
import { HydrateIdle, HydrateNear } from "@vesper/components/common/hydrate-near";
import { useRobot } from "@vesper/components/common/robot-view";

import { SceneHostLazy } from "./scene/scene-host-lazy";
import { SceneStill } from "./scene/scene-still";

/*
 * The blocks that hydrate late live in components of their own, memoised, so
 * `ScrollStage`'s own re-renders (the curtain lifting sets `introStarted`) never
 * reach a boundary that is still dehydrated. A dehydrated `<Suspense>` that
 * receives an update gives up hydrating and client-renders its fallback — the
 * server HTML is deleted and, with a `HydrateNear` gate watching that very
 * element, never comes back (the FAQ and footer vanished in the first try).
 */

/** Fixed overlays, hidden until the clock reaches them: each hydrates in an
 *  idle period after load instead of in the load's hydration. */
const StageOverlays = memo(function StageOverlays() {
  return (
    <>
      <Suspense fallback={null}>
        <HydrateIdle name="section-galaxy">
          <SectionGalaxy />
        </HydrateIdle>
      </Suspense>
      <Suspense fallback={null}>
        <HydrateIdle name="section-brain" after="section-galaxy">
          <SectionBrain />
        </HydrateIdle>
      </Suspense>
    </>
  );
});

/** Below the stage — several viewports down — each block hydrates as the
 *  visitor nears it (`HydrateNear`); its server HTML stands meanwhile. */
const ClosingBlocks = memo(function ClosingBlocks({
  outroRef,
  footer,
}: {
  outroRef: RefObject<HTMLDivElement | null>;
  footer: FooterCopy;
}) {
  return (
    <>
      {/* 2026-10-09 대표: 옛 홈페이지에서 가져온 설치 카드·이야기 9장면 카드·제작 영상은 모두 뺌(구매한 홈페이지가 먼저).
          Solaris(대표가 준 3D 장면)는 뇌 장면 다음에 한 화면 — 떠오르면서 뇌의 퇴장(outro)을 끈다(원본의 설치 카드 자리). */}
      <div ref={outroRef}>
        <Suspense fallback={null}>
          <HydrateNear id="solaris">
            <SolarisSection />
          </HydrateNear>
        </Suspense>
      </div>
      {/* 2026-10-09 대표: Onyx Cubes(대표가 준 네 번째 3D 장면)도 그대로 — Solaris 다음, 밝은 한 화면(원본의 흰 카드 자리). */}
      <Suspense fallback={null}>
        <HydrateNear id="onyx">
          <OnyxSection />
        </HydrateNear>
      </Suspense>
      {/* The footer is transparent over the live shader (like the cards), so
          nothing opaque covers the scene — the frame gate keeps drawing it. */}
      <Suspense fallback={null}>
        <HydrateNear id="site-footer">
          <SiteFooter copy={footer} />
        </HydrateNear>
      </Suspense>
    </>
  );
});

export interface ScrollStageProps {
  loader: LoaderCopy;
  footer: FooterCopy;
}

/**
 * The scroll document. Nothing here is visible — four viewport-tall tracks exist
 * purely to be measured; their progress advances the global clock that the WebGL
 * scene and the three fixed section overlays ({@link Hero}, {@link SectionGalaxy},
 * {@link SectionBrain}) read.
 *
 * Track 4 measures track 3 against the viewport *bottom* rather than its top,
 * which is what makes the clock run at double rate through its middle. That is
 * faithful to the original timeline, not an oversight.
 */
export const ScrollStage = ({ loader, footer }: ScrollStageProps) => {
  const trackOne = useRef<HTMLDivElement>(null);
  const trackTwo = useRef<HTMLDivElement>(null);
  const trackThree = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);

  // Flips true when the loader curtain lifts — gates the section reveals.
  // The robot form (D-016): no loader, a still of the scene, the copy at rest.
  const robot = useRobot();
  const [introOpen, setIntroStarted] = useState(false);
  const introStarted = introOpen || robot;

  const handleReady = useCallback(() => {
    startIntro();
    setIntroStarted(true);
  }, []);

  // Ease the scene clock toward the scroll position, harder on weaker tiers.
  // Driven by the shared ticker rather than by the render loop, so the overlays
  // keep moving even while the scene has stopped drawing.
  useEffect(() => {
    configureTimeline(getParams(window.innerWidth).progressLerp);

    let last = performance.now();
    return subscribeToTicker(
      () => {
        const now = performance.now();
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;
        advanceTimeline(delta);
      },
      () => 0,
    );
  }, []);

  const setTrack = useCallback(
    (index: number) =>
      ({ progress }: { progress: number }) =>
        sceneTimeline.setTrack(index, progress),
    [],
  );

  useProgressTrigger({
    elementRef: trackOne,
    start: "top top",
    end: "bottom top",
    onChange: setTrack(0),
  });
  useProgressTrigger({
    elementRef: trackTwo,
    start: "top top",
    end: "bottom top",
    onChange: setTrack(1),
  });
  useProgressTrigger({
    elementRef: trackThree,
    start: "top top",
    end: "bottom top",
    onChange: setTrack(2),
  });
  useProgressTrigger({
    elementRef: trackThree,
    start: "top bottom",
    end: "bottom bottom",
    onChange: setTrack(3),
  });

  // The Financial card floats up: fades the scene overlays and plays the brain's
  // exit, but the scene keeps drawing (the shader stays visible around the card).
  // The burst spans a full viewport of scroll (`top bottom` → `top top`), not half,
  // so it stays soft and gradual instead of detonating on the first nudge.
  useProgressTrigger({
    elementRef: outroRef,
    start: "top bottom",
    end: "top top",
    onChange: useCallback(
      ({ progress }: { progress: number }) => setOutro(progress),
      [],
    ),
  });

  return (
    <>
      {robot ? <SceneStill /> : <SceneHostLazy />}
      {!robot && <Loader copy={loader} onReady={handleReady} />}

      <main className="relative">
        {/* 2026-10-09 대표: Einstein–Rosen 격자는 첫 화면의 배경 효과(구슬 장면 위 · 글 아래). */}
        {!robot && <HeroLattice />}
        <Hero introStarted={introStarted} />
        <StageOverlays />

        <div aria-hidden className="pointer-events-none relative">
          {/* Each track is one clock unit; its height is the scroll distance that
              advances it. `toLvh(1)` (see SCROLL_TRACK_LVH) makes that longer than
              a viewport, so the scenes need more scroll to hand off. */}
          <div
            ref={trackOne}
            className="relative"
            style={{ height: toLvh(1) }}
          />
          <div
            ref={trackTwo}
            className="relative"
            style={{ height: toLvh(1) }}
          />
          <div
            ref={trackThree}
            className="relative"
            style={{ height: toLvh(1) }}
          />
          {/* Trailing space (not a track). Half a track keeps the closing content
              — and the outro-driven brain burst — right after the spin ends at
              clock 4, so there is no dead scroll where the brain sits still. */}
          <div className="relative" style={{ height: toLvh(0.5) }} />
        </div>

        <div className="relative z-10">
          {/* The Financial and FAQ cards float over the still-drawing scene — no
              opaque surface here, so the shader shows around them. They stack
              close together (small gap). */}
          <ClosingBlocks outroRef={outroRef} footer={footer} />
        </div>
      </main>
    </>
  );
};
