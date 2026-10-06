// 메탈 실버 색표 (대표 2026-09-23). CSS(metal-silver.css)로 칠할 수 없는 곳 — 캔버스의 점·궤도, 온보딩 숫자(첫 화면용 인라인 스타일) — 에서 쓴다.
// 평평한 한 가지 은색이 아니라, 밝은 반사 띠와 회청색 결을 섞는다.

// 금속 점의 결: 반사광 · 밝은 은 · 중간 은 · 회청 은
export const METAL_TONES = ['#fbfcfd', '#e3e6ea', '#c6ccd4', '#a9b0ba'] as const;

// 금속 글자(가로 방향 반사 띠)
export const METAL_TEXT_GRADIENT = 'linear-gradient(100deg, #ffffff 0%, #e5e8ec 22%, #a9b0ba 44%, #f8f9fa 60%, #c4c9d0 80%, #eef0f2 100%)';

// 점 하나의 결을 정한다(고정 규칙 — 새로고침해도 같은 무늬).
export function metalTone(index: number): string {
  return METAL_TONES[index % METAL_TONES.length];
}
