import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FakeDatabase, loadEdgeHandler, invoke, token, completeFreeStage, root } from './_edge-harness.mjs';

function createAiFetch({ tossApproved = false } = {}) {
  const questions = [
    '편안한 마음에서 지금 가장 또렷한 감정은 무엇인가요?',
    '그 편안함이 오늘 생활에 어떻게 나타났는지 말해줄 수 있나요?',
    '그 마음에서 지금 더 들려주고 싶은 부분은 무엇인가요?',
    '오늘의 편안함이 나에게 어떤 의미인지 말해줄 수 있나요?',
    '지금 가장 중요하게 느끼는 것은 무엇인가요?',
    '그 마음을 설명하는 다른 말이 있다면 무엇인가요?',
    '오늘 이야기에서 내가 기억하고 싶은 한 가지는 무엇인가요?',
    '지금의 편안함을 위해 할 수 있는 작은 선택은 무엇인가요?',
    '오늘 천천히 쉬고 싶은 이유는 무엇인가요?',
    '오늘 마음에서 이전과 다른 점은 무엇인가요?',
    '그 한마디에서 더 설명하고 싶은 부분은 무엇인가요?',
    '그 부분이 나에게 왜 중요하다고 느껴지나요?',
  ];
  let questionIndex = 0;
  let summaryIndex = 0;
  let failNextOpenAi = false;
  const calls = { openai: 0, toss: 0, questionCandidates: [], askedQuestions: [], systemPrompts: [] };

  const fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('tosspayments.com')) {
      calls.toss += 1;
      if (!tossApproved) throw new Error('Toss must not be called while review_pending');
      const request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        status: 'DONE',
        orderId: request.orderId,
        totalAmount: request.amount,
        method: '카드',
        approvedAt: '2026-09-15T10:30:00.000Z',
        receipt: { url: 'https://example.test/receipt' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.equal(address, 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    if (failNextOpenAi) {
      failNextOpenAi = false;
      throw new Error('simulated OpenAI connection failure');
    }

    const request = JSON.parse(options.body);
    const system = String(request.messages?.[0]?.content ?? '');
    calls.systemPrompts.push(system);
    let content;
    if (system.includes('자기이해 리포트')) {
      content = JSON.stringify({
        title: '오늘의 편안함을 이해하는 기록',
        summary: '나는 편안함을 중요하게 느꼈어요. 오늘의 말을 바탕으로 나를 이해해 봤어요.',
        sections: [
          { heading: '지금의 마음', body: '나는 오늘 편안하다고 직접 말했어요. 이 감정은 지금 확인된 내용이에요. 이 마음을 천천히 살펴볼 수 있어요.', status: 'confirmed', anchor: '편안' },
          { heading: '내가 중요하게 여긴 것', body: '나는 여유가 중요하다고 말했어요. 이것은 내 표현에서 확인한 내용이에요. 다른 뜻을 억지로 붙이지 않았어요.', status: 'confirmed', anchor: '여유' },
          { heading: '다음에 살펴볼 것', body: '이 편안함을 이어갈 방법은 아직 후보예요. 나에게 맞는지 천천히 확인해 볼 수 있을 것 같아요. 지금 정답을 정할 필요는 없어요.', status: 'candidate' },
          // AI 가 confirmed 라고 주장하지만 사용자 근거에 없는 표현(관계) → 서버가 candidate 로 내려야 한다
          { heading: '반복되는 패턴', body: '나는 관계에서 늘 먼저 물러나는 편이에요. 이것은 여러 번 확인된 사실이에요. 앞으로도 같은 선택을 할 가능성이 커요.', status: 'confirmed', anchor: '관계에서 물러나' },
        ],
        next_step: '오늘 편안했던 이유를 한 줄로 남겨볼 수 있어요.',
      });
    } else if (system.includes('요약해라')) {
      content = summaryIndex++ === 0
        ? '오늘은 마음이 편안하고, 여유를 중요하게 느끼는 것 같아요.'
        : '일을 마친 뒤 스스로 정한 속도를 중요하게 여기는 것 같아요.';
    } else if (request.response_format) {
      const question = questions[questionIndex++ % questions.length];
      calls.questionCandidates.push(question);
      // 2026-09-17: 사용자가 물었을 때(asked 모드)는 프롬프트에 '먼저 답할 것'이 들어온다. 그때만 reply 를 만든다.
      const askedMatch = system.match(/먼저 답할 것\]\n"([^"]+)"/);
      if (askedMatch) calls.askedQuestions.push(askedMatch[1]);
      const reply = askedMatch
        ? `${askedMatch[1].replace(/[?？]/g, '').trim().slice(0, 20)} 부분은 제가 정답을 알지 못해요. 지금까지 들은 내용으로 같이 정리해 볼게요.`
        : '';
      content = JSON.stringify({
        candidates: [{
          acknowledgement: '편안하다고 말해주셨네요.',
          question,
          anchor: '편안',
          assumptions: [],
          meaning: `새로운 질문 ${questionIndex}`,
          keys: [`새의미${questionIndex}`],
          reply,
        }],
      });
    } else {
      content = questions[questionIndex++ % questions.length];
    }
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    fetch,
    calls,
    failNext() {
      failNextOpenAi = true;
    },
  };
}

function createLowInformationRepeatAiFetch() {
  const candidates = [
    { question: '편안함이 나에게 어떤 의미인지 말해줄 수 있나요?', anchor: '편안함' },
    { question: '오늘 마음을 색으로 고르면 무엇인가요?', anchor: '오늘 마음' },
    { question: '오늘 마음을 색으로 고르면 무엇인가요?', anchor: '오늘 마음' },
    { question: '편안해진 때 몸이 먼저 하고 싶은 작은 행동은 무엇인가요?', anchor: '편안해' },
    { question: '편안해진 때 몸이 먼저 하고 싶은 작은 행동은 무엇인가요?', anchor: '편안해' },
    { question: '오늘 대화 끝에 남기고 싶은 짧은 말은 무엇인가요?', anchor: '오늘' },
  ];
  let index = 0;
  const calls = { openai: 0, userPrompts: [], systemPrompts: [] };

  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    const systemPrompt = String(request.messages?.[0]?.content ?? '');
    const userPrompt = String(request.messages?.[1]?.content ?? '');
    calls.systemPrompts.push(systemPrompt);
    calls.userPrompts.push(userPrompt);
    const candidate = candidates[index++];
    assert.ok(candidate, `unexpected OpenAI call ${index}`);
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: `${candidate.anchor}이라고 말해주셨네요.`,
        question: candidate.question,
        anchor: candidate.anchor,
        assumptions: [],
        meaning: candidate.question,
        keys: [candidate.anchor],
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetch, calls };
}

function createProductionIncidentRecoveryAiFetch() {
  const candidates = [
    {
      question: '잘 살아가려고 노력하는 방법 중 요즘 가장 중요한 것은 무엇인가요?',
      anchor: '잘 살아가려고 노력',
    },
    {
      question: '하고 싶은 일 중 요즘 가장 손이 가는 것은 무엇인가요?',
      anchor: '묵묵히 제가 하고 싶은 일들을 하며 하루를 보낼때',
    },
    {
      question: '하고 싶은 일에서 더 이야기하고 싶은 부분은 무엇인가요?',
      anchor: '하고 싶은 일',
    },
    {
      question: '오늘 대화 끝에 남기고 싶은 짧은 말은 무엇인가요?',
      anchor: '오늘',
    },
  ];
  let index = 0;
  const calls = { openai: 0, userPrompts: [], systemPrompts: [] };

  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    calls.systemPrompts.push(String(request.messages?.[0]?.content ?? ''));
    calls.userPrompts.push(String(request.messages?.[1]?.content ?? ''));
    const candidate = candidates[index++];
    assert.ok(candidate, `unexpected OpenAI call ${index}`);
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: `${candidate.anchor}이라고 말해주셨네요.`,
        question: candidate.question,
        anchor: candidate.anchor,
        assumptions: [],
        meaning: candidate.question,
        keys: [candidate.anchor],
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetch, calls };
}

function createPlanBRepairAiFetch() {
  const calls = { openai: 0, userPrompts: [], systemPrompts: [] };
  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    calls.systemPrompts.push(String(request.messages?.[0]?.content ?? ''));
    calls.userPrompts.push(String(request.messages?.[1]?.content ?? ''));
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: '일이 끝나서 편안하다고 바로잡아 주셨네요.',
        question: '일이 끝난 뒤 가장 먼저 달라진 점은 무엇인가요?',
        anchor: '일이 끝나서 편안한 거야',
        assumptions: [],
        meaning: '정정된 사실에서 변화 한 가지를 묻기',
        keys: ['일이 끝남', '달라진 점'],
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}


test('review_pending allows STEP 1~7 for free and makes zero orders or Toss calls', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai);

  const conversationId = await completeFreeStage(early);
  const resumed = await invoke(journey, 'user-1', { action: 'resume', conversationId });
  assert.equal(resumed.body.status, 'step3');

  const earlyPayment = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(earlyPayment.body.code, 'INVALID_STATE');
  assert.equal(db.rows.payments.length, 0);
  assert.equal(ai.calls.toss, 0);

  for (const step of [3, 4, 5, 6, 7]) {
    const asked = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token(`free-ask-${step}`) });
    assert.equal(asked.body.status, `step${step}`);
    const answered = await invoke(journey, 'user-1', {
      action: 'answer', conversationId, answer: `무료 대화 ${step}단계에서 새롭게 답한 내용`, token: token(`free-answer-${step}`),
    });
    assert.equal(answered.body.status, step < 7 ? `step${step + 1}` : 'report_ready');
  }

  const paymentCreate = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(paymentCreate.body.code, 'PAYMENT_NOT_CONFIGURED');
  assert.equal(db.rows.payments.length, 0);
  assert.equal(ai.calls.toss, 0);

  const crossUser = await invoke(journey, 'user-2', { action: 'resume', conversationId });
  assert.equal(crossUser.httpStatus, 403);
  assert.equal(crossUser.body.code, 'FORBIDDEN');
});

test('enabled payment fixture charges only after STEP 7 and preserves the completed journey', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch({ tossApproved: true });
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai, { paymentEnabled: true });
  const conversationId = await completeFreeStage(early);

  const earlyOrder = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(earlyOrder.body.code, 'INVALID_STATE');
  assert.equal(db.rows.payments.length, 0);

  await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask3') });
  const step3 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '내가 숨을 고를 수 있다는 뜻이야', token: token('answer3') });
  assert.equal(step3.body.status, 'step4');

  const forged = await invoke(journey, 'user-1', {
    action: 'answer', conversationId, answer: '프론트가 완료라고 보냄', status: 'report_ready', paid: true, token: token('forged2'),
  });
  assert.equal(forged.body.ok, false);
  assert.equal(forged.body.code, 'INVALID_STATE');
  assert.equal(db.rows.conversations[0].status, 'step4');

  await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask4') });
  const feedback = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '같은 질문이잖아', token: token('feedback4') });
  assert.equal(feedback.body.status, 'step4');
  assert.equal(feedback.body.needsQuestion, true);
  const repaired = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('repair4') });
  assert.equal(repaired.body.status, 'step4');
  assert.match(repaired.body.question, /^맞아요\. 같은 내용을 되묻지 않고 질문을 바꿔볼게요\./);
  const step4 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '내가 조급해지지 않는 게 중요해', token: token('answer4') });
  assert.equal(step4.body.status, 'step5');

  const asked5 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask5') });
  assert.equal(asked5.body.status, 'step5');
  assert.doesNotMatch(asked5.body.question, /^맞아요\. 같은 내용을 되묻지 않고 질문을 바꿔볼게요\./, 'old feedback must not leak into later steps');
  const step5 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '모르겠어요', token: token('answer5') });
  assert.equal(step5.body.status, 'step6');

  const asked6 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask6') });
  assert.equal(asked6.body.status, 'step6');
  assert.match(asked6.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
  db.failOnce(({ table, op, payload }) => table === 'conversations' && op === 'update' && payload?.request_action === 'answer');
  const failedSave = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶어', token: token('savefail6') });
  assert.equal(failedSave.body.ok, false);
  assert.equal(db.rows.conversations[0].status, 'step6');
  assert.equal(db.rows.messages.some((message) => message.content === '오늘은 천천히 쉬고 싶어'), false);

  const step6Token = token('answer6');
  const step6 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶어', token: step6Token });
  assert.equal(step6.body.status, 'step7');
  const duplicateStep6 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶어', token: step6Token });
  assert.equal(duplicateStep6.body.status, 'step7');
  assert.equal(db.rows.messages.filter((message) => message.content === '오늘은 천천히 쉬고 싶어').length, 1);

  const asked7 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask7') });
  assert.equal(asked7.body.status, 'step7', JSON.stringify({ body: asked7.body, questionCandidates: ai.calls.questionCandidates }));
  const step7Feedback = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '이게 무슨 말이야', token: token('feedback7') });
  assert.equal(step7Feedback.body.status, 'step7');
  const repaired7 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('repair7') });
  assert.equal(repaired7.body.status, 'step7', JSON.stringify({ body: repaired7.body, questionCandidates: ai.calls.questionCandidates }));
  const completed = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 내 속도를 존중하고 싶어', token: token('answer7') });
  assert.equal(completed.body.status, 'report_ready');
  assert.equal(completed.body.needsQuestion, false);

  const order = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(order.body.ok, true);
  assert.equal(order.body.amount, 4900);
  assert.equal(db.rows.payments.length, 1);
  assert.equal(ai.calls.toss, 0);

  const wrongAmount = await invoke(payment, 'user-1', { action: 'confirm', paymentKey: 'fixture_key_123', orderId: order.body.orderId, amount: 990 });
  assert.equal(wrongAmount.body.code, 'AMOUNT_MISMATCH');
  assert.equal(db.rows.payments[0].status, 'ready');
  assert.equal(ai.calls.toss, 0);

  const confirmed = await invoke(payment, 'user-1', { action: 'confirm', paymentKey: 'fixture_key_123', orderId: order.body.orderId, amount: 4900 });
  assert.equal(confirmed.body.ok, true);
  assert.equal(confirmed.body.paid, true);
  assert.equal(confirmed.body.status, 'report_ready');
  assert.equal(db.rows.conversations[0].status, 'report_ready');
  assert.equal(ai.calls.toss, 1);

  const duplicateConfirm = await invoke(payment, 'user-1', { action: 'confirm', paymentKey: 'fixture_key_123', orderId: order.body.orderId, amount: 4900 });
  assert.equal(duplicateConfirm.body.status, 'report_ready');
  assert.equal(ai.calls.toss, 1);

  const crossUser = await invoke(journey, 'user-2', { action: 'resume', conversationId });
  assert.equal(crossUser.httpStatus, 403);
  assert.equal(crossUser.body.code, 'FORBIDDEN');

  const existingBuyer = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(existingBuyer.body.alreadyPaid, true);
  assert.equal(existingBuyer.body.reportEntitled, true);
  assert.equal(ai.calls.toss, 1);

  ai.failNext();
  const failedReport = await invoke(journey, 'user-1', { action: 'report', conversationId, token: token('reportfail') });
  assert.equal(failedReport.body.ok, false);
  assert.equal(db.rows.payments[0].status, 'paid');
  assert.equal(db.rows.reports.length, 0);
  const generated = await invoke(journey, 'user-1', { action: 'report', conversationId, token: token('report2') });
  assert.equal(generated.body.status, 'report_done');
  // 2026-09-16: '확정' 은 서버가 결정한다. anchor 가 사용자 근거·본문에 모두 있는 항목만 confirmed, 근거 없는 '반복 패턴' 주장은 candidate.
  assert.deepEqual(
    generated.body.report.content.sections.map((section) => section.status),
    ['confirmed', 'confirmed', 'candidate', 'candidate'],
  );
  assert.equal(generated.body.hasReport, true);
  assert.match(generated.body.report.title, /편안함/);
  const reopened = await invoke(journey, 'user-1', { action: 'report', conversationId, token: token('report3') });
  assert.equal(reopened.body.status, 'report_done');
  assert.equal(db.rows.reports.length, 1);

  assert.equal(db.rows.conversations.length, 1);
  assert.equal(db.rows.emotions.length, 1);
  assert.equal(db.rows.conversations[0].status, 'report_done');
  assert.equal(db.rows.payments.length, 1);
  assert.equal(ai.calls.toss, 1);
});

test('paid report entitlement survives refresh without moving the conversation or charging again', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch({ tossApproved: true });
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai, { paymentEnabled: true });
  const conversation = db.seed('conversations', { user_id: 'user-retry', status: 'report_ready', current_step: 8, request_token: null, request_action: null });
  const conversationId = conversation.id;
  const order = await invoke(payment, 'user-retry', { action: 'create', conversationId });
  const confirmed = await invoke(payment, 'user-retry', { action: 'confirm', paymentKey: 'fixture_retry_123', orderId: order.body.orderId, amount: 4900 });
  assert.equal(confirmed.body.paid, true);
  assert.equal(confirmed.body.status, 'report_ready');
  assert.equal(db.rows.payments[0].status, 'paid');

  const recovered = await invoke(payment, 'user-retry', { action: 'status', conversationId });
  assert.equal(recovered.body.status, 'report_ready');
  assert.equal(recovered.body.reportEntitled, true);
  assert.equal(db.rows.payments.length, 1);
  assert.equal(ai.calls.toss, 1);
});

test('uncertain, brief, and skip replies change direction through STEP 7 without repetition', async () => {
  const db = new FakeDatabase();
  const ai = createLowInformationRepeatAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'uncertain-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step4',
    current_step: 4,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘 마음은 편안함' });
  const originalQuestion = '편안함이라고 말해주셨네요.\n\n편안함이 나에게 어떤 의미인지 말해줄 수 있나요?';
  db.seed('messages', {
    conversation_id: conversation.id,
    user_id: userId,
    role: 'ai',
    step: 4,
    content: originalQuestion,
    message_kind: 'journey_question',
  });

  const shown = [originalQuestion.split(/\n\s*\n/).at(-1)];
  const answers = new Map([
    [4, '잘 모르겠다'],
    [5, '편안해'],
    [6, '이번 질문은 넘어갈게요'],
  ]);
  for (const step of [4, 5, 6]) {
    const answered = await invoke(journey, userId, {
      action: 'answer', conversationId: conversation.id, answer: answers.get(step), token: token(`low-effort-answer-${step}`),
    });
    assert.equal(answered.body.status, `step${step + 1}`);
    const asked = await invoke(journey, userId, {
      action: 'ask', conversationId: conversation.id, token: token(`uncertain-ask-${step + 1}`),
    });
    assert.equal(asked.body.status, `step${step + 1}`);
    if (step === 4) {
      assert.match(asked.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
    } else {
      assert.match(asked.body.question, /^괜찮아요\. 더 깊이 묻지 않고 가볍게 이어갈게요\./);
    }
    shown.push(asked.body.question.split(/\n\s*\n/).at(-1));
  }

  const completed = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '잘 모르겠다', token: token('uncertain-answer-7'),
  });
  assert.equal(completed.body.status, 'report_ready');
  assert.equal(new Set(shown).size, 4);
  assert.equal(shown.every((question) => question.length <= 80), true);
  assert.equal(ai.calls.openai, 6, 'each repeated candidate must be blocked before a different question is accepted');
  assert.equal(ai.calls.userPrompts.every((prompt) => !prompt.includes('잘 모르겠다')), true, 'uncertainty must not become factual evidence');
  assert.equal(ai.calls.userPrompts.every((prompt) => !prompt.includes('이번 질문은 넘어갈게요')), true, 'skip must not become factual evidence');
  assert.equal(ai.calls.userPrompts.some((prompt) => prompt.includes('편안해')), true, 'a short meaningful reply must remain evidence');
  assert.equal(ai.calls.systemPrompts.some((prompt) => prompt.includes('이미 한 질문') && prompt.includes('어떤 의미')), true);
  assert.equal(ai.calls.systemPrompts.some((prompt) => prompt.includes('대화 피로 회복')), true);
});

test('production incident: repeated effort theme is abandoned after 모르겠어요 and STEP 7 closes on a new topic', async () => {
  const db = new FakeDatabase();
  const ai = createProductionIncidentRecoveryAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'incident-regression-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step6',
    current_step: 6,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘은 걱정과 기대감이 함께 있어요' });
  const history = [
    ['user', 1, '걱정이 산더미이긴 하지만 나름 잘 살아가려고 노력중이거든요', 'step_answer'],
    ['user', 2, '묵묵히 제가 하고 싶은 일들을 하며 하루를 보낼때', 'step_answer'],
    ['ai', 3, '걱정과 기대감이 함께 느껴진다는 건 복잡한 감정이네요.\n\n기대감은 어디에서 오는 것 같나요?', 'journey_question'],
    ['user', 3, '잘 모르겠어요', 'journey_answer'],
    ['ai', 4, '걱정과 기대감이 함께 느껴진다는 건 복잡한 감정이네요.\n\n잘 살아가려고 노력하는 방법은 어떤 것들이 있나요?', 'journey_question'],
    ['user', 4, '하루하루를 열심히 살아내는거죠', 'journey_answer'],
    ['ai', 5, '걱정과 기대감이 함께 느껴진다는 건 복잡한 감정이네요.\n\n잘 살아가려는 노력 중 어떤 부분이 가장 중요하다고 느끼시나요?', 'journey_question'],
    ['user', 5, '모르겠어요', 'journey_answer'],
  ];
  for (const [role, step, content, messageKind] of history) {
    db.seed('messages', {
      conversation_id: conversation.id,
      user_id: userId,
      role,
      step,
      content,
      message_kind: messageKind,
    });
  }

  const step6 = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('incident-ask-6'),
  });
  assert.equal(step6.body.status, 'step6');
  assert.match(step6.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
  assert.match(step6.body.question, /하고 싶은 일/);
  assert.doesNotMatch(step6.body.question, /잘 살아가/);

  const answer6 = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '모르겠어요', token: token('incident-answer-6'),
  });
  assert.equal(answer6.body.status, 'step7');

  const step7 = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('incident-ask-7'),
  });
  assert.equal(step7.body.status, 'step7');
  assert.match(step7.body.question, /^괜찮아요\. 더 깊이 묻지 않고 가볍게 이어갈게요\./);
  assert.match(step7.body.question, /오늘 대화 끝/);
  assert.doesNotMatch(step7.body.question, /잘 살아가|하고 싶은 일/);
  assert.equal(ai.calls.openai, 4, 'same-theme candidates must be rejected before a fresh topic is shown');
  assert.equal(ai.calls.userPrompts.every((prompt) => !prompt.includes('모르겠어요')), true, '모르겠어요 must not become user evidence');
});

test('Plan B discards a wrong frame and continues from the user correction in the same step', async () => {
  const db = new FakeDatabase();
  const ai = createPlanBRepairAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'plan-b-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step4',
    current_step: 4,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘은 날씨가 좋아서 편안해' });
  db.seed('messages', {
    conversation_id: conversation.id,
    user_id: userId,
    role: 'ai',
    step: 4,
    content: '날씨가 좋아서 편안한 마음이 중요한 이유는 무엇인가요?',
    message_kind: 'journey_question',
  });

  const corrected = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '그게 아니고 일이 끝나서 편안한 거야', token: token('plan-b-correction'),
  });
  assert.equal(corrected.body.status, 'step4');
  assert.equal(corrected.body.needsQuestion, true);

  const repaired = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('plan-b-ask'),
  });
  assert.equal(repaired.body.status, 'step4');
  assert.match(repaired.body.question, /^알겠어요\. 방금 바로잡아 준 내용에서 다시 이어갈게요\./);
  assert.match(repaired.body.question, /일이 끝난 뒤/);
  assert.equal(ai.calls.userPrompts[0].includes('일이 끝나서 편안한 거야'), true);
  assert.equal(ai.calls.userPrompts[0].includes('그게 아니고 일이 끝나서 편안한 거야'), true, 'raw feedback is passed only in the non-factual feedback block');
  assert.equal(ai.calls.systemPrompts[0].includes('따옴표 안의 말'), true);
});

test('current human-conversation engine preserves the normal answer path', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'normal-answer-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step4',
    current_step: 4,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘 마음은 편안함' });
  db.seed('messages', {
    conversation_id: conversation.id,
    user_id: userId,
    role: 'ai',
    step: 4,
    content: '편안함이 나에게 어떤 의미인지 말해줄 수 있나요?',
    message_kind: 'journey_question',
  });

  const answered = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '오늘 산책할 때 편안했어', token: token('normal-answer-4'),
  });
  assert.equal(answered.body.status, 'step5');

  const asked = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('normal-ask-5'),
  });
  assert.equal(asked.body.status, 'step5');
  assert.match(asked.body.question, /^편안하다고 말해주셨네요\./);
  assert.doesNotMatch(asked.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
});

test('legacy progress and completed buyers are preserved', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai);

  const legacy = db.seed('conversations', { user_id: 'legacy-user', status: 'step6', current_step: 6, request_token: null, request_action: null });
  db.seed('emotions', { conversation_id: legacy.id, user_id: 'legacy-user', mind_text: '기존 기록' });
  db.seed('messages', { conversation_id: legacy.id, user_id: 'legacy-user', role: 'ai', step: 6, content: '기존 질문에서 더 들려주고 싶은 부분은 무엇인가요?', message_kind: 'journey_question' });
  const resumed = await invoke(journey, 'legacy-user', { action: 'resume', conversationId: legacy.id });
  assert.equal(resumed.body.status, 'step6');
  assert.match(resumed.body.question, /무엇인가요\?$/);

  const completed = db.seed('conversations', { user_id: 'buyer', status: 'report_done', current_step: 8, request_token: null, request_action: null });
  db.seed('payments', { user_id: 'buyer', conversation_id: completed.id, order_id: 'echo-222222222222222222222222', amount: 4900, status: 'paid', payment_key: 'saved-key', approved_at: '2026-09-01T00:00:00.000Z' });
  db.seed('reports', { user_id: 'buyer', conversation_id: completed.id, title: '보존된 리포트', summary: '보존됨', content: { title: '보존된 리포트', summary: '보존됨', sections: [], next_step: '다음' } });
  const status = await invoke(payment, 'buyer', { action: 'status', conversationId: completed.id });
  assert.equal(status.body.paid, true);
  assert.equal(status.body.status, 'report_done');
  const report = await invoke(journey, 'buyer', { action: 'resume', conversationId: completed.id });
  assert.equal(report.body.hasReport, true);
  assert.equal(report.body.report.title, '보존된 리포트');
});

test('understanding rejection is saved first and a different follow-up reaches free STEP 3', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'correction-user', { action: 'start', mindText: '오늘은 마음이 편안해', token: token('corr-start') });
  const conversationId = started.body.conversationId;
  await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-ask1') });
  await invoke(early, 'correction-user', { action: 'answer', conversationId, answer: '편안한 이유를 아직 모르겠어', token: token('corr-ans1') });
  await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-ask2') });
  await invoke(early, 'correction-user', { action: 'answer', conversationId, answer: '그냥 일이 끝나서 그런 것 같아', token: token('corr-ans2') });
  await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-under1') });

  const rejected = await invoke(early, 'correction-user', {
    action: 'choose', conversationId, choice: 'no', text: '날씨 때문이 아니라 일이 끝나서 편안한 거야', token: token('corr-no'),
  });
  assert.equal(rejected.body.status, 'followup');
  assert.equal(db.rows.understanding_results[0].choice, 'no');
  assert.equal(db.rows.understanding_results[0].correction_text, '날씨 때문이 아니라 일이 끝나서 편안한 거야');

  const followup = await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-follow') });
  assert.equal(followup.body.status, 'followup');
  assert.match(followup.body.question, /\?$/);
  await invoke(early, 'correction-user', { action: 'answer', conversationId, answer: '할 일을 마치고 내 속도로 쉴 수 있어서야', token: token('corr-answer') });
  const revised = await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-under2') });
  assert.equal(revised.body.status, 'understanding');
  assert.match(revised.body.understanding, /스스로 정한 속도/);
  const agreed = await invoke(early, 'correction-user', { action: 'choose', conversationId, choice: 'agree', text: '', token: token('corr-agree') });
  assert.equal(agreed.body.status, 'step3');
  assert.equal(db.rows.understanding_results.length, 2);
});

test('unpaid completed conversation cannot read, generate, or list report content', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const completed = db.seed('conversations', { user_id: 'unpaid-user', status: 'report_ready', current_step: 8, request_token: null, request_action: null });
  db.seed('reports', { user_id: 'unpaid-user', conversation_id: completed.id, title: '노출되면 안 됨', summary: '비공개', content: { title: '비공개', summary: '비공개', sections: [], next_step: '비공개' } });

  const resumed = await invoke(journey, 'unpaid-user', { action: 'resume', conversationId: completed.id });
  assert.equal(resumed.body.reportEntitled, false);
  assert.equal('report' in resumed.body, false);
  const generated = await invoke(journey, 'unpaid-user', { action: 'report', conversationId: completed.id, token: token('unpaid-report') });
  assert.equal(generated.httpStatus, 403);
  assert.equal(generated.body.code, 'PAYMENT_REQUIRED');
  assert.equal('report' in generated.body, false);
  const listed = await invoke(journey, 'unpaid-user', { action: 'list' });
  assert.deepEqual(listed.body.items, []);

  const otherUser = await invoke(journey, 'other-user', { action: 'resume', conversationId: completed.id });
  assert.equal(otherUser.httpStatus, 403);
  assert.equal(otherUser.body.code, 'FORBIDDEN');
});

test('AI failure after a saved answer preserves the new step and allows a question retry', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'user-1', { action: 'start', mindText: '오늘은 마음이 편안해', token: token('retry-start') });
  const conversationId = started.body.conversationId;
  await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('retry-ask1') });
  const saved = await invoke(early, 'user-1', { action: 'answer', conversationId, answer: '답변은 먼저 안전하게 저장해', token: token('retry-answer1') });
  assert.equal(saved.body.status, 'step2');
  assert.equal(db.rows.messages.filter((message) => message.content === '답변은 먼저 안전하게 저장해').length, 1);

  ai.failNext();
  const failedQuestion = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('retry-ask2') });
  assert.equal(failedQuestion.body.ok, false);
  assert.equal(failedQuestion.body.code, 'AI_ERROR');
  assert.equal(db.rows.conversations[0].status, 'step2');
  assert.equal(db.rows.messages.filter((message) => message.content === '답변은 먼저 안전하게 저장해').length, 1);

  const retry = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('retry-ask3') });
  assert.equal(retry.body.status, 'step2');
  assert.equal(retry.body.needsQuestion, false);
  assert.match(retry.body.question, /\?$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-17 대표 지시(신뢰·재사용 가치 증명) 검사
// ② 질문과 단계 진행 분리 / ③ 회피 문장 금지 / ⑤ 확인된 기억 / ⑥ 저장 복구·지속 대화
// 실제 OpenAI·실제 DB 가 아니라 가짜 응답·가짜 DB 로 서버 규칙만 검사한다(로컬 모의 검사).
// ─────────────────────────────────────────────────────────────────────────────

async function reachStep(journey, early, userId, targetStep) {
  const conversationId = await completeFreeStage(early, userId);
  for (let step = 3; step < targetStep; step++) {
    await invoke(journey, userId, { action: 'ask', conversationId, token: token(`${userId}-jask-${step}`) });
    const answered = await invoke(journey, userId, {
      action: 'answer', conversationId, answer: `${step}단계에서 새로 떠오른 이야기를 적었어`, token: token(`${userId}-jans-${step}`),
    });
    assert.equal(answered.body.status, `step${step + 1}`);
  }
  return conversationId;
}

function captureServerLogs() {
  const original = console.error;
  const lines = [];
  console.error = (...args) => { lines.push(args.join(' ')); };
  return { lines, restore: () => { console.error = original; } };
}

test('STEP 7 에서 되물어도 단계가 넘어가지 않고 먼저 답한다(리포트로 건너뛰지 않음)', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);

  const conversationId = await reachStep(journey, early, 'user-step7', 7);
  await invoke(journey, 'user-step7', { action: 'ask', conversationId, token: token('s7-ask') });

  const askedBack = await invoke(journey, 'user-step7', {
    action: 'answer', conversationId, answer: '그 뜻이 아니라 쉬고 싶다는 뜻이야. 그럼 어떻게 해야 좋을까?', token: token('s7-question'),
  });
  assert.equal(askedBack.body.status, 'step7', '질문했다는 이유로 report_ready 로 넘어가면 안 된다');
  assert.equal(askedBack.body.needsQuestion, true);

  const replied = await invoke(journey, 'user-step7', { action: 'ask', conversationId, token: token('s7-reply') });
  assert.equal(replied.body.status, 'step7');
  assert.equal(replied.body.needsQuestion, false);
  const text = replied.body.question;
  assert.match(text, /정답을 알지 못해요/, '사용자의 물음에 대한 답이 먼저 나와야 한다');
  assert.ok(!/대신 정답을 정해 줄 수는 없지만/.test(text), '고정 회피 문장을 답으로 쓰지 않는다');
  assert.equal(ai.calls.askedQuestions.length, 1);

  const realAnswer = await invoke(journey, 'user-step7', {
    action: 'answer', conversationId, answer: '쉬는 시간을 먼저 정해두고 싶어', token: token('s7-answer'),
  });
  assert.equal(realAnswer.body.status, 'report_ready', '진짜 답변은 정상적으로 마지막 단계를 닫는다');
});

test('ECHO 자체에 대한 물음에는 답만 하고 새 질문을 강제로 붙이지 않는다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);

  const conversationId = await completeFreeStage(early, 'user-meta');
  await invoke(journey, 'user-meta', { action: 'ask', conversationId, token: token('meta-ask') });
  const askedBack = await invoke(journey, 'user-meta', {
    action: 'answer', conversationId, answer: 'ai도 오타가 날 수 있어?', token: token('meta-q'),
  });
  assert.equal(askedBack.body.status, 'step3');

  const replied = await invoke(journey, 'user-meta', { action: 'ask', conversationId, token: token('meta-reply') });
  const text = replied.body.question;
  assert.ok(!text.includes('?'), '답만 하는 턴에는 질문을 붙이지 않는다');
  assert.match(text, /오타/);
  assert.equal(replied.body.needsQuestion, false, '답만 한 턴도 사용자가 이어서 말할 수 있는 상태다');

  // 답만 한 턴 뒤에도 사용자는 그냥 이어서 답할 수 있고, 그때 단계가 진행된다.
  const continued = await invoke(journey, 'user-meta', {
    action: 'answer', conversationId, answer: '알겠어. 오늘은 마음이 조금 가벼워진 느낌이야', token: token('meta-answer'),
  });
  assert.equal(continued.body.status, 'step4');
});

test('STEP 1·2 에서 되물어도 단계가 넘어가지 않고 답을 받는다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'user-early', { action: 'start', mindText: '오늘은 마음이 편안해', token: token('early-start') });
  const conversationId = started.body.conversationId;
  await invoke(early, 'user-early', { action: 'ask', conversationId, token: token('early-ask1') });

  const askedBack = await invoke(early, 'user-early', {
    action: 'answer', conversationId, answer: '이걸 어떻게 말해야 좋을까?', token: token('early-q'),
  });
  assert.equal(askedBack.body.status, 'step1', 'STEP 1 에서 되물으면 STEP 2 로 넘어가지 않는다');

  const replied = await invoke(early, 'user-early', { action: 'ask', conversationId, token: token('early-reply') });
  assert.equal(replied.body.status, 'step1');
  assert.equal(replied.body.needsQuestion, false);
  assert.match(replied.body.question, /정답을 알지 못해요/);

  const answered = await invoke(early, 'user-early', {
    action: 'answer', conversationId, answer: '서두르지 않아도 된다는 여유야', token: token('early-answer'),
  });
  assert.equal(answered.body.status, 'step2', '진짜 답변은 정상적으로 다음 단계로 간다');
});

test('확인한 내용은 기억으로 남고, 거절한 해석은 기억으로 되살아나지 않는다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  await completeFreeStage(early, 'user-memory');
  const saved = db.rows.doit_insights.filter((row) => row.user_id === 'user-memory');
  assert.equal(saved.length, 1, '맞아요로 확인한 내용이 기억으로 저장된다');
  assert.equal(saved[0].status, 'confirmed');
  assert.equal(saved[0].category, 'memory');

  // 거절한 해석은 rejected 로 남아 다음 기억 조회에서 빠진다.
  db.seed('doit_insights', {
    user_id: 'user-memory', category: 'memory', text: '나는 관계에서 늘 먼저 물러난다',
    ai_text: '관계에서 물러나는 사람', status: 'rejected', origin: 'self', revision: 1,
  });
  db.seed('doit_insights', {
    user_id: 'other-user', category: 'memory', text: '다른 사람의 기억은 절대 나오면 안 된다',
    status: 'confirmed', origin: 'ai', revision: 1,
  });

  const second = await invoke(early, 'user-memory', { action: 'start', mindText: '오늘도 마음을 적어본다', token: token('memory-start2') });
  const conversationId = second.body.conversationId;
  const before = ai.calls.systemPrompts.length;
  await invoke(early, 'user-memory', { action: 'ask', conversationId, token: token('memory-ask2') });
  const prompt = ai.calls.systemPrompts.slice(before).join('\n');

  assert.match(prompt, /내가 확인한 기억/);
  assert.ok(!prompt.includes('관계에서 늘 먼저 물러난다'), '거절한 해석은 기억으로 다시 쓰지 않는다');
  assert.ok(!prompt.includes('다른 사람의 기억'), '다른 사용자의 기억은 절대 노출되지 않는다');
});

test('기억 조회 실패를 기억 없음으로 숨기지 않는다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'user-mem-fail', { action: 'start', mindText: '오늘은 마음이 편안해', token: token('memfail-start') });
  const conversationId = started.body.conversationId;
  db.failOnce((context) => context.table === 'doit_insights' && context.op === 'select', 'memory lookup down');

  const logs = captureServerLogs();
  try {
    const asked = await invoke(early, 'user-mem-fail', { action: 'ask', conversationId, token: token('memfail-ask') });
    assert.equal(asked.body.status, 'step1', '기억 조회가 실패해도 대화는 계속된다');
  } finally {
    logs.restore();
  }
  assert.ok(logs.lines.some((line) => line.includes('memory_lookup_error')), '조회 실패는 로그로 드러나야 한다');
});

test('리포트 이후에도 완료 상태를 되돌리지 않고 대화를 이어간다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);

  const conversation = db.seed('conversations', { user_id: 'user-after', status: 'report_done', current_step: 8, request_token: null, request_action: null });
  db.seed('emotions', { conversation_id: conversation.id, user_id: 'user-after', mind_text: '오늘은 마음이 편안해' });
  db.seed('messages', { conversation_id: conversation.id, user_id: 'user-after', role: 'user', step: 7, content: '쉬는 시간을 먼저 정해두고 싶어', message_kind: 'journey_answer' });
  db.seed('reports', { conversation_id: conversation.id, user_id: 'user-after', title: '기록', summary: '나는 여유를 중요하게 느꼈어요.', content: {}, model: 'test' });

  const unpaid = await invoke(journey, 'user-after', { action: 'ask', conversationId: conversation.id, token: token('after-unpaid') });
  assert.equal(unpaid.body.code, 'PAYMENT_REQUIRED', '결제하지 않으면 리포트 이후 대화도 열리지 않는다');

  db.seed('payments', { conversation_id: conversation.id, user_id: 'user-after', status: 'paid', amount: 4900 });
  const asked = await invoke(journey, 'user-after', { action: 'ask', conversationId: conversation.id, token: token('after-ask') });
  assert.equal(asked.body.status, 'report_done', '완료 상태를 되돌리지 않는다');
  assert.equal(asked.body.step, 8);
  assert.ok(asked.body.question);

  const answered = await invoke(journey, 'user-after', {
    action: 'answer', conversationId: conversation.id, answer: '리포트를 보고 나서도 더 이야기하고 싶어', token: token('after-answer'),
  });
  assert.equal(answered.body.status, 'report_done');
  const continuedMessages = db.rows.messages.filter((row) => row.conversation_id === conversation.id && row.step === 8);
  assert.equal(continuedMessages.length, 2, '리포트 이후 대화는 step 8 메시지로만 쌓인다');
  assert.equal(db.rows.conversations.find((row) => row.id === conversation.id).status, 'report_done');
});

test('응답이 유실돼 같은 답변을 다시 보내도 한 번만 저장된다', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);

  const conversationId = await completeFreeStage(early, 'user-retry');
  await invoke(journey, 'user-retry', { action: 'ask', conversationId, token: token('retry-ask') });

  const answerBody = { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶은 마음이야', token: token('retry-answer') };
  const first = await invoke(journey, 'user-retry', answerBody);
  assert.equal(first.body.status, 'step4');
  const again = await invoke(journey, 'user-retry', answerBody);
  assert.equal(again.body.status, 'step4', '같은 토큰 재전송은 저장된 상태를 그대로 돌려준다');

  const saved = db.rows.messages.filter((row) => row.conversation_id === conversationId && row.content === '오늘은 천천히 쉬고 싶은 마음이야');
  assert.equal(saved.length, 1, '중복 저장이 생기면 안 된다');
});

// ═══ 2026-09-17 실기기 재현 검사 ═══
// 운영 DB 기록: STEP 1 질문이 "…궁금해?" 반말로 저장됐고, 짧은 답변("돈때문에") 뒤
// STEP 2 질문 생성이 3회 모두 막혀 화면에 "질문을 만들지 못했어요" 가 떴다.
// 같은 상황을 그대로 만들고, 이제는 (1) 저장되는 질문이 해요체이고 (2) 질문이 나오는지 본다.

function createBanmalRepeatAiFetch() {
  const calls = { openai: 0, plain: [] };
  // 모델이 계속 반말로, 그리고 STEP 1 과 같은 뜻('걱정/이유')으로만 대답하는 최악의 경우.
  const plainAnswers = [
    '맑은 날씨인데도 걱정이 드는 이유가 무엇인지 궁금해?',
    '그 걱정이 어떤 이유에서 오는지 궁금해?',
    '걱정이 드는 이유를 조금 더 말해줄래?',
    '그 걱정의 이유가 무엇인지 궁금해?',
  ];
  let plainIndex = 0;
  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    const wantsJson = request.response_format?.type === 'json_object';
    if (wantsJson) {
      const content = JSON.stringify({
        candidates: [{
          acknowledgement: '돈때문에라고 말해주셨네요.',
          question: '돈에 대해 지금 가장 마음에 걸리는 부분이 무엇인지 궁금해?',
          anchor: '돈때문에',
          assumptions: [],
          meaning: '돈에서 걸리는 지점 하나',
          keys: ['돈'],
        }],
      });
      return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    const answer = plainAnswers[Math.min(plainIndex++, plainAnswers.length - 1)];
    calls.plain.push(answer);
    return new Response(JSON.stringify({ choices: [{ message: { content: answer }, finish_reason: 'stop' }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

test('실기기 재현: 반말 질문은 해요체로 저장되고, 짧은 답변 뒤에도 STEP 2 질문이 나온다', async () => {
  const db = new FakeDatabase();
  const ai = createBanmalRepeatAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'user-1', { action: 'start', mindText: '맑지만 걱정이야', token: token('rk-start') });
  assert.equal(started.body.status, 'step1');
  const conversationId = started.body.conversationId;

  const step1 = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('rk-ask1') });
  assert.equal(step1.httpStatus, 200, 'STEP 1 질문이 만들어져야 한다');
  const step1Text = String(step1.body.question ?? '');
  assert.ok(step1Text, 'STEP 1 질문이 비어 있으면 안 된다');
  assert.equal(/궁금해\?/.test(step1Text), false, `반말이 그대로 나갔다: ${step1Text}`);
  assert.match(step1Text, /(요|죠|니다)\s*\?$/u, `해요체가 아니다: ${step1Text}`);

  // 운영에서 실제로 들어온 짧은 답변
  const answered = await invoke(early, 'user-1', { action: 'answer', conversationId, answer: '돈때문에', token: token('rk-ans1') });
  assert.equal(answered.body.status, 'step2', '짧은 답변도 정상 입력이다');

  // 여기가 운영에서 "질문을 만들지 못했어요" 로 끝났던 지점이다.
  const step2 = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('rk-ask2') });
  assert.equal(step2.httpStatus, 200, `STEP 2 에서 또 막혔다: ${JSON.stringify(step2.body)}`);
  const step2Text = String(step2.body.question ?? '');
  assert.ok(step2Text, `STEP 2 질문이 비었다: ${JSON.stringify(step2.body)}`);
  assert.equal(/궁금해\?/.test(step2Text), false, `STEP 2 도 반말이다: ${step2Text}`);
  assert.match(step2Text, /(요|죠|니다)\s*\?$/u, `STEP 2 가 해요체가 아니다: ${step2Text}`);

  // 저장된 질문도 해요체여야 한다(화면과 기록이 같아야 한다).
  const stored = db.rows.messages.filter((row) => row.role === 'ai').map((row) => row.content);
  assert.ok(stored.length >= 2, '질문이 저장되어야 한다');
  for (const content of stored) {
    assert.equal(/궁금해\?|줄래\?|어때\?/.test(content), false, `저장된 기록에 반말이 남았다: ${content}`);
  }
});
