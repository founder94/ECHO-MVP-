// 2026-10-03 대표 「당일 구현 마감」 — Agent 실행 기록(run.ts) 순수 함수 검사. DB·AI·네트워크 0.
// 실제 index.ts 흐름(대표 시나리오 · 도구 실행 · 늦은 결과 · 중단/재개 · 대화 상한)은 qa/agent-server.test.mjs 「RUN …」.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { AGENT_DEP, AGENT_DEP_URL } from './agent-deps.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'run-'));
const here = (p) => new URL(p, import.meta.url).pathname;
const emit = (file, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(AGENT_DEP, AGENT_DEP_URL).replace('"./agent.ts"', '"./agent.mjs"')); return pathToFileURL(f).href; };
emit(here('../supabase/functions/doit-agent/matching.ts'), 'matching.mjs');
const A = await import(emit(here('../supabase/functions/doit-agent/agent.ts'), 'agent.mjs'));
const R = await import(emit(here('../supabase/functions/doit-agent/run.ts'), 'run.mjs'));
const SRC = readFileSync(here('../supabase/functions/doit-agent/run.ts'), 'utf8');

const NOW = '2026-10-03T00:00:00.000Z';
// 사용자 출처 확정 칸을 직접 만든다(대화 규칙 검사는 agent 검사들이 맡는다)
const confirm = (st, id, note, turn) => { st.slots[id].status = 'CONFIRMED'; st.slots[id].items.push({ note, quote: note, turn, source: 'answer_raw', status: 'CONFIRMED', source_type: 'USER_DIRECT' }); };
const readyState = () => { const st = A.newState({ goal: 'romantic' }); confirm(st, 'relationship_intent', '진지한 연애', 1); confirm(st, 'relationship_style', '천천히', 2); confirm(st, 'boundaries', '거짓말 싫음', 3); st.turns.push({ n: 3, ai: 'q', user: 'a', kind: 'answer', question_purpose: null, question_type: null }); st.phase = 'done'; return st; };
const step = (run, id) => run.steps.find((s) => s.id === id);

test('계획: 대화 중 = 질문 기다림 · 끝난 칸만 done(근거 턴) · 도구는 대화가 끝날 때까지 대기', () => {
  const st = A.newState({ goal: 'friend' }); confirm(st, 'relationship_intent', '편한 친구', 1);
  const run = R.syncRun(null, st, NOW);
  assert.equal(run.goal, 'friend'); assert.equal(run.outcome, 'needs_user'); assert.equal(run.waiting, 'answer_question');
  assert.deepEqual([step(run, 'understand:relationship_intent').status, step(run, 'understand:relationship_intent').basis], ['done', [1]], '칸 단위 done = 준비 판정(ready_areas)과 같은 규칙 · 근거 턴');
  assert.equal(step(run, 'understand:attraction_comfort').status, 'todo');
  assert.equal(step(run, 'tool:candidates').status, 'waiting');
  const st2 = readyState(); st2.phase = 'talk';
  const r2 = R.syncRun(null, st2, NOW);
  assert.deepEqual(step(r2, 'understand:boundaries'), { id: 'understand:boundaries', status: 'done', basis: [3], why: null, rev: 1 });
});

test('재계획은 바뀐 단계만: 같은 상태로 다시 맞추면 판(plan_rev) 그대로 · 바뀐 단계만 rev 올라감 · 바뀐 이유 기록', () => {
  const st = readyState();
  const r1 = R.syncRun(null, st, NOW);
  const r2 = R.syncRun(r1, st, NOW);
  assert.equal(r2.plan_rev, r1.plan_rev, '변화 없음 → 계획 다시 만들지 않음');
  st.slots.boundaries.items[0].status = 'RETRACTED'; st.slots.boundaries.items[0].rejected_at = NOW;
  const r3 = R.syncRun(r2, st, NOW);
  assert.equal(r3.plan_rev, r2.plan_rev + 1);
  assert.equal(step(r3, 'understand:boundaries').status, 'invalid'); assert.equal(step(r3, 'understand:boundaries').why, 'corrected');
  assert.equal(step(r3, 'understand:relationship_intent').rev, step(r2, 'understand:relationship_intent').rev, '안 바뀐 단계는 rev 그대로');
  assert.ok(r3.changes.some((c) => c.includes('understand:boundaries:done>invalid')));
  assert.equal(r3.outcome, 'needs_user'); assert.equal(r3.waiting, 'more_info'); assert.ok(r3.missing.includes('boundaries'));
});

test('도구 결과는 그 확정 정보에 묶임: 확정 정보가 바뀌면 결과 무효 → 다시 실행할 차례', () => {
  const st = readyState();
  let run = R.syncRun(null, st, NOW);
  assert.equal(run.outcome, 'in_progress'); assert.deepEqual(R.dueTool(run, Date.parse(NOW)), { tool: 'candidates', why: null });
  run = R.recordTool(run, st, { tool: 'candidates', outcome: 'none', count: 0, missing: [], code: null, at: NOW, ms: 5 }, NOW);
  assert.equal(run.outcome, 'on_hold'); assert.equal(run.waiting, 'no_candidates_yet'); assert.equal(R.dueTool(run, Date.parse(NOW)).tool, null);
  confirm(st, 'values_character', '솔직함', 4);
  run = R.syncRun(run, st, NOW);
  assert.equal(step(run, 'tool:candidates').status, 'invalid'); assert.equal(run.outcome, 'in_progress');
  assert.ok(run.changes.some((c) => c.endsWith('basis_changed')));
  run = R.recordTool(run, st, { tool: 'candidates', outcome: 'found', count: 3, missing: [], code: null, at: NOW, ms: 5 }, NOW);
  assert.equal(run.outcome, 'done'); assert.equal(R.runView(run).next, 'open_candidates'); assert.equal(R.runView(run).candidates.fresh, true);
});

test('결과 구분: 없음(보류) ≠ 조회 실패(보류·재시도) ≠ 준비 부족(질문) · 실패 직후 쉬기 · 도구 실행 상한', () => {
  const st = readyState();
  let run = R.syncRun(null, st, NOW);
  run = R.recordTool(run, st, { tool: 'candidates', outcome: 'failed', count: null, missing: [], code: 'timeout', at: NOW, ms: 10000 }, NOW);
  assert.deepEqual([run.outcome, run.waiting], ['on_hold', 'lookup_failed']);
  assert.deepEqual(R.dueTool(run, Date.parse(NOW) + 5_000), { tool: null, why: 'tool_cooldown' });
  assert.deepEqual(R.dueTool(run, Date.parse(NOW) + 31_000), { tool: 'candidates', why: null });
  const nr = R.recordTool(run, st, { tool: 'candidates', outcome: 'not_ready', count: null, missing: ['photo'], code: null, at: NOW, ms: 5 }, NOW);
  assert.deepEqual([nr.outcome, nr.waiting, nr.missing], ['needs_user', 'profile_incomplete', ['photo']]);
  const capped = structuredClone(run); capped.budget.tool_runs = R.RUN_LIMITS.max_tool_runs;
  assert.deepEqual(R.dueTool(capped, Date.parse(NOW) + 60_000), { tool: null, why: 'budget' });
});

test('연결 서버 응답 → 도구 결과: 개수·부족 코드만 · 모양이 틀리면 실패(성공 주장 0)', () => {
  assert.deepEqual(R.candidatesOutcome(200, { ok: true, eligible: true, candidates: [{ id: 'secret', reasons: ['이유'] }] }), { outcome: 'found', count: 1, missing: [], code: null });
  assert.deepEqual(R.candidatesOutcome(200, { ok: true, eligible: true, candidates: [] }), { outcome: 'none', count: 0, missing: [], code: null });
  assert.deepEqual(R.candidatesOutcome(200, { ok: true, eligible: false, missing: ['photo', 7, 'intro_confirmed'] }), { outcome: 'not_ready', count: null, missing: ['photo', 'intro_confirmed'], code: null });
  assert.equal(R.candidatesOutcome(200, { ok: true, eligible: true }).outcome, 'failed', '후보 목록 없음 = 실패(없음으로 치지 않음)');
  assert.deepEqual(R.candidatesOutcome(401, { ok: false, code: 'UNAUTHORIZED' }), { outcome: 'failed', count: null, missing: [], code: 'http_401:UNAUTHORIZED' });
  assert.equal(R.candidatesOutcome(200, null).outcome, 'failed');
});

test('중단·재개: 「그만」으로 끝나면 도구 0 · 사용자 재개 뒤 같은 턴으로 다시 멈추지 않음', () => {
  const st = readyState(); st.turns.push({ n: 4, ai: 'q', user: '그만할래', kind: 'stop', question_purpose: null, question_type: null });
  let run = R.syncRun(null, st, NOW);
  assert.deepEqual([run.outcome, run.waiting], ['stopped', 'user_stopped']); assert.equal(R.dueTool(run, Date.parse(NOW)).tool, null);
  run = R.resumeRun(run, st, NOW);
  assert.equal(run.outcome, 'in_progress'); assert.equal(R.syncRun(run, st, NOW).outcome, 'in_progress');
});

test('대화 단위 비용 상한 · 실행 기록에 원문·후보 정보 0 · 허용 도구 목록 고정', () => {
  const st = readyState();
  assert.deepEqual([R.RUN_LIMITS.max_calls, R.RUN_LIMITS.max_tokens], [60, 150_000], 'QA 실측 근거 값(문서 §23)');
  const run = R.syncRun(null, st, NOW, { calls: R.RUN_LIMITS.max_calls - 1, tokens_in: 10, tokens_out: 10 });
  assert.equal(R.modelAllowed(run), true);
  const over = R.syncRun(run, st, NOW, { calls: 1 });
  assert.equal(R.modelAllowed(over), false); assert.deepEqual([over.outcome, over.waiting], ['on_hold', 'budget']);
  assert.equal(R.modelAllowed(R.syncRun(null, st, NOW, { tokens_in: R.RUN_LIMITS.max_tokens })), false);
  const view = JSON.stringify(R.runView(R.recordTool(R.syncRun(null, st, NOW), st, { tool: 'candidates', outcome: 'found', count: 1, missing: [], code: null, at: NOW, ms: 1 }, NOW)));
  for (const raw of ['진지한 연애', '천천히', '거짓말 싫음']) assert.ok(!view.includes(raw), raw);
  assert.deepEqual([...R.TOOLS], ['readiness', 'candidates']);
  assert.ok(!/fetch\(|Deno\.|createClient|llm\(/.test(SRC), 'run.ts 는 네트워크·DB·모델을 부르지 않음');
});

// PR #103 Codex Code Review(리뷰 5399945942 · d68c3cf) P1 「Re-query nonterminal candidate outcomes」 재현
test('Codex P1 아직 없음·준비 부족은 확정 정보가 그대로여도 시간이 지나면 다시 조회(대화 밖 사정이 바뀜) · 찾음은 그대로', () => {
  const st = readyState();
  const at = (ms) => new Date(Date.parse(NOW) + ms).toISOString();
  let run = R.recordTool(R.syncRun(null, st, NOW), st, { tool: 'candidates', outcome: 'none', count: 0, missing: [], code: null, at: NOW, ms: 5 }, NOW);
  assert.equal(R.dueTool(R.syncRun(run, st, at(60_000)), Date.parse(at(60_000))).tool, null, '바로는 다시 안 부름');
  const later = R.syncRun(run, st, at(R.RUN_LIMITS.none_refresh_after_ms));
  assert.deepEqual([later.outcome, R.dueTool(later, Date.parse(at(R.RUN_LIMITS.none_refresh_after_ms))).tool], ['in_progress', 'candidates'], '아직 없음 → 시간이 지나면 다시 조회');
  run = R.recordTool(R.syncRun(null, st, NOW), st, { tool: 'candidates', outcome: 'not_ready', count: null, missing: ['photo'], code: null, at: NOW, ms: 5 }, NOW);
  const fixed = R.syncRun(run, st, at(R.RUN_LIMITS.not_ready_refresh_after_ms));
  assert.equal(R.dueTool(fixed, Date.parse(at(R.RUN_LIMITS.not_ready_refresh_after_ms))).tool, 'candidates', '사진을 채운 뒤 → 다시 조회');
  run = R.recordTool(R.syncRun(null, st, NOW), st, { tool: 'candidates', outcome: 'found', count: 2, missing: [], code: null, at: NOW, ms: 5 }, NOW);
  assert.equal(R.dueTool(R.syncRun(run, st, at(86_400_000)), Date.parse(at(86_400_000))).tool, null, '찾음은 다시 조회 0(사용자가 고를 차례)');
});
test('Codex P2 도구 실행 상한에 닿으면 저장·응답 상태도 「예산으로 보류」(다시 조회·재시도를 보여 주지 않음)', () => {
  const st = readyState();
  const at = (ms) => new Date(Date.parse(NOW) + ms).toISOString();
  let run = R.recordTool(R.syncRun(null, st, NOW), st, { tool: 'candidates', outcome: 'none', count: 0, missing: [], code: null, at: NOW, ms: 5 }, NOW);
  run.budget.tool_runs = R.RUN_LIMITS.max_tool_runs;
  const later = R.syncRun(run, st, at(R.RUN_LIMITS.none_refresh_after_ms));
  assert.deepEqual([later.outcome, later.waiting, R.runView(later).next], ['on_hold', 'budget', 'wait']);
  let f = R.recordTool(R.syncRun(null, st, NOW), st, { tool: 'candidates', outcome: 'failed', count: null, missing: [], code: 'timeout', at: NOW, ms: 5 }, NOW);
  f.budget.tool_runs = R.RUN_LIMITS.max_tool_runs; f = R.syncRun(f, st, at(60_000));
  assert.deepEqual([f.outcome, f.waiting, R.runView(f).next], ['on_hold', 'budget', 'wait'], '조회 실패 뒤에도 「다시 시도」 대신 예산 보류');
});

// 리뷰 5401173116(7255265) P2 재현 — eligible 이 참/거짓이 아닌 200 응답은 not_ready 가 아니라 failed(다시 시도할 조회 실패)
test('Codex P2(리뷰 5401173116) eligible 칸이 없거나 참/거짓이 아니면 failed · false 일 때만 not_ready', () => {
  for (const body of [{ ok: true }, { ok: true, eligible: 'no' }, { ok: true, eligible: null, candidates: [] }]) {
    const r = R.candidatesOutcome(200, body);
    assert.equal(r.outcome, 'failed', JSON.stringify(body)); assert.equal(r.code, 'bad_shape');
  }
  assert.equal(R.candidatesOutcome(200, { ok: true, eligible: false, missing: ['photo'] }).outcome, 'not_ready');
  assert.equal(R.candidatesOutcome(200, { ok: true, eligible: true, candidates: [] }).outcome, 'none');
});
