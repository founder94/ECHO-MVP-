"use client";
// 2026-10-09 대표 「ECHO 홈페이지 — 최신 채택안」 ③ + 「홈페이지 수정사항 — 최신 정정」: 1023.98px 이하는 데스크톱 vw 배치를 줄이지 않고 세로 배치.
// 순서 ① 첫 화면(제목 + 작은 스크롤 안내 + 안정된 뒤 구체 한 줄) → ② 짧은 브랜드 연출(구체 → 은하) 위에 회전 카드 세 문장 → ③ 영상 페이지 셋(이야기 → 확인·정정 → 직접 선택: 제목 + 한두 줄) → ④ FAQ → ⑤ JUST TRY. + 짧은 설명 + 「모바일 시작하기」 + 바닥글.
// 원본의 200lvh 트랙 셋·뇌 장면은 모바일에서 쓰지 않는다. 장면 시계(sceneTimeline)는 ② 구간 하나가 0→2(구체 흩어짐 → 은하)로만 움직인다. 데스크톱 시간표 숫자는 그대로.
// 글·버튼은 모두 일반 문서 흐름(in-flow)이라 WebGL·자산·관찰 실패와 무관하게 보인다.
import { Suspense, memo, useCallback, useEffect, useRef, type RefObject } from "react";

import { HydrateNear } from "@vesper/components/common/hydrate-near";
import { Inview } from "@vesper/components/common/robot-inview";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";
import type { FaqCopy, FooterCopy } from "@vesper/data/mocks/home";
import { useProgressTrigger } from "@vesper/hooks/animation/use-progress-trigger";
import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { HOME_V2 } from "@/pages/do-it/brand-home/copy";

import { LineBlur } from "./line-blur";
import { CARD_REVEAL, LETTER_FADE, UNIT_REVEAL, UNIT_REVEAL_FIRST_SCREEN } from "./reveal";
import { FaqSection } from "./sections/faq-section";
import { SiteFooter } from "./sections/site-footer";

/** 좌우 여백 24px(360px 이하 20px) — 대표 지시 모바일 기준. */
const GUTTER = "px-6 max-[360px]:px-5";
/** 대표 제목 clamp(36px, 9vw, 52px) · 행간 1.15 · 단어 단위 줄바꿈(주아체 400 하나). */
const TITLE = "font-general text-[clamp(36px,9vw,52px)] leading-[1.15] font-normal break-keep";
/** 본문 16px/1.55 · 보조 13px. */
const BODY = "font-general text-[16px] leading-[1.55] break-keep";
const AUX = "font-general text-[13px] leading-[1.5] break-keep";
/** 2026-10-09 대표 승인: 흰 카드 0 — 글은 장면 위에 바로(밝은 글자 · 얇은 윗줄 · 여백). 도착 연출(CARD_REVEAL)은 그대로. */
const CARD = `[perspective:1400px] ${GUTTER}`;
const CARD_FACE = "vesper-soft vesper-veil relative flex w-full origin-bottom flex-col gap-4 border-t border-white/15 pt-6 text-white";

/** ① 첫 화면 — 제목 + 작은 스크롤 안내. 구체 한 줄은 장면이 안정된 뒤(인트로 2.9초 뒤). 높이가 작으면(가로 휴대폰) 세로로 늘어난다(min-height). */
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
    <Inview mode="once" enabled={introStarted} delayIn={3200} {...UNIT_REVEAL_FIRST_SCREEN} className="flex flex-col gap-3">
      <p className={`m-0 max-w-[34rem] ${BODY}`}>{HOME_V2.sphereLine}</p>
    </Inview>
    <Inview mode="once" enabled={introStarted} delayIn={1400} {...UNIT_REVEAL_FIRST_SCREEN} className={`flex items-center gap-2 text-white/70 ${AUX}`}>
      <span>{HOME_V2.scrollHint}</span>
      <span aria-hidden className="vesper-scroll-hint block h-4 w-px bg-white/70" />
    </Inview>
  </section>
);

/** ② 짧은 브랜드 연출 — 이 구간을 지나는 동안 구체가 흩어져 은하가 된다(장면 시계 0→2). 글은 위에 붙어(sticky) 함께 간다 — 회전 카드 세 문장. */
const AgentScene = ({ trackRef }: { trackRef: RefObject<HTMLDivElement | null> }) => (
  <div ref={trackRef} className="relative" style={{ height: "150lvh" }}>
    <div className={`pointer-events-none sticky top-0 flex min-h-[100lvh] flex-col justify-end gap-3 pt-[6rem] pb-10 text-white ${GUTTER}`}>
      <Inview mode="always" immediateOut={false} from={UNIT_REVEAL.from} to={UNIT_REVEAL.to} config={UNIT_REVEAL.config} className="vesper-soft flex flex-col gap-4 border-t border-white/20 pt-5">
        {HOME_V2.cards.map((line, index) => (
          <p key={line} className="m-0 flex items-baseline gap-3">
            <span className="shrink-0 font-tag text-[13px] leading-[1.6] text-white/60">{String(index + 1).padStart(2, "0")}</span>
            <span className="font-general text-[clamp(22px,6vw,30px)] leading-[1.3] break-keep">{line}</span>
          </p>
        ))}
      </Inview>
    </div>
  </div>
);

/** ③ 영상 페이지 — 제목 하나 + 설명 한두 줄(이용 안내 승인 문장 그대로). */
const PageBlock = ({ id, page, className = "" }: { id?: string; page: (typeof HOME_V2.pages)[number]; className?: string }) => (
  <section id={id} aria-label={page.title} className={`${CARD} ${className}`}>
    <Inview mode="always" immediateOut={false} from={CARD_REVEAL.from} to={CARD_REVEAL.to} config={CARD_REVEAL.config} className={CARD_FACE}>
      <h2 className={`m-0 ${TITLE}`}>{page.title}</h2>
      <div className="flex flex-col gap-2">
        {page.lines.map((line) => (
          <p key={line} className={`m-0 ${BODY}`}>{line}</p>
        ))}
      </div>
    </Inview>
  </section>
);

export interface MobileStageProps {
  faq: FaqCopy;
  footer: FooterCopy;
  introStarted: boolean;
}

export const MobileStage = memo(function MobileStage({ faq, footer, introStarted }: MobileStageProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // 데스크톱으로 넘어갈 때 이 구간이 올려 둔 시계를 되돌린다(같은 시계를 공유).
  useEffect(() => () => { sceneTimeline.setTrack(0, 0); sceneTimeline.setTrack(1, 0); }, []);

  // ② 구간 하나가 장면 시계를 0→2 로: track0·track1 을 같이 올린다(원본 식 p1+p2+p3+p4 그대로, p3·p4 = 0).
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
      <HeroMobile introStarted={introStarted} />
      <AgentScene trackRef={trackRef} />
      <div className="relative z-10">
        <Suspense fallback={null}>
          <HydrateNear id="how">
            <PageBlock page={HOME_V2.pages[0]} className="mt-4" />
          </HydrateNear>
        </Suspense>
        <PageBlock page={HOME_V2.pages[1]} className="mt-10" />
        <PageBlock id="choice" page={HOME_V2.pages[2]} className="mt-10" />
        <div className="mt-10">
          <Suspense fallback={null}>
            <HydrateNear id="faq">
              <FaqSection copy={faq} />
            </HydrateNear>
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <HydrateNear id="contact">
            <SiteFooter copy={footer} />
          </HydrateNear>
        </Suspense>
      </div>
    </main>
  );
});
