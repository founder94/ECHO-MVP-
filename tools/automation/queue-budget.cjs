// Per-task handoff budget + bootstrap branch plan. Pure: no I/O, no network, no model calls. Not wired into any live workflow.
// ONE function (budgetDecision) is meant to feed BOTH claude.yml gates (trusted-review preflight and shell round gate), so they cannot disagree.
// Trust rules: a task exists only if the server-registered state (CAS store, written by the approved init path) lists it with
// taskId/sourcePR/baseSha/owner/branch/acceptance/approval. Comment text (task ids, dates, round numbers, bot prose) never creates, resets or widens a budget.
// A PR without a valid registered task keeps the legacy cap: every historical handoff counts, limit 5 (e.g. PR103 stays blocked at 45/5).
const MAX = 5;
const OWNER = { login: 'founder94', type: 'User' };
const HANDOFF = /^<!-- echo-handoff to=codex sha=[a-f0-9]{40} round=\d+ -->/;
const TRUSTED_AUTHORS = [{ login: 'github-actions[bot]', type: 'Bot' }, { login: 'claude[bot]', type: 'Bot' }, OWNER];
const ACTORS = [...TRUSTED_AUTHORS, { login: 'chatgpt-codex-connector[bot]', type: 'Bot' }];
const PROTECTED = ['main', 'echo-qa', 'prod', 'production', 'echo-automation-state'];
const SHA = /^[a-f0-9]{40}$/;
const BRANCH = /^claude\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const same = (a, b) => !!a && a.login === b.login && a.type === b.type;
const deny = (reason, extra = {}) => ({ allowed: false, reason, ...extra });
const validLimit = n => Number.isInteger(n) && n >= 1 && n <= MAX; // rejects Infinity/NaN/negative/oversize/fractional

function validBranch(b) {
  return typeof b === 'string' && BRANCH.test(b) && !b.includes('..') && !b.endsWith('.lock') && !b.endsWith('/') && !PROTECTED.includes(b);
}
// Server-registered task identity. Returns null when valid, else a reason.
function taskProblem(t) {
  if (!t || typeof t !== 'object') return 'task_malformed';
  if (typeof t.taskId !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(t.taskId)) return 'bad_task_id';
  if (!Number.isInteger(t.sourcePR) || t.sourcePR < 1) return 'bad_source_pr';
  if (!SHA.test(t.baseSha || '')) return 'bad_base_sha';
  if (!same(t.owner, OWNER)) return 'bad_owner';
  if (!same(t.approval, OWNER)) return 'not_approved';
  if (!validBranch(t.branch)) return 'bad_branch';
  if (typeof t.acceptance !== 'string' || !t.acceptance.trim()) return 'no_acceptance';
  if (!Number.isFinite(Date.parse(t.registeredAt))) return 'bad_registered_at';
  return null;
}

// Trusted handoff comments only (API author + type, marker on the first line), de-duplicated by comment id.
function trustedHandoffs(comments) {
  const seen = new Map();
  for (const c of Array.isArray(comments) ? comments : []) {
    if (!c || !Number.isInteger(c.id) || !HANDOFF.test(c.body || '')) continue;
    if (!TRUSTED_AUTHORS.some(a => same(c.user, a))) continue;
    seen.set(c.id, c);
  }
  return [...seen.values()];
}

// registry: state.legacyTasks (server-registered). comments: issue comments of the PR as returned by the API.
// opts: { limit?, actor?, headSha?, headRef?, reviewSha? }  (all supplied by the workflow from API/context, never from comment text)
function budgetDecision({ registry, pr, comments, opts = {} }) {
  if (opts.limit !== undefined && !validLimit(opts.limit)) return deny('invalid_limit');
  const limit = opts.limit ?? MAX;
  if (!Number.isInteger(pr) || pr < 1) return deny('bad_pr');
  if (opts.actor !== undefined && !ACTORS.some(a => same(opts.actor, a))) return deny('unauthorized_actor');
  const handoffs = trustedHandoffs(comments);
  const entries = (Array.isArray(registry) ? registry : []).filter(t => t && t.sourcePR === pr);
  if (!entries.length) {
    return handoffs.length >= limit ? deny('round_limit', { mode: 'legacy', used: handoffs.length, limit }) : { allowed: true, mode: 'legacy', used: handoffs.length, limit, round: handoffs.length + 1 };
  }
  const live = entries.filter(t => !['DONE', 'BLOCKED'].includes(t.state));
  if (entries.some(t => taskProblem(t))) return deny('task_invalid', { mode: 'task', problem: entries.map(taskProblem).find(Boolean) });
  if (!live.length) return deny('task_blocked', { mode: 'task' }); // an already blocked task needs an explicitly approved new registration
  if (live.length > 1) return deny('ambiguous_task', { mode: 'task' });
  const t = live[0];
  if (opts.headRef !== undefined && opts.headRef !== t.branch) return deny('branch_mismatch', { mode: 'task' });
  if (opts.reviewSha !== undefined && opts.reviewSha !== opts.headSha) return deny('stale_sha', { mode: 'task' });
  const since = Date.parse(t.registeredAt);
  const ids = new Set((Array.isArray(t.handoffIds) ? t.handoffIds : []).filter(Number.isInteger));
  for (const c of handoffs) if (Date.parse(c.created_at) > since) ids.add(c.id);
  const used = Math.max(ids.size, Number.isInteger(t.rounds) && t.rounds > 0 ? t.rounds : 0);
  if (used >= limit) return deny('round_limit', { mode: 'task', taskId: t.taskId, used, limit });
  return { allowed: true, mode: 'task', taskId: t.taskId, branch: t.branch, used, limit, round: used + 1, historical: handoffs.length };
}

// Bootstrap plan for a separately approved task branch. Only fixed argv is produced; the model never receives git switch/create or gh api.
// ctx: { repository, canPush, actualBaseSha, remote: { exists, head }, expectedHead? }  (all measured by the workflow)
function planBootstrap(task, ctx) {
  const block = (reason, status = 'BLOCKED') => ({ ok: false, status, reason });
  const p = taskProblem(task);
  if (p) return block(p);
  if (!ctx || typeof ctx !== 'object') return block('no_context');
  if (!task.repository || task.repository !== ctx.repository) return block('external_repo');
  if (!ctx.canPush) return block('no_permission');
  if (!SHA.test(ctx.actualBaseSha || '') || ctx.actualBaseSha !== task.baseSha) return block('base_changed', 'STATE_CHANGED');
  const r = ctx.remote || {};
  if (r.exists) {
    if (!SHA.test(ctx.expectedHead || '')) return block('branch_exists');
    if (r.head !== ctx.expectedHead) return block('remote_head_changed', 'STATE_CHANGED');
    return { ok: true, status: 'REUSE', branch: task.branch, commands: [] };
  }
  return { ok: true, status: 'CREATE', branch: task.branch, commands: [['git', 'push', 'origin', `${task.baseSha}:refs/heads/${task.branch}`]] }; // plain push, never force
}
module.exports = { budgetDecision, planBootstrap, taskProblem, trustedHandoffs, validBranch, MAX };
