// 약관·동의 화면 브라우저 모의 검사(로컬 빌드 + 실제 크로미움, 로그인 없음). 실서버 쓰기 0건.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(() => chromium.launch());
try {
  for (const [label, viewport] of [['390px', { width: 390, height: 844 }], ['PC', { width: 1280, height: 800 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(BASE + '/legal/terms', { waitUntil: 'networkidle' });
    check(label + ' /legal/terms 제목', (await page.locator('h1').first().textContent())?.trim() === '이용약관');
    check(label + ' /legal/terms 초안 표시', await page.locator('.legal-page-draft').count() === 1);
    check(label + ' /legal/terms 조항 10개', await page.locator('.legal-page-section').count() === 10, String(await page.locator('.legal-page-section').count()));
    check(label + ' /legal/terms 가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

    await page.goto(BASE + '/legal/privacy', { waitUntil: 'networkidle' });
    check(label + ' /legal/privacy 제목', (await page.locator('h1').first().textContent())?.trim() === '개인정보 처리방침');
    check(label + ' /legal/privacy 조항 11개', await page.locator('.legal-page-section').count() === 11, String(await page.locator('.legal-page-section').count()));

    await page.goto(BASE + '/signup', { waitUntil: 'networkidle' });
    const submit = page.locator('button[type=submit]');
    const google = page.locator('button', { hasText: 'Google로 계속하기' });
    check(label + ' /signup 체크 목록 표시', await page.locator('.legal-consent').count() === 1);
    check(label + ' /signup 체크 전 가입 버튼 잠김', await submit.isDisabled());
    check(label + ' /signup 체크 전 Google 버튼 잠김', await google.isDisabled());
    check(label + ' /signup 안내문(필수 3개)', await page.locator('.legal-consent-hint').count() === 1);
    await page.locator('.legal-consent-all input').check();
    const boxes = page.locator('.legal-consent-list input[type=checkbox]');
    check(label + ' 모두 동의 → 4개 전부 켜짐', (await boxes.evaluateAll((els) => els.every((e) => e.checked))));
    check(label + ' 모두 동의 → 가입 버튼 열림', await submit.isEnabled());
    check(label + ' 모두 동의 → Google 버튼 열림', await google.isEnabled());
    check(label + ' 안내문 사라짐', await page.locator('.legal-consent-hint').count() === 0);
    await boxes.nth(2).uncheck(); // 만 14세
    check(label + ' 만 14세 해제 → 가입 버튼 다시 잠김', await submit.isDisabled());
    check(label + ' 만 14세 해제 → 모두 동의 꺼짐', !(await page.locator('.legal-consent-all input').isChecked()));
    await boxes.nth(3).uncheck(); // 마케팅(선택)
    await boxes.nth(2).check();
    check(label + ' 선택 항목 꺼도 필수 3개면 가입 버튼 열림', await submit.isEnabled());
    check(label + ' 약관 보기 링크 2개(/legal/terms, /legal/privacy)', await page.locator('.legal-consent-doc').count() === 2);
    check(label + ' /signup 가로 스크롤 없음', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

    await page.goto(BASE + '/legal/consent', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    check(label + ' 미로그인 /legal/consent → /login 으로', new URL(page.url()).pathname === '/login', page.url());

    // 온보딩: 새 세션의 첫 / 는 심볼 온보딩(/do-it/intro)으로 갔다가 랜딩(/do-it/landing)으로 돌아온다. 두 번째 / 는 바로 랜딩.
    const fresh = await browser.newContext({ viewport });
    const p2 = await fresh.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'commit' });
    await p2.waitForTimeout(600);
    check(label + ' 새 세션 / → 온보딩 화면(/do-it/intro)', new URL(p2.url()).pathname === '/do-it/intro', p2.url());
    await p2.waitForURL('**/do-it/landing', { timeout: 12000 }).catch(() => {});
    check(label + ' 온보딩 뒤 랜딩(/do-it/landing) 도착', new URL(p2.url()).pathname === '/do-it/landing', p2.url());
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    check(label + ' 같은 세션 두 번째 / → 온보딩 없이 랜딩', new URL(p2.url()).pathname !== '/do-it/intro', p2.url());
    await fresh.close();

    await page.goto(BASE + '/do-it/landing', { waitUntil: 'networkidle' });
    check(label + ' 홈 미로그인 = "로그인 ↗" 링크', await page.locator('.doit-brand-nav nav a[href="/login"]').count() === 1);
    check(label + ' 홈 미로그인 = 로그아웃 버튼 없음', await page.locator('.doit-brand-session').count() === 0);

    check(label + ' 페이지 오류 0건', errors.length === 0, errors.join(' | ').slice(0, 200));
    await ctx.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log('RESULT ' + (results.length - failed) + '/' + results.length + (failed ? ' FAILED' : ' PASS'));
process.exit(failed ? 1 : 0);
