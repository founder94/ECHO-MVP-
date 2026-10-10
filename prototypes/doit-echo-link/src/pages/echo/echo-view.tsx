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
import { echoAppUrl } from "@shared/echo-app";
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
 * 「모바일로 시작하기」(= 실제 ECHO 앱)를 누를 수 있다(대표 지시 §7). 처음 온 방문은 키홀·성장 연출을 그대로 본다.
 */

const FOCUS = { tension: 170, friction: 28 };

/** 원본 HeroIntro 자리: 도입 설명 + 이야기 시작 버튼(같은 CtaButton). */
const EchoIntro = ({ startHref }: { startHref: string }) => {
  const live = useArrived();
  const [{ sharp }] = useSpring(() => ({ sharp: live ? 1 : 0, delay: live ? 420 : 0, config: FOCUS }), [live]);
  return (
    <div className="max-laptop:top-[33.4286%] max-laptop:left-8 max-tablet:top-auto max-tablet:bottom-6 max-tablet:left-6 max-tablet:w-[23.125rem] max-phone:static max-phone:w-full absolute top-[35%] left-10 flex w-[32.5rem] flex-col gap-6">
      <p className="font-display text-desc-ko max-phone:text-[18px] leading-desc-ko text-foreground-desc font-medium whitespace-pre-line text-balance">
        <WordFlight text={echoIntro.lead} mode="rise" offset={220} />
      </p>
      {/* 휴대폰: 버튼을 폭 전체로(누르기 쉽게) · 버튼 위 한 줄 후킹 배지 — 뒤 빛줄기 위에서도 읽히게 짙은 밤색 바탕(실측 360: 2.63:1 → 배지). */}
      <animated.div className="flex flex-col gap-3" style={{ opacity: sharp, filter: sharp.to((v) => `blur(${(1 - v) * 7}px)`) }}>
        <p className="text-panel-note max-phone:text-[15px] text-foreground-desc m-0 w-fit rounded-full bg-[#010b24]/80 px-3.5 py-1.5 font-semibold leading-desc-ko">{echoIntro.hook}</p>
        <CtaButton
          href={startHref}
          label={echoIntro.cta}
          className="w-[15.5rem] max-phone:w-full"
          plateClassName="w-[12.3125rem] max-phone:w-auto max-phone:flex-1 max-phone:text-[16px] pl-5"
        />
      </animated.div>
    </div>
  );
};

/**
 * 원본 HeroPanel(중계 패널 · 가짜 실시간 값) 자리: 기존 이용자 경로(2026-10-10 실제 앱 연결).
 * 로그인하면 실제 앱이 계정의 진행 상태(목적·프로필·대화·연결)를 읽어 끝낸 단계를 다시 시키지 않고 이어간다.
 * 이 기기에 시안 때 적어 둔 글이 있으면 그 글을 볼 수 있는 길만 남긴다(자동으로 서버에 보내지 않음).
 */
const ReturningPanel = ({ loginHref, storyHref }: { loginHref: string; storyHref: string }) => {
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
      <a href={loginHref} className="text-panel-link text-accent font-semibold underline-offset-4 hover:underline">
        {r.login} →
      </a>
      <p className="text-panel-note text-foreground-note m-0 font-medium leading-desc-ko">{r.loginHint}</p>
      {draft ? (
        <a href={storyHref} className="text-panel-note text-foreground-note font-medium underline underline-offset-4">
          {r.draft}
        </a>
      ) : null}
    </animated.aside>
  );
};

export const EchoView = () => {
  const fromHome = useMemo(cameFromHome, []);
  const storyHref = pageUrl("story");
  // 「모바일로 시작하기」 = 실제 ECHO 앱(가입·기존 사용자 이어가기 · Agent 대화 · 추천 · 서로 선택 · 대화). 시안 이야기 쓰기 쪽이 아니다.
  const startHref = echoAppUrl("/doit/start-journey");
  const loginHref = echoAppUrl("/login");
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
                <EchoIntro startHref={startHref} />
              </div>
              <ReturningPanel loginHref={loginHref} storyHref={storyHref} />
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
              <ConnectScreen {...echoConnect} cta={{ label: echoIntro.cta, href: startHref }} operator={`${ECHO} ${OPERATOR}`} />
            </ScreenFade>

            <ScreenFade leave={navLeave} curtain={0}>
              <HeroNav
                brand={ECHO}
                operator={OPERATOR}
                links={[
                  { label: echoIntro.backHome, href: homeHref },
                  { label: echoIntro.cta, href: startHref },
                ]}
                connect={{ label: echoIntro.cta, href: startHref, count: "" }}
                menu={{ cta: { label: echoIntro.cta, href: startHref }, social: [] }}
                leave={navLeave}
              />
            </ScreenFade>
          </div>
        </section>
      </main>
    </>
  );
};
