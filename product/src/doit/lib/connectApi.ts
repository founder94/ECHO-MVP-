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
  /** v2.0 내가 남긴 결과(상대 것은 오지 않는다). 예전 서버는 보내지 않는다. */
  outcome?: MatchOutcome | null;
}

// v2.0(2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§19): 서버가 준비한 후보 · 상호선택 · 결과.
// 후보 단계에서 서버는 상대의 이름·사진·소개·말을 보내지 않는다(화면이 숨기는 게 아니다). 이유는 내가 직접 한 말과 직접 고른 목적뿐.
export type CandidateChoice = 'yes' | 'no' | 'hide';
export interface MyCandidate { id: string; created_at: string; purpose: string | null; reasons: string[]; my_choice: CandidateChoice | null; waiting: boolean }
export interface MyCandidates { eligible: boolean; missing: string[]; prepared: number; candidates: MyCandidate[] }
export type OutcomeField = 'talked' | 'met' | 'again' | 'helpful';
export interface MatchOutcome { talked: 'yes' | 'no' | null; met: 'yes' | 'planned' | 'no' | null; again: 'yes' | 'unsure' | 'no' | null; helpful: 'yes' | 'unsure' | 'no' | null }

export interface AdminCandidate {
  user_a: string; user_b: string; purpose: string | null;
  a: { nickname: string; confirmed: number }; b: { nickname: string; confirmed: number };
  common_a: string[]; common_b: string[]; score: number;
  /** v1.2: 같은 목적이지만 맞다고 한 말이 겹치지 않는 쌍. 승인하려면 관리자가 한 번 더 확인한다. */
  no_common?: boolean;
}
export interface AdminCandidates {
  pool: number; eligible: number;
  missing: { purpose: number; answers: number; photos: number; intro: number };
  /** 2026-09-27 P0-1: 전화 인증은 연결 자격이 아니다 — 참고 인원만(예전 서버 응답에는 없을 수 있음). */
  phone_unverified?: number;
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

export interface MyTurns { open: number; turns: { answer: number; reply: number; opened: number; choose: number } }

/** 앱 홈용 — 내 차례 개수만(이름·내용 없음). */
export async function fetchMyTurns(userId: string): Promise<MyTurns> {
  const out = await serverFunctionRequest<Partial<MyTurns>>('doit-connect', { action: 'my_turns' }, userId);
  const t: Partial<MyTurns['turns']> = out.turns ?? {};
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { open: n(out.open), turns: { answer: n(t.answer), reply: n(t.reply), opened: n(t.opened), choose: n(t.choose) } };
}

/** 홈 카드 문구 — 할 일이 여럿이면 먼저 할 것(첫 답 → 새로 열림 → 받은 이야기 → 새 후보) 하나만. 없으면 null. */
export function turnsMessage(t: MyTurns['turns']): { title: string; detail: string } | null {
  if (t.answer > 0) return { title: t.answer > 1 ? `첫 질문 ${t.answer}개가 와 있어요` : '새 연결에 첫 질문이 와 있어요', detail: '둘 다 답하면 서로의 이름과 사진이 열려요.' };
  if (t.opened > 0) return { title: '서로 열렸어요', detail: '상대의 답과 사진을 볼 수 있어요. 먼저 한마디 건네 보세요.' };
  if (t.reply > 0) return { title: t.reply > 1 ? `${t.reply}개의 연결에서 이야기가 왔어요` : '상대가 이야기를 보냈어요', detail: '내 연결에서 이어서 답할 수 있어요.' };
  if (t.choose > 0) return { title: '당신이 잠든 사이, ECHO가 먼저 살펴봤어요', detail: t.choose > 1 ? `후보 ${t.choose}명이 와 있어요. 두 사람이 모두 고르면 연결이 열려요.` : '후보 한 명이 와 있어요. 두 사람이 모두 고르면 연결이 열려요.' };
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

export async function fetchMyCandidates(userId: string): Promise<MyCandidates> {
  const out = await serverFunctionRequest<Partial<MyCandidates>>('doit-connect', { action: 'my_candidates' }, userId);
  return { eligible: out.eligible === true, missing: Array.isArray(out.missing) ? out.missing : [], prepared: typeof out.prepared === 'number' ? out.prepared : 0, candidates: Array.isArray(out.candidates) ? out.candidates : [] };
}

/** 후보 고르기. 둘 다 'yes' 일 때만 서버가 연결을 연다(status 'mutual'). 한쪽만이면 'waiting'. */
export async function chooseCandidate(userId: string, candidateId: string, choice: CandidateChoice): Promise<{ status: 'waiting' | 'mutual' | 'declined' | string; match_id?: string | null }> {
  return serverFunctionRequest('doit-connect', { action: 'choose', candidateId, choice }, userId);
}

/** 연결 결과(본인 것만). 추천을 다듬는 데만 쓰고 내 프로필·확정한 말로 올리지 않는다. */
export async function sendOutcome(userId: string, matchId: string, patch: Partial<Record<OutcomeField, string>>): Promise<void> {
  await serverFunctionRequest('doit-connect', { action: 'outcome', matchId, ...patch }, userId);
}
