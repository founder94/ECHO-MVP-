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
  current_choices?: string[] | null; // 예전 앱용(서버가 먼저 펼친 보기만). 새 화면은 current_rescue 를 쓴다.
  // 2026-10-01 주관식 본체 + 객관식 구조대: options = 서버가 거른 보기(2~4) · show = 서버가 먼저 펼침 · fallback = 보기를 못 만듦(안전 안내만)
  current_rescue?: AgentRescue | null;
  previous?: { question: string; options: string[]; chosen: string } | null; // 직전 질문을 보기로 답했으면 그 보기와 고른 것(뒤로·고치기 복원)
  messages: { role: 'ai' | 'user'; text: string }[];
  summary: { purpose: string; text: string }[]; closing: string | null;
  profile: AgentProfile | null; handoff: { status: string } | null;
  intro?: AgentIntro | null; // 서버 v1.6 · 대화가 끝났을 때만
  goal?: string | null; goal_label?: string | null; // 서버 v2.4 · 이 세션의 관계 목적(예전 세션은 null)
  run?: AgentRun | null; // 2026-10-03 서버 실행 기록(코드·수치만) — 다음 할 일(next)은 서버가 정한다. 화면은 그대로 보여 줄 뿐 바꾸지 않는다.
}
// 서버 실행 기록 모습(doit-agent run.ts runView). 화면이 계획·완료를 스스로 정하지 않는다 — next 를 그대로 따른다.
export type AgentRunOutcome = 'needs_user' | 'in_progress' | 'done' | 'on_hold' | 'stopped';
export type AgentRunNext = 'answer' | 'complete_profile' | 'tell_more' | 'open_candidates' | 'run' | 'retry_later' | 'wait' | 'resume_if_wanted';
export interface AgentRun {
  version: string; goal: string; plan_rev: number; outcome: AgentRunOutcome; waiting: string | null; next: AgentRunNext; missing: string[];
  steps: { id: string; status: string; why: string | null }[];
  candidates: { outcome: 'found' | 'none' | 'not_ready' | 'failed' | 'skipped'; count: number | null; at: string; fresh: boolean } | null;
}
export interface AgentRunTool { tool: 'readiness' | 'candidates'; outcome: 'found' | 'none' | 'not_ready' | 'failed' | 'skipped'; count: number | null; code: string | null }
const RUN_OUTCOMES = new Set<string>(['needs_user', 'in_progress', 'done', 'on_hold', 'stopped']);
const RUN_NEXT = new Set<string>(['answer', 'complete_profile', 'tell_more', 'open_candidates', 'run', 'retry_later', 'wait', 'resume_if_wanted']);
// 모양이 틀린 실행 기록은 쓰지 않는다(null 로 취급 · 화면이 임의로 채우지 않음)
export function validRun(r: unknown): r is AgentRun {
  const x = r as AgentRun | null;
  return !!x && typeof x.version === 'string' && typeof x.goal === 'string' && Number.isInteger(x.plan_rev) && RUN_OUTCOMES.has(x.outcome)
    && (x.waiting === null || typeof x.waiting === 'string') && RUN_NEXT.has(x.next)
    && Array.isArray(x.missing) && x.missing.every((m) => typeof m === 'string')
    && Array.isArray(x.steps) && x.steps.every((st) => !!st && typeof st.id === 'string' && typeof st.status === 'string' && (st.why === null || typeof st.why === 'string'))
    && (x.candidates === null || validRunCandidates(x.candidates));
}
// 후보 조회 요약: 결과 종류(서버 목록) · 개수(정수 또는 null) · 시각(글자) · 지금 기준과 일치(참/거짓)만 — 그 밖의 모양은 받지 않는다
const RUN_TOOL_OUTCOMES = new Set<string>(['found', 'none', 'not_ready', 'failed', 'skipped']);
function validRunCandidates(c: unknown): boolean {
  const x = c as AgentRun['candidates'];
  return !!x && RUN_TOOL_OUTCOMES.has(x.outcome) && (x.count === null || (Number.isInteger(x.count) && x.count >= 0)) && typeof x.at === 'string' && typeof x.fresh === 'boolean';
}
// 이번 실행 도구 결과: 도구 이름 · 결과 종류 · 개수 · 코드(글자 또는 null)만 — 모양이 틀리면 없는 것(null)으로 본다
function validRunTool(t: unknown): t is AgentRunTool {
  const x = t as AgentRunTool | null;
  return !!x && (x.tool === 'readiness' || x.tool === 'candidates') && RUN_TOOL_OUTCOMES.has(x.outcome)
    && (x.count === null || (Number.isInteger(x.count) && x.count >= 0)) && (x.code === null || typeof x.code === 'string');
}
// 소개 초안(서버가 대화를 마칠 때 같은 호출에서 쓴다). status: ready = 쓸 문장 있음 · failed = 못 씀 · none = 들은 말이 없어 안 씀.
export interface AgentIntro { status: 'ready' | 'failed' | 'none'; text: string; lines: string[]; tries_left: number; used: 'as_is' | 'edited' | 'own' | null }
export interface AgentRescue { options: string[]; symbols?: string[]; show: boolean; fallback: boolean } // symbols = 서버가 고른 생활형 심볼(보기와 같은 순서 · 빈 칸이면 점)
export interface AgentTurn { kind: string; reply: string; question: string | null; saved: boolean; finish: boolean; after: boolean }

export const AGENT_PURPOSE_LABELS: Record<string, string> = {
  relationship_intent: '원하는 만남', attraction_comfort: '편하거나 끌리는 사람', values_character: '사람을 볼 때 중요한 것',
  relationship_style: '알아가는 방식과 속도', boundaries: '꼭 있었으면 하는 것 · 피하고 싶은 것',
};

function validSession(s: unknown): s is AgentSession {
  const x = s as AgentSession | null;
  const ok = !!x && typeof x.id === 'string' && (x.phase === 'talk' || x.phase === 'done') && !!x.progress && Number.isInteger(x.progress.asked)
    && Array.isArray(x.messages) && x.messages.every(m => (m.role === 'ai' || m.role === 'user') && typeof m.text === 'string');
  if (ok && x!.run != null && !validRun(x!.run)) x!.run = null; // 실행 기록만 틀리면 대화는 그대로 쓰고 실행 기록은 버린다
  return ok;
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
// rescue.choice = 누른 보기(서버가 지금 질문의 승인 보기인지 다시 확인하고 사용자 직접 답으로 저장) · rescue.rescueOpen = 보기가 펼쳐져 있었음.
export async function agentTurn(userId: string, sessionId: string, text: string, correction?: { purpose: string | null }, rescue?: { choice?: string; rescueOpen?: boolean }): Promise<{ session: AgentSession; turn: AgentTurn }> {
  const r = await write<{ session: AgentSession; turn: AgentTurn }>(userId, { action: 'agent_turn', sessionId, text, ...(correction ? { correction } : {}), ...(rescue?.choice ? { choice: rescue.choice } : {}), ...(rescue?.rescueOpen ? { rescueOpen: true } : {}) });
  if (!validSession(r.session) || !r.turn || typeof r.turn.kind !== 'string') throw new Error('INVALID_RESPONSE');
  return r;
}

// 2026-10-01 「잘 모르겠어요」 = 구조 요청(답 아님 · 저장 0). 서버가 지금 질문의 보기를 정해 돌려준다(이미 있으면 AI 호출 0).
export async function agentRescue(userId: string, sessionId: string): Promise<AgentSession> {
  const r = await write<{ session: AgentSession }>(userId, { action: 'agent_rescue', sessionId });
  if (!validSession(r.session)) throw new Error('INVALID_RESPONSE');
  return r.session;
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

// 2026-10-03 실행 단계(agent_run · 모델 호출 0): 서버가 정한 도구 하나만 실행하고 결과·다음 할 일을 돌려준다.
// resume = 사용자가 직접 누른 「다시 이어서」일 때만 true(화면이 스스로 재개하지 않음). 같은 요청 id 재전송 = 서버가 저장된 결과를 돌려준다(duplicate).
export async function agentRun(userId: string, sessionId: string, opts: { resume?: boolean } = {}): Promise<{ session: AgentSession; run: AgentRun; tool: AgentRunTool | null; duplicate: boolean }> {
  const r = await write<{ session: AgentSession; run: AgentRun; tool?: AgentRunTool | null; duplicate?: boolean }>(userId, { action: 'agent_run', sessionId, ...(opts.resume === true ? { resume: true } : {}) });
  if (!validSession(r.session) || !validRun(r.run)) throw new Error('INVALID_RESPONSE');
  return { session: r.session, run: r.run, tool: validRunTool(r.tool) ? r.tool : null, duplicate: r.duplicate === true };
}

// 2026-10-03 연결 화면의 실행 단계 버튼(Codex 명세 20261003-1 항목 B). 사용자가 누른 그 한 번만 실행한다:
//   · 진행 중이면 다시 누른 것은 무시(네트워크 1번) · 세션은 읽기만(agent_get · 없으면 새로 만들지 않음) · 재개(resume)는 보내지 않음
//   · 성공한 응답만 결과로 넘김(실패 = 마지막 성공 상태 유지 · 자동 재시도·재개·후보 선택 0) · next 는 서버 값 그대로
export function createAgentRunTrigger(deps: {
  getSession: () => Promise<AgentSession | null>;
  run: (sessionId: string) => Promise<{ run: AgentRun; tool: AgentRunTool | null }>;
  onResult: (run: AgentRun, tool: AgentRunTool | null) => void;
  onError: (e: unknown) => void;
  onBusy?: (busy: boolean) => void;
}): () => Promise<void> {
  let inFlight = false;
  return async () => {
    if (inFlight) return;
    inFlight = true; deps.onBusy?.(true);
    try {
      const session = await deps.getSession();
      if (!session) { deps.onError(new Error('NO_SESSION')); return; }
      const out = await deps.run(session.id);
      deps.onResult(out.run, out.tool);
    } catch (e) {
      deps.onError(e);
    } finally {
      inFlight = false; deps.onBusy?.(false);
    }
  };
}
