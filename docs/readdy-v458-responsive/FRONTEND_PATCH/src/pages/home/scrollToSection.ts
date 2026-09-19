// 2026-09-16 반응형 수정: 홈 안의 앵커 이동(메뉴 ECHO·경험·기록, 푸터 ECHO·기록)을 고정 헤더 높이만큼 보정한다.
// 섹션이 overflow-hidden(ParallaxSection) 안에 있어 CSS scroll-margin 이 뷰포트까지 전달되지 않으므로
// 헤더 실측 높이를 빼서 window 를 직접 스크롤한다. 고정 px 값은 쓰지 않는다.
export const HOME_NAV_ATTR = 'data-echo-nav';

export function scrollToSectionBelowHeader(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  const nav = document.querySelector<HTMLElement>(`[${HOME_NAV_ATTR}]`);
  const headerHeight = nav ? nav.getBoundingClientRect().height : 0;
  const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  return true;
}
