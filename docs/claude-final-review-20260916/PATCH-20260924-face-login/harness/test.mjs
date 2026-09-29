import { chromium } from 'playwright';
const B = 'http://localhost:4640';
const MAIN_ENTRY = process.env.MAIN_ENTRY;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? '통과' : '실패'} · ${name}${extra ? ' · ' + extra : ''}`);
const api = async (p) => (await fetch(B + p)).json();
async function open({ ua, noWebAuthn = false, authenticator = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ...(ua ? { userAgent: ua } : {}) });
  await ctx.route(/cdnjs|fonts\.g/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (noWebAuthn) await ctx.addInitScript(() => { delete window.PublicKeyCredential; });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const logs = []; page.on('console', (m) => logs.push(m.text()));
  let auth = null;
  if (authenticator) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    auth = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    auth.cdp = cdp;
  }
  await page.goto(B + '/'); await page.waitForTimeout(400);
  return { ctx, page, errors, logs, auth };
}
const where = (page) => page.locator('#where').textContent();

{ // A. 로그인 서버에서 얼굴 로그인이 아직 꺼져 있을 때 (대표 설정 전 = 지금 운영 상태)
  await api('/__mode?m=off');
  const { ctx, page, errors } = await open();
  await page.click('#h-login'); await page.waitForTimeout(600);
  check('[꺼짐] 설정: "아직 켜지지 않았어요" 안내, 등록 버튼 없음', await page.getByText('얼굴 로그인은 아직 켜지지 않았어요').isVisible() && (await page.getByRole('button', { name: /이 휴대폰 등록하기/ }).count()) === 0);
  await page.click('#h-logout'); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /얼굴·지문으로 로그인/ }).click(); await page.waitForTimeout(800);
  check('[꺼짐] 로그인: 기존 로그인으로 안내', (await page.locator('body').innerText()).includes('얼굴 로그인은 아직 켜지지 않았어요. 이메일이나 Google 로 로그인해 주세요.'));
  check('[꺼짐] 로그인: 이메일·Google 로그인은 그대로 있음', await page.getByRole('button', { name: /^로그인$/ }).isVisible() && await page.getByRole('button', { name: /Google로 계속하기/ }).isVisible());
  check('[꺼짐] 화면 오류 0', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{ // B. 켜짐: 등록 → 로그아웃 → 얼굴로 로그인 (같은 가상 기기)
  await api('/__mode?m=on');
  const { ctx, page, errors, logs } = await open();
  await page.click('#h-login'); await page.waitForTimeout(600);
  check('[켜짐] 설정: 등록 버튼이 보인다', await page.getByRole('button', { name: /지금 이 휴대폰 등록하기/ }).isVisible());
  check('[켜짐] 설정: 아직 등록한 기기 없음', await page.getByText('아직 등록한 기기가 없어요').isVisible());
  await page.screenshot({ path: '../face-shot-settings-before.png', fullPage: true });
  await page.getByRole('button', { name: /지금 이 휴대폰 등록하기/ }).click(); await page.waitForTimeout(1500);
  check('[켜짐] 등록 성공 안내', await page.getByText('등록했어요. 다음부터 로그인 화면에서').isVisible());
  check('[켜짐] 등록한 기기가 목록에 보인다', await page.getByText('Chrome 가상 장치').isVisible());
  await page.screenshot({ path: '../face-shot-settings-after.png', fullPage: true });
  let st = await api('/__state');
  const reg = st.checks.find((c) => c.step === 'reg');
  check('[켜짐] 브라우저가 서버 챌린지로 서명해 보냈다(등록)', !!reg && reg.type === 'webauthn.create' && reg.challengeOk && reg.origin === B && reg.hasAttestation && reg.challengeId === 'c-reg', JSON.stringify(reg));
  await page.click('#h-logout'); await page.waitForTimeout(400);
  await page.click('#h-session'); await page.waitForTimeout(200);
  check('[켜짐] 로그아웃 뒤 세션 없음', (await page.evaluate(() => window.__session)) === 'none');
  await page.screenshot({ path: '../face-shot-login.png', fullPage: true });
  await page.getByRole('button', { name: /얼굴·지문으로 로그인/ }).click(); await page.waitForTimeout(1500);
  st = await api('/__state');
  const au = st.checks.find((c) => c.step === 'auth');
  check('[켜짐] 브라우저가 서버 챌린지로 서명해 보냈다(로그인)', !!au && au.type === 'webauthn.get' && au.challengeOk && au.origin === B && au.hasSignature && au.knownCredential, JSON.stringify(au));
  // 이메일 로그인과 같은 곳(돌아갈 곳을 따로 안 정했으면 기본 시작 화면 MAIN_ENTRY_PATH)으로 간다.
  check('[켜짐] 얼굴 로그인 뒤 이메일 로그인과 같은 곳으로 이동', (await where(page)) === MAIN_ENTRY, await where(page));
  await page.click('#h-session'); await page.waitForTimeout(200);
  check('[켜짐] 로그인 세션이 생겼다', (await page.evaluate(() => window.__session)) === '11111111-1111-4111-8111-111111111111');
  check('[켜짐] 서버 호출 순서', st.calls.join(',').includes('POST /passkeys/registration/options,POST /passkeys/registration/verify') && st.calls.join(',').includes('POST /passkeys/authentication/options,POST /passkeys/authentication/verify'), st.calls.join(','));
  check('[켜짐] 화면 로그에 토큰·자격 증명 없음', !logs.some((l) => /at-|rt-|clientDataJSON|attestation/i.test(l)), logs.join(' | ').slice(0, 200));
  // D. 지우기
  await page.click('#h-login'); await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^지우기$/ }).click();
  check('[지우기] 한 번 더 묻는다', await page.getByRole('button', { name: '그대로 둘게요' }).isVisible());
  await page.getByRole('button', { name: '지울게요' }).click(); await page.waitForTimeout(800);
  check('[지우기] 지운 뒤 목록이 빈다', await page.getByText('지웠어요.').isVisible() && await page.getByText('아직 등록한 기기가 없어요').isVisible());
  check('[켜짐] 화면 오류 0', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{ // C. 등록하지 않은 기기에서 얼굴 로그인 → 기기가 시간 안에 못 찾음
  await api('/__mode?m=short');
  const { ctx, page, errors } = await open();
  await page.click('#h-logout'); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /얼굴·지문으로 로그인/ }).click(); await page.waitForTimeout(4500);
  const body = await page.locator('body').innerText();
  check('[미등록 기기] 멈추지 않고 안내가 뜬다', body.includes('얼굴 확인을 닫았어요') || body.includes('이 기기에 등록한 얼굴 로그인이 없어요'), body.split('\n').filter((l) => /얼굴|기기/.test(l)).join(' / ').slice(0, 200));
  check('[미등록 기기] 버튼이 다시 눌린다', await page.getByRole('button', { name: /얼굴·지문으로 로그인/ }).isEnabled());
  check('[미등록 기기] 화면 오류 0', errors.length === 0, errors.join(' | '));
  await ctx.close();
  await api('/__mode?m=on');
}
{ // E. 카카오톡 안 브라우저
  const { ctx, page } = await open({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0' });
  await page.click('#h-logout'); await page.waitForTimeout(400);
  check('[카카오톡] 얼굴 버튼 대신 사파리·크롬 안내', (await page.getByRole('button', { name: /얼굴·지문으로 로그인/ }).count()) === 0 && await page.getByText('카카오톡 같은 앱 안에서는 안 돼요').isVisible());
  await ctx.close();
}
{ // F. 얼굴·지문 로그인을 지원하지 않는 브라우저
  const { ctx, page } = await open({ noWebAuthn: true, authenticator: false });
  await page.click('#h-logout'); await page.waitForTimeout(400);
  check('[미지원 브라우저] 얼굴 버튼이 없고 기존 로그인만', (await page.getByRole('button', { name: /얼굴·지문으로 로그인/ }).count()) === 0 && await page.getByRole('button', { name: /^로그인$/ }).isVisible());
  await ctx.close();
}
await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('통과')).length}/${results.length}`);
