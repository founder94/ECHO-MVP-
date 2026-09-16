import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());
const read = (path) => readFile(resolve(root, path), 'utf8');

function branch(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing branch: ${start}`);
  return source.slice(from, to);
}

test('STEP 3~7 answer saves and commits without waiting for a question-generation call', async () => {
  const source = await read('supabase/functions/echo-journey/index.ts');
  const answer = branch(source, 'if (action === "answer")', '// ── report:');
  assert.match(answer, /insertMsg\([\s\S]*"user"/);
  assert.match(answer, /commit\(sb, conv\.id, token, "answer", next\)/);
  assert.doesNotMatch(answer, /genStepQuestion|callOpenAI/);
  assert.match(answer, /const repair = isMetaFeedback\(answer\)/);
});

test('STEP 1~2 answer and understanding correction save before separate ask', async () => {
  const source = await read('supabase/functions/get-step-question/index.ts');
  const answer = branch(source, '// ── answer ──', '// ── choose');
  const choose = branch(source, '// ── choose', 'return fail("BAD_REQUEST", "알 수 없는 요청이에요.")');
  assert.match(source, /if \(action === "ask"\)/);
  assert.match(answer, /insertMessage\([\s\S]*"user"/);
  assert.doesNotMatch(answer, /genStep2Question|genUnderstanding|callOpenAI/);
  assert.doesNotMatch(choose, /genFollowupQuestion|callOpenAI/);
});

test('question path has a bounded latency budget and smaller candidate set', async () => {
  const [step, journey] = await Promise.all([
    read('supabase/functions/get-step-question/index.ts'),
    read('supabase/functions/echo-journey/index.ts'),
  ]);
  assert.match(step, /OPENAI_TIMEOUT_MS = 6_000/);
  assert.match(step, /CONVERSATION_MAX_TOKENS = 500/);
  assert.match(journey, /QUESTION_TIMEOUT_MS = 6_000/);
  assert.match(journey, /REPORT_TIMEOUT_MS = 20_000/);
  assert.match(journey, /QUESTION_MAX_TOKENS = 500/);
  // 2026-09-16: 시도 3회(마지막은 완화 시도). 최악 6초×3=18초로 프론트 요청 상한(40초) 안이다.
  for (const source of [step, journey]) {
    assert.match(source, /(?:GENERATION_ATTEMPTS|ATTEMPTS): 3/);
    assert.match(source, /CANDIDATES_MAX: 3/);
  }
});

test('frontend generates missing questions separately and keeps user turns visible', async () => {
  const [api, early, journey] = await Promise.all([
    read('src/lib/echo/api.ts'),
    read('src/pages/do-it/components/StepQuestionScreen.tsx'),
    read('src/pages/do-it/components/JourneyStepScreen.tsx'),
  ]);
  assert.match(api, /export function askStepQuestion/);
  assert.match(early, /state\.needsQuestion[\s\S]*askStepQuestion/);
  assert.match(journey, /state\.needsQuestion[\s\S]*askJourneyQuestion/);
  assert.match(early, /previousAnswer/);
  assert.match(journey, /previousAnswer/);
  assert.match(journey, /이번 질문은 넘어갈게요/);
  assert.match(journey, /handleSubmit\('잘 모르겠어요'\)/);
  assert.match(journey, /handleSubmit\('이번 질문은 넘어갈게요'\)/);
});

// 2026-09-17: 리포트 이후 대화 화면도 '저장 먼저' 규칙을 지키는지(서버 응답 전에 화면을 만들지 않는지) 확인한다.
test('report page continues the conversation with the save-first controller', async () => {
  const [page, chat] = await Promise.all([
    read('src/pages/do-it/report/page.tsx'),
    read('src/pages/do-it/report/components/ContinueConversation.tsx'),
  ]);
  assert.match(page, /ContinueConversation/);
  assert.match(page, /initialTurn=\{continueTurn\}/);
  assert.match(chat, /JourneySaveController/);
  assert.match(chat, /submitJourneyAnswer\(conversationId, text, token\)/);
  // 저장 성공 뒤에만 화면에 남기고 다음 턴을 받는다.
  assert.match(chat, /outcome\.kind === 'timeout'[\s\S]*REQUEST_TIMEOUT_MESSAGE/);
  assert.match(chat, /setEntries\(\(previous\) => \[\.\.\.previous, \{ role: 'me', text \}\]\)[\s\S]*await loadTurn\(\)/);
  // 하드코딩 질문 없음: 화면이 만드는 문장은 안내 문구뿐이고 질문은 서버 응답을 그대로 쓴다.
  assert.match(chat, /state\.question/);
});
