/**
 * 실제 ECHO 서비스(앱)로 가는 주소 — 대표 지시(2026-10-10 「시안에서 멈추지 말고 실제 ECHO MVP 까지」).
 *
 * 이 시안(홈페이지 · ECHO 소개)은 화면만 맡고, 가입·로그인 · 목적·프로필 · ECHO Agent 대화 · 확인·정정 ·
 * 추천 · 선택 · 서로 선택 · 연결 · 첫 대화 · 결과 기록은 기존 실제 앱(product/ · Supabase 서버)이 한다.
 * 별도 모의 서비스를 만들지 않는다.
 *
 * 기본값은 QA 시험 앱. 운영으로 옮길 때는 빌드 환경값 VITE_ECHO_APP_URL 만 바꾼다(운영 반영은 대표 승인 뒤).
 */
const DEFAULT_APP = "https://echo-app-qa.netlify.app";

export const ECHO_APP_ORIGIN: string = (import.meta.env.VITE_ECHO_APP_URL as string | undefined)?.replace(/\/+$/, "") || DEFAULT_APP;

/** 실제 앱 안의 경로. start = 새 사용자는 시작, 로그인한 사용자는 저장된 단계부터 이어감(앱의 start-journey). */
export const echoAppUrl = (path: "/doit/start-journey" | "/login"): string => `${ECHO_APP_ORIGIN}${path}`;

/**
 * 미리보기 창(파일 모드 · 다른 페이지 안에 띄운 화면)에서는 다른 사이트로의 이동이 막힐 수 있어 새 창으로 연다.
 * 실제 사이트(http 경로)에서는 같은 창으로 이동한다.
 */
export const installExternalLinks = (): void => {
  const fileMode = document.querySelector<HTMLMetaElement>('meta[name="link-mode"]')?.content === "file";
  const framed = window.self !== window.top;
  if (!fileMode && !framed) return;
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const a = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.origin === window.location.origin || !/^https?:$/.test(a.protocol)) return;
    event.preventDefault();
    window.open(a.href, "_blank", "noopener");
  });
};
