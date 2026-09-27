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

// 모호한 거절(2026-09-27 대표 「VAGUE REJECTION RULE」): 바로 앞 답(reply)에서 사용자에게 실제로 보인 AI 해석만 대상 · 사용자 원문 보존.
const LATE = '약속 시간에 늦는 사람은 별로예요';
function shown(reply, extracted, text = LATE) {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편한 만남이요', T({ extracted: [X('relationship_intent', '친구 같은 만남', '친구처럼 편한 만남')] }));
  at(st, 'values_character');
  A.applyTurn(st, text, T({ reply, extracted, next: { type: 'core', purpose: 'relationship_style', question: '연락은 어떻게 하는 게 좋아요?' } }));
  return st;
}
const VAGUE = T({ kind: 'repair', wrong: [], reply: '아, 그렇군요.' });

test('R1 AI 해석 A 하나를 화면에 보임 → 「그게 아니야」 → A 만 거둠 · 사용자 원문 보존', () => {
  const st = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  assert.deepEqual(st.turns.at(-1).presented, [{ purpose: 'boundaries', note: '시간 약속을 잘 지키는 사람이 좋음' }], '전제: 해석 A 가 사용자에게 보였다');
  A.applyTurn(st, '그게 아니야', VAGUE);
  assert.equal(status(st, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'RETRACTED');
  assert.equal(status(st, 'values_character', LATE), 'CONFIRMED', '사용자 원문(USER_DIRECT) 보존');
  assert.equal(status(st, 'relationship_intent', '친구 같은 만남'), 'CONFIRMED');
  st.phase = 'done';
  assert.ok(!src(st).confirmed.includes('시간 약속을 잘 지키는 사람이 좋음'));
  assert.ok(!A.matchingProfile(st).confirmed_preferences.includes('시간 약속을 잘 지키는 사람이 좋음'));
});

test('R2 AI 가 A/B/C 를 만들었지만 화면에는 A 만 → A 만 거둠 · B/C 그대로', () => {
  const st = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE), X('attraction_comfort', '성실한 사람에게 끌림', '사람은'), X('values_character', '책임감을 중요하게 봄', '별로예요')]);
  assert.equal(st.turns.at(-1).presented.length, 1, '전제: 화면에 보인 해석은 A 하나');
  A.applyTurn(st, '그게 아니야', VAGUE);
  assert.equal(status(st, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'RETRACTED');
  assert.equal(status(st, 'attraction_comfort', '성실한 사람에게 끌림'), 'CONFIRMED', 'B 자동 삭제 0');
  assert.equal(status(st, 'values_character', '책임감을 중요하게 봄'), 'CONFIRMED', 'C 자동 삭제 0');
});

test('R3 화면에 A/B 두 해석을 함께 보임 → 모호한 거절 → 둘 다 DISPUTED(지금 사실·매칭 0 · 지우지 않음) + 한 줄 확인 · 원문 보존', () => {
  const text = '조용한 카페를 좋아하고 연락은 매일 하는 게 좋아요';
  const st = shown('조용한 카페를 좋아하시고 연락은 매일 하는 게 좋으시군요.', [X('attraction_comfort', '조용한 카페를 좋아함', '조용한 카페를 좋아하고'), X('relationship_style', '연락은 매일 하는 게 좋음', '연락은 매일 하는 게 좋아요')], text);
  assert.equal(st.turns.at(-1).presented.length, 2, '전제: 두 해석이 함께 보였다');
  const r = A.applyTurn(st, '아니, 그런 뜻 아니야', VAGUE);
  assert.equal(status(st, 'attraction_comfort', '조용한 카페를 좋아함'), 'DISPUTED');
  assert.equal(status(st, 'relationship_style', '연락은 매일 하는 게 좋음'), 'DISPUTED');
  assert.equal(r.question, A.DISPUTE_CHECK, '한 줄만 확인');
  assert.equal(st.turns.at(-1).decision, 'dispute_check');
  assert.equal(st.slots.values_character.items.find((i) => i.quote === text)?.status, 'CONFIRMED', '사용자 원문 보존');
  st.phase = 'done';
  const s = src(st);
  assert.ok(!s.confirmed.includes('조용한 카페를 좋아함') && !s.confirmed.includes('연락은 매일 하는 게 좋음'), JSON.stringify(s.confirmed));
});

test('R3b 보인 해석이 없으면 상태는 그대로 두고 한 줄만 확인 · 「아니에요」 한 마디는 모델이 거절로 읽을 때만', () => {
  const st = shown('그렇군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  const r = A.applyTurn(st, '아니, 그런 뜻 아니야', VAGUE);
  assert.equal(status(st, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'CONFIRMED');
  assert.equal(r.question, A.DISPUTE_CHECK);
  const st2 = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  A.applyTurn(st2, '아니에요', T({ kind: 'answer' }));
  assert.equal(status(st2, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'CONFIRMED', '대답으로 읽힌 「아니에요」는 거절 아님');
  A.applyTurn(st2, '아니에요', VAGUE);
  assert.equal(status(st2, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'CONFIRMED', '바로 앞 답이 아니라 그 전 답의 해석이므로 대상 아님');
});

test('R4 USER_DIRECT 사실이 있고 이후 AI 해석을 거절 → USER_DIRECT 자동 삭제 0', () => {
  const st = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  A.applyTurn(st, '그게 아니야', VAGUE);
  assert.equal(st.slots.values_character.items.filter((i) => i.source_type === 'USER_DIRECT' && i.status === 'CONFIRMED').length, 1);
});

test('R5 거둔 A 를 다음 응답에서 AI 가 다른 표현으로 다시 정리 → 지금 사실로 올리지 않음 · Matching 0', () => {
  const st = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  A.applyTurn(st, '그게 아니야', VAGUE);
  A.applyTurn(st, '그냥 늦는 건 좀 그래요', T({ extracted: [X('boundaries', '시간 약속 잘 지키는 사람이 좋음', '늦는 건 좀 그래요'), X('relationship_style', '늦는 건 싫어함', '늦는 건 좀 그래요')] }));
  assert.equal(status(st, 'boundaries', '시간 약속 잘 지키는 사람이 좋음'), undefined, '다른 표현의 같은 뜻 재생성 차단');
  assert.equal(status(st, 'relationship_style', '늦는 건 싫어함'), 'CONFIRMED', '다른 뜻은 저장');
  st.phase = 'done';
  assert.ok(!src(st).confirmed.some((n) => /시간 약속/.test(n)));
});

test('R6 이후 사용자가 직접 「아니, 실제로는 B야」 → B = USER_CORRECTED CONFIRMED · A = RETRACTED · Matching 은 B', () => {
  const st = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  A.applyTurn(st, '그게 아니야', VAGUE);
  A.applyTurn(st, '아니, 실제로는 연락 없이 늦는 게 싫다는 거야', T({ kind: 'correction', extracted: [X('boundaries', '연락 없이 늦는 것이 싫음', '연락 없이 늦는 게 싫다는 거야')] }));
  const b = st.slots.boundaries.items.find((i) => i.note === '연락 없이 늦는 것이 싫음');
  assert.equal(b.status, 'CONFIRMED'); assert.equal(b.source_type, 'USER_CORRECTED');
  assert.equal(status(st, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'RETRACTED');
  st.phase = 'done';
  const s = src(st);
  assert.ok(s.confirmed.includes('연락 없이 늦는 것이 싫음') && !s.confirmed.includes('시간 약속을 잘 지키는 사람이 좋음'), JSON.stringify(s.confirmed));
});

test('R7 모델이 틀린 뜻을 짚으면 기존 규칙(짚은 것만) · 짚었는데 안 맞으면 아무것도 지우지 않음', () => {
  const st = shown('시간 약속을 잘 지키는 사람이 좋으시군요.', [X('boundaries', '시간 약속을 잘 지키는 사람이 좋음', LATE)]);
  A.applyTurn(st, '아니, 그런 뜻 아니야', T({ kind: 'repair', wrong: ['시간 약속을 잘 안 지켜도 됨'] }));
  assert.equal(status(st, 'boundaries', '시간 약속을 잘 지키는 사람이 좋음'), 'CONFIRMED');
});

// 실제 AI 확인(Actions run 36296950517): 「매일」 → 「아니 그런 뜻 아니야」(AI 정리 거둠 · 원문 복제는 다른 칸에 남음) → 화면 정정(주말).
// 정정 시점에 그 칸의 옛 값은 이미 RETRACTED 라 밀린 값(SUPERSEDED)이 없었고, 다른 칸의 원문 복제 「매일」이 Matching 에 남았다.
test('C7 거절로 거둔 옛 해석의 원문 복제도, 그 칸을 사용자가 정정하면 다른 칸에서 함께 밀린다', async () => {
  const st = stale();
  st.phase = 'talk'; st.current = { type: 'core', purpose: 'relationship_style', text: '연락은 어떤 방식이 좋아요?' };
  st.turns.at(-1).reply = '매일 연락하는 게 좋으시군요.'; st.turns.at(-1).presented = undefined; // 실제 AI 답(run 36296950517)과 같은 모양 · 예전 상태처럼 기록 없음 → 답 글로 계산
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
  st.turns.at(-1).reply = '매일 연락하는 게 좋으시군요.';
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: [] }));
  const before = src(st);
  assert.ok(before.confirmed.includes(OLD), '정정 전: 사용자 원문은 그대로(거절만으로 지우지 않음)');
  A.applyTurn(st, NEW, T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한두 번 연락이 좋음', NEW)] }));
  st.slots.values_character.items[0].status = 'CONFIRMED'; // 예전 규칙 모양
  assert.ok(!src(st).confirmed.includes(OLD), JSON.stringify(src(st).confirmed));
});

// ── v2.2.3 CROSS_SLOT_STALE_STATE(2026-09-27 대표 「FINAL RELEASE CLOSING」) — QA 1차(base) 실제 FAIL 상태 그대로 ──
// 턴 A 에서 AI 가 해석을 0개 만들어 지금 질문 칸(values_character)에 원문(USER_DIRECT)만 남은 상태 → 정정 B 한 번(화면 · relationship_style).
const CAFE = '조용한 카페에서 오래 이야기하는 걸 좋아해요';
function run1State() {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편하게 대화하는 사이를 원해요', T({ extracted: [X('relationship_intent', '친구처럼 편하게 대화하는 사이를 원함', '친구처럼 편하게 대화하는 사이를 원해요')] }));
  at(st, 'attraction_comfort'); A.applyTurn(st, CAFE, T({ extracted: [] }));
  at(st, 'values_character'); A.applyTurn(st, OLD, T({ extracted: [] }));
  assert.equal(st.slots.values_character.items[0]?.source_type, 'USER_DIRECT', '전제: 다른 칸에 원문만');
  assert.equal(st.slots.relationship_style.items.length, 0, '전제: 정정 칸에 A 출처 값 0(연결 고리 없음)');
  st.phase = 'done'; st.current = null; return st;
}
const pickLlm = (wrong, seen = []) => async (kind, _sys, input) => { seen.push({ kind, input }); return JSON.stringify(kind === 'turn' ? T({ kind: 'correction', extracted: [X('relationship_style', NEW, NEW)], wrong }) : kind === 'intro' ? { intro: null } : { reply: '네.' }); };
const current = (st) => A.PURPOSES.flatMap((p) => st.slots[p.id].items.filter((i) => i.status === 'CONFIRMED').map((i) => ({ slot: p.id, ...i })));

test('X1 1차 FAIL 재현 상태 + AI 가 heard 에서 A 를 글자 그대로 고름 → A 현재값 0(모든 칸) · B 1 · Profile·Matching A 0 · 정상 사실 보존', async () => {
  const st = run1State(); await A.runTurn(st, NEW, pickLlm([OLD]), { ui: UI_STYLE });
  const now = current(st);
  assert.equal(now.filter((i) => i.turn === 3).length, 0, JSON.stringify(now));
  assert.deepEqual(now.filter((i) => i.source_type === 'USER_CORRECTED').map((i) => i.note), [NEW]);
  assert.equal(status(st, 'attraction_comfort', CAFE), 'CONFIRMED'); assert.equal(status(st, 'relationship_intent', '친구처럼 편하게 대화하는 사이를 원함'), 'CONFIRMED');
  const prof = A.matchingProfile(st); const profNotes = A.PURPOSES.flatMap((p) => (prof[p.id]?.items ?? []).map((i) => i.note));
  assert.ok(!profNotes.includes(OLD) && profNotes.includes(NEW), JSON.stringify(profNotes));
  const s = src(st).confirmed; assert.ok(!s.includes(OLD) && s.includes(NEW) && s.includes(CAFE), JSON.stringify(s));
  assert.ok(st.slots.relationship_style.items.find((i) => i.note === NEW).corrected_from.includes(OLD), '고친 값 이력에 A');
});
test('X2 AI 가 고른 A 와 같은 출처(같은 turn · 같은 원문)의 다른 칸 복제도 함께 빠진다 · 다른 원문은 보존', async () => {
  const st = run1State();
  st.slots.boundaries.items.push({ note: '매일 연락', quote: `${OLD}.`, turn: 3, source: 'answer', status: 'CONFIRMED', source_type: 'AI_EXTRACTED', confirmed_at: 'x' });
  st.slots.boundaries.items.push({ note: '매일 연락은 싫지 않음', quote: '다른 말', turn: 3, source: 'answer', status: 'CONFIRMED', source_type: 'AI_EXTRACTED', confirmed_at: 'x' });
  await A.runTurn(st, NEW, pickLlm([OLD]), { ui: UI_STYLE });
  assert.equal(status(st, 'boundaries', '매일 연락'), 'SUPERSEDED', '같은 출처 복제');
  assert.equal(status(st, 'boundaries', '매일 연락은 싫지 않음'), 'CONFIRMED', '원문이 다르면 보존(유사도 삭제 0)');
});
test('X3 서버는 글자까지 같은 항목만: 없는 문장·비슷한 문장을 골라도 아무것도 안 지움', async () => {
  for (const w of [['연락은 매일 하는 게 좋음'], ['매일 연락'], ['없는 문장']]) {
    const st = run1State(); await A.runTurn(st, NEW, pickLlm(w), { ui: UI_STYLE });
    assert.equal(status(st, 'values_character', OLD), 'CONFIRMED', JSON.stringify(w)); assert.equal(status(st, 'attraction_comfort', CAFE), 'CONFIRMED');
  }
});
test('X4 AI 가 아무것도 고르지 않으면 서버는 추측으로 지우지 않는다(뜻 유사도 삭제 0 — 실제 AI 반복검사로 놓침을 잰다)', async () => {
  const st = run1State(); await A.runTurn(st, NEW, pickLlm([]), { ui: UI_STYLE });
  assert.equal(status(st, 'values_character', OLD), 'CONFIRMED');
});
test('X5 정정 턴 입력: heard 에 모든 칸 저장 항목(note 그대로) · 화면 정정 안내에 「다른 칸이어도 wrong 에 note 그대로」', async () => {
  const st = run1State(); const seen = []; await A.runTurn(st, NEW, pickLlm([OLD], seen), { ui: UI_STYLE });
  const input = seen.find((x) => x.kind === 'turn').input; const inp = typeof input === 'string' ? JSON.parse(input) : input;
  assert.ok(inp.heard.some((h) => h.purpose === 'values_character' && h.note === OLD), JSON.stringify(inp.heard));
  assert.match(inp.ui_correction.note, /다른 칸에 있어도 wrong 에 note 글자 그대로/);
});
test('X6 거절(repair)에서는 새 연결 처리 없음 — 기존 규칙 그대로(사용자 원문은 거절만으로 안 지움)', async () => {
  const st = run1State(); st.phase = 'talk'; at(st, 'boundaries');
  A.applyTurn(st, '아니 그런 뜻 아니야', T({ kind: 'repair', wrong: [] }));
  assert.equal(status(st, 'values_character', OLD), 'CONFIRMED');
});

// ── v2.2.4 옛 항목 고르기(정정 턴에만 · 번호 목록에서 고름) — QA 실제 AI 20회 중 1회(x02): 대화 응답의 wrong 이 비어 A 가 남음 ──
const pickerLlm = (stale, seen = []) => async (kind, _sys, input) => { seen.push({ kind, input }); if (kind === 'pick') { if (stale === 'throw') throw new Error('boom'); return JSON.stringify(stale); } return JSON.stringify(kind === 'turn' ? T({ kind: 'correction', extracted: [X('relationship_style', NEW, NEW)], wrong: [] }) : kind === 'intro' ? { intro: null } : { reply: '네.' }); };
const idxOf = (seen, note) => (seen.find((x) => x.kind === 'pick').input.items.find((i) => i.note === note) ?? {}).n;

test('X7 대화 응답 wrong 이 비어도(x02 실제 모양) 고르기 단계가 A 번호를 고르면 A 현재값 0 · B 1 · 카페 보존 · Matching A 0', async () => {
  const st = run1State(); const seen = [];
  const probe = run1State(); const s0 = []; await A.runTurn(probe, NEW, pickerLlm({ stale: [] }, s0), { ui: UI_STYLE });
  const n = idxOf(s0, OLD); assert.ok(n, '목록에 A 가 번호로 있음');
  await A.runTurn(st, NEW, pickerLlm({ stale: [n] }, seen), { ui: UI_STYLE });
  assert.equal(current(st).filter((i) => i.turn === 3).length, 0);
  assert.equal(status(st, 'attraction_comfort', CAFE), 'CONFIRMED');
  const s = src(st).confirmed; assert.ok(!s.includes(OLD) && s.includes(NEW) && s.includes(CAFE), JSON.stringify(s));
  const pick = seen.find((x) => x.kind === 'pick').input; assert.equal(pick.latest, NEW);
  assert.ok(pick.items.every((i) => Number.isInteger(i.n) && typeof i.note === 'string'), '번호 · 문장 그대로');
});
test('X8 고르기 단계: 목록 밖 번호·형식 오류·호출 실패 → 아무것도 안 지우고 대화는 정상', async () => {
  for (const bad of [{ stale: [99, 0, -1, 'x'] }, { nope: 1 }, 'throw']) {
    const st = run1State(); const r = await A.runTurn(st, NEW, pickerLlm(bad), { ui: UI_STYLE });
    assert.ok(!r.response.error, JSON.stringify(r.response)); assert.equal(status(st, 'values_character', OLD), 'CONFIRMED'); assert.equal(status(st, 'attraction_comfort', CAFE), 'CONFIRMED');
    assert.equal(status(st, 'relationship_style', NEW), 'CONFIRMED');
  }
});
test('X9 고르기 단계는 정정 턴에만(일반 답·거절에는 호출 0)', async () => {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st); const seen = [];
  const llm = async (kind, s, input) => { seen.push(kind); return JSON.stringify(kind === 'turn' ? T({ kind: 'answer', extracted: [X('relationship_intent', '친구', '친구처럼')] }) : { reply: '네.' }); };
  await A.runTurn(st, '친구처럼 편한 사이요', llm);
  assert.ok(!seen.includes('pick'), JSON.stringify(seen));
});
