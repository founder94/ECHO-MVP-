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
