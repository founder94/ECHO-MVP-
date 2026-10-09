import { useCallback, type MouseEvent } from "react";

import { PreloadRevealDiv, PreloadRevealNav } from "@clarix/components/clarix/preload-reveal";
import { Preloader } from "@clarix/components/clarix/preloader";
import { SceneCanvas } from "@clarix/components/clarix/scene-canvas";
import { SplitTitle } from "@clarix/components/clarix/split-title";
import { RobotProvider } from "@clarix/components/common/robot-view";
import { useScroll } from "@clarix/hooks/smooth-scroll/use-scroll";
import { pageUrl, publicUrl } from "@shared/paths";
import { saveHandoff } from "@shared/handoff";

import { ANIMATED_VIEWPORTS, SCENE_AT, homeCopy as c } from "./content";

/**
 * DOIT COMPANY 홈페이지 — Clarix 원본 화면(views/home.tsx)의 층 구조·id·z 순서를 그대로 두고 글만 바꾼다.
 * 프레임 루프(lib/scene/clarix.ts)가 id 로 움직이는 층: word1–3 · glass-container · glass-gradient ·
 * phase4/5/6-container · phase6-footer · odometer-numbers. 원본처럼 이 층들의 조상은 위치 지정이 없다.
 *
 * 원본과 다른 점(대표 지시서 기준):
 * - 휴대폰도 같은 고정 층 + 세로 화면 변형(portrait:)으로 장면 전체를 재생(정지 사진 0 · mobile-flow.ts).
 * - 고객사 로고 띠·숫자 통계·이메일 칸·바닥글 링크 묶음 삭제(사실이 아닌 것으로 보일 수 있음).
 * - 본문 색 #111 · 보조 #202020 · 제목 #050505 · 정착 opacity 1 · 본문 500 · 국소 밝은 막(.scrim-soft).
 */

const HI_TOP = "flex justify-between text-label font-medium uppercase tracking-label text-ink-2";
const BODY = "text-body font-medium leading-body text-ink-1 keep-all";
const DISPLAY =
  "m-0 font-light text-display leading-display tracking-tight2 text-ink keep-all whitespace-nowrap max-md:whitespace-normal";
const LINE = "h-px bg-spectrum";
const CTA =
  "inline-flex min-h-tap items-center gap-3 rounded-pill border border-ink bg-transparent px-10 py-3.5 text-cta font-semibold text-ink no-underline transition-[background-color,translate] duration-[var(--duration-hover)] ease-css hover:-translate-y-lift hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

/** 설명 글: 문장 하나가 한 줄(.sentence — PC 는 한 줄 고정, 휴대폰은 넘치면 고르게 두 줄). */
const Lines = ({ lines, className }: { lines: readonly string[]; className: string }) => (
  <p className={className}>
    {lines.map((l) => (
      <span key={l} className="sentence">
        {l}
      </span>
    ))}
  </p>
);

const Symbol = ({ className }: { className: string }) => (
  <img src={publicUrl("brand/doit-symbol.png")} alt="" aria-hidden="true" className={`symbol-on-light ${className}`} />
);

/** 서비스로 넘어가기 — 같은 브랜드 안에서 이어지게 짧게 덮고(보기 전환이 있으면 그것으로) 이동한다. */
const useGoToService = () =>
  useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    saveHandoff("home");
    const href = event.currentTarget.href;
    document.documentElement.classList.add("leaving-to-echo");
    window.setTimeout(() => window.location.assign(href), 420);
  }, []);

export const HomeView = () => {
  const goToService = useGoToService();
  const lenis = useScroll((s) => s.lenis);
  const serviceHref = pageUrl("echo", { from: "home" });

  // 메뉴 「회사 소개」「ECHO」 → 해당 장면의 스크롤 위치(원본 26 화면 = 진행 0→1).
  const toScene = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, at: number) => {
      event.preventDefault();
      const y = at * ANIMATED_VIEWPORTS * window.innerHeight;
      if (lenis) lenis.scrollTo(y, { duration: 2.2 });
      else window.scrollTo({ top: y, behavior: "smooth" });
      history.replaceState(null, "", event.currentTarget.hash);
    },
    [lenis],
  );

  return (
    <RobotProvider robot={false}>
      <div className="h-page">
        <Preloader total={100} />

        {/* 메뉴가 데려가는 장면의 실제 자리(스크립트 없이 해시로 열어도 그 장면) */}
        <span id="company" aria-hidden="true" className="pointer-events-none absolute left-0 h-px w-px" style={{ top: `${SCENE_AT.company * ANIMATED_VIEWPORTS * 100}vh` }} />
        <span id="echo" aria-hidden="true" className="pointer-events-none absolute left-0 h-px w-px" style={{ top: `${SCENE_AT.echo * ANIMATED_VIEWPORTS * 100}vh` }} />

        <header>
          <PreloadRevealDiv from="top" className="absolute top-10 left-12.5 z-5 max-md:left-gutter max-md:top-6">
            <a href={pageUrl("home")} className="flex items-center gap-3 no-underline" aria-label={`${c.brand.name} 홈`}>
              <Symbol className="h-9 w-auto max-md:h-8" />
              <span className="text-brand font-semibold tracking-brand text-ink">{c.brand.name}</span>
            </a>
          </PreloadRevealDiv>
          <SplitTitle
            tag="h1"
            trigger={{ on: "preloader" }}
            pace="hero"
            lines={c.hero.title}
            className="halo pointer-events-none absolute top-[43%] left-12.5 z-2 m-0 -translate-y-1/2 font-light text-hero leading-hero whitespace-nowrap text-ink keep-all portrait:z-4 max-md:left-gutter max-md:top-[30%] max-md:whitespace-normal max-md:pr-gutter"
          />
          <PreloadRevealNav
            from="top"
            label="주요 메뉴"
            className="absolute top-10 right-12.5 z-5 flex flex-col items-end gap-3 max-md:top-6 max-md:right-gutter max-md:gap-0"
          >
            {c.nav.map((item) =>
              item.id === "start" ? (
                <a key={item.id} href={serviceHref} onClick={goToService} className="nav-link">
                  {item.label} <span aria-hidden="true" className="nav-arrow">{c.navArrow}</span>
                </a>
              ) : (
                <a key={item.id} href={`#${item.id}`} onClick={(e) => toScene(e, SCENE_AT[item.id])} className="nav-link">
                  {item.label}
                </a>
              ),
            )}
          </PreloadRevealNav>
          <PreloadRevealDiv
            from="bottom"
            className="scrim-soft absolute bottom-12.5 left-12.5 z-5 flex w-max flex-col text-ink portrait:left-6.5 max-md:right-gutter max-md:left-gutter! max-md:bottom-8 max-md:w-auto"
          >
            <div className={`${HI_TOP} mb-5`}>
              <span>{c.hero.label}</span>
            </div>
            <Lines lines={c.hero.text} className={`${BODY} m-0`} />
          </PreloadRevealDiv>
        </header>

        <main>
          {/* ② 이야기 장면 — 원본 흐름 제목 자리(첫 화면 아래 34.375rem 에서 시작해 모델 뒤로 지나간다). */}
          <div className="absolute top-[calc(100vh+34.375rem)] left-0 z-2 flex w-full flex-col portrait:z-4">
            <div className="mb-150 pl-12.5 max-md:pl-gutter max-md:pr-gutter">
              <SplitTitle tag="h2" trigger={{ on: "inview" }} lines={c.story.title} className={`halo ${DISPLAY}`} />
            </div>
            <div className="flex w-full flex-col items-end px-12.5 max-md:px-gutter">
              <div className="scrim-soft text-right max-md:text-left">
                <div className={`${LINE} mb-8 w-full`} />
                <Lines lines={c.story.text} className={`${BODY} m-0 text-lead`} />
              </div>
            </div>
          </div>

          {/* 장면: 고정 WebGL 두 장 + 날아가는 단어(이야기 · 이해 · 연결) */}
          <div>
            <div id="clarix-stage">
              <SceneCanvas />
              <div aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-2 h-screen w-full perspective-words portrait:z-4">
                {c.words.map((word, i) => (
                  <div
                    key={word}
                    id={`word${i + 1}`}
                    className="absolute top-1/2 left-1/2 m-0 px-[0.2em] py-0 font-medium text-word whitespace-nowrap text-ink opacity-0 [transform:translate3d(-50%,-50%,0)_rotateY(0deg)]"
                  >
                    {Array.from(word).map((ch, j) => (
                      <span key={j} className="-mx-[0.04em] inline-block px-[0.04em]">
                        {ch}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ④ 유리 패널 — 회사가 만드는 서비스 방식 */}
          <section
            id="glass-container"
            aria-label={c.glass.label}
            className="pointer-events-none fixed bottom-0 left-0 z-10 box-content h-screen w-full border-t border-glass-40 bg-glass-15 backdrop-blur-veil [transform:translateY(100vh)]"
          >
            <div
              id="glass-gradient"
              className="pointer-events-auto absolute top-1/2 left-1/2 h-[calc(100%-8rem)] w-[calc(100%-8rem)] overflow-hidden rounded-none [transform:translate(-50%,-50%)_scale(0.65)] max-lg:h-[calc(100%-5rem)] max-lg:w-[calc(100%-4rem)] max-md:h-[calc(100%-3rem)] max-md:w-[calc(100%-2rem)]"
            >
              <img src={publicUrl("assets/gradient.jpg")} alt="" className="absolute top-0 left-0 z-1 h-full w-full object-cover opacity-50" />
              <div className="glass-read absolute top-0 left-0 z-2 flex h-full w-full flex-col justify-between p-8 text-ink max-md:p-5">
                <SplitTitle
                  tag="h2"
                  id="phase3-title"
                  trigger={{ on: "stage", id: "phase3-title" }}
                  lines={c.glass.title}
                  className="m-0 max-w-none font-light text-display leading-display tracking-tight2 text-ink keep-all"
                />
                <div className="flex items-end justify-between gap-8 max-lg:flex-col-reverse max-lg:items-start">
                  <div className="text-label font-medium text-ink-2">{c.glass.label}</div>
                  <ol className="m-0 flex list-none items-end gap-15 p-0 max-lg:gap-8 max-md:w-full max-md:flex-col max-md:items-stretch max-md:gap-4">
                    {c.glass.steps.map((s) => (
                      <li key={s.index} className="stat-rule relative flex flex-col gap-3 pl-stat-pad max-md:flex-row max-md:items-baseline max-md:gap-4">
                        <div className="font-light text-stat leading-none text-ink max-md:w-stat-num max-md:shrink-0 max-md:text-stat-sm">{s.index}</div>
                        <div className="flex flex-col gap-1">
                          <span className="text-step font-semibold text-ink">{s.name}</span>
                          <span className={`${BODY} text-step-desc`}>{s.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* ⑤ 통제권 — 유리 패널이 떠난 뒤의 나뉜 블록 */}
          <div
            id="phase4-container"
            className="will-change-[transform,opacity] pointer-events-none fixed top-0 left-0 z-5 flex h-screen w-full items-end justify-end opacity-0 [transform:translateY(50px)]"
          >
            <div className="flex h-screen w-auto flex-col items-start justify-end px-12.5 pt-16 pb-16 [pointer-events:inherit] max-md:w-full max-md:px-gutter max-md:pb-10">
              <div className="scrim-soft flex flex-col items-start portrait:-mx-2">
                <div className="inline-block text-left">
                  <SplitTitle tag="h2" id="phase4-title" trigger={{ on: "stage", id: "phase4-title" }} lines={c.control.title} className={`${DISPLAY} mt-0 text-left`} />
                  <div className={`${LINE} mx-0 my-10 w-full max-md:my-6`} />
                </div>
                <Lines lines={c.control.text} className={`${BODY} m-0 text-left`} />
              </div>
            </div>
          </div>

          {/* ⑥ D 심볼 입자 조립 — 회사 브랜드 장면 */}
          <div id="phase5-container" className="will-change-[transform,opacity] pointer-events-none fixed top-0 left-0 z-4 h-screen w-full opacity-0">
            <SplitTitle
              tag="h2"
              id="phase5-title-1"
              trigger={{ on: "stage", id: "phase5-title-1" }}
              lines={c.company.top}
              className={`${DISPLAY} absolute top-10 left-12.5 text-left max-md:top-24 max-md:left-gutter`}
            />
            <Lines lines={c.company.text} className={`scrim-soft ${BODY} absolute bottom-10 left-12.5 m-0 text-left max-md:bottom-32 max-md:left-gutter`} />
            <SplitTitle
              tag="h2"
              id="phase5-title-2"
              trigger={{ on: "stage", id: "phase5-title-2" }}
              lines={c.company.bottom}
              className={`${DISPLAY} absolute right-12.5 bottom-10 text-right max-md:right-gutter max-md:bottom-10`}
            />
          </div>

          {/* ⑦ 마지막 장면 제목 — 모델 뒤 */}
          {/* 원본은 이 제목이 모델 뒤(z 2)였으나, 마지막에 흩어지는 D 입자와 모델에 가려 읽히지 않아 앞(z 4)으로 올린다(대표 지시 §6). */}
          <div id="phase6-container" className="will-change-[transform,opacity] pointer-events-none fixed top-0 left-0 z-4 flex h-screen w-full items-center justify-center opacity-0">
            <SplitTitle
              tag="h2"
              id="phase6-title"
              trigger={{ on: "stage", id: "phase6-title" }}
              lines={c.finale.title}
              className="halo pointer-events-none absolute top-[28vh] left-0 m-0 w-full -translate-y-1/2 px-gutter text-center font-light text-finale leading-hero whitespace-nowrap text-ink keep-all max-md:text-[min(30px,calc((100vw-32px)/15))]"
            />
          </div>
        </main>

        {/* 바닥글 — 마지막에 아래에서 올라온다. 서비스로 들어가는 주요 CTA.
            대표 지시(2026-10-09 「ECHO 창을 투명하게 · 뒤 배경이 보이게」): 흰 유리 판(채움·흐림·그림자)을 없애고
            얇은 테두리만 남긴다. 글자는 글자 뒤에만 깔리는 옅은 막(.scrim-soft)으로 읽힌다. */}
        <div id="phase6-footer" className="pointer-events-none fixed top-0 left-0 z-4 h-screen w-full [transform:translateY(100vh)] [&_*]:pointer-events-auto">
          <footer className="absolute right-12.5 bottom-10 left-12.5 flex flex-col overflow-hidden rounded-4xl border border-ink/15 bg-transparent p-12 text-ink max-md:right-gutter max-md:bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:left-gutter max-md:p-6">
            <div className="flex items-end justify-between gap-10 max-md:flex-col max-md:items-start max-md:gap-6">
              <div className="scrim-soft flex flex-col">
                <h2 className="m-0 mb-4 text-service font-semibold tracking-tight2 text-ink">{c.footer.service}</h2>
                <Lines lines={c.footer.text} className={`${BODY} m-0`} />
              </div>
              <span className="scrim-soft inline-flex">
                <a href={serviceHref} onClick={goToService} className={CTA}>
                  {c.footer.cta} <span aria-hidden="true">{c.footer.ctaArrow}</span>
                </a>
              </span>
            </div>
            <div className="mt-10 mb-5 h-px bg-veil-15 max-md:mt-6 max-md:mb-4" />
            <div className="scrim-soft flex items-center justify-between gap-4 max-md:flex-col max-md:items-start max-md:gap-2">
              <span className="flex items-center gap-2 text-sign font-semibold text-ink-1">
                <Symbol className="h-6 w-auto" />
                {c.footer.sign}
              </span>
              <span className="text-sign font-medium text-ink-2">{c.footer.copyright}</span>
            </div>
          </footer>
        </div>
      </div>
    </RobotProvider>
  );
};
