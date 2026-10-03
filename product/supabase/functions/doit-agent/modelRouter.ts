// ECHO Agent 서버의 모델 선택 규칙(2026-10-03 대표 「3개 AI 제공사 통합」).
// 제품 주체는 ECHO Agent 다. 모델은 내부 도구일 뿐이고, 무엇을 부를지 · 받은 글을 쓸지 · 상태에 반영할지는 서버가 정한다:
//   · 이 파일 = 「이번 호출에 어느 제공사·모델을 쓸지」와 실패 시 전환 · 한도만 정한다.
//   · 응답 채택(형식·회사 규칙 검사) · 상태 반영 · 다음 행동 = agent.ts(서버 규칙) · 저장 = index.ts(판 번호 비교 저장 · 같은 요청 재전송 = 저장된 결과).
// 고정 원칙
//   · 한 호출 = 모델 하나. 매 요청 세 제공사를 함께 부르지 않는다.
//   · 검증되지 않은 우열(「Claude=분석」「Gemini=검색」)을 코드에 두지 않는다 — 작업별 후보 순서는 정책(AI_POLICY)으로만 정하고, 정책이 없으면 지금 승인된 OpenAI 하나.
//   · 사용자 글이 들어가는 호출은, 정책에 그 제공사로의 전달 허용(allow_user_text)이 있어야만 보낸다(개인정보 국외 전송·처리 위탁 승인 전 = 보내지 않음).
//   · 안전상 거절(refused)은 다른 모델로 돌려 피하지 않는다 — 바로 실패.
//   · 재시도·전환 횟수 · 요청 전체 기한 · 토큰 상한이 있다(무한 재시도·순환 0). 모두 실패하면 던진다 → Agent 는 상태를 건드리지 않는다.
//   · 로그에는 제공사·모델·이유·정책판·성공/오류 코드·지연·사용량만(사용자 원문 · 키 · 업체 오류 글 0).
import { anthropicProvider, geminiProvider, openAIProvider, ProviderError, PROVIDER_IDS, type ModelProvider, type ProviderErrorCode, type ProviderId } from "./providers.ts";
import type { Llm, LlmResult } from "./agent.ts";

export type TaskKind = Parameters<Llm>[0];
export interface ProviderPolicy { model: string; allow_user_text: boolean; sampling?: "temperature" | "none" }
export interface AiPolicy {
  version: string;
  providers: Partial<Record<ProviderId, ProviderPolicy>>;
  tasks: Partial<Record<TaskKind | "default", ProviderId[]>>; // 작업별 후보 순서(앞이 먼저)
  switch_on_invalid: boolean; // Agent 가 형식·규칙 검사에서 거절하고 다시 청할 때(previous_attempt) 다음 후보로
  limits: { max_calls_per_request: number; max_tokens_per_request: number; deadline_ms: number; call_timeout_ms: number; same_provider_retries: number; retry_wait_ms: number };
  circuit: { open_after: number; cooldown_ms: number };
}
export const DEFAULT_LIMITS: AiPolicy["limits"] = { max_calls_per_request: 20, max_tokens_per_request: 200_000, deadline_ms: 120_000, call_timeout_ms: 18_000, same_provider_retries: 1, retry_wait_ms: 1500 };
const DEFAULT_CIRCUIT: AiPolicy["circuit"] = { open_after: 3, cooldown_ms: 60_000 };
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:\-/]{1,79}$/;

/** 정책이 없을 때 = 지금 운영 승인 그대로(OpenAI · OPENAI_MODEL · 다른 제공사 0). */
export function defaultPolicy(openaiModel: string): AiPolicy {
  return { version: "ai-policy-default-openai", providers: { openai: { model: openaiModel, allow_user_text: true } }, tasks: { default: ["openai"] }, switch_on_invalid: false, limits: { ...DEFAULT_LIMITS }, circuit: { ...DEFAULT_CIRCUIT } };
}

/** AI_POLICY(JSON) 읽기 — 모양이 틀리면 null(→ 기본 정책). 모델 이름은 비어 있거나 추정 모양이면 그 제공사를 빼고, 한도는 안전 범위로 자른다. */
export function parsePolicy(raw: string | undefined | null): AiPolicy | null {
  if (!raw || !raw.trim()) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== "object" || typeof o.version !== "string" || !o.version.trim()) return null;
  const providers: AiPolicy["providers"] = {};
  for (const id of PROVIDER_IDS) {
    const p = (o.providers as Record<string, Record<string, unknown>> | undefined)?.[id];
    if (!p || typeof p.model !== "string" || !MODEL_ID.test(p.model)) continue;
    providers[id] = { model: p.model, allow_user_text: p.allow_user_text === true, ...(p.sampling === "none" ? { sampling: "none" as const } : {}) };
  }
  const tasks: AiPolicy["tasks"] = {};
  for (const [k, v] of Object.entries((o.tasks ?? {}) as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const list = [...new Set(v.filter((x): x is ProviderId => PROVIDER_IDS.includes(x as ProviderId)))];
    if (list.length) tasks[k as TaskKind] = list;
  }
  if (!tasks.default) tasks.default = ["openai"];
  const l = (o.limits ?? {}) as Record<string, unknown>;
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  const c = (o.circuit ?? {}) as Record<string, unknown>;
  return {
    version: o.version.trim().slice(0, 60), providers, tasks, switch_on_invalid: o.switch_on_invalid === true,
    limits: {
      max_calls_per_request: clamp(l.max_calls_per_request, 1, 40, DEFAULT_LIMITS.max_calls_per_request),
      max_tokens_per_request: clamp(l.max_tokens_per_request, 1000, 1_000_000, DEFAULT_LIMITS.max_tokens_per_request),
      deadline_ms: clamp(l.deadline_ms, 5000, 140_000, DEFAULT_LIMITS.deadline_ms),
      call_timeout_ms: clamp(l.call_timeout_ms, 2000, 60_000, DEFAULT_LIMITS.call_timeout_ms),
      same_provider_retries: clamp(l.same_provider_retries, 0, 2, DEFAULT_LIMITS.same_provider_retries),
      retry_wait_ms: clamp(l.retry_wait_ms, 0, 10_000, DEFAULT_LIMITS.retry_wait_ms),
    },
    circuit: { open_after: clamp(c.open_after, 1, 20, DEFAULT_CIRCUIT.open_after), cooldown_ms: clamp(c.cooldown_ms, 1000, 600_000, DEFAULT_CIRCUIT.cooldown_ms) },
  };
}

// 모델에 보내면 안 되는 칸(마지막 안전망 · Agent 는 원래 넣지 않는다).
const PII_KEYS = /^(birth|birth_?date|birth_?time|birthday|dob|phone|phone_?number|email|address|real_?name|resident|rrn|password|token|access_?token)$/i;
export function piiKeys(input: unknown, path = ""): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap((v, i) => piiKeys(v, `${path}[${i}]`));
  const at = (k: string) => (path ? `${path}.${k}` : k);
  return Object.entries(input as Record<string, unknown>).flatMap(([k, v]) => [...(PII_KEYS.test(k) ? [at(k)] : []), ...piiKeys(v, at(k))]);
}

// 라우터가 스스로 멈춘 이유(제공사 오류가 아님). Agent 는 e.code 만 읽는다.
export type RouterStopCode = "pii_blocked" | "not_configured" | "budget_exceeded" | "deadline_exceeded" | "all_unavailable";
export class RouterError extends Error { code: RouterStopCode; constructor(code: RouterStopCode) { super(`router:${code}`); this.code = code; } }

export interface AiCallLog {
  seq: number; kind: TaskKind; provider: ProviderId | null; model_requested: string | null; model_served: string | null;
  reason: string; policy_version: string; attempt: number; ok: boolean; error: string | null;
  status: number | null; latency_ms: number; input_tokens: number | null; output_tokens: number | null; cached_tokens: number | null;
}
export type RouterHealth = Partial<Record<ProviderId, { consecutive_errors: number; open_until: number }>>;
export interface RouterDeps {
  policy: AiPolicy; providers: Partial<Record<ProviderId, ModelProvider>>; params: { temperature: number; top_p?: number; max_tokens: number };
  health?: RouterHealth; now?: () => number; sleep?: (ms: number) => Promise<void>;
}
export interface ModelRouter { llm: Llm; log: AiCallLog[]; policy: AiPolicy; usable(kind?: TaskKind): ProviderId[]; summary(): { provider: ProviderId | null; providers: ProviderId[]; model: string | null; fallback: number; calls: number; errors: number; tokens_in: number; tokens_out: number } }

// 제공사가 아니라 요청 자체 문제라 다른 모델로 돌려도 안 되는 오류: 거절(안전). 다음 후보로 넘기는 오류: 일시 오류 · 형식 · 4xx(모델 이름·설정 문제) · 빈 답 · 잘림.
const NO_SWITCH: ProviderErrorCode[] = ["refused"];
const SAME_RETRY: ProviderErrorCode[] = ["http_429", "http_5xx", "network"]; // 지금 운영과 같음 — 시간 초과는 같은 곳에 다시 안 함(기다림 상한)

/** 요청 하나(Agent 행동 하나)에 라우터 하나 — 한도·전환·기록은 요청 단위, 건강 상태(연속 오류 차단)는 함수 인스턴스 단위로 공유. */
export function createModelRouter(d: RouterDeps): ModelRouter {
  const now = d.now ?? Date.now;
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const health = d.health ?? {};
  const { policy } = d;
  const L = policy.limits;
  const log: AiCallLog[] = [];
  // 요청 전체 기한: 따로 타이머를 두지 않고, 호출마다 남은 시간을 그 호출의 시간 제한으로 준다(넘으면 그 호출이 timeout) · 다음 호출 전에 다시 본다.
  const started = now();
  let seq = 0;
  const lastUsed = new Map<TaskKind, ProviderId>();
  const spent = () => log.reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  const configured = (id: ProviderId) => !!policy.providers[id] && !!d.providers[id];
  const usable = (kind: TaskKind = "turn") => {
    const order = policy.tasks[kind] ?? policy.tasks.default ?? [];
    return order.filter((id) => configured(id) && policy.providers[id]!.allow_user_text);
  };
  const push = (r: Omit<AiCallLog, "seq" | "policy_version">) => { log.push({ seq: ++seq, policy_version: policy.version, ...r }); };

  const llm: Llm = async (kind, system, input) => {
    const leak = piiKeys(input);
    if (leak.length) { push({ kind, provider: null, model_requested: null, model_served: null, reason: `pii_keys:${leak.slice(0, 5).join(",")}`, attempt: 0, ok: false, error: "pii_blocked", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); throw new RouterError("pii_blocked"); }
    let order = usable(kind);
    // Agent 가 받은 글을 서버 검사에서 거절하고 다시 청함(previous_attempt) → 정책이 허용하면 직전에 쓴 제공사 다음 후보부터
    const retryAfterInvalid = !!(input && typeof input === "object" && (input as Record<string, unknown>).previous_attempt != null);
    let reasonBase = "policy_order";
    if (retryAfterInvalid && policy.switch_on_invalid && order.length > 1) {
      const prev = lastUsed.get(kind);
      const i = prev ? order.indexOf(prev) : -1;
      if (i >= 0) { order = [...order.slice(i + 1), ...order.slice(0, i + 1)]; reasonBase = `switch_on_invalid_from:${prev}`; }
    }
    if (!order.length) { push({ kind, provider: null, model_requested: null, model_served: null, reason: "no_usable_provider", attempt: 0, ok: false, error: "not_configured", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); throw new RouterError("not_configured"); }
    // 연속 오류 차단은 「건너뛸 다른 후보」가 있을 때만 — 후보가 모두 막혔거나 하나뿐이면(기본 정책) 지금 운영처럼 그대로 부른다(차단 때문에 모든 요청이 실패하지 않게).
    const isOpen = (id: ProviderId) => (health[id]?.open_until ?? 0) > now();
    const skipOpen = order.some((id) => !isOpen(id)) && order.length > 1;
    let lastErr: ProviderError | null = null; let idx = 0;
    for (const id of order) {
      const h = health[id] ??= { consecutive_errors: 0, open_until: 0 };
      if (skipOpen && isOpen(id)) { push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason: "circuit_open", attempt: 0, ok: false, error: "skipped_unhealthy", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); continue; }
      const reason = idx++ === 0 ? reasonBase : `fallback_from:${lastErr?.provider}:${lastErr?.code}`;
      for (let attempt = 1; attempt <= 1 + L.same_provider_retries; attempt++) {
        if (log.filter((r) => r.attempt > 0).length >= L.max_calls_per_request || spent() >= L.max_tokens_per_request) {
          push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason, attempt: 0, ok: false, error: "budget_exceeded", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null });
          throw new RouterError("budget_exceeded");
        }
        if (now() - started >= L.deadline_ms) {
          push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason, attempt: 0, ok: false, error: "deadline_exceeded", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null });
          throw new RouterError("deadline_exceeded");
        }
        const p = policy.providers[id]!;
        try {
          const r = await d.providers[id]!.call({ model: p.model, system, input, maxTokens: d.params.max_tokens, temperature: d.params.temperature, topP: d.params.top_p, timeoutMs: Math.min(L.call_timeout_ms, Math.max(1, L.deadline_ms - (now() - started))) });
          lastUsed.set(kind, id);
          // 길이 상한에서 잘린 답: 다음 후보가 있으면 그쪽으로(이 글은 쓰지 않음) · 마지막 후보면 지금 운영처럼 글을 넘기고 Agent 형식 검사가 다시 청한다.
          const hasNext = order.slice(order.indexOf(id) + 1).some((x) => !(skipOpen && isOpen(x)));
          if (r.truncated && hasNext) {
            push({ kind, provider: id, model_requested: p.model, model_served: r.model_served, reason, attempt, ok: false, error: "truncated", status: null, latency_ms: r.latency_ms, input_tokens: r.input_tokens, output_tokens: r.output_tokens, cached_tokens: r.cached_tokens });
            lastErr = new ProviderError(id, "truncated", r.latency_ms);
            break;
          }
          h.consecutive_errors = 0;
          push({ kind, provider: id, model_requested: p.model, model_served: r.model_served, reason, attempt, ok: true, error: r.truncated ? "truncated_passed" : null, status: null, latency_ms: r.latency_ms, input_tokens: r.input_tokens, output_tokens: r.output_tokens, cached_tokens: r.cached_tokens });
          const out: LlmResult = { text: r.text, model: r.model_served ?? r.model_requested, input_tokens: r.input_tokens, output_tokens: r.output_tokens };
          return out;
        } catch (e) {
          const pe = e instanceof ProviderError ? e : new ProviderError(id, "network", 0);
          push({ kind, provider: id, model_requested: p.model, model_served: null, reason, attempt, ok: false, error: pe.code, status: pe.detail.status, latency_ms: pe.latency_ms, input_tokens: null, output_tokens: null, cached_tokens: null });
          lastErr = pe;
          lastUsed.set(kind, id);
          if (NO_SWITCH.includes(pe.code)) throw pe; // 안전상 거절 → 다른 모델로 우회하지 않음
          if (pe.code !== "no_key" && ++h.consecutive_errors >= policy.circuit.open_after) h.open_until = now() + policy.circuit.cooldown_ms;
          if (SAME_RETRY.includes(pe.code) && attempt <= L.same_provider_retries && (!skipOpen || !isOpen(id))) { await sleep(Math.min(L.retry_wait_ms, pe.detail.retry_after_ms ?? L.retry_wait_ms)); continue; }
          break; // 다음 후보로
        }
      }
    }
    throw lastErr ?? new RouterError("all_unavailable");
  };
  const summary = () => {
    const ok = log.filter((r) => r.ok);
    const first = log.find((r) => r.attempt > 0) ?? null;
    return {
      provider: ok[0]?.provider ?? first?.provider ?? null, providers: [...new Set(log.filter((r) => r.attempt > 0 && r.provider).map((r) => r.provider!))], model: ok[0]?.model_served ?? ok[0]?.model_requested ?? null,
      fallback: log.filter((r) => r.reason.startsWith("fallback_from") || r.reason.startsWith("switch_on_invalid")).length,
      calls: log.filter((r) => r.attempt > 0).length, errors: log.filter((r) => !r.ok).length,
      tokens_in: log.reduce((n, r) => n + (r.input_tokens ?? 0), 0), tokens_out: log.reduce((n, r) => n + (r.output_tokens ?? 0), 0),
    };
  };
  return { llm, log, policy, usable, summary };
}

/** Edge 함수에서: 환경 → 정책 · 제공사 부품. 키는 있는지만 본다(값을 로그·응답에 넣지 않음). */
export function routerFromEnv(get: (k: string) => string | undefined, params: RouterDeps["params"], health: RouterHealth, f: typeof fetch = fetch, resolveOpenAiModel: (raw: string | undefined) => string = (r) => (r ?? "").trim()): ModelRouter {
  const policy = parsePolicy(get("AI_POLICY")) ?? defaultPolicy(resolveOpenAiModel(get("OPENAI_MODEL")));
  const keys: Record<ProviderId, string> = { openai: get("OPENAI_API_KEY") ?? "", anthropic: get("ANTHROPIC_API_KEY") ?? "", gemini: get("GEMINI_API_KEY") ?? "" };
  const providers: Partial<Record<ProviderId, ModelProvider>> = {};
  if (keys.openai) providers.openai = openAIProvider(keys.openai, f);
  if (keys.anthropic) providers.anthropic = anthropicProvider(keys.anthropic, { sampling: policy.providers.anthropic?.sampling }, f);
  if (keys.gemini) providers.gemini = geminiProvider(keys.gemini, f);
  return createModelRouter({ policy, providers, params, health });
}
