// 출시 1.0 에서 메뉴에 보이지 않게 하는 화면 (대표 2026-09-24 "출시 1.0 진행해").
// 처음 온 사람이 기능 없는 "준비 중" 화면이나 지금 동작하지 않는 기능으로 들어가 헷갈리지 않게 한다.
// 화면 파일과 주소는 지우지 않는다(주소를 직접 치면 그대로 열린다). 기능이 열리면 여기서 한 줄만 지우면 다시 보인다.
export const HIDDEN_IN_RELEASE: Readonly<Record<string, string>> = {
  '/doit/spaces': '공간 — 참여·미션 기능 없음(준비 중 화면)',
  '/doit/world': '월드 — 기능 없음(준비 중 화면)',
  '/doit/just-try': 'Just Try — 보상·추천 기능 전부 준비 중',
  '/doit/grade': '등급 가이드 — 등급 기능 없음(예시 데이터)',
  '/doit/notifications': '알림 — 알림 기능 없음(준비 중 화면)',
  '/doit/fortune': '사주·타로 — 사주는 준비 중, 타로 서버(openai-chat v2)가 app.do-it.company 주소를 허용하지 않아 앱에서 실패',
};

export function visibleInRelease(to: string): boolean {
  return !Object.prototype.hasOwnProperty.call(HIDDEN_IN_RELEASE, to);
}
