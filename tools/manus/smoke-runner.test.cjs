'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { smokeRoundTrip } = require('./smoke-runner.cjs');
const { client, SMOKE_SHA } = require('./client.cjs');
const binding = { source_sha: 'a'.repeat(40), task_id: 'synthetic-ready', owner: 'approved-owner', principal_type: 'User', principal_login: 'synthetic-user' };
const approval = { fixture_sha256: SMOKE_SHA, cost_reported: true, paid_test_approved: true, estimated_credits: 1, approved_credits: 1 }; // fictitious cost, not a real Manus quote
function setup(body = '{"echo":"ECHO_MANUS_SYNTHETIC_V1"}') {
  let rev = 0, writes = 0; let state = { tasks: [{ id: 'unrelated-stop', round: 5, state: 'STOP' }] };
  const existingStore = { async load() { return { rev, state: structuredClone(state) }; }, async save(expected, next) { if (expected !== rev) return false; state = structuredClone(next); rev++; return true; } };
  const api = client({ apiKey: 'SYNTHETIC_ONLY', fetchImpl: async url => {
    let payload;
    if (url.includes('/task.create')) { writes++; payload = { ok: true, task_id: 'synthetic-task', share_visibility: 'private' }; }
    else if (url.includes('/task.detail')) payload = { ok: true, task: { id: 'synthetic-task', status: 'stopped', has_running_background_jobs: false } };
    else payload = { ok: true, task_id: 'synthetic-task', messages: [{ id: 'synthetic-result', type: 'assistant_message', assistant_message: { delivery_kind: 'result', content: body } }], has_more: false };
    return { ok: true, text: async () => JSON.stringify(payload) };
  } });
  return { api, existingStore, binding, receiptKey: 'synthetic:one', approval, polling: { maxPolls: 1, wait: async () => {} }, inspect: () => ({ state, writes }) };
}
test('two mocked runners submit once and persist exact synthetic result without advancing STOP', async () => {
  const ctx = setup(); const r = await Promise.allSettled([smokeRoundTrip(ctx), smokeRoundTrip(ctx)]);
  assert.ok(r.some(x => x.status === 'fulfilled' && x.value.verified === true));
  assert.equal(ctx.inspect().writes, 1);
  assert.equal(ctx.inspect().state.manus_receipts['synthetic:one'].value.state, 'SMOKE_VERIFIED');
  assert.deepEqual(ctx.inspect().state.tasks, [{ id: 'unrelated-stop', round: 5, state: 'STOP' }]);
  const repeat = await smokeRoundTrip(ctx); assert.equal(repeat.state, 'SMOKE_VERIFIED'); assert.equal(repeat.verified, true); assert.equal(ctx.inspect().writes, 1);
});
test('a self-reported PASS is blocked and not promoted to a review verdict', async () => {
  const ctx = setup('PASS'); const r = await smokeRoundTrip(ctx);
  assert.equal(r.state, 'RESULT_BLOCKED'); assert.equal(r.verified, false);
});
test('poll timeout retains task for read-only resumption with no second paid create', async () => {
  const ctx = setup(); const normal = ctx.api.detail; ctx.api.detail = async () => ({ status: 'running' });
  assert.equal((await smokeRoundTrip(ctx)).state, 'SUBMITTED');
  ctx.api.detail = normal; assert.equal((await smokeRoundTrip(ctx)).verified, true); assert.equal(ctx.inspect().writes, 1);
});
test('a changed implementation SHA cannot receive the old task result', async () => {
  const ctx = setup(); await smokeRoundTrip(ctx);
  await assert.rejects(smokeRoundTrip({ ...ctx, binding: { ...binding, source_sha: 'b'.repeat(40) } }), /STALE_OR_FOREIGN_RECEIPT/);
  assert.equal(ctx.inspect().writes, 1);
});
