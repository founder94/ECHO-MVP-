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
  for (const word of ['활동', '빈도', '관계 방식', '선호']) assert.ok(!friend.includes(word), word);
  assert.match(s, /방금 답에서 태어나야 한다/);
  assert.match(s, /사람이 자연스럽게 반응/);
  assert.match(s, /READY_SAVED_ANSWERS = 3/);
  assert.match(s, /ENOUGH_SLOTS = 4/);
});

test('conversation back edits the previous answer instead of leaving the flow', () => {
  const back = read('src/components/AppBackButton.tsx');
  const chat = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(back, /'\/doit\/conversation'/);
  assert.match(chat, /직전 답 고치기/);
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
