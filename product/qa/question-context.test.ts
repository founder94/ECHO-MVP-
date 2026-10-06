import test from 'node:test';
import assert from 'node:assert/strict';
import {
  askedQuestionTexts,
  askedJourneyFullTexts,
  correctionEvidence,
  displayedQuestionText,
  isBriefReply,
  isLowInformationReply,
  latestJourneyQuestion,
  isMetaFeedback,
  journeyFeedbackKind,
  nextQuestionFocus,
  questionIntentTag,
  questionIntentTags,
  questionQualityReason,
  repeatsQuestionIntent,
  reusesJourneyAnchor,
  userEvidenceParts,
  type EvidenceContext,
  type GroundedCandidate,
} from '../supabase/functions/echo-journey/question-quality.ts';

const context: EvidenceContext = {
  mindText: '선선하다',
  messages: [
    { role: 'ai', step: 1, content: '선선한 날씨가 어떤 기분을 주나요?', message_kind: 'step_question' },
    { role: 'user', step: 1, content: '희망?', message_kind: 'step_answer' },
    { role: 'ai', step: 2, content: '희망은 어떤 모습인가요?', message_kind: 'step_question' },
    { role: 'user', step: 2, content: '미래의 나의 모습', message_kind: 'step_answer' },
    {
      role: 'ai',
      step: 3,
      content: '선선한 날씨가 희망을 주고 미래의 모습으로 나타나는 것 같아요.',
      message_kind: 'understanding_summary',
    },
    { role: 'user', step: 3, content: '맞아요', message_kind: 'understanding_choice' },
    { role: 'user', step: 3, content: '질문이 없는데 뭘 적어요', message_kind: 'journey_answer' },
  ],
  understandings: [],
};

const candidate = (question: string, anchor: string, assumptions: string[] = []): GroundedCandidate => ({
  question,
  anchor,
  assumptions,
  meaning: '사용자 표현을 구체화',
  keys: ['구체화'],
});

test('understanding summary can never be reused as a STEP 3 journey question', () => {
  assert.equal(latestJourneyQuestion(context, 3), '');
  const withQuestion: EvidenceContext = {
    ...context,
    messages: [
      ...context.messages,
      { role: 'ai', step: 3, content: '“미래의 나의 모습”에서 지금 가장 중요한 부분은 무엇인가요?', message_kind: 'journey_question' },
    ],
  };
  assert.match(latestJourneyQuestion(withQuestion, 3), /무엇인가요\?$/);

  const answered: EvidenceContext = {
    ...withQuestion,
    messages: [
      ...withQuestion.messages,
      { role: 'user', step: 3, content: '지금의 편안함이 중요해', message_kind: 'journey_answer' },
    ],
  };
  assert.equal(latestJourneyQuestion(answered, 3), '');
});

test('only user-authored content becomes factual evidence', () => {
  assert.deepEqual(userEvidenceParts(context), ['선선하다', '희망?', '미래의 나의 모습']);
});

test('live complaints are treated as repair feedback, not self-understanding evidence', () => {
  assert.equal(isMetaFeedback('기분이 어떤지 더 어떻게 이야기하라는거야?'), true);
  assert.equal(isMetaFeedback('이게 무슨 말이냐'), true);
  assert.equal(isMetaFeedback('같은 질문이잖아'), true);
  assert.equal(isMetaFeedback('모르겠어요'), false);
  assert.equal(isMetaFeedback('맞아요'), false);
});

test('Plan B keeps an explicit correction but never turns the complaint into self-understanding evidence', () => {
  assert.equal(journeyFeedbackKind('같은 질문이잖아'), 'repeat');
  assert.equal(journeyFeedbackKind('질문이 너무 어렵고 지루해'), 'burden');
  assert.equal(journeyFeedbackKind('그게 아니고 일이 끝나서 편안한 거야'), 'correction');
  assert.equal(journeyFeedbackKind('이게 무슨 말이야'), 'confusion');
  assert.equal(correctionEvidence('그게 아니고 일이 끝나서 편안한 거야'), '일이 끝나서 편안한 거야');
  assert.equal(correctionEvidence('같은 질문이잖아'), '');

  const corrected: EvidenceContext = {
    ...context,
    messages: [
      ...context.messages,
      { role: 'user', step: 4, content: '그게 아니고 일이 끝나서 편안한 거야', message_kind: 'journey_answer' },
    ],
  };
  assert.equal(userEvidenceParts(corrected).includes('일이 끝나서 편안한 거야'), true);
  assert.equal(userEvidenceParts(corrected).some((part) => part.includes('그게 아니고')), false);
});

test('real-world 모르겠다 and skip variants are uncertainty, never factual evidence', () => {
  for (const text of [
    '모르겠다',
    '잘 모르겠다',
    '잘 모르겠어',
    '잘 모르겠어요',
    '잘 모르겠습니다',
    '잘 모르겠는데',
    '생각이 안 나요',
    '딱히 없어요',
    '패스',
    '이번 질문은 넘어갈게요',
  ]) {
    assert.equal(isLowInformationReply(text), true, text);
  }
  const uncertain: EvidenceContext = {
    ...context,
    messages: [
      ...context.messages,
      { role: 'user', step: 4, content: '잘 모르겠다', message_kind: 'journey_answer' },
    ],
  };
  assert.deepEqual(userEvidenceParts(uncertain), ['선선하다', '희망?', '미래의 나의 모습']);
});

test('a short meaningful reply remains evidence while lowering the next-question burden', () => {
  assert.equal(isBriefReply('편안해'), true);
  const brief: EvidenceContext = {
    ...context,
    messages: [
      ...context.messages,
      { role: 'user', step: 4, content: '편안해', message_kind: 'journey_answer' },
    ],
  };
  assert.equal(userEvidenceParts(brief).includes('편안해'), true);
});

test('repeat comparison uses only the displayed question and blocks the same intent', () => {
  const rendered = '편안함이라고 말해주셨네요.\n\n편안함이 나에게 어떤 의미인지 말해줄 수 있나요?';
  assert.equal(displayedQuestionText(rendered), '편안함이 나에게 어떤 의미인지 말해줄 수 있나요?');
  const asked: EvidenceContext = {
    ...context,
    messages: [
      ...context.messages,
      { role: 'ai', step: 4, content: rendered, message_kind: 'journey_question' },
    ],
  };
  assert.equal(askedQuestionTexts(asked).at(-1), '편안함이 나에게 어떤 의미인지 말해줄 수 있나요?');
  assert.equal(questionIntentTag('이 편안함이 나에게 어떤 뜻인지 말해줄 수 있나요?'), 'meaning');
  assert.equal(repeatsQuestionIntent('이 편안함이 나에게 어떤 뜻인지 말해줄 수 있나요?', [displayedQuestionText(rendered)]), true);
  assert.equal(repeatsQuestionIntent('이 편안함이 가장 또렷했던 때는 언제였나요?', [displayedQuestionText(rendered)]), false);
});

test('a question with multiple intents is blocked when any intent was already asked', () => {
  const mixed = '오늘 편안함이 중요했던 상황은 언제였나요?';
  assert.deepEqual(questionIntentTags(mixed), ['context', 'importance']);
  assert.equal(repeatsQuestionIntent(mixed, ['편안함에서 가장 중요했던 것은 무엇인가요?']), true);
});

test('the next focus moves to an unused conversation facet instead of repeating depth questions', () => {
  const asked = [
    '그 마음이 어떤 의미인지 말해줄 수 있나요?',
    '그때 기분은 어땠나요?',
    '그 마음이 가장 또렷했던 때는 언제였나요?',
  ];
  assert.equal(nextQuestionFocus(6, asked), 'preference');
  assert.equal(nextQuestionFocus(7, [...asked, '지금 원하는 것은 무엇인가요?']), 'preserve');
});

test('an uncertain reply blocks the same conversation anchor, not only the same question wording', () => {
  const repeatedAnchorContext: EvidenceContext = {
    ...context,
    messages: [
      ...context.messages,
      {
        role: 'ai',
        step: 4,
        content: '잘 살아가려고 노력한다고 말해주셨네요.\n\n그 노력에서 가장 중요한 것은 무엇인가요?',
        message_kind: 'journey_question',
      },
      { role: 'user', step: 4, content: '모르겠어요', message_kind: 'journey_answer' },
    ],
  };
  const full = askedJourneyFullTexts(repeatedAnchorContext);
  assert.equal(reusesJourneyAnchor('잘 살아가려고 노력', full), true);
  assert.equal(reusesJourneyAnchor('오늘', full), false, 'short neutral bridge words must stay usable');
});

test('server blocks the exact broken-question patterns seen in the live run', () => {
  const evidence = userEvidenceParts(context);
  assert.equal(
    questionQualityReason(candidate('선선한 날씨가 희망을 주고 미래의 모습으로 나타나는 것 같아요.', '선선하다'), evidence),
    'not_question',
  );
  assert.equal(
    questionQualityReason(candidate('“미래의 나의 모습”에서 어떤 장면이 가장 기억에 남나요?', '미래의 나의 모습'), evidence),
    'impossible_future_memory',
  );
  assert.equal(
    questionQualityReason(candidate('“희망”과 달리 현재 피하고 있는 것은 무엇인가요?', '희망'), evidence),
    'unsupported_premise',
  );
  assert.equal(
    questionQualityReason(candidate('“희망”을 느낄 때 부정적인 사람은 누구인가요?', '희망'), evidence),
    'unsupported_premise',
  );
});

test('a single, answerable question anchored in the user words passes', () => {
  const evidence = userEvidenceParts(context);
  assert.equal(
    questionQualityReason(candidate('그 모습을 떠올릴 때 가장 먼저 바뀌었으면 하는 것은 무엇인가요?', '미래의 나의 모습'), evidence),
    null,
  );
  assert.equal(
    questionQualityReason(candidate('“희망”이라는 말에서 지금 더 설명하고 싶은 부분은 무엇인가요?', '희망', ['사용자는 변화가 필요하다']), evidence),
    'declared_assumption',
  );
});

test('server blocks a user statement copied into a yes-or-no question', () => {
  const evidence = ['응 지금 같은 날씨가 덥지도 춥지도 않으니까 좋지'];
  assert.equal(
    questionQualityReason(candidate('지금 같은 날씨가 덥지도 춥지도 않으니까 좋지?', '날씨'), evidence),
    'echoed_user_statement',
  );
  assert.equal(
    questionQualityReason(candidate('그 날씨가 좋지?', '날씨'), evidence),
    'closed_question',
  );
});

test('the exact legacy STEP 6 echo is treated as missing so the server replaces it', () => {
  const broken: EvidenceContext = {
    mindText: '나도 날씨가 좋으니까 마음이 선선하니 좋네',
    messages: [
      { role: 'user', step: 5, content: '응 지금 같은 날씨가 덥지도 춥지도 않으니까 좋지', message_kind: 'journey_answer' },
      { role: 'ai', step: 6, content: '지금 같은 날씨가 덥지도 춥지도 않으니까 좋지?', message_kind: 'journey_question' },
    ],
    understandings: [],
  };
  assert.equal(latestJourneyQuestion(broken, 6), '');
});
