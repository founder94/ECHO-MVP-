import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRODUCT_ENTRY_PATH } from '@/lib/echo/appMode';
import { openGuide } from '@/lib/guide/guideContent';
import './welcome.css';

// 2026-10-04 대표 「모바일 전체 디자인 교체」: 앱(app.do-it.company)의 첫 실제 화면.
// 온보딩(심볼) 뒤 / 에서 보인다. 서비스 이름 ECHO 가 먼저 읽히고(회사 DO IT 는 작은 글씨),
// 「시작하기」는 기존 시작 흐름(/doit/start-journey)으로 이어 간다 — 동의·필드·세션 선행 조건은 그 화면이 그대로 처리한다.
// 빛나는 유리 링은 CSS/SVG 레이어(시안 이미지 배경 0 · 3D 모델 아님).
// 「나중에 보기」는 이 기기에만 기억한다(다른 기기와 맞추지 않음). 저장이 막힌 환경에서도 화면 이용은 그대로다.
const HINT_KEY = 'echo.welcomeHintDismissed';
const readDismissed = () => { try { return window.localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
export default function AppWelcomePage() {
  const navigate = useNavigate();
  const [hintGone, setHintGone] = useState(readDismissed);
  const dismissHint = () => { setHintGone(true); try { window.localStorage.setItem(HINT_KEY, '1'); } catch { /* 저장 실패해도 이용에는 영향 없음 */ } };
  return (
    <main className="echo-welcome" aria-labelledby="echo-welcome-title">
      <div className="echo-welcome-lights" aria-hidden="true">
        <span className="echo-welcome-light echo-welcome-light--yellow" />
        <span className="echo-welcome-light echo-welcome-light--coral" />
        <svg className="echo-welcome-rings" viewBox="0 0 400 400" focusable="false">
          <defs>
            <linearGradient id="ew-teal" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#7fe9d6" stopOpacity=".55" />
              <stop offset=".55" stopColor="#2fb7c4" stopOpacity=".5" />
              <stop offset="1" stopColor="#b8f3ff" stopOpacity=".6" />
            </linearGradient>
            <linearGradient id="ew-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe08a" stopOpacity=".6" />
              <stop offset=".6" stopColor="#ffb08a" stopOpacity=".55" />
              <stop offset="1" stopColor="#ff8f86" stopOpacity=".5" />
            </linearGradient>
          </defs>
          <g transform="rotate(-28 200 200)">
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--body" cx="200" cy="200" rx="150" ry="104" stroke="url(#ew-teal)" />
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--inner" cx="200" cy="200" rx="150" ry="104" />
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--edge" cx="200" cy="200" rx="165" ry="119" />
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--edge" cx="200" cy="200" rx="135" ry="89" />
          </g>
          <g transform="rotate(24 200 232)">
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--body" cx="200" cy="232" rx="138" ry="92" stroke="url(#ew-gold)" />
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--inner" cx="200" cy="232" rx="138" ry="92" />
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--edge" cx="200" cy="232" rx="153" ry="107" />
            <ellipse className="echo-welcome-ribbon echo-welcome-ribbon--edge" cx="200" cy="232" rx="123" ry="77" />
          </g>
        </svg>
        <span className="echo-welcome-floor" />
      </div>
      <section className="echo-welcome-panel">
        <p className="echo-welcome-brand">ECHO <span>by DO IT</span></p>
        <h1 id="echo-welcome-title">같이 하고 싶은 일이 있나요?</h1>
        <p className="echo-welcome-lead">어떤 만남을 원하는지 들려주세요.</p>
        <button type="button" className="echo-welcome-cta" onClick={() => navigate(PRODUCT_ENTRY_PATH)}>시작하기</button>
        {/* 짧은 기본 안내: 눌러야만 열린다(자동으로 띄우지 않음 · 시작 흐름·동의·인증 순서는 그대로). */}
        {!hintGone && (
          <div className="echo-welcome-hint" role="group" aria-label="처음 도움말">
            <p>처음이라면 짧은 안내를 먼저 볼 수 있어요. 안 봐도 시작하는 데 아무 문제 없어요.</p>
            <div>
              <button type="button" className="echo-welcome-guide" onClick={() => openGuide('start', 'short')}>처음이라면, 여기부터 보세요.</button>
              <button type="button" className="echo-welcome-guide" onClick={dismissHint}>나중에 보기</button>
            </div>
          </div>
        )}
        {hintGone && <button type="button" className="echo-welcome-guide" onClick={() => openGuide('start')}>이용 안내</button>}
      </section>
    </main>
  );
}
