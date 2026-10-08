// 화면 폭별 장면 설정(원본 adaptive.ts 를 홈페이지 첫 화면에 맞게 줄임). 점 수 × 점 크기² × dpr² 가 비용의 전부.
export interface Adaptive {
  point: number;
  orbCount: number;
  orbPointSize: number;
  /** 구체가 첫 화면을 차지할 때 카메라 거리. */
  orbCameraZ: number;
  /** 구체 중심을 위로 올리는 양(월드 단위). 휴대폰은 글 위 빈 자리에, 컴퓨터는 글 뒤 가운데. */
  orbOffsetY: number;
  atmoCount: number;
  atmoSize: number;
  /** 손가락·포인터에 구체 표면이 반응하는지. */
  pointerReaction: boolean;
  dpr: [number, number];
  /** 초당 그리는 횟수 상한(60 Hz 화면에서 솔직한 값은 60·30). */
  targetFps: number;
}

const tiers: Adaptive[] = [
  { point: Infinity, orbCount: 18000, orbPointSize: 27, orbCameraZ: 3.9, orbOffsetY: 0, atmoCount: 220, atmoSize: 22, pointerReaction: true, dpr: [1, 2], targetFps: 60 },
  { point: 1440, orbCount: 14000, orbPointSize: 26, orbCameraZ: 3.9, orbOffsetY: 0, atmoCount: 180, atmoSize: 21, pointerReaction: true, dpr: [1, 1.75], targetFps: 60 },
  { point: 1024, orbCount: 9000, orbPointSize: 24, orbCameraZ: 4.6, orbOffsetY: 0.55, atmoCount: 130, atmoSize: 20, pointerReaction: true, dpr: [0.9, 1.25], targetFps: 45 },
  // 휴대폰: 구체를 위쪽(글 위)에 · dpr 상한 1.1 · 30fps.
  { point: 640, orbCount: 5500, orbPointSize: 21, orbCameraZ: 5.6, orbOffsetY: 1.12, atmoCount: 80, atmoSize: 18, pointerReaction: true, dpr: [0.75, 1.1], targetFps: 30 },
];

export const getParams = (width: number): Adaptive => {
  let result = tiers[0];
  for (const t of tiers) if (width <= t.point) result = t;
  return result;
};
