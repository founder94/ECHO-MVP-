import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startNewRound } from '@/doit/lib/conversationRound';

// 「처음부터 다시 시작하기」 공통 동작(2026-09-28 대표 「처음부터 다시 시작하기 UX 수정」) — 앱의 모든 버튼이 이것 하나만 쓴다.
// 1) 서버가 읽는 새 회차 시각을 남기고 이 기기가 기억한 대화 세션을 잊는다(startNewRound · 계정·Profile·확정 정보는 지우지 않음).
// 2) 성공하면 곧바로 ECHO 첫 대화 화면(/doit/conversation 의 첫 질문)으로 간다 — 홈·나의 이해·요약 화면을 거치지 않고, 확인 창도 없다(한 번 탭).
// 실패하면 이동하지 않고 이유를 돌려준다(화면만 옮기는 가짜 초기화 금지).
export const FRESH_ROUND_STATE = 'freshRound';
export type FreshRoundState = { [FRESH_ROUND_STATE]?: number };

export function useRestartConversation(userId: string | null | undefined) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const restart = useCallback(async (): Promise<string | null> => {
    if (!userId) return '로그인한 뒤 다시 시작할 수 있어요.';
    if (inFlight.current) return null;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const failure = await startNewRound(userId);
      if (failure) { setError(failure); return failure; }
      navigate('/doit/conversation', { state: { [FRESH_ROUND_STATE]: Date.now() } satisfies FreshRoundState });
      return null;
    } catch {
      const failure = '새로 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
      setError(failure);
      return failure;
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }, [navigate, userId]);
  return { restart, busy, error };
}
