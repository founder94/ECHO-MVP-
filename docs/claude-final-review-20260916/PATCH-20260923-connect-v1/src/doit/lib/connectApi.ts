// 연결 서버(doit-connect v1.2) 화면 쪽 창구. 서버가 무엇을 내려 주는지가 곧 blind-first 약속이다:
// 두 사람이 모두 첫 질문에 답하기 전에는 partner·messages 가 아예 오지 않는다(화면이 숨기는 게 아니라 서버가 안 보낸다).
import { supabase } from '@/lib/supabase/client';
import { serverFunctionRequest } from '@/doit/lib/understandingApi';

// 연결 동의 판 — 서버(supabase/functions/doit-connect) 의 CONNECT_CONSENT_VERSION 과 같아야 한다(검사가 확인한다).
// 무엇이 보이는지 문구가 바뀌면 판을 올려 다시 묻는다.
export const CONNECT_CONSENT_VERSION = 'connect-v1';

export const ANSWER_MAX = 300;
export const MESSAGE_MAX = 500;

export interface MatchMessage { id: string; mine: boolean; body: string; created_at: string }
export interface MatchPartner { nickname: string; bio: string; purpose: string | null; answer: string; photo_url: string | null }
export interface MyMatch {
  id: string;
  status: 'open' | 'closed';
  created_at: string;
  first_question: string | null;
  my_answer: string | null;
  partner_answered: boolean;
  revealed: boolean;
  partner?: MatchPartner;
  messages?: MatchMessage[];
}

export interface AdminCandidate {
  user_a: string; user_b: string; purpose: string | null;
  a: { nickname: string; confirmed: number }; b: { nickname: string; confirmed: number };
  common_a: string[]; common_b: string[]; score: number;
  /** v1.2: 같은 목적이지만 맞다고 한 말이 겹치지 않는 쌍. 승인하려면 관리자가 한 번 더 확인한다. */
  no_common?: boolean;
}
export interface AdminCandidates {
  pool: number; eligible: number;
  missing: { purpose: number; phone: number; answers: number; photos: number; intro: number };
  candidates: AdminCandidate[];
}
export interface AdminMatch {
  id: string; status: 'approved' | 'rejected' | 'closed'; created_at: string; first_question: string | null;
  common: string[]; a: string; b: string; answered: number; messages: number;
}

export interface MyMatches { matches: MyMatch[]; consented: boolean }

export async function fetchMyMatches(userId: string): Promise<MyMatches> {
  const out = await serverFunctionRequest<{ matches: MyMatch[]; consented?: boolean }>('doit-connect', { action: 'my_matches' }, userId);
  return { matches: Array.isArray(out.matches) ? out.matches : [], consented: out.consented === true };
}

export interface MyTurns { open: number; turns: { answer: number; reply: number; opened: number } }

/** 앱 홈용 — 내 차례 개수만(이름·내용 없음). */
export async function fetchMyTurns(userId: string): Promise<MyTurns> {
  const out = await serverFunctionRequest<Partial<MyTurns>>('doit-connect', { action: 'my_turns' }, userId);
  const t = out.turns ?? { answer: 0, reply: 0, opened: 0 };
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { open: n(out.open), turns: { answer: n(t.answer), reply: n(t.reply), opened: n(t.opened) } };
}

/** 홈 카드 문구 — 할 일이 여럿이면 먼저 할 것(첫 답 → 새로 열림 → 받은 이야기) 하나만. 없으면 null. */
export function turnsMessage(t: MyTurns['turns']): { title: string; detail: string } | null {
  if (t.answer > 0) return { title: t.answer > 1 ? `첫 질문 ${t.answer}개가 와 있어요` : '새 연결에 첫 질문이 와 있어요', detail: '둘 다 답하면 서로의 이름과 사진이 열려요.' };
  if (t.opened > 0) return { title: '서로 열렸어요', detail: '상대의 답과 사진을 볼 수 있어요. 먼저 한마디 건네 보세요.' };
  if (t.reply > 0) return { title: t.reply > 1 ? `${t.reply}개의 연결에서 이야기가 왔어요` : '상대가 이야기를 보냈어요', detail: '내 연결에서 이어서 답할 수 있어요.' };
  return null;
}

/** 연결 동의를 내 로그인 정보에 남긴다(회차 시작 시각과 같은 방식). 서버는 첫 답을 받을 때 이 값을 다시 확인한다. */
export async function giveConnectConsent(): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ data: { doit_connect_consent_version: CONNECT_CONSENT_VERSION, doit_connect_consent_at: new Date().toISOString() } });
  return error ? '동의를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.' : null;
}

export async function sendMatchAnswer(userId: string, matchId: string, text: string): Promise<void> {
  await serverFunctionRequest('doit-connect', { action: 'answer', matchId, text }, userId);
}

export async function sendMatchMessage(userId: string, matchId: string, text: string): Promise<void> {
  await serverFunctionRequest('doit-connect', { action: 'message', matchId, text }, userId);
}

export async function leaveMatch(userId: string, matchId: string, options: { block: boolean; report: boolean }): Promise<void> {
  await serverFunctionRequest('doit-connect', { action: 'leave', matchId, ...options }, userId);
}

export async function fetchAdminCandidates(): Promise<AdminCandidates> {
  return serverFunctionRequest<AdminCandidates>('doit-connect', { action: 'admin_candidates' });
}

export async function fetchAdminMatches(): Promise<AdminMatch[]> {
  const out = await serverFunctionRequest<{ matches: AdminMatch[] }>('doit-connect', { action: 'admin_matches' });
  return Array.isArray(out.matches) ? out.matches : [];
}

export async function decideMatch(userA: string, userB: string, decision: 'approve' | 'reject', noCommonOk = false): Promise<{ status: string; first_question?: string; question_source?: 'ai' | 'fixed' }> {
  return serverFunctionRequest('doit-connect', { action: 'admin_decide', userA, userB, decision, ...(noCommonOk ? { noCommonOk: true } : {}) });
}
