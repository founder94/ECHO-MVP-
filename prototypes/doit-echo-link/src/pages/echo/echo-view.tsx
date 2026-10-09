import { animated, useSpring } from "@react-spring/web";
import { useMemo, useState } from "react";

import { useArrived } from "@flora/components/common/flight/arrival";
import { FluffScreen } from "@flora/components/common/flight/fluff-screen";
import { MigrationScreen } from "@flora/components/common/flight/migration-screen";
import { ScreenFade } from "@flora/components/common/flight/screen-fade";
import { LazyBackdropCanvas } from "@flora/components/common/scene/lazy-backdrop-canvas";
import { LazyDandelionCanvas } from "@flora/components/common/scene/lazy-dandelion-canvas";
import { CtaButton } from "@flora/components/ui/cta-button";
import { WordFlight } from "@flora/components/ui/word-flight";
import { homeHeroBackdrop } from "@flora/data/mocks/home";
import { ConnectScreen } from "@flora/views/home/connect-screen";
import { HeroHeadline } from "@flora/views/home/hero-headline";
import { HeroNav } from "@flora/views/home/hero-nav";
import { Preloader } from "@flora/views/home/preloader";
import { cameFromHome } from "@shared/handoff";
import { pageUrl } from "@shared/paths";
import { hasDraft } from "@shared/story-draft";

import {
  ECHO,
  OPERATOR,
  echoConnect,
  echoFluff,
  echoIntegrate,
  echoIntro,
  echoLeak,
  echoPreloader,
  echoScene,
  echoStem,
  heroWindow,
  navLeave,
} from "./content";

/**
 * ECHO 도입 — Flora 원본 Hero(views/home/hero.tsx)의 무대를 그대로 쓴다: 1127svh 스크롤 무대, 그 안의
 * 화면 높이 sticky 틀, 배경 그라디언트(Kindle) 위에 screen 합성되는 민들레·꽃·아이리스 장면, 화면별 ScreenFade.
 * 바뀐 것은 글과 버튼이 가는 곳뿐이다.
 *
 * 홈페이지 CTA 로 들어온 방문(?from=home 또는 이 탭의 기록)은 키홀 로딩을 건너뛰고 첫 화면에서 바로
 * 「내 이야기 시작하기」를 누를 수 있다(대표 지시 §7). 처음 온 방문은 키홀·성장 연출을 그대로 본다.
 */

const FOCUS = { tension: 170, friction: 28 };

/** 원본 HeroIntro 자리: 도입 설명 + 이야기 시작 버튼(같은 CtaButton). */
const EchoIntro = ({ storyHref }: { storyHref: string }) => {
  const live = useArrived();
  const [{ sharp }] = useSpring(() => ({ sharp: live ? 1 : 0, delay: live ? 420 : 0, config: FOCUS }), [live]);
  return (
    <div className="max-laptop:top-[33.4286%] max-laptop:left-8 max-tablet:top-auto max-tablet:bottom-6 max-tablet:left-6 max-tablet:w-[23.125rem] max-phone:static max-phone:w-full absolute top-[35%] left-10 flex w-[32.5rem] flex-col gap-6">
      <p className="font-display text-desc-ko leading-desc-ko text-foreground-desc font-medium whitespace-pre-line">
        <WordFlight text={echoIntro.lead} mode="rise" offset={220} />
      </p>
      <animated.span style={{ opacity: sharp, filter: sharp.to((v) => `blur(${(1 - v) * 7}px)`) }}>
        <CtaButton href={storyHref} label={echoIntro.cta} className="w-[15.5rem]" plateClassName="w-[12.3125rem] pl-5" />
      </animated.span>
    </div>
  );
};

/**
 * 원본 HeroPanel(중계 패널 · 가짜 실시간 값) 자리: 기존 이용자 경로.
 * 이 기기에 임시 글이 있으면 「이어서 쓰기」, 로그인은 연결되지 않았다고 그대로 말한다.
 */
const ReturningPanel = ({ storyHref }: { storyHref: string }) => {
  const live = useArrived();
  const [{ on }] = useSpring(() => ({ on: live ? 1 : 0, delay: live ? 300 : 0, config: FOCUS }), [live]);
  const [draft] = useState(hasDraft);
  const r = echoIntro.returning;
  return (
    <animated.aside
      aria-label={r.title}
      style={{ opacity: on }}
      className="bg-surface-glass shadow-glass backdrop-blur-glass rounded-panel max-laptop:right-8 max-tablet:right-6 max-tablet:bottom-auto max-tablet:top-[8.0625rem] max-tablet:w-[19.5625rem] max-phone:hidden absolute right-10 bottom-[1.7125rem] flex w-[24rem] flex-col gap-3 p-5"
    >
      <span aria-hidden className="bg-accent rounded-l-panel absolute inset-y-px left-0 w-[0.1875rem]" />
      <p className="text-panel-title text-scene-foreground m-0 font-semibold">{r.title}</p>
      {draft ? (
        <a href={storyHref} className="text-panel-link text-accent font-semibold underline-offset-4 hover:underline">
          {r.resume} →
        </a>
      ) : (
        <p className="text-panel-note text-foreground-note m-0 font-medium leading-desc-ko">{r.noDraft}</p>
      )}
      <p className="text-panel-note text-foreground-note m-0 font-medium leading-desc-ko">{r.login}</p>
    </animated.aside>
  );
};

export const EchoView = () => {
  const fromHome = useMemo(cameFromHome, []);
  const storyHref = pageUrl("story");
  const homeHref = pageUrl("home");

  return (
    <>
      {fromHome ? null : <Preloader {...echoPreloader} />}
      <main className="w-full">
        <section aria-labelledby="hero-title" className="bg-scene-backdrop text-scene-foreground relative isolate h-[1127svh] w-full">
          <div className="sticky top-0 h-svh w-full overflow-hidden">
            <LazyBackdropCanvas config={homeHeroBackdrop} fadeStart={echoScene.journey.darkenStart} fadeEnd={echoScene.journey.darkenEnd} />
            <LazyDandelionCanvas config={echoScene} />

            {/* 1 · Opening — ECHO 소개와 후킹 */}
            <ScreenFade {...heroWindow} scrim="hero" curtain={0} exit="inverse">
              <div className="max-phone:absolute max-phone:top-[7.15625rem] max-phone:left-5 max-phone:flex max-phone:w-[21.875rem] max-phone:flex-col max-phone:gap-8 contents">
                <HeroHeadline id="hero-title" lines={echoIntro.headline} />
                <EchoIntro storyHref={storyHref} />
              </div>
              <ReturningPanel storyHref={storyHref} />
            </ScreenFade>

            {/* 2 · Leak 자리 */}
            <ScreenFade {...echoLeak.window} scrim={echoLeak.scrim}>
              <MigrationScreen {...echoLeak} />
            </ScreenFade>

            {/* 3 · Stem 자리 */}
            <ScreenFade {...echoStem.window} scrim={echoStem.scrim}>
              <MigrationScreen {...echoStem} />
            </ScreenFade>

            {/* 5 · Integrate 자리(원본 순서대로 Fluff 앞에 그려지고 화면은 창 값으로 나뉜다) */}
            <ScreenFade {...echoIntegrate.window} scrim={echoIntegrate.scrim} entry="own" exit="own">
              <MigrationScreen {...echoIntegrate} />
            </ScreenFade>

            {/* 4 · Fluff 자리 */}
            <ScreenFade {...echoFluff.window} scrim="haze" exit="own">
              <FluffScreen
                left={echoFluff.left}
                right={echoFluff.right}
                split={echoFluff.split}
                run={echoFluff.run}
                enter={echoFluff.window.enter}
                leave={echoFluff.window.leave}
              />
            </ScreenFade>

            {/* 6 · Connect 자리 — 이야기 시작 CTA + 운영사 표기 */}
            <ScreenFade {...echoConnect.window} entry="own">
              <ConnectScreen {...echoConnect} cta={{ label: echoIntro.cta, href: storyHref }} operator={`${ECHO} ${OPERATOR}`} />
            </ScreenFade>

            <ScreenFade leave={navLeave} curtain={0}>
              <HeroNav
                brand={ECHO}
                operator={OPERATOR}
                links={[
                  { label: echoIntro.backHome, href: homeHref },
                  { label: echoIntro.cta, href: storyHref },
                ]}
                connect={{ label: echoIntro.cta, href: storyHref, count: "" }}
                menu={{ cta: { label: echoIntro.cta, href: storyHref }, social: [] }}
                leave={navLeave}
              />
            </ScreenFade>
          </div>
        </section>
      </main>
    </>
  );
};
