/**
 * @fileoverview Utility function for smooth scrolling to elements or positions
 * Handles both scrolling to element IDs and numeric positions
 * Temporarily disables scroll state during animation if scroll is enabled
 */

//if lenis
import { useScroll } from "@vesper/hooks/smooth-scroll/use-scroll";
//endif

/**
 * 2026-10-09(모의 검사): 머리글이 화면 위에 고정(fixed)돼 있어, 앵커(#how·#faq…)로 가면 제목이 머리글 밑에 숨었다.
 * 고정 머리글 아래쪽 + 8px 만큼 덜 내려간다(CSS scroll-margin-top 과 같은 값 · 머리글이 없으면 0).
 */
export const anchorOffset = (): number => {
  const header = document.querySelector("header");
  if (!header || getComputedStyle(header).position !== "fixed") return 0;
  return Math.max(0, Math.round(header.getBoundingClientRect().bottom + 8));
};

export const scrollTo = (id?: string | number, immediate?: boolean) => {
  //if lenis
  const isEnabled = useScroll.getState().isEnableScroll;
  //endif

  if (typeof id === "string") {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    //if lenis
    if (isEnabled) {
      useScroll.setState({ isEnableScroll: false });
    }
    //endif

    setTimeout(() => {
      // Codex 12차(b133e1d): 50ms 사이에 자리표(HydrateNear)가 실제 블록으로 바뀔 수 있다 → 그때 다시 찾는다.
      const target = document.getElementById(id) ?? el;
      window.scrollTo({
        top: Math.max(0, getDistanceFromTop(target) - anchorOffset()),
        behavior: immediate ? "instant" : "smooth",
      });
    }, 50);
  } else {
    setTimeout(() => {
      window.scrollTo({
        top: Number(id) || 0,
        behavior: immediate ? "instant" : "smooth",
      });
    }, 50);
  }

  if (isEnabled) {
    setTimeout(() => {
      useScroll.setState({ isEnableScroll: true });
    }, 100);
  }

  function getDistanceFromTop(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return rect.top + scrollTop;
  }
};
