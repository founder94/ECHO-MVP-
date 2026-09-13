// A 음악 카드 실제 브라우저 검사 (로컬 전용). 원음 대신 합성 대체음(stub) 사용 — 재생 로직 검사이며 원음·청취 검사가 아님.
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/package.json')('playwright');
const [outDir, evidenceDir] = process.argv.slice(2); const PORT = 4175; const ORIGIN = `http://127.0.0.1:${PORT}`; const HERE = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(evidenceDir, { recursive: true });
const server = spawn(process.execPath, [path.join(HERE, '..', 'harness', 'spa-server.mjs'), outDir, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] }); await new Promise((r) => server.stdout.once('data', r));
const STUB = { 1: fs.readFileSync(path.join(HERE, 'stub-1.mp3')), 2: fs.readFileSync(path.join(HERE, 'stub-2.mp3')) };
const T1 = '80bd6071-35bc-4ca9-898c-cc7f3d8adc51', T2 = '7bd42734-8e58-4474-8eed-08f21c108a30';
const audioMode = { delayMs: 0, failTrack2Once: false }; const counters = { track1: 0, track2: 0, youtube: 0, supabase: 0, otherExternal: 0, staticCdn: 0 }; const ext = [];
const STATIC_CDN = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net']);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', headless: true });
const results = []; const rec = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function newCtx(width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' });
  await ctx.addInitScript(() => { const Orig = window.Audio; window.__audios = []; const W = function (src) { const a = src === undefined ? new Orig() : new Orig(src); window.__audios.push(a); return a; }; W.prototype = Orig.prototype; window.Audio = W; });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url()); if (u.origin === ORIGIN) return route.continue();
    if (u.host === 'storage.helloreaddy.io' && u.pathname.endsWith('.mp3')) {
      const n = u.pathname.includes(T1) ? 1 : u.pathname.includes(T2) ? 2 : 0; if (!n) { counters.otherExternal++; return route.abort(); }
      counters[`track${n}`]++; if (audioMode.delayMs) await wait(audioMode.delayMs);
      if (n === 2 && audioMode.failTrack2Once) { audioMode.failTrack2Once = false; return route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>not found</h1>' }); }
      // Range 요청 지원(브라우저 미디어 로더)
      const buf = STUB[n]; const range = route.request().headers()['range']; if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = Number(m[1]); const e = m[2] ? Number(m[2]) : buf.length - 1; return route.fulfill({ status: 206, headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${buf.length}`, 'content-length': String(e - s + 1) }, body: buf.subarray(s, e + 1) }); }
      return route.fulfill({ status: 200, headers: { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' }, body: buf });
    }
    ext.push(u.host + u.pathname); if (u.host.endsWith('youtube.com') || u.host.endsWith('ytimg.com')) counters.youtube++; else if (u.host.endsWith('.supabase.co')) counters.supabase++; else if (STATIC_CDN.has(u.host)) counters.staticCdn++; else counters.otherExternal++;
    return route.abort('blockedbyclient');
  });
  return ctx;
}
const A = (page) => page.evaluate(() => { const a = window.__audios; const x = a[a.length - 1]; return { n: a.length, src: x ? x.src : '', ct: x ? x.currentTime : -1, paused: x ? x.paused : true, ended: x ? x.ended : false, err: x && x.error ? x.error.code : null }; });
const card = (page) => page.locator('div').filter({ hasText: 'DO IT 오리지널 음악' }).filter({ hasText: '이어 듣기' }).last();
const btn = (page, name) => page.getByRole('button', { name, exact: true });
const shown = (page) => page.locator('span.tabular-nums').first().innerText();
const waitPlaying = async (page, timeout = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const s = await A(page); if (!s.paused && s.ct > 0.15) return s; await wait(100); } return await A(page); };

// ── 실제 미디어 시험 (합성 대체음)
let ctx = await newCtx(390); let page = await ctx.newPage();
await page.goto(`${ORIGIN}/do-it/landing`, { waitUntil: 'networkidle' });
await card(page).scrollIntoViewIfNeeded(); await wait(1500);
// 배치: 09 구간 "시작하기" 버튼 바로 아래
const startBtns = page.getByRole('button', { name: /시작하기/ }); const nStart = await startBtns.count(); const startBox = await startBtns.nth(nStart - 1).boundingBox(); const cardBox = await card(page).boundingBox();
rec('배치: 09 구간 시작하기 버튼 바로 아래(카드 상단 > 버튼 하단, 간격<80px)', !!startBox && !!cardBox && cardBox.y > startBox.y + startBox.height - 1 && cardBox.y - (startBox.y + startBox.height) < 80, `btnBottom=${startBox && Math.round(startBox.y + startBox.height)} cardTop=${cardBox && Math.round(cardBox.y)}`);
rec('카드 1개만 렌더', (await page.getByText('DO IT 오리지널 음악').count()) === 1);
rec('홈 BGM(YouTube) 랜딩에 없음: iframe 0 · youtube 요청 0', (await page.locator('iframe').count()) === 0 && counters.youtube === 0, `yt=${counters.youtube}`);
let s = await A(page); rec('A. 최초 무음(자동재생 없음): Audio 1개, paused, 요청 0', s.n === 1 && s.paused && counters.track1 === 0 && counters.track2 === 0, JSON.stringify(s));
rec('A. 선택 전 재생·끄기 버튼 disabled', (await btn(page, '재생').isDisabled()) && (await btn(page, '음악 끄기').isDisabled()));
await page.screenshot({ path: path.join(evidenceDir, 'music_01_initial_390.png') });
await btn(page, '원음 1').click(); s = await waitPlaying(page); const ctA = s.ct; await wait(700); const s2 = await A(page);
rec('A. 원음 1 클릭 → 실제 재생(playing) · currentTime 증가', !s.paused && s2.ct > ctA && s.src.includes(T1), `ct ${ctA.toFixed(2)}→${s2.ct.toFixed(2)}`);
rec('A. 재생 표시 = playing 이벤트 기준(버튼 라벨 일시정지)', (await btn(page, '일시정지').count()) === 1);
const disp = await shown(page); rec('J. 표시 시간 ≈ 실제 currentTime', /^0:0[0-9] \/ 0:05$/.test(disp), disp);
await page.screenshot({ path: path.join(evidenceDir, 'music_02_playing_390.png') });
// D. 일시정지 → 같은 위치 재개
await btn(page, '일시정지').click(); await wait(300); const p1 = await A(page); await wait(800); const p2 = await A(page);
rec('D. 일시정지: paused · 위치 유지(0.8s 후 동일)', p1.paused && Math.abs(p1.ct - p2.ct) < 0.05 && p1.ct > 0.3, `ct=${p1.ct.toFixed(2)}`);
await btn(page, '재생').click(); const r1 = await waitPlaying(page);
rec('D. 재개: 같은 위치에서 이어짐(리셋 아님)', !r1.paused && r1.ct >= p2.ct - 0.05 && r1.ct < p2.ct + 1.5, `resume ct=${r1.ct.toFixed(2)} (paused at ${p2.ct.toFixed(2)})`);
// B. 1→2 전환: 이전 곡 정지, 단일 엘리먼트
await btn(page, '원음 2').click(); const b = await waitPlaying(page);
rec('B. 원음 1→2 전환: src=원음2 · 재생 중 · Audio 인스턴스 여전히 1개(동시 재생 불가)', b.src.includes(T2) && !b.paused && b.n === 1, `n=${b.n}`);
const dispB = await shown(page); rec('J. 전환 직후 표시 초기화(0:0x / 0:03)', /^0:0[0-9] \/ 0:03$/.test(dispB), dispB);
// E. 음악 끄기 → 늦은 재시작 없음
await btn(page, '음악 끄기').click(); await wait(200); const e1 = await A(page); await wait(2500); const e2 = await A(page);
rec('E. 음악 끄기: paused · src 비움 · 2.5s 후에도 재시작 없음', e1.paused && e2.paused && (e2.src === '' || e2.src === ORIGIN + '/do-it/landing') && (await btn(page, '재생').isDisabled()), `src="${e2.src}"`);
rec('E. 끄기 후 표시 0:00 / 0:00', (await shown(page)) === '0:00 / 0:00', await shown(page));
// C. 이어 듣기 1→2 → 종료, 무한반복 없음 (5s + 3s)
await btn(page, '이어 듣기').click(); const c1 = await waitPlaying(page); rec('C. 이어 듣기 시작: 원음 1 재생', c1.src.includes(T1) && !c1.paused);
let switched = null; for (let i = 0; i < 90; i++) { await wait(100); const x = await A(page); if (x.src.includes(T2) && !x.paused && x.ct > 0.1) { switched = x; break; } }
rec('C. 원음 1 종료 → 원음 2 자동 이어 재생(같은 엘리먼트)', !!switched && switched.n === 1, switched ? `ct=${switched.ct.toFixed(2)}` : 'no switch');
let endedState = null; for (let i = 0; i < 70; i++) { await wait(100); const x = await A(page); if (x.paused && x.ended) { endedState = x; break; } }
await wait(2500); const after = await A(page);
rec('C. 원음 2 종료 → 정지 · 2.5s 후 재시작 없음(무한반복 없음)', !!endedState && after.paused && after.src.includes(T2), after ? `paused=${after.paused} ended=${after.ended}` : '');
rec('J. 종료 후 표시 0:00 / 0:03 · 버튼 라벨 재생', (await shown(page)) === '0:00 / 0:03' && (await btn(page, '재생').count()) === 1, await shown(page));
rec('C. 이어 듣기 전체 동안 트랙 요청 횟수 정상(원음1 1회·원음2 1회 추가)', counters.track1 >= 1 && counters.track2 >= 1, JSON.stringify(counters));
await page.screenshot({ path: path.join(evidenceDir, 'music_03_after_sequence_390.png') });
await ctx.close();

// ── F/G. 느린 로딩·빠른 전환·일시정지·끄기·재시도 / 늦은 응답이 현재 상태를 덮지 않음
ctx = await newCtx(390); page = await ctx.newPage(); await page.goto(`${ORIGIN}/do-it/landing`, { waitUntil: 'networkidle' }); await card(page).scrollIntoViewIfNeeded(); await wait(800);
audioMode.delayMs = 1500;
await btn(page, '원음 1').click(); await wait(100); await btn(page, '음악 끄기').click(); await wait(2800); let g = await A(page);
rec('G. 느린 로딩 중 끄기 → 늦은 응답 후에도 정지 유지 · 오류 안내 없음', g.paused && (await page.getByText('다시 재생').count()) === 0 && (await btn(page, '재생').isDisabled()), JSON.stringify({ paused: g.paused, src: g.src.slice(-12) }));
await btn(page, '원음 1').click(); await wait(80); await btn(page, '원음 2').click(); const g2 = await waitPlaying(page, 6000); await wait(2000); const g3 = await A(page);
rec('G. 빠른 1→2 전환(느린 로딩): 최종 src=원음2 · 재생 중 · 이후 원음1로 되돌아가지 않음', g2.src.includes(T2) && !g2.paused && g3.src.includes(T2) && !g3.paused && (await page.getByText('다시 재생').count()) === 0, `src2=${g3.src.includes(T2)}`);
await btn(page, '일시정지').click(); await wait(300); const g4 = await A(page); await wait(1800); const g5 = await A(page);
rec('F. 느린 로딩 후 일시정지 유지(늦은 이벤트로 재생 전환 없음)', g4.paused && g5.paused && (await btn(page, '재생').count()) === 1);
await btn(page, '원음 1').click(); await wait(80); await btn(page, '일시정지').count(); await btn(page, '원음 1').click(); const g6 = await waitPlaying(page, 6000);
rec('F. 같은 곡 연속 클릭(재시작) → 정상 재생', !g6.paused && g6.src.includes(T1));
audioMode.delayMs = 0; await ctx.close();

// ── I. 두 번째 곡 재생 실패 → 안내 → 다시 재생 성공 → 오류 해제
ctx = await newCtx(390); page = await ctx.newPage(); await page.goto(`${ORIGIN}/do-it/landing`, { waitUntil: 'networkidle' }); await card(page).scrollIntoViewIfNeeded(); await wait(800);
audioMode.failTrack2Once = true; await btn(page, '원음 2').click(); await wait(2500);
const failMsg = await page.getByText('음원을 재생하지 못했어요. 다시 시도해 주세요.').count(); const blockedMsg = await page.getByText('브라우저가 재생을 막았어요').count(); const i1 = await A(page);
rec('I/H. 원음 2 로드 실패(404) → 일반 실패 안내 표시(차단 문구 아님) · 재생 표시 꺼짐(버튼 라벨 재생)', failMsg === 1 && blockedMsg === 0 && (await btn(page, '재생').count()) === 1 && i1.ct === 0, `failed=${failMsg} blocked=${blockedMsg} mediaErr=${i1.err} elemPaused=${i1.paused}`);
await page.screenshot({ path: path.join(evidenceDir, 'music_04_failed_notice_390.png') });
await page.getByRole('button', { name: '다시 재생' }).click(); const i2 = await waitPlaying(page, 6000); await wait(500);
const failAfter = await page.getByText('음원을 재생하지 못했어요').count();
rec('I. 다시 재생(서버 정상) → 재생 성공 · 오류 안내 해제 · media error 해제', !i2.paused && i2.ct > 0.15 && failAfter === 0 && i2.err === null, `paused=${i2.paused} ct=${i2.ct.toFixed(2)} err=${i2.err} noticeStill=${failAfter}`);
if (i2.paused) { await btn(page, '원음 2').click(); const i3 = await waitPlaying(page, 6000); rec('I(보조). 실패 후 곡 버튼 다시 클릭 → 재생 성공(src 재설정 경로)', !i3.paused && i3.ct > 0.15 && (await page.getByText('음원을 재생하지 못했어요').count()) === 0, `ct=${i3.ct.toFixed(2)}`); }
await ctx.close();

// ── H. 합성 오류 주입(실제 미디어 아님 · play() 를 일시 대체): NotAllowedError→blocked, 일반→failed, AbortError→무표시
ctx = await newCtx(390); page = await ctx.newPage(); await page.goto(`${ORIGIN}/do-it/landing`, { waitUntil: 'networkidle' }); await card(page).scrollIntoViewIfNeeded(); await wait(800);
const inject = (name) => page.evaluate((name) => { const P = HTMLMediaElement.prototype; if (!window.__origPlay) window.__origPlay = P.play; P.play = function () { P.play = window.__origPlay; return Promise.reject(new DOMException('injected', name)); }; }, name);
await inject('NotAllowedError'); await btn(page, '원음 1').click(); await wait(600);
rec('H(합성). NotAllowedError → "브라우저가 재생을 막았어요" · 재생 표시 꺼짐', (await page.getByText('브라우저가 재생을 막았어요').count()) === 1 && (await btn(page, '재생').count()) === 1);
await page.getByRole('button', { name: '다시 재생' }).click(); const h1 = await waitPlaying(page); rec('H(합성). 차단 안내의 다시 재생 → 실제 재생 · 안내 해제', !h1.paused && (await page.getByText('브라우저가 재생을 막았어요').count()) === 0);
await btn(page, '음악 끄기').click(); await wait(300); await inject('NotSupportedError'); await btn(page, '원음 1').click(); await wait(600);
rec('H(합성). 일반 오류 → "음원을 재생하지 못했어요"', (await page.getByText('음원을 재생하지 못했어요').count()) === 1 && (await page.getByText('브라우저가 재생을 막았어요').count()) === 0);
await btn(page, '음악 끄기').click(); await wait(300); await inject('AbortError'); await btn(page, '원음 1').click(); await wait(800);
rec('H(합성). AbortError(사용자 취소·교체) → 안내 없음', (await page.getByText('다시 재생').count()) === 0);
await ctx.close();

// ── 이탈·뒤로가기·재방문 · 키보드 · 반응형
ctx = await newCtx(390); page = await ctx.newPage(); await page.goto(`${ORIGIN}/do-it/landing`, { waitUntil: 'networkidle' }); await card(page).scrollIntoViewIfNeeded(); await wait(800);
await btn(page, '원음 1').click(); await waitPlaying(page);
await page.evaluate(() => window.history.pushState({}, '', '/do-it/hero')); await page.goto(`${ORIGIN}/do-it/hero`, { waitUntil: 'networkidle' }).catch(() => {}); await wait(800);
let left = await page.evaluate(() => (window.__audios || []).map((a) => ({ paused: a.paused, src: a.src })));
rec('이탈(/do-it/hero 로 이동): 카드 언마운트 → 이전 Audio paused · src 비움', left.length === 0 || left.every((a) => a.paused), JSON.stringify(left).slice(0, 120));
await page.goBack({ waitUntil: 'networkidle' }).catch(() => {}); await wait(1200); await card(page).scrollIntoViewIfNeeded(); await wait(500); let back = await A(page);
rec('뒤로가기 재방문: 자동 재생 없음 · 선택 없음(재생 버튼 disabled)', back.paused && (await btn(page, '재생').isDisabled()));
// 키보드
await btn(page, '원음 1').focus(); await page.keyboard.press('Enter'); const k1 = await waitPlaying(page); rec('키보드: 원음 1 Enter → 재생', !k1.paused);
await btn(page, '일시정지').focus(); await page.keyboard.press('Space'); await wait(400); const k2 = await A(page); rec('키보드: 일시정지 Space → 정지', k2.paused);
rec('버튼 이름: 재생/일시정지·음악 끄기·원음 1·원음 2·이어 듣기 모두 접근 가능한 이름 있음', (await btn(page, '재생').count()) === 1 && (await btn(page, '음악 끄기').count()) === 1 && (await btn(page, '원음 1').count()) === 1 && (await btn(page, '원음 2').count()) === 1 && (await btn(page, '이어 듣기').count()) === 1);
await ctx.close();
for (const w of [360, 390, 430]) { const c = await newCtx(w); const p = await c.newPage(); await p.goto(`${ORIGIN}/do-it/landing`, { waitUntil: 'networkidle' }); await card(p).scrollIntoViewIfNeeded(); await wait(1200);
  const cb = await card(p).boundingBox(); const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); const sb = await p.getByRole('button', { name: /시작하기/ }).last().boundingBox();
  const overlap = cb && sb && cb.y < sb.y + sb.height && cb.y + cb.height > sb.y;
  rec(`반응형 ${w}px: 카드 폭 ≤ 뷰포트 · 가로 넘침 없음 · 시작하기 버튼 가림 없음`, cb && cb.x >= 0 && cb.x + cb.width <= w + 0.5 && !overflow && !overlap, `card x=${cb && Math.round(cb.x)} w=${cb && Math.round(cb.width)} overflow=${overflow} overlap=${overlap}`);
  await p.screenshot({ path: path.join(evidenceDir, `music_05_section09_${w}.png`) }); await c.close(); }
await browser.close(); server.kill();
const fails = results.filter((r) => !r.pass).length;
fs.writeFileSync(path.join(evidenceDir, 'music_browser_report.json'), JSON.stringify({ at: new Date().toISOString(), note: '합성 대체음(stub) 사용 · 원음·청취 검사 아님', counters, externalRequestsSample: ext.slice(0, 20), results }, null, 2));
console.log('\ncounters', JSON.stringify(counters)); console.log(`\nRESULT: ${fails === 0 ? 'CARD LOGIC VERIFIED (stub audio)' : 'CARD LOGIC FAIL'} — fail=${fails}/${results.length}`); process.exit(fails ? 1 : 0);
