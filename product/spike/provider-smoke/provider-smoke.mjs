// 3-Provider 실제 연결 smoke test(2026-09-27 대표 「3-PROVIDER SMOKE TEST READY」).
// 업체마다: 모델 목록 1회(생성 0) → 목록에 실제로 있는 저비용 모델 선택(추정 이름 금지) → 생성 호출 정확히 1회(합성 입력 · 사용자 원문 0).
// 43판 0 · 운영 Secret 0 · 상태/프로필/매칭 변경 0(업체는 후보 글자만). 키는 출력하지 않는다.
// 실행: OPENAI_API_KEY=… ANTHROPIC_API_KEY=… GEMINI_API_KEY=… SMOKE_PROVIDERS=openai,anthropic,gemini node --experimental-strip-types spike/provider-smoke/provider-smoke.mjs
const P = await import('../agent-v1-20260925/router/providers.ts');

// 비용 원칙(대표 2026-09-27): smoke = 저비용 모델. 이름은 목록에 있을 때만 쓴다.
//  openai: run 34 기준선 모델(목록 확인 필요) · anthropic: Haiku 4.5(2026-09-27 목록 확인) · gemini: 목록에서 이름 규칙으로 고름(flash-lite → flash · 미리보기·실험·이미지·음성·생각 전용 제외).
// 단가($/1M) = claude-api 참고 자료로 확인한 Anthropic 만. OpenAI·Gemini 는 공식 단가를 이 환경에서 확인하지 못했으므로 비용 = null(확인 불가) · 토큰은 실제 값.
const PLAN = {
  openai: { env: 'OPENAI_API_KEY', pick: (ids) => ['gpt-4.1-mini'].find((m) => ids.includes(m)), make: (k) => P.openAIProvider(k), price: null },
  anthropic: { env: 'ANTHROPIC_API_KEY', pick: (ids) => ['claude-haiku-4-5-20251001'].find((m) => ids.includes(m)), make: (k) => P.anthropicProvider(k, { sampling: 'temperature', thinking: 'omit' }), price: { input: 1.0, output: 5.0, cache_read: 0.1 } },
  gemini: { env: 'GEMINI_API_KEY', make: (k) => P.geminiProvider(k), price: null,
    pick: (ids) => { const ok = ids.filter((m) => !/preview|exp|image|tts|audio|live|thinking|embed|vision|learnlm|gemma|aqa|latest/i.test(m));
      return ok.filter((m) => /flash-lite/.test(m)).sort().reverse()[0] ?? ok.filter((m) => /flash/.test(m)).sort().reverse()[0]; } },
};
const list = String(process.env.SMOKE_PROVIDERS || 'openai,anthropic,gemini').split(',').map((x) => x.trim()).filter((x) => PLAN[x]);
const REQ = (model) => ({ stage: 'understand', action: 'SMOKE', input_type: null, model, system: '너는 연결 확인용 응답기다. JSON 객체 하나로만 답한다. 형식: {"ok": true, "echo": 입력의 word 값}', input: { word: 'smoke-echo' },
  maxTokens: 768, temperature: 0.2, topP: 0.9, timeoutMs: 30000, output: 'json_object' });
let failed = 0;
for (const id of list) {
  const plan = PLAN[id]; const key = process.env[plan.env] ?? '';
  if (!key) { console.log(JSON.stringify({ provider: id, SECRET: 'MISSING' })); failed++; continue; }
  let ids;
  try { ids = await P.listModels(id, key); } catch (e) { console.log(JSON.stringify({ provider: id, step: 'list_models', error: e.code ?? 'unknown' })); failed++; continue; }
  const model = plan.pick(ids);
  console.log(JSON.stringify({ provider: id, SECRET: 'PRESENT', step: 'list_models', count: ids.length, picked: model ?? null }));
  if (!model) { console.log(JSON.stringify({ provider: id, step: 'pick_model', error: 'no_listed_candidate', sample: ids.slice(0, 40) })); failed++; continue; }
  let calls = 0;
  try {
    calls++;
    const r = await plan.make(key).call(REQ(model));
    let parsed = null; try { parsed = JSON.parse(r.text); } catch { /* 모양만 */ }
    const pr = plan.price;
    const cost = pr && r.input_tokens != null && r.output_tokens != null ? (((r.input_tokens - (r.cached_tokens ?? 0)) * pr.input + (r.cached_tokens ?? 0) * pr.cache_read + r.output_tokens * pr.output) / 1e6) : null;
    console.log(JSON.stringify({ provider: id, step: 'generate', calls, ok: true, model_requested: r.model_requested, model_served: r.model_served, text: r.text, json_ok: parsed?.ok === true && parsed?.echo === 'smoke-echo',
      input_tokens: r.input_tokens, cached_tokens: r.cached_tokens, output_tokens: r.output_tokens, latency_ms: r.latency_ms, cost_usd: cost, cost_basis: cost == null ? '확인 불가(공식 단가 미확인)' : 'claude-api 참고 단가' }));
  } catch (e) {
    console.log(JSON.stringify({ provider: id, step: 'generate', calls, ok: false, error: e.code ?? 'unknown', latency_ms: e.latency_ms ?? null })); failed++;
  }
}
process.exit(failed ? 5 : 0);
