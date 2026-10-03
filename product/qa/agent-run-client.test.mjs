// 2026-10-03 실행 단계 앱 연결부(agentApi.ts · agentRun · validRun) — 가짜 서버 응답 기준. 화면이 다음 할 일을 정하지 않고 서버 값을 그대로 쓰는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'agentapi-'));
const calls = []; let reply = null;
globalThis.__agentStub = { calls, set: (r) => { reply = r; }, get: () => reply };
writeFileSync(path.join(dir, 'understandingApi.mjs'), `
export async function prepareUnderstandingRequest(userId, body) { return { body: { ...body, requestId: 'req-1' }, complete() {} }; }
export async function serverFunctionRequest(fn, body) { globalThis.__agentStub.calls.push({ fn, body }); return structuredClone(globalThis.__agentStub.get()); }`);
const js = ts.transpileModule(readFileSync(new URL('../src/doit/lib/agentApi.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace("'@/doit/lib/understandingApi'", "'./understandingApi.mjs'").replace('import.meta.env.VITE_ECHO_AGENT_ENABLED', "'false'");
writeFileSync(path.join(dir, 'agentApi.mjs'), js);
const A = await import(pathToFileURL(path.join(dir, 'agentApi.mjs')).href);

const session = (run) => ({ id: '11111111-1111-4111-8111-111111111111', tone: 'polite', mode: 'TEXT', phase: 'done', progress: { asked: 5, of: 5 }, current_question: null, messages: [], summary: [], closing: null, profile: null, handoff: null, run });
const run = (o = {}) => ({ version: 'echo-run-v1', goal: 'friend', plan_rev: 3, outcome: 'on_hold', waiting: 'no_candidates_yet', next: 'wait', missing: [], steps: [{ id: 'tool:candidates', status: 'done', why: 'none' }], candidates: { outcome: 'none', count: 0, at: '2026-10-03T00:00:00Z', fresh: true }, budget: { calls: 1 }, ...o });

test('agentRun: 보내는 것 = agent_run · 세션 id · 재개는 명시했을 때만 · 서버의 next 를 그대로 돌려줌', async () => {
  globalThis.__agentStub.set({ session: session(run()), run: run(), tool: { tool: 'candidates', outcome: 'none', count: 0, code: null } });
  const r = await A.agentRun('u1', '11111111-1111-4111-8111-111111111111');
  assert.deepEqual(calls.at(-1), { fn: 'doit-agent', body: { action: 'agent_run', sessionId: '11111111-1111-4111-8111-111111111111', requestId: 'req-1' } });
  assert.equal(r.run.next, 'wait'); assert.equal(r.tool.outcome, 'none'); assert.equal(r.duplicate, false);
  await A.agentRun('u1', '11111111-1111-4111-8111-111111111111', { resume: true });
  assert.equal(calls.at(-1).body.resume, true, '사용자가 누른 재개만 resume');
  await A.agentRun('u1', '11111111-1111-4111-8111-111111111111', { resume: false });
  assert.equal('resume' in calls.at(-1).body, false);
});
test('agentRun: 같은 요청 재전송 표시(duplicate) 전달 · 모양이 틀린 실행 기록 = 오류(화면이 임의로 채우지 않음)', async () => {
  globalThis.__agentStub.set({ session: session(run()), run: run(), tool: null, duplicate: true });
  assert.equal((await A.agentRun('u1', 's')).duplicate, true);
  for (const bad of [run({ next: 'auto_pick' }), run({ outcome: 'success' }), run({ plan_rev: 'x' }), run({ steps: null }), null]) {
    globalThis.__agentStub.set({ session: session(run()), run: bad, tool: null });
    await assert.rejects(A.agentRun('u1', 's'), /INVALID_RESPONSE/);
  }
});
test('세션의 실행 기록: 맞으면 그대로 · 틀리면 대화는 쓰고 실행 기록만 버림(null)', async () => {
  globalThis.__agentStub.set({ session: session(run()) });
  assert.equal((await A.agentRescue('u1', 's')).run.next, 'wait');
  globalThis.__agentStub.set({ session: session(run({ next: 'bogus' })) });
  const s = await A.agentRescue('u1', 's');
  assert.equal(s.run, null); assert.equal(s.phase, 'done');
  globalThis.__agentStub.set({ session: session(undefined) });
  assert.equal((await A.agentRescue('u1', 's')).run, undefined, '예전 서버(실행 기록 없음)도 그대로');
});
test('소스 규칙: 앱 연결부는 다음 할 일·완료를 스스로 정하지 않음(서버 next 그대로) · 후보 자동 선택 동작 0', () => {
  const src = readFileSync(new URL('../src/doit/lib/agentApi.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /next\s*=\s*['"]/, '화면 코드가 next 를 만들지 않음');
  assert.doesNotMatch(src, /mutual|select_candidate|choose_candidate|my_choice/, '상호 선택·후보 고르기 호출 0');
});

// ── Codex 명세 20261003-1 항목 B: 연결 화면의 실행 버튼(createAgentRunTrigger + AsleepConnections 소스 규칙)
const okRun = run({ outcome: 'done', waiting: null, next: 'open_candidates', candidates: { outcome: 'found', count: 2, at: '2026-10-03T00:00:00Z', fresh: true } });
const mkTrigger = (o = {}) => {
  const log = { get: 0, run: 0, results: [], errors: [], busy: [] };
  let release; const gate = o.gate ? new Promise((ok) => { release = ok; }) : null;
  const t = A.createAgentRunTrigger({
    getSession: async () => { log.get++; return o.noSession ? null : session(undefined); },
    run: async () => { log.run++; if (gate) await gate; if (o.fail) throw Object.assign(new Error('x'), { status: o.fail }); return { run: o.run ?? okRun, tool: null }; },
    onResult: (r) => log.results.push(r), onError: (e) => log.errors.push(e), onBusy: (b) => log.busy.push(b),
  });
  return { t, log, release: () => release?.() };
};
test('연결 화면 진입만으로 agent_run을 호출하지 않는다 · 사용자가 누르면 한 번 호출한다', async () => {
  const { t, log } = mkTrigger();
  assert.equal(log.run, 0, '만들기만 하면 호출 0');
  await t();
  assert.equal(log.run, 1); assert.equal(log.results[0].next, 'open_candidates'); assert.deepEqual(log.busy, [true, false]);
});
test('실행 중 연속 클릭은 두 번째 agent_run을 보내지 않는다', async () => {
  const { t, log, release } = mkTrigger({ gate: true });
  const a = t(); await new Promise((r) => setTimeout(r, 0)); await t(); await t();
  release(); await a;
  assert.equal(log.run, 1); assert.equal(log.get, 1);
});
test('agent_run 실패는 결과로 넘기지 않음(마지막 성공 유지) · 409 429 499 502 뒤 자동 재호출 0 · 세션 없으면 만들지 않음', async () => {
  for (const status of [409, 429, 499, 502]) {
    const { t, log } = mkTrigger({ fail: status });
    await t();
    assert.equal(log.results.length, 0); assert.equal(log.errors.length, 1); assert.equal(log.run, 1, `${status} 뒤 자동 재호출 0`);
  }
  const { t, log } = mkTrigger({ noSession: true });
  await t();
  assert.equal(log.run, 0); assert.equal(log.errors[0].message, 'NO_SESSION');
});
test('on_hold·stopped·wait·retry_later·resume_if_wanted 결과도 자동 후속 호출 0', async () => {
  for (const r of [run({ outcome: 'on_hold', next: 'wait' }), run({ outcome: 'on_hold', waiting: 'lookup_failed', next: 'retry_later' }), run({ outcome: 'stopped', waiting: 'user_stopped', next: 'resume_if_wanted' }), run({ outcome: 'in_progress', waiting: null, next: 'run' })]) {
    const { t, log } = mkTrigger({ run: r });
    await t(); await new Promise((x) => setTimeout(x, 5));
    assert.equal(log.run, 1, `${r.next} 뒤 자동 호출 0`);
  }
});
test('연결 화면 소스 규칙: 빌드 스위치·로그인·자격 갖춤일 때만 버튼 · open_candidates = 기존 후보 화면 다시 읽기 · resume·choose 0', () => {
  const src = readFileSync(new URL('../src/doit/components/feature/AsleepConnections.tsx', import.meta.url), 'utf8');
  assert.match(src, /\{ECHO_AGENT_ENABLED && userId && eligible && !next && <AgentRunButton/);
  assert.match(src, /if \(run\.next === 'open_candidates'\) onOpenCandidates\(\)/);
  assert.match(src, /<ConnectionCandidates key=\{candidatesKey\}/, '후보 상세는 기존 doit-connect 화면에서만');
  assert.doesNotMatch(src, /resume:\s*true|chooseCandidate|useEffect\([^)]*agentRun/, '자동 재개·후보 선택·진입 시 실행 0');
  assert.match(src, /disabled=\{busy \|\| spent\} aria-busy=\{busy\}/, '진행 중 버튼 비활성(예산을 다 쓴 끝 상태도 비활성)');
});
test('Codex P2(리뷰 5400474027) 후보 조회 요약 모양 검사: 결과 종류·개수·시각·fresh 가 틀리면 실행 기록 거부', async () => {
  for (const c of [{ outcome: 'auto_pick', count: 1, at: 'x', fresh: true }, { outcome: 'found', count: -1, at: 'x', fresh: true }, { outcome: 'found', count: 1.5, at: 'x', fresh: true }, { outcome: 'found', count: 1, at: 3, fresh: true }, { outcome: 'found', count: 1, at: 'x', fresh: 'yes' }, { outcome: 'found' }]) {
    assert.equal(A.validRun(run({ candidates: c })), false, JSON.stringify(c));
    globalThis.__agentStub.set({ session: session(run()), run: run({ candidates: c }), tool: null });
    await assert.rejects(A.agentRun('u1', 's'), /INVALID_RESPONSE/);
    globalThis.__agentStub.set({ session: session(run({ candidates: c })) });
    assert.equal((await A.agentRescue('u1', 's')).run, null, '대화는 쓰고 실행 기록만 버림');
  }
  assert.equal(A.validRun(run({ candidates: { outcome: 'none', count: 0, at: '2026-10-03T00:00:00Z', fresh: false } })), true);
  assert.equal(A.validRun(run({ candidates: { outcome: 'not_ready', count: null, at: '2026-10-03T00:00:00Z', fresh: true } })), true);
});

// PR #103 Codex Code Review(리뷰 5400588319 · c2e2358) P2 재현 — 서버 목록에 없는 waiting · 단계 status 는 실행 기록 거부
test('Codex P2(리뷰 5400588319) 모르는 waiting · 단계 status 면 실행 기록 거부 · 정상 값은 통과', async () => {
  assert.equal(A.validRun(run({ waiting: 'auto_matched' })), false, 'waiting 은 서버 목록만');
  assert.equal(A.validRun(run({ steps: [{ id: 'tool:candidates', status: 'approved', why: null }] })), false, '단계 status 는 서버 목록만');
  assert.equal(A.validRun(run({ steps: [{ id: 'tool:candidates', status: 'done', why: 3 }] })), false, 'why 는 글자 또는 null');
  globalThis.__agentStub.set({ session: session(run()), run: run({ waiting: 'auto_matched' }), tool: null });
  await assert.rejects(A.agentRun('u1', 's'), /INVALID_RESPONSE/);
  for (const w of [null, 'answer_question', 'lookup_failed', 'user_stopped', 'tool_cooldown']) assert.equal(A.validRun(run({ waiting: w })), true, String(w));
});

// PR #103 Codex Code Review(리뷰 5400827787 · b4531d4) P2 재현 — 저장된 실행 기록이 예산 소진 끝 상태면 다시 실행하지 않음(새로고침·다시 열기 뒤)
test('Codex P2(리뷰 5400827787) 저장된 run 이 waiting=budget 이면 agent_run 0 · 그 상태를 결과로', async () => {
  let runs = 0; let got = null;
  const t = A.createAgentRunTrigger({
    getSession: async () => session(run({ outcome: 'on_hold', waiting: 'budget', next: 'wait', candidates: null })),
    run: async () => { runs++; return { run: run(), tool: null }; },
    onResult: (r) => { got = r; }, onError: (e) => { throw e; },
  });
  await t();
  assert.equal(runs, 0, '예산 소진 끝 상태 = 실행 기록 추가 0');
  assert.equal(got?.waiting, 'budget');
  let runs2 = 0;
  const t2 = A.createAgentRunTrigger({ getSession: async () => session(run()), run: async () => { runs2++; return { run: run(), tool: null }; }, onResult() {}, onError: (e) => { throw e; } });
  await t2(); assert.equal(runs2, 1, '다른 상태는 지금처럼 실행');
});
