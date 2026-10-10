// 갤럭시(삼성 인터넷·크롬·설치 앱) · 아이폰(사파리·홈 화면 앱) 로그인 호환 검사 (2026-10-10).
// 기기 판단은 실제 휴대폰 브라우저가 보내는 정보(User-Agent) 그대로 넣어 확인한다. 실기기 검사가 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const noComments = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), has: (k) => m.has(k) };
}

function load(file, globals = {}, deps = {}) {
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (name in deps) return deps[name];
    throw new Error(`Unexpected dependency ${name}`);
  };
  vm.runInNewContext(js, { module, exports: module.exports, require, encodeURIComponent, URL, JSON, Date, ...globals }, { filename: file });
  return module.exports;
}

const ctx = load('src/doit/lib/installContext.ts');
const detect = (ua, { standalone = false, touch = 5 } = {}) => ctx.detectInstallContext({ ua, standalone, maxTouchPoints: touch });

const UA = {
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S928N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36;KAKAOTALK 2410530',
  kakaoIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 620223457)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 339.0.0.32.110 Android (34/14; 480dpi; 1080x2340; samsung; SM-S921N; e1q; qcom; ko_KR; 620223457)',
  lineIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
  naverAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S928N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.6.3)',
  // 아이폰 앱 안 브라우저(스레드·틱톡·X 등): 따로 표시가 없고 "Safari/" 가 빠져 있다.
  threadsIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 343.0.0.25.86',
  plainIosWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  samsungInternet: 'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  ipadDesktopSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

// ── 1. 앱 안 브라우저 판단 ──

test('앱 안 브라우저(카카오톡·인스타그램·네이버·라인·아이폰 앱 안) → in-app', () => {
  for (const key of ['kakaoAndroid', 'kakaoIphone', 'instagramIphone', 'instagramAndroid', 'lineIphone', 'naverAndroid', 'threadsIphone', 'plainIosWebView']) {
    assert.equal(detect(UA[key]), 'in-app', key);
  }
  assert.equal(ctx.isIOSInApp({ ua: UA.threadsIphone, maxTouchPoints: 5 }), true);
});

test('삼성 인터넷·안드로이드 크롬은 앱 안으로 보지 않는다(Google 버튼 그대로)', () => {
  assert.equal(detect(UA.samsungInternet), 'android');
  assert.equal(detect(UA.chromeAndroid), 'android');
});

test('아이폰 사파리·크롬(CriOS)·파이어폭스·아이패드 사파리는 앱 안이 아니다', () => {
  assert.equal(detect(UA.iosSafari), 'ios-safari');
  assert.equal(detect(UA.iosChrome), 'ios-other');
  assert.equal(detect(UA.iosFirefox), 'ios-other');
  assert.equal(detect(UA.ipadDesktopSafari, { touch: 5 }), 'ios-safari');
  for (const key of ['iosSafari', 'iosChrome', 'iosFirefox']) assert.equal(ctx.isIOSInApp({ ua: UA[key], maxTouchPoints: 5 }), false, key);
});

test('아이폰 홈 화면 앱은 "Safari/" 가 없어도 설치 앱으로 본다(standalone 이 먼저)', () => {
  assert.equal(detect(UA.plainIosWebView, { standalone: true }), 'installed');
});

// ── 2. 기본 브라우저로 열기 주소 ──

test('밖으로 열기: 카카오톡 = 카카오 공식 형식 · 라인 = openExternalBrowser=1 · 안드로이드 웹뷰 = intent://', () => {
  const target = 'https://app.do-it.company/login?x=1#top';
  assert.equal(ctx.externalBrowserUrl(UA.kakaoAndroid, target), `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`);
  assert.equal(ctx.externalBrowserUrl(UA.kakaoIphone, target), `kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`);
  assert.equal(ctx.externalBrowserUrl(UA.lineIphone, 'https://app.do-it.company/login'), 'https://app.do-it.company/login?openExternalBrowser=1');
  assert.equal(ctx.externalBrowserUrl(UA.instagramAndroid, target), 'intent://app.do-it.company/login?x=1#Intent;scheme=https;end');
  assert.equal(ctx.externalBrowserUrl(UA.naverAndroid, 'https://app.do-it.company/signup'), 'intent://app.do-it.company/signup#Intent;scheme=https;end');
  // 앱을 정하지 않는다(휴대폰 기본 브라우저가 연다).
  assert.doesNotMatch(ctx.externalBrowserUrl(UA.instagramAndroid, target), /package=/);
});

test('밖으로 열기: 아이폰의 다른 앱 안 브라우저는 확실한 방법이 없어 null(주소 복사로 안내) · http(s) 아닌 주소는 거부', () => {
  assert.equal(ctx.externalBrowserUrl(UA.instagramIphone, 'https://app.do-it.company/login'), null);
  assert.equal(ctx.externalBrowserUrl(UA.threadsIphone, 'https://app.do-it.company/login'), null);
  assert.equal(ctx.externalBrowserUrl(UA.kakaoAndroid, 'javascript:alert(1)'), null);
  assert.equal(ctx.externalBrowserUrl(UA.instagramAndroid, 'intent://x#Intent;end'), null);
  assert.equal(ctx.externalBrowserUrl(UA.instagramAndroid, 'not a url'), null);
});

// ── 3. 로그인·가입 화면: 앱 안에서는 Google 버튼 대신 안내 ──

test('로그인·가입: Google 버튼은 InAppGoogleGate 안에 있고, 이메일 로그인은 그대로', () => {
  for (const p of ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx']) {
    const s = read(p);
    assert.match(s, /import InAppGoogleGate from '@\/components\/auth\/InAppGoogleGate';/, p);
    assert.match(s, /\{GOOGLE_LOGIN_ENABLED && \(\s*<InAppGoogleGate>\s*<button[\s\S]*?<GoogleGIcon \/>\s*Google로 시작하기[\s\S]*?<\/button>\s*<\/InAppGoogleGate>\s*\)\}/, p);
    assert.match(s, /type="email"/, `${p}: 이메일 칸 그대로`);
    assert.match(s, /signInWithGoogle\(from\)/, `${p}: OAuth 호출 그대로`);
  }
});

test('앱 안 안내: 대표 문구 · 기본 브라우저로 열기 · 주소 복사(실패하면 주소를 골라 옮길 수 있게) · 판단 실패는 막지 않음', () => {
  const s = read('src/components/auth/InAppGoogleGate.tsx');
  assert.ok(s.includes('이 앱 안의 브라우저에서는 Google 로그인이 막혀 있어요. 기본 브라우저(크롬·삼성 인터넷·사파리)에서 열어 주세요.'));
  assert.match(s, /detectInstallContext\([\s\S]*?\) === 'in-app'/);
  assert.match(s, /externalBrowserUrl\(navigator\.userAgent, address\)/);
  assert.match(s, /기본 브라우저로 열기/);
  assert.match(s, /주소 복사/);
  assert.match(s, /try \{\s*await navigator\.clipboard\.writeText\(address\);\s*setCopy\('copied'\);\s*\} catch \{\s*setCopy\('failed'\);\s*\}/);
  assert.match(s, /copy === 'failed' && \([\s\S]*?select-all[\s\S]*?\{address\}/);
  assert.match(s, /\} catch \{\s*return false;\s*\}/, '판단이 안 되면 Google 버튼 그대로');
  assert.match(s, /return blocked \? <InAppGoogleNotice \/> : <>\{children\}<\/>;/);
});

// ── 4. 로그인 복귀(/auth/callback): 다른 창으로 돌아온 경우 ──

test('복귀 화면: 확인값이 없어 교환을 못 하면 「다른 창」 안내 · 코드를 다시 교환하지 않음 · 취소 처리 그대로', () => {
  const s = read('src/pages/auth/callback/page.tsx');
  const code = noComments(s);
  assert.ok(s.includes('로그인을 시작한 창과 다른 창으로 돌아왔어요. 앱(또는 처음 연 브라우저)으로 돌아가 다시 「Google로 시작하기」를 눌러 주세요.'));
  assert.match(code, /await supabase\.auth\.initialize\(\)/, 'SDK 첫 준비 결과(이미 한 교환)를 읽는다');
  assert.doesNotMatch(code, /exchangeCodeForSession/, '코드를 두 번 교환하지 않는다');
  assert.match(code, /if \(cancelled \|\| handledRef\.current \|\| data\.session \|\| !authCodeInUrl\(\)\) return;/, '세션이 있으면 성공 흐름 그대로');
  assert.match(code, /if \(!init\.error \|\| init\.error\.code === 'pkce_code_verifier_not_found'\)/);
  assert.match(code, /if \(code === 'access_denied'\) return '로그인을 취소했어요\.';/);
  assert.match(code, /navigate\(consumeReturnPath\(\), \{ replace: true \}\)/);
  assert.match(code, /const SESSION_WAIT_MS = 8000;/, '그 밖의 실패는 전체 제한시간 그대로');
});

test('루트로 떨어진 PKCE 복귀(?code=)는 /auth/callback 으로 주소 그대로 넘긴다(브랜드는 앱 주소로) · # 토큰 처리 그대로', () => {
  const s = noComments(read('src/pages/do-it/intro/DoItEntry.tsx'));
  assert.match(s, /new URLSearchParams\(window\.location\.search\)\.get\('code'\) \? window\.location\.search : null/);
  assert.match(s, /if \(codeQuery\) return <OAuthCodeLanding query=\{codeQuery\} \/>;/);
  assert.match(s, /<Navigate to=\{`\/auth\/callback\$\{query\}`\} replace \/>/);
  assert.match(s, /window\.location\.replace\(appUrl\(`\/auth\/callback\$\{query\}`\)\)/);
  assert.match(s, /if \(oauthLanding\) return <OAuthLanding landing=\{landing\} \/>;/);
  assert.doesNotMatch(s, /exchangeCodeForSession/);
});

// ── 5. Google 왕복 임시값: localStorage + 10분 만료 ──

function loadRoundtrip() {
  const local = fakeStorage();
  const session = fakeStorage();
  const mod = load('src/lib/auth/roundtripStorage.ts', { localStorage: local, sessionStorage: session });
  return { mod, local, session };
}

test('왕복 임시값: 다른 탭에서도 읽히는 localStorage · 한 번 꺼내면 지움 · 10분 지나면 버림', () => {
  const { mod, local } = loadRoundtrip();
  const t0 = 1_800_000_000_000;
  mod.saveRoundtripValue('k', '/doit/home', t0);
  assert.ok(local.has('k'));
  assert.equal(mod.takeRoundtripValue('k', t0 + 60_000), '/doit/home');
  assert.equal(mod.takeRoundtripValue('k', t0 + 60_000), null, '두 번째는 비어 있다');
  mod.saveRoundtripValue('k', '/doit/home', t0);
  assert.equal(mod.takeRoundtripValue('k', t0 + mod.ROUNDTRIP_TTL_MS + 1), null, '10분이 지나면 버린다');
  assert.equal(local.has('k'), false, '만료 값도 지운다');
  assert.equal(mod.ROUNDTRIP_TTL_MS, 10 * 60 * 1000);
  local.setItem('k', '{broken');
  assert.equal(mod.takeRoundtripValue('k', t0), null, '깨진 값은 버린다');
});

test('왕복 임시값: 예전 판(sessionStorage 에 값 그대로)도 한 릴리스 동안 읽고 지운다 · 저장소가 막혀도 멈추지 않는다', () => {
  const { mod, session } = loadRoundtrip();
  session.setItem('k', '/doit/start-journey');
  assert.equal(mod.takeRoundtripValue('k'), '/doit/start-journey');
  assert.equal(session.has('k'), false);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const blocked = load('src/lib/auth/roundtripStorage.ts', { localStorage: throwing, sessionStorage: throwing });
  assert.doesNotThrow(() => blocked.saveRoundtripValue('k', '/x'));
  assert.equal(blocked.takeRoundtripValue('k'), null);
});

test('돌아갈 경로: 새 저장소를 쓰고, 예전 값·새 값 모두 꺼낼 때 다시 걸러 낸다(외부 주소 → 기본 경로)', () => {
  const local = fakeStorage();
  const session = fakeStorage();
  const roundtrip = load('src/lib/auth/roundtripStorage.ts', { localStorage: local, sessionStorage: session });
  const rp = load('src/lib/auth/returnPath.ts', {}, { '@/lib/echo/appMode': { MAIN_ENTRY_PATH: '/do-it/landing' }, '@/lib/auth/roundtripStorage': roundtrip });
  rp.rememberReturnPath('/doit/profile?tab=1');
  assert.equal(rp.consumeReturnPath(), '/doit/profile?tab=1');
  rp.rememberReturnPath('https://evil.example/');
  assert.equal(rp.consumeReturnPath(), '/do-it/landing');
  session.setItem('echo:auth-return', '//evil.example');
  assert.equal(rp.consumeReturnPath(), '/do-it/landing', '예전 값도 걸러 낸다');
  local.setItem('echo:auth-return', JSON.stringify({ value: 'javascript:alert(1)', savedAt: Date.now() }));
  assert.equal(rp.consumeReturnPath(), '/do-it/landing', '저장소에 직접 넣은 값도 걸러 낸다');
  assert.equal(rp.consumeReturnPath(), '/do-it/landing', '없으면 기본 경로');
});

test('약관 동의 임시값·돌아갈 경로는 sessionStorage 에 직접 쓰지 않는다(왕복 저장소 경유)', () => {
  for (const p of ['src/lib/legal/consent.ts', 'src/lib/auth/returnPath.ts']) {
    const s = noComments(read(p));
    assert.doesNotMatch(s, /sessionStorage\.setItem/, p);
    assert.match(s, /from '@\/lib\/auth\/roundtripStorage'/, p);
  }
});

// ── 6. 다시 열 때 연결이 안 된 경우(네트워크 오류)는 로그아웃으로 보지 않는다 ──

test('AuthContext: getSession 이 다시 시도할 수 있는 네트워크 오류면 불러오는 중으로 두고 다음 알림을 기다린다', () => {
  const s = noComments(read('src/context/AuthContext.tsx'));
  assert.match(s, /import \{ isAuthRetryableFetchError, type Session, type User \} from '@supabase\/supabase-js';/);
  assert.match(s, /if \(!session && isAuthRetryableFetchError\(result\.error\)\) \{\s*waitingForNetwork = true;\s*return;\s*\}/);
  assert.match(s, /if \(mounted && !waitingForNetwork\) setLoading\(false\);/);
  assert.match(s, /if \(event === 'INITIAL_SESSION' && !newSession\) return;\s*waitingForNetwork = false;/);
  assert.match(s, /window\.addEventListener\('online', retryWhenOnline\);/);
  assert.match(s, /window\.removeEventListener\('online', retryWhenOnline\);/);
});

test('DO IT useAuth: 같은 규칙(네트워크 오류 = 대기 · 오류 없으면 예전 그대로)', () => {
  const s = noComments(read('src/doit/hooks/useAuth.tsx'));
  assert.match(s, /if \(!data\?\.session && isAuthRetryableFetchError\(error\)\) \{\s*waitingForNetwork = true;\s*return;\s*\}/);
  assert.match(s, /if \(waitingForNetwork\) \{\s*if \(event === "INITIAL_SESSION" && !next\) return;\s*waitingForNetwork = false;\s*setLoading\(false\);\s*\}/);
});

// ── 7. 삼성 인터넷 설치 조건: 캐시 없는 통과용 서비스 워커 ──

test('서비스 워커: 설치 즉시 교체·즉시 적용 · 캐시 0 · 요청 가로채기 0', () => {
  const sw = read('public/sw.js');
  const code = noComments(sw);
  assert.match(code, /addEventListener\('install', \(\) => \{\s*self\.skipWaiting\(\);/);
  assert.match(code, /addEventListener\('activate', \(event\) => \{\s*event\.waitUntil\(self\.clients\.claim\(\)\);/);
  assert.match(code, /addEventListener\('fetch', \(\) => \{\}\);/);
  assert.doesNotMatch(code, /respondWith|caches|cache\.|importScripts|fetch\(/);
});

test('서비스 워커 등록: 운영 앱 빌드에서만 · load 뒤 · 실패해도 앱은 그대로 · 브랜드·관리자·통합 빌드 산출물에는 파일 없음', () => {
  const boot = noComments(read('src/lib/appBoot.ts'));
  assert.match(boot, /if \(!IS_APP_SITE \|\| !import\.meta\.env\.PROD\) return;/);
  assert.match(boot, /'serviceWorker' in navigator/);
  assert.match(boot, /window\.addEventListener\('load', register, \{ once: true \}\)/);
  assert.match(boot, /navigator\.serviceWorker\.register\(`\$\{base\}\/sw\.js`, \{ scope: `\$\{base\}\/`, updateViaCache: 'none' \}\)\.catch\(/);
  assert.match(boot, /try \{[\s\S]*?register\([\s\S]*?\} catch \{/);
  const main = read('src/main.tsx');
  assert.match(main, /registerAppServiceWorker\(\)/);
  assert.doesNotMatch(read('src/admin/main.tsx'), /registerAppServiceWorker|serviceWorker/, '관리자 입구는 등록하지 않는다');
  const vite = read('vite.config.ts');
  assert.match(vite, /if \(siteRole !== "app" && options\.dir\) rmSync\(resolve\(options\.dir, "sw\.js"\), \{ force: true \}\);/);
});

test('보안 정책: script-src \'self\' 가 같은 주소의 서비스 워커를 허락한다(worker-src 따로 없음 = script-src 를 따른다)', () => {
  for (const p of ['public/_headers', 'netlify.toml']) {
    const s = read(p);
    assert.match(s, /script-src 'self'/, p);
    assert.doesNotMatch(s, /worker-src/, `${p}: worker-src 가 생기면 'self' 를 넣어야 한다`);
  }
});

// ── 8. 배포 직후 옛 코드 조각 ──

test('_redirects: 사라진 /assets/* 는 화면(index.html) 대신 404 · 규칙 순서는 catch-all 보다 앞', () => {
  const r = read('public/_redirects').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  assert.deepEqual(r.map((l) => l.trim().split(/\s+/)), [['/assets/*', '/404.html', '404'], ['/*', '/index.html', '200']]);
  assert.doesNotMatch(read('public/_redirects'), /404!/, '있는 파일까지 막는 강제(!) 없음');
  const vite = read('vite.config.ts');
  assert.match(vite, /"\/assets\/\*  \/404\.html  404\\n\/\*    \/index\.html   200\\n"/, '관리자 빌드');
  assert.match(vite, /\[\.\.\.rules, "\/assets\/\*  \/404\.html  404", "\/\*    \/index\.html   200", ""\]/, '브랜드 빌드');
});

test('옛 코드 조각을 못 불러오면(vite:preloadError) 한 번만 새로 고친다 · 반복 방지 기록 · 기록이 막히면 고치지 않는다', () => {
  const boot = noComments(read('src/lib/appBoot.ts'));
  assert.match(boot, /window\.addEventListener\('vite:preloadError', \(event\) => \{/);
  assert.match(boot, /if \(Date\.now\(\) - last < CHUNK_RELOAD_GUARD_MS\) return;/);
  assert.match(boot, /sessionStorage\.setItem\(CHUNK_RELOAD_KEY, String\(Date\.now\(\)\)\);/);
  assert.match(boot, /\} catch \{\s*return;/);
  assert.match(boot, /event\.preventDefault\(\);\s*window\.location\.reload\(\);/);
  assert.match(read('src/main.tsx'), /reloadOnceOnStaleChunk\(\)/);
});

// ── 9. 문구 규칙 ──

test('새 안내 문구: 금지어·가격 없음', () => {
  const files = ['src/components/auth/InAppGoogleGate.tsx', 'src/pages/auth/callback/page.tsx', 'src/lib/appBoot.ts', 'public/sw.js', 'src/lib/auth/roundtripStorage.ts'];
  for (const f of files) {
    assert.ok(existsSync(path.join(root, f)), f);
    const s = read(f);
    assert.doesNotMatch(s, /데이팅|소개팅|궁합|점술|심리치료|성격검사/, f);
    assert.doesNotMatch(s, /[0-9,]+\s*원\b|₩/, `${f}: 가격 없음`);
  }
});
