// v2.5.4(2026-09-29 대표 「HUMAN MIRROR CONVERSATION」) — QA run 36574334013 의 FAIL 「어떤 주제로 대화하는 게 편할까요?」가 다시 나가지 않는지. 가짜 AI 출력(Mock)만 넣는다.
// AGENT_SRC 로 다른 판(예: v2.5.3)을 넣으면 역검사(수정 전 FAIL)를 볼 수 있다. 실행: node --test qa/human-mirror-v254.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'v254-'));
const emit = (file, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
const here = (p) => new URL(p, import.meta.url).pathname;
emit(here('../supabase/functions/doit-agent/matching.ts'), 'matching.mjs');
const A = await import(emit(process.env.AGENT_SRC || here('../supabase/functions/doit-agent/agent.ts'), 'agent.mjs'));

const X = (purpose, note, quote) => ({ purpose, note, quote });
const N = (purpose, question) => ({ type: 'core', purpose, question, hint: '' });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const start = (goal = 'friend') => { const st = A.newState({ tone: 'polite', goal }); A.seedFirstQuestion(st); return st; };
const PHRASE = '돈 관계는 싫고 천천히 대화하면서 스며드는 친구를 만나고 싶어요';
const STIFF = '어떤 주제로 대화하는 게 편할까요?';
const turnOut = (q) => JSON.stringify(T({ reply: '오, 그런 느낌 좋죠.', extracted: [X('relationship_intent', '천천히 스며드는 친구를 원함', '천천히 대화하면서 스며드는 친구'), X('boundaries', '돈 관계는 싫음', '돈 관계는 싫고')], next: N('relationship_style', q) }));

test('v2.5.4 정보 종류를 묻는 질문은 사람 말이 아니다(사용자가 그 말을 직접 쓴 경우만 문맥 허용)', () => {
  for (const q of [STIFF, '어떤 얘기를 나누면 좋을까요?', '어떤 대화를 좋아해요?', '어떤 걸 같이 하고 싶어요?', '어떤 활동이 좋아요?', '어떤 방식으로 연락해요?', '얼마나 자주 보고 싶어요?']) {
    assert.ok(A.stiffQuestion(q, PHRASE), q);
  }
  assert.ok(!A.stiffQuestion('천천히 알아가려면 처음엔 연락부터가 편해요?', PHRASE));
  assert.ok(!A.stiffQuestion('진짜? 어떤 고양이 좋아하는데?', '고양이 너무 좋지'), '구체적인 것을 묻는 「어떤」은 괜찮다');
  assert.ok(!A.infoKindQuestion('얼마나 자주 보는 게 좋아요?', '너무 자주 보는 건 부담스러워요'), '사용자가 「자주」를 직접 말했으면 문맥상 허용');
  assert.ok(A.infoKindQuestion('얼마나 자주 보는 게 좋아요?', PHRASE));
  assert.ok(A.genericPersonQuestion('어떤 친구와 대화가 잘 통할까요?'), 'v2.5.5 run 36575134665 실제 질문');
  assert.ok(A.genericPersonQuestion('어떤 사람이 편해요?'));
  assert.ok(!A.genericPersonQuestion('친구랑은 주로 뭐 하면서 놀아요?'));
});

test('v2.5.4 세 번 청해도 설문형이면 그대로 내보내지 않고 질문 한 문장만 다시 청한다', async () => {
  const st = start();
  const seen = [];
  const llm = async (kind, _system, input) => {
    seen.push(kind);
    if (kind === 'turn') return turnOut(STIFF);
    if (kind === 'question') { assert.equal(input.latest, PHRASE); assert.ok(input.bad_tries.includes(STIFF), '실패한 질문을 알려 준다'); return JSON.stringify({ question: '천천히 가려면 처음엔 연락부터가 편해요?' }); }
    return JSON.stringify({ reply: '오, 좋죠.' });
  };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(r.response.question, '천천히 가려면 처음엔 연락부터가 편해요?');
  assert.ok(r.obs.retry.includes('question_rewrite'));
  assert.equal(seen.filter((k) => k === 'turn').length, 3, '대화 청하기 횟수(MAX_CALLS_PER_TURN)는 그대로');
  assert.ok(!st.asked.some((a) => a.text === STIFF), '설문형 질문은 물은 질문으로 남지 않음');
  assert.equal(st.slots.boundaries.status, 'CONFIRMED', '저장·상태 처리는 그대로');
});

test('v2.5.4 다시 청한 질문도 설문형이면 다른 목적으로 한 번 더, 그래도 안 되면 서버 안내 한 줄(설문 문장 0)', async () => {
  const st = start();
  const purposes = [];
  const llm = async (kind, _system, input) => {
    if (kind === 'turn') return turnOut(STIFF);
    if (kind === 'question') { purposes.push(input.want_to_learn); return JSON.stringify({ question: '어떤 활동을 함께하고 싶으세요?' }); }
    return JSON.stringify({ reply: '오, 좋죠.' });
  };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(purposes.length, 2, '같은 목적 한 번 + 다른 목적 한 번');
  assert.notEqual(purposes[0], purposes[1]);
  assert.equal(r.response.question, A.fillFallbackText('polite'));
  assert.ok(!A.infoKindQuestion(r.response.question, PHRASE) && !A.surveyQuestion(PHRASE, r.response.question));
  assert.ok(r.obs.retry.includes('question_fallback'));
});

test('v2.5.4 앞선 시도 중 규칙을 지킨 질문이 있으면 서버 안내보다 그것을 쓴다', async () => {
  const st = start();
  let n = 0;
  const llm = async (kind) => {
    if (kind === 'turn') { n++; return n === 1 ? JSON.stringify(T({ reply: '그렇군요.', extracted: [X('relationship_intent', '천천히 스며드는 친구를 원함', '천천히 대화하면서 스며드는 친구')], next: N('relationship_style', '처음엔 가볍게 연락부터 해 볼까요?') })) : turnOut(STIFF); }
    if (kind === 'question') return JSON.stringify({ question: '' });
    return JSON.stringify({ reply: '오, 좋죠.' });
  };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(r.response.question, '처음엔 가볍게 연락부터 해 볼까요?');
  assert.ok(r.obs.retry.includes('question_from_try'));
});

test('v2.5.4 첫 청하기에서 사람 말이면 추가 호출 0', async () => {
  const st = start();
  const seen = [];
  const llm = async (kind) => { seen.push(kind); return kind === 'turn' ? turnOut('천천히면 처음엔 연락부터가 편해요?') : JSON.stringify({ reply: '오, 좋죠.' }); };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(r.response.question, '천천히면 처음엔 연락부터가 편해요?');
  assert.deepEqual(seen, ['turn']);
});

test('v2.5.4 지시문: 「대화 주제」로 유도하던 예시를 빼고 한 걸음 옆 장면 기준을 둔다(질문 배열 0)', () => {
  const s = readFileSync(here('../supabase/functions/doit-agent/agent.ts'), 'utf8');
  assert.ok(!s.includes('처음 만났을 때 무슨 얘기부터 하고 싶어요?'));
  assert.ok(!s.includes('대화 주제처럼 실제 장면으로'));
  assert.match(s, /한 걸음만 옆으로 묻는다/);
  assert.match(s, /echo-agent-v2\.5\.5/);
});
