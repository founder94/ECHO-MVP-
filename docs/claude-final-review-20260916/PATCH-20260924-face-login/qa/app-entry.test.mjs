// v14.2 앱 진입 계약 (대표 2026-09-22 실기기: "메인 페이지에서 시작을 해야 하는데 로그인이
// 되어 있다는 이유만으로 여기서 시작하는 건지 / 처음으로 돌아가려니 그것도 없고").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(root, p), 'utf8');

test('v14.3 앱도 홈페이지처럼 온보딩 뒤 히어로로 들어온다 (대표 실기기 "히어로 페이지가 안 보여")', async () => {
  const routes = await read('src/router/config.tsx');
  assert.match(routes, /const entryLanding = <DoItLandingPage \/>;/);
  // 로그인했다는 이유만으로 시작 흐름·대화로 건너뛰지 않는다.
  assert.doesNotMatch(routes, /entryLanding = [^;]*start-journey/);
  assert.doesNotMatch(routes, /entryLanding = [^;]*conversation/);
  // 히어로의 「지금 시작하기」는 앱 안에서는 주소를 바꾸지 않고 시작 흐름으로 간다.
  const landing = await read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /if \(IS_BRAND_SITE\) \{ window\.location\.assign\(appUrl\('\/doit\/start-journey'\)\); return; \}\n\s*navigate\('\/doit\/start-journey'\);/);
});

test('v14.3 처음부터 다시 — 대화 화면 위쪽에도 있고, 누른 자리 옆에 확인 창이 뜬다', async () => {
  const c = await read('src/doit/components/feature/CoreConversation.tsx');
  assert.match(c, /className="echo-restart-top"/);
  // 2026-09-24 "있는데 못 찾겠어": 작은 글씨 → 테두리 있는 알약 버튼 + 되돌리기 그림.
  assert.match(c, /className="echo-restart-pill"[^>]*onClick=\{\(\) => setRestartArmed\('top'\)\}><RotateCcw size=\{14\} aria-hidden="true" \/>처음부터 다시 하기</);
  assert.match(c, /className="echo-restart-pill"[^>]*onClick=\{\(\) => setRestartArmed\('bottom'\)\}><RotateCcw size=\{14\} aria-hidden="true" \/>처음부터 다시 시작하기</);
  assert.match(await read('src/doit/components/feature/core-conversation.css'), /\.echo-dialogue \.echo-restart-pill\{[^}]*border:1px solid/);
  // 확인 창은 한 모양. 지난 이야기는 지우지 않는다고 알린다.
  assert.equal((c.match(/const restartConfirm = /g) || []).length, 1);
  assert.match(c, /지금까지 이야기는 그대로 남고, 첫 질문부터 새로 시작해요\./);
  // 기록이 없어도 앱 홈에서 들어온 확인 창은 보이고, 아래 버튼이 눌리지 않는 채로 굳지 않는다.
  // 2026-09-24: 끝 화면에서는 위 버튼 대신 끝 화면 안 「처음부터 다시 답하기」가 같은 일을 한다(중복 버튼 제거).
  assert.match(c, /\(\(roundRecords\.length > 0 && !finished\) \|\| restartArmed === 'top'\)/);
  assert.match(c, /onClick=\{\(\) => setRestartArmed\('done'\)\}>처음부터 다시 답하기</);
});

test('v14.3 앱 홈의 「처음부터 다시 시작하기」는 실제로 다시 시작하는 확인 창을 연다', async () => {
  const home = await read('src/doit/pages/do-it/home/page.tsx');
  assert.match(home, /className="doit-restart-pill" to="\/doit\/conversation\?restart=1"><span aria-hidden="true">↺<\/span>처음부터 다시 시작하기/);
  const page = await read('src/doit/pages/do-it/conversation/page.tsx');
  assert.match(page, /useState\(\(\) => search\.get\('restart'\) === '1'\)/);
  // 한 번 읽고 주소에서 지운다(남으면 다시 시작한 뒤 확인 창이 또 뜬다).
  assert.match(page, /next\.delete\('restart'\);\s*setSearch\(next, \{ replace: true \}\);/);
  assert.match(page, /setRestartPrompt\(false\); setOpeningLine\(''\)/);
  assert.match(page, /restartPrompt=\{restartPrompt\}/);
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
  assert.match(home, /이어서 답하기 </);
  assert.match(home, /다섯 가지,<br \/>다 들었어요/);
  assert.match(home, /import \{ ASK_TOTAL \} from '@\/doit\/components\/feature\/CoreConversation';/);
  assert.match(home, /\{answered\} \/ \{ASK_TOTAL\}/);
  assert.match(home, /처음부터 다시 시작하기/);
  assert.match(home, /연결까지 남은 것 보기/);
});
