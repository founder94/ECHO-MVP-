// ECHO Model Router(대표 「FINAL MASTER EXECUTION LOCK」 §3·§4·§10·§19·§30·§31 · 「3-MODEL ROUTER LOCAL BUILD」 §3·§6·§8, 2026-09-27).
// 서버 규칙이다 — 모델이 다른 모델을 부를지 정하지 않는다. 결과는 늘 v3.1 서버 검사를 거친다(모델 후보일 뿐).
// v3.1 Agent 파일을 고치지 않는다: Agent 가 이미 넘기는 호출 모양(kind · input.action · previous_attempt · recovery · statements)으로 단계를 알고,
//   이해 단계 결과 글자의 input_type(모델 분류 후보)을 같은 턴의 말하기 호출에 붙인다(최종 행동은 늘 서버 Action Router 값 = input.action).
// 매 턴 세 모델을 함께 부르지 않는다: 한 호출 = 한 모델. 다른 모델은 ① 어려운 행동(SPECIALIST) ② 업체 오류(대체 사슬) ③ 서버 검사 실패 뒤 다시 청할 때만.
// 역할(PRIMARY·SPECIALIST·FALLBACK)에 어떤 모델을 둘지는 registry 로만 정한다 — 실측 전에는 임시(provisional) · 바꾸는 것 = 모델 변경 = 대표 승인.
import { ProviderError, type ModelProvider, type ProviderId, type ProviderResult, type Stage } from "./providers.ts";
export type { Stage } from "./providers.ts";

export type Role = "PRIMARY" | "SPECIALIST" | "FALLBACK";
export interface Target { provider: ProviderId; model: string }
export interface Registry { version: string; provisional: boolean; roles: Partial<Record<Role, Target>>; specialist_stages?: Stage[]; timeout_ms: number; max_tokens: number; temperature: number; top_p?: number }
export interface Budget { max_calls_per_conversation: number; max_tokens_per_conversation: number }
// Agent 쪽 호출 계약(v3.1 Llm 과 같은 모양 — Agent 를 가져오지 않는다).
export interface LlmResult { text: string; model?: string | null; input_tokens?: number | null; output_tokens?: number | null }
export type Llm = (kind: "opening" | "turn" | "closing" | "intro", system: string, input: unknown) => Promise<LlmResult>;

// 어려운 행동: 정정 받기 · 불만·지적·거절 수리 · 메타·물음에 답하기(v3.1 Action Router 가 정한 값). 어려운 단계: 복구 · 소개 다시 만들기.
export const SPECIALIST_ACTIONS = new Set(["REPAIR", "ANSWER_USER", "ACK_CORRECTION"]);
// 이해 단계 분류 후보 중 어려운 입력(말하기 행동이 보통이어도 SPECIALIST 로) — 정정·거절·불만·메타·이미 말함.
export const SPECIALIST_INPUTS = new Set(["CORRECTION", "REJECTION", "COMPLAINT", "META_QUESTION", "ALREADY_ANSWERED"]);
const DEFAULT_SPECIALIST_STAGES: Stage[] = ["recovery", "rebuild"];

export interface CallShape { stage: Stage; action: string | null; retry: boolean }
export interface RouteDecision extends CallShape { input_type: string | null; role: Role; reason: string; budget_downgrade: boolean }
export interface CallRecord {
  seq: number; stage: Stage; action: string | null; input_type: string | null; retry: boolean; role: Role; reason: string;
  chain_index: number; fallback_from: ProviderId | null; fallback_reason: string | null;
  provider: ProviderId; provider_kind: "real" | "fake"; model_requested: string; model_served: string | null;
  input_tokens: number | null; cached_tokens: number | null; output_tokens: number | null; latency_ms: number;
  error: string | null; budget_downgrade: boolean; skipped_unhealthy: ProviderId[];
}

/** 호출 모양으로 단계를 안다(Agent 수정 0). */
export function stageOf(kind: string, input: unknown): CallShape {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const retry = o.previous_attempt != null;
  if (kind === "opening") return { stage: "opening", action: null, retry };
  if (kind === "closing") return { stage: "closing", action: null, retry };
  if (kind === "intro") return { stage: Array.isArray(o.statements) || typeof o.statement === "string" ? "rebuild" : "intro", action: null, retry };
  if (typeof o.action === "string") return { stage: o.recovery != null ? "recovery" : "speak", action: o.action, retry };
  return { stage: "understand", action: null, retry };
}

/** 역할 결정(서버 규칙 · 결정적). */
export function decide(reg: Registry, s: CallShape, inputType: string | null, overBudget: boolean): RouteDecision {
  const specialistStages = reg.specialist_stages ?? DEFAULT_SPECIALIST_STAGES;
  let role: Role = "PRIMARY"; let reason = "normal";
  if (s.stage === "speak" && s.action && SPECIALIST_ACTIONS.has(s.action)) { role = "SPECIALIST"; reason = `action:${s.action}`; }
  else if (s.stage === "speak" && inputType && SPECIALIST_INPUTS.has(inputType)) { role = "SPECIALIST"; reason = `input:${inputType}`; }
  if (specialistStages.includes(s.stage)) { role = "SPECIALIST"; reason = `stage:${s.stage}`; }
  if (s.retry && s.stage !== "recovery") { role = "FALLBACK"; reason = `retry_after_validation:${s.stage}`; } // 형식·빈 답·질문 약속 등 서버 검사를 못 넘긴 뒤 다시 청함 → 다른 모델
  let budget_downgrade = false;
  if (overBudget && role !== "PRIMARY") { role = "PRIMARY"; reason += "|budget"; budget_downgrade = true; } // 비용 상한을 넘으면 더 올리지 않는다(상태 규칙은 그대로)
  if (!reg.roles[role]) { reason += `|${role}_unassigned`; role = "PRIMARY"; }
  return { ...s, input_type: inputType, role, reason, budget_downgrade };
}

/** 한 역할의 호출 사슬: 그 역할 → FALLBACK → PRIMARY → SPECIALIST(같은 업체·모델은 한 번만). */
export function chainOf(reg: Registry, role: Role): Target[] {
  const out: Target[] = [];
  for (const r of [role, "FALLBACK", "PRIMARY", "SPECIALIST"] as Role[]) { const t = reg.roles[r]; if (t && !out.some((x) => x.provider === t.provider && x.model === t.model)) out.push(t); }
  return out;
}

// §31 전송 최소화: 모델 입력에 생년월일·출생시간·연락처 같은 칸이 있으면 보내지 않는다(Agent 는 원래 넣지 않는다 — 마지막 안전망).
const PII_KEYS = /^(birth|birth_?date|birth_?time|birthday|dob|phone|phone_?number|email|address|real_?name|resident|rrn)$/i;
export function piiKeys(input: unknown, path = ""): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap((v, i) => piiKeys(v, `${path}[${i}]`));
  return Object.entries(input as Record<string, unknown>).flatMap(([k, v]) => [...(PII_KEYS.test(k) ? [`${path}${k}`] : []), ...piiKeys(v, `${path}${k}.`)]);
}
const inputTypeOf = (text: string): string | null => { try { const o = JSON.parse(text); return typeof o?.input_type === "string" ? o.input_type : null; } catch { return null; } };

export interface RouterOptions { registry: Registry; providers: Partial<Record<ProviderId, ModelProvider>>; budget: Budget; unhealthyAfter?: number; cooldownMs?: number; now?: () => number }
export interface Router { llm: Llm; log: CallRecord[]; health: Record<string, { consecutive_errors: number; open_until: number }> }

/** 대화 하나에 Router 하나(비용 상한·관측은 대화 단위). 모든 업체가 실패하면 마지막 오류를 던진다 → v3.1 은 상태를 건드리지 않고 PROVIDER 오류로 돌려준다. */
export function createRouter(o: RouterOptions): Router {
  const log: CallRecord[] = []; const health: Router["health"] = {};
  const now = o.now ?? Date.now; const after = o.unhealthyAfter ?? 3; const cool = o.cooldownMs ?? 60_000;
  let seq = 0; let turnInputType: string | null = null;
  const used = () => ({ calls: log.filter((r) => !r.error).length, tokens: log.reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0) });
  const blank = { cached_tokens: null, input_tokens: null, output_tokens: null, model_served: null };
  const llm: Llm = async (kind, system, input) => {
    const s = stageOf(kind, input);
    if (s.stage === "understand" && !s.retry) turnInputType = null; // 새 턴
    const leak = piiKeys(input);
    if (leak.length) { // 어느 업체에도 보내지 않는다(칸 이름만 기록 · 값 0)
      log.push({ seq: ++seq, ...s, input_type: turnInputType, role: "PRIMARY", reason: `pii_keys:${leak.join(",")}`, chain_index: 0, fallback_from: null, fallback_reason: null, provider: "openai", provider_kind: "real", model_requested: "-", ...blank, latency_ms: 0, error: "pii_blocked", budget_downgrade: false, skipped_unhealthy: [] });
      throw new ProviderError("openai", "pii_blocked", 0);
    }
    const u = used();
    const d = decide(o.registry, s, s.stage === "understand" ? null : turnInputType, u.calls >= o.budget.max_calls_per_conversation || u.tokens >= o.budget.max_tokens_per_conversation);
    const chain = chainOf(o.registry, d.role); const skipped: ProviderId[] = [];
    let lastErr: unknown = new ProviderError(chain[0]?.provider ?? "openai", "not_connected", 0); let prev: ProviderId | null = null; let prevCode: string | null = null; let idx = 0;
    for (const t of chain) {
      const h = health[t.provider] ??= { consecutive_errors: 0, open_until: 0 };
      const p = o.providers[t.provider];
      if (!p || h.open_until > now()) { skipped.push(t.provider); continue; }
      const base = { seq: ++seq, stage: d.stage, action: d.action, input_type: d.input_type, retry: d.retry, role: d.role, reason: d.reason, chain_index: idx++, fallback_from: prev, fallback_reason: prevCode,
        provider: t.provider, provider_kind: p.kind, model_requested: t.model, budget_downgrade: d.budget_downgrade, skipped_unhealthy: [...skipped] };
      try {
        const r: ProviderResult = await p.call({ stage: d.stage, action: d.action, input_type: d.input_type, model: t.model, system, input, maxTokens: o.registry.max_tokens, temperature: o.registry.temperature, topP: o.registry.top_p, timeoutMs: o.registry.timeout_ms, output: "json_object" });
        h.consecutive_errors = 0;
        log.push({ ...base, model_served: r.model_served, input_tokens: r.input_tokens, cached_tokens: r.cached_tokens, output_tokens: r.output_tokens, latency_ms: r.latency_ms, error: null });
        if (d.stage === "understand") turnInputType = inputTypeOf(r.text) ?? turnInputType;
        return { text: r.text, model: r.model_served ?? r.model_requested, input_tokens: r.input_tokens, output_tokens: r.output_tokens };
      } catch (e) {
        const code = e instanceof ProviderError ? e.code : "network";
        log.push({ ...base, ...blank, latency_ms: e instanceof ProviderError ? e.latency_ms : 0, error: code });
        if (code !== "not_connected" && ++h.consecutive_errors >= after) h.open_until = now() + cool;
        lastErr = e; prev = t.provider; prevCode = code;
      }
    }
    throw lastErr;
  };
  return { llm, log, health };
}

/** 서버 채택 여부(관측): 같은 단계를 곧바로 다시 청했거나 복구로 넘어갔으면 앞 후보는 서버 검사에서 떨어진 것이다. */
export function acceptance(log: CallRecord[]): (CallRecord & { accepted: boolean | null; validation: "accepted" | "rejected_by_server" | "provider_error" })[] {
  const ok = log.filter((r) => !r.error);
  return log.map((r) => {
    if (r.error) return { ...r, accepted: null, validation: "provider_error" as const };
    const next = ok[ok.indexOf(r) + 1];
    const rejected = !!next && ((next.retry && (next.stage === r.stage || (r.stage === "speak" && next.stage === "recovery"))) || (r.stage === "speak" && next.stage === "recovery"));
    return { ...r, accepted: !rejected, validation: rejected ? "rejected_by_server" as const : "accepted" as const };
  });
}

/** Model Performance Dataset 한 줄(§19 · 대화 원문 0 · 사람다움은 사람 검토 뒤 채움). 비용은 공식 단가를 확인한 뒤에만(없으면 null). */
export function performanceRows(log: CallRecord[], prices: Partial<Record<string, { input: number; cached: number; output: number }>> = {}) {
  return acceptance(log).map((r) => {
    const p = prices[`${r.provider}:${r.model_requested}`];
    const cost = p && r.input_tokens != null && r.output_tokens != null ? ((r.input_tokens - (r.cached_tokens ?? 0)) * p.input + (r.cached_tokens ?? 0) * p.cached + r.output_tokens * p.output) / 1e6 : null;
    return { provider: r.provider, provider_kind: r.provider_kind, model: r.model_requested, served: r.model_served, task: r.stage, action: r.action, input_type: r.input_type, role: r.role, reason: r.reason,
      retry: r.retry, fallback: r.chain_index > 0, fallback_reason: r.fallback_reason, error: r.error, validation: r.validation, success: r.accepted === true, humanity: null as null | "PASS" | "PARTIAL" | "FAIL",
      input_tokens: r.input_tokens, cached_tokens: r.cached_tokens, output_tokens: r.output_tokens, latency_ms: r.latency_ms, cost_usd: cost, cost_basis: cost == null ? "확인 불가(공식 단가 미확인)" : "등록 단가" };
  });
}
