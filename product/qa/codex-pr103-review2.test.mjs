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
