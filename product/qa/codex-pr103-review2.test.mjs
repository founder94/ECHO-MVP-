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

// PR #103 Codex Code Review(리뷰 5400264424 · 6a310b7) P1 재현 — 대화 예산 경계는 어림(글자÷1.5)이 아니라 보장된 상한으로
test('P1 대화에 남은 토큰이 적으면, 실제 사용량이 어림보다 많을 수 있는 호출(한글 등 바이트가 큰 입력)은 보내지 않음', async () => {
  const policy = defaultPolicy('fixture'); policy.limits.same_provider_retries = 0;
  let calls = 0; const p = { id: 'openai', call: async () => { calls++; return { ...result, provider: 'openai', input_tokens: 1100, output_tokens: 10 }; } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  router.limitTo({ calls: 10, tokens: 1000 });
  const input = { latest: '가'.repeat(1200) }; // 어림 ≈ 1,2xx자 ÷ 1.5 ≈ 810 + 10 = 820(≤ 1000) · 바이트 상한 ≈ 3,6xx > 1000
  await assert.rejects(router.llm('turn', 's', input), (e) => e.code === 'budget_exceeded');
  assert.equal(calls, 0, '보장된 상한이 남은 예산을 넘으면 보내지 않음(실제 1,110토큰이면 대화 상한 초과였음)');
  const small = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  small.limitTo({ calls: 10, tokens: 1000 });
  await small.llm('turn', 's', { latest: '안녕' });
  assert.equal(calls, 1, '상한 안이면 보냄(과차단 0)');
});

// ── 2026-10-03 자체 점검(Codex 넘기기 전) 재현 — 라우터·연결부
test('자체 P2 한 요청에서 거절이 나오면 같은 요청의 뒤 호출(다른 작업·다른 제공사)도 보내지 않음', async () => {
  const policy = defaultPolicy('fixture'); policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true };
  policy.tasks = { default: ['openai'], ack: ['gemini'] }; policy.limits.same_provider_retries = 0;
  const p = openAIProvider('synthetic-not-a-key', jsonRes({ model: 'm', choices: [{ message: { content: null, refusal: 'no' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 0 } }));
  let gem = 0; const g = { id: 'gemini', call: async () => { gem++; return result; } };
  const router = createModelRouter({ policy, providers: { openai: p, gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 's', { latest: '거절될 글' }), (e) => e.code === 'refused');
  await assert.rejects(router.llm('ack', 's', { latest: '거절될 글' }), (e) => e.code === 'refused');
  assert.equal(gem, 0, '거절된 글이 다른 제공사로 가지 않음');
});
test('자체 P2 사용자가 끊은 요청(abort)은 업체 연속 오류(차단기)에 들어가지 않음', async () => {
  const policy = defaultPolicy('fixture'); policy.limits.same_provider_retries = 0;
  const health = {};
  const { ProviderError } = await import('../supabase/functions/doit-agent/providers.ts');
  for (let i = 0; i < 3; i++) {
    // 보내기 직전엔 살아 있다가 호출 중 사용자가 끊음 → 업체는 timeout 으로 보이지만 예외 처리 시점에 aborted
    const sig = { aborted: false };
    const p = { id: 'openai', call: async () => { sig.aborted = true; throw new ProviderError('openai', 'timeout', 1); } };
    const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 }, health, signal: sig });
    await assert.rejects(router.llm('turn', 's', {}));
  }
  assert.equal(health.openai?.consecutive_errors ?? 0, 0, '끊긴 요청 3번 = 차단기 0');
});
test('자체 P2 한쪽만 있는 사용량(입력만)은 확인된 사용량이 아님 · Gemini 생각 토큰은 출력에 포함', async () => {
  const p = openAIProvider('synthetic-not-a-key', jsonRes({ model: 'm', choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 100 } }));
  const router = createModelRouter({ policy: defaultPolicy('fixture'), providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  await router.llm('turn', 's', {});
  assert.equal(router.log[0].usage, 'unknown'); assert.ok(router.summary().tokens_reserved_unconfirmed > 0);
  const g = geminiProvider('synthetic-not-a-key', jsonRes({ modelVersion: 'g', candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 300 } }));
  const out = await g.call({ model: 'g', system: 's', input: {}, maxTokens: 10, temperature: 0, timeoutMs: 1000 });
  assert.equal(out.output_tokens, 305, '출력 = 답 5 + 생각 300');
});
