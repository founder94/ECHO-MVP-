// PR #103 Codex Code Review(리뷰 5399862208 · 4e04d36) P1 「Recheck the cost cap before retries and fallbacks」 재현.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRouter, defaultPolicy, maskPii } from '../supabase/functions/doit-agent/modelRouter.ts';
import { openAIProvider } from '../supabase/functions/doit-agent/providers.ts';
const result = { text: '{}', provider: 'gemini', model_requested: 'fixture', model_served: 'fixture', input_tokens: 1, output_tokens: 1, cached_tokens: 0, latency_ms: 1, truncated: false };
// 빈 답 + 사용량 2/1 토큰을 알려 주는 실패(확인된 사용량)
const emptyWithUsage = () => openAIProvider('synthetic-not-a-key', async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }], usage: { prompt_tokens: 2, completion_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
// 단가 = 토큰당 0.001달러 · 다음 호출 금액 상한 = (입력 보장 상한 11바이트 + 덧붙임 64 = 75 + 출력 상한 10) × 0.001 = 0.085
// (리뷰 5400827787 P1 뒤: 금액도 입력 보장 상한으로 · 예전 어림(11자 ÷ 1.5 → 8 · 0.018) 기준 숫자를 같은 뜻으로 다시 맞춤)
const PRICE = { in_usd_per_1m: 1000, out_usd_per_1m: 1000 };
test('P1 전환 전 금액 상한 재확인: 첫 실패의 확인된 금액 + 다음 호출 추정이 상한을 넘으면 전환 0', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE;
  policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true, price: PRICE };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0;
  policy.limits.max_cost_usd_per_request = 0.087; // 처음엔 둘 다 0.085 ≤ 0.087 로 통과 → 첫 실패 0.003 뒤 0.088 > 0.087
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return result; } };
  const router = createModelRouter({ policy, providers: { openai: emptyWithUsage(), gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  assert.deepEqual(router.explain('turn', 11).order, ['openai', 'gemini'], '시작 때는 둘 다 상한 안');
  await assert.rejects(router.llm('turn', 'synthetic', {}));
  assert.equal(fallback, 0, '상한을 넘기는 전환 호출 0');
  assert.ok(router.log.some((r) => r.provider === 'openai' && r.attempt > 0), '첫 후보는 실제로 보냄(처음부터 막힌 것이 아님)');
  assert.ok(router.log.some((r) => r.provider === 'gemini' && r.error === 'cost_cap' && r.attempt === 0), '건너뛴 까닭 = cost_cap(보내지 않음)');
  const s = router.summary(); assert.ok(s.cost_usd <= 0.087, `확인된 금액 ${s.cost_usd} ≤ 상한`);
});
test('P1 같은 곳 재시도 전에도 금액 상한 재확인', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE; policy.limits.same_provider_retries = 1; policy.limits.retry_wait_ms = 0;
  policy.limits.max_cost_usd_per_request = 0.087;
  let calls = 0;
  // 429(같은 곳 재시도 대상) + 사용량 없음 → 확인 금액 0 · 이 경우는 재시도 허용 / 사용량 있는 실패로 상한 근처면 재시도 0
  const p = { id: 'openai', call: async () => { calls++; const { ProviderError } = await import('../supabase/functions/doit-agent/providers.ts'); throw new ProviderError('openai', 'http_429', 1, { status: 429 }, { input_tokens: 2, output_tokens: 1, cached_tokens: 0, model_served: 'fixture' }); } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 'synthetic', {}));
  assert.equal(calls, 1, '첫 실패 금액 0.003 + 재시도 상한 0.085 = 0.088 > 0.087 → 재시도 0');
});
test('P1 상한 안이면 지금처럼 전환한다(과차단 0)', async () => {
  const policy = defaultPolicy('fixture');
  policy.providers.openai.price = PRICE;
  policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true, price: PRICE };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0; policy.limits.max_cost_usd_per_request = 0.2; // 0.085 + (0.003 + 0.085) 안
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
  policy.limits.max_cost_usd_per_request = 0.1; // 한 번 상한 0.085 · 미확인 실패 1번(예약 0.085) + 다음 0.085 = 0.17 > 0.1
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

// PR #103 Codex Code Review(리뷰 5400556217 · 287a57b) P1 재현 — 요청 상한도 어림이 아니라 보장된 상한으로
test('P1 요청 토큰 상한: 어림(글자÷1.5)은 상한 안이어도 보장된 상한이 넘으면 보내지 않음(까닭 request_budget)', async () => {
  const policy = defaultPolicy('fixture'); policy.limits.same_provider_retries = 0; policy.limits.max_tokens_per_request = 1000;
  let calls = 0; const p = { id: 'openai', call: async () => { calls++; return { ...result, provider: 'openai', input_tokens: 1100, output_tokens: 10 }; } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  const input = { latest: '가'.repeat(1200) }; // 어림 ≈ 820(≤ 1000) · 바이트 상한 ≈ 3,6xx > 1000 → 실제 1,110토큰이면 요청 상한 초과였음
  await assert.rejects(router.llm('turn', 's', input), (e) => e.code === 'budget_exceeded');
  assert.equal(calls, 0, '보장된 상한이 요청 상한을 넘으면 보내지 않음');
  assert.equal(router.log.at(-1).reason, 'request_budget', '대화 예산이 아니라 이번 요청 한도');
  const small = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
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

// PR #103 Codex Code Review(리뷰 5400366786 · effcc97) P2 재현 — 같은 곳 재시도 기다림도 요청 기한 안에서만
test('P2 기한 직전의 재시도 대기는 기한을 넘기지 않음(재시도 0 · 기한 안에 끝남)', async () => {
  const policy = defaultPolicy('fixture'); policy.limits.same_provider_retries = 1; policy.limits.retry_wait_ms = 10_000; policy.limits.deadline_ms = 200;
  const { ProviderError } = await import('../supabase/functions/doit-agent/providers.ts');
  let calls = 0; const p = { id: 'openai', call: async () => { calls++; throw new ProviderError('openai', 'http_429', 1, { status: 429 }); } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  const t0 = Date.now();
  await assert.rejects(router.llm('turn', 's', {}));
  assert.ok(Date.now() - t0 < 1000, `기한 200ms 인데 ${Date.now() - t0}ms`); assert.equal(calls, 1);
});

// PR #103 Codex Code Review(리뷰 5400588319 · c2e2358) P1 재현 — 붙여 쓴 16자리 카드 번호도 업체로 보내기 전에 가림
test('P1 붙여 쓴 카드 번호(16자리)도 가림 · 띄어 쓴 형태도 그대로 가림 · 일반 숫자는 그대로', () => {
  const a = maskPii({ latest: '카드 1234567812345678 로 결제했어요' });
  assert.equal(a.counts.card, 1); assert.doesNotMatch(JSON.stringify(a.value), /\d{5,}/, '숫자 조각도 남지 않음');
  const b = maskPii({ latest: '1234-5678-1234-5678 / 1234 5678 1234 5678' });
  assert.equal(b.counts.card, 2); assert.doesNotMatch(JSON.stringify(b.value), /\d{4}/);
  const c = maskPii({ latest: '주말에 2번, 3시간 정도 만나요' });
  assert.deepEqual(c.counts, {}, '일반 숫자는 가리지 않음(과차단 0)');
});

// PR #103 Codex Code Review(리뷰 5400659793 · f5d1206) P1 재현 — 사용량 모르는 시도는 다음 요청에도 보장 상한으로 넘김
test('P1 사용량을 모르는 시도의 예약(tokens_reserved_unconfirmed)은 어림이 아니라 보장 상한(입력 바이트 + 출력 상한)', async () => {
  const p = openAIProvider('synthetic-not-a-key', jsonRes({ model: 'm', choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 100 } })); // 입력만 = 미확인
  const router = createModelRouter({ policy: defaultPolicy('fixture'), providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  const input = { latest: '가'.repeat(1200) };
  await router.llm('turn', 's', input);
  const bytes = new TextEncoder().encode(JSON.stringify(input) + 's').length;
  assert.ok(router.summary().tokens_reserved_unconfirmed >= bytes + 10, `넘기는 예약 ${router.summary().tokens_reserved_unconfirmed} ≥ 보장 상한 ${bytes + 10}(어림 ≈ ${Math.ceil(JSON.stringify(input).length / 1.5) + 10})`);
});

// PR #103 Codex Code Review(리뷰 5400827787 · b4531d4) P1 재현 — 금액 상한도 입력 보장 상한으로(글자 수 어림보다 토큰이 많은 글)
test('P1 금액 상한: 어림(글자÷1.5)으로는 상한 안이어도 보장 상한 금액이 넘으면 보내지 않음(cost_cap)', async () => {
  const policy = defaultPolicy('fixture'); policy.limits.same_provider_retries = 0;
  policy.providers.openai.price = PRICE; // 토큰당 0.001
  policy.limits.max_cost_usd_per_request = 1.5; // 어림 ≈ (1,2xx ÷ 1.5 ≈ 810 + 10) × 0.001 ≈ 0.82 ≤ 1.5 · 보장 상한 ≈ (3,6xx + 64 + 10) × 0.001 ≈ 3.7 > 1.5
  let calls = 0; const p = { id: 'openai', call: async () => { calls++; return { ...result, provider: 'openai', input_tokens: 2000, output_tokens: 10 }; } };
  const router = createModelRouter({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 's', { latest: '가'.repeat(1200) }));
  assert.equal(calls, 0, '보장 상한 금액이 상한을 넘으면 보내지 않음');
  assert.ok(router.log.some((r) => r.error === 'cost_cap'));
});

// PR #103 Codex Code Review(리뷰 5400904667 · 732a4f0) P1 재현 — 16자리 4묶음이 아닌 카드 번호(13~19자리)도 가림 · 검증 숫자(Luhn)로 아무 긴 숫자는 그대로
test('P1 카드 번호 13~19자리(Amex 15 · 4-6-5 묶음 · 13 · 19)는 Luhn 맞을 때 가림 · Luhn 아닌 긴 숫자는 그대로', () => {
  for (const t of ['카드 378282246310005 예요', '3782 822463 10005', '3782-822463-10005', '4222222222222', '6011111111111117', '4111 1111 1111 1111 003'.replace(' 003', ''), '6011000990139424']) {
    const r = maskPii({ latest: t });
    assert.equal(r.counts.card, 1, t); assert.doesNotMatch(JSON.stringify(r.value), /\d{4}/, t);
  }
  const plain = maskPii({ latest: '주문번호 123456789012345 로 보냈어요' });
  assert.deepEqual(plain.counts, {}, 'Luhn 아닌 15자리 = 그대로(과차단 0)');
  assert.match(JSON.stringify(plain.value), /123456789012345/);
});

// Codex 5969506600(f523de5) 재현 — 카드 뒤 일반 숫자(「2번」)를 카드로 빨아들여 카드 전체가 새던 회귀 · 13~19자리 길이별 합성 유효 카드
test('카드 뒤 일반 숫자는 그대로 두고 카드만 가림(4묶음 · 붙여 쓴 16자리)', () => {
  for (const t of ['카드 4111 1111 1111 1111 2번', '카드 4111111111111111 2번']) {
    const r = maskPii({ latest: t });
    assert.equal(r.counts.card, 1, t); assert.equal(r.value.latest, '카드 [가림] 2번', t);
  }
});
test('13~19자리 길이별 합성 유효(Luhn) 카드는 모두 가림', () => {
  for (const c of ['4111111111119', '41111111111114', '411111111111116', '4111111111111111', '41111111111111113', '411111111111111118', '4111111111111111110']) {
    const r = maskPii({ latest: `카드 ${c} 예요` });
    assert.equal(r.counts.card, 1, `${c.length}자리`); assert.equal(r.value.latest, '카드 [가림] 예요', `${c.length}자리`);
  }
});

// 리뷰 5400963953(07c2d9f) P1 재현 — 띄어 쓴 13자리 카드(4-4-4-1)
test('띄어 쓴 13~15자리 카드(4-4-4-1~3 묶음 · Luhn)도 가림 · Luhn 아닌 같은 모양은 그대로', () => {
  for (const t of ['4222 2222 2222 2', '4111-1111-1111-9', '4111 1111 1111 14', '4111 1111 1111 116']) {
    const r = maskPii({ latest: `카드 ${t} 예요` });
    assert.equal(r.counts.card, 1, t); assert.equal(r.value.latest, '카드 [가림] 예요', t);
  }
  const no = maskPii({ latest: '번호 1234 5678 9012 3 이에요' });
  assert.equal(no.counts.card, undefined, 'Luhn 아닌 4-4-4-1 은 카드로 세지 않음');
});
