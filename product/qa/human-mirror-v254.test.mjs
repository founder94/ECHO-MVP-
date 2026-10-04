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
    if (kind === 'question') { assert.equal(input.latest, PHRASE); assert.ok(input.bad_tries.includes(STIFF), '실패한 질문을 알려 준다'); return JSON.stringify({ question: '천천히 가려면 처음엔 가벼운 얘기부터가 편해요?' }); }
    return JSON.stringify({ reply: '오, 좋죠.' });
  };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(r.response.question, '천천히 가려면 처음엔 가벼운 얘기부터가 편해요?');
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
  assert.equal(r.response.question, A.talkFallbackText('polite')); // 2026-10-05 canon: 처음 세 질문엔 곳 안내 대신 이야기 쪽 안내
  assert.ok(!A.infoKindQuestion(r.response.question, PHRASE) && !A.surveyQuestion(PHRASE, r.response.question));
  assert.ok(r.obs.retry.includes('question_fallback'));
});

test('v2.5.4 앞선 시도 중 규칙을 지킨 질문이 있으면 서버 안내보다 그것을 쓴다', async () => {
  const st = start();
  let n = 0;
  const llm = async (kind) => {
    if (kind === 'turn') { n++; return n === 1 ? JSON.stringify(T({ reply: '그렇군요.', extracted: [X('relationship_intent', '천천히 스며드는 친구를 원함', '천천히 대화하면서 스며드는 친구')], next: N('relationship_style', '처음엔 가볍게 인사부터 나눠 볼까요?') })) : turnOut(STIFF); }
    if (kind === 'question') return JSON.stringify({ question: '' });
    return JSON.stringify({ reply: '오, 좋죠.' });
  };
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(r.response.question, '처음엔 가볍게 인사부터 나눠 볼까요?');
  assert.ok(r.obs.retry.includes('question_from_try'));
});

test('v2.5.4 첫 청하기에서 사람 말이면 추가 호출 0', async () => {
  const st = start();
  const seen = [];
  const llm = async (kind) => { seen.push(kind); return kind === 'turn' ? JSON.stringify({ ...JSON.parse(turnOut('천천히면 처음엔 가벼운 얘기부터가 편해요?')), next: { ...N('relationship_style', '천천히면 처음엔 가벼운 얘기부터가 편해요?'), choices: ['요즘 지내는 얘기', '좋아하는 음식 얘기', '쉬는 날 얘기'] } }) : JSON.stringify({ reply: '오, 좋죠.' }); }; // 2026-10-05 canon: 처음 세 질문은 보기 3~4개(모델이 내면 추가 호출 0)
  const r = await A.runTurn(st, PHRASE, llm);
  assert.equal(r.response.question, '천천히면 처음엔 가벼운 얘기부터가 편해요?');
  assert.deepEqual(seen, ['turn']);
});

test('v2.5.4 지시문: 「대화 주제」로 유도하던 예시를 빼고 한 걸음 옆 장면 기준을 둔다(질문 배열 0)', () => {
  const s = readFileSync(here('../supabase/functions/doit-agent/agent.ts'), 'utf8');
  assert.ok(!s.includes('처음 만났을 때 무슨 얘기부터 하고 싶어요?'));
  assert.ok(!s.includes('대화 주제처럼 실제 장면으로'));
  assert.match(s, /한 걸음만 옆으로 묻는다/);
  assert.match(s, /echo-agent-v2\.5\.8/);
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
    assert.ok(f.length <= 34 && /[?？]$/.test(f) && !/들려/.test(f), f);
    assert.equal(A.genericPersonQuestion(f), false);
    assert.equal(A.stiffQuestion(f, L), false);
  }
});

// 2026-09-30 QA v67 사람 검토: 장면 B 「어떤 친구가 좋을까요?」(사람 유형) · 장면 C 「모르겠어요면 …?」(사용자 말 옮겨 붙이기).
test('09-30 v67: mid-sentence person pick and pasted 모르겠어요 are question flaws', () => {
  assert.equal(A.genericPersonQuestion('고양이와 함께할 때 어떤 친구가 좋을까요?'), true);
  assert.equal(A.genericPersonQuestion('천천히 알아갈 때 어떤 사람이면 말이 잘 이어질 것 같아요?'), false);
  assert.equal(A.questionFlaw(start(), '잘 모르겠어요', '모르겠어요면 처음 연락은 문자로 해요?', false), 'unsure_paste');
  assert.equal(A.questionFlaw(start(), '편하게 얘기할 친구를 찾고 있어요', '친구와 처음 만나면 무슨 얘기부터 해요?', false), '');
});

// 2026-09-30 마감 지시 §4 → 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE」로 계약을 바꿨다(예전: 모르겠다 뒤에만 보기 + 서버가 「잘 모르겠어요」를 붙임).
// 지금: 새 질문마다 서버가 거른 보기 2~4개를 들고 있고(구조대), 먼저 펼치는 것은 모르겠다·넘기기·도움·피로 뒤 또는 고르기 모양 질문뿐. 「잘 모르겠어요」는 보기에 섞지 않는다(화면의 별도 도움 버튼).
test('10-01 contract: every question keeps server-screened rescue options (2–4); shown first only after unsure/skip; 잘 모르겠어요 never mixed in', async () => {
  assert.deepEqual(A.cleanChoices(['카페에서 수다', '같이 산책', '취미 같이 하기', '저녁 먹기', '다섯째']), ['카페에서 수다', '같이 산책', '취미 같이 하기', '저녁 먹기'], '많아도 4개까지');
  assert.deepEqual(A.cleanChoices(['어디가 좋아요?', '아주아주아주아주아주 긴 보기 문장이에요', '잘 모르겠어요']), [], '물음표·16자 초과·모르겠 보기는 버리고, 2개 미만이면 보기 없음');
  const st = start();
  const first = await A.runTurn(st, '편하게 얘기할 친구를 찾고 있어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ reply: '좋죠.', extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: { ...N('relationship_style', '편하게 얘기할 친구랑 수다 떨면 편해요?'), choices: ['카페', '공원'] } }))
    : JSON.stringify({ reply: '좋죠.' }));
  assert.deepEqual(A.choicesFor(st), ['카페', '공원'], '보통 답 뒤에도 보기는 서버가 들고 있다(구조대)');
  assert.equal(A.rescueView(st).show, true, '2026-10-05 canon: 처음 세 질문은 보통 답 뒤에도 보기를 먼저 펼친다(자유 입력칸은 그대로)');
  assert.ok(first.response.question);
  await A.runTurn(st, '잘 모르겠어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ kind: 'unsure', reply: '', next: { ...N('contact_rhythm', '처음엔 어떻게 알아가는 게 편해요?'), choices: ['문자로 천천히', '바로 통화', '만나서 얘기'] } }))
    : JSON.stringify({ reply: '' }));
  assert.deepEqual(A.choicesFor(st), ['문자로 천천히', '바로 통화', '만나서 얘기'], '「잘 모르겠어요」는 보기에 섞지 않는다');
  assert.equal(A.rescueView(st).show, true, '모르겠다 뒤에는 서버가 보기를 먼저 펼친다');
});

// QA v69 사람 검토: 보기가 예/아니요뿐 · 모르겠다 뒤 「산책 좋죠!」(다음 질문을 미리 대답) · 정정 뒤 「그렇게 자주 만나면 좋겠네요」(고친 값과 반대) · 「그렇게 말씀하셨네요」.
test('09-30 v69: yes/no choices rejected; unsafe acks after unsure/correction are dropped', async () => {
  assert.deepEqual(A.cleanChoices(['네, 좋아요', '아니요, 싫어요']), []);
  assert.equal(A.unsafeTurnAck('unsure', '산책 좋죠!', '잘 모르겠어요', '친구와 공원에서 산책하면 좋나요?'), true);
  assert.equal(A.unsafeTurnAck('unsure', '그럴 수도 있죠.', '잘 모르겠어요', '친구와 공원에서 산책하면 좋나요?'), false);
  assert.equal(A.unsafeTurnAck('correction', '그렇게 자주 만나면 좋겠네요.', '한 달에 한두 번 만나는 게 좋아요', '주말이 편해요?'), true);
  assert.equal(A.unsafeTurnAck('correction', '아, 한 달에 한두 번이면 딱 좋죠', '한 달에 한두 번 만나는 게 좋아요', '주말이 편해요?'), false);
  assert.equal(A.unsafeTurnAck('answer', '그렇게 말씀하셨네요.', '고양이 너무 좋지', '고양이 좋아요?'), true);
  const st = start();
  await A.runTurn(st, '편하게 얘기할 친구를 찾고 있어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ reply: '좋죠.', extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('relationship_style', '친구랑 카페에서 만나면 편해요?') }))
    : JSON.stringify({ reply: '좋죠.' }));
  const r = await A.runTurn(st, '잘 모르겠어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ kind: 'unsure', reply: '산책 좋죠!', next: N('contact_rhythm', '친구와 공원에서 산책하면 좋나요?') }))
    : JSON.stringify({ reply: '' }));
  assert.equal(r.response.reply, '', '다음 질문을 미리 대답한 받아주기는 빼고 질문만');
  assert.ok(r.obs.retry.includes('ack_dropped:unsure'));
});

// QA v70 장면 C9: AI 가 「잘 모르겠어요」를 help 로 내고 설명형 받아주기 + 「얼마나 자주」 질문을 냈다. 서버가 unsure 로 고치는 턴도 같은 검사를 받는다.
test('09-30 v70: help that the server turns into unsure is checked like unsure (question rewritten, analytic ack removed)', async () => {
  const st = start();
  await A.runTurn(st, '편하게 얘기할 친구를 찾고 있어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ reply: '좋죠.', extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('relationship_style', '친구랑 카페에서 만나면 편해요?') }))
    : JSON.stringify({ reply: '좋죠.' }));
  const r = await A.runTurn(st, '잘 모르겠어요', async (kind) => {
    if (kind === 'turn') return JSON.stringify(T({ kind: 'help', reply: '예를 들어, 친구와의 연락 방식이나 만나는 빈도 같은 것들이요.', next: N('contact_rhythm', '친구와 연락은 얼마나 자주 하고 싶으세요?') }));
    if (kind === 'question') return JSON.stringify({ question: '그럼 이런 느낌 중엔 뭐가 가까워요?', choices: ['카페에서 수다', '같이 산책'] });
    return JSON.stringify({ reply: '괜찮아요.' });
  });
  assert.equal(r.response.kind, 'unsure');
  assert.equal(r.response.question, '그럼 이런 느낌 중엔 뭐가 가까워요?');
  assert.ok(!A.analyticAck(r.response.reply) && !/빈도/.test(r.response.reply), r.response.reply);
  assert.deepEqual(A.choicesFor(st), ['카페에서 수다', '같이 산책']);
});

// QA v71 장면 C5·E6: 다시 쓴 질문이 세 번 다 떨어져 안내 한 줄로 갔다. 모르겠다 턴은 모인 보기로 대표 예 「그럼 이런 느낌 중엔 뭐가 가까워요?」를 묻고,
// 「비슷했다」로 떨어진 다시 쓰기에는 어느 질문과 비슷했는지 알려 준다.
test('09-30 v71: unsure turn with rejected rewrites falls back to the choice question; blocked why names the similar question', async () => {
  const st = start();
  await A.runTurn(st, '편하게 얘기할 친구를 찾고 있어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ reply: '좋죠.', extracted: [X('relationship_intent', '편하게 얘기할 친구', '편하게 얘기할 친구')], next: N('relationship_style', '편하게 얘기할 친구랑 수다 떨면 편해요?') }))
    : JSON.stringify({ reply: '좋죠.' }));
  const whys = [];
  const r = await A.runTurn(st, '잘 모르겠어요', async (kind, _s, input) => {
    if (kind === 'turn') return JSON.stringify(T({ kind: 'unsure', next: N('contact_rhythm', '친구와 만나면 어떤 활동이 좋을까요?') }));
    if (kind === 'question') { whys.push(input.rejected?.why ?? null); return JSON.stringify({ question: '편하게 얘기할 친구랑 수다 떨면 편해요?', choices: ['카페에서 수다', '같이 산책', '네, 좋아요'] }); }
    return JSON.stringify({ reply: '' });
  });
  assert.equal(r.response.question, A.choiceQuestionText('polite'));
  assert.deepEqual(A.choicesFor(st), ['카페에서 수다', '같이 산책']);
  assert.ok(r.obs.retry.includes('question_choices'));
  assert.match(whys[1] ?? '', /「편하게 얘기할 친구랑 수다 떨면 편해요\?」와 같은 틀/);
});

// 2026-09-30 §7 + QA v71·v72 장면 E: 정정 뒤 「고친 값으로 다시 정한 다음 질문」은 고치기 전 답에서 나온(답을 받지 못한) 질문과 비슷해도 쓴다. 글자까지 같은 재사용은 막는다.
test('09-30 §7: after a correction the recomputed next question may resemble the stale one, but never repeats it verbatim', async () => {
  const st = start();
  await A.runTurn(st, '편하게 자주 볼 수 있는 동네 친구를 찾고 있어요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ reply: '좋죠.', extracted: [X('relationship_intent', '동네 친구', '동네 친구')], next: N('relationship_style', '자주 보면 좋을 것 같아요?') }))
    : JSON.stringify({ reply: '좋죠.' }));
  const OLD_Q3 = '일주일에 세 번 만나는 날에 같이 하고 싶은 게 있나요?';
  await A.runTurn(st, '일주일에 세 번 만나는 게 좋아요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ reply: '좋죠.', extracted: [X('relationship_style', '일주일에 세 번 만나는 게 좋아요', '일주일에 세 번 만나는 게 좋아요')], next: N('values_character', OLD_Q3) }))
    : JSON.stringify({ reply: '좋죠.' }));
  assert.equal(st.current.text, OLD_Q3);
  const NEW_Q3 = '한 달에 한두 번 만나는 날에 같이 하고 싶은 게 있나요?';
  assert.equal(A.questionFlaw(st, '한 달에 한두 번 만나는 게 좋아요', NEW_Q3), 'blocked', '보통 턴에서는 여전히 비슷한 질문으로 막힌다');
  assert.equal(A.questionFlaw(st, '한 달에 한두 번 만나는 게 좋아요', NEW_Q3, true, OLD_Q3), '', '정정 턴에서는 고친 값으로 다시 정한 질문을 쓴다');
  assert.equal(A.questionFlaw(st, '한 달에 한두 번 만나는 게 좋아요', OLD_Q3, true, OLD_Q3), 'blocked', '옛 질문 글자 그대로 재사용은 막는다');
  const r = await A.runTurn(st, '한 달에 한두 번 만나는 게 좋아요', async (kind) => kind === 'turn'
    ? JSON.stringify(T({ kind: 'correction', reply: '', extracted: [X('relationship_style', '한 달에 한두 번 만나는 게 좋아요', '한 달에 한두 번 만나는 게 좋아요')], next: N('values_character', NEW_Q3) }))
    : JSON.stringify({ reply: '' }), { ui: { correction: true, purpose: 'relationship_style' } });
  assert.equal(r.response.question, NEW_Q3);
  assert.ok(!r.obs.retry.includes('question_fallback'));
});

// QA v73 사람 검토: 모르겠다 뒤 같은 장면 반복(카페 → 카페) · 「…친구는 어떤 사람이어야 할까요?」 · 「어디가 좋을지 잘 모르겠네요.」
test('09-30 v73: same direction after unsure, "어떤 사람이어야", and AI-side 모르겠네요 are flaws', () => {
  assert.equal(A.sameDirection('편하게 얘기할 친구와 카페에서 만나면 좋나요?', '친구와 카페에서 수다 떨고 싶어요?'), true);
  assert.equal(A.sameDirection('편하게 얘기할 친구와 카페에서 만나면 좋나요?', '친구와 공원에서 산책하면 좋나요?'), false);
  assert.equal(A.sameDirection('편하게 얘기할 친구와 카페에서 만나면 좋나요?', A.choiceQuestionText('polite')), false);
  assert.equal(A.genericPersonQuestion('편하게 얘기할 친구는 어떤 사람이어야 할까요?'), true);
  assert.equal(A.unsafeTurnAck('unsure', '어디가 좋을지 잘 모르겠네요.', '잘 모르겠어요', '친구와 공원에서 산책하면 좋나요?'), true);
  const st = start();
  st.current = { type: 'core', purpose: 'relationship_style', text: '편하게 얘기할 친구와 카페에서 만나면 좋나요?' };
  assert.equal(A.questionFlaw(st, '편하게 얘기할 친구를 찾고 있어요', '친구와 카페에서 수다 떨고 싶어요?', false), 'same_direction');
  assert.equal(A.questionFlaw(st, '편하게 얘기할 친구를 찾고 있어요', '친구와 공원에서 산책하면 좋나요?', false), '');
});
