// Owner routing for the legacy claude.yml: a PR/issue that is a task of the queue is handled ONLY by the queue (adapter -> receiver).
// node queue-managed.cjs <is_pr true|false> <number>   -> writes managed=true|false to $GITHUB_OUTPUT. Exit 0 ok, 1 lookup failed (managed=true: fail closed, legacy stays off).
// Reads the queue state from the git CAS store (needs `git fetch origin` access of the checkout). No network beyond that, no writes.
const fs = require('node:fs');
const { gitStore } = require('./queue-store-git.cjs');

const isQueueManaged = (state, ref) => !!state && Array.isArray(state.tasks) && state.tasks.some(t => t && t.ref === ref);

function route(store, isPr, number) {
  if (!Number.isInteger(number) || number < 1) return { managed: true, code: 1, reason: 'bad_number' };
  try {
    const { rev, state } = store.load();
    if (rev === null || rev === 0) return { managed: false, code: 0, reason: 'no_queue' }; // no state branch: legacy paths unchanged
    return { managed: isQueueManaged(state, `${isPr ? 'pr' : 'issue'}:${number}`), code: 0, reason: 'checked' };
  } catch { return { managed: true, code: 1, reason: 'state_lookup_failed' }; } // unknown => do not run legacy
}

if (require.main === module) {
  const r = route(gitStore({ cwd: process.env.QUEUE_STORE_DIR || process.cwd() }), process.argv[2] === 'true', Number(process.argv[3]));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `managed=${r.managed}\n`);
  console.log(JSON.stringify({ managed: r.managed, reason: r.reason }));
  process.exit(r.code);
}
module.exports = { isQueueManaged, route };
