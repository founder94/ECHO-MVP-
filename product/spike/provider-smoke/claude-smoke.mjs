// Claude Provider 실제 연결 smoke test(2026-09-27 대표 「CLAUDE API SMOKE TEST PREP」).
// 하는 일: ① 모델 목록 1회(생성 0) → 계정에서 실제로 보이는 이름 중 후보를 고름(추정 이름 금지) ② 생성 호출 정확히 1회(합성 입력 · 사용자 원문 0).
// 하지 않는 일: 43판 · 운영 Secret · 상태/프로필/매칭 변경(Claude 는 후보 글자만 돌려준다). 키는 출력하지 않는다.
// 실행: ANTHROPIC_API_KEY=… node --experimental-strip-types spike/provider-smoke/claude-smoke.mjs
const P = await import('../agent-v1-20260925/router/providers.ts');
const key = process.env.ANTHROPIC_API_KEY ?? '';
if (!key) { console.log(JSON.stringify({ SECRET: 'MISSING' })); process.exit(2); }
console.log(JSON.stringify({ SECRET: 'PRESENT' }));

// 후보 순서 = 대표 전달 이름 → 같은 모델의 별칭. 목록에 없으면 호출하지 않는다.
const PREFERRED = ['claude-haiku-4-5-20251001', 'claude-haiku-4-5'];
const PRICE = { input: 1.0, output: 5.0, cache_read: 0.1 }; // Haiku 4.5 공식 단가($/1M 토큰 · claude-api 참고 자료 2026-06-24 기준 · 청구서로 재확인 필요)
let models;
try { models = await P.listModels('anthropic', key); } catch (e) { console.log(JSON.stringify({ step: 'list_models', error: e.code ?? 'unknown' })); process.exit(3); }
console.log(JSON.stringify({ step: 'list_models', count: models.length, models }));
const model = PREFERRED.find((m) => models.includes(m));
if (!model) { console.log(JSON.stringify({ step: 'pick_model', error: 'preferred_not_listed' })); process.exit(4); }

const REQ = { stage: 'understand', action: 'SMOKE', input_type: null, model, system: '너는 연결 확인용 응답기다. JSON 객체 하나로만 답한다. 형식: {"ok": true, "echo": 입력의 word 값}', input: { word: 'smoke-echo' },
  maxTokens: 100, temperature: 0.2, timeoutMs: 30000, output: 'json_object' };
let calls = 0;
try {
  calls++;
  const r = await P.anthropicProvider(key, { sampling: 'temperature', thinking: 'omit' }).call(REQ);
  let parsed = null; try { parsed = JSON.parse(r.text); } catch { /* 모양 확인만 */ }
  const cost = r.input_tokens == null || r.output_tokens == null ? null
    : (((r.input_tokens - (r.cached_tokens ?? 0)) * PRICE.input + (r.cached_tokens ?? 0) * PRICE.cache_read + r.output_tokens * PRICE.output) / 1e6);
  console.log(JSON.stringify({ step: 'generate', calls, ok: true, provider: r.provider, model_requested: r.model_requested, model_served: r.model_served, text: r.text, json_ok: parsed?.ok === true && parsed?.echo === 'smoke-echo',
    input_tokens: r.input_tokens, cached_tokens: r.cached_tokens, output_tokens: r.output_tokens, latency_ms: r.latency_ms, cost_usd: cost }));
} catch (e) {
  console.log(JSON.stringify({ step: 'generate', calls, ok: false, error: e.code ?? 'unknown', latency_ms: e.latency_ms ?? null }));
  process.exit(5);
}
