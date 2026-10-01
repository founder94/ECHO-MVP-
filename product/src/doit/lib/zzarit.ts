// 2026-10-01 대표 「COMPLETE PRODUCT FLOW」 ZZARIT: 서버가 서로 고름(mutual) + 연결(match_id)을 확인한 뒤, 그 연결에서 한 번만.
// 이 기기 표시 기억일 뿐이다 — 연결을 열거나 상태를 바꾸지 않는다(연결은 서버가 이미 열었다).
export const ZZARIT_KEY = (matchId: string) => `echo:zzarit:${matchId}`;

/** 처음이면 true 를 돌려주고 본 것으로 기록한다. 저장이 막힌 환경은 한 번 보여 주되 기록은 하지 못한다. */
export function claimZzarit(matchId: string): boolean {
  try {
    if (localStorage.getItem(ZZARIT_KEY(matchId))) return false;
    localStorage.setItem(ZZARIT_KEY(matchId), '1');
  } catch { /* 저장이 막혀도 서버가 확인한 순간이니 한 번은 보여 준다 */ }
  return true;
}
