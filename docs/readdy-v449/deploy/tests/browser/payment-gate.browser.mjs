// 결제 비활성(review_pending) 배포 산출물 브라우저 검증 하네스 (로컬 전용 · 운영 서버에 요청 0)
// 사용: node payment-gate.browser.mjs <extracted-out-dir> <evidence-dir>
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const [outDir, evidenceDir] = process.argv.slice(2); const PORT = 4173; const ORIGIN = `http://127.0.0.1:${PORT}`;
const REF = 'zyyhhxyupizcqhxqnxuu'; const STORAGE_KEY = `sb-${REF}-auth-token`; const CONV = 'harness-conv-0001';
fs.mkdirSync(evidenceDir, { recursive: true });
const server = spawn(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'spa-server.mjs'), outDir, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => server.stdout.once('data', r));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'harness@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: now + 36000, iat: now, email: user.email })}.FAKE_SIGNATURE_HARNESS`, refresh_token: 'harness-refresh', token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, user };
const counters = { createOrder: 0, confirmPayment: 0, tossSdkLoad: 0, tossGlobalAccess: 0, echoPaymentAny: 0, resume: 0, profilesUpsert: 0, authCalls: 0, staticCdn: 0, otherExternal: 0 };
// index.html 의 폰트·아이콘 CSS CDN(래디 원본 디자인 자산). 오프라인 검증이라 차단하되 금지 요청으로 세지 않는다.
const STATIC_CDN = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net']);
const log = []; const consoleErrors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' });
await ctx.addInitScript(([k, s]) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch {} ; let n = 0; Object.defineProperty(window, 'TossPayments', { configurable: true, get() { n++; window.__tossAccess = n; return undefined; }, set() {} }); }, [STORAGE_KEY, session]);
await ctx.route('**/*', async (route) => {
  const req = route.request(); const url = req.url(); const u = new URL(url);
  if (u.origin === ORIGIN) return route.continue();
  let body = ''; try { body = req.postData() || ''; } catch {}
  let action = ''; try { action = JSON.parse(body || '{}').action || ''; } catch {}
  log.push(`${req.method()} ${u.host}${u.pathname}${action ? ' action=' + action : ''}`);
  if (u.host === 'js.tosspayments.com' || u.host.endsWith('.tosspayments.com')) { counters.tossSdkLoad++; return route.abort('blockedbyclient'); }
  if (u.host === `${REF}.supabase.co`) {
    if (u.pathname === '/functions/v1/echo-payment') { counters.echoPaymentAny++; if (action === 'create') counters.createOrder++; if (action === 'confirm') counters.confirmPayment++; return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'HARNESS_FORBIDDEN_REQUEST' }) }); }
    if (u.pathname === '/functions/v1/get-step-question') { if (action === 'resume') counters.resume++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'white_door_ready', conversationId: CONV }) }); }
    if (u.pathname.startsWith('/rest/v1/profiles')) { counters.profilesUpsert++; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    if (u.pathname.startsWith('/auth/v1/')) { counters.authCalls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.endsWith('/user') ? user : session) }); }
  }
  if (STATIC_CDN.has(u.host)) { counters.staticCdn++; return route.abort('blockedbyclient'); }
  counters.otherExternal++; return route.abort('blockedbyclient');
});
const page = await ctx.newPage(); page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_BLOCKED_BY_CLIENT')) consoleErrors.push(m.text().slice(0, 200)); }); page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
const results = []; const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const snap = (n) => page.screenshot({ path: path.join(evidenceDir, n), fullPage: true });
// ── 1) /payment 직접 진입
await page.goto(`${ORIGIN}/payment?c=${CONV}`, { waitUntil: 'networkidle' });
const btn = page.getByRole('button', { name: '결제 준비 중' });
await btn.waitFor({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(900); await snap('payment-pending_01_payment.png');
const bodyText = await page.locator('body').innerText();
rec('/payment: 4,900원 표시', bodyText.includes('4,900원'));
rec('/payment: 안내 문구 표시', bodyText.includes('현재 결제 서비스를 준비하고 있어요.') && bodyText.includes('결제는 아직 진행되지 않습니다.'));
rec('/payment: 버튼 라벨 "결제 준비 중" + disabled', (await btn.count()) === 1 && (await btn.isDisabled()), `count=${await btn.count()}`);
rec('/payment: 활성 결제 버튼("4,900원으로 이야기 이어가기") 없음', !bodyText.includes('으로 이야기 이어가기'));
rec('/payment: resume 호출 1회(서버 상태 확인은 정상 경로)', counters.resume === 1, `resume=${counters.resume}`);
// 비활성 버튼 강제 클릭 3종(마우스 force / el.click() / dispatchEvent)
await btn.click({ force: true }).catch(() => {}); await btn.evaluate((el) => { el.click(); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await page.waitForTimeout(800);
rec('/payment: 강제 클릭 후 주문 생성 요청 0', counters.createOrder === 0, `createOrder=${counters.createOrder}`);
rec('/payment: Toss SDK 로드 시도 0', counters.tossSdkLoad === 0, `sdkLoad=${counters.tossSdkLoad}`);
const tossAccess = await page.evaluate(() => window.__tossAccess || 0);
rec('/payment: window.TossPayments 접근(=requestPayment 경로) 0', tossAccess === 0, `access=${tossAccess}`);
// 새로고침 안정성
await page.reload({ waitUntil: 'networkidle' }); await btn.waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(500);
rec('/payment: 새로고침 후 동일 화면(버튼 disabled)', (await btn.count()) === 1 && (await btn.isDisabled()));
// 뒤로가기 버튼
await page.getByRole('button', { name: '조금 더 생각해 볼게요' }).click(); await page.waitForTimeout(600);
const backUrl = new URL(page.url()); rec('/payment: "조금 더 생각해 볼게요" → 이전 장면 이동', backUrl.pathname !== '/payment', `→ ${backUrl.pathname}${backUrl.search}`);
await snap('payment-pending_02_back.png');
// ── 2) /payment/success TEST ONLY 파라미터 직접 진입
const before = { ...counters };
await page.goto(`${ORIGIN}/payment/success?c=${CONV}&paymentKey=TEST_ONLY_HARNESS&orderId=TEST_ONLY_HARNESS&amount=4900`, { waitUntil: 'networkidle' });
await page.getByText('결제가 확인되지 않았어요.').waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(900); await snap('payment-pending_03_success.png');
const sText = await page.locator('body').innerText();
rec('/payment/success: "결제가 확인되지 않았어요." + 준비 중 안내', sText.includes('결제가 확인되지 않았어요.') && sText.includes('현재 결제 서비스를 준비하고 있어요.'));
rec('/payment/success: confirmPayment 요청 0', counters.confirmPayment === before.confirmPayment && counters.confirmPayment === 0, `confirm=${counters.confirmPayment}`);
rec('/payment/success: echo-payment 함수 호출 전체 0', counters.echoPaymentAny === 0, `any=${counters.echoPaymentAny}`);
rec('/payment/success: STEP 3 으로 이동하지 않음(paid 생성 없음)', new URL(page.url()).pathname === '/payment/success');
await page.reload({ waitUntil: 'networkidle' }); await page.getByText('결제가 확인되지 않았어요.').waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(400);
rec('/payment/success: 새로고침 후 동일(승인 요청 0 유지)', counters.confirmPayment === 0 && (await page.getByText('결제가 확인되지 않았어요.').count()) === 1);
await page.getByRole('button', { name: '다시 결제하기' }).click(); await btn.waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(400);
rec('/payment/success: "다시 결제하기" → /payment 로 복귀(여전히 disabled)', new URL(page.url()).pathname === '/payment' && (await btn.isDisabled()));
// ── 3) 세션 없이 직접 진입 → 로그인 이동
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx2.route('**/*', (r) => (new URL(r.request().url()).origin === ORIGIN ? r.continue() : r.abort()));
const p2 = await ctx2.newPage(); await p2.goto(`${ORIGIN}/payment?c=${CONV}`, { waitUntil: 'networkidle' }); await p2.waitForTimeout(800);
rec('/payment 비로그인 직접 진입 → /login 이동', new URL(p2.url()).pathname === '/login', `→ ${new URL(p2.url()).pathname}`); await ctx2.close();
await browser.close(); server.kill();
const failCount = results.filter((r) => !r.pass).length;
const report = { at: new Date().toISOString(), outDir, counters, tossGlobalAccess: tossAccess, externalRequests: log, consoleErrors, results, RESULT: failCount === 0 && counters.createOrder === 0 && counters.confirmPayment === 0 && counters.tossSdkLoad === 0 && counters.otherExternal === 0 ? 'BROWSER VERIFIED' : 'BROWSER FAIL' };
fs.writeFileSync(path.join(evidenceDir, 'payment-pending_browser_report.json'), JSON.stringify(report, null, 2));
console.log('\ncounters', JSON.stringify(counters)); console.log('external requests:', log.length); log.forEach((l) => console.log('  ', l)); console.log('console errors:', consoleErrors.length); consoleErrors.forEach((e) => console.log('  ', e)); console.log('\nRESULT:', report.RESULT); process.exit(failCount === 0 ? 0 : 1);
