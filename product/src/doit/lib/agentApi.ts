import { UnderstandingError, prepareUnderstandingRequest, serverFunctionRequest } from '@/doit/lib/understandingApi';
import { READ_TIMEOUT_MS, TimeoutError, withTimeout } from '@/doit/lib/withTimeout';
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

// 끝없는 기다림 막기(2026-09-27 FINAL IMPLEMENTATION MASTER · Failure State): 응답이 없으면 정해진 시간 뒤 오류로 끝내 화면이 「다시 시도」를 보여 준다.
// 쓰기(대화 한 번)는 AI 호출 여러 번이라 더 기다린다. 시간이 지나도 요청 식별값을 지우지 않으므로(complete 안 부름) 같은 말을 다시 보내면
// 서버가 같은 요청으로 알아보고 이미 처리한 결과를 돌려준다(두 번 반영 0 · doit-agent 같은 requestId 재전송 처리).
export const AGENT_WRITE_WAIT_MS = 60_000;
const OFFLINE = '인터넷 연결이 끊겼어요. 적은 말은 그대로 있으니 연결되면 다시 보내 주세요.';
const SLOW = '답이 늦어지고 있어요. 적은 말은 그대로 있으니 다시 보내 주세요. 이미 처리됐다면 두 번 저장되지 않아요.';
function offline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
async function limited<T>(work: () => Promise<T>, ms: number, label: string): Promise<T> {
  if (offline()) throw new UnderstandingError('OFFLINE', OFFLINE);
  try { return await withTimeout(work(), ms, label); } catch (e) {
    if (e instanceof TimeoutError) throw new UnderstandingError(offline() ? 'OFFLINE' : 'TIMEOUT', offline() ? OFFLINE : SLOW);
    throw e;
  }
}

export async function agentGet(userId: string): Promise<AgentSession | null> {
  const r = await limited(() => serverFunctionRequest<{ session: AgentSession | null }>('doit-agent', { action: 'agent_get' }, userId), READ_TIMEOUT_MS, 'agent_get');
  if (r.session === null) return null;
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  return r.session;
}

async function write<T>(userId: string, body: Record<string, unknown>): Promise<T> {
  const request = await prepareUnderstandingRequest(userId, body);
  const result = await limited(() => serverFunctionRequest<T>('doit-agent', request.body, userId), AGENT_WRITE_WAIT_MS, String(body.action));
  request.complete();
  return result;
}

// firstAnswer = 첫 질문(목적 타일 화면)의 답: 고른 만남 + 한 줄. 없으면 서버가 첫 질문을 만든다.
// seed = 사주·타로 결과에서 들어왔을 때의 이야기 거리(결과 종류만 · 사용자 사실 아님). 서버가 모르면 무시하고 보통 대화로 시작한다.
export async function agentStart(userId: string, input: { tone: AgentTone; mode: AgentMode; firstAnswer?: string; seed?: ContentSeed | null }): Promise<AgentSession> {
  const r = await write<{ session: AgentSession }>(userId, { action: 'agent_start', tone: input.tone, mode: input.mode, ...(input.firstAnswer ? { firstAnswer: input.firstAnswer } : {}), ...(input.seed ? { seed: input.seed } : {}) });
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
