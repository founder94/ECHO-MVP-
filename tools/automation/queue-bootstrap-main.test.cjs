// Reviewer reproduction (bootstrap must measure actual main HEAD, not the registered base). Expectations unchanged; mock exec only, no real GitHub.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ghIo, bootstrap } = require('./queue-register.cjs');
const A = 'a'.repeat(40), B = 'b'.repeat(40), repo = 'founder94/ECHO-MVP-';
const task = { taskId: 'T1', sourcePR: 200, baseSha: A, repository: repo, branch: 'claude/task-1', acceptance: 'test', owner: { login: 'founder94', type: 'User' }, approval: { login: 'founder94', type: 'User' }, registeredAt: '2026-10-04T14:00:00Z', state: 'REGISTERED', rounds: 0, handoffIds: [] };
function store() { let rev = 0, state = { legacyTasks: [task] }; return { load: () => ({ rev, state: structuredClone(state) }), save: (r, s) => { if (r !== rev) return false; state = structuredClone(s); rev++; return true; } }; }

test('bootstrap measurement must detect main moving after task registration', () => {
  const exec = (cmd, args) => cmd === 'git' ? '' : args.includes('.permissions.push') ? 'true' : args.some(x => x.endsWith('/commits/main')) ? B : A;
  const measured = ghIo(repo, process.cwd(), exec).measure(task);
  assert.equal(measured.actualBaseSha, B);
  const s = store(); let ran = 0;
  assert.equal(bootstrap(s, 'T1', { ...ghIo(repo, process.cwd(), exec), run: () => { ran++; }, measure: () => measured }).ok, false);
  assert.equal(ran, 0);
  assert.equal(s.load().state.legacyTasks[0].bootstrap.status, 'FAILED');
});

test('atomic ref-create conflict must preserve competing branch and save FAILED', () => {
  let branch = B, calls = 0;
  const exec = (cmd, args) => { assert.equal(cmd, 'gh'); assert.ok(args.includes('POST')); assert.ok(args.some(x => x.endsWith('/git/refs'))); calls++; if (branch) throw new Error('422 reference already exists'); branch = A; return ''; };
  const transport = ghIo(repo, process.cwd(), exec), s = store();
  const result = bootstrap(s, 'T1', { measure: () => ({ repository: repo, canPush: true, actualBaseSha: A, remote: { exists: false, head: null } }), run: transport.run, head: () => branch });
  assert.equal(result.ok, false);
  assert.equal(branch, B);
  assert.equal(calls, 1);
  assert.equal(s.load().state.legacyTasks[0].bootstrap.status, 'FAILED');
});
