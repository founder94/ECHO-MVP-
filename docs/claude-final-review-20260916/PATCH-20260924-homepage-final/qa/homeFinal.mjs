// 홈페이지 최종 검사(대표 최종 승인 §12): 360/390/430/1440 · 가로 넘침 · 콘솔 오류 · 글자 잘림 · 첫 화면 Hero+CTA · CTA 이동.
import { chromium } from 'playwright';
const BRAND = 'http://127.0.0.1:4671', APP = 'http://127.0.0.1:4672';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const rows = []; let pass = 0, total = 0;
const rec = (ok, label) => { total++; if (ok) pass++; rows.push(`${ok ? '통과' : '실패'} ${label}`); };
const SIZES = [[360, 740, true], [390, 844, true], [430, 932, true], [1440, 900, false]];
async function open(base, w, h, mobile) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  // 이 작업 환경은 cdnjs·jsdelivr(아이콘·Pretendard CSS)가 네트워크 정책으로 막혀 있다(ERR_TUNNEL_CONNECTION_FAILED).
  // 제품 결함과 섞이지 않게 빈 CSS 로 채운다 — 운영 사용자는 실제 파일을 받는다.
  await ctx.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const appHits = [];
  await ctx.route(/app\.do-it\.company/, (r) => { appHits.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>app</body></html>' }); });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text() + ' @' + (m.location()?.url ?? '').slice(0, 60)); });
  page.on('requestfailed', (r) => errors.push('요청실패:' + r.url().slice(0, 80) + ' ' + r.failure()?.errorText));
  await page.goto(base + '/?skipIntro=1');
  await page.waitForSelector('.doit-brand-start', { timeout: 20000 });
  await page.waitForTimeout(1200);
  return { ctx, page, errors, appHits };
}
for (const [w, h, mobile] of SIZES) {
  // 1) 홈페이지 전체
  const { ctx, page, errors, appHits } = await open(BRAND, w, h, mobile);
  const first = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
    return { line: r('.doit-brand-line'), cta: r('.doit-brand-start'), sub: r('.doit-brand-status'), vh: innerHeight, vw: innerWidth, lineText: document.querySelector('.doit-brand-line')?.textContent, cta_t: document.querySelector('.doit-brand-start')?.textContent?.trim() };
  });
  const inView = (x) => x && x.top >= 0 && x.bottom <= first.vh && x.left >= 0 && x.right <= first.vw;
  rec(inView(first.line) && inView(first.cta), `${w} 첫 화면에 Hero 문장·CTA 모두 보임 (line ${Math.round(first.line?.bottom)} / cta ${Math.round(first.cta?.bottom)} / 화면 ${first.vh})`);
  rec(first.lineText === '좋아하는 사람보다, 편해지는 사람은 다를 수 있으니까.' && first.cta_t === 'ECHO 시작하기', `${w} Hero 문구·CTA 글자 = 승인안 ("${first.lineText}" / "${first.cta_t}")`);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  rec(overflow <= 0, `${w} 가로 넘침 0 (차이 ${overflow}px)`);
  const clip = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main button, main dd, main dt, main em, main strong')) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.closest('.doit-brand-skip, .doit-brand-sr, [aria-hidden="true"]')) continue;
      // 히어로 제목(h1)은 화면 읽기용 숨은 글자 + 일부러 잘라 보이는 지구 그림(기존 디자인)이다 — 보이는 글자가 없다.
      const sr = el.querySelector('.doit-brand-sr'); if (sr && el.textContent.trim() === sr.textContent.trim()) continue;
      if (!el.textContent.trim()) continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
      if (r.right > innerWidth + 1 || r.left < -1) bad.push('밖:' + el.textContent.trim().slice(0, 24));
      if ((cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) bad.push('잘림:' + el.textContent.trim().slice(0, 24));
    }
    return bad;
  });
  rec(clip.length === 0, `${w} 글자 잘림·화면 밖 0 ${clip.slice(0, 4).join(' | ')}`);
  const secs = await page.evaluate(() => ['doit-why', 'doit-stories', 'doit-trust', 'doit-justtry', 'doit-start-mobile', 'doit-about', 'doit-greeting'].filter(id => !document.getElementById(id)));
  rec(secs.length === 0, `${w} 구간 7개 모두 있음 ${secs.join(',')}`);
  const cards = await page.evaluate(() => document.querySelectorAll('.doit-brand-card, .doit-brand-cards').length);
  rec(cards === 0, `${w} 기능 카드 0개 (${cards})`);
  const oldCopy = await page.evaluate(() => ['소개팅', '찾아오는 인연', '사람 연결은 준비 중', '목적 선택과 프로필 준비까지', 'ECHO와 시작하기'].filter(t => document.body.innerText.includes(t)));
  rec(oldCopy.length === 0, `${w} 옛 문구 0 ${oldCopy.join(',')}`);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.OUT ?? '.'}/final-brand-${w}-hero.png` });
  for (const id of ['doit-why', 'doit-trust', 'doit-justtry']) { await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'start' }), id); await page.waitForTimeout(500); await page.screenshot({ path: `${process.env.OUT ?? '.'}/final-brand-${w}-${id}.png` }); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  // CTA 이동
  const beforeCta = errors.length;
  await page.click('.doit-brand-start');
  await page.waitForTimeout(1500);
  if (mobile) {
    rec(appHits.some(u => /app\.do-it\.company\/doit\/start-journey/.test(u)), `${w} 휴대폰 Hero CTA → app.do-it.company/doit/start-journey (${appHits[0] ?? '이동 없음'})`);
  } else {
    const qr = await page.evaluate(() => { const r = document.getElementById('doit-start-qr')?.getBoundingClientRect(); return r ? r.top >= 0 && r.bottom <= innerHeight : false; });
    rec(qr && appHits.length === 0, `${w} 컴퓨터 Hero CTA → QR 상자가 화면 안(앱 이동 없음)`);
  }
  // 홈페이지의 오류 = CTA 로 떠나기 전까지. 떠난 뒤는 검사용 가짜 앱 페이지(app.do-it.company 를 이 환경이 막아 빈 문서로 대신함)의 일이다.
  rec(beforeCta === 0, `${w} 홈페이지 콘솔·화면 오류 0 (${beforeCta}건) ${errors.slice(0, beforeCta).join(' | ').slice(0, 200)}`);
  if (errors.length > beforeCta) rows.push(`   참고(판정 제외): 떠난 뒤 가짜 앱 페이지에서 ${errors.length - beforeCta}건 — ${errors.slice(beforeCta).join(' | ').slice(0, 160)}`);
  await ctx.close();
  // 2) 앱 첫 화면: 같은 히어로, CTA → 앱 안 시작 흐름(로그인/대화 진입)
  if (mobile) {
    const a = await open(APP, w, h, true);
    const t = await a.page.evaluate(() => ({ line: document.querySelector('.doit-brand-line')?.textContent, why: !!document.getElementById('doit-why'), trust: !!document.getElementById('doit-trust') }));
    rec(t.line === '좋아하는 사람보다, 편해지는 사람은 다를 수 있으니까.' && !t.why && !t.trust, `${w} 앱 첫 화면 = 같은 Hero, 홈페이지 전용 구간 0`);
    await a.page.click('.doit-brand-start'); await a.page.waitForTimeout(3000);
    const url = new URL(a.page.url()); const body = await a.page.locator('body').innerText();
    rec(/^\/(doit\/start-journey|login|doit\/login|auth)/.test(url.pathname) && !body.includes('화면을 불러오지 못했어요'), `${w} 앱 Hero CTA → ${url.pathname} (로그아웃 상태 · 화면 오류 없음)`);
    rec(a.errors.length === 0, `${w} 앱 콘솔·화면 오류 0 ${a.errors.slice(0, 3).join(' | ').slice(0, 200)}`);
    await a.ctx.close();
  }
}
await b.close();
console.log(rows.join('\n')); console.log(`PASS ${pass} / ${total}`);
