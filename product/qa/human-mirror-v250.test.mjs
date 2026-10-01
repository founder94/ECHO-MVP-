import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

test('v2.5 human mirror: friend goal does not seed survey words', () => {
  const s = read('supabase/functions/doit-agent/agent.ts');
  const friend = s.slice(s.indexOf('friend: { name: "친구"'), s.indexOf('romantic: { name: "연애"'));
  for (const word of ['활동', '빈도', '방식', '선호']) assert.ok(!friend.includes(word), word);
  assert.match(s, /방금 답에서 태어나야 한다/);
  assert.match(s, /실제 사람이 바로 반응/);
  assert.match(s, /READY_SAVED_ANSWERS = 3/);
  assert.match(s, /ENOUGH_SLOTS = 4/);
  assert.match(s, /MAX_CALLS_PER_TURN = 3/);
  assert.match(s, /surveyQuestion/);
  assert.match(s, /글자 그대로 next\.question/);
});

test('conversation back edits the previous answer instead of leaving the flow', () => {
  const back = read('src/components/AppBackButton.tsx');
  const chat = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(back, /'\/doit\/conversation'/);
  assert.match(chat, /직전 답 고치기/);
  assert.match(chat, /직전 답으로 돌아왔어요/);
  assert.match(chat, /previousQuestion/);
  assert.match(chat, /correctionMode \? \{ purpose: null \} : undefined/);
  assert.match(chat, /그 뒤 질문도 고친 답 기준으로 다시 정해요/);
});

test('one homepage CTA is mobile app install and brand redirects to the app intro', () => {
  const cta = read('src/pages/home/components/IdentitySection.tsx');
  const vite = read('vite.config.ts');
  assert.match(cta, /모바일 앱 깔기/);
  assert.match(cta, /to="\/do-it\/intro"/);
  assert.match(vite, /"\/do-it\/intro"/);
});


test('v2.5.1 mirror guard rejects analytic acknowledgements and generic person questions', () => {
  const s = read('supabase/functions/doit-agent/agent.ts');
  assert.match(s, /echo-agent-v2\.5\.8/);
  assert.match(s, /analyticAck/);
  assert.match(s, /genericPersonQuestion/);
  assert.match(s, /원하시네요/);
  assert.match(s, /GENERIC_PERSON_Q/);
  assert.match(s, /18자 이내/);
});

test('v2.5.3 keeps follow-up short and rejects stiff survey phrasing', () => {
  const s = read('supabase/functions/doit-agent/agent.ts');
  assert.match(s, /stiffQuestion/);
  assert.match(s, /질문은 가능하면 30자 안쪽/);
  assert.match(s, /함께하고\\s\*싶으세요/);
});

// v2.5.3 QA trigger

test('v2.5.4 never displays a stubborn survey-style question without a humanizer pass', () => {
  const s = read('supabase/functions/doit-agent/agent.ts');
  assert.match(s, /questionNeedsHumanizing/);
  assert.match(s, /QUESTION_REWRITE_PROMPT/);
  assert.match(s, /QUESTION_STYLE/);
  assert.match(s, /question_rewrite/);
});
