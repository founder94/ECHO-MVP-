import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IS_BRAND_SITE } from '@/lib/siteRole';
import './app-back-button.css';

// 화면 안 뒤로가기 (대표 지시 2026-09-22). 홈 화면에 추가한 앱(PWA)은 브라우저 뒤로가기 버튼이 없어서 화면에 있어야 한다.
// - 위쪽 가운데 작은 알약 모양. 페이지마다 다른 머리글(왼쪽 심볼·오른쪽 링크)과 겹치지 않는 자리다.
// - 진입 화면(온보딩·랜딩·시작 흐름)과 이미 자기 뒤로가기가 있는 화면에서는 숨긴다(같은 버튼 두 개 금지).
// - 돌아갈 기록이 없으면(주소로 바로 들어온 경우) 앱은 시작 흐름, 브랜드는 첫 화면으로 보낸다. 빈 화면에 두지 않는다.
const HIDDEN_PATHS = new Set(['/', '/do-it/intro', '/do-it/hero', '/do-it/landing', '/doit/start-journey', '/auth/callback']);
// 자기 자신(.doit-back-pill)은 제외한다. 포함하면 "있다→숨김→없다→표시"를 무한 반복하며 화면을 막는다(2026-09-22 실제 발생, 수정).
const OWN_BACK_SELECTOR = '[aria-label="뒤로"], [aria-label="뒤로 가기"]:not(.doit-back-pill), .doit-product-topbar';
// 지연 불러오기 화면이 그려질 때까지 몇 번만 다시 확인한다(DOM 감시자 대신 시간 확인: 되먹임 고리가 생기지 않는다).
const RECHECK_DELAYS_MS = [0, 150, 500, 1200, 2500];
const FALLBACK_PATH = IS_BRAND_SITE ? '/' : '/doit/start-journey';

// 파스텔 대화 화면 위에서는 어두운 알약이 검은 띠처럼 보였다(대표 2026-09-25 Galaxy 「뒤로 버튼 뒤 검정 배경」) → 그 화면에서만 투명 알약.
const PASTEL_SELECTOR = '.echo-dialogue--pastel';
function pageIsPastel(): boolean {
  try { return !!document.querySelector(PASTEL_SELECTOR); } catch { return false; }
}

function pageHasOwnBack(): boolean {
  try { return !!document.querySelector(OWN_BACK_SELECTOR); } catch { return false; }
}

export default function AppBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const [ownBack, setOwnBack] = useState(false);
  const [onPastel, setOnPastel] = useState(false);
  const hiddenByPath = HIDDEN_PATHS.has(location.pathname.replace(/\/$/, '') || '/');

  useEffect(() => {
    if (hiddenByPath) return;
    const timers = RECHECK_DELAYS_MS.map((ms) => window.setTimeout(() => { setOwnBack(pageHasOwnBack()); setOnPastel(pageIsPastel()); }, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [location.pathname, hiddenByPath]);

  if (hiddenByPath || ownBack) return null;

  const goBack = () => {
    const state = window.history.state as { idx?: number } | null;
    if (typeof state?.idx === 'number' && state.idx > 0) navigate(-1);
    else navigate(FALLBACK_PATH, { replace: true });
  };
  return <button type="button" className={onPastel ? 'doit-back-pill doit-back-pill--on-pastel' : 'doit-back-pill'} onClick={goBack} aria-label="뒤로 가기"><span aria-hidden="true">‹</span>뒤로</button>;
}
