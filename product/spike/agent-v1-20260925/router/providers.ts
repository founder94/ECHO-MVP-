// ECHO Model Provider 공통 계약(대표 「FINAL MASTER EXECUTION LOCK」 §9 · 「3-MODEL ROUTER LOCAL BUILD」 §2·§4·§5, 2026-09-27).
// ECHO Agent 는 업체 SDK 를 모른다 — 모델 호출은 이 계약 하나로만 한다(업체 SDK 설치 0 · fetch 만).
// 업체 부품이 하는 일 = 글자 한 번 받아 오기 + 관측값. 하지 않는 일 = 상태(Canonical State) 변경 · 소개·매칭 확정 · 다음 업체 고르기(Router 와 서버만).
// 모델 글자의 해석(JSON 읽기 · 받아주기/질문 후보 · 검사)은 업체와 상관없이 v3.1 서버가 같은 규칙으로 한다.
// 키는 부르는 쪽(Edge 함수 · 시험 도구)이 넘긴다. 이 파일은 환경변수·Secret 을 읽지 않는다.
//
// OpenAI = 운영 doit-agent/index.ts 의 openAI() 요청 모양을 옮김(실측으로 동작 확인).
// Gemini · Anthropic(2026-09-27 대표 「DIRECT API INTEGRATION PATH」) = fetch 부품 코드만(SDK 설치 0 · 키 0 · 실제 호출 0).
//   요청 형식 근거: Gemini = 전략본부 공식 문서 확인(POST v1beta/models/{MODEL_ID}:generateContent · x-goog-api-key · usageMetadata · modelVersion) +
//   본문 필드 이름(systemInstruction · contents · generationConfig)은 첫 smoke test 로 대조 · Anthropic = 공식 Messages API(POST /v1/messages · x-api-key · anthropic-version 2023-06-01).
//   모델 이름은 넣지 않는다 — 키 등록 뒤 모델 목록(listModels)으로 확인한 이름만 registry 에 적는다.

export type ProviderId = "openai" | "anthropic" | "gemini";
export type Stage = "understand" | "speak" | "recovery" | "closing" | "intro" | "rebuild" | "opening";
export type ProviderErrorCode = "timeout" | "http_4xx" | "http_5xx" | "http_429" | "empty" | "network" | "no_key" | "pii_blocked" | "not_connected" | "refused";
export interface ProviderRequest {
  // 무엇을 하는 호출인지(관측·부품 선택용 · 부품은 이것으로 결정을 내리지 않는다)
  stage: Stage; action: string | null; input_type: string | null;
  model: string; system: string; input: unknown;
  maxTokens: number; temperature: number; topP?: number; timeoutMs: number;
  output: "json_object"; // v3.1 의 모든 호출은 JSON 하나로 답해야 한다(검사는 서버)
}
export interface ProviderResult {
  text: string; provider: ProviderId; model_requested: string; model_served: string | null;
  input_tokens: number | null; cached_tokens: number | null; output_tokens: number | null; latency_ms: number;
}
/** v3.5 PR-01: 오류를 추정하지 않고 기록한다 — HTTP 상태 · 업체 오류 코드/종류 · Retry-After · 시도 번호. 키·사용자 원문·업체 오류 메시지 글은 담지 않는다. */
export interface ProviderErrorDetail { status: number | null; provider_code: string | null; provider_type: string | null; retry_after_ms: number | null; attempt?: number }
export class ProviderError extends Error {
  code: ProviderErrorCode; provider: ProviderId; latency_ms: number; detail: ProviderErrorDetail;
  constructor(provider: ProviderId, code: ProviderErrorCode, latency_ms: number, detail: Partial<ProviderErrorDetail> = {}) {
    super(`${provider}:${code}`); this.provider = provider; this.code = code; this.latency_ms = latency_ms;
    this.detail = { status: detail.status ?? null, provider_code: detail.provider_code ?? null, provider_type: detail.provider_type ?? null, retry_after_ms: detail.retry_after_ms ?? null, ...(detail.attempt != null ? { attempt: detail.attempt } : {}) };
  }
}
const token = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_.\-]{1,64}$/.test(v) ? v : typeof v === "number" ? String(v) : null); // 코드 모양만(메시지 글 0)
/** 오류 응답 본문에서 코드·종류만 읽는다. OpenAI {error:{type,code}} · Anthropic {error:{type}} · Gemini {error:{code,status}}. */
export function errorDetailOf(status: number, body: unknown, retryAfter: string | null): ProviderErrorDetail {
  const e = (body && typeof body === "object" ? (body as Record<string, unknown>).error : null) as Record<string, unknown> | null;
  let ra = retryAfter == null ? null : /^\d+(\.\d+)?$/.test(retryAfter.trim()) ? Math.round(Number(retryAfter) * 1000) : null;
  // Gemini: 대기 시간을 본문 details[].retryDelay(「12s」)로 준다
  if (ra == null && Array.isArray(e?.details)) for (const d of e!.details as Record<string, unknown>[]) { const m = typeof d?.retryDelay === "string" ? d.retryDelay.match(/^(\d+(?:\.\d+)?)s$/) : null; if (m) { ra = Math.round(Number(m[1]) * 1000); break; } }
  return { status, provider_code: token(e?.code) ?? token(e?.status), provider_type: token(e?.type) ?? token(e?.status), retry_after_ms: ra };
}
export interface ModelProvider { readonly id: ProviderId; readonly kind: "real" | "fake"; call(req: ProviderRequest): Promise<ProviderResult> }
type Fetch = typeof fetch;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const httpCode = (s: number): ProviderErrorCode => (s === 429 ? "http_429" : s >= 500 ? "http_5xx" : "http_4xx");

/** OpenAI 부품 — 운영 doit-agent openAI() 와 같은 요청(model · temperature · top_p · max_tokens · json_object · system/user). 키·원문은 오류에 남기지 않는다. */
export function openAIProvider(apiKey: string, f: Fetch = fetch): ModelProvider {
  return { id: "openai", kind: "real", call: async (req) => {
    const t0 = Date.now();
    if (!apiKey) throw new ProviderError("openai", "no_key", 0);
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), req.timeoutMs);
    try {
      const res = await f("https://api.openai.com/v1/chat/completions", { method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: req.model, temperature: req.temperature, top_p: req.topP, max_tokens: req.maxTokens, response_format: { type: req.output },
          messages: [{ role: "system", content: req.system }, { role: "user", content: JSON.stringify(req.input) }] }) });
      if (!res.ok) throw new ProviderError("openai", httpCode(res.status), Date.now() - t0);
      const d = await res.json() as Record<string, unknown>;
      const text = String((d.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "").trim();
      if (!text) throw new ProviderError("openai", "empty", Date.now() - t0);
      const u = (d.usage ?? {}) as Record<string, unknown>;
      return { text, provider: "openai", model_requested: req.model, model_served: typeof d.model === "string" ? d.model : null,
        input_tokens: num(u.prompt_tokens), output_tokens: num(u.completion_tokens), cached_tokens: num((u.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens), latency_ms: Date.now() - t0 };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("openai", ctrl.signal.aborted ? "timeout" : "network", Date.now() - t0);
    } finally { clearTimeout(timer); }
  } };
}

// 공통: 시간 제한 · HTTP 오류 분류 · 키/원문은 오류에 남기지 않는다(오류 = 업체:코드 만).
async function timedFetch(provider: ProviderId, f: Fetch, url: string, init: RequestInit, timeoutMs: number, t0: number): Promise<Record<string, unknown>> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(url, { ...init, signal: ctrl.signal });
    if (!res.ok) { // Anthropic 529(과부하) · 500 → http_5xx · 429 → http_429 · 오류 본문은 코드·종류만 읽는다
      let body: unknown = null; try { body = await res.json(); } catch { /* 본문 없음 */ }
      const ra = typeof (res as Response).headers?.get === "function" ? (res as Response).headers.get("retry-after") : null;
      throw new ProviderError(provider, httpCode(res.status), Date.now() - t0, errorDetailOf(res.status, body, ra));
    }
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(provider, ctrl.signal.aborted ? "timeout" : "network", Date.now() - t0);
  } finally { clearTimeout(timer); }
}
// 모델이 JSON 을 ```json … ``` 로 감싸 오면 벗긴다(글자 해석·검사는 서버 · 여기선 모양만 맞춤). OpenAI 는 json_object 로 받으므로 해당 없음.
const unfence = (t: string) => { const m = t.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i); return (m ? m[1] : t).trim(); };

/** Anthropic(Claude) 부품 — Messages API · SDK 없이 fetch. 샘플링(temperature)은 모델마다 허용이 다르므로 registry 가 정한다(sampling: "temperature" | "none").
 *  thinking: "disabled" 면 { type: "disabled" } 를 보낸다(짧은 JSON 한 개 · max_tokens 안에서 끝나게) · "omit" 이면 보내지 않는다. 모델별 허용은 smoke test 로 확인. */
export interface AnthropicOptions { sampling?: "temperature" | "none"; thinking?: "disabled" | "omit"; version?: string; baseUrl?: string }
export const ANTHROPIC_API = "https://api.anthropic.com";
export function anthropicProvider(apiKey: string, opt: AnthropicOptions = {}, f: Fetch = fetch): ModelProvider {
  return { id: "anthropic", kind: "real", call: async (req) => {
    const t0 = Date.now();
    if (!apiKey) throw new ProviderError("anthropic", "no_key", 0);
    const body: Record<string, unknown> = { model: req.model, max_tokens: req.maxTokens, system: req.system, // 모든 업체 같은 프롬프트(계획 §1) — JSON 요구는 v3 프롬프트 안에 이미 있다
      messages: [{ role: "user", content: JSON.stringify(req.input) }] };
    if ((opt.sampling ?? "temperature") === "temperature") body.temperature = req.temperature; // top_p 는 보내지 않는다(계획 §1)
    if (opt.thinking === "disabled") body.thinking = { type: "disabled" };
    const d = await timedFetch("anthropic", f, `${opt.baseUrl ?? ANTHROPIC_API}/v1/messages`, { method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": opt.version ?? "2023-06-01" }, body: JSON.stringify(body) }, req.timeoutMs, t0);
    if (d.stop_reason === "refusal") throw new ProviderError("anthropic", "refused", Date.now() - t0);
    const blocks = Array.isArray(d.content) ? d.content as { type?: string; text?: string }[] : [];
    const text = unfence(blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("")); // thinking 블록은 버림
    if (!text) throw new ProviderError("anthropic", "empty", Date.now() - t0);
    const u = (d.usage ?? {}) as Record<string, unknown>;
    return { text, provider: "anthropic", model_requested: req.model, model_served: typeof d.model === "string" ? d.model : null,
      // Anthropic input_tokens 는 캐시에서 읽은 몫을 뺀 값 — 다른 업체와 같게(입력 전체 · 그중 캐시) 맞춘다.
      input_tokens: num(u.input_tokens) == null ? null : num(u.input_tokens)! + (num(u.cache_read_input_tokens) ?? 0) + (num(u.cache_creation_input_tokens) ?? 0),
      cached_tokens: num(u.cache_read_input_tokens), output_tokens: num(u.output_tokens), latency_ms: Date.now() - t0 };
  } };
}

/** Gemini 부품 — REST generateContent · SDK 없이 fetch. 모델 이름은 listModels 로 확인한 것만. JSON 은 responseMimeType 로 요청. */
export interface GeminiOptions { baseUrl?: string }
export const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
export function geminiProvider(apiKey: string, opt: GeminiOptions = {}, f: Fetch = fetch): ModelProvider {
  return { id: "gemini", kind: "real", call: async (req) => {
    const t0 = Date.now();
    if (!apiKey) throw new ProviderError("gemini", "no_key", 0);
    const body = { systemInstruction: { parts: [{ text: req.system }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(req.input) }] }],
      generationConfig: { temperature: req.temperature, ...(req.topP != null ? { topP: req.topP } : {}), maxOutputTokens: req.maxTokens, responseMimeType: "application/json" } };
    const d = await timedFetch("gemini", f, `${opt.baseUrl ?? GEMINI_API}/models/${encodeURIComponent(req.model)}:generateContent`, { method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body) }, req.timeoutMs, t0);
    const cand = (Array.isArray(d.candidates) ? d.candidates[0] : null) as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string } | null;
    if ((d.promptFeedback as { blockReason?: string } | undefined)?.blockReason || cand?.finishReason === "SAFETY") throw new ProviderError("gemini", "refused", Date.now() - t0);
    const text = unfence((cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => String(p.text ?? "")).join(""));
    if (!text) throw new ProviderError("gemini", "empty", Date.now() - t0);
    const u = (d.usageMetadata ?? {}) as Record<string, unknown>;
    return { text, provider: "gemini", model_requested: req.model, model_served: typeof d.modelVersion === "string" ? d.modelVersion : null,
      input_tokens: num(u.promptTokenCount), cached_tokens: num(u.cachedContentTokenCount), output_tokens: num(u.candidatesTokenCount), latency_ms: Date.now() - t0 };
  } };
}

/** 키 등록 뒤 첫 확인용: 계정에서 실제로 쓸 수 있는 모델 이름 목록(생성 호출 0 · 대화 원문 0). 추정 이름 대신 여기서 나온 이름만 registry 에 적는다. */
export async function listModels(provider: ProviderId, apiKey: string, f: Fetch = fetch, timeoutMs = 15000): Promise<string[]> {
  const t0 = Date.now();
  if (!apiKey) throw new ProviderError(provider, "no_key", 0);
  if (provider === "openai") {
    const d = await timedFetch(provider, f, "https://api.openai.com/v1/models", { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } }, timeoutMs, t0);
    return (Array.isArray(d.data) ? d.data as { id?: string }[] : []).map((m) => String(m.id ?? "")).filter(Boolean);
  }
  if (provider === "anthropic") {
    const d = await timedFetch(provider, f, `${ANTHROPIC_API}/v1/models?limit=100`, { method: "GET", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } }, timeoutMs, t0);
    return (Array.isArray(d.data) ? d.data as { id?: string }[] : []).map((m) => String(m.id ?? "")).filter(Boolean);
  }
  const d = await timedFetch(provider, f, `${GEMINI_API}/models?pageSize=1000`, { method: "GET", headers: { "x-goog-api-key": apiKey } }, timeoutMs, t0);
  return (Array.isArray(d.models) ? d.models as { name?: string; supportedGenerationMethods?: string[] }[] : [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => String(m.name ?? "").replace(/^models\//, "")).filter(Boolean);
}

// v3.5 PR-01: 재시도·속도 조절(업체 단독 — 다른 업체로 넘어가지 않음 · 같은 요청 그대로 · 품질 조건 변경 0).
// 429 = Retry-After 우선, 없으면 지수 대기 + 흔들림 · 5xx·과부하 = 제한된 횟수 · 4xx·거절·키 없음 = 재시도 0(바로 기록) · 시간 초과·네트워크 = 5xx 와 같게.
export interface RetryPolicy { minIntervalMs: number; max429: number; max5xx: number; baseMs: number; capMs: number }
export const DEFAULT_RETRY: RetryPolicy = { minIntervalMs: 0, max429: 5, max5xx: 2, baseMs: 1000, capMs: 60000 };
export function withRetry(inner: ModelProvider, policy: Partial<RetryPolicy> = {}, hooks: { sleep?: (ms: number) => Promise<void>; now?: () => number; random?: () => number; onAttempt?: (a: { attempt: number; wait_ms: number; error: ProviderErrorCode; detail: ProviderErrorDetail }) => void } = {}): ModelProvider & { attempts: number } {
  const p = { ...DEFAULT_RETRY, ...policy };
  const sleep = hooks.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))); const now = hooks.now ?? Date.now; const rnd = hooks.random ?? Math.random;
  let last = -Infinity; let chain: Promise<void> = Promise.resolve();
  const pace = async () => { const wait = last + p.minIntervalMs - now(); if (wait > 0) await sleep(wait); last = now(); };
  const self = { id: inner.id, kind: inner.kind, attempts: 0, call: (req: ProviderRequest) => {
    const run = async (): Promise<ProviderResult> => {
      let n429 = 0, n5xx = 0;
      for (let attempt = 1; ; attempt++) {
        await pace(); self.attempts++;
        try { return await inner.call(req); } catch (e) {
          if (!(e instanceof ProviderError)) throw e;
          const transient5 = e.code === "http_5xx" || e.code === "timeout" || e.code === "network";
          const retry = (e.code === "http_429" && n429 < p.max429) || (transient5 && n5xx < p.max5xx);
          e.detail.attempt = attempt;
          if (!retry) throw e;
          if (e.code === "http_429") n429++; else n5xx++;
          const backoff = Math.min(p.capMs, p.baseMs * 2 ** (attempt - 1)); const wait = Math.min(p.capMs, e.detail.retry_after_ms ?? Math.round(backoff * (0.5 + rnd())));
          hooks.onAttempt?.({ attempt, wait_ms: wait, error: e.code, detail: e.detail });
          await sleep(wait);
        }
      }
    };
    const job = chain.then(run, run); chain = job.then(() => undefined, () => undefined); return job; // 업체당 한 번에 하나(동시성 1)
  } };
  return self;
}

/** 가짜 부품(시험 전용 · 네트워크 0). script 가 글자를 돌려주거나 { error } 로 실패를 흉내 낸다. */
export type FakeScript = (req: ProviderRequest) => string | { error: ProviderErrorCode; latency_ms?: number } | Promise<string | { error: ProviderErrorCode; latency_ms?: number }>;
export function fakeProvider(id: ProviderId, script: FakeScript, served = `${id}-fake`): ModelProvider & { calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  return { id, kind: "fake", calls, call: async (req) => {
    calls.push(req);
    const a = await script(req);
    if (typeof a !== "string") throw new ProviderError(id, a.error, a.latency_ms ?? 1);
    if (!a.trim()) throw new ProviderError(id, "empty", 1);
    return { text: a.trim(), provider: id, model_requested: req.model, model_served: served, input_tokens: null, cached_tokens: null, output_tokens: null, latency_ms: 1 };
  } };
}
/** 아직 실제 연결이 없는 업체 자리(Gemini · Anthropic). 부르면 not_connected — Router 는 다음 업체로 넘어간다(실제 호출 0). */
export function notConnected(id: "gemini" | "anthropic"): ModelProvider {
  return { id, kind: "fake", call: () => Promise.reject(new ProviderError(id, "not_connected", 0)) };
}
