// 2026-09-16 운영 로그 근거 검사: [gsq] validate_fail reason=NOT_QUESTION / MULTIPLE_QUESTIONS 가 2회 연속 → NO_CANDIDATE.
// 서버 규칙(tidyQuestionText · softenLeadingQuestion)이 모델 출력의 끝 장식과 짧은 공감 되묻기를 정리해
// 유효한 질문 하나로 만드는지, 그리고 진짜 두 질문·비질문은 그대로 거르는지 확인한다.
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
  source += `\n${exposeLine}\n//# sourceURL=${absolutePath}?salvage=${Date.now()}-${Math.random()}\n`;
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

const EVIDENCE = '오늘은 마음이 편안해\n편안해서 조금 여유가 생겼어';

test('get-step-question: trailing emoji / closing quote after the question mark is trimmed, not rejected', async () => {
  const { validateSingleQuestion, tidyQuestionText } = await loadExports(
    'supabase/functions/get-step-question/rules.ts',
    'globalThis.__echoExposed = { validateSingleQuestion, tidyQuestionText, softenLeadingQuestion, parseCandidates, questionShape };',
  );
  const decorated = '편안하다고 말해주셨네요. 그 편안함이 어떤 때 가장 크게 느껴졌나요? 😊';
  const result = validateSingleQuestion(decorated, 200, true, EVIDENCE);
  assert.equal(result.ok, true);
  assert.equal(result.text, '편안하다고 말해주셨네요. 그 편안함이 어떤 때 가장 크게 느껴졌나요?');
  assert.equal(tidyQuestionText('"그 편안함이 어떤 때 가장 크게 느껴졌나요?"'), '그 편안함이 어떤 때 가장 크게 느껴졌나요?');
  assert.equal(tidyQuestionText('그 편안함이 어떤 때 가장 크게 느껴졌나요?..'), '그 편안함이 어떤 때 가장 크게 느껴졌나요?');
});

test('get-step-question: a short empathetic lead-in question mark becomes a period so one real question remains', async () => {
  const { validateSingleQuestion, softenLeadingQuestion } = await loadExports(
    'supabase/functions/get-step-question/rules.ts',
    'globalThis.__echoExposed = { validateSingleQuestion, tidyQuestionText, softenLeadingQuestion, parseCandidates, questionShape };',
  );
  const twoMarks = '많이 편안했죠? 그 편안함에서 지금 가장 또렷한 느낌은 무엇인가요?';
  assert.equal(softenLeadingQuestion(twoMarks), '많이 편안했죠. 그 편안함에서 지금 가장 또렷한 느낌은 무엇인가요?');
  const result = validateSingleQuestion(twoMarks, 200, true, EVIDENCE);
  assert.equal(result.ok, true);
  assert.equal((result.text.match(/\?/g) ?? []).length, 1);
});

test('get-step-question: genuine double questions, non-questions and trailing sentences are still rejected', async () => {
  const { validateSingleQuestion, questionShape } = await loadExports(
    'supabase/functions/get-step-question/rules.ts',
    'globalThis.__echoExposed = { validateSingleQuestion, tidyQuestionText, softenLeadingQuestion, parseCandidates, questionShape };',
  );
  // 앞 문장이 30자보다 길면 진짜 두 질문으로 보고 거른다
  const longLead = '오늘 편안했던 이유가 여유가 생겨서라고 이해했는데 맞나요? 그 여유는 어떤 때 가장 크게 느껴졌나요?';
  assert.deepEqual(validateSingleQuestion(longLead, 200, true, EVIDENCE), { ok: false, error: 'MULTIPLE_QUESTIONS' });
  // 세 질문
  const three = '편안했나요? 이유는 무엇인가요? 어떤 때였나요?';
  assert.deepEqual(validateSingleQuestion(three, 200, true, EVIDENCE), { ok: false, error: 'MULTIPLE_QUESTIONS' });
  // 물음표 없음
  assert.deepEqual(validateSingleQuestion('오늘은 편안한 하루였네요.', 200, true, EVIDENCE), { ok: false, error: 'NOT_QUESTION' });
  // 물음표 뒤에 글자가 있는 꼬리는 손대지 않는다(보수적)
  const trailingSentence = '그 편안함이 어떤 때 가장 크게 느껴졌나요? 편하게 말해줘요.';
  assert.deepEqual(validateSingleQuestion(trailingSentence, 200, true, EVIDENCE), { ok: false, error: 'NOT_QUESTION' });
  // 진단 형태 정보에는 원문이 없다
  assert.equal(questionShape(trailingSentence), 'qmarks=1 tail=text');
  assert.equal(questionShape('무엇인가요? ✨'), 'qmarks=1 tail=deco');
  assert.equal(questionShape('오늘은 편안한 하루였네요.'), 'qmarks=0 tail=none');
});

test('get-step-question: grounding and forbidden-term rules still apply after tidying', async () => {
  const { validateSingleQuestion } = await loadExports(
    'supabase/functions/get-step-question/rules.ts',
    'globalThis.__echoExposed = { validateSingleQuestion, tidyQuestionText, softenLeadingQuestion, parseCandidates, questionShape };',
  );
  assert.deepEqual(validateSingleQuestion('그 상처가 어디에서 왔나요? 😊', 200, true, EVIDENCE), { ok: false, error: 'NOT_GROUNDED' });
  assert.deepEqual(validateSingleQuestion('편안함을 진단하면 무엇인가요? 😊', 200, true, EVIDENCE), { ok: false, error: 'FORBIDDEN' });
});

test('candidate JSON questions are tidied in both servers without changing letters', async () => {
  const gsq = await loadExports(
    'supabase/functions/get-step-question/rules.ts',
    'globalThis.__echoExposed = { validateSingleQuestion, tidyQuestionText, softenLeadingQuestion, parseCandidates, questionShape };',
  );
  const raw = JSON.stringify({ candidates: [{ acknowledgement: '편안하다고 했죠.', question: '그 편안함이 어떤 때 가장 크게 느껴졌나요? ✨', anchor: '편안', assumptions: [], meaning: '때', keys: ['편안함'] }] });
  const parsed = gsq.parseCandidates(raw);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.candidates[0].question, '그 편안함이 어떤 때 가장 크게 느껴졌나요?');

  const journey = await loadExports(
    'supabase/functions/echo-journey/index.ts',
    'globalThis.__echoExposed = { parseCandidates, tidyQuestionText };',
  );
  const journeyParsed = journey.parseCandidates(raw);
  assert.equal(journeyParsed.length, 1);
  assert.equal(journeyParsed[0].question, '그 편안함이 어떤 때 가장 크게 느껴졌나요?');
  // 꼬리에 글자가 있으면 그대로 두고, 이후 품질 규칙(not_question)이 거른다
  assert.equal(journey.tidyQuestionText('무엇인가요? 편하게요.'), '무엇인가요? 편하게요.');
});

test('paid buyers are routed straight to the report, never back through White Door or STEP 3', async () => {
  const [success, payment, api] = await Promise.all([
    readFile(resolve(root, 'src/pages/do-it/payment/success/page.tsx'), 'utf8'),
    readFile(resolve(root, 'src/pages/do-it/payment/page.tsx'), 'utf8'),
    readFile(resolve(root, 'src/lib/echo/api.ts'), 'utf8'),
  ]);
  assert.match(success, /navigate\(`\/report\?c=\$\{encodeURIComponent\(confirmedConversationId\)\}`, \{ replace: true \}\)/);
  assert.doesNotMatch(success, /getPaymentStatus/);
  assert.doesNotMatch(success, /\/step\/3/);
  const alreadyPaidBlock = payment.slice(payment.indexOf('if (order.alreadyPaid)'), payment.indexOf('if (!order.orderId'));
  assert.match(alreadyPaidBlock, /navigate\(`\/report\?c=\$\{encodeURIComponent\(conversationId\)\}`, \{ replace: true \}\)/);
  assert.doesNotMatch(alreadyPaidBlock, /routeWithConversation\(order\.status/);
  // 상태 매핑 자체는 유지: report_ready 는 White Door(완주 전환 화면), report_done 은 리포트
  assert.match(api, /case 'report_ready':\s*return '\/white-door';/);
  assert.match(api, /case 'report_done':\s*return '\/report';/);
});
