// v2.4.2(2026-09-29 QA 실서버 CORE 검사 FAIL 재현) — 「아니 그런 뜻 아니야. 매일은 부담스럽고 주말에 …」를 모델이 항의(repair)로 읽어도
// 서버가 정정(correction)으로 확정 → 옛 항목 고르기 → 거절한 옛 값(매일 연락)이 지금 상태·매칭 재료에서 빠진다.
// 실서버 실측 모양(QA doit-agent echo-agent-v2.4.1): 같은 원문이 attraction_comfort(USER_DIRECT) + relationship_style(AI_EXTRACTED) 두 칸에, 새 값은 boundaries 칸.
// 가짜 AI 출력(LLM 후보)만 넣는다(Mock). 실제 AI 확인은 qa-real/qa-core-live.mjs. 실행: node --test qa/reject-with-value-correction.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'rwv-'));
const emit = (src, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(new URL(src, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
emit('../supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const A = await import(emit('../supabase/functions/doit-agent/agent.ts', 'agent.mjs'));

const X = (purpose, note, quote) => ({ purpose, note, quote });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const OLD = '연락은 매일 하는 게 좋아요';
const CORR = '아니 그런 뜻 아니야. 매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요';
const DAILY = /매일/;
const live = (st) => A.PURPOSES.flatMap((p) => st.slots[p.id].items.filter((i) => i.status === 'CONFIRMED').map((i) => ({ purpose: p.id, ...i })));
const liveDaily = (st) => live(st).filter((i) => DAILY.test(i.note) && !/부담/.test(i.note));

// 실서버에서 본 상태: 첫 답 + 「연락은 매일」이 두 칸(원문 · AI 정리)에 저장
function measuredState() {
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')] }));
  st.current = { type: 'core', purpose: 'attraction_comfort', text: '어떤 사람과 있을 때 편한가요?' };
  A.applyTurn(st, OLD, T({ extracted: [X('relationship_style', '연락을 매일 하는 것을 선호함', OLD)] }));
  assert.ok(liveDaily(st).length >= 2, `전제: 매일 연락이 두 칸에 CONFIRMED · ${JSON.stringify(liveDaily(st).map((i) => i.purpose))}`);
  st.current = { type: 'core', purpose: 'boundaries', text: '친구와의 연락은 자주 하는 편인가요?' };
  return st;
}
// 모델이 이 턴을 항의(repair)로 읽고 새 값만 뽑은 경우(실서버 kind=repair) · 옛 항목 고르기는 매일 항목 번호를 고른다
const llm = ({ pick = 'daily' } = {}) => async (kind, _prompt, input) => {
  if (kind === 'turn') return JSON.stringify(T({ kind: 'repair', reply: '알겠어요, 주말에 한두 번이 편하시군요.', extracted: [X('boundaries', '주말에 한두 번 연락하는 게 좋음', '주말에 한두 번 연락하는 게 좋아요')] }));
  if (kind === 'pick') { const items = input?.items ?? []; return JSON.stringify({ stale: pick === 'daily' ? items.filter((x) => DAILY.test(x.note) && !/부담/.test(x.note)).map((x) => x.n) : [] }); }
  return JSON.stringify({});
};

test('거절 머리말 + 새 값은 서버가 정정으로 확정한다 — 항의·피로·목적 방향 정정·짧은 「아니에요」는 그대로', () => {
  assert.equal(A.rejectWithNewValue(CORR), true);
  assert.equal(A.rejectWithNewValue('틀렸어요, 저는 평일 저녁이 편해요'), true);
  assert.equal(A.rejectWithNewValue('그게 아니라 천천히 알아가고 싶다는 뜻이었어요'), true);
  for (const t of ['아니에요', '아니 그런 뜻 아니야', '아까 말했잖아요 매일 연락하는 게 좋다고', '질문이 너무 많아요', '연애 질문 아니야 친구 찾는 거야', '주말엔 쉬어요']) assert.equal(A.rejectWithNewValue(t), false, t);
  assert.deepEqual(A.guardKind(CORR, 'repair'), { kind: 'correction', rule: 'reject_with_value' });
  assert.deepEqual(A.guardKind('아까 말했잖아요', 'repair'), { kind: 'repair', rule: null });
  assert.deepEqual(A.guardKind(CORR, 'answer'), { kind: 'answer', rule: null }, '답으로 읽힌 경우는 이 규칙 대상 아님(기존 흐름)');
});

test('실서버 FAIL 재현: repair 로 읽힌 정정 → 매일 연락 두 칸 모두 지금 상태에서 빠지고 · 주말 값은 사용자 정정으로 남는다', async () => {
  const st = measuredState();
  await A.runTurn(st, CORR, llm());
  const turn = st.turns[st.turns.length - 1];
  assert.equal(turn.kind, 'correction');
  assert.deepEqual(turn.guard, { from: 'repair', to: 'correction', rule: 'reject_with_value' });
  assert.deepEqual(liveDaily(st), [], '거절한 옛 값이 지금 상태에 0');
  const fresh = live(st).find((i) => /주말/.test(i.note));
  assert.ok(fresh, '정정한 새 값이 남음');
  assert.equal(fresh.source_type, 'USER_CORRECTED');
  assert.ok(st.corrections.includes(CORR), '사용자 정정 기록');
  // 원문 보존: 사용자 말(turns)은 지우지 않는다
  assert.ok(st.turns.some((t) => t.user === OLD) && st.turns.some((t) => t.user === CORR));
  // 매칭 재료(confirmed_preferences)에도 매일 연락 0
  const prefs = A.matchingProfile(st).confirmed_preferences ?? [];
  assert.ok(!prefs.some((p) => DAILY.test(p) && !/부담/.test(p)), JSON.stringify(prefs));
});

test('반대 검사: 규칙이 없으면(=모델이 repair 로 읽은 그대로) 매일 연락이 남는다 — 이 테스트가 실제로 결함을 잡는지', async () => {
  const st = measuredState();
  // 규칙을 거치지 않는 applyTurn 에 correction 이 아닌 repair + 새 값만 넣는다(= v2.4.1 동작)
  const out = T({ kind: 'repair', extracted: [X('boundaries', '주말에 한두 번 연락하는 게 좋음', '주말에 한두 번 연락하는 게 좋아요')] });
  A.applyTurn(st, '그러니까 주말에 한두 번 연락하는 게 좋아요', out); // 거절 머리말이 없어 규칙 대상 아님
  assert.ok(liveDaily(st).length >= 2, 'v2.4.1 동작: 매일 연락이 그대로 남음(규칙이 막아야 하는 상태)');
});

// v2.4.3(2026-09-29 QA 실서버 CORE 검사): 「잘 모르겠어요」를 모델이 항의(repair)로 읽으면 지금 질문이 거절(disputed → 매칭 rejected_meanings)로 기록됐다.
test('「잘 모르겠어요」는 repair·correction 으로 읽혀도 모르겠다(unsure) — 저장 0 · 지금 질문을 거절로 기록 0 · 매칭 rejected_meanings 0', async () => {
  for (const k of ['repair', 'correction', 'answer', 'help', 'ask']) assert.deepEqual(A.guardKind('잘 모르겠어요', k), { kind: 'unsure', rule: 'unsure_only' }, k);
  assert.deepEqual(A.guardKind('잘 모르겠는데 주말엔 쉬고 싶어요', 'repair').kind, 'repair', '모르겠다 + 다른 말은 이 규칙 대상 아님');
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')] }));
  const Q = '친구와 같이 하고 싶은 건 무엇인가요?';
  st.current = { type: 'core', purpose: 'attraction_comfort', text: Q };
  const r = await A.runTurn(st, '잘 모르겠어요', async (kind) => kind === 'turn' ? JSON.stringify(T({ kind: 'repair', reply: '괜찮아요.' })) : '{}');
  const turn = st.turns[st.turns.length - 1];
  assert.equal(turn.kind, 'unsure');
  assert.deepEqual(turn.guard, { from: 'repair', to: 'unsure', rule: 'unsure_only' });
  assert.equal(r.response?.saved ?? false, false);
  assert.ok(!st.disputed.includes(Q), '지금 질문이 거절로 기록되지 않음');
  assert.ok(!(A.matchingProfile(st).rejected_meanings ?? []).includes(Q), '매칭 rejected_meanings 에 0');
});
