// Failure Intelligence 자산 검사(AI 호출 0). 실행: node --test product/spike/failure-intelligence/fi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, validate, renderLibrary, renderSolutions, renderGraph, DOCS } from './fi-lib.mjs';
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
