// Approved task registration (init) + leased bootstrap execution for the per-task budget (queue-budget.cjs). Reuses the CAS store (queue-store-git.cjs).
// Not wired into any live workflow; no network/model calls unless the caller injects gh/git executors (tests inject mocks).
// Trust rules: the registrant is the real workflow_dispatch sender (founder94, User) taken from GitHub event metadata, never from comment text or typed inputs.
// A registered task is immutable: same taskId can never be re-registered, a blocked/done PR can never be reopened under a new id (no resume policy exists -> refuse),
// and a branch can belong to one task only. Registration never resets rounds/handoffIds of anything.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { taskProblem, planBootstrap, MAX } = require('./queue-budget.cjs');

const OWNER = { login: 'founder94', type: 'User' };
const MAX_TASKS = 20;
const SHA = /^[a-f0-9]{40}$/;
const isOwner = a => !!a && a.login === OWNER.login && a.type === OWNER.type;
const no = (reason, extra = {}) => ({ ok: false, reason, ...extra });

// ctx (measured from GitHub metadata by the workflow): { eventName, sender:{login,type}, repository, pr:{number,state,draft,repository}, actualBaseSha, baseReachable, now }
// req (typed workflow inputs): { taskId, sourcePR, baseSha, repository, branch, acceptance }
function registerDecision(state, req, ctx) {
  if (!state || typeof state !== 'object') return no('invalid_state');
  if (state.legacyTasks !== undefined && !Array.isArray(state.legacyTasks)) return no('invalid_state');
  if (!ctx || ctx.eventName !== 'workflow_dispatch') return no('not_dispatch');
  if (!isOwner(ctx.sender)) return no('start_not_by_owner'); // actor original preserved: User founder94 only
  if (!req || typeof req !== 'object') return no('bad_request');
  const sourcePR = Number(req.sourcePR);
  const task = {
    taskId: req.taskId, sourcePR, baseSha: req.baseSha, repository: req.repository, branch: req.branch, acceptance: req.acceptance,
    owner: { ...OWNER }, approval: { login: ctx.sender.login, type: ctx.sender.type },
    registeredAt: ctx.now, state: 'REGISTERED', rounds: 0, handoffIds: [],
  };
  const p = taskProblem(task);
  if (p) return no(p);
  if (!task.repository || task.repository !== ctx.repository) return no('external_repo');
  if (!ctx.pr || ctx.pr.number !== sourcePR || ctx.pr.state !== 'open' || ctx.pr.repository !== ctx.repository) return no('pr_not_verified');
  if (!SHA.test(ctx.actualBaseSha || '') || ctx.actualBaseSha !== task.baseSha || ctx.baseReachable !== true) return no('base_not_verified', { status: 'STATE_CHANGED' });
  const reg = state.legacyTasks || [];
  if (reg.length >= MAX_TASKS) return no('registry_full');
  if (reg.some(t => t && t.taskId === task.taskId)) return no('duplicate_task_id'); // immutable: no re-registration, no counter reset
  if (reg.some(t => t && t.branch === task.branch)) return no('branch_in_use');
  const prior = reg.filter(t => t && t.sourcePR === sourcePR);
  if (prior.some(t => !['DONE', 'BLOCKED'].includes(t.state))) return no('live_task_exists');
  if (prior.length) return no('resume_policy_missing'); // blocked/done task: a new id is NOT a resume; explicit resume policy does not exist yet
  return { ok: true, task, state: { ...state, legacyTasks: [...reg, task] } };
}

// Atomic CAS registration. store: {load, save}.
function register(store, req, ctx) {
  const { rev, state } = store.load();
  const d = registerDecision(state, req, ctx);
  if (!d.ok) return d;
  if (!store.save(rev, d.state)) return no('cas_conflict'); // concurrent runner won: nothing registered
  return { ok: true, taskId: d.task.taskId };
}

// Leased bootstrap. Steps: (1) CAS-claim the lease (BOOTSTRAP CLAIMED) before any remote action, (2) measure, (3) plan (planBootstrap), (4) run fixed argv,
// (5) re-measure the head, (6) CAS-record DONE or FAILED. A crash after (1) leaves CLAIMED: never auto-retried (human needed) -> no duplicate execution.
// io: { measure(task) -> ctx for planBootstrap, run(argv), head(task) -> remote head sha|null }
function bootstrap(store, taskId, io, opts = {}) {
  const { rev, state } = store.load();
  const reg = Array.isArray(state.legacyTasks) ? state.legacyTasks : [];
  const t = reg.find(x => x && x.taskId === taskId);
  if (!t) return no('unknown_task');
  const p = taskProblem(t);
  if (p) return no(p);
  if (['DONE', 'BLOCKED'].includes(t.state)) return no('task_blocked');
  if (t.bootstrap) return no(t.bootstrap.status === 'DONE' ? 'already_bootstrapped' : t.bootstrap.status === 'CLAIMED' ? 'bootstrap_in_progress' : 'bootstrap_failed_needs_human');
  const claimId = opts.claimId || randomUUID();
  const upd = (s, patch) => ({ ...s, legacyTasks: s.legacyTasks.map(x => (x.taskId === taskId ? { ...x, bootstrap: { ...x.bootstrap, ...patch } } : x)) });
  const claimed = upd({ ...state, legacyTasks: reg }, { status: 'CLAIMED', claimId });
  if (!store.save(rev, claimed)) return no('cas_conflict');
  const finish = (status, extra) => {
    for (let i = 0; i < 3; i++) { // record the outcome; a failure is stored as FAILED, never as success
      const cur = store.load();
      if (store.save(cur.rev, upd(cur.state, { status, claimId, ...extra }))) return true;
    }
    return false;
  };
  let plan;
  try { plan = planBootstrap(t, io.measure(t)); } catch { finish('FAILED', { reason: 'measure_failed' }); return no('measure_failed'); }
  if (!plan.ok) { finish('FAILED', { reason: plan.reason }); return no(plan.reason, { status: plan.status }); }
  try {
    for (const argv of plan.commands) io.run(argv);
    const head = io.head(t);
    const expected = plan.status === 'CREATE' ? t.baseSha : undefined;
    if (expected && head !== expected) { finish('FAILED', { reason: 'head_mismatch_after_push' }); return no('head_mismatch_after_push', { status: 'STATE_CHANGED' }); }
  } catch { finish('FAILED', { reason: 'exec_failed' }); return no('exec_failed'); } // fixed text: no tool stderr/token output
  if (!finish('DONE', { receiptSha: t.baseSha, branch: t.branch })) return no('receipt_not_saved');
  return { ok: true, status: plan.status, branch: t.branch, limit: MAX };
}

// Default measurement/executor for the fixed workflow (gh uses the runner's existing GH_TOKEN; failures raise and are mapped to fixed messages above).
function ghIo(repository, cwd = process.cwd(), exec = execFileSync) {
  const out = (cmd, args) => String(exec(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
  const lsHead = t => { const o = out('git', ['ls-remote', 'origin', `refs/heads/${t.branch}`]); return o ? o.split(/\s+/)[0] : null; };
  return {
    measure: t => {
      const head = lsHead(t);
      const commit = out('gh', ['api', `repos/${repository}/commits/${t.baseSha}`, '--jq', '.sha']);
      return { repository, canPush: out('gh', ['api', `repos/${repository}`, '--jq', '.permissions.push']) === 'true', actualBaseSha: commit, remote: { exists: !!head, head } };
    },
    run: argv => { out(argv[0], argv.slice(1)); },
    head: lsHead,
  };
}
function ghContext(repository, req, event, now, cwd = process.cwd(), exec = execFileSync) {
  const out = (args) => String(exec('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim();
  const pr = JSON.parse(out(['api', `repos/${repository}/pulls/${Number(req.sourcePR)}`, '--jq', '{number:.number,state:.state,repository:.base.repo.full_name}']));
  const sha = out(['api', `repos/${repository}/commits/${req.baseSha}`, '--jq', '.sha']);
  const st = out(['api', `repos/${repository}/compare/${req.baseSha}...main`, '--jq', '.status']);
  return { eventName: event.eventName, sender: event.sender, repository, pr, actualBaseSha: sha, baseReachable: st === 'identical' || st === 'ahead', now };
}

if (require.main === module) {
  // node queue-register.cjs register|bootstrap  (env: GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_REPOSITORY, QUEUE_STORE_DIR)
  const { gitStore } = require('./queue-store-git.cjs');
  const cwd = process.env.QUEUE_STORE_DIR || process.cwd();
  const repository = process.env.GITHUB_REPOSITORY;
  let r;
  try {
    const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const inp = ev.inputs || {};
    const store = gitStore({ cwd });
    if (process.argv[2] === 'register') {
      const req = { taskId: inp.task_id, sourcePR: inp.source_pr, baseSha: inp.base_sha, repository, branch: inp.branch, acceptance: inp.acceptance };
      const event = { eventName: process.env.GITHUB_EVENT_NAME, sender: ev.sender && { login: ev.sender.login, type: ev.sender.type } };
      r = register(store, req, ghContext(repository, req, event, new Date().toISOString(), cwd));
    } else if (process.argv[2] === 'bootstrap') {
      if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || ev.sender?.login !== OWNER.login || ev.sender?.type !== OWNER.type) r = no('start_not_by_owner');
      else r = bootstrap(store, inp.task_id, ghIo(repository, cwd));
    } else r = no('bad_command');
  } catch { r = no('lookup_failed'); }
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : r.reason === 'lookup_failed' ? 1 : 4);
}
module.exports = { registerDecision, register, bootstrap, ghIo, ghContext };
