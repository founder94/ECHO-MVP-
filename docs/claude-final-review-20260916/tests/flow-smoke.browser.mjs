// 브라우저 실행 검사(로컬 전용): 검사한 빌드(out/)를 그대로 띄우고 서버 함수는 가짜 응답으로 대체한다.
// 실제 Supabase·OpenAI·Toss 에는 요청이 나가지 않는다(모두 가로채서 집계). 사용자 데이터 없음.
// 사용: node flow-smoke.browser.mjs <out 폴더> <port> <결과 폴더>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [,, outDir, portArg, resultDir] = process.argv;
const port = Number(portArg);
fs.mkdirSync(resultDir, { recursive: true });
const here = path.dirname(new URL(import.meta.url).pathname);
const server = spawn('node', [path.join(here, 'spa-server.mjs'), outDir, String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const ORIGIN = `http://127.0.0.1:${port}`;
const STORAGE_KEY = 'sb-zyyhhxyupizcqhxqnxuu-auth-token';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const user = { id: 'user-harness-0001', aud: 'authenticated', role: 'authenticated', email: 'harness@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-01T00:00:00Z' };
const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: now + 36000, iat: now, email: user.email })}.FAKE_SIGNATURE_HARNESS`, refresh_token: 'harness-refresh', token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, user };
const CONV = 'c0ffee00-0000-4000-8000-000000000001';

const results = [];
const record = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });

async function makeContext({ signedIn, handlers }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', isMobile: true, hasTouch: true });
  const counters = { calls: [], forbidden: [], toss: 0 };
  if (signedIn) await ctx.addInitScript(([k, s]) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch { /* 무시 */ } }, [STORAGE_KEY, session]);
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin === ORIGIN) return route.continue();
    if (u.hostname.includes('tosspayments')) { counters.toss += 1; counters.forbidden.push(u.href); return route.abort(); }
    if (u.pathname.startsWith('/auth/v1/')) {
      if (!signedIn) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'no session' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.endsWith('/user') ? user : session) });
    }
    if (u.pathname.startsWith('/functions/v1/')) {
      const fn = u.pathname.split('/')[3];
      let body = {};
      try { body = JSON.parse(req.postData() ?? '{}'); } catch { /* 빈 본문 */ }
      const auth = req.headers()['authorization'] ?? '';
      counters.calls.push({ fn, action: body.action, token: body.token, hasBearer: auth.startsWith('Bearer ') });
      if (!auth.startsWith('Bearer ')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'UNAUTHORIZED', error: '로그인이 필요해요.' }) });
      const h = handlers[fn];
      const res = h ? await h(body, counters) : { status: 200, body: { ok: false, code: 'BAD_REQUEST', error: 'no handler' } };
      return route.fulfill({ status: res.status ?? 200, contentType: 'application/json', body: JSON.stringify(res.body) });
    }
    // 폰트·CDN·이미지: 차단(샌드박스), 집계하지 않음
    return route.abort();
  });
  return { ctx, counters };
}

const gsqUnknown = async () => ({ body: { ok: false, code: 'UNKNOWN_STATE', error: '알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.' } });

// ── S1 비로그인 보호 ──
{
  const { ctx } = await makeContext({ signedIn: false, handlers: {} });
  const page = await ctx.newPage();
  for (const [from, expect] of [[`/payment?c=${CONV}`, '/login'], [`/report?c=${CONV}`, '/login'], [`/step/7?c=${CONV}`, '/login'], ['/admin/mobile', '/admin/login']]) {
    await page.goto(`${ORIGIN}${from}`, { waitUntil: 'load' });
    await page.waitForURL((u) => u.pathname === expect, { timeout: 8000 }).catch(() => {});
    const p = new URL(page.url()).pathname;
    record(`S1 비로그인 ${from} → ${expect}`, p === expect, `actual ${p}`);
  }
  await ctx.close();
}

// ── S2 STEP 7 완료·미결제: White Door 표시, 결제 화면은 '결제 준비 중', 주문·Toss 0건, 리포트 화면은 결제 안내로 ──
{
  const handlers = {
    'get-step-question': gsqUnknown,
    'echo-journey': async (b) => b.action === 'resume'
      ? ({ body: { ok: true, status: 'report_ready', step: 8, conversationId: CONV, hasReport: false, reportEntitled: false } })
      : ({ body: { ok: false, code: 'PAYMENT_REQUIRED', error: '리포트를 열려면 구매 권한이 필요해요.' }, status: 403 }),
    'echo-payment': async () => ({ body: { ok: false, code: 'PAYMENT_NOT_CONFIGURED', error: '현재 결제 서비스를 준비하고 있어요.' } }),
  };
  const { ctx, counters } = await makeContext({ signedIn: true, handlers });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/white-door?c=${CONV}`, { waitUntil: 'load' });
  const wdVisible = await page.getByText('일곱 단계 이야기를').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  record('S2 White Door 는 서버 report_ready 에서만 열림', wdVisible);
  await page.getByRole('button', { name: '리포트 안내 보기' }).click();
  await page.waitForURL((u) => u.pathname === '/payment', { timeout: 8000 }).catch(() => {});
  const pendingBtn = page.getByRole('button', { name: '결제 준비 중' });
  const btnVisible = await pendingBtn.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const btnDisabled = btnVisible ? await pendingBtn.isDisabled() : false;
  const notice = await page.getByText('현재 결제 서비스를 준비하고 있어요').first().isVisible().catch(() => false);
  record('S2 결제 화면: 결제 준비 중 버튼(비활성) + 안내 문구', btnVisible && btnDisabled && notice);
  const copy = await page.getByText('자기이해 리포트 · 1회').first().isVisible().catch(() => false);
  const copy2 = await page.getByText('대화는 무료예요. 리포트를 선택할 때만 한 번 결제해요.').first().isVisible().catch(() => false);
  record('S2 상품·설명 문구 고정본', copy && copy2);
  await pendingBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  const createCalls = counters.calls.filter((c) => c.fn === 'echo-payment').length;
  record('S2 결제 준비 중 버튼을 눌러도 주문 생성·Toss 요청 0건', createCalls === 0 && counters.toss === 0, `echo-payment=${createCalls} toss=${counters.toss}`);
  await page.screenshot({ path: path.join(resultDir, 'S2_payment_pending_390.png') });
  await page.goto(`${ORIGIN}/report?c=${CONV}`, { waitUntil: 'load' });
  await page.waitForURL((u) => u.pathname === '/payment', { timeout: 8000 }).catch(() => {});
  record('S2 미결제 리포트 화면 → 결제 안내로 이동(본문 미노출)', new URL(page.url()).pathname === '/payment');
  const reportCalls = counters.calls.filter((c) => c.fn === 'echo-journey' && c.action === 'report').length;
  record('S2 미결제 상태에서 리포트 생성 요청 0건', reportCalls === 0, `report calls=${reportCalls}`);
  await ctx.close();
}

// ── S3 STEP 7 진행: 조기 White Door 없음, 답변 저장 1회(중복 클릭 방지), 저장 뒤에만 White Door ──
{
  let status = 'step7';
  let answerCalls = 0;
  const handlers = {
    'get-step-question': gsqUnknown,
    'echo-journey': async (b) => {
      if (b.action === 'resume') return { body: status === 'step7'
        ? { ok: true, status: 'step7', step: 7, conversationId: CONV, question: '오늘 이야기에서 남기고 싶은 한 가지는 무엇인가요?', previousAnswer: '조금 여유가 생겼어요', needsQuestion: false }
        : { ok: true, status: 'report_ready', step: 8, conversationId: CONV, hasReport: false, reportEntitled: false } };
      if (b.action === 'answer') {
        answerCalls += 1;
        await new Promise((r) => setTimeout(r, 700));
        status = 'report_ready';
        return { body: { ok: true, status: 'report_ready', step: 8, conversationId: CONV, previousAnswer: b.answer, needsQuestion: false } };
      }
      return { body: { ok: false, code: 'BAD_REQUEST' } };
    },
    'echo-payment': async () => ({ body: { ok: false, code: 'PAYMENT_NOT_CONFIGURED' } }),
  };
  const { ctx, counters } = await makeContext({ signedIn: true, handlers });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/white-door?c=${CONV}`, { waitUntil: 'load' });
  await page.waitForURL((u) => u.pathname === '/step/7', { timeout: 8000 }).catch(() => {});
  record('S3 STEP 7 저장 전 White Door 직접 진입 → /step/7 로 되돌림', new URL(page.url()).pathname === '/step/7');
  const q = await page.getByText('오늘 이야기에서 남기고 싶은 한 가지는 무엇인가요?').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  record('S3 STEP 7 화면에 서버 질문 표시', q);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  record('S3 390px STEP 화면 가로 스크롤 0', scrollW);
  await page.getByPlaceholder('자유롭게 적어보세요.').fill('오늘은 서두르지 않아도 된다는 걸 남기고 싶어요');
  const finish = page.getByRole('button', { name: '이야기 마무리하기' });
  await finish.click();
  await finish.click({ force: true }).catch(() => {});
  await finish.click({ force: true }).catch(() => {});
  await page.waitForURL((u) => u.pathname === '/white-door', { timeout: 10000 }).catch(() => {});
  record('S3 답변 저장 후에만 White Door 로 이동', new URL(page.url()).pathname === '/white-door');
  record('S3 연속 3회 클릭에도 answer 요청 1건', answerCalls === 1, `answer calls=${answerCalls}`);
  const withToken = counters.calls.filter((c) => c.action === 'answer').every((c) => typeof c.token === 'string' && c.token.length >= 8);
  record('S3 answer 요청에 요청 토큰 포함', withToken);
  record('S3 무료 STEP 진행 중 결제 함수 호출 0건', counters.calls.filter((c) => c.fn === 'echo-payment').length === 0 && counters.toss === 0);
  await ctx.close();
}

// ── S4 저장 실패 → 원문 보존 → 재시도 시 같은 토큰 ──
{
  const tokens = [];
  let fail = true;
  let saved = false; // 서버 상태: 답변 저장 전 step5, 저장 뒤 step6(질문 없음 → ask 로 생성)
  const handlers = {
    'get-step-question': gsqUnknown,
    'echo-journey': async (b) => {
      if (b.action === 'resume') return { body: saved
        ? { ok: true, status: 'step6', step: 6, conversationId: CONV, question: '', previousAnswer: '퇴근하고 집에 오는 길에요', needsQuestion: true }
        : { ok: true, status: 'step5', step: 5, conversationId: CONV, question: '그 여유가 어떤 때 가장 크게 느껴지나요?', previousAnswer: '', needsQuestion: false } };
      if (b.action === 'answer') {
        tokens.push(b.token);
        if (fail) { fail = false; return { body: { ok: false, code: 'ERROR', error: '저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.' } }; }
        saved = true;
        return { body: { ok: true, status: 'step6', step: 6, conversationId: CONV, previousAnswer: b.answer, needsQuestion: true } };
      }
      if (b.action === 'ask') return { body: { ok: true, status: 'step6', step: 6, conversationId: CONV, question: '그 여유를 위해 오늘 고른 작은 선택은 무엇인가요?', previousAnswer: '', needsQuestion: false } };
      return { body: { ok: false, code: 'BAD_REQUEST' } };
    },
  };
  const { ctx } = await makeContext({ signedIn: true, handlers });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/step/5?c=${CONV}`, { waitUntil: 'load' });
  await page.getByText('그 여유가 어떤 때 가장 크게 느껴지나요?').first().waitFor({ timeout: 10000 });
  const text = '퇴근하고 집에 오는 길에요';
  await page.getByPlaceholder('자유롭게 적어보세요.').fill(text);
  await page.getByRole('button', { name: '답변 저장하고 다음으로' }).click();
  const errShown = await page.getByText('저장에 실패했어요').first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  const kept = (await page.getByPlaceholder('자유롭게 적어보세요.').inputValue()) === text;
  record('S4 저장 실패 시 오류 표시 + 입력 원문 보존', errShown && kept);
  await page.getByRole('button', { name: '답변 저장하고 다음으로' }).click();
  await page.waitForURL((u) => u.pathname === '/step/6', { timeout: 10000 }).catch(() => {});
  record('S4 재시도 성공 → /step/6 (서버 상태로만 이동)', new URL(page.url()).pathname === '/step/6');
  record('S4 재시도는 같은 요청 토큰(중복 저장 방지)', tokens.length === 2 && tokens[0] === tokens[1], `tokens=${tokens.length}`);
  const q6 = await page.getByText('그 여유를 위해 오늘 고른 작은 선택은 무엇인가요?').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  record('S4 새 단계 질문은 별도 ask 로 생성돼 표시', q6);
  await ctx.close();
}

// ── S5 기존 구매자: 리포트 재열람, 결제 화면은 리포트로 직행, 재결제 0 ──
{
  const report = { id: 'r1', title: '오늘의 여유를 이해하는 기록', summary: '나는 여유를 중요하게 느꼈어요.', content: { title: '오늘의 여유를 이해하는 기록', summary: '나는 여유를 중요하게 느꼈어요.', sections: [{ heading: '지금의 마음', body: '나는 오늘 여유롭다고 직접 말했어요.', status: 'confirmed' }, { heading: '내가 중요하게 여긴 것', body: '서두르지 않는 속도.', status: 'confirmed' }, { heading: '살펴볼 것', body: '이 여유를 이어갈 방법은 아직 후보예요.', status: 'candidate' }], next_step: '오늘 여유로웠던 이유를 한 줄로 남겨볼 수 있어요.' }, created_at: '2026-09-16T00:00:00Z' };
  const handlers = {
    'get-step-question': gsqUnknown,
    'echo-journey': async (b) => b.action === 'resume'
      ? ({ body: { ok: true, status: 'report_done', step: 8, conversationId: CONV, hasReport: true, reportEntitled: true, report } })
      : ({ body: { ok: false, code: 'BAD_REQUEST' } }),
    'echo-payment': async () => ({ body: { ok: false, code: 'PAYMENT_NOT_CONFIGURED' } }),
  };
  const { ctx, counters } = await makeContext({ signedIn: true, handlers });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/report?c=${CONV}`, { waitUntil: 'load' });
  const shown = await page.getByText('오늘의 여유를 이해하는 기록').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  record('S5 기존 구매자 리포트 재열람', shown);
  await page.screenshot({ path: path.join(resultDir, 'S5_report_390.png') });
  await page.goto(`${ORIGIN}/payment?c=${CONV}`, { waitUntil: 'load' });
  await page.waitForURL((u) => u.pathname === '/report', { timeout: 8000 }).catch(() => {});
  record('S5 구매자가 결제 화면에 들어와도 리포트로 직행(재결제 없음)', new URL(page.url()).pathname === '/report' && counters.calls.filter((c) => c.fn === 'echo-payment').length === 0);
  await ctx.close();
}

// ── S6 모바일 폭(Android·iPhone 크기, Chromium 엔진) : 여정 화면 가로 스크롤 0·버튼 화면 안·입력칸 글자 16px ──
{
  const devices = [
    { name: 'Galaxy S24 390', width: 390, height: 844, dpr: 3, ua: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' },
    { name: 'Galaxy 360', width: 360, height: 780, dpr: 3, ua: 'Mozilla/5.0 (Linux; Android 13; SM-A546S) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' },
    { name: 'iPhone 15 393', width: 393, height: 852, dpr: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
    { name: 'iPhone SE 375', width: 375, height: 667, dpr: 2, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' },
    { name: 'iPhone 15 Pro Max 430', width: 430, height: 932, dpr: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  ];
  const handlers = {
    'get-step-question': gsqUnknown,
    'echo-journey': async (b) => b.action === 'resume'
      ? ({ body: { ok: true, status: 'step7', step: 7, conversationId: CONV, question: '오늘 이야기에서 남기고 싶은 한 가지는 무엇인가요?', previousAnswer: '조금 여유가 생겼어요', needsQuestion: false } })
      : ({ body: { ok: false, code: 'BAD_REQUEST' } }),
    'echo-payment': async () => ({ body: { ok: false, code: 'PAYMENT_NOT_CONFIGURED' } }),
  };
  for (const d of devices) {
    const ctx = await browser.newContext({ viewport: { width: d.width, height: d.height }, deviceScaleFactor: d.dpr, isMobile: true, hasTouch: true, locale: 'ko-KR', userAgent: d.ua });
    await ctx.addInitScript(([k, s]) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch { /* 무시 */ } }, [STORAGE_KEY, session]);
    await ctx.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.origin === ORIGIN) return route.continue();
      if (u.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.endsWith('/user') ? user : session) });
      if (u.pathname.startsWith('/functions/v1/')) {
        const fn = u.pathname.split('/')[3];
        let body = {};
        try { body = JSON.parse(route.request().postData() ?? '{}'); } catch { /* 빈 본문 */ }
        const res = handlers[fn] ? await handlers[fn](body) : { body: { ok: false } };
        return route.fulfill({ status: res.status ?? 200, contentType: 'application/json', body: JSON.stringify(res.body) });
      }
      return route.abort();
    });
    const page = await ctx.newPage();
    const checks = [];
    for (const [pathname, ready] of [[`/step/7?c=${CONV}`, '오늘 이야기에서 남기고 싶은'], ['/weather-check', '마음'], [`/white-door?c=${CONV}`, 'STEP 7']]) {
      await page.goto(`${ORIGIN}${pathname}`, { waitUntil: 'load' });
      await page.getByText(ready).first().waitFor({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const btns = [...document.querySelectorAll('button, a[href]')].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
        const off = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).length;
        const inputs = [...document.querySelectorAll('textarea, input')].map((el) => parseFloat(getComputedStyle(el).fontSize));
        const root = document.querySelector('section, main, #root > div');
        return { scrollOk: de.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth, offscreenButtons: off, inputFontMin: inputs.length ? Math.min(...inputs) : null, minH: root ? getComputedStyle(root).minHeight : null, path: location.pathname };
      });
      checks.push({ pathname: m.path, ...m });
    }
    const ok = checks.every((c) => c.scrollOk && c.offscreenButtons === 0 && (c.inputFontMin === null || c.inputFontMin >= 16));
    record(`S6 ${d.name}px 여정 화면 3종: 가로 스크롤 0·버튼 화면 안·입력 16px`, ok, JSON.stringify(checks.map((c) => `${c.pathname}:scroll=${c.scrollOk},off=${c.offscreenButtons},font=${c.inputFontMin}`)));
    await page.goto(`${ORIGIN}/step/7?c=${CONV}`, { waitUntil: 'load' });
    await page.getByText('오늘 이야기에서 남기고 싶은').first().waitFor({ timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: path.join(resultDir, `S6_${d.width}_step7.png`) });
    await ctx.close();
  }
}

await browser.close();
server.kill();
fs.writeFileSync(path.join(resultDir, 'flow-smoke_results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass).length;
console.log(`\nSMOKE TOTAL pass=${results.length - failed} fail=${failed}`);
process.exit(failed ? 1 : 0);
