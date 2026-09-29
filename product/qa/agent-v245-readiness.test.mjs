// v2.4.5(2026-09-29 대표 「최종 실행 지시」) — GF-115 A안 · 「아니요 + 새 값」 구분 · GF-109 칸 설명 저장 0. 가짜 AI 출력(Mock)만 넣는다.
// AGENT_SRC 로 다른 판(예: v2.4.4)을 넣으면 역검사(수정 전 FAIL)를 볼 수 있다. 실행: node --test qa/agent-v245-readiness.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'v245-'));
const emit = (file, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
const here = (p) => new URL(p, import.meta.url).pathname;
emit(here('../supabase/functions/doit-agent/matching.ts'), 'matching.mjs');
const A = await import(emit(process.env.AGENT_SRC || here('../supabase/functions/doit-agent/agent.ts'), 'agent.mjs'));

const X = (purpose, note, quote) => ({ purpose, note, quote });
const N = (purpose, question) => ({ type: 'core', purpose, question, hint: '' });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const live = (st, id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED');
const start = (goal = 'friend') => { const st = A.newState({ tone: 'polite', goal }); A.seedFirstQuestion(st); return st; };

test('「아니요 + 새 값」이 방금 보인 AI 해석과 같은 칸이면 정정 — 옛 해석은 지금 사실에서 빠지고 새 값이 USER_CORRECTED', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거우세요?') }));
  // AI 가 답을 「자주 만나서 노는 걸 좋아하심」으로 해석해 받아주기로 보였다(presented)
  A.applyTurn(st, '같이 노는 게 좋아요', T({ reply: '자주 만나서 노는 걸 좋아하시네요.', extracted: [X('attraction_comfort', '자주 만나서 노는 걸 좋아하심', '같이 노는 게 좋아요')], next: N('values_character', '잘 맞는 친구는 어떤 모습이에요?') }));
  assert.ok((st.turns.at(-1).presented ?? []).some((p) => p.purpose === 'attraction_comfort'), '전제: 해석이 사용자에게 보임');
  const r = A.applyTurn(st, '아니요, 카페에서 이야기하는 게 좋아요', T({ kind: 'answer', extracted: [X('attraction_comfort', '카페에서 이야기하는 걸 좋아함', '카페에서 이야기하는 게 좋아요')], next: N('values_character', '잘 맞는 친구는 어떤 모습이에요?') }));
  assert.equal(r.kind, 'correction');
  const now = live(st, 'attraction_comfort');
  assert.ok(now.every((i) => !/자주 만나서/.test(i.note)), `옛 해석이 지금 사실로 남음: ${JSON.stringify(now.map((i) => i.note))}`);
  assert.ok(now.some((i) => i.source_type === 'USER_CORRECTED' && /카페/.test(i.note)));
  assert.ok(st.turns.some((t) => t.user === '같이 노는 게 좋아요'), '사용자 원문은 보존');
});

test('「아니요 + 답」이 새 질문에 대한 답이면(보인 해석이 다른 칸이거나 없음) 보통 답 — 다른 칸의 확정 사실은 그대로', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거우세요?') }));
  A.applyTurn(st, '같이 노는 게 좋아요', T({ reply: '같이 노는 시간이 즐거우시네요.', extracted: [X('attraction_comfort', '같이 노는 걸 좋아함', '같이 노는 게 좋아요')], next: N('relationship_style', '친구랑 매일 연락하는 편이세요?') }));
  const r = A.applyTurn(st, '아니요, 주말에 한 번 정도 연락하는 게 좋아요', T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한 번 정도 연락함', '주말에 한 번 정도 연락하는 게 좋아요')], next: N('values_character', '잘 맞는 친구는 어떤 모습이에요?') }));
  assert.equal(r.kind, 'answer');
  assert.equal(live(st, 'attraction_comfort').length, 1, '다른 칸 확정 사실 유지');
  assert.equal(st.disputed.length, 0, '지금 질문을 거절로 기록하지 않음');
});

test('화면 「고치기」는 모델 종류와 관계없이 정정', () => {
  for (const t of ['주말에 한 번 정도가 좋아요', '아니요, 주말에 한 번 정도가 좋아요']) {
    assert.equal(A.guardKind(t, 'answer', true).kind, 'correction', t);
    if (A.decideKind) assert.equal(A.decideKind(start(), t, { kind: 'answer', extracted: [] }, true).kind, 'correction', t);
  }
});

// 답 3개 · 확정 칸 4개 · 질문 3개 — v2.4.4 는 여기서 finish_enough(실측 PROD a·b)
function threeAnswers() {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거우세요?') }));
  A.applyTurn(st, '카페에서 오래 이야기하는 게 좋아요', T({ extracted: [X('attraction_comfort', '카페에서 이야기함', '카페에서 오래 이야기하는 게 좋아요'), X('relationship_style', '오래 이야기함', '오래 이야기하는')], next: N('values_character', '잘 맞는 친구는 어떤 모습이에요?') }));
  return st;
}
test('GF-115: 답 기록이 5개 미만이면 「충분」으로 마치지 않고 남은 칸을 묻는다', () => {
  const st = threeAnswers();
  const r = A.applyTurn(st, '약속을 잘 지키는 사람이 좋아요', T({ extracted: [X('values_character', '약속을 잘 지킴', '약속을 잘 지키는 사람이 좋아요')], next: N('boundaries', '친구 사이에서 불편한 건 뭐예요?') }));
  assert.equal(A.savedAnswers(st), 3);
  assert.equal(r.finish, false, `답 3개에서 마침: decision=${st.turns.at(-1).decision}`);
  assert.equal(r.question_purpose, 'boundaries');
});
test('GF-115: 다섯 칸을 다 물었는데 답이 모자라면 모르는 것 하나를 더 묻는다(fill) · 상한 2 · 답 5개가 되면 마침', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('attraction_comfort', 'Q2?') }));
  A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure', next: N('values_character', 'Q3?') }));
  A.applyTurn(st, '약속을 잘 지키는 사람이 좋아요', T({ extracted: [X('values_character', '약속을 지킴', '약속을 잘 지키는 사람이 좋아요')], next: N('relationship_style', 'Q4?') }));
  A.applyTurn(st, '연락은 이틀에 한 번이 편해요', T({ extracted: [X('relationship_style', '이틀에 한 번 연락', '연락은 이틀에 한 번이 편해요')], next: N('boundaries', 'Q5?') }));
  const r5 = A.applyTurn(st, '갑자기 약속 취소하는 건 싫어요', T({ extracted: [X('boundaries', '갑자기 취소 싫음', '갑자기 약속 취소하는 건 싫어요')], next: N('attraction_comfort', '친구랑 주말에 뭘 하면 즐거우세요?') }));
  assert.equal(A.coreAsked(st).length, 5); assert.equal(A.savedAnswers(st), 4);
  assert.equal(r5.finish, false, `다섯 칸 뒤 답 4개에서 마침: ${st.turns.at(-1).decision}`);
  assert.equal(st.current?.type, 'fill');
  const r6 = A.applyTurn(st, '전시 보러 가는 게 좋아요', T({ extracted: [X('attraction_comfort', '전시 보러 감', '전시 보러 가는 게 좋아요')], next: N('attraction_comfort', 'Q?') }));
  assert.equal(A.savedAnswers(st), 5); assert.equal(r6.finish, true); assert.ok(['finish', 'finish_enough'].includes(st.turns.at(-1).decision), st.turns.at(-1).decision);
  assert.equal(A.matchingProfile(st).readiness?.ready, true);
});
test('GF-115: 두 번 연속 모르겠다/넘기기면 끝없이 묻지 않고 「준비 미완료」로 멈춘다', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('attraction_comfort', 'Q2?') }));
  for (const [p, n] of [['values_character', 'Q3?'], ['relationship_style', 'Q4?'], ['boundaries', 'Q5?']]) A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure', next: N(p, n) }));
  const r = A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure', next: N('attraction_comfort', 'Q6?') }));
  assert.equal(r.finish, true); assert.equal(st.turns.at(-1).decision, 'finish_not_ready');
  assert.equal(A.matchingProfile(st).readiness?.ready, false);
  assert.equal(st.asked.filter((q) => q.type === 'fill').length, 0);
});
test('GF-109: 칸 설명 문장(목적별 dims)은 사용자 정보로 저장하지 않는다', () => {
  const st = start('romantic');
  A.applyTurn(st, '진지한 연애를 하고 싶어요', T({ extracted: [X('relationship_intent', '진지한 연애를 원함', '진지한 연애를 하고 싶어요')], next: N('attraction_comfort', 'Q?') }));
  A.applyTurn(st, '조용한 곳에서 오래 이야기하는 게 좋아요', T({ extracted: [X('relationship_style', '연락 · 만남의 속도와 마음을 표현하는 방식', '조용한 곳에서 오래 이야기하는 게 좋아요'), X('attraction_comfort', '조용한 곳에서 이야기함', '조용한 곳에서 오래 이야기하는 게 좋아요')], next: N('values_character', 'Q?') }));
  assert.equal(live(st, 'relationship_style').length, 0, JSON.stringify(live(st, 'relationship_style').map((i) => i.note)));
  assert.equal(live(st, 'attraction_comfort').length, 1);
});
