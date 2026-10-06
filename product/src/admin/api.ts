// ADMIN WEB 서버 호출. 관리자 확인은 서버가 한다(화면 숨김은 보안이 아니다).
import { supabase } from '@/lib/supabase/client';

export class AdminError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

type Fn = 'admin-web' | 'doit-connect' | 'doit-agent'; // doit-agent = 2026-10-06 유료 자유 대화 이번 달 요약(admin_free_summary · 관리자 역할을 서버가 다시 확인)

export async function adminCall<T>(fn: Fn, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new AdminError('UNAUTHORIZED', '로그인이 필요합니다.');
  const { data, error } = await supabase.functions.invoke(fn, { body, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) {
    let detail: { code?: string; message?: string; error?: string } = {};
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) { try { detail = await ctx.clone().json(); } catch { /* 아래 일반 문구 */ } }
    throw new AdminError(detail.code ?? 'NETWORK_ERROR', detail.message ?? detail.error ?? '서버에 연결하지 못했습니다.');
  }
  if (!data || data.ok !== true) throw new AdminError(data?.code ?? 'ERROR', data?.message ?? data?.error ?? '요청을 처리하지 못했습니다.');
  return data as T;
}

export type Period = 'today' | '7d' | '30d';
export const PERIOD_LABEL: Record<Period, string> = { today: '오늘', '7d': '7일', '30d': '30일' };
export type Level = '정상' | '주의' | '오류';
export type QualityKey = 'repeat' | 'goal_mismatch' | 'counsel' | 'correction_ignored' | 'unsure_repeat' | 'summary_mismatch';

export interface Overview {
  asOf: string; period: Period; since: string; server: string; truncated: boolean; quality_sample: number | null; errors: string[];
  health: { level: Level; reasons: string[] };
  users: { total: number | null; signups: number | null; active: number | null; conversations_started: number | null; conversations_done: number | null; intro_saved: number | null };
  ai: { turns: number | null; failed: number | null; ok_sessions: number | null; corrections: number | null; correction_not_saved: number | null; profile_save_failed: number | null;
    quality: Record<QualityKey, number>; quality_label: Record<QualityKey, string>; label_only: number; label_only_samples: { a: string; b: string }[]; last_ok_at: string | null; agent_seen: string[]; agent_server: string };
  matching: { total: number | null; by_status: Record<string, number> | null };
  safety: { reports: number | null; open: number | null; severe: number | null; blocks: number | null };
  auth: { google: boolean | null };
  decisions: string[];
}

export interface AdminUser { id: string; short: string; email: string | null; nickname: string | null; role: 'admin' | 'user'; created_at: string; last_active_at: string | null; purpose: string | null; intro_saved: boolean; photos: number | null; verification: string | null; reported: number; blocked_by: number }
export interface UsersOut { total: number; truncated: boolean; activity_window_days: number; photos_error: string | null; activity_error: string | null; users: AdminUser[] }

export interface SessionItem {
  id: string; user: string; nickname: string | null; created_at: string; updated_at: string; agent: string | null; goal: string | null; goal_label: string | null;
  phase: string | null; done: boolean; turns: number; questions: number; corrections: number; rejections: number;
  quality: Record<QualityKey, number> | null; quality_total: number; summary: string[]; failed_turns: number; sessions_of_user: string[];
}
export interface SessionsOut { total: number; truncated: boolean; multi_session_users: number; sessions: SessionItem[] }
export type FactState = '확정' | '사용자 정정' | '미확정' | '폐기' | '거절' | '분쟁 중';
export interface SessionDetail {
  session: SessionItem & { first_question: string | null; closing: string | null; intro: string[];
    turns: { n: number; question_before: string | null; user: string; kind: string; guard: string | null; reply: string; question: string | null; saved: boolean; decision: string | null }[];
    facts: { area: string; text: string; state: FactState; matching: boolean; turn: number }[] };
  records: { at: string; failed: boolean; turn: number | null; kind: string | null; decision: string | null; model: string | null; agent: string | null; retry: string[]; error: string | null; ms: number | null }[];
  siblings: { id: string; goal: string | null; goal_label: string | null; updated_at: string; done: boolean; summary: string[] }[];
}
export interface SafetyOut {
  reports_error: string | null; blocks_error: string | null; handler_columns: boolean;
  reports: { id: string; reporter: { short: string; nickname: string | null }; target: { short: string; nickname: string | null }; reason: string | null; detail: string | null; status: string; created_at: string; severe: boolean }[];
  blocks: { id: string; blocker: { short: string; nickname: string | null }; blocked: { short: string; nickname: string | null }; reason: string | null; created_at: string }[];
}
export interface SourcesOut {
  server: string; agent_server: string; google: boolean | null;
  tables: { table: string; rows: number | null; error: string | null }[];
  purposes: { id: string; label: string; is_active: boolean | null; sort_order: number | null }[];
  last_turn: { at: string; failed: boolean; agent: string | null; model: string | null } | null;
}
export interface ConnectCandidates { pool: number; eligible: number; missing: { purpose: number; answers: number; photos: number; intro: number }; phone_unverified?: number;
  candidates: { user_a: string; user_b: string; purpose: string | null; a: { nickname: string; confirmed: number }; b: { nickname: string; confirmed: number }; common_a: string[]; common_b: string[]; score: number; no_common?: boolean }[] }
export interface ConnectOutcome { talked: string | null; met: string | null; again: string | null; helpful: string | null }
export interface ConnectMatch { id: string; status: 'approved' | 'rejected' | 'closed'; created_at: string; first_question: string | null; common: string[]; a: string; b: string; answered: number; messages: number; outcomes?: ConnectOutcome[] }
// v2.0 서버가 준비한 후보(상호선택 대기·성사·거절). 예전 서버는 보내지 않는다.
export interface ConnectProposal { id: string; status: 'proposed' | 'mutual' | 'declined' | 'withdrawn'; source: 'server' | 'admin'; created_at: string; common: string[]; a: string; b: string; a_choice: string | null; b_choice: string | null; match_id: string | null }
export interface ConnectMember { id: string; eligible: boolean; missing: string[]; phone_verified: boolean; photos: number; answers: number; purpose: string | null }
