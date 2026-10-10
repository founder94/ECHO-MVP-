'use strict';
const { receiptStore } = require('./receipt-store.cjs');
const { submitOnce, receive, verifySmoke, ManusError } = require('./client.cjs');
// Callable preparation, not an enabled workflow. No credentials or ECHO records are accepted here.
// existingStore is PR118's durable CAS interface; binding comes from trusted approved runner metadata.
async function smokeRoundTrip({ api, existingStore, binding, receiptKey, approval, polling }) {
  const store = receiptStore(existingStore, binding);
  const submission = await submitOnce(api, store, receiptKey, approval);
  if (submission.state !== 'SUBMITTED' || !submission.taskId) {
    const old = await store.get(receiptKey);
    return { state: submission.state, verified: old?.state === 'SMOKE_VERIFIED' && old.last_result?.verified === true && old.proof?.fixtureSha === old.fixtureSha && old.proof?.sourceSha === binding.source_sha && old.proof?.verifier === 'exact-smoke-v1' };
  }
  const candidate = await receive(api, submission.taskId, polling);
  const verified = verifySmoke(candidate);
  const old = await store.get(receiptKey);
  if (old?.state !== 'SUBMITTED' || old.taskId !== submission.taskId) throw new ManusError('STALE_RESULT');
  // This is a synthetic connection receipt, never a product review/PASS or next READY permission.
  const resumable = candidate.state === 'POLL_TIMEOUT' || candidate.state === 'RESULT_PARTIAL' || candidate.state === 'WAITING';
  const next = { ...old, state: resumable ? 'SUBMITTED' : verified ? 'SMOKE_VERIFIED' : 'RESULT_BLOCKED', last_result: { state: candidate.state, verified, observedCredits: candidate.observedCredits ?? null }, ...(verified ? { proof: { fixtureSha: old.fixtureSha, sourceSha: binding.source_sha, verifier: 'exact-smoke-v1' } } : {}) };
  if (!await store.cas(receiptKey, old, next)) throw new ManusError('RESULT_CAS_FAILED');
  return { state: next.state, verified, result: candidate.state };
}
module.exports = { smokeRoundTrip };
