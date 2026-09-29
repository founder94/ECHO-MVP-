import { prepareUnderstandingRequest, serverFunctionRequest } from '@/doit/lib/understandingApi';
import type { ContentSeed } from './contentSeed';

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
  current_choices?: string[] | null; // 2026-09-30 모르겠다·넘기기 뒤에만 오는 짧은 답 보기(누르면 그 글자를 답으로 보낸다 · 없으면 그리지 않는다)
  messages: { role: 'ai' | 'user'; text: string }[];
  summary: { purpose: string; text: string }[]; closing: string | null;
  profile: AgentProfile | null; handoff: { status: string } | null;
  intro?: AgentIntro | null; // 서버 v1.6 · 대화가 끝났을 때만
  goal?: string | null; goal_label?: string | null; // 서버 v2.4 · 이 세션의 관계 목적(예전 세션은 null)
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

// v2.4 세션 격리(2026-09-28 대표 「SESSION SAFETY」): 이 기기가 이어 가는 대화 세션 id 를 기기(브라우저)에만 기억한다.
// 같은 계정으로 두 기기에서 다른 목적(친구 · 연애)으로 대화해도, 각 기기는 자기 세션만 읽는다(서버도 목적이 다르면 이어받지 않음).
const SESSION_KEY = (userId: string) => `echo:agent-session:${userId}`;
function rememberSession(userId: string, id: string | null): void {
  try { if (id) localStorage.setItem(SESSION_KEY(userId), id); else localStorage.removeItem(SESSION_KEY(userId)); } catch { /* 저장이 막힌 환경: 서버가 가장 최근 세션을 준다 */ }
}
function rememberedSession(userId: string): string | null {
  try { const v = localStorage.getItem(SESSION_KEY(userId)); return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null; } catch { return null; }
}
export function forgetAgentSession(userId: string): void { rememberSession(userId, null); }

export async function agentGet(userId: string): Promise<AgentSession | null> {
  const sessionId = rememberedSession(userId);
  const r = await serverFunctionRequest<{ session: AgentSession | null }>('doit-agent', { action: 'agent_get', ...(sessionId ? { sessionId } : {}) }, userId);
  if (r.session === null) return null;
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  rememberSession(userId, r.session.id);
  return r.session;
}

async function write<T>(userId: string, body: Record<string, unknown>): Promise<T> {
  const request = await prepareUnderstandingRequest(userId, body);
  const result = await serverFunctionRequest<T>('doit-agent', request.body, userId);
  request.complete();
  return result;
}

// firstAnswer = 첫 질문(목적 타일 화면)의 답: 고른 만남 + 한 줄. 없으면 서버가 첫 질문을 만든다.
// seed = 사주·타로 결과에서 들어왔을 때의 이야기 거리(결과 종류만 · 사용자 사실 아님). 서버가 모르면 무시하고 보통 대화로 시작한다.
// goal = 고른 만남(목적 타일 id) — 서버는 같은 목적의 세션만 이어받는다(v2.4).
export async function agentStart(userId: string, input: { tone: AgentTone; mode: AgentMode; firstAnswer?: string; seed?: ContentSeed | null; goal?: { id: string; label: string } | null }): Promise<AgentSession> {
  const r = await write<{ session: AgentSession }>(userId, { action: 'agent_start', tone: input.tone, mode: input.mode, ...(input.firstAnswer ? { firstAnswer: input.firstAnswer } : {}), ...(input.seed ? { seed: input.seed } : {}), ...(input.goal ? { goal: input.goal.id, goalLabel: input.goal.label } : {}) });
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  rememberSession(userId, r.session.id);
  return r.session;
}

// correction = 「ECHO가 이해한 나」에서 누른 정정(칸 id · 다시 말하기는 null). 서버가 정정으로 확정한다(문장으로 추측하지 않음 · 2026-09-27 P0-5).
export async function agentTurn(userId: string, sessionId: string, text: string, correction?: { purpose: string | null }): Promise<{ session: AgentSession; turn: AgentTurn }> {
  const r = await write<{ session: AgentSession; turn: AgentTurn }>(userId, { action: 'agent_turn', sessionId, text, ...(correction ? { correction } : {}) });
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
