// 연결 서버(doit-connect v1) 화면 쪽 창구. 서버가 무엇을 내려 주는지가 곧 blind-first 약속이다:
// 두 사람이 모두 첫 질문에 답하기 전에는 partner·messages 가 아예 오지 않는다(화면이 숨기는 게 아니라 서버가 안 보낸다).
import { serverFunctionRequest } from '@/doit/lib/understandingApi';

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

export async function fetchMyMatches(userId: string): Promise<MyMatch[]> {
  const out = await serverFunctionRequest<{ matches: MyMatch[] }>('doit-connect', { action: 'my_matches' }, userId);
  return Array.isArray(out.matches) ? out.matches : [];
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

export async function decideMatch(userA: string, userB: string, decision: 'approve' | 'reject'): Promise<{ status: string; first_question?: string; question_source?: 'ai' | 'fixed' }> {
  return serverFunctionRequest('doit-connect', { action: 'admin_decide', userA, userB, decision });
}
