import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelRouter,defaultPolicy} from '../supabase/functions/doit-agent/modelRouter.ts';
import {openAIProvider} from '../supabase/functions/doit-agent/providers.ts';
const result={text:'{}',provider:'openai',model_requested:'fixture',model_served:'fixture',input_tokens:1,output_tokens:1,cached_tokens:0,latency_ms:1,truncated:false};
test('concurrent calls share and reserve max_calls_per_request=1',async()=>{
 const policy=defaultPolicy('fixture');policy.limits.max_calls_per_request=1;policy.limits.same_provider_retries=0;
 let calls=0;const p={id:'openai',call:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return result;}};
 const router=createModelRouter({policy,providers:{openai:p},params:{temperature:0,max_tokens:10}});
 await Promise.allSettled([router.llm('turn','synthetic',{}),router.llm('turn','synthetic',{})]);
 assert.equal(calls,1);
});
test('reported usage from empty response counts before fallback',async()=>{
 const policy=defaultPolicy('fixture');policy.providers.gemini={model:'fixture',allow_user_text:true};policy.tasks.default=['openai','gemini'];policy.limits.max_tokens_per_request=1000;policy.limits.same_provider_retries=0;
 let fallback=0;const p=openAIProvider('synthetic-not-a-key',async()=>new Response(JSON.stringify({choices:[{message:{content:''}}],usage:{prompt_tokens:2000,completion_tokens:10}}),{status:200,headers:{'content-type':'application/json'}}));
 const g={id:'gemini',call:async()=>{fallback++;return {...result,provider:'gemini'};}};
 const router=createModelRouter({policy,providers:{openai:p,gemini:g},params:{temperature:0,max_tokens:10}});
 try{await router.llm('turn','synthetic',{});}catch{}
 assert.equal(fallback,0);
});


// ── 위 두 검사 = Codex 원본(PR #103 댓글 5966485579) 그대로. 아래 = Claude 보강(원본 기대값 완화 0).
// 원본 ②는 정책에 Gemini 를 enabled 없이 넣는다 → aa4a168 부터 Gemini 기본 꺼짐이라 「꺼져서」 통과할 수 있다. 같은 검사를 Gemini 를 켠 채로 다시 본다.
import {createModelRouter as mk, defaultPolicy as dp, maskPii} from '../supabase/functions/doit-agent/modelRouter.ts';
const emptyWithUsage = (prompt, completion) => openAIProvider('synthetic-not-a-key', async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }], usage: { prompt_tokens: prompt, completion_tokens: completion } }), { status: 200, headers: { 'content-type': 'application/json' } }));
test('[보강] 원본 ②를 Gemini 켠 채로: 실패 응답의 확인된 사용량이 전환 전에 예산에 들어가 전환 0', async () => {
  const policy = dp('fixture'); policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true }; policy.tasks.default = ['openai', 'gemini']; policy.limits.max_tokens_per_request = 1000; policy.limits.same_provider_retries = 0;
  let fallback = 0; const g = { id: 'gemini', call: async () => { fallback++; return { ...result, provider: 'gemini' }; } };
  const router = mk({ policy, providers: { openai: emptyWithUsage(2000, 10), gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 'synthetic', {}), (e) => e.code === 'budget_exceeded');
  assert.equal(fallback, 0);
  assert.deepEqual([router.log[0].usage, router.log[0].input_tokens, router.log[0].output_tokens], ['confirmed', 2000, 10]);
  assert.equal(router.summary().tokens_in, 2000);
});
test('[보강] 예산이 남으면 전환하되 앞 호출 사용량은 한 번만 누적(중복 0)', async () => {
  const policy = dp('fixture'); policy.providers.gemini = { model: 'fixture', allow_user_text: true, enabled: true, price: { in_usd_per_1m: 1, out_usd_per_1m: 2 } }; policy.providers.openai.price = { in_usd_per_1m: 1, out_usd_per_1m: 2 };
  policy.tasks.default = ['openai', 'gemini']; policy.limits.same_provider_retries = 0;
  const g = { id: 'gemini', call: async () => ({ ...result, provider: 'gemini', input_tokens: 100, output_tokens: 5 }) };
  const router = mk({ policy, providers: { openai: emptyWithUsage(300, 7), gemini: g }, params: { temperature: 0, max_tokens: 10 } });
  await router.llm('turn', 'synthetic', {});
  const s = router.summary();
  assert.deepEqual([s.tokens_in, s.tokens_out, s.calls, s.unconfirmed_attempts], [400, 12, 2, 0]);
  assert.ok(Math.abs(s.cost_usd - (400 * 1 + 12 * 2) / 1e6) < 1e-12); assert.equal(s.cost_complete, true);
});
test('[보강] 사용량을 모르는 실패(시간 초과·HTTP 오류)는 「미확인」 — 0으로 치지 않고 예약을 남김 · 금액 완전성 false', async () => {
  const policy = dp('fixture'); policy.providers.openai.price = { in_usd_per_1m: 1, out_usd_per_1m: 2 }; policy.limits.same_provider_retries = 0;
  const p = openAIProvider('synthetic-not-a-key', async () => new Response('{}', { status: 500 }));
  const router = mk({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 10 } });
  await assert.rejects(router.llm('turn', 'synthetic', { x: 'abc' }));
  const s = router.summary();
  assert.equal(router.log[0].usage, 'unknown'); assert.equal(s.unconfirmed_attempts, 1); assert.ok(s.tokens_reserved_unconfirmed > 0);
  assert.deepEqual([s.tokens_in, s.tokens_out], [0, 0], '확인된 사용량은 0(모름) — 예약은 따로');
  assert.equal(s.cost_complete, false, '미확인 시도가 있으면 금액은 완전하지 않다');
});
test('[보강] 동시 호출 토큰 예약: 첫 호출이 진행 중이면 그 예약만큼 두 번째 호출이 막힘 · 끝나면 실제 사용량으로 바뀜', async () => {
  const policy = dp('fixture'); policy.limits.max_tokens_per_request = 1000; policy.limits.same_provider_retries = 0;
  let calls = 0; let release; const gate = new Promise((ok) => { release = ok; });
  const p = { id: 'openai', call: async () => { calls++; await gate; return { ...result, input_tokens: 50, output_tokens: 5 }; } };
  const router = mk({ policy, providers: { openai: p }, params: { temperature: 0, max_tokens: 995 } }); // 예약 = 입력 추정(11자 ÷ 1.5 → 8) + 995 = 1003 ≥ 1000
  const a = router.llm('turn', 'synthetic', {}); const b = router.llm('turn', 'synthetic', {});
  await assert.rejects(b, (e) => e.code === 'budget_exceeded');
  release(); await a;
  assert.equal(calls, 1); assert.equal(router.summary().tokens_reserved_unconfirmed, 0); assert.equal(router.summary().tokens_in, 50);
  assert.ok(maskPii);
});
