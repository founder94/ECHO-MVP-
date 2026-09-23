// 메뉴에서 숨길 화면 목록 (출시 1.0 · 2026-09-24 에 만든 자리).
// 대표 2026-09-24 정정: "기능이 고장났다는 이유로 메뉴에서 임의 숨김 금지 · 사주·타로는 살아 있는 선택형 기능" →
// 41차는 이 목록을 비워 운영(37차)과 같은 메뉴를 유지한다. 공간·월드·Just Try·등급·알림·사주타로를 숨길지는 대표 결정(backlog).
// 숨기기로 결정되면 여기에 주소 한 줄씩만 넣는다(화면 파일·주소는 지우지 않는다).
export const HIDDEN_IN_RELEASE: Readonly<Record<string, string>> = {};

export function visibleInRelease(to: string): boolean {
  return !Object.prototype.hasOwnProperty.call(HIDDEN_IN_RELEASE, to);
}
