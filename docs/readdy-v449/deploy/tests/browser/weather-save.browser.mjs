// 패치 D 실제 화면 검사: /weather-check 저장 → 서버 지연(무응답) → 30초 시간 초과 문구·입력 보존·버튼 복귀 → 재클릭 busy(요청 0건 추가) → 서버 응답 후 같은 토큰 재시도 → 이동
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const [outDir, evidenceDir] = process.argv.slice(2); const PORT = 4181; const ORIGIN = `http://127.0.0.1:${PORT}`; const HERE = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(evidenceDir, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, 'spa-server.mjs'), outDir, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] }); await new Promise((r) => server.stdout.once('data', r));
const REF = 'zyyhhxyupizcqhxqnxuu'; const KEY = `sb-${REF}-auth-token`; const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const now = Math.floor(Date.now() / 1000);
const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'harness@example.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = { access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: user.id, role: 'authenticated', exp: now + 36000 })}.FAKE`, refresh_token: 'x', token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, user };
const starts = []; let mode = 'hang'; const pending = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([k, s]) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch {} }, [KEY, session]);
await ctx.route('**/*', async (route) => { const u = new URL(route.request().url()); if (u.origin === ORIGIN) return route.continue();
  if (u.host === `${REF}.supabase.co` && u.pathname === '/functions/v1/get-step-question') { if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' }, body: 'ok' });
    let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch {} if (body.action === 'start') { starts.push({ token: body.token, t: Date.now() }); if (mode === 'hang') { pending.push(route); return; } return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, status: 'step1', step: 1, conversationId: 'conv-1', question: 'Q' }) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, status: 'step1', conversationId: 'conv-1', question: 'Q' }) }); }
  if (u.host === `${REF}.supabase.co` && u.pathname.startsWith('/rest/v1/profiles')) return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  return route.abort('blockedbyclient'); });
const page = await ctx.newPage(); const results = []; const rec = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
await page.goto(`${ORIGIN}/weather-check`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const ta = page.locator('textarea'); await ta.fill('화창해'); const btn = page.getByRole('button', { name: /이대로 이야기 시작하기|저장 중/ });
await btn.click(); await page.waitForTimeout(1500);
rec('클릭 → 저장 중 표시·서버 start 요청 1회', (await page.getByText('저장 중...').count()) === 1 && starts.length === 1, `starts=${starts.length}`);
await page.waitForTimeout(31_000);
const msg = await page.getByText('응답이 늦어지고 있어요').count();
rec('30초 뒤: 시간 초과 문구 표시 · 저장 중 종료 · 입력 보존', msg === 1 && (await page.getByText('저장 중...').count()) === 0 && (await ta.inputValue()) === '화창해', `msg=${msg}`);
await page.screenshot({ path: path.join(evidenceDir, 'weather_save_01_timeout.png') });
await page.getByRole('button', { name: '이대로 이야기 시작하기' }).click(); await page.waitForTimeout(800);
rec('서버 무응답 중 재클릭: busy 문구 · 새 start 요청 0건(중복 방지)', (await page.getByText('이전 저장 요청을 아직 처리하고 있어요').count()) === 1 && starts.length === 1, `starts=${starts.length}`);
// 서버가 늦게 실패로 응답 → 재시도 허용 → 같은 토큰으로 재시도 → 성공 응답 → 이동
mode = 'ok'; for (const r of pending.splice(0)) await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: false, code: 'AI_ERROR', error: 'AI 응답을 받지 못했어요.' }) });
await page.waitForTimeout(800);
rec('늦은 첫 응답(실패)은 화면을 바꾸지 않음(직전 busy 문구 그대로 · 경로 유지 · 입력 보존)', (await page.getByText('이전 저장 요청을 아직 처리하고 있어요').count()) === 1 && (await page.getByText('AI 응답을 받지 못했어요').count()) === 0 && new URL(page.url()).pathname === '/weather-check' && (await ta.inputValue()) === '화창해');
await page.getByRole('button', { name: '이대로 이야기 시작하기' }).click(); await page.waitForURL('**/story-start**', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(500);
rec('재시도: 같은 토큰으로 start 2회째 전송 → 성공 → 다음 화면 이동', starts.length === 2 && starts[0].token === starts[1].token && /^[A-Za-z0-9-]{8,64}$/.test(starts[1].token) && new URL(page.url()).pathname !== '/weather-check', `path=${new URL(page.url()).pathname} sameToken=${starts.length === 2 && starts[0].token === starts[1].token}`);
await browser.close(); server.kill();
const fails = results.filter((r) => !r.p).length; fs.writeFileSync(path.join(evidenceDir, 'weather_save_report.json'), JSON.stringify({ at: new Date().toISOString(), results, starts: starts.map((s) => ({ tokenLen: s.token.length })) }, null, 2));
console.log(`RESULT: ${fails ? 'FAIL' : 'PATCH D VERIFIED'} (${results.length - fails}/${results.length})`); process.exit(fails ? 1 : 0);
