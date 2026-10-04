// Single budget gate for claude.yml (both the trusted-review preflight and the shell round gate read its outputs).
// node queue-budget-cli.cjs <pr number> <issue-comments file (JSON array or one JSON value per line)>
// Env (from workflow context, not comment text): QUEUE_STORE_DIR (checkout with git access), REVIEW_ACTOR_LOGIN/REVIEW_ACTOR_TYPE (optional).
// Writes allowed/used/limit/round/branch/reason to $GITHUB_OUTPUT. Exit 0 allowed, 4 denied, 1 error (fail closed: allowed=false). Read-only.
const fs = require('node:fs');
const { gitStore } = require('./queue-store-git.cjs');
const { budgetDecision } = require('./queue-budget.cjs');

function parseComments(text) {
  try { const v = JSON.parse(text); return Array.isArray(v) ? v.flat() : [v]; } catch { /* fall through */ }
  return text.split('\n').filter(l => l.trim()).flatMap(l => { const v = JSON.parse(l); return Array.isArray(v) ? v : [v]; });
}

function run(store, pr, commentsText, env = {}) {
  try {
    const comments = parseComments(commentsText);
    const { rev, state } = store.load();
    const registry = rev === null ? [] : state.legacyTasks;
    const actor = env.REVIEW_ACTOR_LOGIN ? { login: env.REVIEW_ACTOR_LOGIN, type: env.REVIEW_ACTOR_TYPE } : undefined;
    const d = budgetDecision({ registry, pr, comments, opts: { actor } });
    return { code: d.allowed ? 0 : 4, d };
  } catch { return { code: 1, d: { allowed: false, reason: 'budget_lookup_failed' } }; } // fixed text: no token/err output
}

if (require.main === module) {
  const r = run(gitStore({ cwd: process.env.QUEUE_STORE_DIR || process.cwd() }), Number(process.argv[2]), fs.readFileSync(process.argv[3], 'utf8'), process.env);
  const o = r.d;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `allowed=${o.allowed}\nused=${o.used ?? 0}\nlimit=${o.limit ?? 5}\nround=${o.round ?? 0}\nbranch=${o.branch ?? ''}\nreason=${o.reason ?? 'ok'}\n`);
  }
  console.log(JSON.stringify({ allowed: o.allowed, reason: o.reason ?? 'ok', mode: o.mode, used: o.used, limit: o.limit }));
  process.exit(r.code);
}
module.exports = { run, parseComments };
