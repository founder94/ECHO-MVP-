// 홈 → /start → DO IT 선택 → /do-it/landing 09 구간 클릭 경로 + 홈 BGM 범위 검사 (로컬 · 실제 앱 빌드 · 대표 원음 로컬 제공)
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const [outDir, evidenceDir] = process.argv.slice(2); const PORT = 4180; const ORIGIN = `http://127.0.0.1:${PORT}`; const HERE = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(evidenceDir, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, '..', 'harness', 'spa-server.mjs'), outDir, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] }); await new Promise((r) => server.stdout.once('data', r));
const AUDIO = { 1: fs.readFileSync(process.env.AUDIO_1), 2: fs.readFileSync(process.env.AUDIO_2) }; const T1 = '80bd6071-35bc-4ca9-898c-cc7f3d8adc51', T2 = '7bd42734-8e58-4474-8eed-08f21c108a30';
const counters = { track1: 0, track2: 0, youtubeAttempt: 0, supabase: 0, openMeteo: 0, other: 0 }; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' });
await ctx.addInitScript(() => { const Orig = window.Audio; window.__audios = []; const W = function (src) { const a = src === undefined ? new Orig() : new Orig(src); window.__audios.push(a); return a; }; W.prototype = Orig.prototype; window.Audio = W; });
await ctx.route('**/*', async (route) => { const u = new URL(route.request().url()); if (u.origin === ORIGIN) return route.continue();
  if (u.host === 'storage.helloreaddy.io' && u.pathname.endsWith('.mp3')) { const n = u.pathname.includes(T1) ? 1 : u.pathname.includes(T2) ? 2 : 0; if (!n) return route.abort(); counters[`track${n}`]++; const buf = AUDIO[n]; const range = route.request().headers()['range']; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = Number(m[1]); const e = m[2] ? Number(m[2]) : buf.length - 1; return route.fulfill({ status: 206, headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${buf.length}`, 'content-length': String(e - s + 1) }, body: buf.subarray(s, e + 1) }); } return route.fulfill({ status: 200, headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' }, body: buf }); }
  if (u.host.endsWith('youtube.com') || u.host.endsWith('ytimg.com')) counters.youtubeAttempt++; else if (u.host.endsWith('.supabase.co')) counters.supabase++; else if (u.host.includes('open-meteo')) counters.openMeteo++; else counters.other++;
  return route.abort('blockedbyclient'); });
setTimeout(() => { console.log('WATCHDOG: 160s 초과 → 강제 종료'); process.exit(3); }, 160000).unref();
const page = await ctx.newPage(); const results = []; const rec = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const A = () => page.evaluate(() => { const a = window.__audios; const x = a[a.length - 1]; return { n: a.length, src: x ? x.src : '', ct: x ? x.currentTime : -1, paused: x ? x.paused : true }; });
// 1) 홈
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' }); await wait(1500); await page.screenshot({ path: path.join(evidenceDir, 'path_01_home.png') });
const homeBgmContainer = await page.locator('#youtube-music-player').count(); const homeBgmBtn = await page.getByRole('button', { name: /음악 (켜기|끄기)/ }).count();
rec('홈: BGM 플레이어 컨테이너·토글 버튼 존재(YouTube 스크립트는 로컬에서 차단 → 실제 재생 없음)', homeBgmContainer === 1 && homeBgmBtn === 1, `container=${homeBgmContainer} btn=${homeBgmBtn} ytAttempt=${counters.youtubeAttempt}`);
// 2) 시작하기 → /start
console.log('step: home → /start'); try { await page.getByRole('link', { name: '시작하기', exact: true }).click({ timeout: 15000 }); await page.waitForURL('**/start', { timeout: 10000 }); } catch (e) { console.log('click 시작하기 실패:', String(e).slice(0, 160)); } await wait(800); await page.screenshot({ path: path.join(evidenceDir, 'path_02_start.png') });
rec('홈 "시작하기" → /start 이동', new URL(page.url()).pathname === '/start');
// 3) DO IT 선택 → /do-it/landing
console.log('step: /start → DO IT'); try { await page.getByRole('button', { name: /DO IT 시작하기/ }).click({ timeout: 15000 }); await page.waitForURL('**/do-it/landing', { timeout: 10000 }); } catch (e) { console.log('click DO IT 실패:', String(e).slice(0, 160)); } await wait(1200);
rec('DO IT 선택 → /do-it/landing 이동', new URL(page.url()).pathname === '/do-it/landing');
const bgmAfter = await page.locator('#youtube-music-player').count(); const iframes = await page.locator('iframe').count();
rec('랜딩 진입 후 홈 BGM 컴포넌트 언마운트(컨테이너 0·iframe 0) — 실제 YouTube 정지는 로컬에서 검증 불가', bgmAfter === 0 && iframes === 0, `container=${bgmAfter} iframe=${iframes}`);
// 4) 09 구간 카드 → 원음 1 재생
const card = page.locator('div').filter({ hasText: 'DO IT 오리지널 음악' }).filter({ hasText: '이어 듣기' }).last(); await card.scrollIntoViewIfNeeded(); await wait(1200);
const startBtn = page.getByRole('button', { name: /시작하기/ }).last(); const sb = await startBtn.boundingBox(); const cb = await card.boundingBox();
rec('09 구간: 시작하기 버튼 아래 카드 1개', (await page.getByText('DO IT 오리지널 음악').count()) === 1 && cb.y > sb.y + sb.height - 1, `btnBottom=${Math.round(sb.y + sb.height)} cardTop=${Math.round(cb.y)}`);
let s0 = await A(); rec('클릭 경로 진입 시 자동 재생 없음(요청 0)', s0.paused && counters.track1 === 0 && counters.track2 === 0);
await page.getByRole('button', { name: '원음 1', exact: true }).click(); let s1; for (let i = 0; i < 80; i++) { await wait(100); s1 = await A(); if (!s1.paused && s1.ct > 0.15) break; } await wait(700); const s2 = await A();
rec('클릭 경로에서 원음 1 재생(대표 원음) · 시간 증가', !s1.paused && s2.ct > s1.ct && s1.src.includes(T1), `ct ${s1.ct.toFixed(2)}→${s2.ct.toFixed(2)}`);
await page.screenshot({ path: path.join(evidenceDir, 'path_03_landing09_playing.png') });
// 5) 09 "시작하기" 로 이탈 → 카드 정지
try { await startBtn.click({ timeout: 10000 }); } catch (e) { console.log('click 09 시작하기 실패:', String(e).slice(0, 120)); } await wait(1200); const after = await page.evaluate(() => (window.__audios || []).map((a) => a.paused));
rec('09 "시작하기" 로 이탈 → 카드 Audio 정지', new URL(page.url()).pathname !== '/do-it/landing' && after.every(Boolean), `→ ${new URL(page.url()).pathname} paused=${JSON.stringify(after)}`);
// 6) 홈으로 복귀 → BGM 컨테이너 재마운트(YouTube 차단이라 재생 여부 판단 불가)
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' }); await wait(800);
rec('홈 복귀: BGM 컴포넌트 재마운트 · 카드 Audio 새로 만들지 않음', (await page.locator('#youtube-music-player').count()) === 1 && (await page.evaluate(() => (window.__audios || []).length)) === 0);
await browser.close(); server.kill();
const fails = results.filter((r) => !r.p).length; fs.writeFileSync(path.join(evidenceDir, 'click_path_report.json'), JSON.stringify({ at: new Date().toISOString(), counters, results, scope: '홈 BGM 실제 재생·정지는 YouTube 차단으로 미검증(컴포넌트 마운트/언마운트만 확인)' }, null, 2));
console.log('counters', JSON.stringify(counters)); console.log(`RESULT: ${fails ? 'FAIL' : 'CLICK PATH VERIFIED'} (${results.length - fails}/${results.length})`); process.exit(fails ? 1 : 0);
