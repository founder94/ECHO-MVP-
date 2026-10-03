// 2026-10-03 대표 「3개 AI 제공사 통합」 — 제공사 연결부(providers.ts)와 서버 선택 규칙(modelRouter.ts) 모의 검사.
// 가짜 응답(fetch)만 쓴다: 실제 AI 호출 0 · 키는 가짜 글자. 실제 제공사 응답 모양과 같은지는 실제 호출 검사(승인 뒤)에서 따로 본다.
// 실행: node --test qa/ai-provider-router.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'ai3-'));
const here = (p) => new URL(p, import.meta.url).pathname;
const emit = (file, out) => {
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('"./providers.ts"', '"./providers.mjs"');
  const f = path.join(dir, out); writeFileSync(f, js); return pathToFileURL(f).href;
};
const P = await import(emit(here('../supabase/functions/doit-agent/providers.ts'), 'providers.mjs'));
const R = await import(emit(here('../supabase/functions/doit-agent/modelRouter.ts'), 'modelRouter.mjs'));
const SRC = { prov: readFileSync(here('../supabase/functions/doit-agent/providers.ts'), 'utf8'), router: readFileSync(here('../supabase/functions/doit-agent/modelRouter.ts'), 'utf8') };

const ok = (body, init = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
const REQ = { model: 'fake-model', system: 'SYS', input: { latest: '사용자 말' }, maxTokens: 768, temperature: 0.2, topP: 0.9, timeoutMs: 1000 };
const PARAMS = { temperature: 0.2, top_p: 0.9, max_tokens: 768 };
const fakeProvider = (id, plan) => { const calls = []; return { calls, p: { id, call: async (req) => { calls.push(req); const step = plan.shift(); if (step instanceof Error) throw step; if (typeof step === 'function') return step(req); const cut = typeof step === 'object' && step?.cut; return { text: cut ? step.cut : step ?? '{}', provider: id, model_requested: req.model, model_served: `${req.model}-served`, input_tokens: 10, cached_tokens: null, output_tokens: 5, latency_ms: 1, truncated: !!cut }; } } }; };
const perr = (id, code, detail) => new P.ProviderError(id, code, 1, detail);
const policy = (o = {}) => R.parsePolicy(JSON.stringify({ version: 'p-unit', providers: { openai: { model: 'm-o', allow_user_text: true }, anthropic: { model: 'm-a', allow_user_text: true }, gemini: { model: 'm-g', allow_user_text: true, enabled: true }, ...(o.providers ?? {}) }, tasks: o.tasks ?? { default: ['anthropic', 'openai', 'gemini'] }, switch_on_invalid: o.switch_on_invalid ?? false, limits: { retry_wait_ms: 0, ...(o.limits ?? {}) }, circuit: o.circuit }));

// ── 연결부(제공사별 응답 → 한 모양)
test('연결부 OpenAI: 요청 모양(지금 운영과 같음) · 응답·사용량 정리 · 거절 → refused · 길이 잘림 = 글은 그대로 + truncated 표시(지금 운영과 같음) · 빈 답 → empty', async () => {
  let sent;
  const prov = P.openAIProvider('k', async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return ok({ model: 'served-o', usage: { prompt_tokens: 7, completion_tokens: 3, prompt_tokens_details: { cached_tokens: 2 } }, choices: [{ message: { content: ' {"a":1} ' }, finish_reason: 'stop' }] }); });
  const r = await prov.call(REQ);
  assert.equal(sent.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(sent.init.headers.Authorization, 'Bearer k');
  assert.deepEqual(sent.body.response_format, { type: 'json_object' });
  assert.deepEqual([sent.body.temperature, sent.body.top_p, sent.body.max_tokens], [0.2, 0.9, 768]);
  assert.deepEqual(sent.body.messages, [{ role: 'system', content: 'SYS' }, { role: 'user', content: JSON.stringify(REQ.input) }]);
  assert.deepEqual([r.text, r.provider, r.model_served, r.input_tokens, r.output_tokens, r.cached_tokens], ['{"a":1}', 'openai', 'served-o', 7, 3, 2]);
  await assert.rejects(P.openAIProvider('k', async () => ok({ choices: [{ message: { content: null, refusal: '거절' }, finish_reason: 'stop' }] })).call(REQ), (e) => e.code === 'refused');
  const cut = await P.openAIProvider('k', async () => ok({ choices: [{ message: { content: '{"a"' }, finish_reason: 'length' }] })).call(REQ);
  assert.deepEqual([cut.text, cut.truncated, r.truncated], ['{"a"', true, false]);
  await assert.rejects(P.openAIProvider('k', async () => ok({ choices: [{ message: { content: '  ' } }] })).call(REQ), (e) => e.code === 'empty');
  await assert.rejects(P.openAIProvider('', async () => ok({})).call(REQ), (e) => e.code === 'no_key');
});

test('연결부 Anthropic: Messages 요청 모양 · top_p 안 보냄 · sampling none 이면 temperature 도 안 보냄 · 거절/잘림 · 캐시 토큰을 입력 전체로 합침 · ```json 감싸기 벗김', async () => {
  let sent;
  const f = async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return ok({ model: 'served-a', stop_reason: 'end_turn', content: [{ type: 'text', text: '```json\n{"a":1}\n```' }], usage: { input_tokens: 5, cache_read_input_tokens: 3, cache_creation_input_tokens: 2, output_tokens: 4 } }); };
  const r = await P.anthropicProvider('k', {}, f).call(REQ);
  assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(sent.init.headers['x-api-key'], 'k'); assert.equal(sent.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(sent.body.system, 'SYS'); assert.deepEqual(sent.body.messages, [{ role: 'user', content: JSON.stringify(REQ.input) }]);
  assert.equal(sent.body.temperature, 0.2); assert.ok(!('top_p' in sent.body)); assert.equal(sent.body.max_tokens, 768);
  assert.deepEqual([r.text, r.model_served, r.input_tokens, r.cached_tokens, r.output_tokens], ['{"a":1}', 'served-a', 10, 3, 4]);
  await P.anthropicProvider('k', { sampling: 'none' }, f).call(REQ); assert.ok(!('temperature' in sent.body));
  await assert.rejects(P.anthropicProvider('k', {}, async () => ok({ stop_reason: 'refusal', content: [] })).call(REQ), (e) => e.code === 'refused');
  assert.equal((await P.anthropicProvider('k', {}, async () => ok({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }] })).call(REQ)).truncated, true);
});

test('연결부 Gemini: generateContent 요청 모양 · JSON 응답 요청 · 안전 차단 → refused · MAX_TOKENS → truncated · 생각(thought) 조각 제외', async () => {
  let sent;
  const r = await P.geminiProvider('k', async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return ok({ modelVersion: 'served-g', candidates: [{ content: { parts: [{ text: '생각', thought: true }, { text: '{"a":1}' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 2, cachedContentTokenCount: 1 } }); }).call({ ...REQ, model: 'a/b' });
  assert.equal(sent.url, 'https://generativelanguage.googleapis.com/v1beta/models/a%2Fb:generateContent', '모델 이름은 주소 안에서 인코딩');
  assert.equal(sent.init.headers['x-goog-api-key'], 'k'); assert.ok(!sent.url.includes('key='), '키를 주소에 넣지 않음');
  assert.deepEqual(sent.body.generationConfig, { temperature: 0.2, topP: 0.9, maxOutputTokens: 768, responseMimeType: 'application/json' });
  assert.deepEqual([r.text, r.model_served, r.input_tokens, r.cached_tokens, r.output_tokens], ['{"a":1}', 'served-g', 6, 1, 2]);
  await assert.rejects(P.geminiProvider('k', async () => ok({ promptFeedback: { blockReason: 'SAFETY' } })).call(REQ), (e) => e.code === 'refused');
  await assert.rejects(P.geminiProvider('k', async () => ok({ candidates: [{ finishReason: 'SAFETY' }] })).call(REQ), (e) => e.code === 'refused');
  assert.equal((await P.geminiProvider('k', async () => ok({ candidates: [{ content: { parts: [{ text: '{' }] }, finishReason: 'MAX_TOKENS' }] })).call(REQ)).truncated, true);
});

test('연결부 오류 정리: HTTP 상태 → 코드 · 업체 오류는 코드/종류/재시도 시각만(메시지 글 0) · 시간 초과 · 연결 끊김', async () => {
  const body = { error: { message: '비밀 메시지 sk-xxx 사용자 원문', type: 'rate_limit_error', code: 'rate_limit_exceeded' } };
  await assert.rejects(P.openAIProvider('k', async () => new Response(JSON.stringify(body), { status: 429, headers: { 'retry-after': '2' } })).call(REQ), (e) => {
    assert.equal(e.code, 'http_429'); assert.deepEqual(e.detail, { status: 429, provider_code: 'rate_limit_exceeded', provider_type: 'rate_limit_error', retry_after_ms: 2000 });
    assert.ok(!JSON.stringify(e).includes('비밀') && !e.message.includes('비밀')); return true;
  });
  const g = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: '긴 메시지', details: [{ retryDelay: '7s' }] } };
  assert.deepEqual(P.errorDetailOf(429, g, null), { status: 429, provider_code: '429', provider_type: 'RESOURCE_EXHAUSTED', retry_after_ms: 7000 });
  await assert.rejects(P.geminiProvider('k', async () => new Response('{}', { status: 503 })).call(REQ), (e) => e.code === 'http_5xx');
  await assert.rejects(P.anthropicProvider('k', {}, async () => new Response('x', { status: 400 })).call(REQ), (e) => e.code === 'http_4xx');
  await assert.rejects(P.openAIProvider('k', async () => { throw new TypeError('fetch failed'); }).call(REQ), (e) => e.code === 'network');
  const hang = (_u, init) => new Promise((_ok, bad) => init.signal.addEventListener('abort', () => bad(new Error('aborted'))));
  await assert.rejects(P.anthropicProvider('k', {}, hang).call({ ...REQ, timeoutMs: 20 }), (e) => e.code === 'timeout');
});

test('연결부 소스 규칙: 환경·키를 읽지 않음 · 업체 SDK 0 · 오류에 업체 메시지 글을 담지 않음', () => {
  assert.ok(!/Deno\.env|process\.env/.test(SRC.prov));
  assert.ok(!/from "npm:|from "https:|import .* from "(openai|@anthropic-ai|@google)/.test(SRC.prov));
  assert.ok(!/\.message\b(?!s)/.test(SRC.prov.replace(/message\?: \{|choice\?\.message|messages:/g, '')), '업체 오류 message 를 읽지 않음');
});

// ── 정책 읽기
test('정책: 없음·깨진 JSON·판 없음 → null(기본 = OpenAI 하나) · 기본 정책 모양 · 모델 이름 모양 검사 · 한도는 안전 범위로 자름', () => {
  for (const bad of [undefined, '', '  ', '{', '[]', '{"providers":{}}', '{"version":""}']) assert.equal(R.parsePolicy(bad), null, String(bad));
  const d = R.defaultPolicy('default-model');
  assert.deepEqual(Object.keys(d.providers), ['openai']); assert.deepEqual(d.tasks, { default: ['openai'] }); assert.equal(d.providers.openai.allow_user_text, true); assert.equal(d.switch_on_invalid, false);
  const p = R.parsePolicy(JSON.stringify({ version: 'v1', providers: { openai: { model: 'ok-model_1.2' }, anthropic: { model: '' }, gemini: { model: 'bad model with space' }, mystery: { model: 'x' } }, tasks: { turn: ['gemini', 'mystery', 'openai', 'openai'], intro: 'openai' }, limits: { max_calls_per_request: 999, deadline_ms: 1, call_timeout_ms: 'x', same_provider_retries: 9 } }));
  assert.deepEqual(Object.keys(p.providers), ['openai'], '빈·이상한 모델 이름 · 모르는 제공사 제외');
  assert.equal(p.providers.openai.allow_user_text, false, '전달 허용은 명시해야만 true');
  assert.deepEqual(p.tasks.turn, ['gemini', 'openai'], '모르는 제공사·중복 제거');
  assert.equal(p.tasks.intro, undefined); assert.deepEqual(p.tasks.default, ['openai']);
  assert.deepEqual([p.limits.max_calls_per_request, p.limits.deadline_ms, p.limits.call_timeout_ms, p.limits.same_provider_retries], [40, 5000, 18000, 2]);
});

test('모델 라우터 소스 규칙: 코드에 고정 우열·고정 모델 이름 0(정책으로만) · 환경은 넘겨받은 get 으로만', () => {
  assert.ok(!/claude-|gemini-\d|gpt-\d/.test(SRC.router), '라우터 코드에 실제 모델 이름 0');
  assert.ok(!/Deno\.env/.test(SRC.router));
});

// ── 서버 선택 규칙
test('선택: 정책 순서의 첫 후보 하나만 부름 · 성공하면 다른 제공사 호출 0 · 작업별 순서 · 사용 기록', async () => {
  const a = fakeProvider('anthropic', ['{"x":1}']); const o = fakeProvider('openai', ['{"y":1}']); const g = fakeProvider('gemini', []);
  const r = R.createModelRouter({ policy: policy({ tasks: { default: ['anthropic', 'openai'], intro: ['openai'] } }), providers: { anthropic: a.p, openai: o.p, gemini: g.p }, params: PARAMS, health: {} });
  const out = await r.llm('turn', 'S', { latest: '말' });
  assert.equal(out.text, '{"x":1}'); assert.equal(a.calls.length, 1); assert.equal(o.calls.length, 0); assert.equal(g.calls.length, 0);
  assert.deepEqual([a.calls[0].model, a.calls[0].temperature, a.calls[0].topP, a.calls[0].maxTokens], ['m-a', 0.2, 0.9, 768]);
  await r.llm('intro', 'S', {});
  assert.equal(o.calls.length, 1, '작업별 순서(intro → openai)');
  assert.deepEqual(r.log.map((x) => [x.kind, x.provider, x.ok, x.reason, x.policy_version]), [['turn', 'anthropic', true, 'policy_order', 'p-unit'], ['intro', 'openai', true, 'policy_order', 'p-unit']]);
  assert.deepEqual(r.summary().providers, ['anthropic', 'openai']);
});

test('선택: 키 없는 제공사 · 전달 허용 없는 제공사 · 정책에 없는 제공사는 후보에서 빠짐 · 남는 곳이 없으면 not_configured(호출 0)', async () => {
  const o = fakeProvider('openai', ['{}']);
  const r = R.createModelRouter({ policy: policy({ providers: { gemini: { model: 'm-g', allow_user_text: false } }, tasks: { default: ['anthropic', 'gemini', 'openai'] } }), providers: { openai: o.p, gemini: fakeProvider('gemini', []).p }, params: PARAMS, health: {} });
  assert.deepEqual(r.usable('turn'), ['openai']);
  await r.llm('turn', 'S', {}); assert.equal(o.calls.length, 1);
  const none = R.createModelRouter({ policy: policy({ tasks: { default: ['anthropic'] } }), providers: { openai: o.p }, params: PARAMS, health: {} });
  assert.deepEqual(none.usable(), []);
  await assert.rejects(none.llm('turn', 'S', {}), (e) => e.code === 'not_configured');
  assert.equal(none.log[0].error, 'not_configured');
});

test('전환: 같은 곳 재시도(429·5xx·연결)는 정해진 횟수만 · 그다음 다음 후보 · 시간 초과·4xx·빈 답은 같은 곳 재시도 없이 다음 후보 · 재시도 대기는 Retry-After 와 상한 중 작은 값', async () => {
  const waits = [];
  const a = fakeProvider('anthropic', [perr('anthropic', 'http_429', { retry_after_ms: 300 }), perr('anthropic', 'http_5xx')]); const o = fakeProvider('openai', ['{"ok":1}']);
  const r = R.createModelRouter({ policy: policy({ limits: { same_provider_retries: 1, retry_wait_ms: 1000 } }), providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health: {}, sleep: async (ms) => { waits.push(ms); } });
  assert.equal((await r.llm('turn', 'S', {})).text, '{"ok":1}');
  assert.equal(a.calls.length, 2); assert.deepEqual(waits, [300]);
  assert.deepEqual(r.log.map((x) => [x.provider, x.attempt, x.error, x.reason]), [['anthropic', 1, 'http_429', 'policy_order'], ['anthropic', 2, 'http_5xx', 'policy_order'], ['openai', 1, null, 'fallback_from:anthropic:http_5xx']]);
  assert.equal(r.summary().fallback, 1);
  for (const code of ['timeout', 'http_4xx', 'empty']) {
    const a2 = fakeProvider('anthropic', [perr('anthropic', code)]); const o2 = fakeProvider('openai', ['{}']);
    const r2 = R.createModelRouter({ policy: policy({ limits: { same_provider_retries: 2 } }), providers: { anthropic: a2.p, openai: o2.p }, params: PARAMS, health: {}, sleep: async () => {} });
    await r2.llm('turn', 'S', {});
    assert.deepEqual([a2.calls.length, o2.calls.length], [1, 1], code);
  }
});

test('잘린 답: 다음 후보가 있으면 그쪽으로(잘린 글은 쓰지 않음) · 마지막 후보면 빈 글(JSON 모양이 맞아도 채택 0 · Agent 형식 재요청)', async () => {
  const a = fakeProvider('anthropic', [{ cut: '{"half"' }]); const o = fakeProvider('openai', ['{"full":1}']);
  const r = R.createModelRouter({ policy: policy({ tasks: { default: ['anthropic', 'openai'] } }), providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health: {} });
  assert.equal((await r.llm('turn', 'S', {})).text, '{"full":1}');
  assert.deepEqual(r.log.map((x) => [x.provider, x.ok, x.error]), [['anthropic', false, 'truncated'], ['openai', true, null]]);
  const one = fakeProvider('openai', [{ cut: '{"half"' }]);
  const r1 = R.createModelRouter({ policy: R.defaultPolicy('default-model'), providers: { openai: one.p }, params: PARAMS, health: {} });
  assert.equal((await r1.llm('turn', 'S', {})).text, '', '잘린 글은 넘기지 않음');
  assert.deepEqual(r1.log.map((x) => [x.ok, x.error, x.usage]), [[true, 'truncated_discarded', 'confirmed']], '사용량은 집계');
});

test('전환 금지: 안전상 거절(refused)은 다른 모델로 돌리지 않고 바로 실패 · 연속 오류 수에도 넣지 않음', async () => {
  const a = fakeProvider('anthropic', [perr('anthropic', 'refused')]); const o = fakeProvider('openai', ['{}']);
  const health = {};
  const r = R.createModelRouter({ policy: policy(), providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health });
  await assert.rejects(r.llm('turn', 'S', {}), (e) => e.code === 'refused');
  assert.equal(o.calls.length, 0); assert.equal(health.anthropic.consecutive_errors, 0);
});

test('모두 실패 → 마지막 제공사 오류를 던짐(Agent 는 상태를 건드리지 않는다) · 모든 후보가 한 번씩만', async () => {
  const a = fakeProvider('anthropic', [perr('anthropic', 'http_5xx')]); const o = fakeProvider('openai', [perr('openai', 'timeout')]); const g = fakeProvider('gemini', [perr('gemini', 'http_4xx')]);
  const r = R.createModelRouter({ policy: policy({ limits: { same_provider_retries: 0 } }), providers: { anthropic: a.p, openai: o.p, gemini: g.p }, params: PARAMS, health: {} });
  await assert.rejects(r.llm('turn', 'S', {}), (e) => e.code === 'http_4xx' && e.provider === 'gemini');
  assert.deepEqual([a.calls.length, o.calls.length, g.calls.length], [1, 1, 1]);
});

test('연속 오류 차단: 다른 후보가 있을 때만 건너뜀 · 식힘 시간 뒤 다시 부름 · 후보가 하나뿐(기본 정책)이면 차단 없이 지금처럼 부름', async () => {
  let t = 1000; const now = () => t; const health = {};
  const pol = policy({ tasks: { default: ['anthropic', 'openai'] }, limits: { same_provider_retries: 0 }, circuit: { open_after: 2, cooldown_ms: 5000 } });
  const a = fakeProvider('anthropic', [perr('anthropic', 'http_5xx'), perr('anthropic', 'http_5xx'), '{"back":1}']); const o = fakeProvider('openai', ['{}', '{}', '{}']);
  for (let i = 0; i < 2; i++) await R.createModelRouter({ policy: pol, providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health, now }).llm('turn', 'S', {});
  assert.ok(health.anthropic.open_until > t);
  const r3 = R.createModelRouter({ policy: pol, providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health, now });
  await r3.llm('turn', 'S', {});
  assert.equal(a.calls.length, 2, '차단 중 건너뜀'); assert.equal(r3.log[0].error, 'skipped_unhealthy');
  t += 6000;
  assert.equal((await R.createModelRouter({ policy: pol, providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health, now }).llm('turn', 'S', {})).text, '{"back":1}');
  // 후보 하나: 연속 오류가 쌓여도 다음 요청은 그대로 부른다(지금 운영과 같음 · 같은 곳 재시도 1번 포함)
  const h1 = {}; const one = R.defaultPolicy('default-model'); one.limits.retry_wait_ms = 0;
  const o1 = fakeProvider('openai', [perr('openai', 'http_5xx'), perr('openai', 'http_5xx'), perr('openai', 'http_5xx'), perr('openai', 'http_5xx'), '{"ok":1}']);
  for (let i = 0; i < 2; i++) await assert.rejects(R.createModelRouter({ policy: one, providers: { openai: o1.p }, params: PARAMS, health: h1, now, sleep: async () => {} }).llm('turn', 'S', {}));
  assert.equal(o1.calls.length, 4, '요청마다 1 + 재시도 1');
  assert.equal((await R.createModelRouter({ policy: one, providers: { openai: o1.p }, params: PARAMS, health: h1, now, sleep: async () => {} }).llm('turn', 'S', {})).text, '{"ok":1}');
});

test('형식 거절 뒤 다시 청함(previous_attempt): 정책이 허용하면 직전 제공사 다음 후보부터 · 허용 안 하면 같은 순서', async () => {
  const mk = (sw) => { const a = fakeProvider('anthropic', ['bad', '{}']); const o = fakeProvider('openai', ['{}']); return { a, o, r: R.createModelRouter({ policy: policy({ switch_on_invalid: sw, tasks: { default: ['anthropic', 'openai'] } }), providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health: {} }) }; };
  const on = mk(true);
  await on.r.llm('turn', 'S', {}); await on.r.llm('turn', 'S', { previous_attempt: { why: 'JSON 형식이 아니었다.' } });
  assert.deepEqual([on.a.calls.length, on.o.calls.length], [1, 1]); assert.equal(on.r.log[1].reason, 'switch_on_invalid_from:anthropic');
  const off = mk(false);
  await off.r.llm('turn', 'S', {}); await off.r.llm('turn', 'S', { previous_attempt: { why: 'x' } });
  assert.deepEqual([off.a.calls.length, off.o.calls.length], [2, 0]);
});

test('비용·시간 한도: 요청당 호출 수 · 토큰 수 · 요청 전체 기한을 넘으면 더 부르지 않음 · 호출 시간 제한은 남은 기한 이내', async () => {
  const o = fakeProvider('openai', ['{}', '{}', '{}']);
  const r = R.createModelRouter({ policy: policy({ tasks: { default: ['openai'] }, limits: { max_calls_per_request: 2 } }), providers: { openai: o.p }, params: PARAMS, health: {} });
  await r.llm('turn', 'S', {}); await r.llm('ack', 'S', {});
  await assert.rejects(r.llm('question', 'S', {}), (e) => e.code === 'budget_exceeded'); assert.equal(o.calls.length, 2);
  const big = fakeProvider('openai', [() => ({ text: '{}', provider: 'openai', model_requested: 'm', model_served: null, input_tokens: 900, cached_tokens: null, output_tokens: 200, latency_ms: 1 }), '{}']);
  const rb = R.createModelRouter({ policy: policy({ tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 1000 } }), providers: { openai: big.p }, params: PARAMS, health: {} });
  await rb.llm('turn', 'S', {}); await assert.rejects(rb.llm('turn', 'S', {}), (e) => e.code === 'budget_exceeded');
  let t = 0; const slow = fakeProvider('openai', ['{}', '{}']);
  const rd = R.createModelRouter({ policy: policy({ tasks: { default: ['openai'] }, limits: { deadline_ms: 10000, call_timeout_ms: 8000 } }), providers: { openai: slow.p }, params: PARAMS, health: {}, now: () => t });
  t = 4000; await rd.llm('turn', 'S', {}); assert.equal(slow.calls[0].timeoutMs, 6000, '남은 기한(6초) < 호출 제한(8초)');
  t = 10000; await assert.rejects(rd.llm('turn', 'S', {}), (e) => e.code === 'deadline_exceeded'); assert.equal(slow.calls.length, 1);
});

test('마지막 안전망: 생년월일·전화·이메일·주소·토큰 같은 칸이 입력에 있으면 어떤 제공사에도 보내지 않음', async () => {
  const o = fakeProvider('openai', ['{}']);
  const r = R.createModelRouter({ policy: policy({ tasks: { default: ['openai'] } }), providers: { openai: o.p }, params: PARAMS, health: {} });
  await assert.rejects(r.llm('turn', 'S', { recent: [{ user: '말' }], meta: { phone: '010' } }), (e) => e.code === 'pii_blocked');
  assert.equal(o.calls.length, 0); assert.equal(r.log[0].reason, 'pii_keys:meta.phone');
  assert.deepEqual(R.piiKeys({ birth_date: 1, a: [{ email: 1 }], latest: 'x', heard: [] }), ['birth_date', 'a[0].email']);
});

test('기록: 제공사·모델·이유·정책판·성공/오류 코드·지연·사용량만 — 사용자 원문·시스템 지시·키 0', async () => {
  const a = fakeProvider('anthropic', [perr('anthropic', 'http_5xx', { status: 503 })]); const o = fakeProvider('openai', ['{"reply":"사용자에게 할 말"}']);
  const r = R.createModelRouter({ policy: policy({ limits: { same_provider_retries: 0 } }), providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health: {} });
  await r.llm('turn', '시스템 지시문', { latest: '아주 개인적인 사용자 원문' });
  const s = JSON.stringify(r.log);
  for (const leak of ['아주 개인적인', '시스템 지시문', '사용자에게 할 말']) assert.ok(!s.includes(leak), leak);
  assert.deepEqual(Object.keys(r.log[0]).sort(), ['attempt', 'cached_tokens', 'error', 'input_tokens', 'kind', 'latency_ms', 'model_requested', 'model_served', 'ok', 'output_tokens', 'policy_version', 'provider', 'reason', 'reserved_tokens', 'seq', 'status', 'usage'].sort());
  assert.equal(r.log[0].status, 503);
});

test('routerFromEnv: AI_POLICY 없음 → 기본(OpenAI · OPENAI_MODEL) · 키는 있는지만 · 깨진 정책 → 기본 · sampling 전달', async () => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return url.includes('anthropic') ? ok({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{}' }] }) : ok({ choices: [{ message: { content: '{}' } }] }); };
  const env = (o) => (k) => o[k];
  const d = R.routerFromEnv(env({ OPENAI_API_KEY: 'k', OPENAI_MODEL: ' my-model ', ANTHROPIC_API_KEY: 'k2' }), PARAMS, {}, f, (raw) => (raw ?? '').trim() || 'fallback');
  assert.equal(d.policy.version, 'ai-policy-default-openai'); assert.deepEqual(d.usable(), ['openai']);
  await d.llm('turn', 'S', {}); assert.equal(calls[0].body.model, 'my-model');
  assert.equal(R.routerFromEnv(env({ OPENAI_API_KEY: 'k', AI_POLICY: '{broken' }), PARAMS, {}, f).policy.version, 'ai-policy-default-openai');
  const p = R.routerFromEnv(env({ OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k2', AI_POLICY: JSON.stringify({ version: 'v-x', providers: { anthropic: { model: 'm-a', allow_user_text: true, sampling: 'none' } }, tasks: { default: ['anthropic'] } }) }), PARAMS, {}, f);
  await p.llm('turn', 'S', {});
  const sent = calls.at(-1); assert.ok(sent.url.includes('anthropic')); assert.ok(!('temperature' in sent.body));
  assert.deepEqual(R.routerFromEnv(env({ AI_POLICY: JSON.stringify({ version: 'v', providers: { anthropic: { model: 'm', allow_user_text: true } }, tasks: { default: ['anthropic'] } }) }), PARAMS, {}, f).usable(), [], '키 없으면 후보 0');
});

// ── 2026-10-03 후속: 선택 순서(데이터 → 켜짐 → 품질 → 사용 가능 → 금액) · Gemini 기본 꺼짐 · 문장 속 개인정보 가림 · 취소 · 실측 기본 한도
test('기본 한도 = QA 실측 근거 값(요청 하나가 모든 호출과 같이 쓰는 예산)', () => {
  assert.deepEqual(R.DEFAULT_LIMITS, { max_calls_per_request: 14, max_tokens_per_request: 30_000, deadline_ms: 60_000, call_timeout_ms: 18_000, same_provider_retries: 1, retry_wait_ms: 1500, max_cost_usd_per_request: null });
});

test('선택 순서: 데이터 전달 허용 → 켜짐 → 그 작업에서 검증됨 → 키 → 금액 한도 → 정책 순서 · 빠진 이유가 남음 · Gemini 는 명시적으로 켜야만', () => {
  const pol = R.parsePolicy(JSON.stringify({ version: 'v-sel', require_verified: true,
    providers: { openai: { model: 'm-o', allow_user_text: true, verified_tasks: ['turn'] }, anthropic: { model: 'm-a', allow_user_text: false, verified_tasks: ['*'] }, gemini: { model: 'm-g', allow_user_text: true, verified_tasks: ['*'] } },
    tasks: { default: ['anthropic', 'gemini', 'openai'] } }));
  assert.equal(pol.providers.gemini.enabled, false, 'Gemini 기본 꺼짐(지원 코드는 유지)');
  const r = R.createModelRouter({ policy: pol, providers: { openai: fakeProvider('openai', []).p, anthropic: fakeProvider('anthropic', []).p, gemini: fakeProvider('gemini', []).p }, params: PARAMS, health: {} });
  assert.deepEqual(r.explain('turn'), { order: ['openai'], skipped: [{ provider: 'anthropic', why: 'data_not_allowed' }, { provider: 'gemini', why: 'disabled' }] });
  assert.deepEqual(r.explain('closing'), { order: [], skipped: [{ provider: 'anthropic', why: 'data_not_allowed' }, { provider: 'gemini', why: 'disabled' }, { provider: 'openai', why: 'not_verified_for_task' }] }, '검증 안 된 작업에는 쓰지 않음');
  const pol2 = R.parsePolicy(JSON.stringify({ version: 'v', providers: { anthropic: { model: 'm-a', allow_user_text: true }, openai: { model: 'm-o', allow_user_text: true } }, tasks: { default: ['anthropic', 'openai'] } }));
  assert.deepEqual(R.createModelRouter({ policy: pol2, providers: { openai: fakeProvider('openai', []).p }, params: PARAMS, health: {} }).explain('turn').skipped, [{ provider: 'anthropic', why: 'no_key' }]);
});

test('금액 상한(토큰 상한과 별개): 단가 모르는 제공사는 금액 상한이 있으면 쓰지 않음 · 쓴 금액 + 이번 추정이 넘으면 건너뜀 · 사용 금액 집계', async () => {
  const pol = R.parsePolicy(JSON.stringify({ version: 'v-cost', limits: { max_cost_usd_per_request: 0.001 },
    providers: { openai: { model: 'm-o', allow_user_text: true, price: { in_usd_per_1m: 0.15, out_usd_per_1m: 0.6 } }, anthropic: { model: 'm-a', allow_user_text: true } }, tasks: { default: ['anthropic', 'openai'] } }));
  const o = fakeProvider('openai', [() => ({ text: '{}', provider: 'openai', model_requested: 'm-o', model_served: null, input_tokens: 3000, cached_tokens: null, output_tokens: 150, latency_ms: 1, truncated: false }), '{}', '{}']);
  const r = R.createModelRouter({ policy: pol, providers: { openai: o.p, anthropic: fakeProvider('anthropic', []).p }, params: PARAMS, health: {} });
  assert.deepEqual(r.explain('turn').skipped, [{ provider: 'anthropic', why: 'price_unknown' }]);
  await r.llm('turn', 'S', {});
  assert.ok(Math.abs(r.summary().cost_usd - (3000 * 0.15 + 150 * 0.6) / 1e6) < 1e-12);
  // 0.00054 쓴 뒤 입력 4,500자(추정 3,000토큰 · 0.00045) + 출력 상한 768(0.00046) → 합 0.00145 > 0.001 → 건너뜀 → 쓸 곳 없음
  await assert.rejects(r.llm('turn', 'S', { big: 'x'.repeat(4500) }), (e) => e.code === 'not_configured');
  assert.match(r.log.at(-1).reason, /openai=cost_cap/);
  const noPrice = R.createModelRouter({ policy: R.defaultPolicy('default-model'), providers: { openai: fakeProvider('openai', ['{}']).p }, params: PARAMS, health: {} });
  await noPrice.llm('turn', 'S', {}); assert.equal(noPrice.summary().cost_usd, null, '단가를 모르면 금액은 「확인 불가」(0 이라 하지 않음)');
});

test('문장 속 개인정보: 전화·유선·이메일·주민번호·카드·생년월일을 가리고 보냄 · 전환된 다른 제공사도 가린 글만 · 기록에는 종류별 개수만', async () => {
  const a = fakeProvider('anthropic', [perr('anthropic', 'http_5xx')]); const o = fakeProvider('openai', ['{}']);
  const r = R.createModelRouter({ policy: policy({ tasks: { default: ['anthropic', 'openai'] }, limits: { same_provider_retries: 0 } }), providers: { anthropic: a.p, openai: o.p }, params: PARAMS, health: {} });
  const raw = { latest: '제 번호 010-1234-5678, 회사 02-345-6789, 메일 me@ex.com, 1990년 3월 5일생, 900305-1234567, 카드 1234-5678-9012-3456', recent: [{ user: '1990.03.05 에 태어났어요' }] };
  await r.llm('turn', 'S', raw);
  for (const sent of [a.calls[0].input, o.calls[0].input]) {
    const t = JSON.stringify(sent);
    for (const leak of ['010-1234-5678', '02-345-6789', 'me@ex.com', '1990년 3월 5일', '900305-1234567', '1234-5678-9012-3456', '1990.03.05']) assert.ok(!t.includes(leak), leak);
    assert.ok(t.includes('[가림]'));
  }
  assert.match(r.log[0].reason, /masked:phone=1,landline=1,email=1,rrn=1,card=1,birth=2/);
  assert.ok(!JSON.stringify(r.log).includes('010-1234'), '기록에 원문 0');
  assert.equal(raw.latest.includes('010-1234-5678'), true, 'Agent 상태(원본 입력)는 바꾸지 않음');
  assert.deepEqual(R.maskPii({ latest: '2020년에 이사했어요 · 3월 5일 약속' }).counts, {}, '연도만·월일만은 가리지 않음(생년월일 꼴만)');
  const t0 = Date.now(); R.maskPii({ big: 'a'.repeat(200_000) + '@' + '-'.repeat(200_000) }); assert.ok(Date.now() - t0 < 2000, '긴 글에서도 빠름(되돌림 폭주 0)');
});

test('전달 허용은 재시도·전환에서도 유지: 실패한 허용 제공사 다음 후보가 허용 없으면 건너뛰고 다음 허용 제공사로', async () => {
  const pol = policy({ providers: { gemini: { model: 'm-g', allow_user_text: false, enabled: true } }, tasks: { default: ['anthropic', 'gemini', 'openai'] }, limits: { same_provider_retries: 1, retry_wait_ms: 0 } });
  const a = fakeProvider('anthropic', [perr('anthropic', 'http_5xx'), perr('anthropic', 'http_5xx')]); const g = fakeProvider('gemini', ['{}']); const o = fakeProvider('openai', ['{}']);
  const r = R.createModelRouter({ policy: pol, providers: { anthropic: a.p, gemini: g.p, openai: o.p }, params: PARAMS, health: {}, sleep: async () => {} });
  await r.llm('turn', 'S', {});
  assert.deepEqual([a.calls.length, g.calls.length, o.calls.length], [2, 0, 1]);
});

test('취소: 사용자 요청이 끊기면 진행 중 호출에 같은 신호가 가고 · 그 뒤 호출 0(cancelled)', async () => {
  const ctrl = new AbortController();
  const seen = [];
  const p = { id: 'openai', call: async (req) => { seen.push(req.signal); return { text: '{}', provider: 'openai', model_requested: req.model, model_served: null, input_tokens: 1, cached_tokens: null, output_tokens: 1, latency_ms: 1, truncated: false }; } };
  const r = R.createModelRouter({ policy: R.defaultPolicy('default-model'), providers: { openai: p }, params: PARAMS, health: {}, signal: ctrl.signal });
  await r.llm('turn', 'S', {});
  assert.equal(seen[0], ctrl.signal, '제공사 호출에 같은 신호');
  ctrl.abort();
  await assert.rejects(r.llm('turn', 'S', {}), (e) => e.code === 'cancelled');
  assert.equal(seen.length, 1);
  // 실제 연결부: 바깥 신호가 끊기면 fetch 도 끊긴다 — 2026-10-03 Codex P2: 사용자가 끊은 것은 timeout 이 아니라 cancelled(소개·보기 상태 저장 0 으로 이어짐)
  const outer = new AbortController();
  const hang = (_u, init) => new Promise((_ok, bad) => init.signal.addEventListener('abort', () => bad(new Error('aborted'))));
  const pending = P.openAIProvider('k', hang).call({ ...REQ, timeoutMs: 60_000, signal: outer.signal });
  outer.abort();
  await assert.rejects(pending, (e) => e.code === 'cancelled');
  // 이 호출 자체의 시간 제한은 그대로 timeout
  const own = P.openAIProvider('k', hang).call({ ...REQ, timeoutMs: 5, signal: new AbortController().signal });
  await assert.rejects(own, (e) => e.code === 'timeout');
});
