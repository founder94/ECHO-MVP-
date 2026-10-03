// Live echo-loop.cjs (main e0d67d9) judgeRunning must never promote a thumbs-up/no-findings signal to PASS.
// Loads the proposed fixed copy (proposed/echo-loop.cjs.txt); the patch against the e0 original is proposed/echo-loop-no-thumbs-pass.patch.txt.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
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

test('thumbs-up with no reviews/findings is BLOCKED, never pass (reported repro)', () => {
  const d = judgeRunning(base());
  assert.notStrictEqual(d.action, 'pass');
  assert.deepStrictEqual([d.action, d.reason, d.sha], ['block', 'codex_pass_unproven', sha]);
});
test('thumbs-up with a "no findings" review body is still not pass', () => {
  const f = base();
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
  assert.ok(!/action:\s*'pass'\s*,\s*reason/.test(src.replace(/\/\/.*$/gm, '').replace(/\{action:'wait'[^}]*\}/, '')));
});
