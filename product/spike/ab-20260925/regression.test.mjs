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
  assert.equal(sha(frozen.specs.file), frozen.specs.sha256, 'Golden 판정 기준이 바뀌었다');
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

test('Golden 판정 기준: 모든 spec 의 Flow·턴이 고정 입력에 있고, 실패 ID 는 Library 에 있다 · 판정 종류는 정해진 것만', async () => {
  const specs = JSON.parse(readFileSync(path.join(HERE, 'golden-specs.json'), 'utf8'));
  for (const s of specs.specs) {
    const f = golden.flows.find((x) => x.id === s.flow); assert.ok(f, s.flow);
    for (const t of s.turns) assert.ok(t >= 1 && t <= f.steps.length, `${s.fail_id} ${s.flow}#${t}`);
    assert.match(library, new RegExp(`^## ${s.fail_id} `, 'm'), s.fail_id);
    for (const c of s.checks) assert.ok(specs.check_types[c], c);
    assert.ok(s.expected && s.forbidden && s.source, s.fail_id);
  }
  const { checkRow } = await import('./harness-lib.mjs');
  const fixedLines = specs.fixed_lines;
  assert.equal(checkRow({ saved: true }, 'saved', { real: true, fixedLines }), 'PASS');
  assert.equal(checkRow({ saved: true }, 'not_saved', { real: true, fixedLines }), 'FAIL');
  assert.equal(checkRow({ error: 'QUESTION_FAILED' }, 'no_error', { real: true, fixedLines }), 'FAIL');
  assert.equal(checkRow({ reply: '' }, 'reply_present', { real: true, fixedLines }), 'FAIL');
  assert.equal(checkRow({ reply: '저는 DO IT의 AI예요. 답을 듣고 다음 질문을 골라요.' }, 'no_fixed_line', { real: true, fixedLines }), 'FAIL');
  assert.equal(checkRow({ reply: '' }, 'reply_present', { real: false, fixedLines }), 'N/A(MOCK)', 'MOCK 에서는 모델 층을 판정하지 않는다');
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

// GF-63(2026-09-25, 내 실수): runA 의 error 칸이 줄 주석 안에 들어가 A 의 질문 실패·오류가 한 번도 기록되지 않았다(실AI run1 에서 발견).
test('하네스: A 의 질문 실패·오류가 행에 기록된다(GF-63 역검사)', async () => {
  const { runA, GOLDEN } = await import('./harness-lib.mjs');
  const flow = { ...GOLDEN.find((f) => f.id === 'FLOW1'), steps: GOLDEN.find((f) => f.id === 'FLOW1').steps.slice(0, 2) };
  // [MOCK] 질문 후보를 늘 비워 내는 가짜 AI → A 는 질문을 만들지 못한다.
  const noQuestion = (type) => () => JSON.stringify({ turn_type: type === 'repair' ? 'complaint' : type, correction_rest: '', interesting_clue: '', acknowledgement: '', answer_to_user: '', next_question: '', memory_candidates: [], confidence: 0.5, reason: 'mock' });
  const rows = await runA(flow, { mock: noQuestion });
  for (const r of rows) assert.ok(Object.hasOwn(r, 'error'), 'error 칸이 있어야 한다');
  assert.ok(rows.some((r) => r.error), `질문을 못 만든 턴이 오류로 기록돼야 한다: ${JSON.stringify(rows.map((r) => [r.kind, r.question, r.error]))}`);
  const ok = await runA(flow);
  assert.ok(ok.every((r) => r.error === null), '정상 [MOCK] 경로는 오류 0');
});

test('run1 검수표 재생성: 결과표를 그대로 읽고, 봉한 열쇠로 집계가 A/B 를 되돌린다', async () => {
  const { parseResult, outputs } = await import('./blind-from-result.mjs');
  const md = readFileSync(path.join(HERE, '../../../docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/result.md'), 'utf8');
  const flows = parseResult(md);
  assert.equal(flows.reduce((n, f) => n + f.rows.length, 0), 34);
  const f1 = outputs(flows.find((f) => f.id === 'FLOW1'));
  assert.match(f1[2].A, /다음 질문을 만들지 못함/); // FLOW1#3 A 질문 실패(GF-63 보정)
  assert.match(f1[4].A, /대화 끝/); assert.match(f1[4].B, /대화 끝/); // 다섯 답
  const sealed = JSON.parse(readFileSync(path.join(HERE, '../../../docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/blind-key.sealed.json'), 'utf8'));
  const key = JSON.parse(Buffer.from(sealed.sealed, 'base64').toString('utf8'));
  assert.equal(key.length, 34);
  const sheet = readFileSync(path.join(HERE, '../../../docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925/BLIND_검수표_run1.md'), 'utf8');
  const items = parseSheet(sheet);
  assert.equal(items.length, 34);
  assert.ok(items.every((i) => i.choice === null), '대표 검수 전: 선택 0');
  const k0 = key[0]; const picked = items.map((i, n) => ({ ...i, choice: n === 0 ? 'X' : null }));
  const s = score(picked, key); assert.equal(s.all[k0.X], 1); assert.equal(s.all.NONE, 33);
});

test('P0 블라인드(run1): 17칸 · 두 답이 같은 칸 제외 · 페이지에 A/B 정체 없음 · 봉한 열쇠 17', async () => {
  const { buildP0 } = await import('./p0-blind.mjs');
  const E = path.join(HERE, '../../../docs/failure-intelligence/evidence/REAL_AB_RUN1_20260925');
  const { items, noDiff } = buildP0(readFileSync(path.join(E, 'result.md'), 'utf8'), () => false);
  assert.equal(items.length, 17);
  assert.deepEqual(noDiff.map((x) => x.text), ['몇번째 같은말이야!!', '행동이라고!!']);
  for (const x of noDiff) assert.deepEqual(x.A, { ...x.B, before: x.A.before }, '제외 칸은 두 답이 같아야 한다');
  const page = readFileSync(path.join(E, 'p0-blind-review.html'), 'utf8');
  assert.ok(!/_key|"flow"|"turn"/.test(page), '페이지에 열쇠·흐름 번호가 없어야 한다');
  const key = JSON.parse(Buffer.from(JSON.parse(readFileSync(path.join(E, 'p0-blind-key.sealed.json'), 'utf8')).sealed, 'base64').toString('utf8'));
  assert.equal(key.length, 17);
  assert.ok(key.every((k) => ['A', 'B'].includes(k.X) && k.X !== k.Y));
});

test('MODEL GATE 실행기: [MOCK] 모델 4개 · 사전 등록 목록과 다르면 실AI 로 돌지 않음(종료 3) · 키 없으면 종료 2', async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const script = path.join(HERE, 'run-models.mjs');
  const env = { ...process.env, OPENAI_API_KEY: '' };
  const frozen = JSON.parse(readFileSync(path.join(HERE, 'FROZEN_INPUTS.json'), 'utf8'));
  assert.deepEqual(frozen.model_gate.models, ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o']);
  assert.equal(frozen.model_gate.fixed.b_sha256, frozen.b.sha256);
  const out = execFileSync(process.execPath, [script, '--models', frozen.model_gate.models.join(',')], { env, encoding: 'utf8' });
  assert.match(out, /사전 등록 일치: 예/);
  assert.equal(spawnSync(process.execPath, [script, '--models', frozen.model_gate.models.join(','), '--require-real'], { env }).status, 2);
  // 가짜 키: 사전 등록과 다른 목록이면 네트워크 전에 종료 3
  const r = spawnSync(process.execPath, [script, '--models', 'gpt-4o-mini,gpt-4.1'], { env: { ...process.env, OPENAI_API_KEY: 'not-a-real-key' } });
  assert.equal(r.status, 3);
});

test('MODEL GATE 검수표: 옮긴 결과표를 그대로 읽음(4 모델·34턴) · 페이지에 모델 이름 없음 · 봉한 열쇠 17칸 모두 4개 순서', async () => {
  const { parseModelsMd } = await import('./model-blind.mjs');
  const E = path.join(HERE, '../../../docs/failure-intelligence/evidence/MODEL_GATE_20260925');
  const slim = parseModelsMd(readFileSync(path.join(E, 'models-result.md'), 'utf8'));
  assert.deepEqual(Object.keys(slim), ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o']);
  for (const m of Object.keys(slim)) assert.equal(slim[m].flat().length, 34);
  assert.deepEqual(JSON.parse(readFileSync(path.join(E, 'models-slim.json'), 'utf8')), slim);
  const page = readFileSync(path.join(E, 'model-blind-review.html'), 'utf8');
  assert.ok(!/gpt-|"order"|"flow"/.test(page), '페이지에 모델 이름·열쇠가 없어야 한다');
  const key = JSON.parse(Buffer.from(JSON.parse(readFileSync(path.join(E, 'model-blind-key.sealed.json'), 'utf8')).sealed, 'base64').toString('utf8'));
  assert.equal(key.length, 17);
  assert.ok(key.every((k) => [...k.order].sort().join() === Object.keys(slim).sort().join()));
});

test('MODEL GATE 블라인드 집계: 대표 선택 원본 17개 + 봉한 열쇠 → 기록된 숫자와 같음 · 알 수 없는 선택은 오류', async () => {
  const { load, score } = await import('./model-blind-score.mjs');
  const E = path.join(HERE, '../../../docs/failure-intelligence/evidence/MODEL_GATE_20260925');
  const r = load(path.join(E, 'model-picks'), path.join(E, 'model-blind-key.sealed.json'));
  assert.equal(r.n, 17); assert.equal(r.n_actual, 14);
  assert.deepEqual(r.all, { 'gpt-4.1': 4, 'gpt-4.1-mini': 5, 'gpt-4o': 3, 'gpt-4o-mini': 2, '모두 별로': 3 });
  assert.deepEqual(r.actual, { 'gpt-4.1': 2, 'gpt-4.1-mini': 5, 'gpt-4o': 2, 'gpt-4o-mini': 2, '모두 별로': 3 });
  assert.deepEqual(JSON.parse(readFileSync(path.join(E, 'model-blind-score.json'), 'utf8')), r);
  const key = [{ id: 'M01', flow: 'FLOW1', turn: 2, order: ['a', 'b'] }];
  assert.throws(() => score(key, { M01: { choice: '⑨' } }));
  assert.throws(() => score(key, {}));
  assert.equal(score(key, { M01: { choice: '②' } }).rows[0].winner, 'b');
});
