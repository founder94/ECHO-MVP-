// 2026-10-09 Codex 검수(PR #151 · 75c7295) P2 두 건: 움직임 줄이기 · 이용 안내 창이 열린 동안은 3D 그림 반복(three 루프)도 멈춘다.
// react-spring 은 원본 ReducedMotion 이 멈추지만 three 루프(원본 FrameGate · 워커 · Solaris · Lattice)는 따로 읽어야 한다.
const GUIDE_OPEN_CLASS = "echo-guide-open";

let reduced = false;
let watched = false;
const watch = () => {
  if (watched || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  watched = true;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced = mq.matches;
  mq.addEventListener?.("change", (e) => { reduced = e.matches; });
};

/** 방문자가 움직임 줄이기를 켰거나(OS 설정) 이용 안내 창이 열려 있으면 true — 장면 루프는 한 장만 그리고 멈춘다. */
export const pageMotionPaused = (): boolean => {
  watch();
  return reduced || document.documentElement.classList.contains(GUIDE_OPEN_CLASS);
};
