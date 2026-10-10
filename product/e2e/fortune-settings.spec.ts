import { test, expect } from './fixtures';

test('J12 saju validates input and calculates locally without transmitting birth data', async ({ page, seed }) => {
  await page.goto('/doit/fortune');
  await page.getByRole('button', { name: /무료 사주/ }).click();
  await expect(page.getByRole('button', { name: '입력 내용 확인하기' })).toBeDisabled();
  await page.getByRole('button', { name: '여성', exact: true }).click();
  await page.getByLabel('태어난 날짜', { exact: true }).fill('1995-04-23');
  await page.getByRole('button', { name: '태어난 시간을 몰라요', exact: true }).click();
  await page.getByRole('button', { name: '입력 내용 확인하기' }).click();
  await page.getByRole('button', { name: '맞아요', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ECHO랑 이야기해볼래요' })).toBeVisible();
  expect(JSON.stringify(seed.calls)).not.toContain('1995-04-23');
  await page.getByRole('button', { name: 'ECHO랑 이야기해볼래요' }).click();
  await expect(page.getByLabel('ECHO에게 할 말', { exact: true })).toBeEnabled();
  expect(seed.requests('agent_ref')[0].ref.kind).toBe('pattern');
  expect(Object.keys(seed.requests('agent_ref')[0].ref).sort()).toEqual(['key', 'kind']);
  expect(seed.requests('agent_turn')).toHaveLength(0);
});

test('J12 tarot shows real response content in mock scope and continues into optional-question reference chat', async ({ page, seed }) => {
  await page.addInitScript(() => { localStorage.setItem(`echo-tarot-daily:${new Date().toLocaleDateString('sv-SE')}`, JSON.stringify({ cardId: 'major-0', purpose: '' })); });
  await page.goto('/doit/fortune?view=taro');
  await expect(page.getByText('가상 카드 해석: 잠시 쉬어 가도 괜찮아요.')).toBeVisible();
  await page.getByRole('button', { name: 'ECHO와 조금 더 이야기하기' }).click();
  const input = page.getByLabel('ECHO에게 할 말', { exact: true });
  await expect(input).toBeEnabled();
  expect(seed.requests('agent_ref')[0].text).toBe('');
  await input.fill('내가 떠오른 생각을 적어요');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText('합성 응답: 지금 느낀 말을 들었어요.')).toBeVisible();
  await expect(page.getByText('지금 가장 떠오르는 생각은 무엇인가요?')).toHaveCount(0);
  await input.fill('버튼을 눌러도 보존할 초안');
  await page.getByRole('button', { name: '질문 하나 받아 보기' }).click();
  await expect(page.getByText('지금 가장 떠오르는 생각은 무엇인가요?')).toBeVisible();
  await expect(input).toHaveValue('버튼을 눌러도 보존할 초안');
  expect(seed.requests('agent_self_note')).toHaveLength(0);
  expect(seed.requests('agent_turn')).toHaveLength(0);
});
test('J12 failed tarot displays no fake reading and retry keeps the same card', async ({ page, seed }) => {
  seed.fail('agent_card', 'AI_ERROR', 502);
  await page.addInitScript(() => localStorage.setItem(`echo-tarot-daily:${new Date().toLocaleDateString('sv-SE')}`, JSON.stringify({ cardId: 'major-0', purpose: '' })));
  await page.goto('/doit/fortune?view=taro');
  await expect(page.getByText('해석을 불러오지 못했어요')).toBeVisible();
  await expect(page.getByText('가상 카드 해석: 잠시 쉬어 가도 괜찮아요.')).toHaveCount(0);
  await page.getByRole('button', { name: '같은 카드로 다시 보기' }).click();
  await expect(page.getByText('가상 카드 해석: 잠시 쉬어 가도 괜찮아요.')).toBeVisible();
  expect(seed.requests('agent_card')).toHaveLength(2);
  expect(seed.requests('agent_card')[1].cardName).toBe(seed.requests('agent_card')[0].cardName);
});
test('J12 reference correction saves only the user sentence after explicit consent; failed save has no receipt', async ({ page, seed }) => {
  seed.refCorrection = '나는 주말에 조용히 쉬는 게 좋아요';
  await page.addInitScript(() => localStorage.setItem(`echo-tarot-daily:${new Date().toLocaleDateString('sv-SE')}`, JSON.stringify({ cardId: 'major-0', purpose: '' })));
  await page.goto('/doit/fortune?view=taro');
  await page.getByRole('button', { name: 'ECHO와 조금 더 이야기하기' }).click();
  const input = page.getByLabel('ECHO에게 할 말', { exact: true });
  await input.fill(seed.refCorrection);
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  const offer = page.getByRole('group', { name: '프로필 반영 확인' });
  await expect(offer).toContainText(seed.refCorrection);
  expect(seed.requests('agent_self_note')).toHaveLength(0);
  seed.fail('agent_self_note', 'ERROR', 500);
  await offer.getByRole('button', { name: '반영할게요', exact: true }).click();
  await expect(offer).toContainText('반영하지 못했어요');
  await expect(offer.getByText(/반영했어요/)).toHaveCount(0);
  await offer.getByRole('button', { name: '반영할게요', exact: true }).click();
  await expect(offer).toContainText('반영했어요');
  expect(seed.requests('agent_self_note')).toHaveLength(2);
  for (const request of seed.requests('agent_self_note')) {
    expect(request.text).toBe(seed.refCorrection);
    expect(request.origin).toBe('ref_correction');
    expect(request).not.toHaveProperty('history');
    expect(request).not.toHaveProperty('ref');
  }
  expect(seed.requests('agent_turn')).toHaveLength(0);
});
test('J13 settings install help stays usable without pretending installed', async ({ page }) => {
  await page.goto('/doit/settings#install');
  await expect(page.getByRole('heading', { name: '앱으로 쓰기' })).toBeVisible();
  await expect(page.getByText('휴대폰에서 이 주소를 열면 홈 화면에 ECHO를 둘 수 있어요. 설치하지 않아도 그대로 쓸 수 있어요.', { exact: true })).toBeVisible();
  await expect(page.getByText('설치됐어요', { exact: true })).toHaveCount(0);
});
test('J13 logout server failure still clears the local session safely', async ({ page, seed }) => {
  seed.fail('POST /auth/v1/logout', 'ERROR', 400);
  await page.goto('/doit/settings');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sb-echo-e2e-auth-token'))).toBeNull();
  // auth-js 2.117 clears the local session even on a revocation error. Never
  // restore a token merely to satisfy a UI expectation about retries.
  expect(seed.requests('POST /auth/v1/logout')).toHaveLength(1);
  await expect(page.getByText('모든 기기에서 로그아웃했어요', { exact: true })).toHaveCount(0);
});
test('J13 successful logout removes the local token', async ({ page }) => {
  await page.goto('/doit/settings');
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sb-echo-e2e-auth-token'))).toBeNull();
});
test('J14 disabled free talk cannot create calls or activate legacy payment', async ({ page, seed }) => {
  await page.goto('/doit/talk');
  await expect(page.getByText(/자유 대화는 아직 열리지/)).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.goto('/payment');
  await expect(page).toHaveURL(/\/doit\/home/);
  expect(seed.requests('agent_free_talk')).toHaveLength(0);
});
test('J14 enabled trial works; company budget error preserves typed text', async ({ page, seed }) => {
  seed.free.enabled = true;
  await page.goto('/doit/talk');
  const input = page.getByLabel('ECHO에게 할 말', { exact: true });
  await input.fill('시험 범위 자유 대화');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByText('합성 자유 대화 응답')).toBeVisible();
  seed.fail('agent_free_talk', 'AI_COMPANY_BUDGET', 429);
  await input.fill('예산 오류가 나도 남기는 글');
  await page.getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('잠시 멈췄어요');
  await expect(input).toHaveValue('예산 오류가 나도 남기는 글');
});
test('J14 exhausted trial cannot invent payment or send another message', async ({ page, seed }) => {
  seed.free = { ...seed.free, enabled: true, trial_left: 0 };
  await page.goto('/doit/talk');
  await expect(page.getByText(/맛보기를 다 썼어요/)).toBeVisible();
  await expect(page.getByRole('button', { name: '보내기', exact: true })).toBeDisabled();
  expect(seed.requests('agent_free_talk')).toHaveLength(0);
});
