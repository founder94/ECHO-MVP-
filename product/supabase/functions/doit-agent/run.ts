// ECHO Agent 실행 기록(2026-10-03 대표 「당일 구현 마감」: 목표 → 계획 → 도구 실행 → 결과 확인 → 재계획 또는 종료).
// 순수 함수만 — DB·AI 호출 0. 계획은 서버가 지금 대화 상태(agent.ts)에서 계산한다(모델이 계획을 정하지 않는다).
//   · 목표 = 세션의 관계 목적(goal). 계획 = 이해할 칸 5개(understand:*) + 서버 도구 2개(readiness · candidates).
//   · 매번 새로 만들지 않는다: 지난 기록과 비교해 바뀐 단계만 판(plan_rev)을 올리고 이유를 남긴다.
//   · 정정·거절로 확정 정보가 바뀌면, 그 정보로 끝낸 단계와 도구 결과를 무효로 돌린다(오래된 계획·결과를 쓰지 않음).
//   · 도구는 허용 목록만. 상호 선택·동의·약속 확정 같은 사용자 몫 행동은 도구가 아니다(실행 0).
//   · 도구 결과가 없으면 성공이라 하지 않는다: 찾음 / 아직 없음 / 준비 부족 / 조회 실패 를 따로 적는다.
//   · 기록에는 상태·코드·수치·턴 번호만(사용자 원문 · 후보 id · 후보 이유 글 0).
import { PIDS, stateReadiness, type AgentState } from "./agent.ts";

export const RUN_VERSION = "echo-run-v1";
export type StepStatus = "todo" | "done" | "skipped" | "invalid" | "waiting" | "blocked";
export type ToolId = "readiness" | "candidates";
export const TOOLS: readonly ToolId[] = ["readiness", "candidates"]; // 허용 목록(이 밖의 도구는 실행하지 않음)
export type ToolOutcome = "found" | "none" | "not_ready" | "failed" | "skipped";
export type RunOutcome = "needs_user" | "in_progress" | "done" | "on_hold" | "stopped";
export type WaitReason = "answer_question" | "more_info" | "profile_incomplete" | "no_candidates_yet" | "lookup_failed" | "user_stopped" | "budget" | "tool_cooldown" | null;

export interface RunStep { id: string; status: StepStatus; basis: number[]; why: string | null; rev: number }
export interface ToolRun { tool: ToolId; outcome: ToolOutcome; count: number | null; missing: string[]; code: string | null; basis_key: string; at: string; ms: number }
// tokens_in/out = 업체가 알려 준 확인된 사용량 · tokens_unconfirmed = 보냈지만 사용량을 모르는 시도의 예약 추정치(청구액 아님 · 예산에는 보수적으로 포함)
export interface RunBudget { calls: number; tokens_in: number; tokens_out: number; tokens_unconfirmed?: number; tool_runs: number }
export interface Run {
  version: string; goal: string; plan_rev: number; basis_key: string; steps: RunStep[]; tools: ToolRun[];
  outcome: RunOutcome; waiting: WaitReason; missing: string[]; user_stopped: boolean; stop_ack: number | null; budget: RunBudget; changes: string[]; updated_at: string;
  // 최근 실행 요청(agent_run) id 와 그 도구 결과(최근 RUN_LIMITS.requests_kept 개) — 세션 저장과 한 번에 남아, 따로 남기는 재생 기록이 실패해도
  // 그 사이 다른 실행 요청이 있었어도 같은 요청 재전송은 재실행 0
  // run = 그 요청이 돌려준 실행 기록 그대로(runView) — 같은 요청 재전송은 최신 기록이 아니라 이 값을 돌려준다
  recent_requests?: { id: string; tool: { tool: ToolId; outcome: ToolOutcome; count: number | null; code: string | null } | null; run: Record<string, unknown> }[];
}

// 대화 하나의 누적 상한(요청 하나의 상한은 modelRouter). 2026-10-03 QA 실측(마친 대화 1,439개 · 턴 기록만): 호출 p50 8 · p99 22 · 최대 26 · 토큰 p99 56,263 · 최대 67,721.
// 턴 기록 밖 호출(시작 인사 · 소개 다시 쓰기 2 · 보기 요청)을 더해 → 60번 · 150,000토큰(관측 최대의 약 2.3배). 넘으면 모델 호출 0(429 AI_BUDGET).
// 「아직 없음(none)」·「준비 부족(not_ready)」은 대화 밖 사정(새 후보 · 사진 · 프로필 채움)으로 바뀌므로 확정 정보가 그대로여도 시간이 지나면 다시 조회한다(조회 실패 쉬는 시간과 따로).
export const RUN_LIMITS = Object.freeze({ max_calls: 60, max_tokens: 150_000, max_tool_runs: 20, requests_kept: 10, tool_retry_after_ms: 30_000, none_refresh_after_ms: 600_000, not_ready_refresh_after_ms: 30_000, tool_timeout_ms: 10_000, tools_kept: 10, changes_kept: 12 });

const STOP_TURN = (st: AgentState) => { const t = st.turns.at(-1); return !!t && (t.kind === "stop" || t.guard?.rule === "fatigue"); };
// 확정 정보 열쇠(FNV-1a): 도구 결과가 어떤 확정 정보로 나왔는지 묶는다(원문을 따로 저장하지 않음 — 상태에 이미 있는 확정 메모의 지문만).
export function basisKeyOf(st: AgentState): string {
  const parts = PIDS.map((id) => `${id}:${st.slots[id].status}:${st.slots[id].items.filter((i) => i.status === "CONFIRMED").map((i) => `${i.turn}|${i.note}`).join(";")}`).join("\n") + `\ngoal:${st.goal ?? "open"}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) { h ^= parts.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

export function emptyRun(st: AgentState, now: string): Run {
  return { version: RUN_VERSION, goal: st.goal ?? "open", plan_rev: 0, basis_key: "", steps: [], tools: [], outcome: "needs_user", waiting: "answer_question", missing: [], user_stopped: false, stop_ack: null,
    budget: { calls: 0, tokens_in: 0, tokens_out: 0, tool_runs: 0 }, changes: [], updated_at: now };
}

// 아직 없음 · 준비 부족 결과가 다시 조회할 때가 됐나(찾음 · 조회 실패는 해당 없음 — 실패는 tool_retry_after_ms 쉬는 시간으로 따로)
const refreshDue = (t: ToolRun, nowMs: number) => {
  const after = t.outcome === "none" ? RUN_LIMITS.none_refresh_after_ms : t.outcome === "not_ready" ? RUN_LIMITS.not_ready_refresh_after_ms : null;
  return after != null && Number.isFinite(nowMs) && nowMs - Date.parse(t.at) >= after;
};
const lastTool = (run: Run, tool: ToolId) => [...run.tools].reverse().find((t) => t.tool === tool) ?? null;

/** 지금 대화 상태로 계획을 맞춘다. 바뀐 단계만 판을 올린다. usage = 이번 요청의 모델 사용량(누적). */
export function syncRun(prev: Run | null | undefined, st: AgentState, now: string, usage: { calls?: number; tokens_in?: number; tokens_out?: number; tokens_unconfirmed?: number } = {}): Run {
  const run: Run = prev && prev.version === RUN_VERSION ? structuredClone(prev) : emptyRun(st, now);
  run.budget.calls += usage.calls ?? 0; run.budget.tokens_in += usage.tokens_in ?? 0; run.budget.tokens_out += usage.tokens_out ?? 0;
  if (usage.tokens_unconfirmed) run.budget.tokens_unconfirmed = (run.budget.tokens_unconfirmed ?? 0) + usage.tokens_unconfirmed;
  const rd = stateReadiness(st);
  const key = basisKeyOf(st);
  const changed: string[] = [];
  const basisChanged = !!run.basis_key && run.basis_key !== key;
  const finishing = st.phase !== "talk";
  // 멈춤 = 그 「그만」 턴 하나에 한 번만(사용자가 「다시 이어서」로 푼 뒤 같은 턴으로 다시 멈추지 않음)
  const lastN = st.turns.at(-1)?.n ?? null;
  if (finishing && STOP_TURN(st) && lastN !== (run.stop_ack ?? null) && !run.steps.some((s) => s.id === "tool:candidates" && s.status === "done")) { run.user_stopped = true; run.stop_ack = lastN; }

  const want = new Map<string, { status: StepStatus; basis: number[]; why: string | null }>();
  for (const id of PIDS) {
    const slot = st.slots[id];
    const basis = slot.items.filter((i) => i.status === "CONFIRMED").map((i) => i.turn).filter((n) => Number.isFinite(n));
    const before = run.steps.find((s) => s.id === `understand:${id}`);
    if (rd.ready_areas.includes(id)) want.set(`understand:${id}`, { status: "done", basis, why: null });
    else if (slot.status === "SKIPPED") want.set(`understand:${id}`, { status: "skipped", basis: [], why: "user_skipped" });
    // 끝났던 칸이 정정·거절로 더는 확정이 아니면: 무효로 표시하고 다시 할 일로(그 칸을 근거로 한 결과는 아래에서 함께 무효)
    else if (before?.status === "done") want.set(`understand:${id}`, { status: "invalid", basis: [], why: "corrected" });
    else want.set(`understand:${id}`, { status: before?.status === "invalid" ? "invalid" : "todo", basis: [], why: before?.why ?? null });
  }
  want.set("tool:readiness", finishing ? { status: rd.conversation_ready ? "done" : "blocked", basis: [], why: rd.conversation_ready ? null : "more_info" } : { status: "waiting", basis: [], why: "conversation_open" });
  const cand = lastTool(run, "candidates");
  const candFresh = !!cand && cand.basis_key === key;
  let candStep: { status: StepStatus; basis: number[]; why: string | null };
  if (!finishing) candStep = { status: "waiting", basis: [], why: "conversation_open" };
  else if (run.user_stopped) candStep = { status: "blocked", basis: [], why: "user_stopped" };
  else if (!rd.conversation_ready) candStep = { status: "blocked", basis: [], why: "more_info" };
  else if (cand && !candFresh) candStep = { status: "invalid", basis: [], why: "basis_changed" };
  else if (cand && candFresh && refreshDue(cand, Date.parse(now))) candStep = { status: "todo", basis: [], why: "refresh" };
  else if (cand && candFresh && cand.outcome !== "failed") candStep = { status: "done", basis: [], why: cand.outcome };
  else candStep = { status: "todo", basis: [], why: cand?.outcome === "failed" ? "retry_after_failure" : null };
  want.set("tool:candidates", candStep);

  const steps: RunStep[] = [];
  for (const [id, w] of want) {
    const before = run.steps.find((s) => s.id === id);
    const same = before && before.status === w.status && before.why === w.why && before.basis.join(",") === w.basis.join(",");
    if (!same) changed.push(`${id}:${before?.status ?? "new"}>${w.status}`);
    steps.push({ id, status: w.status, basis: w.basis, why: w.why, rev: same ? before!.rev : run.plan_rev + 1 });
  }
  if (changed.length) { run.plan_rev++; run.changes = [...run.changes, ...changed.map((c) => `r${run.plan_rev}:${c}`)].slice(-RUN_LIMITS.changes_kept); }
  if (basisChanged) run.changes = [...run.changes, `r${run.plan_rev}:basis_changed`].slice(-RUN_LIMITS.changes_kept);
  run.steps = steps; run.basis_key = key; run.goal = st.goal ?? "open";
  decide(run, st, rd.missing_areas);
  run.updated_at = now;
  return run;
}

/** 결과에 따라 완료·질문·보류·중단. 서버 규칙만. */
function decide(run: Run, st: AgentState, missingAreas: string[]) {
  const step = (id: string) => run.steps.find((s) => s.id === id)!;
  run.missing = [];
  if (st.phase === "talk") { run.outcome = "needs_user"; run.waiting = "answer_question"; return; }
  if (run.user_stopped) { run.outcome = "stopped"; run.waiting = "user_stopped"; return; }
  if (step("tool:readiness").status !== "done") { run.outcome = "needs_user"; run.waiting = "more_info"; run.missing = missingAreas; return; }
  if (overBudget(run)) { run.outcome = "on_hold"; run.waiting = "budget"; return; }
  const c = step("tool:candidates");
  if (c.status === "todo" || c.status === "invalid") {
    const last = lastTool(run, "candidates");
    // 도구 실행 상한(대화당)에 닿으면 다시 조회·재시도를 보여 주지 않는다 → 저장·응답 모두 「예산으로 보류」
    if (run.budget.tool_runs >= RUN_LIMITS.max_tool_runs) { run.outcome = "on_hold"; run.waiting = "budget"; return; }
    if (last?.outcome === "failed" && c.status === "todo") { run.outcome = "on_hold"; run.waiting = "lookup_failed"; return; }
    run.outcome = "in_progress"; run.waiting = null; return;
  }
  const last = lastTool(run, "candidates")!;
  if (last.outcome === "found") { run.outcome = "done"; run.waiting = null; return; } // 다음 = 사용자가 직접 후보를 보고 고름(Agent 는 고르지 않음)
  if (last.outcome === "none") { run.outcome = "on_hold"; run.waiting = "no_candidates_yet"; return; }
  if (last.outcome === "not_ready") { run.outcome = "needs_user"; run.waiting = "profile_incomplete"; run.missing = last.missing; return; }
  run.outcome = "on_hold"; run.waiting = "lookup_failed";
}

export const overBudget = (run: Run) => run.budget.calls >= RUN_LIMITS.max_calls || run.budget.tokens_in + run.budget.tokens_out + (run.budget.tokens_unconfirmed ?? 0) >= RUN_LIMITS.max_tokens;
/** 모델을 더 불러도 되나(대화 단위 누적 상한). */
export const modelAllowed = (run: Run | null | undefined) => !run || !overBudget(run);
/** 대화 단위로 남은 호출·토큰(이번 요청의 라우터 한도로 넘김 · 미확인 예약 포함). */
export const remainingBudget = (run: Run | null | undefined) => !run ? { calls: RUN_LIMITS.max_calls, tokens: RUN_LIMITS.max_tokens }
  : { calls: RUN_LIMITS.max_calls - run.budget.calls, tokens: RUN_LIMITS.max_tokens - (run.budget.tokens_in + run.budget.tokens_out + (run.budget.tokens_unconfirmed ?? 0)) };

/** 지금 실행할 도구(없으면 null) — 서버가 정한다. 조회 실패 직후에는 잠깐 쉬고, 도구 실행 상한을 넘지 않는다. */
export function dueTool(run: Run, nowMs: number): { tool: ToolId | null; why: WaitReason } {
  if (run.outcome !== "in_progress" && !(run.outcome === "on_hold" && run.waiting === "lookup_failed")) return { tool: null, why: run.waiting };
  if (run.budget.tool_runs >= RUN_LIMITS.max_tool_runs) return { tool: null, why: "budget" };
  const last = lastTool(run, "candidates");
  if (last?.outcome === "failed" && nowMs - Date.parse(last.at) < RUN_LIMITS.tool_retry_after_ms) return { tool: null, why: "tool_cooldown" };
  return { tool: "candidates", why: null };
}

/** 도구 결과를 기록하고 계획·결과를 다시 정한다(같은 확정 정보 열쇠로 묶음). */
export function recordTool(run: Run, st: AgentState, r: Omit<ToolRun, "basis_key">, now: string): Run {
  const next = structuredClone(run);
  next.tools = [...next.tools, { ...r, basis_key: basisKeyOf(st) }].slice(-RUN_LIMITS.tools_kept);
  next.budget.tool_runs++;
  return syncRun(next, st, now);
}

/** 사용자가 직접 「다시 이어서」를 눌렀을 때만 멈춤을 푼다(도구가 스스로 풀지 않음). */
export function resumeRun(run: Run, st: AgentState, now: string): Run {
  const next = structuredClone(run); next.user_stopped = false; next.stop_ack = st.turns.at(-1)?.n ?? next.stop_ack ?? null; next.changes = [...next.changes, `r${next.plan_rev}:user_resumed`].slice(-RUN_LIMITS.changes_kept);
  return syncRun(next, st, now);
}

/** 화면에 줄 모습(코드·수치만). */
export function runView(run: Run | null | undefined) {
  if (!run) return null;
  const last = lastTool(run, "candidates");
  const next = run.outcome === "needs_user" ? (run.waiting === "answer_question" ? "answer" : run.waiting === "profile_incomplete" ? "complete_profile" : "tell_more")
    : run.outcome === "done" ? "open_candidates" : run.outcome === "in_progress" ? "run" : run.outcome === "on_hold" ? (run.waiting === "lookup_failed" ? "retry_later" : "wait") : "resume_if_wanted";
  return { version: run.version, goal: run.goal, plan_rev: run.plan_rev, outcome: run.outcome, waiting: run.waiting, next, missing: run.missing,
    steps: run.steps.map((s) => ({ id: s.id, status: s.status, why: s.why })), candidates: last ? { outcome: last.outcome, count: last.count, at: last.at, fresh: last.basis_key === run.basis_key } : null,
    budget: { ...run.budget, max_calls: RUN_LIMITS.max_calls, max_tokens: RUN_LIMITS.max_tokens } };
}

/** doit-connect `my_candidates` 응답 → 도구 결과(후보 id·이유 글은 담지 않음). 모양이 틀리면 failed. */
export function candidatesOutcome(status: number, body: unknown): { outcome: ToolOutcome; count: number | null; missing: string[]; code: string | null } {
  const b = body && typeof body === "object" ? body as Record<string, unknown> : null;
  if (status !== 200 || !b || b.ok !== true) return { outcome: "failed", count: null, missing: [], code: `http_${status}${typeof b?.code === "string" ? `:${String(b.code).slice(0, 30)}` : ""}` };
  if (b.eligible !== true) return { outcome: "not_ready", count: null, missing: Array.isArray(b.missing) ? (b.missing as unknown[]).filter((x) => typeof x === "string").map((x) => String(x).slice(0, 40)).slice(0, 8) : [], code: null };
  if (!Array.isArray(b.candidates)) return { outcome: "failed", count: null, missing: [], code: "bad_shape" };
  return { outcome: b.candidates.length ? "found" : "none", count: b.candidates.length, missing: [], code: null };
}
