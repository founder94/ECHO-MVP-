import { supabase } from '@/lib/supabase/client';
import { forgetAgentSession } from '@/doit/lib/agentApi';

// 회차(round) — 대표 지시 2026-09-22 "사용자는 다시 처음부터 사용할 수 있어야 하고, 지난 데이터는 다시 볼 수 있어야 한다".
// "처음부터 다시"를 누르면 로그인 정보(user_metadata)에 새 회차 시작 시각을 남기고 이 기기가 기억한 대화 세션을 잊는다.
// 2026-09-28 대표 「처음부터 다시 시작하기 UX」: 대화 세션만 새로 시작한다 — 계정·Profile(목적 포함)·사용자가 확정한 정보는 지우지 않는다.
// 첫 질문(어떤 만남을 원하세요?)은 화면이 새 회차 표시로 다시 보여 준다(conversation/page.tsx · 목적을 비우지 않음).
// 서버(doit-understanding v13.4)는 같은 시각을 읽어 이번 회차의 기록·확인만으로 "아직 안 나온 주제"를 고른다.
export const ROUND_KEY = 'doit_round_started_at';

export function roundStartOf(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): string | null {
  const raw = user?.user_metadata?.[ROUND_KEY];
  if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

export async function startNewRound(userId: string): Promise<string | null> {
  const startedAt = new Date().toISOString();
  const { error } = await supabase.auth.updateUser({ data: { [ROUND_KEY]: startedAt } });
  if (error) return '새 회차를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  forgetAgentSession(userId); // v2.4 이 기기가 기억한 세션도 새 회차부터
  return null;
}
