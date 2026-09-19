// 반응형 실측 하네스 (로컬 전용). 사용: node responsive.browser.mjs <out 폴더> <port> <label> <shotdir>
// 화면 폭별로 홈(/)을 열고 ① 가로 스크롤 ② 카드·버튼 화면 밖 ③ 헤더 겹침 ④ 배경 레이어 filter/backdrop-filter 잔존
// ⑤ 스크롤 후 헤더 배경 ⑥ z-index 구조를 측정하고 스크린샷을 남긴다. 검사하지 않은 항목은 결과에 넣지 않는다.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [,, outDir, portArg, label, shotDir] = process.argv;
const port = Number(portArg);
fs.mkdirSync(shotDir, { recursive: true });
const server = spawn('node', [path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'harness', 'spa-server.mjs'), outDir, String(port)], { stdio: 'inherit' });
await new Promise((r) => setTimeout(r, 800));

const WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440, 1920];
const results = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });

for (const w of WIDTHS) {
  const mobile = w <= 430;
  const h = mobile ? Math.round(w * 2.16) : (w <= 1024 ? 1024 : 900);
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile
      ? 'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
      : undefined,
  });
  // 외부 CDN·이미지 호스트는 샌드박스에서 막혀 있으므로 차단(실기기와 달리 배경 이미지·아이콘 폰트는 비어 있음)
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(`http://127.0.0.1:${port}`)) return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const top = await page.evaluate(() => {
    const de = document.documentElement;
    const nav = document.querySelector('nav');
    const navRect = nav?.getBoundingClientRect();
    const logo = nav?.querySelector('img');
    const right = nav?.querySelector('div > div > div:last-child');
    const desktopNav = nav?.querySelector('div.hidden.md\\:flex');
    const dn = desktopNav ? getComputedStyle(desktopNav).display : 'absent';
    const lr = logo?.getBoundingClientRect();
    const rr = right?.getBoundingClientRect();
    // 배경 레이어(fixed inset-0) 안에 filter / backdrop-filter 가 남아 있는 요소 수
    let filtered = 0, backdrop = 0, bgLayers = [];
    for (const el of document.querySelectorAll('div.fixed.inset-0')) {
      const cs = getComputedStyle(el);
      bgLayers.push({ z: cs.zIndex, pe: cs.pointerEvents, cls: el.className.slice(0, 60) });
      for (const c of el.querySelectorAll('*')) {
        const s = getComputedStyle(c);
        if (s.filter && s.filter !== 'none') filtered += 1;
        const bf = s.backdropFilter || s.webkitBackdropFilter;
        if (bf && bf !== 'none') backdrop += 1;
      }
    }
    return {
      innerWidth: innerWidth,
      docScrollWidth: de.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      rootMinHeight: getComputedStyle(document.querySelector('#root > div') || de).minHeight,
      navBgTop: nav ? getComputedStyle(nav).backgroundColor : null,
      navRight: navRect ? Math.round(navRect.right) : null,
      logoRect: lr ? [Math.round(lr.left), Math.round(lr.right)] : null,
      rightRect: rr ? [Math.round(rr.left), Math.round(rr.right)] : null,
      desktopNavDisplay: dn,
      filteredInBg: filtered,
      backdropInBg: backdrop,
      bgLayers,
    };
  });
  await page.screenshot({ path: path.join(shotDir, `${label}_${w}_top.png`), fullPage: false });

  // 카드까지 스크롤 (실기기 스크린샷과 같은 위치)
  // 실제 사용자 경로로 이동: 768px 이상은 헤더 메뉴 'ECHO', 그 미만(메뉴 숨김)은 푸터 'ECHO' 앵커 클릭
  if (w >= 768) {
    await page.locator('nav a[href="#meaning"]').first().click();
  } else {
    await page.evaluate(() => document.querySelector('footer')?.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(400);
    await page.locator('footer a[href="#meaning"]').first().click();
  }
  await page.waitForTimeout(2200); // 부드러운 스크롤 + 섹션 페이드인(지연 300ms + 700ms) 이 끝난 뒤 측정·촬영
  const card = await page.evaluate(() => {
    const meaning = document.getElementById('meaning');
    const navEl = document.querySelector('nav');
    const headingTop = meaning ? Math.round(meaning.getBoundingClientRect().top) : null;
    const navBottom = navEl ? Math.round(navEl.getBoundingClientRect().bottom) : null;
    window.__anchor = { headingTop, navBottom };
    const p = [...document.querySelectorAll('#meaning p')].find((e) => e.textContent?.includes('오늘의 날씨는'));
    const cardEl = p?.parentElement;
    const r = cardEl?.getBoundingClientRect();
    const btns = [...(cardEl?.querySelectorAll('button') ?? [])].map((b) => {
      const br = b.getBoundingClientRect();
      return { t: b.textContent, l: Math.round(br.left), r: Math.round(br.right), w: Math.round(br.width), overflow: b.scrollWidth > b.clientWidth + 1 };
    });
    const nav = document.querySelector('nav');
    const cs = cardEl ? getComputedStyle(cardEl) : null;
    return {
      scrollY: Math.round(scrollY),
      card: r ? { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), t: Math.round(r.top) } : null,
      cardMaxWidthParent: cardEl ? getComputedStyle(cardEl.parentElement.parentElement).maxWidth : null,
      cardTransform: cs?.transform,
      cardZ: cardEl ? getComputedStyle(cardEl.closest('.relative.z-10') || cardEl).zIndex : null,
      btns,
      gridCols: cardEl ? getComputedStyle(cardEl.querySelector('.grid')).gridTemplateColumns.split(' ').length : null,
      navBgScrolled: nav ? getComputedStyle(nav).backgroundColor : null,
      navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      anchorHeadingTop: window.__anchor.headingTop,
      anchorNavBottom: window.__anchor.navBottom,
    };
  });
  await page.screenshot({ path: path.join(shotDir, `${label}_${w}_card.png`), fullPage: false });

  const checks = {
    horizontalScroll: top.docScrollWidth <= top.innerWidth && top.bodyScrollWidth <= top.innerWidth,
    cardInside: !!card.card && card.card.l >= 0 && card.card.r <= top.innerWidth,
    buttonsInside: card.btns.length === 6 && card.btns.every((b) => b.l >= card.card.l && b.r <= card.card.r && !b.overflow),
    headerNoOverlap: !!top.logoRect && !!top.rightRect && top.logoRect[1] <= top.rightRect[0] && top.rightRect[1] <= top.innerWidth,
    desktopNavHiddenOnMobile: w < 768 ? top.desktopNavDisplay === 'none' : top.desktopNavDisplay === 'flex',
    noFilterInBgLayers: top.filteredInBg === 0 && top.backdropInBg === 0,
    navHasBgWhenScrolled: card.navBgScrolled !== 'rgba(0, 0, 0, 0)',
    navTransparentAtTop: top.navBgTop === 'rgba(0, 0, 0, 0)',
    cardNoTransform: card.cardTransform === 'none',
    // getBoundingClientRect 반올림(±1px) 허용
    anchorClearsHeader: card.anchorHeadingTop !== null && card.anchorNavBottom !== null && card.anchorHeadingTop >= card.anchorNavBottom - 1,
  };
  results.push({ width: w, mobile, ...top, ...card, checks, pass: Object.values(checks).every(Boolean) });
  await ctx.close();
}
await browser.close();
server.kill();
fs.writeFileSync(path.join(shotDir, `${label}_results.json`), JSON.stringify(results, null, 2));
for (const r of results) {
  const failed = Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${label} ${String(r.width).padStart(4)}px  ${r.pass ? 'PASS' : 'FAIL'}  scrollW=${r.docScrollWidth}/${r.innerWidth} card=${r.card ? r.card.w : '-'}px grid=${r.gridCols} navScrolledBg=${r.navBgScrolled} filterInBg=${r.filteredInBg}+${r.backdropInBg} ${failed.length ? 'FAILED:' + failed.join(',') : ''}`);
}
