// 연결 서버(doit-connect v1.2) 화면 쪽 창구. 서버가 무엇을 내려 주는지가 곧 blind-first 약속이다:
// 두 사람이 모두 첫 질문에 답하기 전에는 partner·messages 가 아예 오지 않는다(화면이 숨기는 게 아니라 서버가 안 보낸다).
import { supabase } from '@/lib/supabase/client';
import { UnderstandingError, serverFunctionRequest } from '@/doit/lib/understandingApi';

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
  /** 두 사람이 모두 「이어지고 싶어요」를 눌러 열린 연결이면 true(서버 계산 · 관리자가 연 연결은 false). 예전 서버는 보내지 않는다. */
  via_mutual?: boolean;
  partner?: MatchPartner;
  messages?: MatchMessage[];
  /** v2.0 내가 남긴 결과(상대 것은 오지 않는다). 예전 서버는 보내지 않는다. */
  outcome?: MatchOutcome | null;
}

// v2.0(2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§19): 서버가 준비한 후보 · 상호선택 · 결과.
// 후보 단계에서 서버는 상대의 이름·사진·소개·말을 보내지 않는다(화면이 숨기는 게 아니다). 이유는 내가 직접 한 말과 직접 고른 목적뿐.
export type CandidateChoice = 'yes' | 'no' | 'hide';
export interface MyCandidate { id: string; created_at: string; purpose: string | null; reasons: string[]; my_choice: CandidateChoice | null; waiting: boolean }
/** FI-018(2026-10-01): 연결 자격을 서버가 계산한 그대로(화면이 따로 세지 않는다). conversation = Agent 공통 계약(conversationReadiness). 예전 서버는 보내지 않는다(null). */
export interface ConnectReadiness {
  conversation: { ready: boolean; source: 'agent' | 'legacy'; finished: boolean; have: number; need: number };
  purpose: boolean; intro: boolean; photos: number; photos_needed: number; phone_verified: boolean;
}
export interface MyCandidates { eligible: boolean; missing: string[]; prepared: number; candidates: MyCandidate[]; readiness: ConnectReadiness | null }
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
  // 2026-09-30 대표 「CLAUDE CODE FINAL MASTER」 §3: 재진입 첫 문장 = 「당신이 잠든 사이, ECHO가 한 사람을 발견했어요」(수는 서버가 센 그대로).
  if (t.choose > 0) return { title: t.choose > 1 ? `당신이 잠든 사이, ECHO가 ${t.choose}명을 발견했어요` : '당신이 잠든 사이, ECHO가 한 사람을 발견했어요', detail: '왜 이 사람인지 먼저 보여 드릴게요. 두 사람이 모두 고르면 연결이 열려요.' };
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

/** requestId = 이 이야기 한 번의 보내기. 실패 뒤 같은 글을 다시 보내면 같은 id(서버가 한 번만 저장). */
export async function sendMatchMessage(userId: string, matchId: string, text: string, requestId?: string): Promise<void> {
  await serverFunctionRequest('doit-connect', { action: 'message', matchId, text, ...(requestId ? { requestId } : {}) }, userId);
}

// 2026-10-02 PR #99: 마지막 구간 — 앱 안 영상 → 각자 상대 모습 확인 → 각자 만남 의사. 상태·허용은 서버(meetGate)만 정한다.
// sessionId = 이 연결의 영상 확인용 ECHO 내부 기록 번호(로그인·통화 입장권이 아님) — 화면에 보여 주지 않고, 확인·의사를 보낼 때 그대로 돌려줄 뿐이다.
export type MeetState = 'allowed' | 'need_video' | 'need_my_check' | 'need_my_intent' | 'waiting_partner' | 'unavailable';
export type MeetIntent = 'yes' | 'not_now' | 'no';
// stateVersion = 서버가 판단 재료(동의·공개·단계)로 만든 불투명 값. 확인·의사를 보낼 때 그대로 돌려주고, 그사이 상태가 바뀌었으면 서버가 STATE_CHANGED(409)로 막는다.
export interface MeetStatus { state: MeetState; allowed: boolean; sessionId: string | null; stateVersion: string | null }
const MEET_STATES: readonly MeetState[] = ['allowed', 'need_video', 'need_my_check', 'need_my_intent', 'waiting_partner', 'unavailable'];
const MEET_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 서버 응답 → 화면 상태. 모르는 모양은 null(= 그리지 않음). allowed 는 서버가 state 와 같이 참이라고 할 때만 참. */
export function parseMeetStatus(out: unknown): MeetStatus | null {
  if (!out || typeof out !== 'object') return null;
  const o = out as { ok?: unknown; state?: unknown; allowed?: unknown; sessionId?: unknown; stateVersion?: unknown };
  if (o.ok !== true || !MEET_STATES.includes(o.state as MeetState)) return null;
  const state = o.state as MeetState;
  return {
    state, allowed: state === 'allowed' && o.allowed === true,
    sessionId: typeof o.sessionId === 'string' && MEET_UUID.test(o.sessionId) ? o.sessionId : null,
    stateVersion: typeof o.stateVersion === 'string' && /^[a-f0-9]{64}$/.test(o.stateVersion) ? o.stateVersion : null,
  };
}

/**
 * 마지막 구간 상태 읽기 — 세 가지를 구분한다(2026-10-02 PR #101 정정):
 *  off   = 서버가 꺼져 있음(MEET_NOT_CONFIGURED) → 화면은 이 구간을 그리지 않는다.
 *  error = 켜져 있는데 읽지 못함(네트워크·서버 읽기 실패·모르는 모양) → 「불러오지 못했어요 · 다시 불러오기」(아무것도 없음으로 숨기지 않음).
 *  ready = 서버가 준 상태 그대로.
 */
export type MeetLoad = { kind: 'off' } | { kind: 'error' } | { kind: 'ready'; status: MeetStatus };
export async function loadMeetStatus(userId: string, matchId: string): Promise<MeetLoad> {
  try {
    const status = parseMeetStatus(await serverFunctionRequest<unknown>('doit-connect', { action: 'meet_status', matchId }, userId));
    return status ? { kind: 'ready', status } : { kind: 'error' };
  } catch (e) {
    return e instanceof UnderstandingError && e.code === 'MEET_NOT_CONFIGURED' ? { kind: 'off' } : { kind: 'error' };
  }
}

// 영상 이용 동의(PR #101 · 이름·사진 공개 동의 doit_connect_consent_* 와 **다른 칸**). 판 이름은 서버 MEET_VIDEO_CONSENT_VERSION 과 같아야 하고
// 문구·판은 대표 결정(승인 묶음 B-3) — 빌드 값(VITE_VIDEO_CONSENT_VERSION)이 없으면 동의 화면 자체를 띄우지 않는다(판을 지어내지 않음).
export const VIDEO_CONSENT_VERSION: string | null = (import.meta.env.VITE_VIDEO_CONSENT_VERSION as string | undefined) || null;

/** 지금 로그인한 사람이 현재 판의 영상 이용 동의를 했는지(본인 것만 · 로그인 정보에서). */
export async function hasVideoConsent(): Promise<boolean> {
  if (!VIDEO_CONSENT_VERSION) return false;
  const { data } = await supabase.auth.getSession();
  const m = (data.session?.user.user_metadata ?? {}) as Record<string, unknown>;
  return m.doit_video_consent_version === VIDEO_CONSENT_VERSION && typeof m.doit_video_consent_at === 'string' && !Number.isNaN(Date.parse(m.doit_video_consent_at));
}

/** 영상 이용 동의 남기기 · 거두기 — 영상 칸만 바꾼다(공개 동의 칸은 건드리지 않음). 실패 문구를 돌려준다. */
export async function setVideoConsent(agree: boolean): Promise<string | null> {
  if (!VIDEO_CONSENT_VERSION) return '지금은 영상 이용을 준비하고 있어요.';
  const { error } = await supabase.auth.updateUser({ data: agree
    ? { doit_video_consent_version: VIDEO_CONSENT_VERSION, doit_video_consent_at: new Date().toISOString() }
    : { doit_video_consent_version: null, doit_video_consent_at: null } });
  return error ? '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.' : null;
}

/** 확인·의사를 보낸 뒤 서버가 다시 계산한 상태(쓰기 성공 ≠ 허용). */
export async function confirmMeetCheck(userId: string, matchId: string, sessionId: string, stateVersion: string): Promise<MeetStatus | null> {
  return parseMeetStatus(await serverFunctionRequest<unknown>('doit-connect', { action: 'meet_check', matchId, sessionId, stateVersion }, userId));
}

/** requestId = 이 의사 한 번의 제출. 실패 뒤 같은 선택 재시도는 같은 id(서버가 한 번만 저장 · 다른 선택이면 409). */
export async function sendMeetIntent(userId: string, matchId: string, sessionId: string, stateVersion: string, intent: MeetIntent, requestId: string): Promise<MeetStatus | null> {
  return parseMeetStatus(await serverFunctionRequest<unknown>('doit-connect', { action: 'meet_intent', matchId, sessionId, intent, requestId, stateVersion }, userId));
}

// 2026-10-01 대표 「SAFETY LAYER」: 신고 사유 6개(서버 doit-connect REPORT_REASONS 와 같아야 한다 · 검사가 확인한다).
export type ReportReason = 'unpleasant' | 'scam' | 'fake' | 'threat' | 'spam' | 'other';
export const REPORT_REASONS: readonly (readonly [ReportReason, string])[] = [
  ['unpleasant', '불쾌한 대화'], ['scam', '사기·금전 요구'], ['fake', '허위 정보'], ['threat', '위협·강요'], ['spam', '스팸'], ['other', '기타'],
];
/** 서버가 실제로 저장했다고 답한 것만 true(화면이 「접수했어요」를 지어내지 않는다). 예전 서버는 보내지 않는다(false). */
export interface SafetySaved { blocked: boolean; reported: boolean }
const saved = (out: { blocked?: unknown; reported?: unknown }): SafetySaved => ({ blocked: out.blocked === true, reported: out.reported === true });

/**
 * 신고 한 번의 제출 = 요청 id 하나. 실패 뒤 같은 대상·같은 내용으로 다시 누르면 같은 id(서버가 한 건으로 본다),
 * 성공했거나 내용(사유·차단)이 바뀌면 새 id. 새로 연 신고는 같은 상대·같은 사유여도 새 사건으로 남는다.
 */
export function reportSubmission(): { idFor: (key: string) => string; done: () => void } {
  let current: { key: string; id: string } | null = null;
  return {
    idFor: (key) => { if (!current || current.key !== key) current = { key, id: crypto.randomUUID() }; return current.id; },
    done: () => { current = null; },
  };
}

export async function leaveMatch(userId: string, matchId: string, options: { block: boolean; report: boolean; reason?: ReportReason; requestId?: string }): Promise<SafetySaved> {
  const { reason, requestId, ...rest } = options;
  const out = await serverFunctionRequest<{ blocked?: unknown; reported?: unknown }>('doit-connect', { action: 'leave', matchId, ...rest, ...(reason ? { reason } : {}), ...(requestId && (reason || rest.report) ? { reportRequestId: requestId } : {}) }, userId);
  return saved(out ?? {});
}

/** 후보 단계 차단·신고(숨김과 함께). 서버가 저장한 것만 돌려준다. */
export async function reportCandidate(userId: string, candidateId: string, options: { block: boolean; reason?: ReportReason; requestId?: string }): Promise<SafetySaved> {
  const out = await serverFunctionRequest<{ blocked?: unknown; reported?: unknown }>('doit-connect', { action: 'choose', candidateId, choice: 'hide', block: options.block, ...(options.reason ? { reason: options.reason, ...(options.requestId ? { reportRequestId: options.requestId } : {}) } : {}) }, userId);
  return saved(out ?? {});
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
  const r = out.readiness;
  const readiness = r && typeof r === 'object' && r.conversation && typeof r.conversation.ready === 'boolean' ? r : null;
  return { eligible: out.eligible === true, missing: Array.isArray(out.missing) ? out.missing : [], prepared: typeof out.prepared === 'number' ? out.prepared : 0, candidates: Array.isArray(out.candidates) ? out.candidates : [], readiness };
}

/** 후보 고르기. 둘 다 'yes' 일 때만 서버가 연결을 연다(status 'mutual'). 한쪽만이면 'waiting'. */
export async function chooseCandidate(userId: string, candidateId: string, choice: CandidateChoice): Promise<{ status: 'waiting' | 'mutual' | 'declined' | string; match_id?: string | null }> {
  return serverFunctionRequest('doit-connect', { action: 'choose', candidateId, choice }, userId);
}

/** 연결 결과(본인 것만). 추천을 다듬는 데만 쓰고 내 프로필·확정한 말로 올리지 않는다. */
export async function sendOutcome(userId: string, matchId: string, patch: Partial<Record<OutcomeField, string>>): Promise<void> {
  await serverFunctionRequest('doit-connect', { action: 'outcome', matchId, ...patch }, userId);
}
