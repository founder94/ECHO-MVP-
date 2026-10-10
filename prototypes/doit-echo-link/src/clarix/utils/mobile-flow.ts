// 📖 Docs: obsidian/frontend/scene-3d.md

/**
 * DOIT COMPANY 연결 시안(2026-10-09, 대표 지시 §5): 휴대폰에서도 원본 장면을 끝까지 실제로 돌린다.
 *
 * Clarix 재구성본(D-033)은 휴대폰에서 장면을 "growth" 에서 멈추고 뒤쪽(유리 패널·입자 로고·마지막 장면)을
 * 캡처 정지 사진으로 바꿨다. 그 사진에는 Clarix 로고 입자가 박혀 있고, 대표 지시는 "핵심 장면을 정지 화면으로
 * 바꿔 놓고 효과 그대로라고 하지 않는다"이므로, 휴대폰도 데스크톱과 같은 고정 레이어 + 세로 화면 구도(portrait:
 * 변형, `reframe`)로 2800vh 전체를 재생한다. 성능은 픽셀 비율(최대 2)로 맞춘다.
 */
export const MOBILE_FLOW_QUERY = "(width < 0px)";

export const isMobileFlow = (): boolean => false;
