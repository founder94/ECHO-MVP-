// ECHO Model Provider 공통 계약(대표 「FINAL MASTER EXECUTION LOCK」 §9 · 「3-MODEL ROUTER LOCAL BUILD」 §2·§4·§5, 2026-09-27).
// ECHO Agent 는 업체 SDK 를 모른다 — 모델 호출은 이 계약 하나로만 한다(업체 SDK 설치 0 · fetch 만).
// 업체 부품이 하는 일 = 글자 한 번 받아 오기 + 관측값. 하지 않는 일 = 상태(Canonical State) 변경 · 소개·매칭 확정 · 다음 업체 고르기(Router 와 서버만).
// 모델 글자의 해석(JSON 읽기 · 받아주기/질문 후보 · 검사)은 업체와 상관없이 v3.1 서버가 같은 규칙으로 한다.
// 키는 부르는 쪽(Edge 함수 · 시험 도구)이 넘긴다. 이 파일은 환경변수·Secret 을 읽지 않는다.
//
// OpenAI = 운영 doit-agent/index.ts 의 openAI() 요청 모양을 옮김(실측으로 동작 확인).
// Gemini · Anthropic = 이번 단계는 가짜 부품만(대표 결정: 공식 문서 확인 전 실제 요청 형식을 추정해 만들지 않는다 · 실제 연결 직전 별도 STOP).

export type ProviderId = "openai" | "anthropic" | "gemini";
export type Stage = "understand" | "speak" | "recovery" | "closing" | "intro" | "rebuild" | "opening";
export type ProviderErrorCode = "timeout" | "http_4xx" | "http_5xx" | "http_429" | "empty" | "network" | "no_key" | "pii_blocked" | "not_connected";
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
export class ProviderError extends Error {
  code: ProviderErrorCode; provider: ProviderId; latency_ms: number;
  constructor(provider: ProviderId, code: ProviderErrorCode, latency_ms: number) { super(`${provider}:${code}`); this.provider = provider; this.code = code; this.latency_ms = latency_ms; }
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
