import { createElement as h, type CSSProperties, type ReactNode } from 'react';

// 최초 HTML·실제 온보딩·전환 대기 화면이 같은 시각 구성 요소를 사용한다.
// 모든 크기·색은 inline style이라 앱 CSS/JS를 기다리지 않고 첫 프레임을 그릴 수 있다.
// 진행률 숫자 색: 낮을 땐 차분한 회색, 100%에 가까워질수록 밝은 흰색.
function numberColor(p: number): string {
  const t = Math.max(0, Math.min(1, p / 100));
  const from: [number, number, number] = [155, 154, 151];
  const to: [number, number, number] = [244, 243, 239];
  return `rgb(${Math.round(from[0] + (to[0] - from[0]) * t)},${Math.round(
    from[1] + (to[1] - from[1]) * t,
  )},${Math.round(from[2] + (to[2] - from[2]) * t)})`;
}

// 결정적 의사난수(고정 시드) — 별 배치가 매번 동일해 새로고침에도 안정적이다.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 별: 고정 시드, 대부분 1px·일부 2px, 낮은 밝기, 아주 느린 밝기 변화.
const STARS: Array<{ x: number; y: number; size: number; delay: number; dur: number; base: number }> = (() => {
  const prng = mulberry32(880123);
  const arr = [];
  for (let i = 0; i < 90; i += 1) {
    arr.push({
      x: Math.round(prng() * 1000) / 10,
      y: Math.round(prng() * 1000) / 10,
      size: prng() < 0.82 ? 1 : 2,
      delay: Math.round(prng() * 60) / 10,
      dur: 3.2 + Math.round(prng() * 40) / 10,
      base: 0.15 + Math.round(prng() * 30) / 100,
    });
  }
  return arr;
})();


interface IntroFrameProps {
  progress?: number;
  leaving?: boolean;
  reducedMotion?: boolean;
  // 2026-09-21: 3D 연출 층(IntroUniverse). 있으면 심볼 PNG 는 점들이 모인 뒤(88%→100%)에 떠오르고, 떠날 때 장면이 앞으로 밀린다.
  scene?: ReactNode;
}

export default function DoItIntroFrame({
  progress = 1,
  leaving = false,
  reducedMotion = false,
  scene = null,
}: IntroFrameProps) {
  const f = reducedMotion ? 1 : progress / 100;
  const shown = Math.round(progress);
  const layer: CSSProperties = {
    position: 'absolute', inset: 0,
    opacity: leaving ? 0 : 1, transition: 'opacity 250ms ease',
  };
  const symbolReveal = scene ? 0 : 1;
  const sceneLayer: CSSProperties = {
    position: 'absolute', inset: 0,
    opacity: leaving ? 0 : 1,
    transform: leaving ? 'scale(1.12)' : 'scale(1)',
    transition: 'opacity 250ms ease, transform 300ms ease-in',
    transformOrigin: '50% 47%',
  };
  return h('div', {
    'data-doit-intro-frame': '',
    style: {
      position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden',
      boxSizing: 'border-box', lineHeight: 1.5,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      background: 'radial-gradient(120% 120% at 50% 45%, #08070C 0%, #060509 58%, #040308 100%)',
    },
  },
  h('div', { 'aria-hidden': true, style: { ...layer, pointerEvents: 'none' } },
    STARS.map((st, i) => h('span', {
      key: i, 'data-doit-star': '',
      style: {
        position: 'absolute', borderRadius: '50%',
        left: `${st.x}%`, top: `${st.y}%`, width: st.size, height: st.size,
        background: '#ffffff', opacity: st.base,
        animation: reducedMotion ? 'none' : `doit-star-twinkle ${st.dur}s ease-in-out infinite`,
        animationDelay: `${st.delay}s`, '--base': st.base,
      } as CSSProperties,
    })),
  ),
  h('div', { style: scene ? sceneLayer : layer },
    scene ? h('div', { 'aria-hidden': true, style: { position: 'absolute', inset: 0 } }, scene) : null,
    h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
    h('img', {
      src: '/brand/doit-symbol-original.png', alt: 'DO IT 공식 심볼',
      width: 1536, height: 1536, fetchPriority: 'high', draggable: false,
      style: {
        display: 'block', width: 'clamp(144px, 38vw, 220px)', height: 'auto',
        aspectRatio: '1', objectFit: 'contain', mixBlendMode: 'screen',
        // 3D 연출이 있으면 심볼은 캔버스(IntroUniverse)가 직접 그린다. 이 <img> 는 접근성(대체 텍스트)용으로만 남긴다.
        opacity: symbolReveal,
        transform: `translateY(-3%) scale(${0.96 + f * 0.04})`,
      },
    }),
    ),
  ),
  h('div', { style: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingLeft: '7vw', paddingRight: '7vw',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
    opacity: leaving ? 0 : 1, transition: 'opacity 250ms ease',
  } },
    h('div', {
      role: 'progressbar', 'aria-label': 'DO IT 시작 화면',
      'aria-valuemin': 1, 'aria-valuemax': 100, 'aria-valuenow': shown,
      style: {
        textAlign: 'left', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        lineHeight: 1, whiteSpace: 'nowrap', color: numberColor(progress),
        fontSize: 'clamp(52px, 14vw, 110px)', letterSpacing: '-0.03em',
      },
    }, h('span', null, shown), h('span', null, '%')),
    h('div', { style: { marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
      h('span', { style: {
        fontSize: 11, letterSpacing: '0.18em', whiteSpace: 'nowrap', color: 'rgba(244,243,239,0.4)',
      } }, '© 2026 DO IT COMPANY'),
      h('span', { style: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 9999, border: '1px solid rgba(244,243,239,0.28)', padding: '0 12px',
        height: 28, boxSizing: 'border-box', fontSize: 10, letterSpacing: '0.22em',
        whiteSpace: 'nowrap', color: 'rgba(244,243,239,0.55)',
      } }, 'JUST TRY'),
    ),
  ),
  h('style', null, `
    @keyframes doit-star-twinkle {
      0%, 100% { opacity: calc(var(--base, 0.25) * 0.4); }
      50% { opacity: calc(var(--base, 0.25) * 1.4); }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-doit-star] { animation: none !important; }
    }
  `),
  );
}
