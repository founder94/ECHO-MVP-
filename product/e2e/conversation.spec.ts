import { test, expect, conversation, SID, FakeBackend } from './fixtures';

const open = async (page: any) => { await page.goto('/doit/conversation'); await expect(page.getByTestId('agent-question')).toBeVisible(); };

test('J04 free text is primary; sending uses exactly the typed answer', async ({ page, seed }) => {
  await open(page);
  await expect(page.getByRole('group', { name: '가까운 답 고르기' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '답변 보내기', exact: true })).toBeDisabled();
  await page.getByLabel('이어서 적기', { exact: true }).fill('천천히 산책하는 친구가 좋아요');
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect(page.getByLabel('이어서 적기', { exact: true })).toHaveValue('');
  expect(seed.requests('agent_turn')).toHaveLength(1);
  expect(seed.requests('agent_turn')[0].text).toBe('천천히 산책하는 친구가 좋아요');
});
test('J04 rescue options are server-supplied, select only, then send as one answer', async ({ page, seed }) => {
  await open(page);
  await page.getByRole('button', { name: '잘 모르겠어요', exact: true }).click();
  const choices = page.getByRole('group', { name: '가까운 답 고르기' });
  await expect(choices).toBeVisible();
  await choices.getByRole('button', { name: '밝고 가볍게', exact: true }).click();
  expect(seed.requests('agent_turn')).toHaveLength(0);
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect.poll(() => seed.requests('agent_turn').length).toBe(1);
  expect(seed.requests('agent_turn')[0]).toMatchObject({ text: '밝고 가볍게', choice: '밝고 가볍게', rescueOpen: true });
});
test('J04 failed network preserves text and retry request identity', async ({ page, seed }) => {
  seed.disconnect('agent_turn');
  await open(page);
  const input = page.getByLabel('이어서 적기', { exact: true });
  await input.fill('실패해도 보존할 내 답');
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(input).toHaveValue('실패해도 보존할 내 답');
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect(input).toHaveValue('');
  expect(seed.requests('agent_turn')).toHaveLength(2);
  expect(seed.requests('agent_turn')[1].requestId).toBe(seed.requests('agent_turn')[0].requestId);
});
test('J04 pending send ignores double submit and preserves draft on browser back', async ({ page, seed }) => {
  const release = seed.hold('agent_turn');
  await page.goto('/legal/terms');
  await open(page);
  const input = page.getByLabel('이어서 적기', { exact: true });
  await input.fill('응답을 기다리는 중에도 남아야 해요');
  await page.getByRole('button', { name: '답변 보내기', exact: true }).click();
  await expect.poll(() => seed.requests('agent_turn').length).toBe(1);
  await expect(page.getByRole('button', { name: '답변 보내기', exact: true })).toBeDisabled();
  await page.goBack();
  await expect(input).toHaveValue('응답을 기다리는 중에도 남아야 해요');
  expect(seed.requests('agent_turn')).toHaveLength(1);
  release();
  await expect(input).toHaveValue('');
});
test('J04 explicit skip is sent as control text without fabricating a preference', async ({ page, seed }) => {
  await open(page);
  await page.getByRole('button', { name: '잘 모르겠어요', exact: true }).click();
  await page.getByRole('button', { name: '이 질문 넘어가기', exact: true }).click();
  await expect.poll(() => seed.requests('agent_turn').length).toBe(1);
  expect(seed.requests('agent_turn')[0].correction).toBeUndefined();
  expect(seed.requests('agent_turn')[0].text).toMatch(/넘/);
});

test.describe('J05 correction controls', () => {
  test.beforeEach(async ({ seed }) => { seed.session = conversation(true); });
  test('four controls are separate; reject sends targeted correction, then server receipt', async ({ page, seed }) => {
    await page.goto('/doit/conversation');
    const check = page.getByRole('region', { name: 'ECHO가 이해한 나', exact: true });
    for (const label of ['맞아요', '조금 달라요', '그게 아니에요', '직접 설명할게요']) await expect(check.getByRole('button', { name: label, exact: true })).toBeVisible();
    await check.getByRole('button', { name: '그게 아니에요', exact: true }).click();
    await check.getByRole('button', { name: '원하는 만남', exact: true }).click();
    await check.getByRole('textbox').fill('경쟁보다 편하게 함께 걷고 싶어요');
    await check.getByRole('button', { name: '이렇게 고칠게요' }).click();
    await expect(page.getByTestId('memory-receipt')).toHaveText(/고친 내용/);
    expect(seed.requests('agent_turn')[0]).toMatchObject({ sessionId: SID, correction: { purpose: 'relationship_intent' }, text: '경쟁보다 편하게 함께 걷고 싶어요' });
  });
  test('correction failure keeps text and cannot show a saved receipt', async ({ page, seed }) => {
    seed.fail('agent_turn');
    await page.goto('/doit/conversation');
    await page.getByRole('button', { name: '직접 설명할게요', exact: true }).click();
    const input = page.getByLabel(/원하는 걸 짧게/);
    await input.fill('실패한 정정도 지우지 말아요');
    await page.getByRole('button', { name: '이렇게 말할게요' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(input).toHaveValue('실패한 정정도 지우지 말아요');
    await expect(page.getByTestId('memory-receipt')).toHaveCount(0);
  });
});

test('J06 memory search uses server evidence; absent records are not invented', async ({ page, seed }) => {
  await open(page);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await page.getByLabel('예전에 남긴 말 찾아보기', { exact: true }).fill('초기 목표');
  await page.getByRole('button', { name: '원문 찾기', exact: true }).click();
  await expect(page.getByText('확인할 기록이 없어요.', { exact: true })).toBeVisible();
  expect(seed.requests('agent_recall')[0].query).toBe('초기 목표');
  seed.memory = { intent: 'history', status: 'FOUND', complete: true, notice: null, next: null, evidence: [{ source_id: 'synthetic-source-1', session_id: SID, revision: 1, turn: 1, quote: '최초 목표는 500억, 지금 목표는 5000억(가상 자료)', validity: 'HISTORICAL_ONLY', matching_promotion: false }] };
  await page.getByRole('button', { name: '원문 찾기', exact: true }).click();
  await expect(page.getByText(/최초 목표는 500억/)).toBeVisible();
  expect(seed.requests('agent_turn')).toHaveLength(0);
});
test('J06 failed recall preserves the current conversation', async ({ page, seed }) => {
  seed.fail('agent_recall');
  await open(page);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await page.getByLabel('예전에 남긴 말 찾아보기', { exact: true }).fill('없던 기록');
  await page.getByRole('button', { name: '원문 찾기', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('agent-question')).toHaveText('일주일에 몇 번쯤 보면 편해요?');
});
test('J06 malformed recall cannot crash the page or promote unknown evidence', async ({ page, seed }) => {
  seed.memory = { status: 'FOUND', complete: true, evidence: [{ quote: '의미를 검증하지 않은 응답' }] };
  await open(page);
  await page.getByRole('button', { name: '더 보기', exact: true }).click();
  await page.getByLabel('예전에 남긴 말 찾아보기', { exact: true }).fill('가상 기록');
  await page.getByRole('button', { name: '원문 찾기', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('agent-question')).toBeVisible();
  await expect(page.getByText('의미를 검증하지 않은 응답')).toHaveCount(0);
});
test('J06 fresh browser session fetches evidence without prompt injection and a second synthetic account sees only its own result', async ({ browser, seed }) => {
  const historicalQuote = '가상 첫 목표: 500억 원';
  seed.memory = { intent: 'history', status: 'FOUND', complete: true, notice: null, next: null, evidence: [{ source_id: 'synthetic-original-goal', session_id: SID, revision: 1, turn: 1, quote: historicalQuote, validity: 'HISTORICAL_ONLY', matching_promotion: false }] };
  const other = new FakeBackend(`${seed.uid[0] === 'a' ? 'b' : 'a'}${seed.uid.slice(1)}`);
  try {
    for (const backend of [seed, other]) {
      // Only authentication state crosses into this completely new context.
      // Evidence is fetched from the synthetic backend, never injected into a
      // browser prompt, localStorage or conversation history by the test.
      const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:4173', localStorage: [{ name: 'sb-echo-e2e-auth-token', value: JSON.stringify(backend.auth) }] }] } });
      const errors: string[] = [];
      context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
      await context.route('**/*', r => backend.route(r));
      try {
        const page = await context.newPage();
        await open(page);
        await page.getByRole('button', { name: '더 보기', exact: true }).click();
        await page.getByLabel('예전에 남긴 말 찾아보기', { exact: true }).fill('최초 목표');
        await page.getByRole('button', { name: '원문 찾기', exact: true }).click();
        if (backend === seed) await expect(page.getByText(historicalQuote, { exact: true })).toBeVisible();
        else {
          await expect(page.getByText('확인할 기록이 없어요.', { exact: true })).toBeVisible();
          await expect(page.getByText(historicalQuote, { exact: true })).toHaveCount(0);
        }
        expect(backend.requests('agent_recall')[0]).toMatchObject({ query: '최초 목표' });
        expect(backend.requests('agent_turn')).toHaveLength(0);
        expect(errors).toEqual([]);
        expect(backend.unhandled).toEqual([]);
      } finally { await context.close(); }
    }
  } finally { other.dispose(); }
});
test('J07 guide closes on Escape/back without losing draft or route', async ({ page }) => {
  await open(page);
  const input = page.getByLabel('이어서 적기', { exact: true });
  await input.fill('안내를 읽어도 남겨 둘 글');
  await page.getByRole('button', { name: '메뉴', exact: true }).click();
  const link = page.getByRole('navigation', { name: '메뉴', exact: true }).getByRole('link', { name: /^이용 안내/ });
  await link.click();
  await expect(page.getByRole('dialog', { name: '이용 안내' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(input).toHaveValue('안내를 읽어도 남겨 둘 글');
  await expect(page).toHaveURL(/\/doit\/conversation$/);
});
