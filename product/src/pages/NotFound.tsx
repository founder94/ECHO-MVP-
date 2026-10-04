import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { IS_BRAND_SITE } from '@/lib/siteRole';

// 앱 틀(민트 + 짙은 청록 유리)은 앱·통합 빌드에서만 불러온다. 홈페이지(brand) 빌드는 이 줄이 빠진다(역할 값을 직접 비교).
if (import.meta.env.VITE_SITE_ROLE !== 'brand') void import('@/components/state-screens.css');

// 홈페이지: 회사 흑백(검정 바탕 · 흰 글자 · 은색 보조 선). 앱 CSS 에 의존하지 않는다.
const BRAND_PAGE: CSSProperties = { minHeight: '100svh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box', background: '#000', color: '#f2f3f5', textAlign: 'center', fontFamily: "'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif" };
const BRAND_ACTION: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48, padding: '0 24px', marginTop: 22, border: '1px solid #c9ced6', borderRadius: 999, color: '#f2f3f5', fontSize: 16, fontWeight: 700, textDecoration: 'none', boxSizing: 'border-box' };

// 없는 주소. 한국어 안내 + 작동하는 홈 이동. (예전에는 영어 개발 도구 안내가 그대로 나왔다.)
export default function NotFound() {
  if (IS_BRAND_SITE) {
    return (
      <main style={BRAND_PAGE}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.4, fontWeight: 800 }}>페이지를 찾을 수 없어요.</h1>
          <p style={{ margin: '12px 0 0', fontSize: 16, lineHeight: 1.7, color: '#c9ced6' }}>주소가 바뀌었거나 없는 페이지예요.</p>
          <Link to="/" style={BRAND_ACTION}>홈으로 돌아가기</Link>
        </div>
      </main>
    );
  }
  return (
    <main className="echo-state">
      <section className="echo-state-panel">
        <h1>페이지를 찾을 수 없어요.</h1>
        <p>주소가 바뀌었거나 없는 페이지예요.</p>
        <Link to="/" className="echo-state-action">홈으로 돌아가기</Link>
      </section>
    </main>
  );
}
