// A구조 협동 미션 6·4·2 상태 머신 (순수 로직 · 서버 정제 응답 기반)
// 원칙:
//   - 프론트는 completed / 보상 / 지급 상태를 절대 만들 수 없다.
//   - waitingForPartner 는 서버 refined 응답 값만 사용한다.
//   - 72시간 최종 만료 판단은 서버 deadline(now() 기준). 여기서는 표시용만 계산.
//   - 6·4·2 외 단계값은 허용하지 않는다.
//   - 상대방 답변 원문·전체 참여자 목록·내부 해시는 이 계층에 존재하지 않는다.

export type MissionStatus =
  | 'collecting'
  | 'awaiting_review'
  | 'completed'
  | 'closed';

export type MissionStage = '6' | '4' | '2';

export type CloseReason =
  | 'participant_exit'
  | 'expired'
  | 'review_failed'
  | 'completed'
  | null;

// 서버 get_mission_refined 가 반환하는 정제된 응답 형태와 1:1.
export interface MissionRefined {
  missionId: string;
  stage: MissionStage;
  revision: number;
  status: MissionStatus;
  ownSubmitted: boolean;
  waitingForPartner: boolean;
  deadline: string | null;
  closeReason: CloseReason;
}

// 화면에 보여줄 표시용 상태 (서버 상태에서 파생, 프론트가 위조하지 않음)
export type MissionUIState =
  | 'preparing' // 미션 준비
  | 'waiting_partner' // 상대방 대기
  | 'writing' // 내 답변 작성
  | 'submitting' // 제출 중 (클라이언트 일시 상태)
  | 'awaiting_review' // 서버 검토 중
  | 'completed' // 완료
  | 'partner_exit' // 상대방 이탈
  | 'expired' // 72시간 만료
  | 'error_retry'; // 오류 후 재시도

export const ALLOWED_STAGES: readonly MissionStage[] = ['6', '4', '2'];

export function isMissionStage(value: unknown): value is MissionStage {
  return value === '6' || value === '4' || value === '2';
}

// 서버 정제 응답 → 표시용 상태. 프론트 추정 없이 서버 값만 사용.
export function deriveUIState(refined: MissionRefined): MissionUIState {
  switch (refined.status) {
    case 'completed':
      return 'completed';
    case 'closed':
      if (refined.closeReason === 'expired') return 'expired';
      if (refined.closeReason === 'participant_exit') return 'partner_exit';
      // review_failed 또는 원인 미상 → 오류 후 재시도/문의 안내
      return 'error_retry';
    case 'awaiting_review':
      return 'awaiting_review';
    case 'collecting':
      return refined.ownSubmitted ? 'waiting_partner' : 'writing';
    default:
      return 'writing';
  }
}

// 남은 시간(표시용 ms). 최종 만료 판단은 서버가 한다.
export function remainingMs(
  refined: MissionRefined,
  nowMs: number,
): number | null {
  if (!refined.deadline) return null;
  const deadlineMs = new Date(refined.deadline).getTime();
  if (Number.isNaN(deadlineMs)) return null;
  return Math.max(0, deadlineMs - nowMs);
}