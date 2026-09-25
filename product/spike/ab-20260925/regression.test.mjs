// ECHO Failure Intelligence — Regression Suite(2026-09-25). 실제 AI 호출 0.
// 1) 고정 입력·B·A 지문이 사전 고정(FROZEN_INPUTS.json)과 같은지 — 실AI 결과를 본 뒤 몰래 바꾸지 못하게.
// 2) Golden Failure Set 형식 — ACTUAL 은 근거가 있고, 실패 ID 는 Failure Library 에 있다.
// 3) Replay(서버 판정 재생) — 운영 실제 문장으로 A v27 의 알려진 실패가 그대로 재현되는지(특성 검사), B-1.0 의 알려진 한계가 그대로인지.
// 4) 블라인드 집계 — 대표가 고른 것만 센다.
// 실행: NODE_PATH=<typescript·js-tiktoken 폴더> node --test spike/ab-20260925/regression.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { replay } from './replay-decisions.mjs';
import { parseSheet, score, readChoice } from './score-blind.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const sha = (rel) => createHash('sha256').update(readFileSync(path.join(ROOT, rel))).digest('hex');
const frozen = JSON.parse(readFileSync(path.join(HERE, 'FROZEN_INPUTS.json'), 'utf8'));
const golden = JSON.parse(readFileSync(path.join(HERE, 'golden-failures.json'), 'utf8'));
const library = readFileSync(path.join(ROOT, 'docs/failure-intelligence/FAILURE_LIBRARY.md'), 'utf8');

test('사전 고정: A(v27)·B(B-1.0)·Golden 입력 지문이 FROZEN_INPUTS 와 같다', () => {
  assert.equal(sha(frozen.a.file), frozen.a.sha256, 'A 원본이 바뀌었다');
  assert.equal(frozen.a.sha256.slice(0, 8), '1aab6423', 'A 는 운영 v27 승인 지문이어야 한다');
  assert.equal(sha(frozen.b.file), frozen.b.sha256, 'B 가 사전 고정 뒤 바뀌었다 — 바꿨다면 이유를 기록하고 FROZEN_INPUTS 를 함께 갱신');
  assert.equal(sha(frozen.golden.file), frozen.golden.sha256, 'Golden 입력이 바뀌었다');
});

test('Golden Failure Set: ACTUAL 은 근거가 있고 실패 ID 는 Library 에 있다', () => {
  const ids = new Set();
  for (const f of golden.flows) {
    assert.ok(!ids.has(f.id), `흐름 ID 중복 ${f.id}`); ids.add(f.id);
    assert.ok(f.source && f.purpose && f.steps.length, f.id);
    for (const g of f.failures) assert.match(library, new RegExp(`^## ${g} `, 'm'), `${f.id} 의 ${g} 가 FAILURE_LIBRARY.md 에 없다`);
    for (const st of f.steps) {
      assert.match(st.origin, /^(ACTUAL|SYNTHETIC)/, `${f.id} ${st.text}`);
      assert.ok(['answer', 'unsure', 'correction', 'ask', 'repair', 'fatigue'].includes(st.expect), st.expect);
      if (st.origin.startsWith('ACTUAL')) assert.ok(st.source && st.source.length > 10, `ACTUAL 인데 근거 없음: ${st.text}`);
    }
  }
  assert.equal(golden.flows.find((f) => f.id === 'FLOW1').steps.filter((s) => s.origin === 'ACTUAL').length, 7, 'FLOW1 운영 실제 7턴은 그대로');
});

test('Replay — A v27 알려진 실패가 운영 실제 문장으로 재현된다(특성 검사 · 고쳐지면 이 검사를 갱신)', () => {
  const r = replay();
  assert.deepEqual(r.limits, { REPEAT_SIM: 0.6, REPEAT_OVERLAP: 0.7 });
  assert.ok(r.aRepeat.every((a) => !a.blocked), 'GF-01: 같은 뜻 질문 4개를 A 반복 검사가 하나도 막지 못한다');
  assert.equal(Math.max(...r.aRepeat.map((a) => a.max_sim)).toFixed(2), '0.39');
  assert.equal(r.rules.find((x) => x.text === '취미생활?').a_rule, 'meta', 'GF-05: 짧은 물음표 답을 규칙이 되묻기로 강제한다');
  assert.equal(r.complaint_rule, null, 'GF-06: 질문 방향 제안은 규칙이 못 잡고 AI 로 넘어간다');
  assert.equal(r.rules.find((x) => x.text === 'ai가 오타기 날수도 있어?').a_rule, 'meta', 'GF-53: AI 에게 한 질문을 되묻기로 강제한다');
  assert.match(r.askFallback, /DO IT의 AI/, 'GF-06: ask 로 가면 고정 사실문이 나갈 수 있다');
});

test('Replay R4 — 정상 사례 역검사: A 규칙은 분명한 답 26개 중 「취미생활?」 1개를 강제, 애매한 짧은 물음표 8/8 을 되묻기로 강제(특성 검사)', () => {
  const r = replay();
  assert.equal(r.counter.clear.length, 26);
  assert.deepEqual(r.counter.clear.filter((x) => x.a_rule !== null).map((x) => x.text), ['취미생활?']);
  assert.equal(r.counter.ambiguous.filter((x) => x.a_rule === 'meta').length, 8);
});

test('Replay — B-1.0 한계: 의도 이름이 같으면 막고, 다르면 못 막는다(미탐 · 실AI 로만 판정)', () => {
  const r = replay();
  assert.deepEqual(r.bSame.map((x) => x.decision), ['pass', 'answered_intent', 'answered_intent', 'answered_intent']);
  assert.deepEqual(r.bDiff.map((x) => x.decision), ['pass', 'pass', 'pass', 'pass']);
});

test('블라인드 집계: 대표가 고른 것만 세고, 열쇠로 A/B 를 되돌린다', () => {
  assert.equal(readChoice('- 선택: ☐ X가 낫다  ☑ Y가 낫다  ☐ 둘 다 별로다'), 'Y');
  assert.equal(readChoice('- 선택: ☑ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다'), 'X');
  assert.equal(readChoice('- 선택: ☐ X가 낫다  ☐ Y가 낫다  ✔ 둘 다 별로다'), 'BOTH_BAD');
  assert.equal(readChoice('- 선택: ☐ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다'), null);
  assert.equal(readChoice('- 선택: ☑ X가 낫다  ☑ Y가 낫다  ☐ 둘 다 별로다'), 'INVALID');
  assert.equal(readChoice('- 선택: Y'), 'Y');
  const sheet = ['**FLOW1-1** (ACTUAL)', '- 선택: ☑ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다', '**FLOW1-2** (ACTUAL)', '- 선택: ☑ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다',
    '**FLOW4-1** (SYNTHETIC)', '- 선택: ☐ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다'].join('\n');
  const s = score(parseSheet(sheet), [{ flow: 'FLOW1', turn: 1, X: 'B', Y: 'A' }, { flow: 'FLOW1', turn: 2, X: 'B', Y: 'A' }, { flow: 'FLOW4', turn: 1, X: 'A', Y: 'B' }]);
  assert.deepEqual(s.all, { A: 0, B: 2, BOTH_BAD: 0, NONE: 1, INVALID: 0, total: 3 }); // 두 칸 모두 X = B(열쇠) → A/B 를 뒤집으면 잡힌다
  assert.equal(s.actual.total, 2); assert.equal(s.synthetic.NONE, 1);
});
