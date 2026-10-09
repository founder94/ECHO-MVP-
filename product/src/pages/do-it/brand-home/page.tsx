// 2026-10-08 대표 「홈페이지는 회사 얼굴 · GetLayers 구매(Vesper · Solaris · Einstein–Rosen) · 내가 준 코드 그대로(색·글씨체·3D 효과) · 거기에 글만 넣어 · 온보딩은 유지」
// 홈페이지 = src/vesper(원본 Vesper 사이트) 그대로. 글은 ./copy.ts(승인 문구). 옛 홈페이지(지구 그림·4장)는 2026-10-05 잠금을 대표가 10/8 풀어 교체.
// 앱(app.do-it.company)은 이 화면을 쓰지 않는다(라우터가 brand 역할에서만 연결).
import { useEffect } from 'react';
import GuideHost from '@/components/guide/GuideHost';
import { APP_ORIGIN, appUrl } from '@/lib/siteRole';
import { INSTALL_PATH } from '@/pages/do-it/landing/components/BrandSections';
import { AdaptiveGrid } from '@vesper/components/common/grid';
import { ReducedMotion } from '@vesper/components/common/reduced-motion';
import { SiteHeader } from '@vesper/components/common/site-header';
import { ScrollLayout } from '@vesper/layouts/scroll-layout';
import { HomeView } from '@vesper/views/home';
import '@vesper/vesper.css';
import './brand-home.css';

export { BRAND_HOME_COPY, STORIES } from './copy';

export default function BrandHomePage() {
  // 원본 globals.css 의 루트 글자 크기(vw 사다리)·바탕색은 홈페이지가 열려 있을 때만(html.vesper).
  // Codex 10차: 지금 화면 글은 원본 영어 → 열려 있는 동안 lang="en"(법적 고지 줄은 lang="ko"). 글을 한글로 넣을 때 되돌린다.
  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.getAttribute('lang');
    root.classList.add('vesper');
    root.setAttribute('lang', 'en');
    return () => {
      root.classList.remove('vesper');
      if (prevLang === null) root.removeAttribute('lang'); else root.setAttribute('lang', prevLang);
    };
  }, []);
  return (
    <>
      <ScrollLayout>
        <AdaptiveGrid />
        <ReducedMotion />
        <SiteHeader />
        <HomeView />
      </ScrollLayout>
      <GuideHost theme="brand" extra={{ install: <p className="bh-guide-install">설치는 앱 주소({APP_ORIGIN.replace('https://', '')})에서 해요. 이 회사 홈페이지는 설치하지 않아도 돼요. <a href={appUrl(INSTALL_PATH)}>앱 주소에서 설치하기<span aria-hidden="true">↗</span></a></p> }} />
    </>
  );
}
