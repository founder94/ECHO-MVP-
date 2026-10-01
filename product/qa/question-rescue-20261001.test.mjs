// 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE · FINAL LOCK」 — 주관식 본체 + 객관식 구조대(서버 계약 · 가짜 AI 출력만).
// Q1~Q14 의 서버·화면 코드 계약. Q15(320~430px 넘침)와 화면 동작은 qa-browser/ux-flow.mjs 가 본다. 실제 AI 장면 A~E 는 qa-real/qa-core-live.mjs.
// 실행: node --test qa/question-rescue-20261001.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'rescue-'));
const emit = (file, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
const here = (p) => new URL(p, import.meta.url).pathname;
emit(here('../supabase/functions/doit-agent/matching.ts'), 'matching.mjs');
const A = await import(emit(here('../supabase/functions/doit-agent/agent.ts'), 'agent.mjs'));
const UI = readFileSync(here('../src/doit/components/feature/AgentConversation.tsx'), 'utf8');
const API = readFileSync(here('../src/doit/lib/agentApi.ts'), 'utf8');
const INDEX = readFileSync(here('../supabase/functions/doit-agent/index.ts'), 'utf8');

const X = (purpose, note, quote) => ({ purpose, note, quote });
const N = (purpose, question, choices = []) => ({ type: 'core', purpose, question, hint: '', choices });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const start = (goal = 'friend') => { const st = A.newState({ tone: 'polite', goal }); A.seedFirstQuestion(st); return st; };
const live = (st) => Object.values(st.slots).flatMap((s) => s.items.filter((i) => i.status === 'CONFIRMED'));
const profileText = (st) => JSON.stringify(A.matchingProfile(st));
// 가짜 AI: 대화 출력과 보기 호출(RESCUE_PROMPT)을 따로 준다.
const fake = (turns, rescue = []) => { const calls = []; const llm = async (kind, _s, input) => { calls.push({ kind, input }); if (kind === 'choices') return JSON.stringify(rescue.length ? rescue.shift() : { choices: [] }); if (kind === 'turn') return JSON.stringify(turns.shift() ?? T()); if (kind === 'question') return JSON.stringify({ question: '', choices: [] }); return JSON.stringify({ reply: '' }); }; llm.calls = calls; return llm; };
const FIRST = T({ reply: '좋죠.', extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('relationship_style', '처음 만나면 어디가 편해요?', ['조용한 카페', '같이 걷기', '밥 먹으면서']) });
// 첫 답은 서버 결정 함수(applyTurn)로 바로 넣는다(질문 다듬기 재청 경로와 무관하게 같은 상태에서 시작).
const afterFirst = async () => { const st = start(); A.applyTurn(st, '편하게 얘기할 친구를 찾고 있어요', structuredClone(FIRST)); return st; };

test('Q1 질문 본체는 늘 주관식: 보통 답 뒤 보기는 서버가 들고만 있고 먼저 펼치지 않는다 · 화면은 입력칸을 늘 그린다', async () => {
  const st = await afterFirst();
  assert.equal(st.current.text, '처음 만나면 어디가 편해요?');
  assert.deepEqual(A.rescueView(st), { options: ['조용한 카페', '같이 걷기', '밥 먹으면서'], symbols: ['☕', '🚶', '🍽️'], show: false, fallback: false });
  assert.match(UI, /\{!done && <form className="echo-composer"/, '대화 중에는 주관식 입력칸이 늘 있다');
  assert.match(UI, /\{rescueOpen && <div className="echo-rescue"/, '보기는 펼쳤을 때만');
  assert.match(UI, /const rescueOpen = !!question && !editingPrevious && \(rescueFor\?\.q === question \? rescueFor\.open : !!rescue\?\.show\);/, '펼침 = 내가 누름(A·B) 또는 서버가 먼저 펼침(C·D)');
  assert.ok(!/current_choices\.map/.test(UI), '예전처럼 보기를 늘 바로 그리지 않는다');
});

test('Q2 도움 요청(잘 모르겠어요 누름) → 보기 2~4개: 서버가 들고 있으면 AI 호출 0 · 없으면 보기만 청해 거른다', async () => {
  const st = await afterFirst();
  const llm = fake([]);
  const r = await A.requestRescue(st, llm);
  assert.equal(r.ok, true); assert.equal(llm.calls.length, 0, '이미 있는 보기 → AI 호출 0');
  assert.equal(A.rescueView(st).show, true); assert.equal(st.turns.length, 1, '구조 요청은 턴이 아니다(답 저장 0)');
  // 첫 질문(앱 타일 질문)처럼 보기가 없는 질문: 보기만 한 번 청한다 · 5개 와도 4개까지
  const s2 = start();
  const llm2 = fake([], [{ choices: ['연애하고 싶어요', '친구가 필요해요', '대화 상대요', '취미 친구', '운동 친구'] }]);
  await A.requestRescue(s2, llm2);
  assert.deepEqual(llm2.calls.map((c) => c.kind), ['choices']);
  assert.equal(A.rescueView(s2).options.length, 4); assert.equal(A.rescueView(s2).show, true);
  assert.equal(llm2.calls[0].input.question, A.FIRST_QUESTION, '지금 질문에 대한 보기를 청한다');
  assert.match(INDEX, /if \(action === "agent_rescue"\)/); assert.match(API, /action: 'agent_rescue'/);
});

test('Q3 보기는 질문의 답이어야 한다: 도움말·회피·예/아니요·막연함·질문 되풀이는 서버가 뺀다(RESCUE_OPTIONS_NOT_ANSWERING_QUESTION)', () => {
  const r = A.screenChoices(null, ['잘 모르겠어요', '넘어갈게요', '직접 말할게요', '상관없어요', '네, 좋아요', '그냥', '처음 만나면 어디가 편해요', '조용한 카페', '같이 걷기'], '처음 만나면 어디가 편해요?');
  assert.deepEqual(r.choices, ['조용한 카페', '같이 걷기']);
  assert.deepEqual(r.fi, ['RESCUE_OPTIONS_NOT_ANSWERING_QUESTION']);
  assert.ok(r.dropped.length >= 7);
});

test('Q4 「잘 모르겠어요」는 사용자 사실이 아니다(모델이 answer 로 읽고 뭘 뽑아도 저장 0)', async () => {
  const st = await afterFirst();
  const before = live(st).length;
  const r = A.applyTurn(st, '잘 모르겠어요', T({ kind: 'answer', extracted: [X('relationship_style', '모름', '잘 모르겠어요')], next: N('values_character', '약속 잘 지키는 게 중요해요?') }));
  assert.equal(r.kind, 'unsure'); assert.equal(r.saved, false);
  assert.equal(live(st).length, before); assert.ok(!/모르겠|모름/.test(profileText(st)));
});

test('Q5 넘어가기는 사실이 아니다(SKIP · 칸은 SKIPPED · 저장 0) · 화면 버튼 글자도 같은 규칙', async () => {
  const st = await afterFirst();
  const r = A.applyTurn(st, '이 질문은 넘어갈게요', T({ kind: 'answer', extracted: [X('relationship_style', '넘어감', '넘어갈게요')], next: N('values_character', '약속 잘 지키는 게 중요해요?') }));
  assert.equal(r.kind, 'skip'); assert.equal(r.saved, false);
  assert.equal(st.slots.relationship_style.status, 'SKIPPED');
  assert.ok(!/넘어/.test(profileText(st)));
  assert.match(UI, /const SKIP_TEXT = '이 질문은 넘어갈게요';/);
});

test('Q6 「답답해요」 = 질문 피로(UX 피드백) · Profile 저장 0 · 다음 질문은 보기를 먼저 펼친다 · 「여기까지」 = STOP', async () => {
  const st = await afterFirst();
  const r = A.applyTurn(st, '답답해요', T({ kind: 'answer', extracted: [X('values_character', '답답한 성격', '답답해요')], next: N('values_character', '같이 있을 때 어떤 말투가 편해요?', ['차분한 말투', '장난스러운 말투']) }));
  assert.equal(r.kind, 'repair'); assert.equal(st.turns.at(-1).guard.rule, 'fatigue'); assert.equal(r.saved, false);
  assert.ok(!/답답/.test(profileText(st)), '답답해요는 성격 사실이 아니다(P0)');
  assert.equal(A.rescueView(st).show, true, '피로 뒤에는 서버가 보기를 먼저 펼친다(C)');
  for (const t of ['답답해', '아 진짜 답답하네요', '짜증나요']) assert.equal(A.guardKind(t, 'answer').rule, 'fatigue', t);
  assert.equal(A.guardKind('답답한 사람은 싫어요', 'answer').kind, 'answer', '답답한 사람이 싫다는 건 답이다');
  const s2 = await afterFirst();
  const r2 = A.applyTurn(s2, '오늘은 여기까지 할게요', T({ kind: 'answer', extracted: [X('boundaries', '여기까지', '여기까지 할게요')] }));
  assert.equal(r2.kind, 'stop'); assert.equal(r2.saved, false); assert.ok(!/여기까지/.test(profileText(s2)));
});

test('Q7 고른 보기 = 사용자 직접 답(USER_DIRECT · source choice) · AI 정리·추측을 얹지 않는다 · 승인 안 된 보기는 보통 말', async () => {
  const st = await afterFirst();
  const llm = fake([T({ reply: '좋죠.', extracted: [X('values_character', 'AI 가 지어낸 해석', '조용한 카페')], inferred: [{ trait: '내향적', basis: '카페' }], next: N('values_character', '약속 잘 지키는 게 중요해요?') })]);
  const r = await A.runTurn(st, '조용한 카페', llm, { choice: '조용한 카페', rescueOpen: true });
  assert.equal(r.response.saved, true);
  const t = st.turns.at(-1);
  assert.equal(t.choice, '조용한 카페'); assert.equal(t.guard.rule, 'choice_pick');
  const item = st.slots.relationship_style.items.find((i) => i.turn === t.n);
  assert.equal(item.source, 'choice'); assert.equal(item.source_type, 'USER_DIRECT', 'USER_CONFIRMED 로 올리지 않는다');
  assert.ok(!st.slots.values_character.items.length, 'AI 가 고른 것으로 처리하지 않는다(AI 정리 0)');
  assert.ok(!st.inferred.length, '추측 0');
  // 지금 질문의 승인 보기가 아니면 choice 표시는 무시된다
  const s2 = await afterFirst();
  await A.runTurn(s2, '바다 보러 가기', fake([T({ next: N('values_character', '약속 잘 지키는 게 중요해요?') })]), { choice: '바다 보러 가기' });
  assert.equal(s2.turns.at(-1).choice, undefined);
  assert.match(UI, /send\(picked, false, false, picked\)/, '화면은 고른 보기를 choice 로 보낸다');
});

test('Q8 보기를 고른 뒤 고치면(직전 답 고치기) 옛 보기는 밀린다 — Profile·Matching·다음 질문 입력에 옛 값 0', async () => {
  const st = await afterFirst();
  await A.runTurn(st, '조용한 카페', fake([T({ next: N('values_character', '약속 잘 지키는 게 중요해요?') })]), { choice: '조용한 카페' });
  const llm = fake([T({ kind: 'correction', reply: '아, 공원 산책이요.', extracted: [], next: N('values_character', '시간 약속 잘 지키는 사람이 좋아요?') })]);
  await A.runTurn(st, '사실 공원에서 산책하는 게 더 편해요', llm, { ui: { correction: true, purpose: null } });
  const old = st.slots.relationship_style.items.find((i) => i.source === 'choice');
  assert.equal(old.status, 'SUPERSEDED');
  const fresh = st.slots.relationship_style.items.find((i) => i.status === 'CONFIRMED');
  assert.equal(fresh.source_type, 'USER_CORRECTED'); assert.deepEqual(fresh.corrected_from, ['조용한 카페']);
  const p = A.matchingProfile(st);
  assert.ok(!p.relationship_style.items.some((i) => /조용한 카페/.test(i.note)), 'Matching 지금 값에 옛 보기 0');
  const next = A.turnInput(st, '다음');
  assert.ok(!JSON.stringify(next.heard).includes('조용한 카페'), '다음 질문 입력(heard)에 옛 보기 0');
});

test('Q9 「그건 다 아닌데」 = 보기 거절: AI 호출 0 · 저장 0 · 억지 없이 직접 말하게 · 그 보기·뜻은 다시 안 나오고 사실로도 안 올라간다', async () => {
  const st = await afterFirst();
  await A.requestRescue(st, fake([]));
  const llm = fake([]);
  const r = await A.runTurn(st, '그건 다 아닌데', llm, { rescueOpen: true });
  assert.equal(llm.calls.length, 0);
  assert.equal(r.response.kind, 'repair'); assert.equal(r.response.saved, false);
  assert.equal(r.response.reply, A.EXPLAIN_INVITE.polite); assert.equal(r.response.question, '처음 만나면 어디가 편해요?', '같은 질문을 주관식으로');
  assert.equal(A.rescueView(st).show, false); assert.deepEqual(A.rescueView(st).options, []);
  // 다음 질문에 AI 가 같은 보기를 다시 내면 서버가 뺀다(RESCUE_OPTIONS_REJECTED_REAPPEARANCE)
  const next = A.screenChoices(st, ['조용한 카페', '같이 걷기', '영화 보기', '전시 보기'], '주말엔 뭐 하면 좋아요?');
  assert.deepEqual(next.choices, ['영화 보기', '전시 보기']); assert.ok(next.fi.includes('RESCUE_OPTIONS_REJECTED_REAPPEARANCE'));
  // AI 가 거절된 보기를 사실로 정리해도 받지 않는다
  A.applyTurn(st, '음 그냥 조용한 데가 좋아요', T({ extracted: [X('relationship_style', '조용한 카페', '조용한 데가 좋아요')], next: N('values_character', '약속 잘 지키는 게 중요해요?') }));
  assert.ok(!live(st).some((i) => i.note === '조용한 카페' && i.source_type === 'AI_EXTRACTED'));
  assert.ok(st.turns.at(-1).fi.includes('REJECTION_REAPPEARANCE'));
});

test('Q10 이미 답한 것은 보기로 다시 내밀지 않는다(Context Memory · RESCUE_OPTIONS_ALREADY_ANSWERED)', async () => {
  const st = start();
  A.applyTurn(st, '천천히 알아가는 게 좋아요', T({ extracted: [X('relationship_style', '천천히 알아가기', '천천히 알아가는 게 좋아요')], next: N('values_character', '처음 만나면 어디가 편해요?') }));
  const r = A.screenChoices(st, ['천천히 알아가기', '조용한 카페', '같이 걷기'], '처음 만나면 어디가 편해요?');
  assert.deepEqual(r.choices, ['조용한 카페', '같이 걷기']); assert.ok(r.fi.includes('RESCUE_OPTIONS_ALREADY_ANSWERED'));
  // 실제 AI QA D1(2026-10-01): 「연락은 주말에 한두 번」을 이미 말했는데 보기 「주말에 자주 연락」 — 글자가 달라도 핵심 낱말 둘이 겹치면 뺀다
  const s2 = start();
  A.applyTurn(s2, '연락은 주말에 한두 번이면 충분해요', T({ extracted: [X('relationship_style', '주말에 한두 번 연락', '연락은 주말에 한두 번')], next: N('values_character', '처음 만나면 뭐 하고 싶어요?') }));
  const r2 = A.screenChoices(s2, ['주말에 자주 연락', '주말에 가끔 연락', '주말에 전화하기', '같이 영화 보기'], '처음 만나면 뭐 하고 싶어요?');
  assert.deepEqual(r2.choices, ['주말에 전화하기', '같이 영화 보기']);
  // 실제 AI QA D1 재검(2026-10-01): 속도 칸이 확정이면 속도·횟수를 묻는 질문은 다시 청하고(covered), 속도 보기는 뺀다
  assert.equal(A.questionFlaw(s2, '솔직한 사람이 편해요', '주말에 연락하면 더 자주 만나고 싶나요?', false), 'covered');
  assert.equal(A.questionFlaw(s2, '솔직한 사람이 편해요', '솔직한 친구와 주말에 만나면 좋나요?', false), '');
  assert.deepEqual(A.screenChoices(s2, ['자주 만나고 싶어요', '가끔 만나도 좋아요', '카페에서 수다', '같이 영화 보기']).choices, ['카페에서 수다', '같이 영화 보기']);
  assert.equal(A.questionFlaw(start(), '친구요', '친구랑 얼마나 자주 만나면 좋아요?', false) === 'covered', false, '속도를 아직 안 들었으면 막지 않는다');
});

test('Q11 뒤로·직전 답 고치기: 직전 질문 · 고른 보기 · 보기 목록을 되살린다(서버 previous) · 고친 말은 정정으로', () => {
  assert.match(INDEX, /function previousView\(st: A\.AgentState\)/);
  assert.match(INDEX, /previous: done \? null : previousView\(st\)/);
  assert.match(UI, /const prevChoice = editingPrevious && session\.previous && session\.previous\.question === previousQuestion \? session\.previous : null;/);
  assert.match(UI, /aria-pressed=\{draft\.trim\(\) === choice\}/, '고른 보기가 고른 표시로 돌아온다');
  assert.match(UI, /setEditingPrevious\(true\); setDraft\(lastAnswerRef\.current\);/, '뒤로 = 직전 답(고른 보기 글자)을 입력칸에');
});

test('Q12 「직접 설명할게요」 = 보기를 접고 주관식으로(언제든)', () => {
  assert.match(UI, /const explainSelf = \(\) => \{ if \(session\?\.current_question\) setRescueFor\(\{ q: session\.current_question, open: false \}\); setPick\(null\); requestAnimationFrame\(\(\) => draftRef\.current\?\.focus\(\)\); \};/);
  assert.match(UI, />직접 설명할게요<\/button>/);
  assert.match(UI, /if \(event\.target\.value\.trim\(\)\) setPick\(null\);/, '직접 적기 시작하면 고른 보기는 풀린다');
});

test('Q13 보기는 2~4개(5개 이상 0 · 1개면 보기 없음) · 보기를 눌러도 바로 넘어가지 않는다', () => {
  assert.equal(A.cleanChoices(['가', '나나', '다다', '라라', '마마', '바바']).length, 4);
  assert.deepEqual(A.cleanChoices(['조용한 카페']), []);
  assert.equal(A.CHOICE_LIMIT, 4); assert.equal(A.CHOICE_MIN, 2);
  assert.match(UI, /onClick=\{\(\) => \{ setPick\(picked === choice \? null : \{ q: question, choice \}\);/, '누르면 고른 표시만');
  assert.ok(!/echo-choice[^\n]*onClick=\{\(\) => send\(choice\)\}/.test(UI), '보기 탭으로 바로 보내지 않는다');
});

test('Q14 보기에 내부·분류 말 0 · 「잘 모르겠어요」를 보기에 섞지 않는다 · 금지어 0', () => {
  const r = A.screenChoices(null, ['활동 선호', '외향형', '내향적인 성향', 'relationship_style', 'casual talk', '소개팅 느낌', '조용한 카페', '같이 걷기']);
  assert.deepEqual(r.choices, ['조용한 카페', '같이 걷기']);
  const st = start(); st.current.choices = ['조용한 카페', '같이 걷기'];
  assert.deepEqual(A.choicesFor(st), ['조용한 카페', '같이 걷기']);
  assert.ok(!A.choicesFor(st).includes(A.CHOICE_UNSURE));
});

test('FI: 보기를 끝내 못 만들면 안전 안내(fallback)만 · RESCUE_OPTIONS_MISSING · 구조대 작동으로 세지 않는다', async () => {
  const st = start();
  const r = await A.requestRescue(st, fake([], [{ choices: ['잘 모르겠어요', '네'] }]));
  assert.ok(r.fi.includes('RESCUE_OPTIONS_MISSING'));
  assert.deepEqual(A.rescueView(st), { options: [], symbols: [], show: false, fallback: true });
  assert.ok(st.fi_pending.includes('RESCUE_OPTIONS_MISSING'), '다음 턴 기록에 붙는다');
  A.applyTurn(st, '편하게 얘기할 친구요', T({ extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('relationship_style', '처음 만나면 어디가 편해요?') }));
  assert.ok(st.turns.at(-1).fi.includes('RESCUE_OPTIONS_MISSING'));
  assert.match(UI, /<button type="button" className="echo-choice" disabled=\{!!busy\} onClick=\{explainSelf\}>직접 설명할게요<\/button>/);
  assert.match(UI, /onClick=\{\(\) => send\(UNSURE_TEXT\)\}>잘 모르겠어요<\/button>/);
  assert.match(UI, /onClick=\{\(\) => send\(SKIP_TEXT\)\}>이 질문은 넘어갈게요<\/button>/);
});

test('원인 고정: 항의·피로 턴의 「그럼 이런 느낌 중엔 뭐가 가까워요?」는 보기를 잃지 않는다 · 고르기 모양 질문은 먼저 펼친다(D)', async () => {
  const st = await afterFirst();
  const r = A.applyTurn(st, '질문이 너무 많아요', T({ kind: 'repair', next: N('values_character', A.choiceQuestionText('polite'), ['말 잘 통하는 사람', '약속 잘 지키는 사람']) }));
  assert.equal(r.question, A.choiceQuestionText('polite'));
  assert.deepEqual(A.rescueView(st), { options: ['말 잘 통하는 사람', '약속 잘 지키는 사람'], symbols: ['', ''], show: true, fallback: false });
  // 「첫 만남은 어떤 분위기로…」: AI 가 보기를 빼먹으면 서버가 보기만 다시 청한다(도움 요청 때)
  const s2 = start();
  A.applyTurn(s2, '편하게 얘기할 친구요', T({ extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('relationship_style', '첫 만남은 어떤 분위기로 하고 싶으세요?') }));
  assert.deepEqual(A.rescueView(s2).options, []);
  await A.requestRescue(s2, fake([], [{ choices: ['조용하고 편하게', '밝고 가볍게', '밥 먹으면서'] }]));
  assert.deepEqual(A.rescueView(s2), { options: ['조용하고 편하게', '밝고 가볍게', '밥 먹으면서'], symbols: ['🫧', '🫧', '🍽️'], show: true, fallback: false });
});

test('A-PREMIUM 심볼: 서버가 정해 둔 생활형 심볼 1개만(감정 이모지·하트 0) · 맞는 게 없으면 빈 칸', () => {
  assert.equal(A.optionSymbol('조용한 카페가 좋아요'), '☕');
  assert.equal(A.optionSymbol('같이 걸으면 편해요'), '🚶');
  assert.equal(A.optionSymbol('밥 먹으면서 천천히요'), '🍽️');
  assert.equal(A.optionSymbol('그날 분위기 따라요'), '🌿');
  assert.equal(A.optionSymbol('약속 잘 지키는 사람'), '');
  const src = readFileSync(here('../supabase/functions/doit-agent/agent.ts'), 'utf8');
  const set = src.slice(src.indexOf('const OPTION_SYMBOLS'), src.indexOf('export const optionSymbol'));
  assert.doesNotMatch(set, /😂|😍|🥹|❤|💕|💘|😊/);
  assert.ok((set.match(/"[^"]+"\]/g) ?? []).length <= 12, '12개 이하');
});
