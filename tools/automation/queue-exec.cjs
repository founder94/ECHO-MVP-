// Execution-connection prep (isolated, NOT wired into any workflow). Pure/injectable: no network unless a caller passes a real dispatcher.
// 1) Approval: only tasks explicitly approved by the real owner (founder94, type User) can ever run. The owner identity (approval.by/owner,
//    a GitHub User taken from the verified workflow_dispatch sender) is a different field from the worker identity (task.worker, a Bot).
// 2) Outbox: every START/FIX/REVIEW decision is written to state.outbox in the SAME CAS commit as the state transition.
//    drain() claims one entry by CAS (PENDING -> DISPATCHING), calls the injected dispatch, then records DONE / FAILED by CAS.
//    Boundary (NOT exactly-once): two runners cannot both claim an entry (CAS), a replayed event cannot add the same key twice.
//    A process killed after claim but before the result is recorded leaves DISPATCHING; drain() refuses to dispatch anything further
//    (needs a human) instead of guessing. A thrown dispatch is stored as FAILED, never as DONE. Real dispatchers must also be idempotent by key.
const { execFileSync } = require('node:child_process');

const APPROVER = Object.freeze({ login: 'founder94', type: 'User' });
const REF = /^(pr|issue):[1-9][0-9]{0,9}$/;
const TASK_ID = /^[A-Za-z0-9._-]{1,64}$/;
const SHA = /^[a-f0-9]{40}$/;
const MAX_TASKS = 20;
const MAX_ATTEMPTS = 3;
const isApprover = a => !!a && a.login === APPROVER.login && a.type === APPROVER.type;
const EXPECT_STATE = { START: 'RUNNING', FIX: 'FIX', REVIEW: 'REVIEW' };

// Build the initial queue from a workflow_dispatch input. `sender` must be the verified payload sender (never input text).
function initQueue(input, sender) {
  if (!isApprover(sender)) return { error: 'init_not_by_owner' };
  const tasks = input && input.tasks;
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > MAX_TASKS) return { error: 'bad_tasks' };
  const ids = new Set(), refs = new Set();
  for (const t of tasks) {
    if (!t || typeof t !== 'object' || !TASK_ID.test(t.id || '') || !REF.test(t.ref || '') || !isApprover(t.owner)) return { error: 'bad_task' };
    if (ids.has(t.id) || refs.has(t.ref)) return { error: 'duplicate_task' };
    ids.add(t.id); refs.add(t.ref);
  }
  return { state: { tasks: tasks.map(t => ({ id: t.id, ref: t.ref, state: 'READY', rounds: 0, approval: { by: { ...APPROVER }, owner: { ...APPROVER }, ref: t.ref } })),
    seenEvents: [], deliveries: [], outbox: [], log: [] } };
}

// Strict mode: every task must carry an approval by the real owner for its own ref. Returns null or a reason.
function validateApproved(state) {
  if (!state || !Array.isArray(state.tasks) || state.tasks.length === 0) return 'queue_not_initialized';
  for (const t of state.tasks) {
    const a = t.approval;
    if (!a || !isApprover(a.by) || !isApprover(a.owner) || a.ref !== t.ref) return 'unapproved_queue';
  }
  return null;
}

const outboxKey = (action, t, r) => (action === 'START' ? `START:${t.id}` : action === 'FIX' ? `FIX:${t.id}:${r.round}` : `REVIEW:${t.id}:${t.headSha}`);

// Add the outbox entry for a controller result into the next state (same commit). Idempotent by key.
function withOutbox(r, worker) {
  if (!['START', 'FIX', 'REVIEW'].includes(r.action)) return r.queue;
  const t = r.queue.tasks.find(x => x.id === r.taskId);
  if (!t) return r.queue;
  const key = outboxKey(r.action, t, r);
  const outbox = r.queue.outbox || [];
  if (outbox.some(e => e.key === key)) return r.queue;
  const entry = { key, action: r.action, taskId: t.id, ref: t.ref, sha: t.headSha || null, round: r.round || 0, status: 'PENDING', attempts: 0 };
  const tasks = r.action === 'START' ? r.queue.tasks.map(x => (x.id === t.id ? { ...x, worker } : x)) : r.queue.tasks;
  return { ...r.queue, tasks, outbox: [...outbox, entry] };
}

const setEntry = (state, key, patch) => ({ ...state, outbox: state.outbox.map(e => (e.key === key ? { ...e, ...patch } : e)) });

function casUpdate(store, key, patch, retries) {
  for (let i = 0; i <= retries; i++) { const { rev, state } = store.load(); if (store.save(rev, setEntry(state, key, patch))) return true; }
  return false;
}

// drain: dispatch pending entries one at a time. getHead(ref) -> current head sha (injected; throws on failure).
// Returns {dispatched:[keys], stopped:reason|null}. Never marks DONE unless dispatch returned without throwing.
function drain(store, dispatch, { getHead, retries = 3 } = {}) {
  const dispatched = [];
  for (;;) {
    const { rev, state } = store.load();
    const outbox = state.outbox || [];
    if (state.halted) return { dispatched, stopped: 'halted' };
    const stuck = outbox.find(e => e.status === 'DISPATCHING');
    if (stuck) return { dispatched, stopped: 'uncertain_dispatch', key: stuck.key }; // claimed, result unknown: needs a human
    const e = outbox.find(x => x.status === 'PENDING' || (x.status === 'FAILED' && x.attempts < MAX_ATTEMPTS));
    if (!e) return { dispatched, stopped: null };
    const t = state.tasks.find(x => x.id === e.taskId);
    if (!t || t.state !== EXPECT_STATE[e.action] || (e.action !== 'START' && e.sha && t.headSha !== e.sha)) {
      if (!casUpdate(store, e.key, { status: 'OBSOLETE' }, retries)) return { dispatched, stopped: 'store_conflict' };
      continue;
    }
    if (e.sha) {
      let cur; try { cur = getHead(e.ref); } catch { return { dispatched, stopped: 'head_lookup_failed' }; } // nothing dispatched
      if (cur !== e.sha) { if (!casUpdate(store, e.key, { status: 'STALE' }, retries)) return { dispatched, stopped: 'store_conflict' }; continue; }
    }
    if (!store.save(rev, setEntry(state, e.key, { status: 'DISPATCHING', attempts: e.attempts + 1 }))) continue; // lost the claim race: re-read
    let ok = false;
    try { dispatch({ key: e.key, action: e.action, taskId: e.taskId, ref: e.ref, sha: e.sha, round: e.round }); ok = true; } catch { /* stored as FAILED below */ }
    if (!casUpdate(store, e.key, { status: ok ? 'DONE' : 'FAILED' }, retries)) return { dispatched, stopped: 'uncertain_dispatch', key: e.key };
    if (!ok) return { dispatched, stopped: 'dispatch_failed', key: e.key };
    dispatched.push(e.key);
  }
}

// Real dispatcher (prepared, never called by tests): posts one PR comment per key via the runner's existing gh auth.
// START/FIX need a worker-trigger text supplied by approved config (env QUEUE_WORKER_TRIGGER); missing => fail closed.
// REVIEW posts nothing unless requestReview is set: the worker's handoff comment already requests the Codex review (no double paid review).
// Idempotent: skips when a comment carrying the same key marker already exists.
// UNPROVEN: comments made with the default GITHUB_TOKEN do not trigger other workflows; a non-default token would need 대표 approval.
function ghDispatcher(env, exec = execFileSync, { requestReview = false } = {}) {
  const gh = args => exec('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
  return entry => {
    if (entry.action === 'REVIEW' && !requestReview) return;
    const trigger = entry.action === 'REVIEW' ? '@codex review' : env.QUEUE_WORKER_TRIGGER;
    if (!trigger || /[\r\n]/.test(trigger)) throw new Error('no_trigger');
    const m = /^pr:(\d+)$/.exec(entry.ref || ''); if (!m) throw new Error('not_a_pr');
    const mark = `<!-- echo-dispatch key=${entry.key} -->`;
    let found; try { found = gh(['api', `repos/${env.GITHUB_REPOSITORY}/issues/${m[1]}/comments`, '--paginate', '--jq', `[.[]|select(.body|startswith("${mark}"))]|length`]); } catch { throw new Error('dispatch_failed'); }
    if (found.split('\n').some(n => Number(n) > 0)) return;
    try { gh(['pr', 'comment', m[1], '--repo', env.GITHUB_REPOSITORY, '--body', `${mark}\n${entry.action} ${entry.taskId}${entry.sha ? ` sha=${entry.sha}` : ''}\n${trigger}`]); } catch { throw new Error('dispatch_failed'); }
  };
}

// workflow_dispatch dispatcher (supported by GITHUB_TOKEN, unlike comment triggers; no new secret). Calls the worker receiver workflow
// (env.QUEUE_WORKER_WORKFLOW = file name, repository variable) with typed inputs only; no free text from comments.
// At-most-once comes from the CAS claim in drain(), not from a remote lookup: a crash after the call but before DONE is stored
// leaves DISPATCHING (human needed). UNPROVEN against real GitHub (mock exec only).
function ghWorkflowDispatcher(env, exec = execFileSync) {
  return entry => {
    const wf = env.QUEUE_WORKER_WORKFLOW;
    if (!wf || !/^[A-Za-z0-9._-]+\.ya?ml$/.test(wf)) throw new Error('no_worker_workflow');
    if (!['START', 'FIX'].includes(entry.action)) return; // REVIEW is requested by the worker's own handoff comment
    if (!/^pr:\d+$/.test(entry.ref || '') || !/^[A-Za-z0-9_.:-]{1,80}$/.test(entry.key || '') || !/^[A-Za-z0-9_.-]{1,80}$/.test(entry.taskId || '')) throw new Error('bad_entry');
    if (entry.sha && !/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error('bad_entry');
    const args = ['workflow', 'run', wf, '--repo', env.GITHUB_REPOSITORY, '--ref', 'main', '-f', `key=${entry.key}`, '-f', `action=${entry.action}`, '-f', `task_id=${entry.taskId}`, '-f', `ref=${entry.ref}`];
    if (entry.sha) args.push('-f', `sha=${entry.sha}`);
    try { exec('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }); } catch { throw new Error('dispatch_failed'); }
  };
}

module.exports = { ghWorkflowDispatcher, APPROVER, isApprover, initQueue, validateApproved, withOutbox, drain, ghDispatcher, MAX_ATTEMPTS };
