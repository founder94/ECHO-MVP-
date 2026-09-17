// 2026-09-17 대표 지시(신뢰 우선) 규칙 검사 — 서버 단위 규칙만, 실제 OpenAI·DB 없음(로컬 모의 검사).
// ② 질문과 단계 진행 분리의 판정 규칙 / ③ 고정 회피·잘린 답 금지 / ④ 거절한 뜻의 답변 재등장 금지
// ⑦ 시도 예산(전체 대기시간 상한). 2026-09-16 실사용 캡처의 문장을 그대로 쓴다.
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

const EJ = 'supabase/functions/echo-journey/index.ts';
const GSQ = 'supabase/functions/get-step-question/index.ts';
const EJ_EXPOSE = 'globalThis.__echoExposed = { isUserQuestion, isSelfDirectedQuestion, replyQualityReason, confirmedEvidenceParts, latestOpenJourneyTurn, isParrot, renderCandidate, blockReason, genStepQuestion, hasBanmal, toPoliteKorean, LIMITS };';
const GSQ_EXPOSE = 'globalThis.__echoExposed = { isUserQuestion, isSelfDirectedQuestion, replyQualityReason, followupMode, renderFollowup, blockReasonFor, latestOpenTurn, hasBanmal, toPoliteKorean, validateSingleQuestion, LIMITS };';

// 대표가 지시서에 적은 네 문장(각 단계에서 검사하라고 한 것)
const Q_TYPO = 'AI도 오타가 날 수 있어?';
const Q_ADVICE = '어떻게 하는 게 좋을까?';
const Q_IGNORED = '아까 내 질문에는 답하지 않았어';
const Q_CORRECTION = '그 뜻이 아니라 쉬고 싶다는 뜻이야. 그럼 어떻게 해야 해?';
const AI = { apiKey: 'test', model: 'gpt-4o-mini' };

const candidate = (extra = {}) => ({
  acknowledgement: '눈치를 본다는 말이 마음에 남아요.',
  question: '눈치가 보일 때 어떤 순간이 먼저 떠오르나요?',
  anchor: '눈치',
  assumptions: [],
  meaning: 'test',
  keys: ['눈치'],
  reply: '',
  ...extra,
});

test('② 사용자가 되물은 말을 판정한다(지시서 네 문장 + ECHO 자체 물음 구분)', async () => {
  const ej = await loadExports(EJ, EJ_EXPOSE);
  const gsq = await loadExports(GSQ, GSQ_EXPOSE);
  for (const fn of [ej.isUserQuestion, gsq.isUserQuestion]) {
    assert.equal(fn(Q_TYPO), true);
    assert.equal(fn(Q_ADVICE), true);
    assert.equal(fn(Q_IGNORED), true);
    assert.equal(fn(Q_CORRECTION), true);
    assert.equal(fn('오늘은 마음이 편안해'), false);
    assert.equal(fn('회의 때 눈치를 봐'), false);
  }
  // ECHO 자체에 대한 물음 → 답만 한다. 사용자 상황에 대한 물음 → 답 + 질문.
  for (const fn of [ej.isSelfDirectedQuestion, gsq.isSelfDirectedQuestion]) {
    assert.equal(fn(Q_TYPO), true);
    assert.equal(fn(Q_IGNORED), true);
    assert.equal(fn(Q_ADVICE), false);
    assert.equal(fn(Q_CORRECTION), false);
  }
});

test('③ 고정 회피 문장·잘린 문장·무관한 문장은 답변 성공으로 처리하지 않는다', async () => {
  const { replyQualityReason, LIMITS } = await loadExports(EJ, EJ_EXPOSE);
  const check = (reply, question = Q_TYPO) => replyQualityReason(reply, question, LIMITS.REPLY_MAX);

  assert.equal(check(''), 'reply_missing');
  assert.equal(check('네, 저도 오타를 낼 수 있어요. 예를 들어 앞뒤 글자가 바뀌'), 'reply_incomplete');
  assert.equal(check('오타가 날 수 있는지 다시 볼까요?'), 'reply_question_mark');
  assert.equal(check('제가 대신 정답을 정해 줄 수는 없지만, 같이 찾아볼게요.'), 'reply_evasive');
  assert.equal(check('같이 찾아볼게요.'), 'reply_evasive');
  // 160자를 넘겨 잘릴 문장은 통과시키지 않는다
  assert.equal(check(`오타에 대해 설명하면 ${'길게 이어지는 설명이 계속됩니다. '.repeat(12)}`), 'reply_too_long');
  // 질문과 아무 관련 없는 답
  assert.equal(check('오늘 날씨는 맑아요.', '어떻게 대처하는 게 좋을까?'), 'reply_irrelevant');
  // 낱말이 겹치지 않아도 '무엇을 모르는지' 밝히는 답은 응답으로 본다(회피 문장은 위에서 이미 걸러진다)
  assert.equal(check('제가 그 상황을 다 알지는 못해요. 지금 가장 걸리는 부분부터 같이 좁혀 볼게요.', '어떻게 대처하는 게 좋을까?'), null);
  // 정상: 질문의 표현을 실제로 다루고 문장이 끝났다
  assert.equal(check('네, 저도 오타를 낼 수 있어요. 이상하면 바로 알려 주세요.'), null);
  assert.equal(check('제가 정답을 정하진 않지만, 지금 가장 힘든 순간부터 같이 정리해 볼게요.', '어떻게 대처하는 게 좋을까?'), null);
});

test('③ asked 모드는 검증된 답이 있을 때만 후보가 살아남는다', async () => {
  const { blockReason } = await loadExports(EJ, EJ_EXPOSE);
  const block = { asked: [], askedJourney: [], askedJourneyFull: [], rejectedKeys: [], rejectedTexts: [] };
  const evidence = ['회사에서 눈치 보는 게 힘들어'];
  const options = { intentHistory: [], userQuestion: Q_ADVICE, requireQuestion: true };

  assert.equal(blockReason(candidate({ reply: '' }), block, evidence, options), 'reply_quality');
  assert.equal(blockReason(candidate({ reply: '제가 대신 정답을 정해 줄 수는 없지만, 같이 찾아볼게요.' }), block, evidence, options), 'reply_quality');
  const good = candidate({ reply: '제가 정답을 정하진 않지만, 어떻게 할지 함께 정리해 볼게요.', acknowledgement: '' });
  assert.equal(blockReason(good, block, evidence, options), null);
  // ECHO 자체 물음: 질문 품질 규칙을 요구하지 않고 답만 검사한다
  assert.equal(blockReason(candidate({ reply: '네, 저도 오타를 낼 수 있어요.', question: '', acknowledgement: '' }), block, evidence, { intentHistory: [], userQuestion: Q_TYPO, requireQuestion: false }), null);
});

test('④ 거절한 해석은 답변 본문으로도 되살아나지 않는다', async () => {
  const { blockReason } = await loadExports(EJ, EJ_EXPOSE);
  const rejected = '관계에서 늘 먼저 물러나는 사람인 것 같아요';
  const block = { asked: [], askedJourney: [], askedJourneyFull: [], rejectedKeys: ['관계', '물러나'], rejectedTexts: [rejected] };
  const evidence = ['회사에서 눈치 보는 게 힘들어'];
  const options = { intentHistory: [], userQuestion: '그럼 관계에서 어떻게 해야 좋을까?', requireQuestion: true };

  const revived = candidate({ acknowledgement: '', reply: '관계에서 늘 먼저 물러나는 사람인 것 같아요. 그렇게 보여요.' });
  assert.equal(blockReason(revived, block, evidence, options), 'reply_rejected');
  // 흔한 낱말이 겹친다는 이유만으로 정상 답변을 막지 않는다
  const normal = candidate({ acknowledgement: '', reply: '관계 이야기는 제가 정답을 정하진 않지만, 어떻게 할지 함께 정리해 볼게요.' });
  assert.equal(blockReason(normal, block, evidence, options), null);
});

test('④ 사용자가 던진 질문과 다른 사람의 말은 확정 사실 근거에서 뺀다', async () => {
  const { confirmedEvidenceParts } = await loadExports(EJ, EJ_EXPOSE);
  const ctx = {
    mindText: '회사에서 눈치 보는 게 힘들어',
    messages: [
      { role: 'user', step: 3, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'journey_answer' },
      { role: 'user', step: 4, content: '그럼 어떻게 해야 좋을까?', message_kind: 'journey_answer' },
      { role: 'user', step: 5, content: '팀장이 그건 네 일이라고 했어', message_kind: 'journey_answer' },
    ],
    understandings: [],
  };
  const parts = confirmedEvidenceParts(ctx);
  assert.ok(parts.includes('회사에서 눈치 보는 게 힘들어'));
  assert.ok(parts.includes('회의 때 내 의견을 말하기 전에 눈치를 봐'));
  assert.ok(!parts.some((part) => part.includes('어떻게 해야 좋을까')), '사용자 질문의 전제는 확정 사실이 아니다');
  assert.ok(!parts.some((part) => part.includes('네 일이라고')), '다른 사람의 말은 확정 사실이 아니다');
});

test('② 답만 한 턴도 사용자가 이어서 말할 수 있는 열린 턴으로 본다', async () => {
  const { latestOpenJourneyTurn } = await loadExports(EJ, EJ_EXPOSE);
  const base = [
    { role: 'ai', step: 3, content: '눈치가 보이는 건 어떤 순간인가요?', message_kind: 'journey_question' },
    { role: 'user', step: 3, content: 'AI도 오타가 날 수 있어?', message_kind: 'journey_answer' },
  ];
  const replyTurn = { role: 'ai', step: 3, content: '네, 저도 오타를 낼 수 있어요. 이상하면 바로 알려 주세요.', message_kind: 'journey_question' };
  const ctx = { mindText: '회사에서 눈치 보는 게 힘들어', messages: [...base, replyTurn], understandings: [] };

  const open = latestOpenJourneyTurn(ctx, 3);
  assert.equal(open.kind, 'reply');
  assert.equal(open.content, replyTurn.content);

  // 답한 뒤에는 열린 턴이 사라진다
  const answered = { mindText: ctx.mindText, messages: [...ctx.messages, { role: 'user', step: 3, content: '알겠어. 오늘은 조금 가벼워', message_kind: 'journey_answer' }], understandings: [] };
  assert.equal(latestOpenJourneyTurn(answered, 3).kind, '');
  // 정상 질문 턴은 question 으로 판정된다
  const questionCtx = { mindText: ctx.mindText, messages: base.slice(0, 1), understandings: [] };
  assert.equal(latestOpenJourneyTurn(questionCtx, 3).kind, 'question');
});

test('⑦ 시도 예산: 남은 시간이 없으면 다음 시도를 시작하지 않는다', async () => {
  const { genStepQuestion, LIMITS } = await loadExports(EJ, EJ_EXPOSE);
  assert.equal(LIMITS.ATTEMPTS, 3);
  assert.equal(LIMITS.DEADLINE_MS, 11_000);

  const realNow = Date.now;
  let clock = realNow();
  Date.now = () => clock;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    clock += 6_000; // 한 번의 AI 호출이 6초 걸린 상황
    const content = JSON.stringify({
      candidates: [{ acknowledgement: '', question: '우울증 때문에 어떤 순간이 힘든가요?', anchor: '눈치', assumptions: [], meaning: 'x', keys: ['x'], reply: '' }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const ctx = { mindText: '회사에서 눈치 보는 게 힘들어', messages: [], understandings: [] };
    await assert.rejects(() => genStepQuestion(AI, ctx, 'step3'), /NO_CANDIDATE/);
  } finally {
    Date.now = realNow;
  }
  assert.equal(calls, 1, '6초를 쓴 뒤에는 11초 예산 안에서 두 번째 호출을 시작하지 않는다');
});

test('되받아치기 공감 문장은 화면에 내지 않는다', async () => {
  const { isParrot, renderCandidate } = await loadExports(EJ, EJ_EXPOSE);
  const userText = '대처를 해야지 아떻게 대처하는게 좋을까?';
  assert.equal(isParrot('대처를 해야지 아떻게 대처하는게 좋을까 하는 마음이 느껴져요.', userText), true);
  assert.equal(isParrot('눈치를 본다는 말이 마음에 남아요.', '회사에서 눈치 보는 게 힘들어'), false);

  const parrot = candidate({ acknowledgement: '대처를 해야지 아떻게 대처하는게 좋을까 하는 마음이 느껴져요' });
  assert.equal(renderCandidate(parrot, 'normal', null, userText), parrot.question);

  const asked = candidate({ reply: '네, 저도 오타를 낼 수 있어요.' });
  assert.equal(renderCandidate(asked, 'asked', null, Q_TYPO, true), `네, 저도 오타를 낼 수 있어요.\n\n${asked.question}`);
  assert.equal(renderCandidate(asked, 'asked', null, Q_TYPO, false), '네, 저도 오타를 낼 수 있어요.');
});

test('get-step-question 도 같은 규칙으로 답하고 단계를 지킨다', async () => {
  const { followupMode, renderFollowup, blockReasonFor, replyQualityReason, latestOpenTurn, LIMITS } = await loadExports(GSQ, GSQ_EXPOSE);
  assert.equal(LIMITS.GENERATION_ATTEMPTS, 3);
  assert.equal(LIMITS.DEADLINE_MS, 11_000);
  assert.equal(replyQualityReason('제가 대신 정답을 정해 줄 수는 없지만, 같이 찾아볼게요.', Q_ADVICE), 'reply_evasive');
  assert.equal(replyQualityReason('네, 저도 오타를 낼 수 있어요.', Q_TYPO), null);

  const base = [
    { role: 'ai', step: 1, content: '지금 마음에서 가장 또렷한 느낌은 무엇인가요?', message_kind: 'step_question' },
    { role: 'user', step: 1, content: '회의 때 내 의견을 말하기 전에 눈치를 봐', message_kind: 'step_answer' },
  ];
  // 사용자가 물으면 피드백보다 asked 가 우선
  assert.equal(followupMode({ mindText: '', messages: [...base, { role: 'user', step: 2, content: Q_ADVICE, message_kind: 'step_answer' }], understandings: [] }), 'asked');
  assert.equal(followupMode({ mindText: '', messages: [...base, { role: 'user', step: 2, content: '같은 질문을 또 하네', message_kind: 'step_answer' }], understandings: [] }), 'feedback');
  assert.equal(followupMode({ mindText: '', messages: base, understandings: [] }), 'normal');

  const c = candidate({ reply: '제가 정답을 정하진 않지만, 어떻게 할지 함께 정리해 볼게요.', acknowledgement: '' });
  assert.equal(renderFollowup(c, 'asked', Q_ADVICE, true), `${c.reply}\n\n${c.question}`);
  assert.equal(renderFollowup(c, 'asked', Q_TYPO, false), c.reply);

  const ctx = { askedTexts: [], rejectedKeys: [], rejectedTexts: ['관계에서 늘 먼저 물러나는 사람인 것 같아요'], evidenceTexts: ['회사에서 눈치 보는 게 힘들어'] };
  assert.equal(blockReasonFor(candidate({ acknowledgement: '', reply: '' }), ctx, { userQuestion: Q_ADVICE }), 'reply_quality');
  assert.equal(blockReasonFor(candidate({ acknowledgement: '', reply: '오늘 날씨는 맑아요.' }), ctx, { userQuestion: Q_ADVICE }), 'reply_quality');
  assert.equal(blockReasonFor(candidate({ acknowledgement: '', reply: '관계에서 늘 먼저 물러나는 사람인 것 같아요.' }), ctx, { userQuestion: '그럼 관계에서 어떻게 해야 좋을까?' }), 'rejected_text');
  assert.equal(blockReasonFor(c, ctx, { userQuestion: Q_ADVICE }), null);

  // 답만 한 턴은 열린 턴(reply)으로 판정된다
  const replyCtx = {
    mindText: '회사에서 눈치 보는 게 힘들어',
    messages: [...base, { role: 'user', step: 2, content: Q_TYPO, message_kind: 'step_answer' }, { role: 'ai', step: 2, content: '네, 저도 오타를 낼 수 있어요.', message_kind: 'step_question' }],
    understandings: [],
  };
  assert.equal(latestOpenTurn(replyCtx, 2, 'step_question', 'step_answer').kind, 'reply');
});

test('② "아까 내 질문에는 답하지 않았어" 는 앞의 물음을 찾아 그 물음에 답한다', async () => {
  const ej = await loadExports(EJ, EJ_EXPOSE);
  assert.equal(ej.isUserQuestion(Q_IGNORED), true);

  const ctx = {
    mindText: '회사에서 눈치 보는 게 힘들어',
    messages: [
      { role: 'ai', step: 3, content: '눈치가 보이는 건 어떤 순간인가요?', message_kind: 'journey_question' },
      { role: 'user', step: 3, content: '어떻게 대처하는 게 좋을까?', message_kind: 'journey_answer' },
      { role: 'ai', step: 3, content: '그 순간을 조금 더 들려줄 수 있나요?', message_kind: 'journey_question' },
      { role: 'user', step: 3, content: Q_IGNORED, message_kind: 'journey_answer' },
    ],
    understandings: [],
  };

  const systems = [];
  globalThis.fetch = async (url, options = {}) => {
    const request = JSON.parse(options.body);
    systems.push(String(request.messages?.[0]?.content ?? ''));
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: '',
        question: '눈치가 보일 때 어떤 장면이 먼저 떠오르나요?',
        anchor: '눈치',
        assumptions: [],
        meaning: 'x',
        keys: ['눈치'],
        reply: '앞서 어떻게 대처할지 물어봤는데 제가 답하지 못했어요. 지금 답하면, 먼저 힘든 순간을 좁혀 보는 게 도움이 돼요.',
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const text = await ej.genStepQuestion(AI, ctx, 'step4');
  assert.match(systems[0], /먼저 답할 것/);
  assert.match(systems[0], /어떻게 대처하는 게 좋을까\?/, '앞의 물음을 답할 대상으로 넘겨야 한다');
  assert.match(systems[0], /답하지 못한 것을 먼저 인정/);
  assert.match(text, /^앞서 어떻게 대처할지 물어봤는데 제가 답하지 못했어요/);
  assert.match(text, /\?$/, '앞 물음에 답한 뒤에는 대화를 이어갈 질문을 붙인다');
});

// ═══ 2026-09-17 실기기 캡처 3장에서 나온 결함 ═══
// #1 화면 문장 "대체로 맑음예요." / #2 STEP 1 질문이 반말 "…궁금해?" / #3 STEP 2 "질문을 만들지 못했어요"

test('말투: 실기기에 나간 반말 질문을 해요체로 바꾸고, 존댓말은 건드리지 않는다', async () => {
  const gsq = await loadExports(GSQ, GSQ_EXPOSE);
  // 운영 DB에 실제로 저장된 STEP 1 질문 원문
  const shipped = '맑은 날씨인데도 걱정이 드는 이유가 무엇인지 궁금해?';
  assert.equal(gsq.hasBanmal(shipped), true, '운영에 나간 반말을 못 잡으면 같은 일이 또 난다');
  assert.equal(gsq.toPoliteKorean(shipped), '맑은 날씨인데도 걱정이 드는 이유가 무엇인지 궁금해요?');

  for (const [before, after] of [
    ['지금 마음이 어때?', '지금 마음이 어때요?'],
    ['그랬구나. 어떤 부분이 가장 무거워?', '그랬군요. 어떤 부분이 가장 무거워요?'],
    ['그 마음이 뭐야?', '그 마음이 뭐예요?'],
    ['어떤 생각이 드나?', '어떤 생각이 드나요?'],
    ['조금 더 들려줄 수 있을까?', '조금 더 들려줄 수 있을까요?'],
  ]) {
    assert.equal(gsq.hasBanmal(before), true, `반말 판정 실패: ${before}`);
    assert.equal(gsq.toPoliteKorean(before), after);
  }

  for (const polite of [
    '밀린 돈이 어떤 의미인지 궁금해요?',
    '그건 제가 잘 모르겠어요. 어떤 점이 궁금하신가요?',
    '마음이 무거우셨겠어요. 어떤 장면이 떠오르나요?',
  ]) {
    assert.equal(gsq.hasBanmal(polite), false, `존댓말을 반말로 오판: ${polite}`);
    assert.equal(gsq.toPoliteKorean(polite), polite, '존댓말 문장은 그대로 두어야 한다');
  }
});

test('말투: 규칙에 없는 끝맺음은 억지로 고치지 않고 차단한다', async () => {
  const gsq = await loadExports(GSQ, GSQ_EXPOSE);
  assert.equal(gsq.toPoliteKorean('그 마음은 무엇?'), null, '못 고치는 문장을 지어내면 안 된다');
  const v = gsq.validateSingleQuestion('그 마음은 무엇?', 200, true, '돈때문에');
  assert.equal(v.ok, false);
  assert.equal(v.error, 'BANMAL');
});

test('말투: 반말 후보는 차단 사유 banmal 로 막힌다 (echo-journey·get-step-question 양쪽)', async () => {
  const ej = await loadExports(EJ, EJ_EXPOSE);
  const gsq = await loadExports(GSQ, GSQ_EXPOSE);
  // 해요체로 못 바꾸는 반말이 후보에 남아 있으면 화면에 내지 않는다.
  const bad = { acknowledgement: '', question: '그 마음은 무엇?', meaning: 'x', keys: ['돈'], anchor: '돈', assumptions: [], reply: '' };
  const evidence = ['돈때문에'];
  const block = { asked: [], rejectedKeys: [], rejectedTexts: [], evidenceTexts: evidence };
  assert.equal(ej.hasBanmal('그 마음은 무엇?'), true);
  assert.equal(gsq.hasBanmal('그 마음은 무엇?'), true);
  const ejReason = ej.blockReason(bad, { ...block, asked: [], intentHistory: [] }, evidence, {});
  assert.ok(['banmal', 'quality'].includes(ejReason), `기대: banmal/quality, 실제: ${ejReason}`);
});

test('질문 실패 방지: 마지막 시도 완화와 구제가 genSingleQuestion 에 실제로 있다', async () => {
  const source = await readFile(resolve(root, GSQ), 'utf8');
  const body = source.slice(source.indexOf('async function genSingleQuestion'), source.indexOf('const genStep1Question'));
  assert.match(body, /const relaxed = attempt === LIMITS\.GENERATION_ATTEMPTS - 1/, '마지막 시도 완화가 없으면 짧은 답변에서 또 막힌다');
  assert.match(body, /repeatsQuestionIntent\(v\.text, asked\.slice\(-INTENT_HISTORY\)\)/, '의도 반복은 최근 질문과만 비교해야 한다');
  assert.match(body, /if \(salvage\) \{/, '안전 검사를 모두 통과한 질문은 구제해서 내보내야 한다');
  assert.match(body, /single_salvage/, '구제 사실은 로그로 남아야 한다');
  // 하드코딩 질문 금지: 구제는 모델이 만든 문장에서만 나온다.
  assert.equal(/salvage = ["'`][^"'`]/.test(body), false, '고정 질문 문자열을 구제로 쓰면 안 된다');
});

test('날씨 문장: 라벨을 그대로 붙여 "맑음예요" 를 만들지 않는다', async () => {
  const hook = await readFile(resolve(root, 'src/pages/do-it/weather/hooks/useWeather.ts'), 'utf8');
  const page = await readFile(resolve(root, 'src/pages/do-it/weather-check/page.tsx'), 'utf8');
  assert.match(hook, /export function weatherSentence/, '서술형 문장 함수가 있어야 한다');
  assert.equal(/\{weatherLabel\}<\/span>예요/.test(page), false, '라벨 + 예요 조립은 문법이 깨진다');
  assert.match(page, /weatherSentence\(iconKey\)/, '화면은 서술형 문장을 써야 한다');
  // 실기기에 나간 깨진 문장이 어떤 조합으로도 다시 나오지 않는지 확인한다.
  const sentences = [...hook.matchAll(/^\s{2}\w+: '([^']+)',$/gm)].map((m) => m[1]);
  assert.ok(sentences.length >= 10, `서술형 문장이 모자라다: ${sentences.length}`);
  for (const sentence of sentences) {
    assert.equal(/음$|림$|개$|비$|눈$|둥$/.test(sentence), false, `명사형이 남아 있다: ${sentence}`);
    assert.match(sentence, /요$/, `해요체가 아니다: ${sentence}`);
  }
});
