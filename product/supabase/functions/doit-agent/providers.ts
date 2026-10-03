// ECHO Agent 모델 제공사 연결부(2026-10-03 대표 「3개 AI 제공사 통합」 · 9/27 router 스파이크의 providers.ts 를 운영 Agent 모양으로 옮김).
// 제공사 모델은 ECHO Agent 의 내부 하위 도구다 — 이 파일은 「글자 한 번 받아 오기 + 관측값」만 한다.
// 하지 않는 일: 상태 변경 · 응답 채택 · 다음 제공사 고르기(modelRouter.ts = 서버 규칙) · 환경변수/Secret 읽기(키는 부르는 쪽이 넘긴다).
// 업체 SDK 설치 0(fetch 만). 오류에는 업체:코드 · HTTP 상태 · 업체 오류 코드/종류 · Retry-After 만 남긴다(키 · 사용자 원문 · 업체 오류 메시지 글 0).
// 요청 형식 근거: OpenAI = 운영 doit-agent openAI()(실측 동작) · Anthropic = Messages API(POST /v1/messages · x-api-key · anthropic-version 2023-06-01 ·
//   9/27 smoke·run 35~38 실측) · Gemini = REST generateContent(POST v1beta/models/{id}:generateContent · x-goog-api-key · run 35 실측 · 할당량 오류 다수).

export type ProviderId = "openai" | "anthropic" | "gemini";
export const PROVIDER_IDS: readonly ProviderId[] = ["openai", "anthropic", "gemini"];
export type ProviderErrorCode = "timeout" | "http_4xx" | "http_5xx" | "http_429" | "empty" | "network" | "no_key" | "refused" | "truncated";

export interface ProviderRequest {
  model: string; system: string; input: unknown;
  maxTokens: number; temperature: number; topP?: number; timeoutMs: number;
  signal?: AbortSignal; // 요청 전체 기한(라우터) — 넘으면 바로 끊는다
}
export interface ProviderResult {
  text: string; provider: ProviderId; model_requested: string; model_served: string | null;
  input_tokens: number | null; cached_tokens: number | null; output_tokens: number | null; latency_ms: number;
  truncated: boolean; // 길이 상한에서 잘림 — 글은 그대로 돌려주고, 쓸지·다른 곳으로 돌릴지는 라우터·Agent(형식 검사)가 정한다
}
export interface ProviderErrorDetail { status: number | null; provider_code: string | null; provider_type: string | null; retry_after_ms: number | null }
// 응답 본문을 받은 실패(거절·빈 답)에 업체가 적어 보낸 사용량 — 실패여도 쓴 만큼은 쓴 것(2026-10-03 Codex 재현). 응답이 없으면 null(= 미확인).
export interface ProviderUsage { input_tokens: number | null; cached_tokens: number | null; output_tokens: number | null; model_served: string | null }
export class ProviderError extends Error {
  code: ProviderErrorCode; provider: ProviderId; latency_ms: number; detail: ProviderErrorDetail; usage: ProviderUsage | null;
  constructor(provider: ProviderId, code: ProviderErrorCode, latency_ms: number, detail: Partial<ProviderErrorDetail> = {}, usage: ProviderUsage | null = null) {
    super(`${provider}:${code}`); this.provider = provider; this.code = code; this.latency_ms = latency_ms; this.usage = usage;
    this.detail = { status: detail.status ?? null, provider_code: detail.provider_code ?? null, provider_type: detail.provider_type ?? null, retry_after_ms: detail.retry_after_ms ?? null };
  }
}
export interface ModelProvider { readonly id: ProviderId; call(req: ProviderRequest): Promise<ProviderResult> }
type Fetch = typeof fetch;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const token = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_.\-]{1,64}$/.test(v) ? v : typeof v === "number" ? String(v) : null); // 코드 모양만(메시지 글 0)
const httpCode = (s: number): ProviderErrorCode => (s === 429 ? "http_429" : s >= 500 ? "http_5xx" : "http_4xx");
// 모델이 JSON 을 ```json … ``` 로 감싸 오면 벗긴다(해석·검사는 Agent 서버).
const unfence = (t: string) => { const m = t.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i); return (m ? m[1] : t).trim(); };

/** 오류 응답 본문에서 코드·종류만 읽는다. OpenAI {error:{type,code}} · Anthropic {error:{type}} · Gemini {error:{code,status,details[].retryDelay}}. */
export function errorDetailOf(status: number, body: unknown, retryAfter: string | null): ProviderErrorDetail {
  const e = (body && typeof body === "object" ? (body as Record<string, unknown>).error : null) as Record<string, unknown> | null;
  let ra = retryAfter == null ? null : /^\d+(\.\d+)?$/.test(retryAfter.trim()) ? Math.round(Number(retryAfter) * 1000) : null;
  if (ra == null && Array.isArray(e?.details)) for (const d of e!.details as Record<string, unknown>[]) {
    const m = typeof d?.retryDelay === "string" ? d.retryDelay.match(/^(\d+(?:\.\d+)?)s$/) : null;
    if (m) { ra = Math.round(Number(m[1]) * 1000); break; }
  }
  return { status, provider_code: token(e?.code) ?? token(e?.status), provider_type: token(e?.type) ?? token(e?.status), retry_after_ms: ra };
}

// 공통: 시간 제한(호출 하나) + 요청 전체 기한(signal) · HTTP 오류 분류.
async function post(provider: ProviderId, f: Fetch, url: string, headers: Record<string, string>, body: unknown, req: ProviderRequest, t0: number): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), req.timeoutMs);
  const onOuter = () => ctrl.abort();
  req.signal?.addEventListener("abort", onOuter, { once: true });
  try {
    if (req.signal?.aborted) throw new ProviderError(provider, "timeout", 0);
    const res = await f(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) {
      let b: unknown = null; try { b = await res.json(); } catch { /* 본문 없음 */ }
      throw new ProviderError(provider, httpCode(res.status), Date.now() - t0, errorDetailOf(res.status, b, res.headers?.get?.("retry-after") ?? null));
    }
    return await res.json() as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(provider, ctrl.signal.aborted ? "timeout" : "network", Date.now() - t0);
  } finally { clearTimeout(timer); req.signal?.removeEventListener("abort", onOuter); }
}

/** OpenAI — 운영 doit-agent openAI() 와 같은 요청(model · temperature · top_p · max_tokens · json_object · system/user). 잘린 답도 예전처럼 글을 돌려준다(truncated 표시). */
export function openAIProvider(apiKey: string, f: Fetch = fetch): ModelProvider {
  return { id: "openai", call: async (req) => {
    const t0 = Date.now();
    if (!apiKey) throw new ProviderError("openai", "no_key", 0);
    const d = await post("openai", f, "https://api.openai.com/v1/chat/completions", { Authorization: `Bearer ${apiKey}` }, {
      model: req.model, temperature: req.temperature, top_p: req.topP, max_tokens: req.maxTokens, response_format: { type: "json_object" },
      messages: [{ role: "system", content: req.system }, { role: "user", content: JSON.stringify(req.input) }] }, req, t0);
    const choice = (d.choices as { message?: { content?: string; refusal?: string | null }; finish_reason?: string }[] | undefined)?.[0];
    const u = (d.usage ?? {}) as Record<string, unknown>;
    const usage: ProviderUsage = { input_tokens: num(u.prompt_tokens), output_tokens: num(u.completion_tokens), cached_tokens: num((u.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens), model_served: typeof d.model === "string" ? d.model : null };
    if (choice?.message?.refusal) throw new ProviderError("openai", "refused", Date.now() - t0, {}, usage);
    const text = String(choice?.message?.content ?? "").trim();
    if (!text) throw new ProviderError("openai", "empty", Date.now() - t0, {}, usage);
    return { text, provider: "openai", model_requested: req.model, model_served: usage.model_served,
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, cached_tokens: usage.cached_tokens, latency_ms: Date.now() - t0, truncated: choice?.finish_reason === "length" };
  } };
}

/** Anthropic(Claude) — Messages API. temperature 허용은 모델마다 다르다(sampling) · top_p 는 보내지 않는다. 거절(stop_reason refusal)은 refused · max_tokens 는 truncated 표시. */
export interface AnthropicOptions { sampling?: "temperature" | "none" }
export function anthropicProvider(apiKey: string, opt: AnthropicOptions = {}, f: Fetch = fetch): ModelProvider {
  return { id: "anthropic", call: async (req) => {
    const t0 = Date.now();
    if (!apiKey) throw new ProviderError("anthropic", "no_key", 0);
    const body: Record<string, unknown> = { model: req.model, max_tokens: req.maxTokens, system: req.system, messages: [{ role: "user", content: JSON.stringify(req.input) }] };
    if ((opt.sampling ?? "temperature") === "temperature") body.temperature = req.temperature;
    const d = await post("anthropic", f, "https://api.anthropic.com/v1/messages", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body, req, t0);
    const u = (d.usage ?? {}) as Record<string, unknown>;
    // input_tokens 는 캐시 몫을 뺀 값 → 다른 업체와 같게(입력 전체 · 그중 캐시) 맞춘다.
    const usage: ProviderUsage = { input_tokens: num(u.input_tokens) == null ? null : num(u.input_tokens)! + (num(u.cache_read_input_tokens) ?? 0) + (num(u.cache_creation_input_tokens) ?? 0),
      cached_tokens: num(u.cache_read_input_tokens), output_tokens: num(u.output_tokens), model_served: typeof d.model === "string" ? d.model : null };
    if (d.stop_reason === "refusal") throw new ProviderError("anthropic", "refused", Date.now() - t0, {}, usage);
    const blocks = Array.isArray(d.content) ? d.content as { type?: string; text?: string }[] : [];
    const text = unfence(blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join(""));
    if (!text) throw new ProviderError("anthropic", "empty", Date.now() - t0, {}, usage);
    return { text, provider: "anthropic", model_requested: req.model, model_served: usage.model_served,
      input_tokens: usage.input_tokens, cached_tokens: usage.cached_tokens, output_tokens: usage.output_tokens, latency_ms: Date.now() - t0, truncated: d.stop_reason === "max_tokens" };
  } };
}

/** Gemini — REST generateContent · JSON 응답 요청(responseMimeType). 안전 차단(promptFeedback.blockReason · finishReason SAFETY)은 refused · MAX_TOKENS 는 truncated 표시. */
export function geminiProvider(apiKey: string, f: Fetch = fetch): ModelProvider {
  return { id: "gemini", call: async (req) => {
    const t0 = Date.now();
    if (!apiKey) throw new ProviderError("gemini", "no_key", 0);
    const d = await post("gemini", f, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent`, { "x-goog-api-key": apiKey }, {
      systemInstruction: { parts: [{ text: req.system }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(req.input) }] }],
      generationConfig: { temperature: req.temperature, ...(req.topP != null ? { topP: req.topP } : {}), maxOutputTokens: req.maxTokens, responseMimeType: "application/json" } }, req, t0);
    const cand = (Array.isArray(d.candidates) ? d.candidates[0] : null) as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string } | null;
    const u = (d.usageMetadata ?? {}) as Record<string, unknown>;
    const usage: ProviderUsage = { input_tokens: num(u.promptTokenCount), cached_tokens: num(u.cachedContentTokenCount), output_tokens: num(u.candidatesTokenCount), model_served: typeof d.modelVersion === "string" ? d.modelVersion : null };
    if ((d.promptFeedback as { blockReason?: string } | undefined)?.blockReason || cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new ProviderError("gemini", "refused", Date.now() - t0, {}, usage);
    const text = unfence((cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => String(p.text ?? "")).join(""));
    if (!text) throw new ProviderError("gemini", "empty", Date.now() - t0, {}, usage);
    return { text, provider: "gemini", model_requested: req.model, model_served: usage.model_served,
      input_tokens: usage.input_tokens, cached_tokens: usage.cached_tokens, output_tokens: usage.output_tokens, latency_ms: Date.now() - t0, truncated: cand?.finishReason === "MAX_TOKENS" };
  } };
}
