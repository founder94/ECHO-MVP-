'use strict';
const { createHash } = require('node:crypto');
const ORIGIN = 'https://api.manus.ai';
const SMOKE = 'This is a synthetic API integration test. Reply with exactly {"echo":"ECHO_MANUS_SYNTHETIC_V1"}. Do not browse, use connectors, access files, call other services, or change any external state.';
const SMOKE_SHA = createHash('sha256').update(SMOKE).digest('hex');
class ManusError extends Error {
  constructor(code, uncertain = false) { super(code); this.name = 'ManusError'; this.code = code; this.uncertain = uncertain; }
}
function client({ apiKey, fetchImpl = fetch, timeoutMs = 15000 }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ManusError('MISSING_CREDENTIAL');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new ManusError('INVALID_TIMEOUT');
  async function request(path, body) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(ORIGIN + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-manus-api-key': apiKey, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new ManusError(response.status === 401 || response.status === 403 ? 'AUTH_FAILED' : response.status === 429 ? 'RATE_LIMITED' : 'REMOTE_HTTP', body !== undefined && response.status >= 500);
      const raw = await response.text();
      if (Buffer.byteLength(raw) > 1048576) throw new ManusError('RESPONSE_TOO_LARGE', body !== undefined);
      let parsed; try { parsed = JSON.parse(raw); } catch { throw new ManusError('INVALID_RESPONSE', body !== undefined); }
      if (!parsed || parsed.ok !== true) throw new ManusError('REMOTE_ERROR', body !== undefined);
      return parsed;
    } catch (error) {
      if (error instanceof ManusError) throw error;
      // Never expose server error bodies, credentials, fetch URLs, account identifiers or prompts in logs.
      throw new ManusError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILED', body !== undefined);
    } finally { clearTimeout(timer); }
  }
  const taskId = id => { if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id) || id === 'agent-default-main_task') throw new ManusError('INVALID_TASK_ID'); return id; };
  return {
    auth: async () => { const r = await request('/v2/user.me'); if (typeof r.user_id !== 'string' || !r.user_id) throw new ManusError('INVALID_IDENTITY'); return { authenticated: true }; },
    // Exact synthetic prompt only. Arbitrary ECHO specs or user records cannot be sent through this runner.
    createSmoke: async approval => {
      if (approval?.fixture_sha256 !== SMOKE_SHA || approval?.cost_reported !== true || approval?.paid_test_approved !== true || !Number.isFinite(approval?.estimated_credits) || approval.estimated_credits <= 0 || !Number.isFinite(approval?.approved_credits) || approval.approved_credits < approval.estimated_credits) throw new ManusError('PAID_TEST_BLOCKED');
      const r = await request('/v2/task.create', { message: { content: SMOKE, connectors: [] }, interactive_mode: false, share_visibility: 'private', agent_profile: 'lite', title: 'Synthetic connection check' });
      if (r.share_visibility !== 'private' || typeof r.task_id !== 'string') throw new ManusError('UNTRUSTED_CREATION_RECEIPT', true);
      return { taskId: taskId(r.task_id), fixtureSha: SMOKE_SHA };
    },
    detail: async id => { id = taskId(id); const r = await request('/v2/task.detail?task_id=' + encodeURIComponent(id)); if (!r.task || r.task.id !== id) throw new ManusError('TASK_MISMATCH'); return r.task; },
    messages: async (id, cursor) => { id = taskId(id); if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 1000)) throw new ManusError('INVALID_CURSOR'); const r = await request('/v2/task.listMessages?task_id=' + encodeURIComponent(id) + '&limit=50&order=asc' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')); if (r.task_id !== id || !Array.isArray(r.messages) || typeof r.has_more !== 'boolean' || r.has_more && typeof r.next_cursor !== 'string') throw new ManusError('INVALID_MESSAGES'); return r; },
  };
}
function classify(task) {
  // A stopped foreground task can still have background jobs. Missing fields are not success.
  if (task?.status === 'running' || task?.status === 'pending') return 'RUNNING';
  if (task?.status === 'waiting') return 'WAITING';
  if (task?.status === 'error') return 'FAILED';
  if (task?.status !== 'stopped') return 'UNKNOWN';
  if (task.has_running_background_jobs !== false) return task.has_running_background_jobs === true ? 'RUNNING' : 'UNKNOWN';
  return 'STOPPED'; // No invented task.stop_reason field; official Task schema does not expose it.
}
// store must be the existing durable CAS queue, never one temporary runner's local file.
// A create timeout is uncertain: retain the claim; do not retry task.create and double-charge.
async function submitOnce(api, store, key, approval) {
  const old = await store.get(key);
  if (old) return { state: old.state, duplicate: true, taskId: old.taskId ?? null };
  const claim = { state: 'CREATING', fixtureSha: SMOKE_SHA };
  if (!await store.cas(key, null, claim)) return { state: 'CONFLICT', duplicate: true, taskId: null };
  try {
    const receipt = await api.createSmoke(approval);
    if (!await store.cas(key, claim, { state: 'SUBMITTED', ...receipt })) throw new ManusError('RECEIPT_CAS_FAILED', true);
    return { state: 'SUBMITTED', duplicate: false, ...receipt };
  } catch (error) {
    const state = error.uncertain ? 'CREATE_UNCERTAIN' : 'BLOCKED';
    await store.cas(key, claim, { state, fixtureSha: SMOKE_SHA });
    throw error;
  }
}
async function receive(api, taskId, { maxPolls = 20, wait = ms => new Promise(r => setTimeout(r, ms)), signal } = {}) {
  if (!Number.isSafeInteger(maxPolls) || maxPolls < 1 || maxPolls > 60) throw new ManusError('INVALID_POLL_LIMIT');
  for (let i = 0; i < maxPolls; i++) {
    if (signal?.aborted) throw new ManusError('CANCELLED');
    const task = await api.detail(taskId);
    if (signal?.aborted) throw new ManusError('CANCELLED');
    const state = classify(task);
    if (state === 'FAILED' || state === 'WAITING' || state === 'UNKNOWN') return { state, verified: false };
    if (state === 'STOPPED') {
      const pages = []; let cursor;
      for (let p = 0; p < 10; p++) {
        if (signal?.aborted) throw new ManusError('CANCELLED');
        const r = await api.messages(taskId, cursor);
        if (signal?.aborted) throw new ManusError('CANCELLED');
        pages.push(...r.messages);
        if (!r.has_more) return { state: 'RESULT_CANDIDATE', verified: false, candidateMessages: pages, fixtureSha: SMOKE_SHA, observedCredits: Number.isSafeInteger(task.credit_usage) && task.credit_usage >= 0 ? task.credit_usage : null };
        cursor = r.next_cursor;
      }
      return { state: 'RESULT_PARTIAL', verified: false };
    }
    if (i + 1 < maxPolls) await wait(3000);
  }
  return { state: 'POLL_TIMEOUT', verified: false }; // Keep taskId/claim; no stop/delete/re-create.
}
function verifySmoke(result) {
  if (result?.state !== 'RESULT_CANDIDATE' || result.fixtureSha !== SMOKE_SHA || !Array.isArray(result.candidateMessages)) return false;
  if (result.candidateMessages.some(e => e.type === 'error_message' || e.type === 'user_stop')) return false;
  const last = result.candidateMessages.filter(e => e.type === 'assistant_message').at(-1);
  if (!last || typeof last.id !== 'string' || last.assistant_message?.delivery_kind !== 'result' || typeof last.assistant_message?.content !== 'string') return false;
  let payload; try { payload = JSON.parse(last.assistant_message.content); } catch { return false; }
  return payload?.echo === 'ECHO_MANUS_SYNTHETIC_V1' && Object.keys(payload).length === 1;
}
module.exports = { client, classify, submitOnce, receive, verifySmoke, ManusError, SMOKE_SHA };
