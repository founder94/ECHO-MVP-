import { supabase } from '@/lib/supabase/client';
import { clearPurpose } from '@/doit/lib/profileSave';

// 회차(round) — 대표 지시 2026-09-22 "사용자는 다시 처음부터 사용할 수 있어야 하고, 지난 데이터는 다시 볼 수 있어야 한다".
// "처음부터 다시"를 누르면 로그인 정보(user_metadata)에 시작 시각을 남기고 목적을 비운다. 기록·확인한 이해는 지우지 않는다(개인 데이터).
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
  return clearPurpose(userId);
}
