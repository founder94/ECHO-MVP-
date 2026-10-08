'use strict';
// Read-only official APIs. Never returns an identity, raw wallet balance, key or task title.
const ORIGIN = 'https://api.manus.ai';
class ReadinessError extends Error {
  constructor(code) { super(code); this.code = code; }
}
async function readiness({ apiKey, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ReadinessError('MISSING_CREDENTIAL');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new ReadinessError('INVALID_TIMEOUT');
  async function get(path) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const r = await fetchImpl(ORIGIN + path, { method: 'GET', headers: { 'x-manus-api-key': apiKey }, redirect: 'error', signal: abort.signal });
      if (!r.ok) throw new ReadinessError([401,403].includes(r.status) ? 'AUTH_OR_ACCESS_FAILED' : r.status === 429 ? 'RATE_LIMITED' : 'REMOTE_HTTP');
      const text = await r.text();
      if (Buffer.byteLength(text) > 1048576) throw new ReadinessError('RESPONSE_TOO_LARGE');
      let body; try { body = JSON.parse(text); } catch { throw new ReadinessError('INVALID_RESPONSE'); }
      if (body?.ok !== true) throw new ReadinessError('REMOTE_ERROR');
      return body;
    } catch (e) {
      if (e instanceof ReadinessError) throw e;
      throw new ReadinessError(abort.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILED');
    } finally { clearTimeout(timer); }
  }
  const identity = await get('/v2/user.me');
  if (typeof identity.user_id !== 'string' || !identity.user_id) throw new ReadinessError('INVALID_IDENTITY');
  let positive = null, creditCode = null;
  try {
    const result = await get('/v2/usage.availableCredits');
    const total = result.data?.total_credits;
    // Official total_credits is authoritative; never add expired component quotas ourselves.
    if (!Number.isSafeInteger(total) || total < 0 || total > 2147483647) throw new ReadinessError('INVALID_CREDIT_BALANCE');
    positive = total > 0;
  } catch (e) { creditCode = e instanceof ReadinessError ? e.code : 'UNKNOWN'; }
  return { authentication: 'PASS', credential_present: true, credit_read: positive === null ? 'BLOCKED' : 'PASS', spendable_credits_positive: positive, ...(creditCode ? { credit_code: creditCode } : {}), task_cost_quote: 'UNAVAILABLE', provider_hard_task_cap: 'UNAVAILABLE', paid_task_started: false, task_round_trip: 'NOT_RUN' };
}
async function main() {
  try { process.stdout.write(JSON.stringify(await readiness({ apiKey: process.env.MANUS_API_KEY })) + '\n'); }
  catch (e) { process.stdout.write(JSON.stringify({ authentication: 'FAIL', credential_present: !!process.env.MANUS_API_KEY, code: e instanceof ReadinessError ? e.code : 'UNKNOWN', paid_task_started: false }) + '\n'); process.exitCode = 1; }
}
if (require.main === module) void main();
module.exports = { readiness, ReadinessError };
