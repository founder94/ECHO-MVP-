// v14.2 앱 진입 계약 (대표 2026-09-22 실기기: "메인 페이지에서 시작을 해야 하는데 로그인이
// 되어 있다는 이유만으로 여기서 시작하는 건지 / 처음으로 돌아가려니 그것도 없고").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFile(resolve(root, p), 'utf8');

// 2026-09-27 대표 「QA FINAL FIX」가 v14.3(앱도 히어로)을 대체: 앱(app 빌드) 첫 화면 = 모바일 제품. 브랜드·통합 빌드는 히어로 그대로.
test('앱(app 빌드)은 온보딩 뒤 제품 입구로 · 브랜드·통합 빌드는 히어로 그대로', async () => {
  const routes = await read('src/router/config.tsx');
  assert.match(routes, /const entryLanding = ROLE === 'app' \? \(AppWelcomePage \? <AppWelcomePage \/> : <Navigate to=\{PRODUCT_ENTRY_PATH\} replace \/>\) : BrandHomePage \? <BrandHomePage \/> : <DoItLandingPage \/>;/); // 2026-10-04 대표 디자인 교체: 회사 홈페이지(brand)는 새 홈페이지 · 통합 빌드는 예전 랜딩
  assert.match(routes, /\{ path: '\/do-it\/landing', element: BrandHomePage \? <BrandHomePage \/> : <DoItLandingPage \/> \}/);
  // 로그인했다는 이유만으로 시작 흐름·대화로 건너뛰지 않는다.
  assert.doesNotMatch(routes, /entryLanding = [^;]*conversation/);
  // 히어로의 「지금 시작하기」는 앱 안에서는 주소를 바꾸지 않고 시작 흐름으로 간다.
  const landing = await read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /if \(IS_BRAND_SITE\) \{ window\.location\.assign\(appUrl\('\/doit\/start-journey'\)\); return; \}\n\s*navigate\('\/doit\/start-journey'\);/);
});

test('v14.3·2026-09-28 처음부터 다시 — 대화 화면 위·끝 화면·아래 모두 같은 이름, 확인 창 없이 한 번에 새 회차', async () => {
  for (const f of ['src/doit/components/feature/CoreConversation.tsx', 'src/doit/components/feature/AgentConversation.tsx']) {
    const c = await read(f);
    assert.match(c, /className="echo-restart-top"/, f);
    // 2026-09-24 "있는데 못 찾겠어": 테두리 있는 알약 버튼 + 되돌리기 그림.
    assert.match(c, /className="echo-restart-pill" disabled=\{[^}]*\} onClick=\{[^}]*\}><RotateCcw size=\{14\} aria-hidden="true" \/>처음부터 다시 시작하기</, f);
    // 2026-09-28 대표 「한 번의 탭」: 확인 창·「계속할게요」·예전 이름 「처음부터 시작하기」 0.
    assert.doesNotMatch(c, /restartConfirm|restartArmed|restartPrompt|처음부터 시작할게요|>처음부터 시작하기</, f);
  }
  assert.match(await read('src/doit/components/feature/core-conversation.css'), /\.echo-dialogue \.echo-restart-pill\{[^}]*border:1px solid/);
});

test('2026-09-28 「처음부터 다시 시작하기」 공통 동작 하나 — 새 회차(서버가 읽는 시각) + 기기 세션 잊기, Profile·목적은 지우지 않음, 곧바로 ECHO 첫 대화 화면', async () => {
  const hook = await read('src/doit/hooks/useRestartConversation.ts');
  assert.match(hook, /const failure = await startNewRound\(userId\);\n\s*if \(failure\) \{ setError\(failure\); return failure; \}\n\s*navigate\('\/doit\/conversation', \{ state: \{ \[FRESH_ROUND_STATE\]: Date\.now\(\) \}/, '실제 초기화가 성공한 뒤에만 이동(가짜 초기화 금지)');
  const round = await read('src/doit/lib/conversationRound.ts');
  assert.match(round, /supabase\.auth\.updateUser\(\{ data: \{ \[ROUND_KEY\]: startedAt \} \}\)/);
  assert.match(round, /forgetAgentSession\(userId\);/);
  assert.doesNotMatch(round, /clearPurpose/, 'Profile(목적)은 지우지 않는다');
  const page = await read('src/doit/pages/do-it/conversation/page.tsx');
  assert.match(page, /const \{ restart \} = useRestartConversation\(userId\);/);
  assert.match(page, /if \(showOpening\) \{\n\s*return <ConversationOpening /, '새 회차 직후 = ECHO 첫 질문(어떤 만남을 원하세요?)');
  assert.doesNotMatch(page, /startNewRound|restartPrompt/);
  // 버튼이 있는 모든 곳이 같은 동작 하나를 쓴다 — 예전 주소(?restart=1)로 가는 링크 0.
  const button = await read('src/doit/components/feature/RestartConversationButton.tsx');
  assert.match(button, /useRestartConversation\(userId\)/);
  assert.match(await read('src/doit/pages/do-it/home/page.tsx'), /\{started && user && <RestartConversationButton userId=\{user\.id\} \/>\}/);
  assert.match(await read('src/doit/pages/do-it/understanding/page.tsx'), /<RestartConversationButton userId=\{user\.id\} \/>/, '나의 이해 → 한 번 탭');
  for (const f of ['src/doit/pages/do-it/home/page.tsx', 'src/doit/pages/do-it/understanding/page.tsx', 'src/doit/components/feature/AsleepConnections.tsx', 'src/doit/pages/do-it/conversation/page.tsx', 'src/doit/components/feature/AgentConversation.tsx', 'src/doit/components/feature/CoreConversation.tsx']) {
    assert.doesNotMatch((await read(f)).replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g, ''), /to="\/doit\/conversation\?restart=1"/, f);
  }
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
  assert.match(home, /같이 하고 싶은 일이<br \/>있나요/);
  assert.doesNotMatch(home, /다섯 가지/, 'ECHO 대화는 질문 개수를 약속하지 않는다(P0-B)');
  assert.match(home, /시작하기 </);
  assert.match(home, /이어서 답하기 </);
  assert.match(home, /이야기,<br \/>잘 들었어요/);
  assert.match(home, /\{answered\}가지 들었어요/);
  assert.match(home, /import \{ ASK_TOTAL \} from '@\/doit\/components\/feature\/CoreConversation';/);
  assert.match(home, /\{answered\} \/ \{ASK_TOTAL\}/);
  assert.match(home, /처음부터 다시 시작하기/);
  assert.match(home, /연결까지 남은 것 보기/);
});
