const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handle, normalize, memoryStore, fileStore, CODEX } = require('./queue-adapter.cjs');
const S1 = 'a'.repeat(40), S2 = 'b'.repeat(40);
const codex = { login: CODEX, type: 'Bot' }, worker = { login: 'claude[bot]', type: 'Bot' }, outsider = { login: 'outsider', type: 'User' };
const q = (...states) => ({ seenEvents: [], tasks: states.map((s, i) => ({ id: 't' + (i + 1), ref: 'pr:' + (i + 1), state: s, rounds: 0, headSha: s === 'REVIEW' ? S1 : undefined })) });
const marker = (sha, v) => `<!-- echo-review from=codex sha=${sha} verdict=${v} -->\nbody`;
const review = (n, user, body, commit = S1, id = 1) => ({ action: 'submitted', review: { id, user, body, commit_id: commit }, pull_request: { number: n } });
const comment = (n, user, body, id = 1) => ({ action: 'created', comment: { id, user, body }, issue: { number: n, pull_request: {} } });
const handoff = sha => `<!-- echo-handoff to=codex sha=${sha} round=1 -->\nx`;

test('verified Codex PASS marker -> DONE and next READY starts', () => {
  const s = memoryStore(q('REVIEW', 'READY'));
  const r = handle(s, 'pull_request_review', review(1, codex, marker(S1, 'PASS')), 'd1');
  assert.equal(r.action, 'START'); assert.equal(r.taskId, 't2');
  assert.equal(r.queue.tasks[0].state, 'DONE'); assert.equal(r.queue.tasks[1].state, 'RUNNING');
});
test('standard Codex review text (no marker / no findings) is never PASS', () => {
  const s = memoryStore(q('REVIEW'));
  const r = handle(s, 'pull_request_review', review(1, codex, 'Codex Review: Didn\'t find any major issues. Nice work!'), 'd1');
  assert.equal(r.reason, 'no_verdict_marker'); assert.equal(r.queue.tasks[0].state, 'REVIEW');
});
test('marker in comment body by non-Codex actor is refused (actor from payload, not text)', () => {
  const s = memoryStore(q('REVIEW'));
  const r = handle(s, 'issue_comment', comment(1, outsider, marker(S1, 'PASS')), 'd1');
  assert.equal(r.reason, 'unauthorized_actor'); assert.equal(r.queue.tasks[0].state, 'REVIEW');
});
test('marker sha must equal review commit_id', () => {
  const s = memoryStore(q('REVIEW'));
  assert.equal(handle(s, 'pull_request_review', review(1, codex, marker(S1, 'PASS'), S2), 'd1').reason, 'marker_sha_mismatch');
});
test('late/stale SHA verdict ignored and task unchanged', () => {
  const s = memoryStore(q('REVIEW'));
  const r = handle(s, 'pull_request_review', review(1, codex, marker(S2, 'PASS'), S2), 'd1');
  assert.equal(r.reason, 'stale_sha'); assert.equal(r.queue.tasks[0].state, 'REVIEW');
});
test('redelivered webhook (same delivery id) ignored; same review id under new delivery also ignored', () => {
  const s = memoryStore(q('REVIEW'));
  assert.equal(handle(s, 'pull_request_review', review(1, codex, marker(S1, 'FAIL')), 'd1').action, 'FIX');
  assert.equal(handle(s, 'pull_request_review', review(1, codex, marker(S1, 'FAIL')), 'd1').reason, 'duplicate_delivery');
  s.save(s.load().rev, { ...s.load().state, tasks: [{ ...s.load().state.tasks[0], state: 'REVIEW' }] });
  assert.equal(handle(s, 'pull_request_review', review(1, codex, marker(S1, 'FAIL')), 'd2').reason, 'duplicate_event');
});
test('worker handoff -> REVIEW; outsider handoff refused; review pending blocks next start', () => {
  const s = memoryStore(q('RUNNING', 'READY'));
  assert.equal(handle(s, 'issue_comment', comment(1, outsider, handoff(S1)), 'd1').reason, 'unauthorized_actor');
  assert.equal(handle(s, 'issue_comment', comment(1, worker, handoff(S1), 2), 'd2').action, 'REVIEW');
  const r = handle(s, 'workflow_dispatch', { sender: worker }, 'd3');
  assert.equal(r.reason, 'concurrent_owner'); assert.equal(r.queue.tasks[1].state, 'READY');
});
test('start from unverified sender refused; missing sender refused', () => {
  const s = memoryStore(q('READY'));
  assert.equal(handle(s, 'workflow_dispatch', { sender: outsider }, 'd1').reason, 'unauthorized_actor');
  assert.equal(handle(s, 'workflow_dispatch', {}, 'd2').reason, 'unauthorized_actor');
  assert.equal(handle(s, 'workflow_dispatch', { sender: worker }, 'd3').action, 'START');
});
test('BLOCKED verdict halts queue; later events ignored', () => {
  const s = memoryStore(q('REVIEW', 'READY'));
  assert.equal(handle(s, 'pull_request_review', review(1, codex, marker(S1, 'BLOCKED')), 'd1').action, 'STOP');
  assert.equal(handle(s, 'workflow_dispatch', { sender: worker }, 'd2').reason, 'halted');
});
test('bad payloads / unknown task / unsupported event fail closed', () => {
  const s = memoryStore(q('REVIEW'));
  assert.equal(handle(s, 'pull_request_review', null, 'd1').reason, 'bad_payload');
  assert.equal(handle(s, 'pull_request_review', review(9, codex, marker(S1, 'PASS')), 'd2').reason, 'unknown_task');
  assert.equal(handle(s, 'push', {}, 'd3').reason, 'unsupported_event');
  assert.equal(handle(s, 'workflow_dispatch', { sender: worker }, '').reason, 'no_delivery_id');
});
test('result record: every delivery logged, queue not mutated by ignored events', () => {
  const s = memoryStore(q('REVIEW'));
  handle(s, 'push', {}, 'd1'); handle(s, 'pull_request_review', review(1, codex, marker(S1, 'FAIL')), 'd2');
  const st = s.load().state;
  assert.deepEqual(st.log.map(l => l.action), ['IGNORE', 'FIX']); assert.equal(st.tasks[0].rounds, 1);
});
test('concurrent update: stale CAS write rejected, retry reapplies on fresh state', () => {
  const s = memoryStore(q('REVIEW'));
  const { rev } = s.load();
  assert.equal(s.save(rev, { ...q('DONE') }), true);
  assert.equal(s.save(rev, { ...q('FIX') }), false); // loser of the race is refused
  let calls = 0; const racy = { ...s, load() { const l = s.load(); if (calls++ === 0) { s.save(l.rev, { ...l.state, tasks: l.state.tasks }); } return l; } };
  const r = handle(racy, 'workflow_dispatch', { sender: worker }, 'd1');
  assert.ok(['IDLE', 'START', 'IGNORE'].includes(r.action)); assert.notEqual(r.reason, 'store_conflict');
});
test('persistent conflict fails closed with nothing applied', () => {
  const base = memoryStore(q('REVIEW'));
  const never = { load: base.load, save: () => false };
  const r = handle(never, 'pull_request_review', review(1, codex, marker(S1, 'PASS')), 'd1');
  assert.equal(r.reason, 'store_conflict'); assert.equal(base.load().state.tasks[0].state, 'REVIEW');
});
test('file store: persists across instances, lock held -> save refused, state survives', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-')); const f = path.join(dir, 's.json');
  fs.writeFileSync(f, JSON.stringify({ rev: 0, state: q('REVIEW') }));
  assert.equal(handle(fileStore(f), 'pull_request_review', review(1, codex, marker(S1, 'FAIL')), 'd1').action, 'FIX');
  assert.equal(fileStore(f).load().state.tasks[0].state, 'FIX'); assert.equal(fileStore(f).load().rev, 1);
  fs.writeFileSync(f + '.lock', ''); // another holder
  assert.equal(fileStore(f).save(1, q('DONE')), false);
  assert.equal(fileStore(f).load().state.tasks[0].state, 'FIX');
  fs.rmSync(dir, { recursive: true });
});
test('normalize never reads verdict from non-first-line text', () => {
  const e = normalize('issue_comment', comment(1, codex, 'hello\n' + marker(S1, 'PASS')), q('REVIEW'));
  assert.equal(e.skip, 'no_marker');
});
