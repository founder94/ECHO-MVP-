// Failure Intelligence 자산 검사(AI 호출 0). 실행: node --test product/spike/failure-intelligence/fi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, validate, validateRuns, renderLibrary, renderSolutions, renderGraph, renderLedger, renderRuns, DOCS } from './fi-lib.mjs';
import { buildRecord, sanitizeStats, verdictOf } from './record-run.mjs';
import { skeleton, compileWithModel, specToGoldenFlow, SPEC_STATUS } from './failure-compiler.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const d = load();

test('데이터 검증 통과 — ID·열거값·근거 파일·Golden·관계 노드', () => {
  assert.deepEqual(validate(d), []);
});

test('생성 문서가 데이터와 같다(손으로 고친 .md 없음)', () => {
  assert.equal(readFileSync(path.join(DOCS, 'FAILURE_LIBRARY.md'), 'utf8'), renderLibrary(d));
  assert.equal(readFileSync(path.join(DOCS, 'FAILED_SOLUTIONS_ARCHIVE.md'), 'utf8'), renderSolutions(d));
  assert.equal(readFileSync(path.join(DOCS, 'FAILURE_GRAPH.md'), 'utf8'), renderGraph(d));
  assert.equal(readFileSync(path.join(DOCS, 'ACTION_LEDGER.md'), 'utf8'), renderLedger(d));
  assert.equal(readFileSync(path.join(DOCS, 'RUNS.md'), 'utf8'), renderRuns(d));
});

// ── 2026-09-26 데이터 자산 분리: 대표 AI 실패(A) · Agent 실패(C)는 실제 사용자 사실이 아니다 ──
test('[A/C 분리] 모든 실패에 dataset · user_fact=false · AI 조언자 실패 = FOUNDER_AI_FAILURE', () => {
  assert.ok(d.failures.every((f) => ['FOUNDER_AI_FAILURE', 'AGENT_FAILURE'].includes(f.dataset)));
  assert.ok(d.failures.every((f) => f.user_fact === false));
  assert.ok(d.failures.filter((f) => f.family === 'F-ADVISOR').every((f) => f.dataset === 'FOUNDER_AI_FAILURE'));
  assert.equal(d.failures.filter((f) => f.dataset === 'FOUNDER_AI_FAILURE').length + d.failures.filter((f) => f.dataset === 'AGENT_FAILURE').length, d.failures.length);
});

test('[A/C 분리] user_fact·Profile·Matching 칸을 true 로 바꾸거나 빼면 검증 실패', () => {
  for (const [k, v] of [['user_fact', true], ['user_fact', undefined], ['usable_for_profile', true], ['usable_for_matching', true]]) {
    for (const ds of ['FOUNDER_AI_FAILURE', 'AGENT_FAILURE']) {
      const c = structuredClone(d); const f = c.failures.find((x) => x.dataset === ds);
      if (v === undefined) delete f[k]; else f[k] = v;
      assert.ok(validate(c).some((e) => e.startsWith(f.id) && e.includes(k)), `${ds} ${k}=${v}`);
    }
  }
  const c = structuredClone(d); c.failures.find((f) => f.family === 'F-ADVISOR').dataset = 'AGENT_FAILURE';
  assert.ok(validate(c).some((e) => /F-ADVISOR/.test(e)));
  const c2 = structuredClone(d); c2.failures.find((f) => f.origin === 'REAL_AI_SCRIPTED').dataset = 'FOUNDER_AI_FAILURE';
  assert.ok(validate(c2).some((e) => /AGENT_FAILURE/.test(e)));
  const c3 = structuredClone(d); c3.failures[0].dataset = 'USER_BEHAVIOR';
  assert.ok(validate(c3).some((e) => /dataset USER_BEHAVIOR/.test(e)));
});

// ── 실제 AI run 영구 기록: 실패 → 재현 → Golden → 실제 AI run → 결과 → 방어 수준 ──
test('[run 기록] 검증 통과 · 실제 AI 표시는 Actions 번호·지표가 있는 run 만 · 지표에 대화 원문(한글) 0', () => {
  assert.deepEqual(validateRuns(d.runs), []);
  assert.ok(d.runs.length >= 31);
  for (const r of d.runs.filter((x) => x.real_ai === 'REAL')) { assert.ok(r.actions_run && r.stats, `run ${r.run}`); assert.equal(r.user_fact, false); }
  const c = structuredClone(d.runs); const r = c.find((x) => x.real_ai === 'REAL'); r.stats = null; r.stats_missing_reason = 'x';
  assert.ok(validateRuns(c).some((e) => /REAL 인데 Actions 번호·지표 없음/.test(e)));
  const c2 = structuredClone(d.runs); const r2 = c2.find((x) => x.stats); r2.stats[Object.keys(r2.stats)[0]].leak = '나 진심이라고 적은거 같은데';
  assert.ok(validateRuns(c2).some((e) => /한글 값/.test(e)));
  const c3 = structuredClone(d.runs); c3[0].user_fact = true;
  assert.ok(validateRuns(c3).some((e) => /user_fact/.test(e)));
});

test('[run 기록] 기록 도구 — 한글 지표 값은 버리고 칸 이름만 · 판정 낱말 해석 · 이력에 없는 run 거절', () => {
  const s = sanitizeStats({ m: { turns: 10, rate: '3/9', say: '안녕하세요', nested: { a: 1 } } });
  assert.deepEqual(s.stats, { m: { turns: 10, rate: '3/9' } });
  assert.deepEqual(s.dropped, ['m.say', 'm.nested']);
  assert.equal(verdictOf('run 13 — 사전 규칙 ③ 미달'), 'FAIL');
  assert.equal(verdictOf('run 12 — 사전 규칙 미충족'), 'FAIL');
  assert.equal(verdictOf('run 11 — 사전 규칙 충족'), 'AUTO_GATE_MET');
  assert.equal(verdictOf('run 21 무효'), 'INVALID');
  assert.equal(verdictOf('echo-agent-v1.2'), 'SEE_REF');
  assert.throws(() => buildRecord(9999), /이력에 없다/);
  const mock = buildRecord(31, { result: { mode: '[MOCK] 가짜 AI', models: ['m'], frozen_ok: true, stats: { m: { turns: 1 } } }, job: { actions_run: 36240304626 } });
  assert.equal(mock.real_ai, 'MOCK', '가짜 AI 결과는 REAL 로 기록되지 않는다');
});

test('[실AI 승격] REAL_AI_VERIFIED 는 근거 파일 + 연결된 실제 run(REAL · 사전 등록 일치) 둘 다 있어야', () => {
  const real = d.runs.find((r) => r.real_ai === 'REAL' && r.frozen_ok === true);
  const c = structuredClone(d); const f = c.failures[0];
  f.defense_level = 'REAL_AI_VERIFIED'; f.verification = { real_ai_ref: 'docs/failure-intelligence/RUNS.md' };
  assert.ok(validate(c).some((e) => /연결된 실제 AI run/.test(e)), 'run 연결 없음');
  f.real_ai_runs = [real.run];
  assert.ok(!validate(c).some((e) => e.startsWith(f.id) && /실제 AI run|실제 검증 근거/.test(e)), 'run 연결 + 근거 = 통과');
  const c2 = structuredClone(d); c2.failures[0].real_ai_runs = [9999];
  assert.ok(validate(c2).some((e) => /run 9999 기록 파일 없음/.test(e)));
  const mockRun = d.runs.find((r) => r.real_ai !== 'REAL');
  const c3 = structuredClone(d); Object.assign(c3.failures[0], { defense_level: 'REAL_AI_VERIFIED', verification: { real_ai_ref: 'docs/failure-intelligence/RUNS.md' }, real_ai_runs: [mockRun.run] });
  assert.ok(validate(c3).some((e) => /연결된 실제 AI run/.test(e)), '실제 AI 가 아닌 run 으로는 승격 불가');
});

test('증거 없는 승격 금지 — 실AI·실사용자 근거 없이 REAL_AI_VERIFIED·USER_VERIFIED·VERIFIED 불가', () => {
  const clone = structuredClone(d);
  clone.failures[0].defense_level = 'REAL_AI_VERIFIED';
  assert.ok(validate(clone).some((e) => /실제 검증 근거 파일 없음/.test(e)));
  const c2 = structuredClone(d); c2.failures[0].status = 'VERIFIED';
  assert.ok(validate(c2).some((e) => /VERIFIED 는 실제 AI 검증 뒤에만/.test(e)));
  const c3 = structuredClone(d); c3.failures[0].user_harm.material = '';
  assert.ok(validate(c3).some((e) => /사용자 피해 material/.test(e)));
  const c4 = structuredClone(d); c4.graph.edges[0].evidence = 'PROBABLY';
  assert.ok(validate(c4).some((e) => /증거 PROBABLY/.test(e)));
  const c5 = structuredClone(d); c5.failures[0].refs = ['docs/없는파일.md'];
  assert.ok(validate(c5).some((e) => /근거 파일 없음/.test(e)));
});

test('행동 장부 — 대표가 완료한 키 발급·전달은 COMPLETED, 폐기·새 발급 요구 금지는 DECIDED, 채팅 Secret 실행은 BLOCKED', () => {
  const st = (id) => d.ledger.find((a) => a.id === id)?.state;
  assert.equal(st('A-01'), 'COMPLETED'); assert.equal(st('A-02'), 'COMPLETED'); assert.equal(st('A-03'), 'DECIDED'); assert.equal(st('B-01'), 'BLOCKED'); assert.equal(st('B-02'), 'BLOCKED');
  const c = structuredClone(d); c.ledger[0].state = 'DONE';
  assert.ok(validate(c).some((e) => /상태 DONE/.test(e)));
  const c2 = structuredClone(d); const g = c2.failures.find((f) => f.origin === 'FOUNDER_STATEMENT'); g.evidence_level = 'ACTUAL';
  assert.ok(validate(c2).some((e) => /대표 진술만으로는 ACTUAL/.test(e)));
});

test('현재 VERIFIED·실AI 검증 = 0 (실AI 가 막혀 있다)', () => {
  assert.equal(d.failures.filter((f) => ['REAL_AI_VERIFIED', 'USER_VERIFIED'].includes(f.defense_level) || f.status === 'VERIFIED').length, 0);
});

const transcript = [
  { role: 'ai', text: '사람을 알아가는 데 어떤 점이 가장 중요하다고 생각해요?' }, { role: 'user', text: '행동으로 보여줄때' },
  { role: 'ai', text: '진심으로 사람을 알아가는 데 어떤 점이 특별하다고 느끼나요?' }, { role: 'user', text: '몇번째 같은말이야!!' },
];
const description = '내가 행동이라고 했는데 또 같은 걸 물어봤어.';

test('[Compiler · AI 없음] 뼈대: 재생 입력 = 대화 기록의 사용자 말 · 항상 사람 승인 필요', () => {
  const s = skeleton({ description, transcript, date: '2026-09-25', source: '운영 로그' });
  assert.equal(s.status, SPEC_STATUS);
  assert.deepEqual(s.replay_input.map((x) => x.text), ['행동으로 보여줄때', '몇번째 같은말이야!!']);
  assert.equal(s.origin, 'ACTUAL');
  const noLog = skeleton({ description });
  assert.equal(noLog.origin, 'FOUNDER_STATEMENT');
  assert.ok(noLog.notes.some((n) => /NO_REPLAY_INPUT/.test(n)));
});

test('[Compiler · MOCK] 모델이 지어낸 인용·체계 밖 유형·Layer·턴은 서버가 걸러 notes 에 남긴다', async () => {
  const llm = async () => JSON.stringify({ types: ['질문의도 반복', '멍청함'], layers: ['Context', 'Magic'],
    evidence: [{ quote: '행동으로 보여줄때', where: 'transcript' }, { quote: '사용자가 화가 났다', where: 'transcript' }],
    affected_turn: 9, expected_behavior: '이미 들은 「행동」을 짚고 같은 뜻을 묻지 않기', violated_principle: '이미 물은 뜻을 다시 요구하지 않는다',
    root_cause_candidates: [{ layer: 'Orchestration', hypothesis: '반복 검사가 글자쌍뿐' }, { layer: 'Vibes', hypothesis: 'x' }], pass_criteria: 'a', fail_criteria: 'b', counter_test: 'c' });
  const s = await compileWithModel({ description, transcript, date: '2026-09-25', source: '운영 로그' }, llm);
  assert.equal(s.status, SPEC_STATUS);
  assert.deepEqual(s.types, ['질문의도 반복']); assert.deepEqual(s.layers, ['Context']);
  assert.deepEqual(s.evidence.map((e) => e.quote), ['행동으로 보여줄때']);
  assert.equal(s.affected_turn, null);
  assert.ok(s.root_cause_candidates.every((r) => r.evidence === 'HYPOTHESIS'));
  for (const tag of ['DROPPED_EVIDENCE', 'DROPPED_TYPE', 'DROPPED_LAYER', 'DROPPED_TURN', 'DROPPED_CAUSE']) assert.ok(s.notes.some((n) => n.startsWith(tag)), tag);
  assert.deepEqual(s.replay_input.map((x) => x.text), ['행동으로 보여줄때', '몇번째 같은말이야!!'], '재생 입력은 모델이 아니라 대화 기록에서');
});

test('[Compiler · MOCK] 모델 실패·형식 오류면 뼈대만 남기고 이유를 적는다', async () => {
  const bad = await compileWithModel({ description, transcript }, async () => 'not json');
  assert.ok(bad.notes.some((n) => /MODEL_PARSE_ERROR/.test(n))); assert.equal(bad.status, SPEC_STATUS);
  const err = await compileWithModel({ description, transcript }, async () => { throw new Error('x'); });
  assert.ok(err.notes.some((n) => /MODEL_ERROR/.test(n)));
});

test('[Compiler] 승인자 없이 Golden 으로 옮기지 않는다', () => {
  const s = skeleton({ description, transcript, source: '운영 로그' });
  assert.throws(() => specToGoldenFlow(s, { id: 'FLOW9', purpose: 'x', failureId: 'GF-01' }), /HUMAN_APPROVAL_REQUIRED/);
  const g = specToGoldenFlow(s, { id: 'FLOW9', purpose: 'x', failureId: 'GF-01', approvedBy: '대표' });
  assert.equal(g.steps.length, 2); assert.equal(g.steps[0].origin, 'ACTUAL');
});
