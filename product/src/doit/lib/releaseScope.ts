// 메뉴·주소에서 숨길 화면 목록(출시 1.0 · 2026-09-24 에 만든 자리).
// 2026-09-26 대표 「FINAL HUMAN UX / DESIGN / PRODUCT STRUCTURE」 §17·§20·§26: 지금 MVP 는 「말한다 → 이해한다 → 기억한다」까지.
// 준비 중인 행동·보상(Just Try·KEY·나비효과·등급)과 실제 엔진이 없는 사주·타로, 빈 준비 화면(공간·월드·방·알림)은 숨긴다.
// 화면 파일·주소 정의는 지우지 않는다(향후 기능). 숨긴 주소로 바로 들어오면 앱 홈으로 보낸다(routes.tsx).
export const HIDDEN_IN_RELEASE: Readonly<Record<string, string>> = {
  '/doit/just-try': 'Just Try · 나비효과 — 실제 행동·보상 구조 전(행동한다)',
  '/doit/key': 'KEY — 지급·원장 규칙 미확정(행동한다 이후)',
  '/doit/key/order/:packageId': 'KEY 주문 — 결제·환불 정책 미확정',
  '/doit/key/result': 'KEY 결과',
  '/doit/grade': '등급 — 산식 미확정(서버 grade_current = policy_not_set)',
  '/doit/fortune': '사주·타로 — 실제 엔진 없음(예시 명식)',
  '/doit/spaces': '공간 — 준비 화면뿐',
  '/doit/world': '월드 — 준비 화면뿐',
  '/doit/room': '방 — 준비 화면뿐',
  '/doit/notifications': '알림 — 준비 화면뿐',
  '/do-it/fortune': '예전 사주·타로 주소',
  '/do-it/grade': '예전 등급 주소',
  '/do-it/photo': '예전 사진 주소 → 사진 채우기(start-journey?edit=photos)',
  '/doit/choose': '예전 DO IT/ECHO 두 갈래 선택 — MVP 는 한 흐름',
  '/doit/first-record': '예전 A 7화면(첫 기록) — 지금은 ECHO 대화 + 나의 이해',
  '/doit/review': '예전 A 7화면(확인·수정)',
  '/doit/timeline': '예전 A 7화면(타임라인)',
  '/doit/value': '예전 A 7화면(가치)',
  '/doit/pattern': '예전 A 7화면(패턴)',
  '/doit/memory': '예전 A 7화면(선택 기억)',
  '/home': '예전 B구조 홈',
  '/start': '예전 B구조 시작',
  '/weather': '예전 B구조 날씨',
  '/weather-check': '예전 B구조 날씨 확인',
  '/story-start': '예전 B구조 이야기 시작',
  '/step/2': '예전 B구조 단계 질문',
  '/step/:n': '예전 B구조 단계 질문',
  '/understanding-check': '예전 B구조 이해 확인',
  '/white-door': '예전 B구조 화이트 도어',
  '/report': '예전 B구조 리포트',
  '/locker': '예전 B구조 보관함',
  '/next-journey': '예전 B구조 다음 여정',
  '/coming-soon/:feature': '「준비 중」 안내 화면',
};

export function visibleInRelease(to: string): boolean {
  return !Object.prototype.hasOwnProperty.call(HIDDEN_IN_RELEASE, to);
}
