import { test, expect } from './fixtures';

test.describe('J01 entry/menu/legal/viewport', () => {
  for (const width of [360, 390, 430, 768, 1280]) test(`app menu, guide, close and no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/doit/home');
    await page.getByRole('button', { name: '메뉴', exact: true }).click();
    await page.getByRole('navigation', { name: '메뉴', exact: true }).getByRole('link', { name: /^이용 안내/ }).click();
    await expect(page.getByRole('dialog', { name: '이용 안내' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('unknown route is an explicit error, legal link works', async ({ page }) => {
    await page.goto('/not-a-real-route');
    await expect(page.getByText(/404|페이지를 찾/).first()).toBeVisible();
    await page.goto('/legal/privacy');
    await expect(page.getByRole('heading', { name: /개인정보/ }).first()).toBeVisible();
  });
  test('app bootstrap is allowed by the actual CSP', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).e2eViolations = [];
      document.addEventListener('securitypolicyviolation', e => { if (e.violatedDirective.startsWith('script-src')) (window as any).e2eViolations.push(e.blockedURI); });
    });
    const response = await page.goto('/doit/home');
    expect(response!.headers()['content-security-policy']).toContain("script-src 'self'");
    await expect(page.getByRole('button', { name: '메뉴', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).e2eViolations)).toEqual([]);
  });
  test('actual CSP blocks a newly injected inline script', async ({ page }) => {
    await page.goto('/doit/home');
    await expect(page.getByRole('button', { name: '메뉴', exact: true })).toBeVisible();
    await page.evaluate(() => {
      (window as any).untrustedInlineExecuted = false;
      (window as any).blockedScriptEvents = [];
      document.addEventListener('securitypolicyviolation', event => {
        if (event.violatedDirective.startsWith('script-src')) (window as any).blockedScriptEvents.push(event.blockedURI);
      });
      const script = document.createElement('script');
      script.textContent = 'window.untrustedInlineExecuted = true';
      document.body.appendChild(script);
    });
    await expect.poll(() => page.evaluate(() => (window as any).blockedScriptEvents)).toContain('inline');
    expect(await page.evaluate(() => (window as any).untrustedInlineExecuted)).toBe(false);
  });
});

test.describe('J02 login/signup', () => {
  test.use({ authMode: 'anonymous' });
  test('email login uses the entered credentials and restores the app', async ({ page, seed }) => {
    await page.goto('/login');
    await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
    await page.getByLabel('비밀번호', { exact: true }).fill('SyntheticPassword123!');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    expect(seed.requests('POST /auth/v1/token').length).toBe(1);
  });
  test('invalid credentials keep the login screen with an error', async ({ page, seed }) => {
    seed.fail('POST /auth/v1/token', 'invalid_credentials', 400);
    await page.goto('/login');
    await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
    await page.getByLabel('비밀번호', { exact: true }).fill('WrongPassword123!');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page.getByText(/실패|않|오류|확인/).filter({ hasNot: page.locator('label') }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(seed.requests('POST /auth/v1/token')).toHaveLength(1);
  });
  test('signup never prechecks mandatory consent or submits without it', async ({ page, seed }) => {
    await page.goto('/signup');
    const checks = page.getByRole('checkbox');
    await expect(checks.first()).toBeVisible();
    for (const checkbox of await checks.all()) await expect(checkbox).not.toBeChecked();
    await page.getByLabel('이름', { exact: true }).fill('합성 검사');
    await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
    await page.getByLabel('비밀번호', { exact: true }).fill('SyntheticPassword123!');
    await page.getByLabel('비밀번호 확인', { exact: true }).fill('DifferentPassword123!');
    expect(seed.requests('POST /auth/v1/signup')).toHaveLength(0);
    await expect(page.getByRole('button', { name: '가입하기', exact: true })).toBeDisabled();
  });
  test('injected implicit-flow fragment cannot create a session', async ({ page }) => {
    await page.goto('/auth/callback#access_token=untrusted&refresh_token=untrusted&token_type=bearer&expires_in=3600');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sb-echo-e2e-auth-token'))).toBeNull();
  });
  test('PKCE callback exchanges the local verifier and restores a session', async ({ page, seed }) => {
    await page.addInitScript(() => { if (location.hostname === '127.0.0.1') localStorage.setItem('sb-echo-e2e-auth-token-code-verifier', JSON.stringify('synthetic-verifier-not-a-credential')); });
    await page.goto('/auth/callback?code=synthetic-code');
    await expect.poll(() => seed.requests('POST /auth/v1/token').length).toBe(1);
    expect(seed.requests('POST /auth/v1/token')[0]).toMatchObject({ auth_code: 'synthetic-code', code_verifier: 'synthetic-verifier-not-a-credential' });
    await expect(page).not.toHaveURL(/auth\/callback/);
  });
  test('signup with explicit required consent sends only the entered account data', async ({ page, seed }) => {
    await page.goto('/signup');
    await page.getByLabel('이름', { exact: true }).fill('합성 검사');
    await page.getByLabel('이메일', { exact: true }).fill('synthetic@example.invalid');
    await page.getByLabel('비밀번호', { exact: true }).fill('SyntheticPassword123!');
    await page.getByLabel('비밀번호 확인', { exact: true }).fill('SyntheticPassword123!');
    await page.getByRole('checkbox', { name: /모두 동의합니다/ }).check();
    await page.getByRole('button', { name: '가입하기', exact: true }).click();
    await expect.poll(() => seed.requests('POST /auth/v1/signup').length).toBe(1);
    expect(seed.requests('POST /auth/v1/signup')[0].email).toBe('synthetic@example.invalid');
    expect(seed.requests('POST /auth/v1/signup')[0].data.consent_version).toBe('v1.0');
  });
});
test.describe('J02 expired session', () => {
  test.use({ authMode: 'expired' });
  test('expired refresh cannot enter a signed-in conversation', async ({ page, seed }) => {
    await page.goto('/doit/home');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sb-echo-e2e-auth-token'))).toBeNull();
    expect(seed.requests('agent_turn')).toHaveLength(0);
  });
});
