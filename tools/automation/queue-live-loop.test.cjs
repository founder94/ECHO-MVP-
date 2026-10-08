// Live echo-loop.cjs (main 8bc73f3) judgeRunning must never promote a thumbs-up or a Codex-authored body text to PASS.
// Loads the proposed fixed copy (proposed/echo-loop.cjs.txt); the patch against the 8bc original is proposed/echo-loop-no-thumbs-pass.patch.txt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');

const src = fs.readFileSync(path.join(__dirname, 'proposed', 'echo-loop.cjs.txt'), 'utf8');
const m = new Module('echo-loop');
m._compile(src, 'echo-loop.cjs');
const { judgeRunning, CODEX } = m.exports;
const sha = 'a'.repeat(40);
const base = () => ({
  now: '2026-10-03T21:30:00Z',
  issue: { number: 119, updated_at: '2026-10-03T21:00:00Z' },
  pr: { state: 'open', head: { sha } },
  headCommittedAt: '2026-10-03T21:20:00Z',
  reviews: [], reviewComments: [], issueComments: [],
  reactions: [{ user: { login: CODEX }, content: '+1', created_at: '2026-10-03T21:25:00Z' }],
});
const bodyComment = { user: { login: CODEX }, body: "Didn't find any major issues. Reviewed commit: `aaaaaaa`" };

test('original input: thumbs-up with no reviews/findings is never pass (unchanged expectation)', () => {
  assert.notStrictEqual(judgeRunning(base()).action, 'pass');
});
test('reported repro: Codex-authored body "Didn\'t find any major issues" + abbreviated SHA, no reviews/findings -> BLOCKED, not pass', () => {
  const f = base();
  f.issueComments = [bodyComment];
  const d = judgeRunning(f);
  assert.notStrictEqual(d.action, 'pass');
  assert.deepStrictEqual([d.action, d.reason, d.sha], ['block', 'codex_pass_unproven', sha]);
});
test('body text with thumbs-up and a "no findings" review body is still not pass', () => {
  const f = base();
  f.issueComments = [bodyComment];
  f.reviews = [{ user: { login: CODEX }, commit_id: sha, body: 'no findings' }];
  assert.notStrictEqual(judgeRunning(f).action, 'pass');
});
test('no signal -> poke; findings -> wait for fix; round limit -> block (unchanged)', () => {
  const f = base(); f.reactions = []; f.now = '2026-10-03T21:50:00Z'; // 30 min after head commit (> pokeAfterMin 25)
  assert.strictEqual(judgeRunning(f).action, 'poke');
  f.reviews = [{ user: { login: CODEX }, commit_id: sha }];
  f.reviewComments = [{ user: { login: CODEX }, commit_id: sha, body: '![P1 Badge]' }];
  assert.strictEqual(judgeRunning(f).action, 'wait');
  const g = base();
  g.issueComments = Array.from({ length: 6 }, () => ({ body: `<!-- echo-handoff to=codex sha=${sha} round=1 -->` }));
  assert.strictEqual(judgeRunning(g).action, 'block');
});
test('no code path in the fixed copy returns pass', () => {
  assert.ok(!/action:\s*'pass'/.test(src.replace(/\/\/.*$/gm, '')));
});
test('patch applies to the current origin/main echo-loop.cjs and yields the proposed copy', () => {
  const orig = cp.execFileSync('git', ['show', 'origin/main:.github/scripts/echo-loop.cjs'], { cwd: __dirname, encoding: 'utf8' });
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'loop-'));
  const run = (...a) => cp.execFileSync('git', a, { cwd: tmp, encoding: 'utf8' });
  run('init', '-q');
  fs.mkdirSync(path.join(tmp, '.github/scripts'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.github/scripts/echo-loop.cjs'), orig);
  run('apply', path.join(__dirname, 'proposed', 'echo-loop-no-thumbs-pass.patch.txt'));
  assert.strictEqual(fs.readFileSync(path.join(tmp, '.github/scripts/echo-loop.cjs'), 'utf8'), src);
});
