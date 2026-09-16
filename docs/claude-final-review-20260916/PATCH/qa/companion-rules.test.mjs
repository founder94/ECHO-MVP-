// 2026-09-16 운영 실사용(대표 아이폰 캡처 9장) 근거 검사.
// 증상: 사용자가 ECHO 에게 물은 문장("어떻게 대처하는 게 좋을까?", "질문했는데 답을 못햐?")에 답하지 않고 되묻기만 함,
//       공감 문장이 사용자 말을 그대로 베낌(되받아치기), STEP 4 에서 후보 전부 차단 → "질문을 만들지 못했어요"
//       (운영 로그 [ej] no_candidate step=4 mode=feedback blocked_total=6).
// 규칙: (1) 사용자 물음 → asked 모드: 짧은 답(reply) + 질문 하나. (2) 되받아치기 공감 문장은 버린다.
//       (3) 마지막 시도는 의도 반복 규칙을 풀어 후보를 살린다(안전·근거·거절 규칙은 유지). (4) 시도 3회.
//       (5) 지난 여정 리포트 요약을 참고 문맥으로 넘긴다(사실 근거 아님).
// 실제 OpenAI 호출은 없다(가짜 fetch). 사용자 원문은 로그에 남기지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());

async function loadExports(relativePath, exposeLine) {
  const absolutePath = resolve(root, relativePath);
  let source = await readFile(absolutePath, 'utf8');
  source = source.replace(
    /import \{ createClient, type SupabaseClient \} from "npm:@supabase\/supabase-js@2\.57\.4";/,
    'const createClient = () => ({});',
  );
  if (relativePath.includes('echo-journey')) {
    const qualityUrl = pathToFileURL(resolve(absolutePath, '..', 'question-quality.ts')).href;
    source = source.replace('from "./question-quality.ts";', `from ${JSON.stringify(qualityUrl)};`);
  }
  source += `\n${exposeLine}\n//# sourceURL=${absolutePath}?companion=${Date.now()}-${Math.random()}\n`;
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: absolutePath,
  }).outputText;
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  globalThis.__echoExposed = null;
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  assert.ok(globalThis.__echoExposed, `${relativePath} did not expose test hooks`);
  return globalThis.__echoExposed;
}

const EJ_EXPOSE = 'globalThis.__echoExposed = { isUserQuestion, cleanReply, isParrot, renderCandidate, genStepQuestion, LIMITS };';
const GSQ_EXPOSE = 'globalThis.__echoExposed = { isUserQuestion, cleanReply, isParrot, followupMode, renderFollowup, genFollowupQuestion, blockReasonFor, LIMITS };';

// 대표 실사용 문장(캡처 원문 그대로, 오타 포함)
const REAL_QUESTION_1 = '대처를 해야지 아떻게 대처하는게 좋을까?';
const REAL_QUESTION_2 = '질문했는데 답을 못햐?';
const REAL_QUESTION_3 = 'ai가 오타기 날수도 있어?';
const MIND = '요즘 회사에서 눈치 보는 게 힘들어';
const AI = { apiKey: 'test', model: 'gpt-4o-mini' };

function fakeOpenAI(responder) {
  const calls = { count: 0, systems: [] };
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.count += 1;
    const request = JSON.parse(options.body);
    calls.systems.push(String(request.messages?.[0]?.content ?? ''));
    const content = responder(calls.count, request);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return calls;
}

const candidate = (question, extra = {}) => ({
  acknowledgement: '눈치를 본다는 말이 마음에 남아요.',
  question,
  anchor: '눈치',
  assumptions: [],
  meaning: 'test',
  keys: ['눈치'],
  reply: '',
  ...extra,
});

test('echo-journey: 사용자가 ECHO에게 물은 문장을 질문으로 판정한다(실사용 문장 3종)', async () => {
  const { isUserQuestion, cleanReply, isParrot } = await loadExports('supabase/functions/echo-journey/index.ts', EJ_EXPOSE);
  assert.equal(isUserQuestion(REAL_QUESTION_1), true);
  assert.equal(isUserQuestion(REAL_QUESTION_2), true);
  assert.equal(isUserQuestion(REAL_QUESTION_3), true);
  assert.equal(isUserQuestion('어떻게 해야 할지 모르겠어'), true);
  assert.equal(isUserQuestion(MIND), false);
  assert.equal(isUserQuestion('오늘은 마음이 편안해.'), false);
  // reply 규칙: 물음표·금지어면 버림, 160자 상한
  assert.equal(cleanReply('  제 답이 늦었어요.  같이 찾아볼게요. '), '제 답이 늦었어요. 같이 찾아볼게요.');
  assert.equal(cleanReply('그건 어떤가요?'), '');
  assert.equal(cleanReply('우울증 진단이 필요해요.'), '');
  assert.equal(cleanReply('가'.repeat(200)).length, 160);
  // 되받아치기: 사용자 문장을 통째로 베낀 공감 문장은 버리고, 짧은 표현 인용은 허용
  assert.equal(isParrot('대처를 해야지 아떻게 대처하는게 좋을까 하는 마음이 느껴져요.', REAL_QUESTION_1), true);
  assert.equal(isParrot('눈치를 본다는 말이 마음에 남아요.', MIND), false);
  assert.equal(isParrot('', MIND), false);
});

test('echo-journey: asked 모드는 reply + 질문, reply 없으면 서버 고정 문장', async () => {
  const { renderCandidate } = await loadExports('supabase/functions/echo-journey/index.ts', EJ_EXPOSE);
  const c = candidate('눈치가 보일 때 어떤 순간이 먼저 떠오르나요?', { reply: '제가 대신 정할 수는 없지만, 먼저 어떤 순간이 가장 힘든지부터 같이 볼게요.' });
  assert.equal(renderCandidate(c, 'asked'), `${c.reply}\n\n${c.question}`);
  const noReply = candidate('눈치가 보일 때 어떤 순간이 먼저 떠오르나요?');
  assert.equal(renderCandidate(noReply, 'asked'), `제가 대신 정답을 정해 줄 수는 없지만, 같이 찾아볼게요.\n\n${noReply.question}`);
  // normal 모드: 되받아치기 공감 문장은 제거되고 질문만 남는다
  const parrot = candidate('눈치가 보일 때 어떤 순간이 먼저 떠오르나요?', { acknowledgement: '대처를 해야지 아떻게 대처하는게 좋을까 하는 마음이 느껴져요' });
  assert.equal(renderCandidate(parrot, 'normal', null, REAL_QUESTION_1), parrot.question);
  assert.equal(renderCandidate(candidate('눈치가 보일 때 어떤 순간이 먼저 떠오르나요?'), 'normal', null, MIND), '눈치를 본다는 말이 마음에 남아요.\n\n눈치가 보일 때 어떤 순간이 먼저 떠오르나요?');
});

test('echo-journey: 실사용 문장 "어떻게 대처하는게 좋을까?" → 먼저 답하고(reply) 질문 하나로 이어간다', async () => {
  const { genStepQuestion, LIMITS } = await loadExports('supabase/functions/echo-journey/index.ts', EJ_EXPOSE);
  assert.equal(LIMITS.ATTEMPTS, 3);
  const ctx = {
    mindText: MIND,
    messages: [
      { role: 'ai', step: 3, content: '눈치를 본다는 말이 마음에 남아요.\n\n눈치가 가장 크게 느껴지는 건 어떤 순간인가요?', message_kind: 'journey_question' },
      { role: 'user', step: 3, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'journey_answer' },
      { role: 'ai', step: 4, content: '회의 때 의견을 말하기 전이라고 했어요.\n\n그때 몸에서는 어떤 느낌이 드나요?', message_kind: 'journey_question' },
      { role: 'user', step: 4, content: REAL_QUESTION_1, message_kind: 'journey_answer' },
    ],
    understandings: [],
    priorSummary: '나는 지난 여정에서 혼자 버티는 습관을 이야기했어요.',
  };
  const calls = fakeOpenAI(() => ({
    candidates: [candidate('눈치를 볼 때 회의 말고 어디에서 그런 순간이 또 있나요?', {
      acknowledgement: '대처를 해야지 아떻게 대처하는게 좋을까 하는 마음이 느껴져요.',
      reply: '제가 대신 정답을 정해 줄 수는 없어요. 다만 지금까지 말한 걸 보면 먼저 어떤 순간이 가장 힘든지 같이 보는 게 도움이 될 것 같아요.',
    })],
  }));
  const text = await genStepQuestion(AI, ctx, 'step5');
  assert.equal(calls.count, 1);
  assert.match(calls.systems[0], /사용자가 ECHO에게 물었다 — 먼저 답할 것/);
  assert.match(calls.systems[0], /지난 여정에서 나눈 이야기 요약/);
  assert.match(calls.systems[0], /혼자 버티는 습관/);
  assert.equal(text, '제가 대신 정답을 정해 줄 수는 없어요. 다만 지금까지 말한 걸 보면 먼저 어떤 순간이 가장 힘든지 같이 보는 게 도움이 될 것 같아요.\n\n눈치를 볼 때 회의 말고 어디에서 그런 순간이 또 있나요?');
  assert.ok(!text.includes('아떻게 대처하는게 좋을까 하는 마음'), '되받아치기 공감 문장이 화면에 나오면 안 된다');
});

test('echo-journey: "질문했는데 답을 못햐?" 는 부담 피드백보다 asked 가 우선이라 답이 나온다', async () => {
  const { genStepQuestion } = await loadExports('supabase/functions/echo-journey/index.ts', EJ_EXPOSE);
  const ctx = {
    mindText: MIND,
    messages: [
      { role: 'ai', step: 3, content: '눈치가 가장 크게 느껴지는 건 어떤 순간인가요?', message_kind: 'journey_question' },
      { role: 'user', step: 3, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'journey_answer' },
      { role: 'ai', step: 4, content: '그때 몸에서는 어떤 느낌이 드나요?', message_kind: 'journey_question' },
      { role: 'user', step: 4, content: REAL_QUESTION_2, message_kind: 'journey_answer' },
    ],
    understandings: [],
  };
  const calls = fakeOpenAI(() => ({
    candidates: [candidate('회의 말고 눈치를 보게 되는 다른 장면은 어디인가요?', {
      reply: '맞아요, 방금 물음에 제가 바로 답하지 못했어요. 이번엔 먼저 답하고 이어갈게요.',
    })],
  }));
  const text = await genStepQuestion(AI, ctx, 'step5');
  assert.equal(calls.count, 1);
  assert.match(calls.systems[0], /먼저 답할 것/);
  assert.ok(!calls.systems[0].includes('[질문 피드백'), 'asked 모드에서는 피드백 노트를 넣지 않는다');
  assert.equal(text.split('\n\n')[0], '맞아요, 방금 물음에 제가 바로 답하지 못했어요. 이번엔 먼저 답하고 이어갈게요.');
  assert.match(text.split('\n\n')[1], /\?$/);
});

test('echo-journey: 의도 반복만으로 막힌 후보는 마지막(3번째) 시도에서 살아난다', async () => {
  const { genStepQuestion } = await loadExports('supabase/functions/echo-journey/index.ts', EJ_EXPOSE);
  const ctx = {
    mindText: MIND,
    messages: [
      { role: 'ai', step: 3, content: '눈치가 보이는 건 어떤 상황인가요?', message_kind: 'journey_question' },
      { role: 'user', step: 3, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'journey_answer' },
    ],
    understandings: [],
  };
  // 모든 후보가 직전 질문과 같은 의도(context: 상황·장면)이지만 글자 겹침은 낮다
  const calls = fakeOpenAI(() => ({
    candidates: [candidate('회의 말고 어떤 장면에서 의견을 삼키게 되나요?', { anchor: '의견', acknowledgement: '의견을 말하기 전이라는 말이 남아요.' })],
  }));
  const text = await genStepQuestion(AI, ctx, 'step4');
  assert.equal(calls.count, 3, '1·2번째는 의도 반복으로 차단, 3번째(완화)에서 채택');
  assert.match(text, /회의 말고 어떤 장면에서 의견을 삼키게 되나요\?$/);
});

test('echo-journey: 완화 시도에서도 금지어·근거 없는 anchor 는 통과하지 못한다', async () => {
  const { genStepQuestion } = await loadExports('supabase/functions/echo-journey/index.ts', EJ_EXPOSE);
  const ctx = { mindText: MIND, messages: [], understandings: [] };
  const calls = fakeOpenAI(() => ({
    candidates: [
      candidate('우울증 때문에 어떤 순간이 힘든가요?'),
      candidate('연인과의 관계에서 어떤 순간이 힘든가요?', { anchor: '연인' }),
    ],
  }));
  await assert.rejects(() => genStepQuestion(AI, ctx, 'step3'), /NO_CANDIDATE/);
  assert.equal(calls.count, 3);
});

test('get-step-question: 사용자 물음 → asked 모드 reply + 질문, 되받아치기 제거, 마지막 시도 완화', async () => {
  const { isUserQuestion, followupMode, renderFollowup, genFollowupQuestion, blockReasonFor, LIMITS } = await loadExports('supabase/functions/get-step-question/index.ts', GSQ_EXPOSE);
  assert.equal(LIMITS.GENERATION_ATTEMPTS, 3);
  assert.equal(isUserQuestion(REAL_QUESTION_1), true);
  assert.equal(isUserQuestion(REAL_QUESTION_2), true);
  const base = [
    { role: 'ai', step: 1, content: '눈치가 가장 크게 느껴지는 건 어떤 순간인가요?', message_kind: 'step_question' },
    { role: 'user', step: 1, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'step_answer' },
    { role: 'ai', step: 2, content: '그때 몸에서는 어떤 느낌이 드나요?', message_kind: 'step_question' },
  ];
  // 운영 저장 형태: '조금 달라요' 를 누르면 understanding_choice 메시지 본문은 사용자가 직접 쓴 정정 문장이다.
  const askedCtx = {
    mindText: MIND,
    messages: [...base, { role: 'user', step: 2, content: '회의 끝나면 기운이 빠져', message_kind: 'step_answer' }, { role: 'ai', step: 3, content: '회의에서 눈치를 보느라 기운이 빠지는 것 같아요.', message_kind: 'understanding_summary' }, { role: 'user', step: 3, content: REAL_QUESTION_1, message_kind: 'understanding_choice' }],
    understandings: [{ choice: 'alittle', rejected_interpretation: null, correction_text: REAL_QUESTION_1, self_explanation: null }],
  };
  assert.equal(followupMode(askedCtx), 'asked');
  // 정정 문장이 '같은 질문' 지적이면 feedback, 사용자 물음이면 feedback 보다 asked 가 우선
  assert.equal(followupMode({ ...askedCtx, messages: [...askedCtx.messages.slice(0, -1), { role: 'user', step: 3, content: '같은 질문을 또 하네', message_kind: 'understanding_choice' }] }), 'feedback');
  assert.equal(followupMode({ ...askedCtx, messages: [...askedCtx.messages, { role: 'user', step: 4, content: REAL_QUESTION_2, message_kind: 'followup_answer' }] }), 'asked');
  assert.equal(followupMode({ mindText: MIND, messages: [...base, { role: 'user', step: 2, content: '회의 끝나면 기운이 빠져', message_kind: 'step_answer' }], understandings: [] }), 'normal');
  assert.equal(followupMode({ mindText: MIND, messages: [...base, { role: 'user', step: 2, content: '같은 질문을 또 하네', message_kind: 'step_answer' }], understandings: [] }), 'feedback');

  const c = candidate('회의 말고 눈치를 보게 되는 다른 장면은 어디인가요?', { reply: '제가 대신 정할 수는 없지만, 먼저 힘든 순간부터 같이 볼게요.' });
  assert.equal(renderFollowup(c, 'asked', REAL_QUESTION_1), `${c.reply}\n\n${c.question}`);
  assert.equal(renderFollowup(candidate(c.question), 'asked', REAL_QUESTION_1), `제가 대신 정답을 정해 줄 수는 없지만, 같이 찾아볼게요.\n\n${c.question}`);
  assert.equal(renderFollowup(candidate(c.question, { acknowledgement: '대처를 해야지 아떻게 대처하는게 좋을까 하는 마음이네요' }), 'normal', REAL_QUESTION_1), c.question);
  assert.equal(renderFollowup(candidate(c.question), 'normal', MIND), `눈치를 본다는 말이 마음에 남아요.\n\n${c.question}`);

  // asked 모드 생성: 프롬프트에 '먼저 답할 것' 노트, 결과는 reply + 질문
  let calls = fakeOpenAI(() => ({ candidates: [candidate('회의 말고 눈치를 보게 되는 다른 장면은 어디인가요?', { reply: '제가 대신 정할 수는 없지만, 먼저 힘든 순간부터 같이 볼게요.' })] }));
  const chosen = await genFollowupQuestion(AI, { ...askedCtx, priorSummary: '나는 지난 여정에서 혼자 버티는 습관을 이야기했어요.' });
  assert.equal(calls.count, 1);
  assert.match(calls.systems[0], /먼저 답할 것/);
  assert.match(calls.systems[0], /혼자 버티는 습관/);
  assert.equal(chosen.reply, '제가 대신 정할 수는 없지만, 먼저 힘든 순간부터 같이 볼게요.');

  // 의도 반복(context)만으로 막힌 후보는 3번째 시도에서 살아난다
  const ctxBlock = { askedTexts: ['눈치가 보이는 건 어떤 상황인가요?'], rejectedKeys: [], rejectedTexts: [], evidenceTexts: [MIND, '회의 때 내 의견을 말하기 전에 눈치를 봐'] };
  const sameIntent = candidate('회의 말고 어떤 장면에서 의견을 삼키게 되나요?', { anchor: '의견', acknowledgement: '의견을 말하기 전이라는 말이 남아요.' });
  assert.equal(blockReasonFor(sameIntent, ctxBlock), 'repeat');
  assert.equal(blockReasonFor(sameIntent, ctxBlock, true), null);
  assert.equal(blockReasonFor(candidate('우울증 때문에 어떤 순간이 힘든가요?'), ctxBlock, true), 'forbidden');
  calls = fakeOpenAI(() => ({ candidates: [sameIntent] }));
  const normalCtx = { mindText: MIND, messages: [{ role: 'ai', step: 1, content: '눈치가 보이는 건 어떤 상황인가요?', message_kind: 'step_question' }, { role: 'user', step: 1, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'step_answer' }], understandings: [] };
  const relaxed = await genFollowupQuestion(AI, normalCtx);
  assert.equal(calls.count, 3);
  assert.equal(relaxed.question, sameIntent.question);
});
