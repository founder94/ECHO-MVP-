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
  assert.ok(A.genericPersonQuestion('어떤 성격의 친구가 좋을까요?'), 'QA 장면 C v60');
  assert.ok(!A.genericPersonQuestion('어떤 장난감이 좋나요?'));
  assert.ok(!A.genericPersonQuestion('친구랑은 주로 뭐 하면서 놀아요?'));
  assert.ok(A.genericPersonQuestion('편하게 대화할 수 있는 친구는 어떤 사람일까요?'), 'QA 장면 E v64');
  assert.ok(!A.genericPersonQuestion('천천히 알아갈 때 어떤 사람이면 말이 잘 이어질 것 같아요?'), '대표가 든 좋은 질문');
  assert.ok(A.analyticAck('그런 친구를 만나고 싶으시네요.'));
  assert.equal(A.tidyReply('자주 만나고 싶다는 건가요.', null), '');
  assert.equal(A.tidyReply('오, 그건 좋죠.', null), '오, 그건 좋죠.');
  // 2026-09-30 대표 마감 지시 §3 좋은 질문 후보 · 나쁜 질문
  const MONEY = '돈관계 안 하고 천천히 대화하면서 스며들고 싶어';
  for (const q of ['처음엔 어떤 얘기부터 하면 편할 것 같아요?', '그럼 처음 만날 땐 어디가 제일 편할 것 같아요?']) assert.ok(!A.infoKindQuestion(q, MONEY) && !A.surveyQuestion(MONEY, q) && !A.genericPersonQuestion(q), q);
  for (const q of ['친구를 만나는 빈도는 어떻게 되면 좋을까요?', '어떤 활동을 하고 싶으세요?', '어떤 유형의 사람이 좋으세요?', '친구 사이에서 중요하게 생각하는 점은 무엇인가요?', '어떤 관계 방식을 선호하시나요?']) assert.ok(A.surveyQuestion(MONEY, q) || A.stiffQuestion(q, MONEY) || A.genericPersonQuestion(q), q);
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

test('v2.5.5 다시 청한 질문도 설문형이면 거절 이유와 함께 한 번 더 · 다른 목적으로 한 번 더, 그래도 안 되면 서버 안내 한 줄(설문 문장 0)', async () => {
  const st = start();
  const purposes = []; const whys = [];
  const llm = async (kind, _system, input) => {
    if (kind === 'turn') return turnOut(STIFF);
    if (kind === 'question') { purposes.push(input.want_to_learn); whys.push(input.rejected?.why ?? null); return JSON.stringify({ question: '어떤 활동을 함께하고 싶으세요?' }); }
    return JSON.stringify({ reply: '오, 좋죠.' });
  };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(purposes.length, 3, 'v2.5.5 같은 목적 두 번(두 번째는 거절 이유를 알려 줌) + 다른 목적 한 번');
  assert.equal(purposes[0], purposes[1]); assert.notEqual(purposes[1], purposes[2]);
  assert.equal(whys[0], null); assert.ok(whys[1], '두 번째 다시 쓰기에 거절 이유를 알린다');
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

test('v2.5.5 QA 장면 B·C·E: 받아주기 속 숨은 질문은 빼고 · 모르겠다·정정 뒤의 새 질문도 같은 기준으로 다시 청한다', async () => {
  assert.equal(A.tidyReply('고양이 정말 귀엽죠! 어떤 고양이가 제일 마음에 들어요.', null), '고양이 정말 귀엽죠!');
  assert.equal(A.tidyReply('진짜. 어떤 고양이 좋아하는데.', null), '진짜.', 'QA 장면 B v61');
  assert.ok(!readFileSync(here('../supabase/functions/doit-agent/agent.ts'), 'utf8').includes('어떤 고양이 좋아하는데'), '베껴 쓰인 예시 문장을 지시문에서 뺐다');
  assert.equal(A.tidyReply('한 달에 몇 번 편하게 보는 게 좋다는 거예요.', null), '한 달에 몇 번 편하게 보는 게 좋다는 거예요.');
  assert.ok(A.surveyQuestion('고양이 너무 좋지', '고양이랑 놀 때 어떤 기분이 드나요?'));
  const st = start();
  A.applyTurn(st, '편하게 얘기할 친구를 찾고 있어요', T({ extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('attraction_comfort', '편하게 얘기할 친구를 카페에서 만나면 좋겠어요?') }));
  const seen = [];
  const llm = async (kind, _s, input) => {
    seen.push(kind);
    if (kind === 'turn') return JSON.stringify(T({ kind: 'unsure', reply: '괜찮아요.', next: N('relationship_style', '친구와 연락하거나 만나는 빈도는 어떻게 되면 좋을까요?') }));
    if (kind === 'question') { assert.equal(input.latest, '편하게 얘기할 친구를 찾고 있어요', '모르겠다 뒤에는 앞선 사용자 말에 기대어 묻는다'); return JSON.stringify({ question: '편하게 얘기하려면 주말이 좋아요?' }); }
    return JSON.stringify({ reply: '괜찮아요.' });
  };
  const r = await A.runTurn(st, '잘 모르겠어요', llm);
  assert.equal(r.response.kind, 'unsure'); assert.equal(r.response.saved, false);
  assert.equal(r.response.question, '편하게 얘기하려면 주말이 좋아요?');
  assert.ok(seen.includes('question'));
});

test('2026-09-30 마감 §7·§15: 휴대폰 뒤로 = 직전 답 고치기 · 브랜드 「모바일 앱 깔기」 별도 버튼 하나 → 앱 설치 카드', () => {
  const chat = readFileSync(here('../src/doit/components/feature/AgentConversation.tsx'), 'utf8');
  assert.match(chat, /addEventListener\('popstate', onPop\)/);
  assert.match(chat, /echoBackGuard/);
  assert.match(chat, /setEditingPrevious\(true\); setDraft\(lastAnswerRef\.current\)/);
  const brand = readFileSync(here('../src/pages/do-it/landing/components/BrandSections.tsx'), 'utf8');
  assert.equal((brand.match(/MOBILE_INSTALL_LABEL\}/g) ?? []).length, 1, '모바일 앱 깔기 버튼은 하나');
  assert.match(brand, /MOBILE_START_LABEL = 'ECHO 시작하기'/, '주 시작 버튼 이름 그대로');
  assert.match(brand, /INSTALL_PATH = '\/do-it\/intro\?next=app&install=1'/);
  const sheet = readFileSync(here('../src/components/InstallIntentSheet.tsx'), 'utf8');
  assert.match(sheet, /IS_APP_SITE && readIntent\(\)/);
  assert.match(sheet, /<InstallAppCard variant="menu" \/>/);
  assert.match(sheet, /pathname\.startsWith\('\/do-it\/intro'\)/, '시작 그림·인트로를 가리지 않는다');
});

test('2026-09-30 QA 장면 C 30회 중 FAIL: 모르겠다 턴의 분석형 받아주기(「아, 친구를 찾고 계시네요.」)는 짧게 다시 쓰거나 비운다', async () => {
  const st = start();
  A.applyTurn(st, '편하게 얘기할 친구를 찾고 있어요', T({ extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('attraction_comfort', '편하게 얘기할 친구와 카페에서 만나면 좋나요?') }));
  const llm = async (kind) => {
    if (kind === 'turn') return JSON.stringify(T({ kind: 'unsure', reply: '아, 친구를 찾고 계시네요.', next: N('relationship_style', '친구와 공원에서 산책하면 좋나요?') }));
    if (kind === 'ack') return JSON.stringify({ reply: '그찮, 그럴 수 있죠 다음에 천천히 생각해 봐도 돼요' });
    return JSON.stringify({ question: '' });
  };
  const r = await A.runTurn(st, '잘 모르겠어요', llm);
  assert.equal(r.response.kind, 'unsure');
  assert.equal(r.response.reply, '', '다시 쓴 받아주기도 길면 비운다');
  assert.equal(r.response.question, '친구와 공원에서 산책하면 좋나요?');
});

// 2026-09-30 QA v66 사람 검토: 장면 E 10회 중 7회가 방금 답을 거의 그대로 되물었다. 서버가 되묻기를 다시 청하고, 마지막 안내 한 줄도 짧은 이어 묻기로.
test('09-30 v66: echo of the last answer is a question flaw; the fallback line is short and not a person-type ask', () => {
  const L = '한 달에 한두 번 만나는 게 좋아요';
  assert.equal(A.echoQuestion(L, '한 달에 한두 번 만나는 게 편해요?'), true);
  assert.equal(A.echoQuestion('일주일에 세 번 만나는 게 좋아요', '일주일에 세 번 만나면 더 좋을까요?'), true);
  assert.equal(A.echoQuestion(L, '한 달에 한두 번 만나는 게 좋으면 주말이 편해요?'), false);
  assert.equal(A.echoQuestion('고양이 너무 좋지', '고양이와 함께하는 시간은 즐거워요?'), false);
  assert.equal(A.questionFlaw(start(), L, '한 달에 한두 번 만나는 게 편해요?'), 'echo');
  for (const tone of ['polite', 'casual', 'formal']) {
    const f = A.fillFallbackText(tone);
    assert.ok(f.length <= 25 && /[?？]$/.test(f), f);
    assert.equal(A.genericPersonQuestion(f), false);
    assert.equal(A.stiffQuestion(f, L), false);
  }
});

// 2026-09-30 QA v67 사람 검토: 장면 B 「어떤 친구가 좋을까요?」(사람 유형) · 장면 C 「모르겠어요면 …?」(사용자 말 옮겨 붙이기).
test('09-30 v67: mid-sentence person pick and pasted 모르겠어요 are question flaws', () => {
  assert.equal(A.genericPersonQuestion('고양이와 함께할 때 어떤 친구가 좋을까요?'), true);
  assert.equal(A.genericPersonQuestion('천천히 알아갈 때 어떤 사람이면 말이 잘 이어질 것 같아요?'), false);
  assert.equal(A.questionFlaw(start(), '잘 모르겠어요', '모르겠어요면 처음 연락은 문자로 해요?', false), 'unsure_paste');
  assert.equal(A.questionFlaw(start(), '편하게 얘기할 친구를 찾고 있어요', '친구와 처음 연락할 때 문자로 시작하면 좋나요?', false), '');
});
