import { test, expect, match, partner, MID } from './fixtures';

test('J03 profile restores server fields, validates nickname and saves exact edits', async ({ page, seed }) => {
  await page.goto('/doit/start-journey?edit=profile');
  const nickname = page.getByLabel('닉네임 *', { exact: true });
  await expect(nickname).toHaveValue(seed.profile.nickname);
  await nickname.fill('');
  await expect(page.getByRole('button', { name: '소개 저장하고 사진 등록하기' })).toBeDisabled();
  await nickname.fill('검사 이름');
  await page.getByLabel('소개', { exact: true }).fill('내가 직접 적은 검사 소개');
  await page.getByRole('button', { name: '소개 저장하고 사진 등록하기' }).click();
  await expect.poll(() => seed.profile.nickname).toBe('검사 이름');
  expect(seed.profile.bio).toBe('내가 직접 적은 검사 소개');
  await expect(page.getByRole('button', { name: /전신.*추가하기/ })).toBeVisible();
});
test('J03 profile save failure keeps the typed draft', async ({ page, seed }) => {
  seed.fail('PATCH /rest/v1/profiles', 'ERROR', 500, 1, body => 'nickname' in body);
  await page.goto('/doit/start-journey?edit=profile');
  await page.getByLabel('닉네임 *', { exact: true }).fill('보존할 이름');
  await page.getByRole('button', { name: '소개 저장하고 사진 등록하기' }).click();
  await expect(page.getByText('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')).toBeVisible();
  await expect(page.getByLabel('닉네임 *', { exact: true })).toHaveValue('보존할 이름');
  expect(seed.profile.nickname).not.toBe('보존할 이름');
});
test('J03 empty purpose list cannot be replaced by hardcoded choices', async ({ page, seed }) => {
  seed.purposes = []; seed.profile.purpose_id = null; seed.profile.purpose_label = null;
  await page.goto('/doit/start-journey');
  await expect(page.getByText(/준비|없|불러/).first()).toBeVisible();
  expect(seed.calls.filter(c => c.method === 'PATCH' && 'purpose_id' in c)).toHaveLength(0);
});

test('J03 photo upload failure preserves confirmation; retry saves to the signed-in user path and reload restores it', async ({ page, seed }) => {
  await page.goto('/doit/start-journey?edit=photos');
  const picture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 600;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#258d8c'; ctx.fillRect(0, 0, 400, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: '전신 (필수) 추가하기', exact: true }).click();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '앨범에서 선택', exact: true }).click();
  await (await fileChooser).setFiles({ name: 'synthetic-shape.png', mimeType: 'image/png', buffer: Buffer.from(picture, 'base64') });
  const confirm = page.getByRole('dialog', { name: '이 사진을 올릴까요?' });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: '이 사진 올리기' })).toBeDisabled();
  await confirm.getByRole('checkbox', { name: '최근 2개월 내 찍은 본인 사진입니다' }).check();
  seed.fail('photo_upload');
  await confirm.getByRole('button', { name: '이 사진 올리기' }).click();
  await expect(confirm.getByRole('alert')).toBeVisible();
  expect(seed.photos).toHaveLength(0);
  await expect(confirm.getByRole('checkbox')).toBeChecked();
  await confirm.getByRole('button', { name: '이 사진 올리기' }).click();
  await expect(confirm).toHaveCount(0);
  await expect.poll(() => seed.photos.length).toBe(1);
  expect(seed.photos[0]).toMatchObject({ user_id: seed.uid, slot: 1 });
  expect(seed.photos[0].storage_path).toMatch(new RegExp(`^${seed.uid}/1/[a-f0-9-]+\\.jpg$`));
  await page.reload();
  await expect(page.getByRole('button', { name: '전신 (필수) 바꾸기', exact: true })).toBeVisible();
  expect(seed.requests('photo_upload')).toHaveLength(2);
});

async function connections(page: any) { await page.goto('/doit/connections'); await expect(page.getByRole('region', { name: 'ECHO가 준비한 후보' })).toBeVisible(); }
async function choose(page: any) {
  const panel = page.getByRole('region', { name: 'ECHO가 준비한 후보' });
  await panel.getByRole('button', { name: '더 알아보기' }).click();
  await panel.getByRole('button', { name: '이어지고 싶어요' }).click();
}
test('J08 candidates empty state; fetch failure is recoverable', async ({ page, seed }) => {
  seed.candidates = []; seed.fail('my_candidates');
  await page.goto('/doit/connections');
  await expect(page.getByText('불러오지 못했어요. 다시 확인해 볼게요.')).toBeVisible();
  await page.getByRole('button', { name: '다시 확인하기', exact: true }).click();
  await expect(page.getByText('아직 보여 드릴 사람은 없어요.', { exact: true })).toBeVisible();
});
test('J08 finding candidates is manual, pending requests cannot duplicate', async ({ page, seed }) => {
  const release = seed.hold('agent_run');
  await connections(page);
  expect(seed.requests('agent_run')).toHaveLength(0);
  const button = page.getByRole('button', { name: '후보 확인하기' });
  await button.click();
  await expect.poll(() => seed.requests('agent_run').length).toBe(1);
  await expect(button).toBeDisabled();
  release();
  await expect(button).toBeEnabled();
  expect(seed.requests('choose')).toHaveLength(0);
});
test('J09 one-sided choice shows waiting, no mutual-success effect or private partner', async ({ page, seed }) => {
  await connections(page); await choose(page);
  await expect(page.getByText('선택을 보냈어요. 상대도 선택하면 알려드릴게요.', { exact: true })).toBeVisible();
  await expect(page.getByText('찌릿! 텔레파시가 통했어요')).toHaveCount(0);
  await expect(page.getByText(partner.nickname, { exact: true })).toHaveCount(0);
  expect(seed.requests('choose')).toHaveLength(1);
});
test('J09 mutual effect follows server confirmation; still no premature photo or chat', async ({ page, seed }) => {
  seed.mutual = true;
  await connections(page); await choose(page);
  await expect(page.getByText('찌릿! 텔레파시가 통했어요')).toBeVisible();
  await page.getByRole('button', { name: '다음 단계 보기' }).click();
  await expect(page.getByLabel('내 답', { exact: true })).toBeVisible();
  await expect(page.getByLabel('이어서 이야기하기', { exact: true })).toHaveCount(0);
  await expect(page.getByText(partner.nickname, { exact: true })).toHaveCount(0);
});
test('J09 failed selection keeps candidate and cannot pretend mutual success', async ({ page, seed }) => {
  seed.fail('choose', 'STATE_CHANGED', 409); seed.mutual = true;
  await connections(page); await choose(page);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText('찌릿! 텔레파시가 통했어요')).toHaveCount(0);
  expect(seed.candidates).toHaveLength(1);
});
test('J10 first answer does not reveal the partner until server conditions are met', async ({ page, seed }) => {
  seed.matches = [match()];
  await connections(page);
  await page.getByLabel('내 답', { exact: true }).fill('저녁 산책이 좋아요');
  await page.getByRole('button', { name: '내 답 보내기' }).click();
  await expect(page.getByText(/상대의 답을 기다리고 있어요/)).toBeVisible();
  await expect(page.getByText(partner.nickname, { exact: true })).toHaveCount(0);
  expect(seed.requests('answer')[0]).toMatchObject({ matchId: MID, text: '저녁 산책이 좋아요' });
});
test('J10 allowed chat sends a message; forbidden response preserves draft and history', async ({ page, seed }) => {
  seed.matches = [match({ my_answer: '내 첫 답', partner_answered: true, revealed: true, partner, messages: [] })];
  await connections(page);
  const input = page.getByLabel('이어서 이야기하기', { exact: true });
  await input.fill('반가워요, 같이 걸어요');
  await page.getByRole('region', { name: '내 연결' }).getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('list', { name: '이야기' })).toContainText('반가워요, 같이 걸어요');
  seed.fail('message', 'NOT_ALLOWED', 403);
  await input.fill('권한이 바뀌어도 남길 글');
  await page.getByRole('region', { name: '내 연결' }).getByRole('button', { name: '보내기', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(input).toHaveValue('권한이 바뀌어도 남길 글');
  expect(seed.matches[0].messages).toHaveLength(1);
});
test('J11 candidate block is confirmed by server; failure cannot remove the candidate', async ({ page, seed }) => {
  seed.fail('choose');
  await connections(page);
  await page.getByRole('region', { name: 'ECHO가 준비한 후보' }).getByRole('button', { name: '더 알아보기' }).click();
  await page.getByRole('button', { name: '불편해요 · 차단 · 신고' }).click();
  await page.getByRole('button', { name: '차단할게요', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(seed.candidates).toHaveLength(1);
  await page.getByRole('button', { name: '차단할게요', exact: true }).click();
  await expect.poll(() => seed.candidates.length).toBe(0);
  expect(seed.requests('choose')[1]).toMatchObject({ choice: 'hide', block: true });
});
test('J11 end connection failure retains it; confirmed retry closes it', async ({ page, seed }) => {
  seed.matches = [match()]; seed.fail('leave');
  await connections(page);
  await page.getByRole('button', { name: '이 연결 그만하기' }).click();
  await page.getByRole('button', { name: '그만할게요', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(seed.matches[0].status).toBe('open');
  await page.getByRole('button', { name: '그만할게요', exact: true }).click();
  await expect(page.getByText(/이 연결은 끝났어요/)).toBeVisible();
});
test('J11 report failure has no receipt; chosen reason is submitted and confirmed retry reports and blocks', async ({ page, seed }) => {
  await connections(page);
  await page.getByRole('region', { name: 'ECHO가 준비한 후보' }).getByRole('button', { name: '더 알아보기' }).click();
  await page.getByRole('button', { name: '불편해요 · 차단 · 신고' }).click();
  await page.getByRole('button', { name: '신고할게요', exact: true }).click();
  seed.fail('choose');
  await page.getByRole('button', { name: '위협·강요', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText(/접수했어요/)).toHaveCount(0);
  expect(seed.candidates).toHaveLength(1);
  await page.getByRole('button', { name: '위협·강요', exact: true }).click();
  await expect(page.getByText(/접수했어요/)).toBeVisible();
  expect(seed.requests('choose')[1]).toMatchObject({ choice: 'hide', block: true, reason: 'threat' });
  expect(seed.candidates).toHaveLength(0);
});
