'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readiness } = require('./readiness-probe.cjs');
function api(credit, options = {}) {
  const requests = [];
  const fetchImpl = async (url, request) => {
    requests.push({ url, method: request.method, redirect: request.redirect });
    return { ok: true, text: async () => JSON.stringify(url.endsWith('/user.me') ? { ok: true, user_id: 'SYNTHETIC_ACCOUNT_DO_NOT_LOG' } : { ok: true, data: credit, ...options }) };
  };
  return { requests, fetchImpl };
}
test('authoritative zero ignores lapsed component quotas and never starts a task', async () => {
  const a = api({ total_credits: 0, periodic_credits: 9000, addon_credits: 9000 });
  const r = await readiness({ apiKey: 'SYNTHETIC_KEY_DO_NOT_LOG', fetchImpl: a.fetchImpl });
  assert.equal(r.spendable_credits_positive, false);
  assert.equal(r.paid_task_started, false);
  assert.equal(a.requests.length, 2);
  assert.ok(a.requests.every(x => x.method === 'GET' && x.redirect === 'error'));
  assert.ok(!JSON.stringify(r).includes('SYNTHETIC_ACCOUNT'));
  assert.ok(!JSON.stringify(r).includes('SYNTHETIC_KEY'));
  assert.ok(!JSON.stringify(r).includes('9000'));
});
test('positive balance establishes readiness only, never a quote or paid approval', async () => {
  const a = api({ total_credits: 120 });
  const r = await readiness({ apiKey: 'synthetic', fetchImpl: a.fetchImpl });
  assert.equal(r.spendable_credits_positive, true);
  assert.equal(r.task_cost_quote, 'UNAVAILABLE');
  assert.equal(r.provider_hard_task_cap, 'UNAVAILABLE');
  assert.equal(r.task_round_trip, 'NOT_RUN');
  assert.ok(!JSON.stringify(r).includes('120'));
});
for (const total_credits of [undefined, -1, 1.5, '120', null, 2147483648]) {
  test('invalid balance remains unknown rather than zero: ' + String(total_credits), async () => {
    const a = api({ total_credits });
    const r = await readiness({ apiKey: 'synthetic', fetchImpl: a.fetchImpl });
    assert.equal(r.credit_read, 'BLOCKED');
    assert.equal(r.spendable_credits_positive, null);
    assert.equal(r.credit_code, 'INVALID_CREDIT_BALANCE');
    assert.equal(r.paid_task_started, false);
  });
}
test('credit lookup access failure preserves authenticated state and redacts server bodies', async () => {
  let calls = 0;
  const fetchImpl = async () => ++calls === 1 ? { ok: true, text: async () => JSON.stringify({ ok: true, user_id: 'synthetic' }) } : { ok: false, status: 403, text: async () => 'SECRET_SERVER_DETAIL' };
  const r = await readiness({ apiKey: 'synthetic', fetchImpl });
  assert.equal(r.authentication, 'PASS');
  assert.equal(r.credit_read, 'BLOCKED');
  assert.equal(r.spendable_credits_positive, null);
  assert.ok(!JSON.stringify(r).includes('SECRET_SERVER_DETAIL'));
});
test('invalid auth stops before credit lookup and never issues POST', async () => {
  let calls = 0;
  await assert.rejects(readiness({ apiKey: 'synthetic', fetchImpl: async () => { calls++; return { ok: true, text: async () => '{"ok":true}' }; } }), { code: 'INVALID_IDENTITY' });
  assert.equal(calls, 1);
});
test('schema diagnosis reveals only whitelisted field types, never private values or keys', async () => {
  const fetchImpl = async url => ({ok:true,text:async()=>JSON.stringify(url.endsWith('/user.me') ? {ok:true,user_id:'SECRET_ID'} : {ok:true,data:{total_credits:'PRIVATE_BALANCE',SECRET_KEY:'SECRET_VALUE'},SECRET_TOP:'SECRET_VALUE'})});
  const r = await readiness({apiKey:'synthetic',fetchImpl});
  assert.equal(r.credit_read,'BLOCKED');
  assert.equal(r.credit_schema.declared_total_type,'string');
  assert.deepEqual(r.credit_schema.data_fields,[['total_credits','string']]);
  assert.ok(!JSON.stringify(r).includes('SECRET'));
  assert.ok(!JSON.stringify(r).includes('PRIVATE_BALANCE'));
});
test('observed flat v2 total_credits is authoritative without guessed component sums', async () => {
  for (const total of [0,120]) {
    const fetchImpl=async url=>({ok:true,text:async()=>JSON.stringify(url.endsWith('/user.me')?{ok:true,user_id:'synthetic'}:{ok:true,total_credits:total,periodic_credits:999999})});
    const r=await readiness({apiKey:'synthetic',fetchImpl});
    assert.equal(r.credit_read,'PASS');assert.equal(r.spendable_credits_positive,total>0);assert.equal(r.paid_task_started,false);
    assert.ok(!JSON.stringify(r).includes('999999'));
  }
});
test('conflicting flat and nested totals remain blocked, never picked optimistically', async () => {
  const fetchImpl=async url=>({ok:true,text:async()=>JSON.stringify(url.endsWith('/user.me')?{ok:true,user_id:'synthetic'}:{ok:true,total_credits:100,data:{total_credits:0}})});
  const r=await readiness({apiKey:'synthetic',fetchImpl});
  assert.equal(r.credit_read,'BLOCKED');assert.equal(r.spendable_credits_positive,null);assert.equal(r.credit_code,'AMBIGUOUS_CREDIT_BALANCE');
});
