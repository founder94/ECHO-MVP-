// Vesper 장면 상수 — 원본(src/lib/scene/constants.ts)의 민트·보라를 홈페이지 검수안 색(검정·흰·은 + 파랑 #6fa8ff 계열)으로 바꿈.
// 보라·네온 0(qa/design-v2-20261004.test.mjs 규칙은 CSS 대상이지만 이 층도 같은 기준을 지킨다).
export const ORB_CONFIG = {
  /** 구체 위쪽(밝은 하늘빛) → 아래쪽(깊은 파랑) · 가장자리(홈페이지 파랑 --bh-blue). */
  colorTop: '#a9dcff',
  colorBottom: '#2b63ff',
  colorEdge: '#6fa8ff',
  deform: 0.135,
  brightness: 1.18,
  opacity: 1,
  /** 자전 속도(rad/s). HERO_LAYER_OPTIONS.spin 이 false 면 0. 원본 0.17 → 더 느리게. */
  spin: 0.11,
  tilt: 0.32,
  pointerRadius: 1.76,
  oilBulge: 0.46,
  oilRipple: 0.34,
  oilDrag: 0.95,
  rippleFreq: 11,
  rippleSpeed: 4,
  iridescence: 0.35,
  radius: 1,
} as const;

/** 카메라에 붙어 떠다니는 잔입자(원본 Atmosphere) — 파랑·은빛. */
export const ATMO = {
  color: '#9ec6ff',
  alpha: 0.45,
  spread: 2.2,
  fadeNear: 2.0,
  fadeFar: 3.2,
} as const;

/** Solaris 오로라 배경(네 모서리 · 파랑·은빛 · 낮은 밝기). */
export const AURORA = { colorA: '#4d7fe0', colorB: '#8fa6c8', amount: 0.38 } as const;

/** 입자가 모여드는 등장 시간(ms). 원본 2900. */
export const INTRO_MS = 2900;
