import { useNavigate } from 'react-router-dom';
import { PRODUCT_ENTRY_PATH } from '@/lib/echo/appMode';
import { openGuide } from '@/lib/guide/guideContent';
import './welcome.css';

// 2026-10-04 대표 「모바일 전체 디자인 교체」: 앱(app.do-it.company)의 첫 실제 화면.
// 온보딩(심볼) 뒤 / 에서 보인다. 서비스 이름 ECHO 가 먼저 읽히고(회사 DO IT 는 작은 글씨),
// 「시작하기」는 기존 시작 흐름(/doit/start-journey)으로 이어 간다 — 동의·필드·세션 선행 조건은 그 화면이 그대로 처리한다.
// 빛나는 유리 링은 CSS/SVG 레이어(시안 이미지 배경 0 · 3D 모델 아님).
export default function AppWelcomePage() {
  const navigate = useNavigate();
  return (
    <main className="echo-welcome" aria-labelledby="echo-welcome-title">
      <div className="echo-welcome-lights" aria-hidden="true">
        <span className="echo-welcome-light echo-welcome-light--yellow" />
        <span className="echo-welcome-light echo-welcome-light--coral" />
        <svg className="echo-welcome-rings" viewBox="0 0 320 320" focusable="false">
          <circle cx="160" cy="160" r="118" />
          <circle cx="160" cy="160" r="86" />
          <ellipse cx="160" cy="160" rx="140" ry="52" transform="rotate(-24 160 160)" />
        </svg>
      </div>
      <section className="echo-welcome-panel">
        <p className="echo-welcome-brand">ECHO <span>by DO IT</span></p>
        <h1 id="echo-welcome-title">같이 하고 싶은 일이 있나요?</h1>
        <p className="echo-welcome-lead">어떤 만남을 원하는지 들려주세요.</p>
        <button type="button" className="echo-welcome-cta" onClick={() => navigate(PRODUCT_ENTRY_PATH)}>시작하기</button>
        {/* 짧은 기본 안내: 눌러야만 열린다(자동으로 띄우지 않음 · 시작 흐름·동의·인증 순서는 그대로). */}
        <button type="button" className="echo-welcome-guide" onClick={() => openGuide('start')}>처음이라면, 여기부터 보세요.</button>
      </section>
    </main>
  );
}
