// ECHO AI OS 최소 운영형(2026-09-26 대표 CORE IMPLEMENTATION FINAL · END-TO-END PIPELINE) — doit-agent agent.ts v2.0 의 서버 결정 검사.
// 가짜 AI 출력(LLM 후보)을 넣고, 서버가 그 후보를 어떻게 바로잡는지만 본다(실제 AI 품질 판정 아님 · 실제 AI 는 spike run-prod-agent).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const src = readFileSync(new URL('../supabase/functions/doit-agent/agent.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const file = path.join(mkdtempSync(path.join(tmpdir(), 'agent-os-')), 'agent.mjs');
writeFileSync(file, js);
const A = await import(pathToFileURL(file).href);

const out = (kind, { extracted = [], wrong = [], next = { type: 'core', purpose: 'values_character', question: '어떤 사람이 좋아요?' } } = {}) =>
  ({ kind, understood: '', reply: '그렇군요.', extracted, inferred: [], declared: null, wrong, next });
const X = (purpose, note, quote) => ({ purpose, note, quote });
function started() { const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st); return st; }

test('버전: v2.1 · 판 추적(에이전트·프롬프트 해시·서버 규칙·파이프라인)', () => {
  assert.equal(A.AGENT_VERSION, 'echo-agent-v2.1');
  const v = A.versionTrace();
  assert.deepEqual(Object.keys(v), ['agent_version', 'prompt_version', 'policy_version', 'pipeline_version']);
  assert.match(v.prompt_version, /^p-[0-9a-f]{8}$/);
  assert.equal(A.matchingProfile(started()).versions.prompt_version, v.prompt_version);
});

test('말 종류 가드: 실제 AI run 16 실패 문장(이미 말했다는 항의)은 answer 여도 답으로 저장하지 않는다', () => {
  const st = started();
  A.applyTurn(st, '가볍게 우선 사람을 알아가고 싶어', out('answer', { extracted: [X('relationship_intent', '가볍게 알아가기', '가볍게 우선 사람을 알아가고 싶어')] }));
  const r = A.applyTurn(st, '나 진심이라고 적은거 같은데', out('answer', { extracted: [X('values_character', '진심', '진심')] }));
  assert.equal(r.kind, 'repair'); assert.equal(r.saved, false, '항의 문장은 답으로 남지 않는다');
  const t = st.turns.at(-1);
  assert.deepEqual(t.guard, { from: 'answer', to: 'repair', rule: 'past_reference' });
  // 항의 안의 글자는 이번 말에 실제로 있으니 되살리기 규칙(repair)대로 받을 수 있다 — 단 답(raw)으로 통째 저장되지 않는다.
  assert.ok(!st.slots.values_character.items.some((i) => i.source === 'answer_raw'));
});

test('말 종류 가드: 여러 항의·피로·넘기기 모양', () => {
  for (const [text, kind, rule] of [
    ['아까 말했는데', 'repair', 'past_reference'], ['이미 얘기했잖아', 'repair', 'past_reference'], ['왜 또 물어봐?', 'repair', 'past_reference'],
    ['말한 거 같은데', 'repair', 'past_reference'], ['질문이 너무 많아', 'repair', 'fatigue'], ['느낌 근데 질문이 왜케 많아?', 'repair', 'fatigue'],
    ['다음질문으로 넘어가 잘문이 너무 무겁다', 'skip', 'skip_request'], ['이 질문은 패스', 'skip', 'skip_request'],
  ]) assert.deepEqual(A.guardKind(text, 'answer'), { kind, rule }, text);
});

test('말 종류 가드: 실제 답은 건드리지 않는다(과차단 0)', () => {
  for (const text of ['편한 사람', '어른스러운 사람', '말을 예쁘게 하는 사람', '연락은 천천히 하는게 좋아요', '행동으로 보여줄때', '외모도 좀 받쳐줬으묜 해',
    '친구같이 편한사람', '대화가 잘 통하는 사람', '전에 만난 사람은 너무 바빴어', '질문하는 걸 좋아하는 사람', '사람 많은 곳은 싫어']) {
    assert.deepEqual(A.guardKind(text, 'answer'), { kind: 'answer', rule: null }, text);
  }
  assert.deepEqual(A.guardKind('아까 말했는데', 'correction'), { kind: 'correction', rule: null }, 'answer 가 아닌 AI 판단은 그대로(가드는 답 저장 막기 전용)');
});

test('짧은 대답(웅·응·넵)은 답으로 통째 저장하지 않는다', () => {
  for (const w of ['웅', '응', '넵', '응응', '그래']) {
    const st = started();
    const r = A.applyTurn(st, w, out('answer'));
    assert.equal(r.saved, false, w);
  }
});

test('정정 엔진 · 정정 계보: 정정으로 같은 목적의 새 뜻을 받으면 옛 뜻은 SUPERSEDED(이력) · 새 뜻이 ACTIVE · 원문은 남긴다', () => {
  const st = started();
  A.applyTurn(st, '활동적인 사람', out('answer', { extracted: [X('relationship_intent', '활동적인 사람', '활동적인 사람')] }));
  const r = A.applyTurn(st, '아니 활동 말고 편하게 대화하는 사람', out('correction', { extracted: [X('relationship_intent', '편하게 대화하는 사람', '편하게 대화하는 사람')] }));
  assert.equal(r.saved, true);
  const items = st.slots.relationship_intent.items;
  const old = items.find((i) => i.note === '활동적인 사람'); const now = items.find((i) => i.note === '편하게 대화하는 사람');
  assert.equal(old.status, 'SUPERSEDED'); assert.ok(old.superseded_at);
  assert.equal(now.status, 'CONFIRMED'); assert.equal(now.source_type, 'USER_CORRECTED'); assert.deepEqual(now.corrected_from, ['활동적인 사람']);
  assert.equal(st.turns[0].user, '활동적인 사람', '옛 원문은 지우지 않는다');
  assert.equal(st.turns.at(-1).superseded, 1);
  const p = A.matchingProfile(st);
  assert.deepEqual(p.relationship_intent.items.map((i) => i.note), ['편하게 대화하는 사람'], '매칭 프로필은 최신 정정만(ACTIVE)');
  assert.deepEqual(p.relationship_intent.history.map((i) => [i.note, i.status]), [['활동적인 사람', 'SUPERSEDED']], '옛 값은 이력으로');
  const { lines } = A.cleanIntro(st, [{ text: '저는 활동적인 사람이 좋아요.', basis: '활동적인 사람' }]);
  assert.equal(lines.length, 0, '교체된 옛 값은 소개에도 못 쓴다');
});

test('거절 뜻 차단: 거둔 뜻은 소개 초안 문장에 들어가지 못한다(같은 말의 원문 전체를 근거로도 못 씀)', () => {
  const st = started();
  A.applyTurn(st, '조용하고 활동적인 사람', out('answer', { extracted: [X('relationship_intent', '조용한 사람', '조용하고'), X('attraction_comfort', '활동적인 사람', '활동적인 사람')] }));
  A.applyTurn(st, '활동적인 건 아니야', out('correction', { wrong: ['활동적인 사람'] }));
  assert.equal(st.slots.attraction_comfort.items[0].status, 'RETRACTED');
  assert.deepEqual(A.rejectedNotes(st), ['활동적인사람']);
  const { lines, dropped } = A.cleanIntro(st, [
    { text: '저는 활동적인 사람을 좋아해요.', basis: '조용하고 활동적인 사람' },
    { text: '조용한 사람이 편해요.', basis: '조용하고' },
  ]);
  assert.deepEqual(lines.map((l) => l.text), ['조용한 사람이 편해요.']);
  assert.equal((dropped.rejected ?? 0) + (dropped.no_basis ?? 0), 1);
});

test('소개·마무리 AI 입력에 거절 뜻(rejected)이 함께 간다 — 코드 확인', () => {
  assert.match(src, /closingPrompt\(st\.tone\), \{ heard: heardQuoted\(st\), corrections: st\.corrections\.slice\(-3\), rejected: rejectedForAi\(st\) \}/);
  assert.match(src, /introPrompt\(st\.tone\), \{ heard: heardQuoted\(st\), corrections: st\.corrections\.slice\(-3\), rejected: rejectedForAi\(st\) \}/);
});

test('방향 잠금: 다섯 목적 · 핵심 질문 5 뒤 여섯 번째 정보 질문 0', () => {
  const st = started();
  const pids = ['attraction_comfort', 'values_character', 'relationship_style', 'boundaries'];
  A.applyTurn(st, '친구', out('answer', { extracted: [X('relationship_intent', '친구', '친구')], next: { type: 'core', purpose: pids[0], question: 'Q1?' } }));
  for (let k = 0; k < 4; k++) A.applyTurn(st, `답${k}이에요`, out('answer', { extracted: [X(pids[k], `답${k}`, `답${k}`)], next: { type: 'core', purpose: pids[k + 1] ?? 'relationship_intent', question: `Q${k + 2}?` } }));
  assert.equal(A.coreAsked(st).length, 5);
  const r = A.applyTurn(st, '더 있어요', out('answer', { next: { type: 'core', purpose: 'relationship_intent', question: '하나 더?' } }));
  assert.equal(r.question, null); assert.equal(r.finish, true);
});

test('정보 계보: 값마다 출처 종류·출처 턴·사용자 원문·확인 시각 (AI 정리 ≠ 사용자 직접)', () => {
  const st = started();
  A.applyTurn(st, '천천히 알아가는 사람이 좋아', out('answer', { extracted: [X('relationship_intent', '천천히 알아가기', '천천히 알아가는')] }));
  A.applyTurn(st, '어른스러운 사람', out('answer', { next: { type: 'core', purpose: 'relationship_style', question: 'Q?' } }));
  const p = A.matchingProfile(st);
  const ai = p.relationship_intent.items[0];
  assert.equal(ai.source_type, 'AI_EXTRACTED'); assert.equal(ai.source_turn, 1); assert.equal(ai.source_user_text, '천천히 알아가는 사람이 좋아'); assert.ok(ai.confirmed_at);
  const raw = p.values_character.items[0]; // 첫 턴 뒤 지금 질문의 목적(values_character)에 원문 그대로
  assert.equal(raw.source_type, 'USER_DIRECT'); assert.equal(raw.quote, '어른스러운 사람');
});

test('매칭 넘기기: 결정은 서버 · HARD 는 사용자 확인 전 0 · 꼭/피하고 싶은 것은 확인 필요 후보', () => {
  const st = started();
  A.applyTurn(st, '담배 피우는 사람은 싫어', out('answer', { extracted: [X('boundaries', '흡연자 피하고 싶음', '담배 피우는 사람은 싫어')] }));
  const h = A.matchingHandoff(A.matchingProfile(st));
  assert.equal(h.decision, 'SERVER'); assert.deepEqual(h.hard_filters, []); assert.equal(h.hard_candidates.length, 1); assert.deepEqual(h.candidates, []);
});
