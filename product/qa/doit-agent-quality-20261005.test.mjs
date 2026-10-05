// doit-agent 질문 품질(2026-10-04~05 QA 대표 실기기) — 가짜 AI 기준(실제 AI 품질 판정 아님). 실행: node --test qa/doit-agent-quality-20261005.test.mjs
// 확인: ① 처음 세 질문 = 보기 3~4개 먼저 펼침 · 네 번째부터 자유 입력 먼저 ② 처음 세 질문에 AI 가 만남 준비(연락·카톡·장소·약속 잡기)로 끌고 가지 않음
//       — 사용자가 먼저 꺼낸 말(「카페에서 얘기하는 게 좋아」)을 잇는 것은 허용 · 「약속 시간 잘 지키는 게 중요해요?」는 가치 질문이라 허용
//       ③ 버튼 글자를 「~라는 말」로 따와 묻지 않음 ④ 나뉜 답(「남자면 술, 여자면 카페」)의 한쪽만 묻지 않음 ⑤ 보기를 가리키는 질문은 보기와 함께만
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'q1005-'));
const emit = (file, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
const here = (p) => new URL(p, import.meta.url).pathname;
emit(here('../supabase/functions/doit-agent/matching.ts'), 'matching.mjs');
const A = await import(emit(process.env.AGENT_SRC || here('../supabase/functions/doit-agent/agent.ts'), 'agent.mjs'));

const PURPOSE_BUTTON = '연애로 이어질 만남을 원해요';
const QS = ['연애할 때 마음이 먼저 가는 순간이 언제예요?', '다정하면 어떨 때 마음이 가요?', '조용히 들어주면 뭐가 제일 좋아요?', '솔직한 연인이면 뭐가 달라져요?'];
const CH = [['말이 잘 통할 때', '챙겨줄 때', '웃어줄 때'], ['말을 잘 들어줄 때', '먼저 챙겨줄 때', '같이 웃을 때'], ['마음이 편해짐', '생각이 정리됨', '위로받는 느낌'], ['믿음이 생김', '다툼이 줄어듦', '편하게 말함']];
const ANS = [PURPOSE_BUTTON, '다정한 사람이 좋아요', '조용히 들어주면 편해요', '솔직한 게 제일 중요해요'];
const PURP = ['attraction_comfort', 'values_character', 'boundaries', 'relationship_style'];
const turnJson = (o) => JSON.stringify({ kind: 'answer', understood: '', reply: '좋아요', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '', hint: '', choices: [] }, ...o });
const fresh = (goal = 'romantic') => { const st = A.newState({ tone: 'polite', goal }); A.seedFirstQuestion(st); return st; };
// 처음 질문 셋을 이미 한 상태(만남 준비 금지 구간이 끝남)
const afterThree = () => { const st = fresh(); for (let i = 0; i < 3; i++) st.asked.push({ type: 'core', purpose: PURP[i], text: QS[i] }); st.current = st.asked.at(-1); return st; };

test('① 처음 세 질문은 보기 3~4개를 먼저 펼치고, 네 번째 질문은 자유 입력이 먼저', async () => {
  assert.equal(A.OBJECTIVE_FIRST_QUESTIONS, 3);
  const st = fresh();
  for (let i = 0; i < 3; i++) {
    const llm = async (kind) => kind === 'turn' ? turnJson({ extracted: i ? [] : [{ purpose: 'relationship_intent', note: '연애로 이어질 만남', quote: PURPOSE_BUTTON }], next: { type: 'core', purpose: PURP[i], question: QS[i], hint: '', choices: CH[i] } }) : '{}';
    const { response } = await A.runTurn(st, ANS[i], llm);
    assert.equal(response.question, QS[i], `q${i + 1}`);
    const v = A.rescueView(st);
    assert.equal(v.show, true, `q${i + 1} 보기 먼저 펼침`); assert.ok(v.options.length >= 3 && v.options.length <= 4, `q${i + 1} 보기 3~4개`);
  }
  // 네 번째: 처음 세 질문을 마친 상태에서 새 질문 → 보기를 먼저 펼치지 않음
  const st4 = afterThree();
  st4.turns.push({ n: 1, ai: A.FIRST_QUESTION, question_purpose: 'relationship_intent', question_type: 'core', user: PURPOSE_BUTTON, kind: 'answer', saved: true });
  assert.equal(A.objectiveFirstNext(st4), false);
  const llm4 = async (kind) => kind === 'turn' ? turnJson({ next: { type: 'core', purpose: PURP[3], question: QS[3], hint: '', choices: CH[3] } }) : '{}';
  const { response } = await A.runTurn(st4, ANS[3], llm4);
  assert.equal(response.question, QS[3]);
  assert.equal(A.rescueView(st4).show, false, 'q4 는 자유 입력 먼저(보기는 구조 요청 때)');
});

test('② 처음 세 질문: AI 가 꺼낸 만남 준비 질문은 막고, 사용자가 꺼낸 말을 잇는 질문은 허용', () => {
  const st = fresh();
  for (const q of ['원해요 라는 말이 들어가면 먼저 카톡을 해보는 게 편해요?', '처음엔 어디서 만나면 편해요?', '약속은 언제 잡는 게 좋아요?', '연락은 얼마나 자주 하면 좋아요?'])
    assert.equal(A.logisticsFlaw(st, q), 'logistics_early', q);
  // 사용자가 먼저 꺼낸 장소·연락 이야기를 이어 묻는 것은 AI 가 끌고 간 것이 아니다
  assert.equal(A.logisticsFlaw(st, '카페에서 얘기할 때 무슨 얘기가 제일 재밌어요?', false, '카페에서 얘기하는 게 좋아'), '');
  assert.equal(A.logisticsFlaw(st, '연락 자주 하는 사람이면 뭐가 좋아요?', false, '연락 자주 하는 사람이 좋아요'), '');
  // 사용자가 한 낱말만 꺼냈는데 AI 가 다른 만남 준비까지 얹으면 막는다
  assert.equal(A.logisticsFlaw(st, '카페에서 만나면 약속은 언제 잡아요?', false, '카페가 좋아'), 'logistics_early');
  // 「약속 시간 잘 지키는」·「몇 번이고」는 사람됨 이야기 — 만남 준비가 아니다
  assert.equal(A.logisticsFlaw(st, '약속 시간 잘 지키는 게 중요해요?'), '');
  assert.equal(A.logisticsQuestion('몇 번이고 다시 말해 주는 사람이 좋아요?'), false);
  assert.equal(A.logisticsQuestion('한 달에 몇 번 만나면 좋아요?'), true);
});

test('② 처음 세 질문 뒤에는 만남 준비 질문이 대화에 한 번까지', () => {
  const st = afterThree();
  assert.equal(A.logisticsFlaw(st, '처음엔 어디서 만나면 편해요?'), '', '네 번째부터 한 번은 허용');
  st.asked.push({ type: 'core', purpose: 'relationship_style', text: '처음엔 어디서 만나면 편해요?' }); st.current = st.asked.at(-1);
  assert.equal(A.logisticsFlaw(st, '연락은 얼마나 자주 하면 좋아요?'), 'logistics', '두 번째는 막음');
});

test('③ 버튼 글자를 「~라는 말」로 따와 묻는 질문은 막는다(QA 실기기 문장)', async () => {
  assert.ok(A.metaQuote('원해요 라는 말이 들어가면 먼저 카톡을 해보는 게 편해요?'));
  assert.ok(!A.metaQuote('연애할 때 마음이 먼저 가는 순간이 언제예요?'));
  const st = fresh();
  const BAD = '원해요 라는 말이 들어가면 먼저 카톡을 해보는 게 편해요?';
  const llm = async (kind) => kind === 'turn' ? turnJson({ next: { type: 'core', purpose: 'attraction_comfort', question: BAD, hint: '', choices: CH[0] } })
    : kind === 'question' ? JSON.stringify({ question: QS[0], choices: CH[0] }) : JSON.stringify({ choices: CH[0] });
  const { response } = await A.runTurn(st, PURPOSE_BUTTON, llm);
  assert.notEqual(response.question, BAD);
  assert.ok(!/라는\s*말|카톡/.test(String(response.question)), String(response.question));
});

test('④ 나뉜 답(「남자면 술, 여자면 카페」)은 한쪽만 이어 묻지 않는다', () => {
  assert.ok(A.conditionalAnswer('처음 만나면 남자면 술 여자면 카페'));
  assert.ok(!A.conditionalAnswer('카페가 좋아요'));
  assert.ok(!A.keepsCondition('처음 만나면 남자면 술 여자면 카페', '술 마시면 어떤 얘기 해요?'));
  assert.ok(A.keepsCondition('처음 만나면 남자면 술 여자면 카페', '남자랑 여자랑 다르게 하는 이유가 있어요?'));
});

test('⑤ 「이런 것 중」처럼 보기를 가리키는 질문은 보기 2개 이상과 함께일 때만', () => {
  assert.ok(A.refersToChoices('이런 것 중 뭐가 좋아요?'));
  assert.ok(A.refersToChoices('다음 중 골라 주세요?'));
  assert.ok(!A.refersToChoices('어떤 사람한테 마음이 가요?'));
});

// Codex 리뷰(PR #132 · b8574d8) P2 세 건 재현 — 보기를 가리키는 질문인데 보기가 없을 때(enforceChoiceContract)
const choiceRefState = (q, latest = '조용한 사람이 좋아요') => {
  const st = afterThree();
  st.turns.push({ n: 1, ai: QS[2], question_purpose: 'boundaries', question_type: 'core', user: latest, kind: 'answer', saved: true, question: q });
  const cur = { type: 'core', purpose: 'relationship_style', text: q };
  st.asked.push(cur); st.current = cur;
  return st;
};
const obsOf = () => ({ calls: [], retry: [] });

test('Codex P2 ①: 「아래」는 보기를 가리킬 때만 보기 질문(「나이가 아래인」은 아님)', () => {
  assert.equal(A.refersToChoices('나보다 나이가 아래인 사람이 편해요?'), false);
  assert.equal(A.refersToChoices('아래 보기 중에 뭐가 가까워요?'), true);
  assert.equal(A.refersToChoices('아래 중에 뭐가 좋아요?'), true);
});

test('Codex P2 ②: 보기 질문을 바꿔 쓸 때도 일반 질문 검사를 모두 거친다(물음표 두 개 · 설문형 · 나뉜 답 한쪽)', async () => {
  const Q0 = '이런 것 중 뭐가 더 좋아요?';
  for (const [bad, latest] of [['조용한 사람이 좋아요? 아니면 활발한 사람이 좋아요?', '조용한 사람이 좋아요'], ['남자면 술 마시면 어떤 얘기 해요?', '처음 만나면 남자면 술 여자면 카페'], ['조용하면 어떨 때 제일 편해요?', '평일이면 조용한 사람, 주말이면 활발한 사람이 좋아요']]) {
    const st = choiceRefState(Q0, latest);
    const response = { question: Q0 };
    const llm = async (kind) => kind === 'question' ? JSON.stringify({ question: bad }) : JSON.stringify({ choices: [] });
    await A.enforceChoiceContract(st, llm, obsOf(), response);
    assert.notEqual(response.question, bad, `바꿔 쓴 질문이 검사를 건너뛰었다: ${bad}`);
    assert.ok(!A.refersToChoices(response.question));
  }
});

test('Codex P2 ③: 서버 안내 두 줄을 이미 썼으면 이미 한 질문을 다시 내지 않는다', async () => {
  const Q0 = '이런 것 중 뭐가 더 좋아요?';
  const st = afterThree();
  for (const t of [A.talkFallbackText('polite'), A.fillFallbackText('polite')]) st.asked.splice(1, 0, { type: 'core', purpose: 'relationship_style', text: t });
  st.turns.push({ n: 1, ai: QS[2], question_purpose: 'boundaries', question_type: 'core', user: '조용한 사람이 좋아요', kind: 'answer', saved: true, question: Q0 });
  const cur = { type: 'core', purpose: 'relationship_style', text: Q0 }; st.asked.push(cur); st.current = cur;
  const before = st.asked.slice(0, -1).map((a) => a.text);
  const response = { question: Q0 };
  const llm = async () => { throw new Error('rewrite failed'); };
  await A.enforceChoiceContract(st, llm, obsOf(), response);
  assert.ok(!before.includes(response.question), `이미 한 질문을 다시 냄: ${response.question}`);
  assert.equal(response.question, A.easeFallbackText('polite'), '세 번째 안내(보기 가리킴 0)');
  assert.ok(!A.refersToChoices(response.question));
  // 세 안내를 모두 썼으면: 이미 한 질문을 내지 않고 그대로 둔다(기록만)
  const st2 = afterThree();
  for (const t of [A.talkFallbackText('polite'), A.fillFallbackText('polite'), A.easeFallbackText('polite')]) st2.asked.splice(1, 0, { type: 'core', purpose: 'relationship_style', text: t });
  st2.turns.push({ n: 1, ai: QS[2], question_purpose: 'boundaries', question_type: 'core', user: '조용한 사람이 좋아요', kind: 'answer', saved: true, question: Q0 });
  const cur2 = { type: 'core', purpose: 'relationship_style', text: Q0 }; st2.asked.push(cur2); st2.current = cur2;
  const before2 = st2.asked.slice(0, -1).map((a) => a.text); const r2 = { question: Q0 }; const o2 = obsOf();
  await A.enforceChoiceContract(st2, llm, o2, r2);
  assert.ok(!before2.includes(r2.question)); assert.ok(o2.retry.includes('choice_ref_unresolved'));
});
