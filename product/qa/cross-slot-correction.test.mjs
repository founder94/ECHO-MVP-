// 출시 차단(2026-09-27 대표 「CROSS-SLOT CORRECTION + REAL REJECTION VALIDATION」) — 정정한 옛 뜻이 다른 칸에 숨어 남지 않는가 · 다른 사실은 보존되는가.
// 근거는 서버가 가진 출처(같은 사용자 말 turn · 같은 원문 quote)만 — 뜻 유사도로 사용자 사실을 지우지 않는다.
// 가짜 AI 출력(LLM 후보)만 넣는다(실제 AI 품질 판정 아님 · Mock). 실행: node --test qa/cross-slot-correction.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'xslot-'));
const emit = (src, out, fix = (x) => x) => { const f = path.join(dir, out); writeFileSync(f, fix(ts.transpileModule(readFileSync(new URL(src, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)); return pathToFileURL(f).href; };
const A = await import(emit('../supabase/functions/doit-agent/agent.ts', 'agent.mjs'));
emit('../supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const M = await import(emit('../supabase/functions/doit-connect/agentSource.ts', 'agentSource.mjs', (x) => x.replace('"../doit-agent/matching.ts"', '"./matching.mjs"')));

const X = (purpose, note, quote) => ({ purpose, note, quote });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const live = (st) => A.PURPOSES.flatMap((p) => st.slots[p.id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.note));
const status = (st, id, note) => st.slots[id].items.find((i) => i.note === note)?.status;
const introText = (st) => (st.intro?.lines ?? []).map((l) => l.text).join(' ');
const src = (st) => M.sourceFromProfile(A.matchingProfile(st), 'done', null);
const UI_STYLE = { correction: true, purpose: 'relationship_style' };
const OLD = '연락은 매일 하는 게 좋아요';
const NEW = '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요';
const fixLlm = (intro = null) => async (kind) => JSON.stringify(kind === 'turn' ? T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한두 번 연락이 좋음', NEW)] }) : kind === 'intro' ? (intro ?? {}) : {});
const at = (st, purpose) => { st.current = { type: 'core', purpose, text: `${purpose} 질문` }; };

// 같은 사용자 말 하나가 두 칸에 들어간 상태(QA run 36295530893 과 같은 모양): AI 가 relationship_style 로 정리 + 지금 질문 칸(values_character)에 원문 그대로.
function stale() {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남')] }));
  at(st, 'values_character');
  A.applyTurn(st, OLD, T({ extracted: [X('relationship_style', '매일 연락하는 게 좋음', OLD)] }));
  assert.equal(status(st, 'relationship_style', '매일 연락하는 게 좋음'), 'CONFIRMED');
  assert.equal(st.slots.values_character.items[0]?.source_type, 'USER_DIRECT', '전제: 다른 칸에 같은 원문이 사용자 원문으로 저장됨');
  st.phase = 'done'; st.current = null;
  return st;
}

test('C1 같은 출처에서 두 칸에 들어간 옛 값 A → 정정 B → 두 A 모두 지금 상태에서 빠지고 B 만 남는다', async () => {
  // (a) 원문 저장 경로(USER_DIRECT 복제) — 실제 AI QA 에서 나온 모양
  const st = stale();
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(status(st, 'relationship_style', '매일 연락하는 게 좋음'), 'SUPERSEDED');
  assert.equal(status(st, 'values_character', OLD), 'SUPERSEDED', '다른 칸의 같은 출처 값도 밀림');
  assert.ok(!live(st).some((n) => /매일/.test(n) && !/부담/.test(n)), JSON.stringify(live(st)));
  assert.equal(status(st, 'relationship_style', '주말에 한두 번 연락이 좋음'), 'CONFIRMED');
  const fresh = st.slots.relationship_style.items.find((i) => i.status === 'CONFIRMED');
  assert.equal(fresh.source_type, 'USER_CORRECTED');
  assert.deepEqual(fresh.corrected_from, ['매일 연락하는 게 좋음', OLD], '무엇을 밀었는지 이력에 남는다');
  // (b) AI 가 같은 인용을 두 칸에 정리한 경로(AI_EXTRACTED 복제)
  const st2 = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st2);
  A.applyTurn(st2, `${OLD}.`, T({ extracted: [X('relationship_style', '매일 연락', OLD), X('values_character', '꾸준히 연락하는 사람', `${OLD}.`)] }));
  assert.equal(status(st2, 'values_character', '꾸준히 연락하는 사람'), 'CONFIRMED', '전제: 다른 칸에 AI 정리로 저장됨');
  st2.phase = 'done'; st2.current = null;
  await A.runTurn(st2, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(status(st2, 'values_character', '꾸준히 연락하는 사람'), 'SUPERSEDED', '문장부호만 다른 같은 원문');
  assert.deepEqual(live(st2), ['주말에 한두 번 연락이 좋음']);
});

test('C2 비슷한 단어를 가진 다른 정상 사실 C 는 보존(다른 턴 · 같은 턴의 다른 원문)', async () => {
  const st = stale();
  at(st, 'values_character');
  A.applyTurn(st, '매일 운동하는 성실한 사람이 좋아요', T({ extracted: [X('values_character', '매일 운동하는 성실한 사람', '매일 운동하는 성실한 사람이 좋아요')] }));
  st.current = null;
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(status(st, 'values_character', '매일 운동하는 성실한 사람'), 'CONFIRMED', '다른 턴 · 다른 원문 = 보존');
  // 같은 말 안의 다른 부분(다른 원문) — 보존
  const st2 = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st2);
  A.applyTurn(st2, '조용한 카페를 좋아하고 연락은 매일 하는 게 좋아요', T({ extracted: [X('attraction_comfort', '조용한 카페를 좋아함', '조용한 카페를 좋아하고'), X('relationship_style', '매일 연락', '연락은 매일 하는 게 좋아요')] }));
  st2.phase = 'done'; st2.current = null;
  await A.runTurn(st2, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(status(st2, 'attraction_comfort', '조용한 카페를 좋아함'), 'CONFIRMED', '같은 턴이라도 원문이 다르면 보존');
  assert.equal(status(st2, 'relationship_style', '매일 연락'), 'SUPERSEDED');
});

test('C3 과거 AI_EXTRACTED A → USER_CORRECTED B → Matching 은 B 만(A 사용 0)', async () => {
  const st = stale();
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  const s = src(st);
  assert.ok(s.confirmed.includes('주말에 한두 번 연락이 좋음'), JSON.stringify(s.confirmed));
  assert.ok(!s.confirmed.some((n) => /매일/.test(n) && !/부담/.test(n)), JSON.stringify(s.confirmed));
});

test('C3b v2.2.2 이전에 저장된 상태(다른 칸 옛 값이 CONFIRMED 로 남음)도 Matching 이 같은 출처로 빼낸다', () => {
  const st = stale();
  // 예전 규칙 모양 재현: 같은 칸만 밀리고 다른 칸 복제는 CONFIRMED 로 남은 상태
  A.applyTurn(st, NEW, T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한두 번 연락이 좋음', NEW)] }));
  st.slots.values_character.items[0].status = 'CONFIRMED';
  const s = src(st);
  assert.ok(!s.confirmed.includes(OLD), JSON.stringify(s.confirmed));
  assert.ok(s.confirmed.includes('주말에 한두 번 연락이 좋음'));
  assert.ok(s.confirmed.includes('친구 같은 만남'), '관계없는 값 보존');
});

test('C4 과거 USER_DIRECT C(표현 일부 비슷 · 다른 말) → 자동 삭제 0', async () => {
  const st = stale();
  at(st, 'boundaries');
  A.applyTurn(st, '연락이 너무 뜸한 건 싫어요', T()); // 원문 그대로 저장(USER_DIRECT)
  st.current = null;
  assert.equal(st.slots.boundaries.items[0]?.source_type, 'USER_DIRECT');
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(status(st, 'boundaries', '연락이 너무 뜸한 건 싫어요'), 'CONFIRMED');
  assert.ok(src(st).confirmed.includes('연락이 너무 뜸한 건 싫어요'));
});

test('C5 소개/Profile: 옛 값 A 문장 0 · 최신 B 있음', async () => {
  const st = stale();
  st.intro = { status: 'ready', lines: [{ text: '저는 친구 같은 만남을 원해요.', basis: '친구처럼 편한 만남' }, { text: '저는 연락을 매일 하는 게 좋아요.', basis: OLD }], dropped: {}, tries: 1, error: null, used: 'as_is', used_at: 'x' };
  // 다시 쓰기 AI 가 옛 문장을 되살려도(나쁜 경우) 서버 근거 검사로 빠지는지
  await A.runTurn(st, NEW, fixLlm({ intro: [{ text: '저는 친구 같은 만남을 원해요.', basis: '친구처럼 편한 만남' }, { text: '저는 연락을 매일 하는 게 좋아요.', basis: OLD }, { text: '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요.', basis: NEW }] }), { ui: UI_STYLE });
  const t = introText(st);
  assert.ok(!/연락을 매일 하는/.test(t), t);
  assert.match(t, /주말에 한두 번/);
  const p = A.matchingProfile(st);
  assert.ok(!p.confirmed_preferences.includes(OLD) && !p.confirmed_preferences.includes('매일 연락하는 게 좋음'), JSON.stringify(p.confirmed_preferences));
  assert.ok(p.values_character.history.some((h) => h.note === OLD && h.status === 'SUPERSEDED'), '옛 값은 지우지 않고 이력에');
});

test('C6 같은 정정 재전송 → 중복 상태 0', async () => {
  const st = stale();
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  const snap = JSON.stringify(A.PURPOSES.map((p) => st.slots[p.id].items.map((i) => [i.note, i.status])));
  const corr = st.corrections.length;
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(JSON.stringify(A.PURPOSES.map((p) => st.slots[p.id].items.map((i) => [i.note, i.status]))), snap, '값·상태 그대로');
  assert.equal(st.corrections.length, corr, '정정 기록 한 번');
  assert.equal(st.slots.relationship_style.items.filter((i) => i.status === 'CONFIRMED').length, 1);
});

test('M Matching 관통: 정정 포함 · 밀린 값 제외 · 거둔 뜻 제외 · 추정 제외 · 사용자 원문 보존 · 사주/타로 0', async () => {
  const st = stale();
  at(st, 'attraction_comfort');
  A.applyTurn(st, '대화가 잘 통하는 사람', T({ extracted: [X('attraction_comfort', '외향적인 사람', '대화가 잘 통하는 사람')], inferred: [{ trait: '외향적', basis: '대화' }] }));
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: ['외향적인 사람'] }));
  at(st, 'boundaries');
  A.applyTurn(st, '사주 궁합 같은 건 안 믿어요', T({ extracted: [X('boundaries', '타로 결과 좋음', '사주 궁합 같은 건 안 믿어요')] }));
  st.current = null;
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  const s = src(st);
  assert.ok(s.confirmed.includes('주말에 한두 번 연락이 좋음'));
  assert.ok(!s.confirmed.includes(OLD) && !s.confirmed.includes('매일 연락하는 게 좋음'));
  assert.equal(status(st, 'attraction_comfort', '외향적인 사람'), 'RETRACTED', '전제: 거절 뜻이 실제로 저장돼 있다가 거둬짐');
  assert.ok(!s.confirmed.includes('외향적인 사람'));
  assert.ok(!s.confirmed.includes('외향적'), '추정 0');
  assert.ok(s.confirmed.includes('친구 같은 만남'), '사용자 정상 사실 보존');
  assert.ok(!s.confirmed.some((n) => /사주|타로|궁합/.test(n)), '사주·타로 0');
});

test('R 거절 검사 전제: 거절할 해석이 저장돼 있지 않으면 「거둠」을 증명할 수 없다(검사 무효 판정 규칙)', () => {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '혼자 있는 시간도 중요해요', T()); // AI 해석 0
  const pre = A.PURPOSES.flatMap((p) => st.slots[p.id].items.filter((i) => i.source_type === 'AI_EXTRACTED'));
  assert.equal(pre.length, 0, '이 모양이면 거절 검사는 TEST INVALID(PASS 아님)');
});

// 실제 AI 확인(Actions run 36296551186 · R3): 「아니, 그런 뜻 아니야」에 모델은 repair 로 읽었지만 틀린 뜻(wrong)을 짚지 않아 해석이 남았다 — 같은 모양을 대본으로 재현.
function shown() {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남')] }));
  at(st, 'values_character');
  A.applyTurn(st, '연락이 너무 잦으면 좀 그래요', T({ extracted: [X('relationship_style', '연락이 너무 잦은 것은 선호하지 않음', '연락이 너무 잦으면 좀 그래요')] }));
  assert.equal(status(st, 'relationship_style', '연락이 너무 잦은 것은 선호하지 않음'), 'CONFIRMED', '전제: 거절할 AI 해석이 서버 상태에 있다');
  return st;
}

test('R1 맨 거절: 바로 앞 말의 AI 해석만 거둔다 · 사용자 원문(USER_DIRECT)과 앞선 사실은 그대로', () => {
  const st = shown();
  A.applyTurn(st, '아니, 그런 뜻 아니야', T({ kind: 'repair', wrong: [] }));
  assert.equal(status(st, 'relationship_style', '연락이 너무 잦은 것은 선호하지 않음'), 'RETRACTED');
  assert.equal(status(st, 'values_character', '연락이 너무 잦으면 좀 그래요'), 'CONFIRMED', '사용자가 직접 친 말은 모델 판단으로 지우지 않음');
  assert.equal(status(st, 'relationship_intent', '친구 같은 만남'), 'CONFIRMED', '앞선 다른 턴의 사실 보존');
  st.phase = 'done';
  const s = src(st);
  assert.ok(!s.confirmed.includes('연락이 너무 잦은 것은 선호하지 않음'), JSON.stringify(s.confirmed));
  assert.ok(A.matchingProfile(st).rejected_meanings.includes('연락이 너무 잦은 것은 선호하지 않음'));
});

test('R2 「아니요」 한 마디(질문에 대한 답일 수 있음)는 맨 거절 규칙을 쓰지 않는다', () => {
  const st = shown();
  A.applyTurn(st, '아니요', T({ kind: 'repair', wrong: [] }));
  assert.equal(status(st, 'relationship_style', '연락이 너무 잦은 것은 선호하지 않음'), 'CONFIRMED');
});

test('R3 거절하며 새로 설명하면(새 정보 있음) 맨 거절 규칙 대신 정정 규칙', () => {
  const st = shown();
  A.applyTurn(st, '그런 뜻 아니야 하루 한 번은 좋아요', T({ kind: 'correction', extracted: [X('relationship_style', '하루 한 번 연락은 좋음', '하루 한 번은 좋아요')] }));
  assert.equal(status(st, 'relationship_style', '하루 한 번 연락은 좋음'), 'CONFIRMED');
  assert.equal(status(st, 'relationship_style', '연락이 너무 잦은 것은 선호하지 않음'), 'SUPERSEDED');
});

test('R4 모델이 틀린 뜻을 짚으면 기존 규칙(짚은 것만) · 앞 말의 다른 해석은 그대로', () => {
  const st = shown();
  A.applyTurn(st, '편한 대화 좋아해요', T({ extracted: [X('attraction_comfort', '대화가 편한 사람', '편한 대화 좋아해요'), X('values_character', '말수가 많은 사람', '편한 대화 좋아해요')] }));
  A.applyTurn(st, '아니, 그런 뜻 아니야', T({ kind: 'repair', wrong: ['말수가 많은 사람'] }));
  assert.equal(status(st, 'values_character', '말수가 많은 사람'), 'RETRACTED');
  assert.equal(status(st, 'attraction_comfort', '대화가 편한 사람'), 'CONFIRMED');
});

// 실제 AI 확인(Actions run 36296950517): 「매일」 → 「아니 그런 뜻 아니야」(AI 정리 거둠 · 원문 복제는 다른 칸에 남음) → 화면 정정(주말).
// 정정 시점에 그 칸의 옛 값은 이미 RETRACTED 라 밀린 값(SUPERSEDED)이 없었고, 다른 칸의 원문 복제 「매일」이 Matching 에 남았다.
test('C7 거절로 거둔 옛 해석의 원문 복제도, 그 칸을 사용자가 정정하면 다른 칸에서 함께 밀린다', async () => {
  const st = stale();
  st.phase = 'talk'; st.current = { type: 'core', purpose: 'relationship_style', text: '연락은 어떤 방식이 좋아요?' };
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: [] }));
  assert.equal(status(st, 'relationship_style', '매일 연락하는 게 좋음'), 'RETRACTED', '전제: 맨 거절로 AI 정리를 거둠');
  assert.equal(status(st, 'values_character', OLD), 'CONFIRMED', '전제: 사용자 원문 복제는 거절만으로는 지우지 않음');
  st.phase = 'done'; st.current = null;
  await A.runTurn(st, NEW, fixLlm(), { ui: UI_STYLE });
  assert.equal(status(st, 'values_character', OLD), 'SUPERSEDED');
  const s = src(st);
  assert.ok(!s.confirmed.some((n) => /매일/.test(n) && !/부담/.test(n)) && s.confirmed.includes('주말에 한두 번 연락이 좋음'), JSON.stringify(s.confirmed));
  assert.equal(status(st, 'relationship_intent', '친구 같은 만남'), 'CONFIRMED');
});

test('C7b v2.2.2 이전 저장 상태(거둔 뜻 + 뒤의 정정 + 다른 칸 원문 복제 CONFIRMED)도 Matching 이 빼낸다 · 정정이 없으면 원문 보존', () => {
  const st = stale();
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: [] }));
  const before = src(st);
  assert.ok(before.confirmed.includes(OLD), '정정 전: 사용자 원문은 그대로(거절만으로 지우지 않음)');
  A.applyTurn(st, NEW, T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한두 번 연락이 좋음', NEW)] }));
  st.slots.values_character.items[0].status = 'CONFIRMED'; // 예전 규칙 모양
  assert.ok(!src(st).confirmed.includes(OLD), JSON.stringify(src(st).confirmed));
});
