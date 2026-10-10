// 출시 차단 P0(2026-09-27 대표 「RELEASE BLOCKER FIX」) — 운영 doit-agent agent.ts 의 정정·거절 반영 검사.
// P0-3 끝난 뒤 정정 → 소개도 지금 상태로 · P0-4 표현이 조금 다른 거절도 같은 잘못된 뜻을 거둠(다른 사실은 지움 0) · P0-5 화면의 정정 버튼 = 정정(모델 추측 0).
// 가짜 AI 출력(LLM 후보)만 넣는다(실제 AI 품질 판정 아님). 실행: node --test qa/p0-release-blockers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { AGENT_DEP, AGENT_DEP_URL } from './agent-deps.mjs';

const src = readFileSync(new URL('../supabase/functions/doit-agent/agent.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(AGENT_DEP, AGENT_DEP_URL);
const file = path.join(mkdtempSync(path.join(tmpdir(), 'agent-p0-')), 'agent.mjs');
writeFileSync(file, js);
const A = await import(pathToFileURL(file).href);

const sq = (t) => String(t ?? '').replace(/\s/g, '');
const X = (purpose, note, quote) => ({ purpose, note, quote });
const turnOut = (o = {}) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const items = (st, id) => st.slots[id].items.map((i) => [i.note, i.status]);
const live = (st, id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.note);
const introText = (st) => (st.intro?.lines ?? []).map((l) => l.text).join(' ');

// 가짜 AI: 종류별 대본. intro 는 함수 또는 값(다시 쓰기 결과). 'THROW' 면 공급자 오류.
function fakeLlm({ turn = [], closing = null, intro = null } = {}) {
  const q = [...turn]; const calls = [];
  const llm = async (kind, _sys, input) => {
    calls.push({ kind, input });
    const v = kind === 'turn' ? q.shift() : kind === 'closing' ? closing : kind === 'intro' ? (typeof intro === 'function' ? intro(input) : intro) : null;
    if (v === 'THROW') throw new Error('provider');
    return JSON.stringify(v ?? {});
  };
  return { llm, calls };
}

// 대화를 마친 상태: 「매일 연락하는 게 좋아」 · 소개 「저는 매일 연락하는 관계가 좋아요.」(ready).
async function finished() {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  const { llm } = fakeLlm({
    turn: [turnOut({ extracted: [X('relationship_intent', '친구 같은 만남', '친구 만나고 싶어'), X('relationship_style', '매일 연락하는 게 좋다', '매일 연락하는 게 좋아')] })],
    closing: { summary: [], closing: '고마워요.', intro: [{ text: '저는 친구 같은 만남을 원해요.', basis: '친구 만나고 싶어' }, { text: '저는 매일 연락하는 관계가 좋아요.', basis: '매일 연락하는 게 좋아' }] },
  });
  const r = await A.runTurn(st, '친구 만나고 싶어. 매일 연락하는 게 좋아', llm);
  assert.equal(r.response.finish, true); assert.equal(st.intro.status, 'ready'); assert.match(introText(st), /매일/);
  return st;
}
const UI_STYLE = { correction: true, purpose: 'relationship_style' };

// ── P0-3 · T1 대화 완료 → 정정 → Profile 최신값 → 소개 최신값
test('T1 P0-3: 끝난 뒤 정정하면 프로필과 소개 모두 최신 값(옛 값 문장 0)', async () => {
  const st = await finished();
  const { llm } = fakeLlm({
    turn: [turnOut({ kind: 'correction', extracted: [X('relationship_style', '주말에만 연락이 좋다', '주말에만 연락하는 게 좋아')] })],
    intro: { intro: [{ text: '저는 친구 같은 만남을 원해요.', basis: '친구 만나고 싶어' }, { text: '주말에만 연락하는 게 좋아요.', basis: '주말에만 연락하는 게 좋아' }] },
  });
  const r = await A.runTurn(st, '주말에만 연락하는 게 좋아', llm, { ui: UI_STYLE });
  assert.equal(r.response.after, true);
  assert.deepEqual(live(st, 'relationship_style'), ['주말에만 연락이 좋다']);
  assert.ok(!/매일/.test(introText(st)), `소개에 옛 값 0: ${introText(st)}`);
  assert.match(introText(st), /주말/, '소개에 최신 값');
  assert.equal(st.intro.status, 'ready');
  assert.equal(st.intro.used, null, '바뀐 소개는 다시 저장 확인을 받는다');
});

test('T1b P0-3: 소개 다시 쓰기가 실패해도 옛 값 문장은 남지 않는다(남은 문장은 지금 상태로 다시 거름)', async () => {
  for (const intro of ['THROW', { intro: [{ text: '저는 매일 연락하는 관계가 좋아요.', basis: '매일 연락하는 게 좋아' }] }]) {
    const st = await finished();
    const { llm } = fakeLlm({ turn: [turnOut({ kind: 'correction', extracted: [X('relationship_style', '주말에만 연락이 좋다', '주말에만 연락하는 게 좋아')] })], intro });
    await A.runTurn(st, '주말에만 연락하는 게 좋아', llm, { ui: UI_STYLE });
    assert.ok(!/매일/.test(introText(st)), `옛 값 0 (${intro === 'THROW' ? '공급자 오류' : '옛 문장 재생산'}): ${introText(st)}`);
    assert.match(introText(st), /친구/, '바뀌지 않은 문장은 지킨다');
  }
});

test('T1c P0-3: 소개 다시 쓰기가 새 사실을 지어내면 버린다(근거 없는 문장 0)', async () => {
  const st = await finished();
  const { llm } = fakeLlm({ turn: [turnOut({ kind: 'correction', extracted: [X('relationship_style', '주말에만 연락이 좋다', '주말에만 연락하는 게 좋아')] })],
    intro: { intro: [{ text: '저는 등산을 좋아하는 사람이에요.', basis: '등산' }, { text: '주말에만 연락하는 게 좋아요.', basis: '주말에만 연락하는 게 좋아' }] } });
  await A.runTurn(st, '주말에만 연락하는 게 좋아', llm, { ui: UI_STYLE });
  assert.ok(!/등산/.test(introText(st)), introText(st));
});

// ── P0-4 · T2~T4 거절
function withNotes(notes, text = '진지하게 만날 사람 찾아. 진지한 사람이 좋아') {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, text, turnOut({ extracted: notes }));
  assert.equal(notes.every((n) => st.slots[n.purpose].items.some((i) => i.note === n.note && i.status === 'CONFIRMED')), true, '준비: 뜻이 저장됨');
  return st;
}
test('T2 P0-4: 글자가 같은 거절은 전처럼 거둔다(회귀 0)', () => {
  const st = withNotes([X('relationship_intent', '진지한 연애를 원함', '진지하게 만날 사람 찾아')]);
  A.applyTurn(st, '아니 그런 뜻 아니야', turnOut({ kind: 'repair', wrong: ['진지한 연애를 원함'] }));
  assert.deepEqual(live(st, 'relationship_intent'), []);
});
test('T3 P0-4: 표현만 조금 다른 거절도 같은 잘못된 뜻을 거둔다', () => {
  const st = withNotes([X('relationship_intent', '진지한 연애를 원함', '진지하게 만날 사람 찾아')]);
  A.applyTurn(st, '아니 그런 뜻 아니야', turnOut({ kind: 'repair', wrong: ['진지한 연애'] }));
  assert.deepEqual(live(st, 'relationship_intent'), [], JSON.stringify(items(st, 'relationship_intent')));
  assert.ok(A.rejectedNotes(st).includes(sq('진지한 연애를 원함')), '거둔 뜻은 소개·질문에서 막힌다');
});
test('T4 P0-4 역검사: 비슷하지만 다른 사실 · 반대 뜻 · 사용자 원문 · 오래된 말 · 거절이 아닌 말은 지우지 않는다', () => {
  let st = withNotes([X('relationship_intent', '진지한 연애를 원함', '진지하게 만날 사람 찾아'), X('values_character', '진지한 사람이 좋음', '진지한 사람이 좋아')]);
  A.applyTurn(st, '아니 그런 뜻 아니야', turnOut({ kind: 'repair', wrong: ['진지한 연애'] }));
  assert.deepEqual(live(st, 'values_character'), ['진지한 사람이 좋음'], '비슷한 단어의 다른 사실은 그대로');
  st = withNotes([X('relationship_style', '연락은 자주', '연락은 자주 하는 게 좋아')], '연락은 자주 하는 게 좋아');
  A.applyTurn(st, '아니 그게 아니라', turnOut({ kind: 'repair', wrong: ['연락은 자주 안 해도 됨'] }));
  assert.deepEqual(live(st, 'relationship_style'), ['연락은 자주'], '반대 뜻(부정)이 한쪽에만 있으면 다른 뜻');
  st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '진지한 연애 하고 싶어요', turnOut()); // AI 가 못 뽑아 사용자 원문 그대로 저장(USER_DIRECT)
  assert.equal(st.slots.relationship_intent.items[0]?.source_type, 'USER_DIRECT');
  A.applyTurn(st, '아니 그런 뜻 아니야', turnOut({ kind: 'repair', wrong: ['진지한 연애'] }));
  assert.equal(live(st, 'relationship_intent').length, 1, '사용자 원문은 글자가 같을 때만 거둔다');
  st = withNotes([X('relationship_intent', '진지한 연애를 원함', '진지하게 만날 사람 찾아')]);
  for (const t of ['조용한 사람이 좋아', '약속 잘 지키는 사람', '천천히 알아가고 싶어']) A.applyTurn(st, t, turnOut());
  A.applyTurn(st, '아니 그런 뜻 아니야', turnOut({ kind: 'repair', wrong: ['진지한 연애'] }));
  assert.deepEqual(live(st, 'relationship_intent'), ['진지한 연애를 원함'], '방금 보인 해석이 아닌 오래된 말은 글자 일치 때만');
  st = withNotes([X('relationship_intent', '진지한 연애를 원함', '진지하게 만날 사람 찾아')]);
  A.applyTurn(st, '아까 말했잖아', turnOut({ kind: 'repair', wrong: ['진지한 연애'] }));
  assert.deepEqual(live(st, 'relationship_intent'), ['진지한 연애를 원함'], '거절이 아닌 항의에는 표현 비교로 지우지 않는다');
});

// ── P0-5 · T5·T6 화면 정정 버튼
test('T5 P0-5: 화면 정정 버튼은 모델이 answer·repair 로 읽어도 정정으로 확정 · 고른 칸의 옛 값은 밀림', async () => {
  for (const kind of ['answer', 'repair', 'correction']) {
    const st = await finished();
    const { llm } = fakeLlm({ turn: [turnOut({ kind, extracted: [X('relationship_style', '주말에만 연락이 좋다', '주말에만 연락하는 게 좋아')] })], intro: { intro: [{ text: '주말에만 연락하는 게 좋아요.', basis: '주말에만 연락하는 게 좋아' }] } });
    const r = await A.runTurn(st, '주말에만 연락하는 게 좋아', llm, { ui: UI_STYLE });
    assert.equal(r.response.kind, 'correction', kind);
    assert.deepEqual(live(st, 'relationship_style'), ['주말에만 연락이 좋다'], kind);
    assert.equal(st.slots.relationship_style.items.find((i) => i.status === 'CONFIRMED').source_type, 'USER_CORRECTED');
  }
});
test('T5b P0-5: 모델이 고른 칸에서 아무것도 못 뽑으면 사용자가 고친 말 그대로가 그 칸의 새 값', async () => {
  const st = await finished();
  const { llm } = fakeLlm({ turn: [turnOut({ kind: 'answer', extracted: [X('boundaries', '엉뚱한 칸', '주말에만')] })], intro: 'THROW' });
  await A.runTurn(st, '주말에만 연락하는 게 좋아', llm, { ui: UI_STYLE });
  assert.deepEqual(live(st, 'relationship_style'), ['주말에만 연락하는 게 좋아']);
  assert.deepEqual(live(st, 'boundaries'), [], '고른 칸 밖으로 새지 않는다');
});
test('T5c P0-5: 예전 앱 문장 「「칸」 부분을 고칠게요. …」도 서버가 화면 정정으로 알아본다(모델 추측 0)', () => {
  const label = A.PURPOSES.find((p) => p.id === 'relationship_style');
  assert.ok(label);
  const u = A.uiCorrectionFrom({ text: `「${A.UI_PURPOSE_LABELS.relationship_style}」 부분을 고칠게요. 주말에만 연락하는 게 좋아` });
  assert.deepEqual(u, { correction: true, purpose: 'relationship_style', text: '주말에만 연락하는 게 좋아' });
  assert.deepEqual(A.uiCorrectionFrom({ text: '주말에만 연락하는 게 좋아', correction: { purpose: 'relationship_style' } }), { correction: true, purpose: 'relationship_style', text: '주말에만 연락하는 게 좋아' });
  assert.deepEqual(A.uiCorrectionFrom({ text: '다시 말하면 천천히 알아가고 싶어', correction: { purpose: null } }), { correction: true, purpose: null, text: '다시 말하면 천천히 알아가고 싶어' });
  assert.equal(A.uiCorrectionFrom({ text: '주말에만 연락하는 게 좋아' }), null, '표시가 없으면 보통 말');
  assert.equal(A.uiCorrectionFrom({ text: 'x', correction: { purpose: 'drop_table' } }), null, '모르는 칸은 받지 않음');
});
test('T6 P0-5: 정정 뒤 같은 칸에 옛 값과 새 값이 함께 CONFIRMED 인 상태 0', async () => {
  const st = await finished();
  const { llm } = fakeLlm({ turn: [turnOut({ kind: 'answer', extracted: [X('relationship_style', '주말에만 연락이 좋다', '주말에만 연락하는 게 좋아')] })], intro: 'THROW' });
  await A.runTurn(st, '주말에만 연락하는 게 좋아', llm, { ui: UI_STYLE });
  assert.equal(live(st, 'relationship_style').length, 1, JSON.stringify(items(st, 'relationship_style')));
  assert.ok(items(st, 'relationship_style').some(([n, s]) => n === '매일 연락하는 게 좋다' && s === 'SUPERSEDED'));
});

test('역검사: 화면 정정이 아닌 보통 끝난 뒤 말 · 대화 중 보통 답은 전과 같다(소개 다시 쓰기 0)', async () => {
  const st = await finished();
  const before = JSON.stringify(st.intro);
  const { llm, calls } = fakeLlm({ turn: [turnOut({ kind: 'answer' })] });
  await A.runTurn(st, '고마워요', llm);
  assert.equal(JSON.stringify(st.intro), before, '바뀐 것이 없으면 소개 그대로');
  assert.ok(!calls.some((c) => c.kind === 'intro'), '소개 AI 호출 0');
});
