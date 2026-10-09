/**
 * 홈페이지 → ECHO 로 넘어온 방문인지 기억한다(이 탭 안에서만 · sessionStorage).
 * ECHO 도입은 홈페이지 CTA 로 들어온 사람에게 긴 로딩·키홀 연출을 다시 강제하지 않는다(대표 지시 §7).
 * 개인 정보는 담지 않는다.
 */
const KEY = "doit-echo-link:from";

export type HandoffFrom = "home";

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const saveHandoff = (from: HandoffFrom): void => safe(() => sessionStorage.setItem(KEY, from), undefined);

/** 주소의 ?from=home 이 우선, 없으면 이 탭에서 홈페이지를 거쳐 왔는지. */
export const cameFromHome = (): boolean => {
  if (new URLSearchParams(window.location.search).get("from") === "home") return true;
  return safe(() => sessionStorage.getItem(KEY) === "home", false);
};
