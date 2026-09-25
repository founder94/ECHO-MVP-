// v14.2 앱 진입 계약 (대표 2026-09-22 실기기: "메인 페이지에서 시작을 해야 하는데 로그인이
// 되어 있다는 이유만으로 여기서 시작하는 건지 / 처음으로 돌아가려니 그것도 없고").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(root, p), 'utf8');

test('앱의 메인(/)은 시작 흐름이 아니라 앱 홈이다', async () => {
  const routes = await read('src/router/config.tsx');
  assert.match(routes, /const entryLanding = BRAND \? <DoItLandingPage \/> : <Navigate to="\/doit\/home" replace \/>;/);
  assert.doesNotMatch(routes, /entryLanding = BRAND[^;]*start-journey/);
  assert.match(routes, /BRAND \? <DoItLandingPage \/>/);
});

test('로그인했다는 이유만으로 대화로 끌려가지 않는다', async () => {
  const page = await read('src/doit/pages/do-it/start-journey/page.tsx');
  assert.match(page, /const goConversation = A_STRUCTURE_SERVER_ENABLED && edit !== "profile" && edit !== "photos" && !purposeId;/);
  assert.match(page, /if \(purposeId && !edit && A_STRUCTURE_SERVER_ENABLED\) nextStep = "conversation-choice";/);
});

test('막다른 길을 만들지 않는다 — 어디서든 홈으로 나갈 수 있다', async () => {
  const [choice, conversation] = await Promise.all([
    read('src/doit/pages/do-it/start-journey/page.tsx'),
    read('src/doit/components/feature/CoreConversation.tsx'),
  ]);
  assert.match(choice, /navigate\("\/doit\/home"\)\}>홈으로<\/button>/);
  assert.match(conversation, /<Link to="\/doit\/home">홈<\/Link>/);
});

test('앱 홈이 지금 어디까지 왔는지와 다음 할 일을 보여 준다', async () => {
  const home = await read('src/doit/pages/do-it/home/page.tsx');
  assert.match(home, /다섯 가지만<br \/>물어볼게요/);
  assert.match(home, /시작하기 </);
  assert.match(home, /대화 이어가기 </);
  assert.match(home, /다섯 가지,<br \/>다 들었어요/);
  assert.match(home, /import \{ ASK_TOTAL \} from '@\/doit\/components\/feature\/CoreConversation';/);
  assert.match(home, /\{answered\} \/ \{ASK_TOTAL\}/);
  assert.match(home, /처음부터 다시 시작하기/);
  assert.match(home, /연결 준비 상태 보기/);
});
