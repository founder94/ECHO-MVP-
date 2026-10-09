/**
 * @fileoverview Utility function for smooth scrolling to elements or positions
 * Handles both scrolling to element IDs and numeric positions
 * Temporarily disables scroll state during animation if scroll is enabled
 */

//if lenis
import { useScroll } from "@vesper/hooks/smooth-scroll/use-scroll";
//endif

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
        top: getDistanceFromTop(target),
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
