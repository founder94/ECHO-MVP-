// 브랜드/앱 빌드 흐름 검사(실제 크로미움, 로그인 없음). BASE=주소 ROLE=brand|app
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const BASE = process.env.BASE, ROLE = process.env.ROLE;
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + ROLE + ' ' + n + (d ? ' — ' + d : '')); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(() => chromium.launch());
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(BASE + '/', { waitUntil: 'commit' }); await page.waitForTimeout(600);
  check('새 세션 / → 온보딩', new URL(page.url()).pathname === '/do-it/intro', page.url());
  await page.waitForTimeout(3600);
  const after = new URL(page.url()).pathname;
  if (ROLE === 'brand') {
    check('온보딩 뒤 → 랜딩', after === '/do-it/landing', after);
    check('랜딩에 "지금 시작하기"가 앱 주소로', (await page.locator('a.doit-brand-start').getAttribute('href') ?? '').startsWith('https://app.do-it.company/doit/start-journey'));
    check('랜딩 "로그인"이 앱 주소로', (await page.locator('.doit-brand-nav nav a').last().getAttribute('href') ?? '').startsWith('https://app.do-it.company/login'));
    const p2 = await ctx.newPage(); const target = [];
    await p2.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith('https://app.do-it.company')) { target.push(u); return route.abort(); } return route.continue(); });
    await p2.goto(BASE + '/doit/conversation?from=journey', { waitUntil: 'commit' }).catch(() => {}); await p2.waitForTimeout(1500);
    check('브랜드에서 /doit/conversation → 앱 주소로 이동 시도', target.some(u => u.startsWith('https://app.do-it.company/doit/conversation')), target[0] ?? p2.url());
    await p2.goto(BASE + '/legal/terms', { waitUntil: 'networkidle' });
    check('/legal/terms 열림', (await p2.locator('h1').first().textContent())?.trim() === '이용약관');
  } else {
    check('온보딩 뒤 → 시작 흐름(/doit/start-journey)', after === '/doit/start-journey', after);
    await page.waitForTimeout(800);
    const text = await page.locator('body').innerText();
    check('로그아웃 상태: 계정 안내 화면(목적 타일 없음)', text.includes('내 계정으로') && !text.includes('친구를 만나고 싶어요'), text.slice(0, 80).replace(/\n/g, ' '));
    await page.goto(BASE + '/do-it/landing', { waitUntil: 'commit' }); await page.waitForTimeout(800);
    check('/do-it/landing → 앱 시작 흐름으로', new URL(page.url()).pathname !== '/do-it/landing', page.url());
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    check('/login 열림', (await page.locator('h1').first().textContent())?.trim() === '로그인');
    const manifest = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href'));
    check('PWA manifest 연결', manifest === '/manifest.webmanifest', String(manifest));
    const res = await page.goto(BASE + '/manifest.webmanifest'); check('manifest 응답 200', res?.status() === 200);
    const icon = await page.goto(BASE + '/pwa/icon-192.png'); check('아이콘 192 응답 200', icon?.status() === 200);
  }
  check('페이지 오류 0', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally { await browser.close(); }
const failed = results.filter(r => !r).length; console.log('RESULT ' + ROLE + ' ' + (results.length - failed) + '/' + results.length + (failed ? ' FAILED' : ' PASS')); process.exit(failed ? 1 : 0);
