// PR #103 Codex Code Review(리뷰 5399862208 · 4e04d36) P1 「Recheck the cost cap before retries and fallbacks」 재현.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRouter, defaultPolicy } from '../supabase/functions/doit-agent/modelRouter.ts';
import { openAIProvider } from '../supabase/functions/doit-agent/providers.ts';
const result = { text: '{}', provider: 'gemini', model_requested: 'fixture', model_served: 'fixture', input_tokens: 1, output_tokens: 1, cached_tokens: 0, latency_ms: 1, truncated: false };
// 빈 답 + 사용량 2/1 토큰을 알려 주는 실패(확인된 사용량)
const emptyWithUsage = () => openAIProvider('synthetic-not-a-key', async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }], usage: { prompt_tokens: 2, completion_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
// 단가 = 토큰당 0.001달러 · 다음 호출 추정 = (입력 11자 ÷ 1.5 → 8 + 출력 상한 10) × 0.001 = 0.018
const PRICE = { in_usd_per_1m: 1000, out_usd_per_1m: 1000 };
test('P1 전환 전 금액 상한 재확인: 첫 실패의 확인된 금액 + 다음 호출 추정이 상한을 넘으면 전환 0', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE;
  policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true, price: PRICE };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0;
  policy.limits.max_cost_usd_per_request = 0.02; // 처음엔 둘 다 0.018 ≤ 0.02 로 통과 → 첫 실패 0.003 뒤 0.021 > 0.02
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return result; } };
  const router = createModelRouter({ policy, providers: { openai: emptyWithUsage(), gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  assert.deepEqual(router.explain('turn', 11).order, ['openai', 'gemini'], '시작 때는 둘 다 상한 안');
  await assert.rejects(router.llm('turn', 'synthetic', {}));
  assert.equal(fallback, 0, '상한을 넘기는 전환 호출 0');
  assert.ok(router.log.some((r) => r.provider === 'gemini' && r.error === 'cost_cap' && r.attempt === 0), '건너뛴 까닭 = cost_cap(보내지 않음)');
  const s = router.summary(); assert.ok(s.cost_usd <= 0.02, `확인된 금액 ${s.cost_usd} ≤ 상한`);
});
test('P1 같은 곳 재시도 전에도 금액 상한 재확인', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE; policy.limits.same_provider_retries = 1; policy.limits.retry_wait_ms = 0;
  policy.limits.max_cost_usd_per_request = 0.02;
  let calls = 0;
  // 429(같은 곳 재시도 대상) + 사용량 없음 → 확인 금액 0 · 이 경우는 재시도 허용 / 사용량 있는 실패로 상한 근처면 재시도 0
  const p = { id: 'openai', call: async () => { calls++; const { ProviderError } = await import('../supabase/functions/doit-agent/providers.ts'); throw new ProviderError('openai', 'http_429', 1, { status: 429 }, { input_tokens: 2, output_tokens: 1, cached_tokens: 0, model_served: 'fixture' }); } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 'synthetic', {}));
  assert.equal(calls, 1, '첫 실패 금액 0.003 + 재시도 추정 0.018 = 0.021 > 0.02 → 재시도 0');
});
test('P1 상한 안이면 지금처럼 전환한다(과차단 0)', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE;
  policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true, price: PRICE };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0; policy.limits.max_cost_usd_per_request = 0.05;
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return result; } };
  const router = createModelRouter({ policy, providers: { openai: emptyWithUsage(), gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  await router.llm('turn', 'synthetic', {});
  assert.equal(fallback, 1);
});

// PR #103 Codex Code Review(리뷰 5400022834 · 9a531dd) P1 2건 재현
test('P1 사용량 모르는 실패도 금액 상한에 예약 금액으로 들어감 → 미확인 실패 뒤 재시도·전환이 상한을 겹쳐 쓰지 않음', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE;
  policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true, price: PRICE };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0;
  policy.limits.max_cost_usd_per_request = 0.03; // 한 번 추정 0.018 · 미확인 실패 1번(예약 0.018) + 다음 0.018 = 0.036 > 0.03
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return result; } };
  const p = openAIProvider('synthetic-not-a-key', async () => new Response('{}', { status: 500 })); // 사용량 없는 실패 = 미확인
  const router = createModelRouter({ policy, providers: { openai: p, gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 'synthetic', {}));
  assert.equal(fallback, 0, '미확인 실패의 예약 금액까지 치면 상한 초과 → 전환 0');
  assert.ok(router.log.some((r) => r.provider === 'gemini' && r.error === 'cost_cap'));
  assert.equal(router.summary().cost_usd, 0, '보고용 금액은 확인된 것만(미확인은 cost_complete=false 로 따로)'); assert.equal(router.summary().cost_complete, false);
});
test('P1 토큰 상한은 이번 시도의 예약까지 더해 비교 — 동시 두 호출(각 예약 608)이 상한 1000 을 함께 넘지 못함', async () => {
  const policy = defaultPolicy('fixture'); policy.limits.max_tokens_per_request = 1000; policy.limits.same_provider_retries = 0;
  let calls = 0; let release; const gate = new Promise((ok) => { release = ok; });
  const p = { id: 'openai', call: async () => { calls++; await gate; return { ...result, provider: 'openai', input_tokens: 50, output_tokens: 5 }; } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 600 } }); // 예약 = 8 + 600 = 608
  const a = router.llm('turn', 'synthetic', {}); const b = router.llm('turn', 'synthetic', {});
  await assert.rejects(b, (e) => e.code === 'budget_exceeded');
  release(); await a;
  assert.equal(calls, 1, '608 + 608 = 1216 > 1000 → 두 번째는 보내지 않음');
});

// PR #103 Codex Code Review(리뷰 5400091798 · 28f2430) P1 재현
test('P1 사용량 숫자 없는 빈 답(메타만)은 확인된 사용량이 아님 → 예약 유지 · 토큰 상한이 전환을 막음', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0;
  policy.limits.max_tokens_per_request = 1000; // 예약 = 8 + 600 = 608 · 미확인 608 + 다음 608 > 1000
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return result; } };
  const p = openAIProvider('synthetic-not-a-key', async () => new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: '' } }] }), { status: 200, headers: { 'content-type': 'application/json' } })); // usage 칸 없음
  const router = createModelRouter({ policy, providers: { openai: p, gemini: g }, params: { temperature: 0, max_tokens: 600 } });
  await assert.rejects(router.llm('turn', 'synthetic', {}), (e) => e.code === 'budget_exceeded');
  assert.equal(router.log[0].usage, 'unknown', '숫자 없는 사용량 = 미확인'); assert.equal(fallback, 0);
  assert.equal(router.summary().cost_complete, false);
});

// PR #103 Codex Code Review(리뷰 5400121290 · 439626a) P1 2건 재현 — 내용 필터·정책 멈춤 = 거절(다른 AI 로 넘기지 않음)
import { geminiProvider } from '../supabase/functions/doit-agent/providers.ts';
const jsonRes = (o) => async () => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
test('P1 OpenAI finish_reason content_filter(거절 칸 없음) = refused · 전환 0', async () => {
  const p = openAIProvider('synthetic-not-a-key', jsonRes({ model: 'm', choices: [{ message: { content: null }, finish_reason: 'content_filter' }], usage: { prompt_tokens: 5, completion_tokens: 0 } }));
  await assert.rejects(p.call({ model: 'm', system: 's', input: {}, maxTokens: 10, temperature: 0, timeoutMs: 1000 }), (e) => e.code === 'refused');
  const policy = defaultPolicy('fixture'); policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true }; policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0;
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return result; } };
  const router = createModelRouter({ policy, providers: { openai: p, gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 'synthetic', {}), (e) => e.code === 'refused'); assert.equal(fallback, 0);
});
test('P1 Gemini 정책 멈춤(BLOCKLIST·SPII·IMAGE_SAFETY·RECITATION 등) = refused · 일부 글이 있어도 성공으로 넘기지 않음', async () => {
  for (const reason of ['BLOCKLIST', 'SPII', 'IMAGE_SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_RECITATION']) {
    for (const parts of [[], [{ text: '{"reply":"부분"}' }]]) {
      const p = geminiProvider('synthetic-not-a-key', jsonRes({ modelVersion: 'g', candidates: [{ content: { parts }, finishReason: reason }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 } }));
      await assert.rejects(p.call({ model: 'g', system: 's', input: {}, maxTokens: 10, temperature: 0, timeoutMs: 1000 }), (e) => e.code === 'refused', `${reason} parts=${parts.length}`);
    }
  }
  const ok = geminiProvider('synthetic-not-a-key', jsonRes({ modelVersion: 'g', candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }] }));
  assert.equal((await ok.call({ model: 'g', system: 's', input: {}, maxTokens: 10, temperature: 0, timeoutMs: 1000 })).text, '{}', '정상 STOP 은 그대로(과차단 0)');
});
