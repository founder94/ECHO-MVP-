// CLI: node queue-adapter-cli.cjs <event_name> <event_json_path> <delivery_id>
// env: GITHUB_REPOSITORY (required), QUEUE_STORE_DIR (git working copy, default cwd), QUEUE_MAX_ROUNDS (optional)
// Verifies GitHub event metadata before the adapter sees it, then runs handle() against the git-ref CAS store.
// Exit: 0 handled/ignored, 2 halted (STOP), 1 error (fail closed). Prints one JSON result line (no payload text).
const fs = require('node:fs');
const { handle } = require('./queue-adapter.cjs');
const { gitStore } = require('./queue-store-git.cjs');

// Reject payloads from another repository, and reviews whose commit is not the PR's current head.
function verifyMetadata(name, p, repo) {
  if (!p || p.repository?.full_name !== repo) return 'repo_mismatch';
  if (name === 'pull_request_review' && p.review?.commit_id !== p.pull_request?.head?.sha) return 'review_not_on_head';
  return null;
}

function run(argv, env, store) {
  const [name, path, delivery] = argv;
  if (!name || !path || !delivery || !env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  let payload; try { payload = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return { code: 1, out: { error: 'bad_event_file' } }; }
  const bad = verifyMetadata(name, payload, env.GITHUB_REPOSITORY);
  if (bad) return { code: 0, out: { action: 'IGNORE', reason: bad } };
  const config = env.QUEUE_MAX_ROUNDS ? { maxRounds: Number(env.QUEUE_MAX_ROUNDS) } : {};
  const r = handle(store || gitStore({ cwd: env.QUEUE_STORE_DIR || process.cwd() }), name, payload, delivery, config);
  return { code: r.action === 'STOP' ? 2 : 0, out: { action: r.action, reason: r.reason, taskId: r.taskId } };
}

if (require.main === module) {
  try { const { code, out } = run(process.argv.slice(2), process.env); console.log(JSON.stringify(out)); process.exit(code); }
  catch (e) { console.log(JSON.stringify({ error: 'exception', message: String(e.message).slice(0, 200) })); process.exit(1); }
}
module.exports = { run, verifyMetadata };
