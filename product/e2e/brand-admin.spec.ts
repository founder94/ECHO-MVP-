import { test, expect } from './fixtures';

test.describe('J01 brand actual role', () => {
  test.use({ baseURL: 'http://127.0.0.1:4174', authMode: 'anonymous' });
  test('homepage mobile entry points to the separate app; guide is available', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /모바일로 시작하기/ }).first()).toHaveAttribute('href', 'http://127.0.0.1:4173/doit/start-journey');
    await page.getByRole('button', { name: '이용 안내', exact: true }).first().click();
    await expect(page.getByRole('dialog', { name: '이용 안내' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
  test('app session does not become a shared cookie on the brand origin', async ({ page, context, seed }) => {
    await context.addInitScript(auth => { if (location.port === '4173') localStorage.setItem('sb-echo-e2e-auth-token', JSON.stringify(auth)); }, seed.auth);
    await page.goto('http://127.0.0.1:4173/doit/home');
    expect(await page.evaluate(() => !!localStorage.getItem('sb-echo-e2e-auth-token'))).toBe(true);
    await page.goto('/');
    expect(await page.evaluate(() => localStorage.getItem('sb-echo-e2e-auth-token'))).toBeNull();
    expect(await context.cookies()).toEqual([]);
  });
});
test.describe('J15 admin role', () => {
  test.use({ baseURL: 'http://127.0.0.1:4175', authMode: 'admin' });
  test('read-only dashboard and empty users render with security headers', async ({ page, seed }) => {
    const response = await page.goto('/');
    expect(response!.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response!.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('combobox', { name: '메뉴', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '오늘', exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: '메뉴', exact: true }).selectOption('users');
    await expect.poll(() => seed.requests('users').length).toBe(1);
    await expect(page.getByText(/사용자가 없|없습니다|0명/).first()).toBeVisible();
    expect(seed.calls.filter(c => /admin_decide|delete|update/.test(c.action))).toHaveLength(0);
  });
  test('dashboard read failure stays an error instead of fake zero data', async ({ page, seed }) => {
    seed.fail('overview');
    await page.goto('/');
    await expect(page.getByText(/합성 시험 실패/).first()).toBeVisible();
    await page.getByRole('button', { name: '새로 고침', exact: true }).click();
    await expect.poll(() => seed.requests('overview').length).toBe(2);
  });
});
test.describe('J15 ordinary user', () => {
  test.use({ baseURL: 'http://127.0.0.1:4175' });
  test('ordinary app user cannot open admin dashboard', async ({ page, seed }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '관리자 권한이 없습니다' })).toBeVisible();
    expect(seed.requests('overview')).toHaveLength(0);
  });
});
