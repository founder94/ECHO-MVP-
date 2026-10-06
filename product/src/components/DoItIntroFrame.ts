import { createElement as h, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { SYMBOL_DISPLAY_SRC, fallbackToOriginal } from '@/components/symbolAssets';
import { METAL_TEXT_GRADIENT } from '@/components/metalSilver';

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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// 3D 연출이 심볼을 맡지 못했을 때 원래 그림이 나타나기 시작하는 진행률(%).
const LATE_REVEAL_FROM = 72;

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
  // 2026-09-23: 3D 연출이 심볼을 실제로 그릴 준비를 끝냈는지. 준비 전에는 원본 <img> 를 그대로 보여 둔다.
  // (그림이 늦게 오면 점도 심볼도 못 그리는데 <img> 까지 꺼져 있어, 별·숫자만 남고 심볼이 사라졌다.)
  symbolReady?: boolean;
}

export default function DoItIntroFrame({
  progress = 1,
  leaving = false,
  reducedMotion = false,
  scene = null,
  symbolReady = false,
}: IntroFrameProps) {
  const f = reducedMotion ? 1 : progress / 100;
  const shown = Math.round(progress);
  const layer: CSSProperties = {
    position: 'absolute', inset: 0,
    opacity: leaving ? 0 : 1, transition: 'opacity 250ms ease',
  };
  // 심볼은 처음에 보이지 않고, 끝에서 완성되어 나타난다(대표 2026-09-23 "처음에 D가 안 나와야 되고 마지막에 완성돼서").
  // - 3D 연출이 심볼을 맡았으면(symbolReady) 캔버스가 점을 모아 완성한다 → <img> 는 끈다.
  // - 맡지 못했으면(사파리에서 빈 그림 등) <img> 가 끝 무렵(LATE_REVEAL_FROM% → 100%)에 흐림을 걷으며 나타난다(빠져나갈 문).
  // - 동작 줄이기면 움직임 없이 처음부터 보여 준다(0.6초로 짧다).
  const lateReveal = clamp01((progress - LATE_REVEAL_FROM) / (100 - LATE_REVEAL_FROM));
  const symbolReveal = reducedMotion ? 1 : scene && symbolReady ? 0 : lateReveal;
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
      src: SYMBOL_DISPLAY_SRC, alt: 'DO IT 공식 심볼',
      onError: (event: SyntheticEvent<HTMLImageElement>) => fallbackToOriginal(event.currentTarget),
      width: 512, height: 512, fetchPriority: 'high', draggable: false,
      style: {
        display: 'block', width: 'clamp(144px, 38vw, 220px)', height: 'auto',
        // 표시용 작은 판은 배경이 투명이라 그대로 얹으면 된다.
        // (공식 원본으로 되돌아갈 때만 검은 배경을 지우는 'screen' 합성을 다시 켠다 — symbolAssets.ts)
        aspectRatio: '1', objectFit: 'contain',
        // 3D 연출이 심볼을 맡은 뒤에는 캔버스(IntroUniverse)가 직접 그린다. 그 전까지는 이 <img> 가 심볼을 보여 준다.
        opacity: symbolReveal,
        // 끝 무렵에 나타날 때는 살짝 작고 흐린 상태에서 또렷하게 완성된다.
        filter: symbolReveal > 0 && symbolReveal < 1 ? `blur(${((1 - symbolReveal) * 8).toFixed(2)}px)` : 'none',
        transform: `translateY(-3%) scale(${(0.86 + symbolReveal * 0.1 + f * 0.04).toFixed(4)})`,
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
        // 메탈 실버 글자: 금속 반사 띠를 글자에 입히고, 진행될수록 빛이 옆으로 흐르며 밝아진다.
        // (글자 오려 내기를 못 하는 브라우저는 위 color 로 그대로 보인다.)
        backgroundImage: METAL_TEXT_GRADIENT, backgroundSize: '220% 100%',
        backgroundPosition: `${Math.round(progress)}% 50%`,
        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: `brightness(${(0.72 + 0.28 * (progress / 100)).toFixed(3)})`,
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
