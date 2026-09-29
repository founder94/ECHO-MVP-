import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IS_APP_SITE } from '@/lib/siteRole';
import { APP_LAUNCH_CLASS, APP_LAUNCH_FADE_MS, APP_LAUNCH_MIN_MS, APP_LAUNCH_OUT_CLASS, APP_PASTEL, APP_ROOT_CLASS, themeColorFor } from '@/lib/themeColor';

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
    // OS 시작 화면 다음에도 같은 그림을 잠깐 보여 준 뒤 온보딩으로 넘긴다.
    // 경로가 바뀌면 즉시 제거해 다른 화면을 가리지 않는다.
    // 2026-09-30: 페이지를 연 때부터 최소 APP_LAUNCH_MIN_MS(앱이 늦게 뜨면 뜨자마자) 보인 뒤 APP_LAUNCH_FADE_MS 동안 흐려지며 사라진다.
    // 그림은 온보딩 위에 덮여 있다가 걷히므로 사이에 빈 화면·다른 색이 끼지 않는다. 목적지(온보딩·로그인 뒤 화면)는 기존 라우팅 그대로.
    const root = document.documentElement;
    const clear = () => { root.classList.remove(APP_LAUNCH_CLASS); root.classList.remove(APP_LAUNCH_OUT_CLASS); };
    if (pathname.startsWith('/do-it/intro') && root.classList.contains(APP_LAUNCH_CLASS)) {
      const wait = Math.max(0, APP_LAUNCH_MIN_MS - performance.now());
      let done = 0;
      const fade = window.setTimeout(() => { root.classList.add(APP_LAUNCH_OUT_CLASS); done = window.setTimeout(clear, APP_LAUNCH_FADE_MS); }, wait);
      return () => { window.clearTimeout(fade); window.clearTimeout(done); clear(); };
    }
    clear();
  }, [pathname]);
  return null;
}
