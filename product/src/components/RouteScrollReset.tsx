import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// 2026-10-10 기기 호환: 화면을 옮기면(PUSH·REPLACE) 새 화면을 맨 위부터 보인다 — 앞 화면에서 내려 둔 위치가 그대로 남아
// 새 화면 중간(아래 버튼 근처)부터 열리던 문제. 「뒤로·앞으로」(POP)는 브라우저가 되살리는 위치를 그대로 둔다.
// 주소에 #이 있으면(설정 #install 등) 그 자리로 가는 화면 동작을 막지 않는다. 그리는 것 0.
export default function RouteScrollReset() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return; }
    if (navigationType === 'POP' || hash) return;
    try { window.scrollTo(0, 0); } catch { /* 스크롤을 못 다루는 환경 */ }
    // pathname 이 바뀔 때만(같은 화면의 ?step 등 검색어 변화는 각 흐름이 맡는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}
