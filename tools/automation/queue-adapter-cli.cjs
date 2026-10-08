// CLI: node queue-adapter-cli.cjs <event_name> <event_json_path> <delivery_id>
// env: GITHUB_REPOSITORY (required), QUEUE_STORE_DIR (git working copy, default cwd), QUEUE_MAX_ROUNDS (optional)
// Verifies GitHub event metadata before the adapter sees it, then runs handle() against the git-ref CAS store.
// Exit: 0 handled/ignored, 2 halted (STOP), 1 error (fail closed). Prints one JSON result line (no payload text).
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { handle, REVIEW_MARKER, HANDOFF_MARKER, CODEX } = require('./queue-adapter.cjs');
const { initQueue, drain, ghWorkflowDispatcher, verifyDispatch } = require('./queue-exec.cjs');
const { gitStore } = require('./queue-store-git.cjs');
const { receipt, ghRun, ghComments } = require('./queue-receipt.cjs');

// Default live lookup of the PR's current head via the runner's existing gh auth (GH_TOKEN/GITHUB_TOKEN from env; never printed).
// Throws a fixed message on any failure so stderr (which could echo request details) never reaches output.
function ghHead(repo, number) {
  let out;
  try { out = execFileSync('gh', ['api', `repos/${repo}/pulls/${number}`, '--jq', '.head.sha'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim(); }
  catch { throw new Error('head_lookup_failed'); }
  if (!/^[a-f0-9]{40}$/.test(out)) throw new Error('head_lookup_failed');
  return out;
}

// Verdict/handoff events must be bound to the PR's CURRENT head, looked up right before processing (not the payload snapshot).
// Returns null (ok) or an ignore reason; throws when lookup fails (caller fails closed: no store access).
function verifyCurrentHead(name, p, getHead, repo) {
  let sha, number;
  if (name === 'pull_request_review' && p.action === 'submitted') { sha = p.review?.commit_id; number = p.pull_request?.number; }
  else if (name === 'issue_comment' && p.action === 'created') {
    const body = p.comment?.body || '';
    const m = REVIEW_MARKER.exec(body) || HANDOFF_MARKER.exec(body);
    if (!m) return null; // not a verdict/handoff: the adapter ignores it
    if (!p.issue?.pull_request) return 'not_a_pr';
    sha = m[1]; number = p.issue.number;
  } else return null;
  if (!Number.isInteger(number)) return 'bad_pr_number';
  const current = getHead(repo, number);
  if (!/^[a-f0-9]{40}$/.test(current || '')) throw new Error('head_lookup_failed');
  return sha === current ? null : 'stale_head';
}

// Reject payloads from another repository, and reviews whose commit is not the PR's current head.
function verifyMetadata(name, p, repo) {
  if (!p || p.repository?.full_name !== repo) return 'repo_mismatch';
  if (name === 'pull_request_review' && p.review?.commit_id !== p.pull_request?.head?.sha) return 'review_not_on_head';
  return null;
}

// Native Codex review (no echo-review marker): count the findings (inline review comments) that belong to THIS review,
// were written by the Codex bot and sit on the review's exact commit. Fixed error message only (no stderr/token output).
function ghFindings(repo, number, reviewId) {
  let out;
  try { out = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/pulls/${number}/reviews/${reviewId}/comments`, '--paginate', '--jq', '[.[]|{u:.user.login,t:.user.type,c:.commit_id,r:.pull_request_review_id}]'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).replace(/\]\s*\[/g, ',')); }
  catch { throw new Error('findings_lookup_failed'); }
  if (!Array.isArray(out)) throw new Error('findings_lookup_failed');
  return out.map(c => ({ user: { login: c.u, type: c.t }, commit_id: c.c, pull_request_review_id: c.r }));
}
const countFindings = (list, review) => list.filter(c => c && c.user?.login === CODEX && c.user.type === 'Bot' && c.commit_id === review.commit_id && c.pull_request_review_id === review.id).length;

// deps (all injectable, default = real gh with the runner's existing auth): getFindings, dispatch.
function run(argv, env, store, getHead = ghHead, deps = {}) {
  const st = () => store || gitStore({ cwd: env.QUEUE_STORE_DIR || process.cwd() });
  if (argv[0] === 'init') return runInit(argv, env, st);
  if (argv[0] === 'drain') return runDrain(env, st, getHead, deps);
  if (argv[0] === 'verify-dispatch') return runVerifyDispatch(env, st, deps);
  if (argv[0] === 'receipt') return runReceipt(argv, env, st, deps);
  const [name, path, delivery] = argv;
  if (!name || !path || !delivery || !env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  let payload; try { payload = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return { code: 1, out: { error: 'bad_event_file' } }; }
  const bad = verifyMetadata(name, payload, env.GITHUB_REPOSITORY);
  if (bad) return { code: 0, out: { action: 'IGNORE', reason: bad } };
  try { const stale = verifyCurrentHead(name, payload, getHead, env.GITHUB_REPOSITORY); if (stale) return { code: 0, out: { action: 'IGNORE', reason: stale } }; }
  catch { return { code: 1, out: { error: 'head_lookup_failed' } }; } // no verdict, no save, no dispatch
  const ctx = {};
  if (name === 'pull_request_review' && payload.action === 'submitted' && !REVIEW_MARKER.exec(payload.review?.body || '') && payload.review?.user?.login === CODEX) {
    try { ctx.nativeFindings = countFindings((deps.getFindings || ghFindings)(env.GITHUB_REPOSITORY, payload.pull_request.number, payload.review.id), payload.review); }
    catch { return { code: 1, out: { error: 'findings_lookup_failed' } }; } // no verdict without verified findings
  }
  // QUEUE_REVIEWER_PRINCIPAL (opt-in, default unset = OFF): login of an explicitly approved real User allowed to submit FAIL/BLOCKED verdicts; its PASS never completes a task.
  const config = { strict: true, ...(env.QUEUE_SECURITY_GATE === '1' ? { securityGate: true, resolveEvidence: deps.resolveEvidence } : {}), // resolver: runtime-injected only, never from env/event ...(env.QUEUE_MAX_ROUNDS ? { maxRounds: Number(env.QUEUE_MAX_ROUNDS) } : {}),
    ...(env.QUEUE_REVIEWER_PRINCIPAL ? { reviewerPrincipal: { login: env.QUEUE_REVIEWER_PRINCIPAL, type: 'User' } } : {}) };
  const r = handle(st(), name, payload, delivery, config, 3, ctx);
  return { code: r.action === 'STOP' ? 2 : 0, out: { action: r.action, reason: r.reason, taskId: r.taskId } };
}

// init <event_json> <delivery>: workflow_dispatch input `tasks` (JSON). Creates the queue only when none exists (CAS create); sender must be the owner User.
function runInit(argv, env, st) {
  const [, path, delivery] = argv;
  if (!path || !delivery || !env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  let p; try { p = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return { code: 1, out: { error: 'bad_event_file' } }; }
  if (p?.repository?.full_name !== env.GITHUB_REPOSITORY) return { code: 0, out: { action: 'IGNORE', reason: 'repo_mismatch' } };
  let input; try { input = { tasks: JSON.parse(p.inputs?.tasks) }; } catch { return { code: 1, out: { error: 'bad_tasks' } }; }
  const r = initQueue(input, p.sender && { login: p.sender.login, type: p.sender.type });
  if (r.error) return { code: 1, out: { error: r.error } };
  const store = st(); const cur = store.load();
  if (cur.rev !== null && cur.rev !== 0) return { code: 0, out: { action: 'IGNORE', reason: 'already_initialized' } }; // never overwrite a running queue
  if (!store.save(cur.rev, r.state)) return { code: 0, out: { action: 'IGNORE', reason: 'store_conflict' } };
  return { code: 0, out: { action: 'INIT', tasks: r.state.tasks.length } };
}

// drain: run pending outbox entries through the dispatcher. Exit 0 ok, 3 dispatch failed/uncertain/lookup failed (needs attention).
function runDrain(env, st, getHead, deps) {
  if (!env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  const dispatch = deps.dispatch || ghWorkflowDispatcher(env); // workflow_dispatch (GITHUB_TOKEN-supported), typed inputs only
  const r = drain(st(), dispatch, { securityGate: env.QUEUE_SECURITY_GATE === '1', resolveEvidence: deps.resolveEvidence, getHead: ref => getHead(env.GITHUB_REPOSITORY, Number(ref.split(':')[1])) });
  return { code: r.stopped && r.stopped !== 'halted' ? 3 : 0, out: { action: 'DRAIN', dispatched: r.dispatched.length, stopped: r.stopped } };
}

// Current PR facts for the receiver (existing gh auth only; fixed error message, no stderr).
function ghPrInfo(repo, number) {
  let o;
  try { o = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/pulls/${number}`, '--jq', '{headSha:.head.sha,branch:.head.ref,state:.state,draft:.draft,base:.base.ref,headRepo:.head.repo.full_name}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 })); }
  catch { throw new Error('pr_lookup_failed'); }
  return o;
}

// verify-dispatch: receiver gate before any model step. Dispatch inputs come in env (DQ_*); the actors come from the workflow's github context
// (ACTOR/TRIGGERING_ACTOR), never from dispatch inputs. Exit 0 accepted (prints branch+sha), 4 rejected, 1 lookup/store error (fail closed).
function runVerifyDispatch(env, st, deps) {
  if (!env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  const getPr = deps.getPr || (n => ghPrInfo(env.GITHUB_REPOSITORY, n));
  let r;
  try {
    r = verifyDispatch(st(), { key: env.DQ_KEY, action: env.DQ_ACTION, taskId: env.DQ_TASK_ID, ref: env.DQ_REF, sha: env.DQ_SHA || '' },
      { getPr, actor: env.ACTOR, triggeringActor: env.TRIGGERING_ACTOR, claimId: env.CLAIM_ID, repo: env.GITHUB_REPOSITORY, maxRounds: env.QUEUE_MAX_ROUNDS ? Number(env.QUEUE_MAX_ROUNDS) : 5, securityGate: env.QUEUE_SECURITY_GATE === '1', resolveEvidence: deps.resolveEvidence });
  } catch { return { code: 1, out: { error: 'verify_lookup_failed' } }; }
  return r.ok ? { code: 0, out: r } : { code: 4, out: { ok: false, reason: r.reason } };
}

// receipt <workflow_run_event_json>: worker run completed -> verified handoff -> REVIEW (see queue-receipt.cjs). Exit 0 ok/ignored, 2 halted, 3 needs attention, 1 lookup/store error.
function runReceipt(argv, env, st, deps) {
  if (!argv[1] || !env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  let p; try { p = JSON.parse(fs.readFileSync(argv[1], 'utf8')); } catch { return { code: 1, out: { error: 'bad_event_file' } }; }
  try {
    return receipt(st(), p, env.GITHUB_REPOSITORY, { getRun: deps.getRun || ghRun, getPr: deps.getPr || (n => ghPrInfo(env.GITHUB_REPOSITORY, n)), listComments: deps.listComments || ghComments,
      config: { strict: true, ...(env.QUEUE_MAX_ROUNDS ? { maxRounds: Number(env.QUEUE_MAX_ROUNDS) } : {}) } });
  } catch { return { code: 1, out: { error: 'receipt_store_failed' } }; }
}

if (require.main === module) {
  try { const { code, out } = run(process.argv.slice(2), process.env); console.log(JSON.stringify(out)); process.exit(code); }
  catch (e) { console.log(JSON.stringify({ error: 'exception', message: String(e.message).slice(0, 200) })); process.exit(1); }
}
module.exports = { run, ghPrInfo, verifyMetadata, verifyCurrentHead, ghHead, ghFindings, countFindings };
