import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IS_APP_SITE } from '@/lib/siteRole';
import { APP_PASTEL, APP_ROOT_CLASS, themeColorFor } from '@/lib/themeColor';

// 2026-09-26 대표 PRE-DEPLOY FIX #2: 휴대폰 상단 막대 색(theme-color)을 화면 바탕에 맞춘다.
// 앱은 파스텔 첫 색으로 시작한다(index.html · manifest). 우주 화면(온보딩·히어로)과 검은 바탕 화면에서만 검정으로 바꾼다.
// 화면 모습(히어로 포함)은 바꾸지 않는다 — 상단 막대 색만 따라간다. 앱 빌드에서만 켠다.
export default function ThemeColorSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!IS_APP_SITE) return;
    const color = themeColorFor(pathname);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = color;
    // 첫 화면 파스텔 바탕 표시(index.html): 파스텔 앱 경로에서만 남긴다. 히어로·관리자는 원래 바탕 그대로.
    document.documentElement.classList.toggle(APP_ROOT_CLASS, color === APP_PASTEL);
  }, [pathname]);
  return null;
}
