import { chromium } from 'playwright';
const B = 'http://localhost:4650';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? '통과' : '실패'} · ${name}${extra ? ' · ' + extra : ''}`);
const api = async (p) => (await fetch(B + p)).json();
async function open(mode) {
  await api('/__mode?m=' + mode);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/cdnjs|fonts\.g/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const logs = []; page.on('console', (m) => logs.push(m.text()));
  await page.goto(B + '/'); await page.waitForTimeout(300);
  await page.click('#h-login'); await page.waitForTimeout(700);
  return { ctx, page, errors, logs };
}
const text = (page) => page.locator('body').innerText();
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

{ // A. 정상 탈퇴
  const { ctx, page, errors, logs } = await open('ok');
  check('[정상] 설정에 회원 탈퇴 칸 + 메일(빠져나갈 문)이 보임', (await text(page)).includes('회원 탈퇴') && await page.getByRole('link', { name: /메일로 요청하기/ }).isVisible());
  check('[정상] 처음엔 아무 요청도 안 보냄', (await api('/__state')).calls.length === 0);
  await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).click(); await page.waitForTimeout(500);
  const t = await text(page);
  check('[정상] 지워지는 것 개수가 보임', t.includes('내가 적은 답 5개') && t.includes('사진 3장') && t.includes('연결 1개') && t.includes('상대 화면에서도 사라져요'));
  const btn = page.getByRole('button', { name: '탈퇴하고 모두 지우기' });
  check('[정상] 확인 칸 체크 전에는 탈퇴 버튼이 안 눌림', await btn.isDisabled());
  await btn.click({ force: true }).catch(() => {}); await page.waitForTimeout(200);
  check('[정상] 억지로 눌러도 지우기 요청 0', (await api('/__state')).deleteAttempts === 0);
  await page.getByRole('button', { name: '그대로 둘게요' }).click(); await page.waitForTimeout(200);
  check('[정상] 「그대로 둘게요」 → 처음 상태로', await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).isVisible() && (await api('/__state')).deleteAttempts === 0);
  await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).click(); await page.waitForTimeout(400);
  check('[정상] 다시 열면 확인 칸이 비어 있음', !(await page.getByRole('checkbox').isChecked()));
  await page.getByRole('checkbox').check();
  check('[정상] 체크하면 버튼이 눌림', await btn.isEnabled());
  check('[정상] 390px 가로 넘침 없음', !(await overflow(page)));
  await btn.click(); await btn.click({ timeout: 300 }).catch(() => {}); await page.waitForTimeout(900);
  const st = await api('/__state');
  const del = st.calls.filter((c) => c.action === 'delete_me');
  check('[정상] 지우기 요청은 한 번(연타 막힘)', del.length === 1, JSON.stringify(st.calls));
  check('[정상] 요청에 확인 값이 있고, 사용자 번호는 안 보냄', del[0]?.confirm === 'delete-my-account-v1' && JSON.stringify(del[0]?.keys) === JSON.stringify(['action', 'confirm']) && del[0]?.auth === true);
  check('[정상] "탈퇴했어요" + 처음 화면으로', (await text(page)).includes('탈퇴했어요') && await page.getByRole('link', { name: /처음 화면으로/ }).isVisible());
  check('[정상] 로그인 서버가 "없는 계정"(403)이라고 답해도', st.logout === 1, String(st.logout));
  await page.click('#h-session'); await page.waitForTimeout(200);
  check('[정상] 이 기기의 로그인이 풀림', (await page.evaluate(() => window.__session)) === 'none');
  const ls = await page.evaluate(() => Object.keys(localStorage));
  check('[정상] 이 기기의 내 흔적(요청 표시)만 지움', !ls.some((k) => k.includes('11111111-1111')) && ls.includes('doit:other'), JSON.stringify(ls));
  await page.getByRole('link', { name: /처음 화면으로/ }).click(); await page.waitForTimeout(300);
  check('[정상] 처음 화면으로 이동', (await page.locator('#where').textContent()) === '/');
  check('[정상] 화면 오류 0 · 콘솔에 이메일·번호 없음', errors.length === 0 && !logs.join('\n').match(/qa@example|11111111-1111/), errors.join('|'));
  await ctx.close();
}
{ // B. 서버가 아직 안 올라감(지금 운영 상태) → 메일로
  const { ctx, page, errors } = await open('notdeployed');
  await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).click(); await page.waitForTimeout(600);
  const t = await text(page);
  check('[서버 없음] "앱에서 바로 탈퇴할 수 없어요, 메일로" 안내', t.includes('지금은 앱에서 바로 탈퇴할 수 없어요'));
  check('[서버 없음] 탈퇴 버튼 없음 · 메일 링크 있음', (await page.getByRole('button', { name: '탈퇴하고 모두 지우기' }).count()) === 0 && await page.getByRole('link', { name: /메일로 요청하기/ }).isVisible());
  await page.getByRole('button', { name: '닫기' }).click(); await page.waitForTimeout(200);
  check('[서버 없음] 닫기 → 처음 상태', await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).isVisible());
  check('[서버 없음] 화면 오류 0', errors.length === 0, errors.join('|'));
  await ctx.close();
}
{ // C. 관리자 계정
  const { ctx, page, errors } = await open('admin');
  await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).click(); await page.waitForTimeout(500);
  check('[관리자] 멈춤 안내 + 탈퇴 버튼 없음', (await text(page)).includes('관리자 계정은 앱에서 탈퇴할 수 없어요') && (await page.getByRole('button', { name: '탈퇴하고 모두 지우기' }).count()) === 0);
  check('[관리자] 지우기 요청 0', (await api('/__state')).deleteAttempts === 0);
  check('[관리자] 화면 오류 0', errors.length === 0, errors.join('|'));
  await ctx.close();
}
{ // D. 사진 지우기 실패 → 다시 해 보기 → 성공
  const { ctx, page, errors } = await open('storagefail');
  await page.getByRole('button', { name: /탈퇴 전에 지워지는 것 보기/ }).click(); await page.waitForTimeout(400);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '탈퇴하고 모두 지우기' }).click(); await page.waitForTimeout(700);
  check('[일시 오류] "계정은 그대로예요" + 다시 해 보기', (await text(page)).includes('계정은 그대로예요') && await page.getByRole('button', { name: '다시 해 보기' }).isVisible());
  await page.click('#h-session'); await page.waitForTimeout(200);
  check('[일시 오류] 로그인은 유지', (await page.evaluate(() => window.__session)) !== 'none');
  await page.getByRole('button', { name: '다시 해 보기' }).click(); await page.waitForTimeout(200);
  check('[일시 오류] 다시 해 보기 → 확인 칸을 다시 체크해야 함', await page.getByRole('button', { name: '탈퇴하고 모두 지우기' }).isDisabled());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '탈퇴하고 모두 지우기' }).click(); await page.waitForTimeout(800);
  check('[일시 오류] 두 번째에 탈퇴 완료', (await text(page)).includes('탈퇴했어요') && (await api('/__state')).deleteAttempts === 2);
  check('[일시 오류] 화면 오류 0', errors.length === 0, errors.join('|'));
  await ctx.close();
}
{ // E. 메뉴: 공간·월드 탭, Just Try·등급·사주타로 메뉴, 알림 종 숨김
  const { ctx, page, errors } = await open('ok');
  await page.click('#h-nav'); await page.waitForTimeout(500);
  const tabs = await page.locator('nav[aria-label="앱 메뉴"] a').allInnerTexts();
  check('[메뉴] 아래 탭 = 홈·연결·프로필', JSON.stringify(tabs.map((s) => s.trim())) === JSON.stringify(['홈', '연결', '프로필']), JSON.stringify(tabs));
  const bell = await page.getByRole('link', { name: '알림' }).count(); const gear = await page.getByRole('link', { name: '설정' }).count();
  check('[메뉴] 알림 종 없음 · 설정은 있음', bell === 0 && gear === 1, `bell=${bell} gear=${gear}`);
  await page.getByRole('button', { name: '메뉴', exact: true }).evaluate((el) => el.click()); await page.waitForTimeout(200);
  const menu = await text(page);
  check('[메뉴] 햄버거 = 다섯 가지 질문·나의 이해만', menu.includes('다섯 가지 질문') && menu.includes('나의 이해') && !/Just Try|사주·타로|등급 가이드|ECHO와 이야기하기/.test(menu));
  check('[메뉴] 화면 오류 0 · 가로 넘침 없음', errors.length === 0 && !(await overflow(page)), errors.join('|'));
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('통과')).length}/${results.length}`);
