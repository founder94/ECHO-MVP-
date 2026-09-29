import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const [outDir, evidenceDir] = process.argv.slice(2); const PORT = 4182; const ORIGIN = `http://127.0.0.1:${PORT}`; const HERE = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(evidenceDir, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'spa-server.mjs'), outDir, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] }); await new Promise((r) => server.stdout.once('data', r));
const REF = 'zyyhhxyupizcqhxqnxuu'; const KEY = `sb-${REF}-auth-token`; const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const now = Math.floor(Date.now() / 1000);
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'harness@example.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: user.id, role: 'authenticated', exp: now + 36000 })}.FAKE`, refresh_token: 'x', token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, user };
let mode = 'ok'; const starts = []; const pending = []; const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' }); const results = []; const rec = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
async function newPage() { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(([k, s]) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch {} }, [KEY, session]);
  await ctx.route('**/*', async (route) => { const u = new URL(route.request().url()); if (u.origin === ORIGIN) return route.continue();
    if (u.host === `${REF}.supabase.co` && u.pathname === '/functions/v1/get-step-question') { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: H, body: 'ok' }); let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch {} if (body.action !== 'start') return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: '{"ok":true,"status":"step1","conversationId":"c"}' }); starts.push(body.token);
      if (mode === '401') return route.fulfill({ status: 401, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: false, code: 'UNAUTHORIZED', error: '로그인이 필요해요.' }) });
      if (mode === '429') return route.fulfill({ status: 429, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: false, code: 'RATE_LIMITED', error: '잠시 후 다시 시도해 주세요.' }) });
      if (mode === '200fail') return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: false, code: 'AI_ERROR', error: 'AI 응답을 받지 못했어요.' }) });
      if (mode === 'hang') { pending.push(route); return; }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: true, status: 'step1', step: 1, conversationId: 'conv-1', question: 'Q' }) }); }
    if (u.host === `${REF}.supabase.co` && u.pathname.startsWith('/rest/v1/profiles')) return route.fulfill({ status: 201, contentType: 'application/json', headers: H, body: '[]' });
    return route.abort('blockedbyclient'); });
  const page = await ctx.newPage(); await page.goto(`${ORIGIN}/weather-check`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600); return { ctx, page }; }
const submit = async (page, text = '화창해') => { await page.locator('textarea').fill(text); await page.getByRole('button', { name: '이대로 이야기 시작하기' }).click(); await page.waitForTimeout(1200); };
// 1) 정상
{ mode = 'ok'; const { ctx, page } = await newPage(); await submit(page); await page.waitForURL('**/story-start**', { timeout: 8000 }).catch(() => {}); rec('정상: 200+ok:true → /story-start 이동', new URL(page.url()).pathname === '/story-start'); await ctx.close(); }
// 2) 200 + ok:false
{ mode = '200fail'; const { ctx, page } = await newPage(); await submit(page); rec('HTTP200+ok:false(AI_ERROR): 이동 없음 · 오류 문구 · 입력 보존 · 저장 중 종료', new URL(page.url()).pathname === '/weather-check' && (await page.getByText('AI 응답을 받지 못했어요.').count()) === 1 && (await page.locator('textarea').inputValue()) === '화창해' && (await page.getByText('저장 중...').count()) === 0); await ctx.close(); }
// 3) 401
{ mode = '401'; const { ctx, page } = await newPage(); await submit(page); await page.waitForTimeout(800); rec('HTTP401(요청 도중 인증 만료): 무한 대기 없음 · "로그인이 필요해요." 문구 · 입력 보존 (현행: 문구 표시, 자동 이동 없음)', (await page.getByText('로그인이 필요해요.').count()) === 1 && (await page.getByText('저장 중...').count()) === 0 && (await page.locator('textarea').inputValue()) === '화창해'); await ctx.close(); }
// 4) 429
{ mode = '429'; const { ctx, page } = await newPage(); await submit(page); rec('HTTP429 RATE_LIMITED: 안내 문구 · 이동 없음 · 입력 보존', new URL(page.url()).pathname === '/weather-check' && (await page.getByText('잠시 후 다시 시도해 주세요.').count()) === 1 && (await page.locator('textarea').inputValue()) === '화창해'); await ctx.close(); }
// 5) 이탈: 서버 무응답 중 뒤로가기 → 늦은 응답 도착해도 오류 없음(콘솔 에러 0)
{ mode = 'hang'; const { ctx, page } = await newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); await submit(page); await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' }); for (const r of pending.splice(0)) await r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ ok: true, status: 'step1', conversationId: 'late' }) }); await page.waitForTimeout(800); rec('이탈 후 늦은 응답: 페이지 오류 0 · 강제 이동 없음', errs.length === 0 && new URL(page.url()).pathname === '/'); await ctx.close(); }
await browser.close(); server.kill(); const fails = results.filter((r) => !r.p).length; fs.writeFileSync(path.join(evidenceDir, 'weather_save_errors_report.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2)); console.log(`RESULT: ${fails ? 'FAIL' : 'ERROR PATHS VERIFIED'} (${results.length - fails}/${results.length})`); process.exit(fails ? 1 : 0);
