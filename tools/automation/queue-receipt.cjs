// Completion receipt (isolated, NOT wired into any live workflow): worker run completed -> real handoff comment -> REVIEW.
// A comment posted with GITHUB_TOKEN does not wake issue_comment workflows, so the adapter is woken by `workflow_run: completed`
// of the receiver workflow instead. Nothing in the event payload or in any comment text is trusted: the run is re-read from the API,
// matched to a workerClaim that verify-dispatch stored in the CAS state (claim id = run_id-run_attempt), and the handoff comment
// is re-read from the API (author Bot in WORKERS, time inside the run window, sha == CURRENT PR head). Anything missing => REVIEW saved 0.
// The handoff is then fed through the normal handle() path as an issue_comment submit, so actor/limit/dedupe rules are unchanged.
const { execFileSync } = require('node:child_process');
const { handle, HANDOFF_MARKER } = require('./queue-adapter.cjs');
const { WORKERS } = require('./queue-controller.cjs');

const RECEIVER_PATH = '.github/workflows/queue-worker-receiver.yml';
const SHA = /^[a-f0-9]{40}$/;
const EXPECT_STATE = { START: 'RUNNING', FIX: 'FIX' };
const isWorker = u => !!u && WORKERS.some(w => w.login === u.login && w.type === u.type);
const ignore = (reason, code = 0) => ({ code, out: { action: 'IGNORE', reason } });

const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 });
// Default live lookups: existing gh auth only, fixed error messages (no stderr, no token).
function ghRun(repo, id) {
  try {
    const o = JSON.parse(gh(['api', `repos/${repo}/actions/runs/${id}`, '--jq', '{id:.id,path:.path,event:.event,status:.status,conclusion:.conclusion,attempt:.run_attempt,headBranch:.head_branch,repo:.repository.full_name,headRepo:.head_repository.full_name,startedAt:.run_started_at,updatedAt:.updated_at}']));
    return o;
  } catch { throw new Error('run_lookup_failed'); }
}
function ghComments(repo, number) {
  try {
    const out = gh(['api', `repos/${repo}/issues/${number}/comments`, '--paginate', '--jq', '[.[]|{id:.id,login:.user.login,type:.user.type,createdAt:.created_at,body:.body}]']);
    return JSON.parse(out.replace(/\]\s*\[/g, ','));
  } catch { throw new Error('comments_lookup_failed'); }
}

function markReceipt(store, key, commentId, retries) {
  for (let i = 0; i <= retries; i++) {
    const { rev, state } = store.load();
    if (store.save(rev, { ...state, outbox: state.outbox.map(e => (e.key === key ? { ...e, receipt: { commentId } } : e)) })) return true;
  }
  return false; // best effort: delivery + comment-id dedupe already stop a replay
}

// payload: the workflow_run event file content (only workflow_run.id is read; it is a lookup key, never a fact).
// deps: getRun(repo,id), getPr(number) -> {headSha,state,headRepo,...}, listComments(repo,number) -> [{id,login,type,createdAt,body}] (all may throw => exit 1, nothing saved).
function receipt(store, payload, repo, { getRun, getPr, listComments, config = { strict: true }, retries = 3 } = {}) {
  if (payload?.repository?.full_name !== repo) return ignore('repo_mismatch');
  const runId = payload?.workflow_run?.id;
  if (!Number.isInteger(runId) || runId < 1) return ignore('bad_run_id');
  let run; try { run = getRun(repo, runId); } catch { return { code: 1, out: { error: 'run_lookup_failed' } }; }
  if (!run || run.id !== runId || run.path !== RECEIVER_PATH || run.event !== 'workflow_dispatch' || run.headBranch !== 'main' || run.repo !== repo || run.headRepo !== repo) return ignore('not_receiver_run');
  if (run.status !== 'completed') return ignore('run_not_completed');
  const claimId = `${run.id}-${run.attempt}`;
  const { state } = store.load(); // throws on remote failure: caller fails closed
  const e = (state.outbox || []).find(x => x.workerClaim && x.workerClaim.id === claimId);
  if (!e) return ignore('no_claim_for_run'); // an older/other run, or a run verify-dispatch never accepted
  if (e.receipt) return ignore('duplicate_receipt');
  if (state.halted) return ignore('halted');
  const t = (state.tasks || []).find(x => x.id === e.taskId);
  if (!t || t.state !== EXPECT_STATE[e.action]) return ignore('task_state');
  if (run.conclusion !== 'success') return ignore('worker_failed', 3); // REVIEW is never entered; needs a human
  const number = Number(String(e.ref).split(':')[1]);
  let pr, comments;
  try { pr = getPr(number); comments = listComments(repo, number); } catch { return { code: 1, out: { error: 'lookup_failed' } }; }
  if (!pr || pr.state !== 'open' || pr.headRepo !== repo || !SHA.test(pr.headSha || '')) return ignore('pr_not_eligible');
  const from = Date.parse(run.startedAt), to = Date.parse(run.updatedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return ignore('bad_run_time', 3);
  const found = (comments || []).filter(c => {
    const m = HANDOFF_MARKER.exec(c.body || '');
    const at = Date.parse(c.createdAt);
    return m && isWorker({ login: c.login, type: c.type }) && at >= from && at <= to && m[1] === pr.headSha && (e.action !== 'FIX' || m[1] !== e.sha);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (!found.length) return ignore('no_valid_handoff', 3); // deleted, other author, outside the run, or not on the current head
  const c = found[0];
  const synthetic = { action: 'created', repository: { full_name: repo }, issue: { number, pull_request: {} }, comment: { id: c.id, body: c.body, user: { login: c.login, type: c.type } } };
  const r = handle(store, 'issue_comment', synthetic, `receipt:${claimId}`, config, retries);
  if (r.action === 'REVIEW') markReceipt(store, e.key, c.id, retries);
  return { code: r.action === 'STOP' ? 2 : 0, out: { action: r.action, reason: r.reason, taskId: r.taskId } };
}

module.exports = { receipt, ghRun, ghComments, RECEIVER_PATH };
