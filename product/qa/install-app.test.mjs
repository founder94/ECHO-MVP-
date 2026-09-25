// 휴대폰에 앱으로 받기 검사 (2026-09-23, 대표 "아이폰이랑 갤럭시 기계에 어플 받을 수 있게").
// 기기 판단은 실제 휴대폰 브라우저가 보내는 정보(User-Agent) 그대로 넣어 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

function load(file) {
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, encodeURIComponent }, { filename: file });
  return module.exports;
}
const ctx = load('src/doit/lib/installContext.ts');
const detect = (ua, { standalone = false, touch = 5 } = {}) => ctx.detectInstallContext({ ua, standalone, maxTouchPoints: touch });

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneWhale: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 Whale/3.28.0',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  galaxySamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  galaxyChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S928N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36;KAKAOTALK 2410530',
  kakaoIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 620223457)',
  naverApp: 'Mozilla/5.0 (Linux; Android 14; SM-S928N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.6.3)',
  lineIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
  androidWebView: 'Mozilla/5.0 (Linux; Android 13; SM-A536N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

test('아이폰 사파리 → 공유 버튼으로 받는 안내', () => {
  assert.equal(detect(UA.iphoneSafari), 'ios-safari');
});

test('아이폰의 다른 브라우저(크롬·웨일) → 사파리로 옮기라는 안내', () => {
  assert.equal(detect(UA.iphoneChrome), 'ios-other');
  assert.equal(detect(UA.iphoneWhale), 'ios-other');
});

test('아이패드가 컴퓨터처럼 보여도 터치가 되면 아이패드로 본다', () => {
  assert.equal(detect(UA.ipadDesktopMode, { touch: 5 }), 'ios-safari');
  assert.equal(detect(UA.macSafari, { touch: 0 }), 'desktop');
});

test('갤럭시(삼성 인터넷·크롬) → 안드로이드 안내', () => {
  assert.equal(detect(UA.galaxySamsung), 'android');
  assert.equal(detect(UA.galaxyChrome), 'android');
});

test('카카오톡·인스타그램·네이버·라인·앱 안 웹뷰 → 설치 불가, 밖으로 열기', () => {
  for (const ua of [UA.kakaoAndroid, UA.kakaoIphone, UA.instagramIphone, UA.naverApp, UA.lineIphone, UA.androidWebView]) {
    assert.equal(detect(ua), 'in-app', ua);
  }
  assert.equal(ctx.isKakaoInApp(UA.kakaoAndroid), true);
  assert.equal(ctx.isKakaoInApp(UA.kakaoIphone), true);
  assert.equal(ctx.isKakaoInApp(UA.instagramIphone), false);
});

test('이미 앱으로 열려 있으면 어떤 기기든 안내를 띄우지 않는다', () => {
  for (const ua of Object.values(UA)) assert.equal(detect(ua, { standalone: true }), 'installed');
});

test('컴퓨터는 컴퓨터로 본다', () => {
  assert.equal(detect(UA.windowsChrome, { touch: 0 }), 'desktop');
});

test('카카오 밖으로 열기 주소는 http(s) 만 받고 주소를 안전하게 감싼다', () => {
  assert.equal(ctx.kakaoOpenExternalUrl('https://app.do-it.company/'), 'kakaotalk://web/openExternal?url=https%3A%2F%2Fapp.do-it.company%2F');
  assert.equal(ctx.kakaoOpenExternalUrl('javascript:alert(1)'), null);
  assert.equal(ctx.kakaoOpenExternalUrl('kakaotalk://x'), null);
});

test('갤럭시의 브라우저 자체 설치 창을 막지 않는다(preventDefault 없음)', () => {
  const code = read('src/doit/lib/installPrompt.ts').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!code.includes('preventDefault'), '브라우저 자체 설치 창을 막고 있다');
  assert.match(code, /addEventListener\('beforeinstallprompt'/);
  assert.match(code, /addEventListener\('appinstalled'/);
});

test('설치 창을 못 띄우면 실패로 끝내지 않고 메뉴 안내로 넘어간다 (빠져나갈 문)', () => {
  const prompt = read('src/doit/lib/installPrompt.ts');
  assert.match(prompt, /catch \{\s*return 'unavailable';/);
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  assert.match(card, /setResult\(outcome === 'accepted' \? 'accepted' : 'steps'\)/);
  assert.match(card, /<AndroidSteps \/>/);
  assert.match(card, /홈 화면에 추가/);
  assert.match(card, /현재 페이지 추가/);
});

test('설치 신호는 앱 시작 때부터 듣는다(온보딩 중에 와도 놓치지 않게)', () => {
  assert.match(read('src/main.tsx'), /startInstallPromptCapture\(\)/);
});

// 대표 2026-09-26 PWA INSTALL UX: 자동 설치 금지 · 다섯 가지 대화를 마친 뒤 자연스러운 때 · 세션당 한 번 · 설치 안 해도 그대로 사용.
test('홈 화면 제안은 다섯 가지를 마친 뒤에만 보이고, 브랜드 사이트·이미 설치한 경우엔 숨는다', () => {
  assert.match(read('src/doit/pages/do-it/home/page.tsx'), /\{done && <InstallAppCard \/>\}/);
  // 대화 끝 화면에서는 AI 소개를 고른 뒤에만(소개 카드와 겹쳐 권하지 않는다).
  assert.match(read('src/doit/components/feature/AgentConversation.tsx'), /\{done && introChosen && <InstallAppCard \/>\}/);
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  assert.match(card, /!IS_BRAND_SITE && context !== 'installed' && eligible && open/);
  assert.match(card, /if \(!visible\) return null;/);
});

test('세션당 한 번만 권하고, 저장이 막혀도 화면이 깨지지 않는다', () => {
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  assert.match(card, /try \{ return sessionStorage\.getItem\(SESSION_KEY\) === 'shown'; \} catch \{ return false; \}/);
  assert.match(card, /useEffect\(\(\) => \{ if \(visible\) markSuggested\(\); \}, \[visible\]\);/);
  assert.ok(!/localStorage/.test(card), '다음 방문까지 막아 두지 않는다(세션 기준)');
});

test('제안 문구와 버튼은 대표 확정 문구 그대로, 기술 용어 없이', () => {
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  const ui = card.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('{/*')).join('\n');
  assert.match(ui, />ECHO를 홈 화면에 둘까요\?</);
  assert.match(ui, />다음에는 바로 들어올 수 있어요\.</);
  assert.match(ui, />홈 화면에 추가</);
  assert.match(ui, />나중에</);
  for (const word of ['PWA', 'manifest', '설치 프로그램', 'beforeinstallprompt']) {
    const jsx = ui.match(/>[^<>{}]*</g)?.join(' ') ?? '';
    assert.ok(!jsx.includes(word), word);
  }
});

test('갤럭시 설치 창은 사용자가 [홈 화면에 추가]를 눌렀을 때만 띄운다', () => {
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  assert.match(card, /onClick=\{\(\) => void add\(\)\}>홈 화면에 추가</);
  // promptInstall 은 add() 안에서만 부른다(화면이 열리자마자 띄우지 않는다).
  assert.equal(card.match(/promptInstall\(\)/g)?.length, 1);
  assert.match(card, /const add = async \(\) => \{[\s\S]*?if \(canPrompt\) \{\s*const outcome = await promptInstall\(\);/);
});

test('주소 복사가 막혀도 주소를 직접 볼 수 있다', () => {
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  assert.match(card, /setState\('failed'\)/);
  assert.match(card, /<span>\{address\}<\/span>/);
});

test('앱 설치 설정 파일: 이름·아이콘·전체 화면·시작 주소', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.short_name, 'DO IT');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  for (const icon of manifest.icons) assert.ok(statSync(path.join(root, 'public', icon.src.split('?')[0])).size > 0, icon.src);
  assert.ok(statSync(path.join(root, 'public/pwa/apple-touch-icon.png')).size > 0);
  const vite = read('vite.config.ts');
  assert.match(vite, /rel="manifest"/);
  assert.match(vite, /rel="apple-touch-icon"/);
});

test('안내 문구에 쓰면 안 되는 단어가 없다', () => {
  const card = read('src/doit/components/feature/InstallAppCard.tsx');
  for (const word of ['데이팅', '소개팅', '궁합', '점술', '심리치료', '성격검사']) assert.ok(!card.includes(word), word);
});

test('스타일은 .doit-install 아래에만 있다(전역 오염 없음)', () => {
  // 맨 위 @import(메탈 실버 공용 스타일)는 규칙이 아니라 불러오기 줄이라 뺀다. 그 파일은 intro-symbol 검사에서 따로 본다.
  const css = read('src/doit/components/feature/install-app.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^@import [^;]+;\s*/gm, '');
  const selectors = css.split('}').map((b) => b.split('{')[0].trim()).filter(Boolean);
  for (const sel of selectors) for (const part of sel.split(',')) assert.match(part.trim(), /^\.doit-install/, part);
});
