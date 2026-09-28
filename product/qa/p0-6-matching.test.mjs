// 출시 차단 P0-6(2026-09-27 대표 「P0-6 최소 수정 승인」) — ECHO Agent 가 확정한 지금 상태가 매칭 재료까지 끊기지 않는가.
// 실제 운영 agent.ts(v2.2.1) 로 상태를 만들고 → matchingProfile → doit-connect agentSource(MATCH_SOURCE=agent 경로의 재료 함수)로 넘긴다. DB·AI 호출 0.
// 실행: node --test qa/p0-6-matching.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'p06-'));
const emit = (src, out, fix = (x) => x) => { const f = path.join(dir, out); writeFileSync(f, fix(ts.transpileModule(readFileSync(new URL(src, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)); return pathToFileURL(f).href; };
const A = await import(emit('../supabase/functions/doit-agent/agent.ts', 'agent.mjs'));
emit('../supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const M = await import(emit('../supabase/functions/doit-connect/agentSource.ts', 'agentSource.mjs', (x) => x.replace('"../doit-agent/matching.ts"', '"./matching.mjs"')));

const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '네.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const X = (purpose, note, quote) => ({ purpose, note, quote });
function base() {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요. 매일 연락하는 게 좋아요. 약속 잘 지키는 사람', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남'), X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요'), X('values_character', '약속을 지키는 사람', '약속 잘 지키는 사람')], inferred: [{ trait: '외향적인 편', basis: '만남' }] }));
  return st;
}
const done = (st) => { st.phase = 'done'; st.current = null; return st; };
const src = (st) => M.sourceFromProfile(A.matchingProfile(st), st.phase, null);
const has = (s, t) => s.confirmed.some((n) => n.includes(t));

test('T7 Agent 확정 값 → 매칭 재료에 들어간다', () => {
  const s = src(done(base()));
  assert.ok(has(s, '친구 같은 만남') && has(s, '약속을 지키는 사람') && has(s, '매일 연락'), JSON.stringify(s.confirmed));
  assert.equal(s.ready, true);
});

test('T8 Agent 정정(화면 정정 버튼) → 최신 정정 값만 매칭 재료', async () => {
  const st = done(base());
  await A.runTurn(st, '주말에만 연락하는 게 좋아요', async (k) => JSON.stringify(k === 'turn' ? T({ extracted: [X('relationship_style', '주말에만 연락', '주말에만 연락하는 게 좋아요')] }) : {}), { ui: { correction: true, purpose: 'relationship_style' } });
  const s = src(st);
  assert.ok(has(s, '주말에만 연락') && !has(s, '매일 연락'), JSON.stringify(s.confirmed));
});

test('T9 사용자가 아니라고 한 뜻(RETRACTED) → 매칭 재료에서 빠진다', () => {
  const st = base();
  A.applyTurn(st, '조용한 사람이 편해요', T({ extracted: [X('attraction_comfort', '진지한 연애를 원함', '조용한 사람이 편해요')] }));
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: ['진지한 연애'] }));
  const s = src(done(st));
  assert.ok(!has(s, '진지한 연애'), JSON.stringify(s.confirmed));
});

test('T10 AI 추정(AI_INFERRED) → 매칭 재료 0', () => {
  const s = src(done(base()));
  assert.ok(!has(s, '외향적'), JSON.stringify(s.confirmed));
  const p = A.matchingProfile(done(base()));
  p.values_character.items.push({ note: '추정만 있는 성격', quote: '', status: 'CONFIRMED', source_type: 'AI_INFERRED', source_turn: 1 });
  assert.ok(!M.sourceFromProfile(p, 'done', null).confirmed.includes('추정만 있는 성격'), '칸 안에 섞여 들어와도 추정은 빠진다');
});

test('T11 과거 확정 A → 최신 정정 B: 둘 다 CONFIRMED 로 남아도(모델이 정정을 답으로 읽은 경우) 매칭은 B 만', () => {
  const st = base();
  A.applyTurn(st, '아 그게 주말에만 연락하는 게 좋아요', T({ kind: 'answer', extracted: [X('relationship_style', '주말에만 연락', '주말에만 연락하는 게 좋아요')] }));
  const p = A.matchingProfile(done(st));
  p.relationship_style.items[p.relationship_style.items.length - 1].source_type = 'USER_CORRECTED'; // 사용자가 고쳐 말한 값(정정)으로 표시된 최신 값
  assert.equal(p.relationship_style.items.length, 2, '준비: 에이전트 상태에 둘 다 CONFIRMED');
  const s = M.sourceFromProfile(p, 'done', null);
  assert.ok(has(s, '주말에만 연락') && !has(s, '매일 연락'), JSON.stringify(s.confirmed));
});

test('T12 거절한 뜻 A 가 다른 표현으로 AI 정리에 다시 나오면 매칭에 쓰지 않는다 · 사용자가 직접 한 말은 쓴다', () => {
  const st = base();
  A.applyTurn(st, '조용한 사람이 편해요', T({ extracted: [X('attraction_comfort', '진지한 연애를 원함', '조용한 사람이 편해요')] }));
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: ['진지한 연애를 원함'] }));
  A.applyTurn(st, '말이 잘 통하는 사람이 좋아요. 진지하게 생각해요', T({ extracted: [X('relationship_intent', '진지한 연애를 원하는 편', '진지하게 생각해요'), X('values_character', '말이 잘 통하는 사람', '말이 잘 통하는 사람이 좋아요')] }));
  // v2.2.2(대표 「VAGUE REJECTION RULE」 R5): 서버 상태가 먼저 막는다 — 거둔 뜻의 다른 표현 AI 정리는 지금 사실로 저장 0.
  assert.ok(!A.matchingProfile(st).relationship_intent.items.some((i) => i.note === '진지한 연애를 원하는 편'), '상태에서 먼저 차단');
  const s = src(done(st));
  assert.ok(!has(s, '진지한 연애'), JSON.stringify(s.confirmed));
  // 매칭 읽는 쪽 안전망(v2.2.2 이전에 저장된 상태): 같은 모양이 profile 에 CONFIRMED 로 남아 있어도 쓰지 않는다.
  const old = A.matchingProfile(st);
  old.relationship_intent.items.push({ note: '진지한 연애를 원하는 편', quote: '진지하게 생각해요', status: 'CONFIRMED', source_type: 'AI_EXTRACTED', source_turn: 4 });
  assert.ok(!M.sourceFromProfile(old, 'done', null).confirmed.includes('진지한 연애를 원하는 편'));
  assert.ok(has(s, '말이 잘 통하는 사람'), '다른 사실은 그대로');
  const p = A.matchingProfile(st);
  p.values_character.items.push({ note: '진지한 연애를 원해요', quote: '진지한 연애를 원해요', status: 'CONFIRMED', source_type: 'USER_CORRECTED', source_turn: 9 });
  assert.ok(M.sourceFromProfile(p, 'done', null).confirmed.includes('진지한 연애를 원해요'), '사용자가 나중에 직접 고쳐 말한 값은 사용자 최신 설명이라 쓴다');
});

test('T13 사주·타로 참고 결과 → 매칭 재료 0(운영 에이전트는 결과를 상태에 넣지 않고 · 재료 함수도 한 번 더 막음)', () => {
  const st = base();
  const before = JSON.stringify(A.matchingProfile(st));
  assert.ok(!/사주|타로|운세|궁합/.test(before));
  const p = A.matchingProfile(done(st));
  p.values_character.items.push({ note: '타로에서 나온 연애운', quote: '타로에서 나온 연애운', status: 'CONFIRMED', source_type: 'AI_EXTRACTED', source_turn: 1 });
  p.attraction_comfort = { status: 'CONFIRMED', items: [{ note: '사주로 보면 활발한 사람과 맞음', quote: '', status: 'CONFIRMED', source_type: 'AI_EXTRACTED', source_turn: 1 }] };
  const s = M.sourceFromProfile(p, 'done', null);
  assert.ok(!s.confirmed.some((n) => /사주|타로/.test(n)), JSON.stringify(s.confirmed));
});

test('T14 실패 기록·연구 가설 → 매칭 재료 0(칸의 items 만 읽음)', () => {
  const p = A.matchingProfile(done(base()));
  Object.assign(p, { failure: { note: '실패 기록 문장' }, hypothesis: [{ note: '연구 가설 문장', status: 'CONFIRMED' }], research: '연구 가설 문장', failure_intelligence: [{ note: '실패 기록 문장', status: 'CONFIRMED', source_type: 'USER_DIRECT' }] });
  p.relationship_intent.history.push({ note: '실패 기록 문장', status: 'SUPERSEDED' });
  const s = M.sourceFromProfile(p, 'done', null);
  assert.ok(!has(s, '실패 기록') && !has(s, '연구 가설'), JSON.stringify(s.confirmed));
});
