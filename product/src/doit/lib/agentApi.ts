import { prepareUnderstandingRequest, serverFunctionRequest } from '@/doit/lib/understandingApi';

// ECHO Conversation Agent(서버 doit-agent). 이 파일은 질문·진행·저장을 만들지 않는다 — 서버가 준 모습을 그대로 쓴다.
// 운영 DB와 함수 배포 뒤 빌드 환경에서만 켠다(VITE_ECHO_AGENT_ENABLED). 런타임 자동 활성화 없음.
export const ECHO_AGENT_ENABLED = import.meta.env.VITE_ECHO_AGENT_ENABLED === 'true';

export type AgentTone = 'formal' | 'polite' | 'casual';
export type AgentMode = 'TEXT' | 'VOICE';
export const AGENT_TONES: { id: AgentTone; label: string; hint: string }[] = [
  { id: 'formal', label: '정중한 존댓말', hint: '격식 있게 ~습니다' },
  { id: 'polite', label: '편한 존댓말', hint: '부드럽게 ~요' },
  { id: 'casual', label: '편한 반말', hint: '친구처럼 ~야' },
];
export const DEFAULT_AGENT_TONE: AgentTone = 'polite';

export interface AgentSlot { status: 'UNKNOWN' | 'CONFIRMED' | 'SKIPPED'; items: { note: string; quote: string }[] }
export interface AgentProfile {
  relationship_intent: AgentSlot; attraction_comfort: AgentSlot; values_character: AgentSlot; relationship_style: AgentSlot; boundaries: AgentSlot;
  mbti: { value: string | null; status: string }; blood_type: { value: string | null; status: string };
  core_questions: number; user_corrections: string[];
}
export interface AgentSession {
  id: string; tone: AgentTone; mode: AgentMode; phase: 'talk' | 'done';
  progress: { asked: number; of: number };
  current_question: string | null;
  current_hint?: string | null; // 질문의 답 범위를 알려 주는 한 줄 예시(서버 v1.4 · 없으면 버튼을 그리지 않는다)
  messages: { role: 'ai' | 'user'; text: string }[];
  summary: { purpose: string; text: string }[]; closing: string | null;
  profile: AgentProfile | null; handoff: { status: string } | null;
  intro?: AgentIntro | null; // 서버 v1.6 · 대화가 끝났을 때만
}
// 소개 초안(서버가 대화를 마칠 때 같은 호출에서 쓴다). status: ready = 쓸 문장 있음 · failed = 못 씀 · none = 들은 말이 없어 안 씀.
export interface AgentIntro { status: 'ready' | 'failed' | 'none'; text: string; lines: string[]; tries_left: number; used: 'as_is' | 'edited' | 'own' | null }
export interface AgentTurn { kind: string; reply: string; question: string | null; saved: boolean; finish: boolean; after: boolean }

export const AGENT_PURPOSE_LABELS: Record<string, string> = {
  relationship_intent: '원하는 만남', attraction_comfort: '편하거나 끌리는 사람', values_character: '사람을 볼 때 중요한 것',
  relationship_style: '알아가는 방식과 속도', boundaries: '꼭 있었으면 하는 것 · 피하고 싶은 것',
};

function validSession(s: unknown): s is AgentSession {
  const x = s as AgentSession | null;
  return !!x && typeof x.id === 'string' && (x.phase === 'talk' || x.phase === 'done') && !!x.progress && Number.isInteger(x.progress.asked)
    && Array.isArray(x.messages) && x.messages.every(m => (m.role === 'ai' || m.role === 'user') && typeof m.text === 'string');
}

export async function agentGet(userId: string): Promise<AgentSession | null> {
  const r = await serverFunctionRequest<{ session: AgentSession | null }>('doit-agent', { action: 'agent_get' }, userId);
  if (r.session === null) return null;
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  return r.session;
}

async function write<T>(userId: string, body: Record<string, unknown>): Promise<T> {
  const request = await prepareUnderstandingRequest(userId, body);
  const result = await serverFunctionRequest<T>('doit-agent', request.body, userId);
  request.complete();
  return result;
}

// firstAnswer = 첫 질문(목적 타일 화면)의 답: 고른 만남 + 한 줄. 없으면 서버가 첫 질문을 만든다.
export async function agentStart(userId: string, input: { tone: AgentTone; mode: AgentMode; firstAnswer?: string }): Promise<AgentSession> {
  const r = await write<{ session: AgentSession }>(userId, { action: 'agent_start', tone: input.tone, mode: input.mode, ...(input.firstAnswer ? { firstAnswer: input.firstAnswer } : {}) });
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  return r.session;
}

export async function agentTurn(userId: string, sessionId: string, text: string): Promise<{ session: AgentSession; turn: AgentTurn }> {
  const r = await write<{ session: AgentSession; turn: AgentTurn }>(userId, { action: 'agent_turn', sessionId, text });
  if (!validSession(r.session) || !r.turn || typeof r.turn.kind !== 'string') throw new Error('INVALID_RESPONSE');
  return r;
}

// 소개 초안 다시 쓰기(AI 1번 · 대화 한 번에 3번까지) · 사용자가 고른 것 기록(출처 표시: 이대로/고쳐서/직접).
export async function agentIntro(userId: string, sessionId: string): Promise<{ session: AgentSession; limited: boolean }> {
  const r = await write<{ session: AgentSession; limited?: boolean }>(userId, { action: 'agent_intro', sessionId });
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  return { session: r.session, limited: r.limited === true };
}
export async function agentIntroMark(userId: string, sessionId: string, how: 'as_is' | 'edited' | 'own'): Promise<AgentSession> {
  const r = await write<{ session: AgentSession }>(userId, { action: 'agent_intro_mark', sessionId, how });
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  return r.session;
}
