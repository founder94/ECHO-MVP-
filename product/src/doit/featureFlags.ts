// A구조(DO IT) 전용 기능 플래그.
// 기본값은 전부 꺼짐(false). 켜기 전까지 기존 서비스·번들에 영향 0.
// 실제 기능 연결(서버 상태머신·DB·배포)은 반드시 이 플래그를 통해서만 열린다.
// B구조(ECHO)·전역 CSS·공용 컴포넌트는 이 파일에서 절대 건드리지 않는다.

export const A_FEATURE_FLAGS = {
  // 협동 미션 6·4·2 (서버 RPC 연동 전까지는 화면 상태 구조만)
  cooperativeMission: false,
  // 프로필 사진 6장 (A 전용 슬롯/촬영/순서/대표)
  profileSixPhotos: false,
  // 스토리 공개/잠금(흐림) 65/35 구조
  storyPublicLock: false,
  // 남녀 파트 노래 (음원·저작권 자산 부재 → 비활성 유지)
  partnerSong: false,
} as const;

export type AFeatureKey = keyof typeof A_FEATURE_FLAGS;

export function isAFeatureEnabled(key: AFeatureKey): boolean {
  return Boolean(A_FEATURE_FLAGS[key]);
}