// v2.4.7(2026-09-29 대표 「POST-RELEASE CLOSING」) — GF-117 정정 계약 · GF-118 반복 질문으로 멈춤 0 · 준비 답 = 지금도 확정인 답. 가짜 AI 출력(Mock)만 넣는다(실제 AI 품질 판정 아님).
// AGENT_SRC 로 다른 판(예: 운영 v2.4.6)을 넣으면 역검사(수정 전 FAIL)를 볼 수 있다. 실행: node --test qa/agent-v247-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'v247-'));
const emit = (file, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
const here = (p) => new URL(p, import.meta.url).pathname;
const A = await import(emit(process.env.AGENT_SRC || here('../supabase/functions/doit-agent/agent.ts'), 'agent.mjs'));

const X = (purpose, note, quote) => ({ purpose, note, quote });
const N = (purpose, question) => ({ type: 'core', purpose, question, hint: '' });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const live = (st, id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED');
const allLive = (st) => A.PIDS.flatMap((id) => live(st, id).map((i) => `${i.note} ${i.quote}`)).join(' | ');
const start = (goal = 'friend') => { const st = A.newState({ tone: 'polite', goal }); A.seedFirstQuestion(st); return st; };
const script = (turns) => { const q = [...turns]; return async (kind) => kind === 'turn' ? JSON.stringify(q.shift() ?? {}) : kind === 'pick' ? JSON.stringify({ stale: [] }) : JSON.stringify({ summary: [], closing: '고마워요.', intro: [] }); };
const LOUD = '술 마시면서 시끌벅적한 곳이 좋아요';
const CAFE = '아니요, 카페에서 이야기하는 게 좋아요';
// 기존 사실: 「술 마시면서 시끌벅적한 곳이 좋아요」(원문 그대로 저장 · AI 는 뜻을 바꿔 받아줌 = 운영 실측 GF-117 모양)
function loudState() {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('attraction_comfort', '친구랑 어디서 이야기하는 게 좋아요?') }));
  A.applyTurn(st, LOUD, T({ reply: '즐겁고 활기찬 분위기가 중요하겠네요.', extracted: [], next: N('values_character', '대화할 때 어떤 점이 가장 중요하다고 생각하세요?') }));
  assert.ok(live(st, 'attraction_comfort').some((i) => i.quote === LOUD), '전제: 원문이 확정 사실');
  assert.equal(st.turns.at(-1).presented, undefined, '전제: 보인 AI 해석 기록 없음(운영 실측과 같음)');
  return st;
}

test('A · 열린 질문에 「아니요 + 앞 칸의 새 값」을 모델도 정정으로 읽음 → 바로 정정 · 옛 값 지금 사실 0 · 이력 보존 · 지금 질문 거절 기록 0', () => {
  const st = loudState();
  const r = A.applyTurn(st, CAFE, T({ kind: 'correction', extracted: [X('attraction_comfort', '카페에서 이야기하는 걸 좋아함', '카페에서 이야기하는 게 좋아요')], next: N('values_character', '대화할 때 어떤 점이 가장 중요하세요?') }));
  assert.equal(r.kind, 'correction');
  assert.ok(!/시끌벅적/.test(allLive(st)), allLive(st));
  const fresh = live(st, 'attraction_comfort').find((i) => /카페/.test(i.note));
  assert.equal(fresh?.source_type, 'USER_CORRECTED');
  assert.ok((fresh.corrected_from ?? []).some((n) => /시끌벅적/.test(n)), '정정 이력(corrected_from)');
  assert.ok(st.slots.attraction_comfort.items.some((i) => i.quote === LOUD && i.status === 'SUPERSEDED'), '옛 값은 지우지 않고 SUPERSEDED');
  assert.equal(st.disputed.length, 0);
  const p = A.matchingProfile(st);
  assert.ok(!p.confirmed_preferences.some((n) => /시끌벅적/.test(n)) && p.confirmed_preferences.some((n) => /카페/.test(n)));
  assert.equal(p.rejected_meanings.length, 0);
});

test('A′ · 운영 실측 모양(모델 answer · 아무것도 못 뽑음) → 지우지도 저장하지도 않고 한 번 확인 → 「네」 = 정정 · 기록은 원문', async () => {
  const st = loudState();
  const r0 = A.applyTurn(st, CAFE, T({ kind: 'answer', extracted: [], next: N('relationship_style', '얼마나 자주 만나고 싶어요?') }));
  assert.equal(r0.kind, 'fix_check');
  assert.match(r0.question, /술 마시면서 시끌벅적한 곳이 좋아요/);
  assert.match(r0.question, /고치는 뜻이 맞나요\?$/);
  assert.equal(r0.saved, false);
  assert.ok(live(st, 'attraction_comfort').some((i) => i.quote === LOUD), '확인 전 삭제 0');
  assert.ok(!/카페/.test(allLive(st)), '확인 전 새 값 저장 0');
  assert.equal(st.current.purpose, 'values_character', '지금 질문은 그대로');
  const out = await A.runTurn(st, '네', script([T({ kind: 'correction', extracted: [], next: N('relationship_style', '얼마나 자주 만나고 싶어요?') })]));
  assert.equal(out.response.kind, 'correction');
  assert.equal(out.response.saved, true);
  assert.equal(out.response.record_text, CAFE);
  assert.ok(!/시끌벅적/.test(allLive(st)));
  assert.ok(live(st, 'attraction_comfort').some((i) => /카페/.test(i.note) && i.source_type === 'USER_CORRECTED'), '모델이 못 뽑아도 사용자 말 그대로가 그 칸의 새 값');
  assert.equal(st.turns.at(-1).user, '네');
  assert.equal(A.matchingProfile(st).attraction_comfort.items[0].source_user_text, CAFE, '계보의 원문 = 확인한 말');
  assert.equal(st.pending_fix, null);
});

test('A‴ · QA 실측 모양(앞말은 원문으로 한 칸 · 모델은 새 값을 제3의 칸으로) → 보통 답으로 넘기지 않고 한 번 확인 → 「네」면 앞 칸에서 정정', async () => {
  const st = loudState();
  const r0 = A.applyTurn(st, CAFE, T({ kind: 'repair', extracted: [X('relationship_style', '카페에서 이야기하는 게 좋아요', '카페에서 이야기하는 게 좋아요')], next: N('boundaries', '피하고 싶은 게 있나요?') }));
  assert.equal(r0.kind, 'fix_check');
  assert.ok(live(st, 'attraction_comfort').some((i) => i.quote === LOUD) && !/카페/.test(allLive(st)));
  await A.runTurn(st, '네', script([T({ kind: 'correction', extracted: [X('relationship_style', '카페에서 이야기함', '카페에서 이야기하는 게 좋아요')], next: N('boundaries', '피하고 싶은 게 있나요?') })]));
  assert.ok(!/시끌벅적/.test(allLive(st)), allLive(st));
  assert.ok(live(st, 'attraction_comfort').some((i) => /카페/.test(i.note)), '새 값은 고친 그 칸(앞 턴 칸)에');
});

test('A″ · 확인에 「아니요」 → 그때 말은 지금 질문의 보통 답 · 기존 사실 그대로 · 다른 말이면 확인을 접고 새 말 처리', async () => {
  const st = loudState();
  A.applyTurn(st, CAFE, T({ kind: 'answer', extracted: [], next: N('relationship_style', '얼마나 자주 만나고 싶어요?') }));
  const out = await A.runTurn(st, '아니요', script([T({ kind: 'answer', extracted: [], next: N('relationship_style', '얼마나 자주 만나고 싶어요?') })]));
  assert.equal(out.response.kind, 'answer');
  assert.ok(live(st, 'attraction_comfort').some((i) => i.quote === LOUD), '기존 사실 그대로');
  assert.ok(live(st, 'values_character').some((i) => i.quote === CAFE), '지금 질문(values)의 답으로 원문 저장');
  const st2 = loudState();
  A.applyTurn(st2, CAFE, T({ kind: 'answer', extracted: [], next: N('relationship_style', '얼마나 자주?') }));
  await A.runTurn(st2, '솔직한 사람이 좋아요', script([T({ extracted: [X('values_character', '솔직한 사람이 좋음', '솔직한 사람이 좋아요')], next: N('relationship_style', '얼마나 자주 만나고 싶어요?') })]));
  assert.equal(st2.pending_fix, null);
  assert.ok(live(st2, 'attraction_comfort').some((i) => i.quote === LOUD) && live(st2, 'values_character').some((i) => /솔직/.test(i.note)));
});

test('B · 예/아니요 질문 「산책하는 건 좋아하세요?」에 「아니요, 저는 카페에서 이야기하는 게 좋아요」 → 보통 답 · 삭제 0 · 질문 거절 기록 0', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('relationship_style', '주로 언제 만나고 싶어요?') }));
  A.applyTurn(st, '주말 오후가 좋아요', T({ extracted: [X('relationship_style', '주말 오후를 선호함', '주말 오후가 좋아요')], next: N('attraction_comfort', '산책하는 건 좋아하세요?') }));
  for (const kind of ['answer', 'repair', 'correction']) {
    const s2 = structuredClone(st);
    const r = A.applyTurn(s2, '아니요, 저는 카페에서 이야기하는 게 좋아요', T({ kind, extracted: [X('attraction_comfort', '카페에서 이야기하는 걸 좋아함', '카페에서 이야기하는 게 좋아요')] }));
    assert.equal(r.kind, 'answer', kind);
    assert.ok(live(s2, 'relationship_style').some((i) => /주말/.test(i.note)), `${kind}: 다른 확정 사실 삭제 0`);
    assert.equal(s2.disputed.length, 0, `${kind}: 질문 거절 기록 0`);
    assert.ok(live(s2, 'attraction_comfort').some((i) => /카페/.test(i.note)));
  }
});

test('C · 「그런 뜻 아니야」 — 거둘 AI 해석이 없으면 사용자 사실 삭제 0 · 한 줄 확인', () => {
  const st = loudState();
  const r = A.applyTurn(st, '아니, 그런 뜻 아니야', T({ kind: 'repair' }));
  assert.ok(live(st, 'attraction_comfort').some((i) => i.quote === LOUD));
  assert.equal(r.question, A.DISPUTE_CHECK);
});

test('E · 정정 반복 A → B → C: 지금 사실 = C 하나 · 이력 = A/B · Profile·Matching 재료 = C 만', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], next: N('relationship_style', '연락은 얼마나 자주 하고 싶어요?') }));
  A.applyTurn(st, '연락은 매일 하는 게 좋아요', T({ extracted: [X('relationship_style', '매일 연락', '연락은 매일 하는 게 좋아요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거워요?') }));
  A.applyTurn(st, '아니요, 일주일에 두 번 연락이 좋아요', T({ kind: 'correction', extracted: [X('relationship_style', '일주일에 두 번 연락', '일주일에 두 번 연락이 좋아요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거워요?') }));
  A.applyTurn(st, '아니요, 주말에 한 번 연락이 좋아요', T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한 번 연락', '주말에 한 번 연락이 좋아요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거워요?') }));
  assert.deepEqual(live(st, 'relationship_style').map((i) => i.note), ['주말에 한 번 연락']);
  const hist = st.slots.relationship_style.items.filter((i) => i.status !== 'CONFIRMED').map((i) => i.note);
  assert.ok(hist.includes('매일 연락') && hist.includes('일주일에 두 번 연락'), JSON.stringify(hist));
  const p = A.matchingProfile(st);
  assert.deepEqual(p.relationship_style.items.map((i) => i.note), ['주말에 한 번 연락']);
  assert.ok(!p.confirmed_preferences.some((n) => /매일|두 번/.test(n)));
  assert.equal(A.matchingHandoff(p).criteria.relationship_style.join(), '주말에 한 번 연락');
});

test('D · 화면 「고치기」는 그대로 정정(모델 종류와 무관)', async () => {
  const st = loudState();
  const { response: r } = await A.runTurn(st, '카페에서 이야기하는 게 좋아요', script([T({ kind: 'answer', extracted: [X('attraction_comfort', '카페에서 이야기함', '카페에서 이야기하는 게 좋아요')] })]), { ui: { correction: true, purpose: 'attraction_comfort' } });
  assert.equal(r.kind, 'correction');
  assert.ok(!/시끌벅적/.test(allLive(st)));
});

test('준비 답 수 = 지금도 확정 사실이 남은 저장 답(정정으로 밀린 답 · 모르겠다 · AI 추측은 0)', () => {
  const st = start();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [X('relationship_intent', '친구를 만나고 싶음', '친구를 만나고 싶어요')], inferred: [{ trait: '외향적', basis: '만나고 싶어요' }], next: N('relationship_style', '연락은 얼마나 자주 하고 싶어요?') }));
  A.applyTurn(st, '연락은 매일 하는 게 좋아요', T({ extracted: [X('relationship_style', '매일 연락', '연락은 매일 하는 게 좋아요')], next: N('attraction_comfort', '친구랑 뭘 하면 즐거워요?') }));
  assert.equal(A.savedAnswers(st), 2);
  A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure' }));
  assert.equal(A.savedAnswers(st), 2, '모르겠다 0');
  A.applyTurn(st, '아니요, 주말에 한 번 연락이 좋아요', T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한 번 연락', '주말에 한 번 연락이 좋아요')] }), { uiCorrection: true });
  assert.equal(A.savedAnswers(st), 2, '정정으로 밀린 답은 세지 않고 새 답 1개');
  assert.equal(A.readiness(st).ready, false);
});

// ── GF-118
function fullButFour() {
  // 답 3개로 다섯 칸이 다 찼고 저장 답은 4개(운영 실측 b 모양) — 이제 더 묻기(fill) 단계
  const st = start();
  const say = (text, ex, next) => A.applyTurn(st, text, T({ extracted: ex, next }));
  say('친구를 만나고 싶어요', [X('relationship_intent', '친구를 원함', '친구를 만나고 싶어요')], N('attraction_comfort', '친구와 함께 하고 싶은 활동이나 장소가 있나요?'));
  say('주말에 카페에서 이야기 나눌 친구를 찾고 있어요', [X('attraction_comfort', '카페에서 이야기', '카페에서 이야기 나눌'), X('relationship_style', '주말에 만남', '주말에')], N('values_character', '친구를 만나는 빈도는 어떤 편인가요?'));
  say('대화가 잘 통하고 편한 사람이 좋아요', [X('values_character', '대화가 잘 통하는 사람', '대화가 잘 통하고'), X('relationship_style', '편한 사람', '편한 사람이 좋아요')], N('boundaries', '친구 사이에서 부담스럽거나 피하고 싶은 것이 있나요?'));
  assert.equal(A.savedAnswers(st), 3);
  return st;
}
test('GF-118 · 더 묻기 질문이 이미 한 질문과 같으면 다른 칸으로 다시 청해 이어 간다(멈춤 0)', async () => {
  const st = fullButFour();
  const dup = st.asked.at(-1).text;
  const out = await A.runTurn(st, '약속을 잘 지키는 사람이 중요해요', script([
    T({ extracted: [X('values_character', '약속을 잘 지킴', '약속을 잘 지키는 사람이 중요해요'), X('boundaries', '약속 어김이 싫음', '약속을 잘 지키는')], reply: '약속이 중요하시네요.', next: N('boundaries', dup) }),
    T({ extracted: [X('values_character', '약속을 잘 지킴', '약속을 잘 지키는 사람이 중요해요')], reply: '약속이 중요하시네요.', next: N('boundaries', dup) }),
    T({ next: N('attraction_comfort', '약속 잡을 때 카페 말고 가 보고 싶은 곳도 있어요?') }),
  ]));
  assert.equal(out.response.finish, false, `멈춤: decision=${st.turns.at(-1).decision}`);
  assert.match(out.response.question, /가 보고 싶은 곳/);
  assert.ok(out.obs.retry.includes('dup_switch'));
  assert.equal(st.phase, 'talk');
});
test('GF-118 · 다시 청해도 같은 질문이면 서버 안내 한 줄(대화에 한 번)로 이어 가고, 그 뒤에도 같으면 안전하게 마친다(무한 반복 0)', async () => {
  const st = fullButFour();
  const dup = st.asked.at(-1).text;
  const ans = (t) => T({ extracted: [X('values_character', t, t)], reply: '그렇게 보시는군요.', next: N('boundaries', dup) });
  const out = await A.runTurn(st, '약속을 잘 지키는 사람이 중요해요', script([ans('약속을 잘 지키는 사람이 중요해요'), ans('약속을 잘 지키는 사람이 중요해요'), T({ next: N('attraction_comfort', dup) })]));
  assert.equal(out.response.finish, false);
  assert.equal(out.response.question, A.fillFallbackText('polite'));
  assert.ok(out.obs.retry.includes('dup_fallback'));
  assert.equal(st.fill_fallback_used, true);
  const out2 = await A.runTurn(st, '웃음이 많은 사람이면 좋겠어요', script([ans('웃음이 많은 사람이면 좋겠어요'), ans('웃음이 많은 사람이면 좋겠어요'), T({ next: N('attraction_comfort', dup) })]));
  assert.ok(out2.response.finish === true || typeof out2.response.question === 'string', '멈추지 않거나 안전하게 마침');
  assert.ok(st.turns.length <= 7, '반복 없이 끝남');
  if (out2.response.finish) assert.equal(A.readiness(st).ready, true, `답 5개로 준비 완료: ${JSON.stringify(A.readiness(st))}`);
});
test('GF-118 역검사 · 사용자가 두 번 연속 모르겠다고 하면 더 묻지 않고 준비 미완료로 멈춘다(끝없이 묻기 0)', async () => {
  const st = fullButFour();
  await A.runTurn(st, '잘 모르겠어요', script([T({ kind: 'unsure', next: N('boundaries', '피하고 싶은 게 있어요?') })]));
  const out = await A.runTurn(st, '잘 모르겠어요', script([T({ kind: 'unsure', next: N('attraction_comfort', '다른 활동은요?') })]));
  assert.equal(out.response.finish, true);
  assert.equal(st.turns.at(-1).decision, 'finish_not_ready');
});
