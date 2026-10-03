// CLI: node queue-adapter-cli.cjs <event_name> <event_json_path> <delivery_id>
// env: GITHUB_REPOSITORY (required), QUEUE_STORE_DIR (git working copy, default cwd), QUEUE_MAX_ROUNDS (optional)
// Verifies GitHub event metadata before the adapter sees it, then runs handle() against the git-ref CAS store.
// Exit: 0 handled/ignored, 2 halted (STOP), 1 error (fail closed). Prints one JSON result line (no payload text).
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { handle, REVIEW_MARKER, HANDOFF_MARKER } = require('./queue-adapter.cjs');
const { gitStore } = require('./queue-store-git.cjs');

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

function run(argv, env, store, getHead = ghHead) {
  const [name, path, delivery] = argv;
  if (!name || !path || !delivery || !env.GITHUB_REPOSITORY) return { code: 1, out: { error: 'usage' } };
  let payload; try { payload = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return { code: 1, out: { error: 'bad_event_file' } }; }
  const bad = verifyMetadata(name, payload, env.GITHUB_REPOSITORY);
  if (bad) return { code: 0, out: { action: 'IGNORE', reason: bad } };
  try { const stale = verifyCurrentHead(name, payload, getHead, env.GITHUB_REPOSITORY); if (stale) return { code: 0, out: { action: 'IGNORE', reason: stale } }; }
  catch { return { code: 1, out: { error: 'head_lookup_failed' } }; } // no verdict, no save, no dispatch
  const config = env.QUEUE_MAX_ROUNDS ? { maxRounds: Number(env.QUEUE_MAX_ROUNDS) } : {};
  const r = handle(store || gitStore({ cwd: env.QUEUE_STORE_DIR || process.cwd() }), name, payload, delivery, config);
  return { code: r.action === 'STOP' ? 2 : 0, out: { action: r.action, reason: r.reason, taskId: r.taskId } };
}

if (require.main === module) {
  try { const { code, out } = run(process.argv.slice(2), process.env); console.log(JSON.stringify(out)); process.exit(code); }
  catch (e) { console.log(JSON.stringify({ error: 'exception', message: String(e.message).slice(0, 200) })); process.exit(1); }
}
module.exports = { run, verifyMetadata, verifyCurrentHead, ghHead };
