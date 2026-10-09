"use client";
// 2026-10-09 대표 「ECHO 홈페이지 — 최신 채택안」 ③: 1023.98px 이하는 데스크톱 vw 배치를 줄이지 않고 세로 배치.
// 순서 ① 후킹 문구 + 입자 구체 + 설명 + 시작 버튼 → ② 이용 방법 → ③ 짧은 브랜드 연출(구체 → 은하) + ECHO Agent 소개 → ④ 서로의 선택 → ⑤ FAQ + 마지막 시작 버튼 + 바닥글.
// 원본의 200lvh 트랙 셋·뇌 장면은 모바일에서 쓰지 않는다. 장면 시계(sceneTimeline)는 ③ 구간 하나가 0→2(구체 흩어짐 → 은하)로만 움직인다. 데스크톱 시간표 숫자는 그대로.
// 글·버튼은 모두 일반 문서 흐름(in-flow)이라 WebGL·자산·관찰 실패와 무관하게 보인다.
import { Suspense, memo, useCallback, useEffect, useRef, type RefObject } from "react";

import { HydrateNear } from "@vesper/components/common/hydrate-near";
import { Inview } from "@vesper/components/common/robot-inview";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";
import { useRobot } from "@vesper/components/common/robot-view";
import { PressableLink } from "@vesper/components/ui/pressable";
import type { FaqCopy, FooterCopy } from "@vesper/data/mocks/home";
import { useProgressTrigger } from "@vesper/hooks/animation/use-progress-trigger";
import { GHOST } from "@vesper/lib/springs/interaction";
import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { HOME_V2, HOW_PATH } from "@/pages/do-it/brand-home/copy";

import { HeroLattice } from "./hero/hero-lattice";
import { LineBlur } from "./line-blur";
import { CARD_REVEAL, LETTER_FADE, UNIT_REVEAL, UNIT_REVEAL_FIRST_SCREEN } from "./reveal";
import { SendRequest } from "./send-request";
import { FaqSection } from "./sections/faq-section";
import { SiteFooter } from "./sections/site-footer";

/** 좌우 여백 24px(360px 이하 20px) — 대표 지시 모바일 기준. */
const GUTTER = "px-6 max-[360px]:px-5";
/** 대표 제목 clamp(36px, 9vw, 52px) 두께 300 · 행간 1.15 · 단어 단위 줄바꿈. */
const TITLE = "font-general text-[clamp(36px,9vw,52px)] leading-[1.15] font-light break-keep";
/** 본문 16px/1.55 · 보조 13px. */
const BODY = "font-general text-[16px] leading-[1.55] break-keep";
const AUX = "font-general text-[13px] leading-[1.5] break-keep";
/** 흰 카드(원본 Vesper 의 밝은 하단 카드) — 화면 가장자리에서 띄워 뒤 장면이 보인다. */
const CARD = "mx-auto w-[calc(100%-3rem)] max-[360px]:w-[calc(100%-2.5rem)] [perspective:1400px]";
const CARD_FACE = "relative flex w-full origin-bottom flex-col gap-4 border border-white/10 bg-white p-6 text-black max-[360px]:p-5";

/** ① 첫 화면 — 제목·설명·선택권 안내·버튼이 한 화면에 함께. 높이가 작으면(가로 휴대폰) 세로로 늘어난다(min-height). */
const HeroMobile = ({ introStarted }: { introStarted: boolean }) => (
  <section
    id="hero"
    aria-label={HOME_V2.heroTitle}
    className={`relative z-10 flex min-h-[100lvh] flex-col justify-end gap-4 pt-[6rem] pb-10 text-white ${GUTTER}`}
  >
    <LineBlur active={introStarted} letters={HOME_V2.heroTitle.length} delay={200}>
      <TextEngine tag="h1" mode="once" enabled={introStarted} delayIn={200} {...LETTER_FADE} className={TITLE}>
        {HOME_V2.heroTitle}
      </TextEngine>
    </LineBlur>
    <Inview mode="once" enabled={introStarted} delayIn={500} {...UNIT_REVEAL_FIRST_SCREEN} className="flex flex-col gap-3">
      <p className={`m-0 max-w-[34rem] ${BODY}`}>{HOME_V2.heroDesc}</p>
      <p className={`m-0 text-white/80 ${AUX}`}>{HOME_V2.heroChoice}</p>
    </Inview>
    <Inview mode="once" enabled={introStarted} delayIn={700} {...UNIT_REVEAL_FIRST_SCREEN} className="flex flex-wrap items-center gap-x-3 gap-y-1 font-tag text-[13px] uppercase leading-[1.2]">
      {HOME_V2.tags.map((tag, index) => (
        <span key={tag} className="flex items-center gap-3">
          {index > 0 && <span aria-hidden className="size-[0.1875rem] bg-white" />}
          {tag}
        </span>
      ))}
    </Inview>
    <Inview mode="once" enabled={introStarted} delayIn={820} {...UNIT_REVEAL_FIRST_SCREEN} className="flex flex-col gap-3">
      <SendRequest />
      <PressableLink
        href={HOW_PATH}
        interaction={GHOST}
        className="flex min-h-[48px] items-center justify-center border px-5 font-general text-[16px] leading-[1.2] font-medium"
      >
        {HOME_V2.how}
      </PressableLink>
    </Inview>
  </section>
);

/** ② 이용 방법(이용 안내 「처음이라면」 승인 문장 + 다섯 순서). 실제 ECHO 화면은 승인된 캡처가 없어 넣지 않는다(자료 미확보). */
const HowCard = () => (
  <section id="how" aria-label={HOME_V2.howTitle} className={CARD}>
    <Inview mode="always" immediateOut={false} from={CARD_REVEAL.from} to={CARD_REVEAL.to} config={CARD_REVEAL.config} className={CARD_FACE}>
      <h2 className={`m-0 ${TITLE}`}>{HOME_V2.howTitle}</h2>
      <p className={`m-0 ${BODY}`}>{HOME_V2.howLead}</p>
      <ol className="m-0 flex list-none flex-col gap-3 border-t border-black/15 p-0 pt-4">
        {HOME_V2.howSteps.map((step, index) => (
          <li key={step} className={`flex gap-3 ${BODY}`}>
            <span className="shrink-0 font-tag text-[13px] leading-[1.6] text-black/60">{String(index + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </Inview>
  </section>
);

/** ③ 짧은 브랜드 연출 — 이 구간을 지나는 동안 구체가 흩어져 은하가 된다(장면 시계 0→2). 글은 위에 붙어(sticky) 함께 간다. */
const AgentScene = ({ trackRef }: { trackRef: RefObject<HTMLDivElement | null> }) => (
  <div ref={trackRef} className="relative" style={{ height: "150lvh" }}>
    <div className={`pointer-events-none sticky top-0 flex min-h-[100lvh] flex-col justify-end gap-3 pt-[6rem] pb-10 text-white ${GUTTER}`}>
      <Inview mode="always" immediateOut={false} from={UNIT_REVEAL.from} to={UNIT_REVEAL.to} config={UNIT_REVEAL.config} className="flex flex-col gap-3">
        <p className="m-0 font-tag text-[13px] uppercase leading-[1.2] text-white/70">{HOME_V2.agentEyebrow}</p>
        <h2 className={`m-0 ${TITLE}`}>
          {HOME_V2.agentTitle[0]}
          <br />
          {HOME_V2.agentTitle[1]}
        </h2>
        <p className={`m-0 max-w-[34rem] ${BODY}`}>{HOME_V2.agentBody}</p>
      </Inview>
    </div>
  </div>
);

/** ④ 서로의 선택·정보 공개 방식(이용 안내 「추천과 서로의 선택」 승인 문장). */
const ChoiceCard = () => (
  <section id="choice" aria-label={HOME_V2.choiceTitle} className={`${CARD} mt-[1.5rem]`}>
    <Inview mode="always" immediateOut={false} from={CARD_REVEAL.from} to={CARD_REVEAL.to} config={CARD_REVEAL.config} className={CARD_FACE}>
      <h2 className={`m-0 ${TITLE}`}>{HOME_V2.choiceTitle}</h2>
      <p className={`m-0 ${BODY}`}>{HOME_V2.choiceBody}</p>
      <ul className="m-0 flex list-none flex-col gap-3 border-t border-black/15 p-0 pt-4">
        {HOME_V2.choicePoints.map((point) => (
          <li key={point} className={`flex gap-3 ${BODY}`}>
            <span aria-hidden className="mt-[0.7em] size-[0.375rem] shrink-0 bg-black" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </Inview>
  </section>
);

export interface MobileStageProps {
  faq: FaqCopy;
  footer: FooterCopy;
  introStarted: boolean;
}

export const MobileStage = memo(function MobileStage({ faq, footer, introStarted }: MobileStageProps) {
  const robot = useRobot();
  const trackRef = useRef<HTMLDivElement>(null);

  // 데스크톱으로 넘어갈 때 이 구간이 올려 둔 시계를 되돌린다(같은 시계를 공유).
  useEffect(() => () => { sceneTimeline.setTrack(0, 0); sceneTimeline.setTrack(1, 0); }, []);

  // ③ 구간 하나가 장면 시계를 0→2 로: track0·track1 을 같이 올린다(원본 식 p1+p2+p3+p4 그대로, p3·p4 = 0).
  useProgressTrigger({
    elementRef: trackRef,
    start: "top bottom",
    end: "bottom top",
    onChange: useCallback(({ progress }: { progress: number }) => {
      sceneTimeline.setTrack(0, progress);
      sceneTimeline.setTrack(1, progress);
    }, []),
  });

  return (
    <main id="top" className="relative">
      {!robot && <HeroLattice />}
      <HeroMobile introStarted={introStarted} />
      <div className="relative z-10">
        <Suspense fallback={null}>
          <HydrateNear id="how">
            <HowCard />
          </HydrateNear>
        </Suspense>
      </div>
      <AgentScene trackRef={trackRef} />
      <div className="relative z-10">
        <Suspense fallback={null}>
          <HydrateNear id="choice">
            <ChoiceCard />
          </HydrateNear>
        </Suspense>
        <div className="mt-[1.5rem]">
          <Suspense fallback={null}>
            <HydrateNear id="faq">
              <FaqSection copy={faq} />
            </HydrateNear>
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <HydrateNear id="site-footer">
            <SiteFooter copy={footer} />
          </HydrateNear>
        </Suspense>
      </div>
    </main>
  );
});
