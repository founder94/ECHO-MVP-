// Runner-to-runner persistent CAS store: queue state is a JSON blob in a commit on a dedicated ref (default refs/echo/queue-state).
// save() pushes a child commit with --force-with-lease=<ref>:<expected old sha>, so a concurrent writer makes the push fail (false = conflict).
// Needs only git; the remote and credentials are supplied by the caller's environment. Not wired into any workflow.
const { execFileSync } = require('node:child_process');

function gitStore({ cwd = process.cwd(), remote = 'origin', ref = 'refs/echo/queue-state', initial = { tasks: [] } } = {}) {
  const git = (args, input) => execFileSync('git', args, { cwd, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const local = ref.replace('refs/', 'refs/remote-echo/');
  return {
    load() {
      try { git(['fetch', '--quiet', remote, `+${ref}:${local}`]); } catch (e) {
        if (/couldn't find remote ref/i.test(String(e.stderr))) return { rev: null, state: JSON.parse(JSON.stringify(initial)) };
        throw e; // any other fetch failure must not look like an empty queue (fail closed)
      }
      const sha = git(['rev-parse', local]);
      return { rev: sha, state: JSON.parse(git(['cat-file', 'blob', `${sha}:state.json`])) };
    },
    save(expected, state) {
      const blob = git(['hash-object', '-w', '--stdin'], JSON.stringify(state));
      const tree = git(['mktree'], `100644 blob ${blob}\tstate.json\n`);
      const args = ['-c', 'user.name=echo-queue', '-c', 'user.email=echo-queue@users.noreply.github.com', 'commit-tree', tree, '-m', 'queue state'];
      const commit = git(expected ? [...args, '-p', expected] : args);
      try { git(['push', '--quiet', `--force-with-lease=${ref}:${expected || ''}`, remote, `${commit}:${ref}`]); return true; } catch { return false; }
    },
  };
}
module.exports = { gitStore };
