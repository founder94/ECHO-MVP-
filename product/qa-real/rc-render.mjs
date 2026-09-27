// RC(검사 후보) 로컬 서버를 Chrome·WebKit 으로 열어 본다(로그인 없음 · 쓰기 0). 공통 메뉴 위치·겹침·눌림 표시·첫 화면.
import { chromium, webkit } from 'playwright';
const base = process.argv[2];
const out = {};
for (const [name, type] of [['chrome', chromium], ['webkit', webkit]]) {
  for (const [dev, w, h] of [['iphone', 390, 844], ['galaxy', 412, 915]]) {
    const b = await type.launch(); const key = `${name}-${dev}`;
    try {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: name === 'chrome', hasTouch: true });
    const p = await ctx.newPage(); const pageErrors = []; p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 140))); p.on('crash', () => pageErrors.push('PAGE CRASH')); p.on('close', () => pageErrors.push('PAGE CLOSED'));
    var rows = [];
    const check = async (tag) => rows.push([tag, await p.evaluate(() => {
      const btn = document.querySelector('.echo-corner-button'); const r = btn?.getBoundingClientRect(); const overlap = [];
      if (r) for (const el of document.querySelectorAll('a,button,input,textarea,[role=button],[role=radio],h1,h2')) { if (el === btn || btn.contains(el) || el.closest('.echo-corner-panel')) continue; const q = el.getBoundingClientRect(); if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) overlap.push((el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 20)); }
      const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      const txt = document.body.innerText;
      return { path: location.pathname, menus: document.querySelectorAll('.echo-corner-button').length, top: r && Math.round(r.top), right: r && Math.round(innerWidth - r.right), onTop: !!(hit && btn?.contains(hit)), overlap, hero: /좋아하는 사람보다|JUST TRY/.test(txt), motionText: txt.includes('움직임 줄이기') };
    })]);
    await p.goto(`${base}/`); await p.waitForTimeout(9000); await check('root');
    const cta = p.locator('text=내 계정으로 계속하기').first(); const box = await cta.boundingBox().catch(() => null);
    var press = 'none'; if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(260); press = await cta.evaluate((e) => { const el = e.closest('a,button') ?? e; const s = getComputedStyle(el); return `${s.scale} ${s.filter}`; }); await p.mouse.move(1, 1); await p.mouse.up(); }
    await p.locator('.echo-corner-button').click(); await p.waitForTimeout(400);
    var items = await p.$$eval('.echo-corner-label, .echo-corner-session', (a) => a.map((e) => e.innerText.trim()));
    await p.keyboard.press('Escape');
    for (const path of ['/login', '/signup', '/doit/settings', '/doit/fortune']) { await p.goto(base + path); await p.waitForTimeout(3500); await check(path); }
    out[key] = { rows, press, items, pageErrors };
    } catch (e) { out[key] = { error: String(e).split('\n')[0].slice(0, 200) }; }
    await b.close().catch(() => {});
  }
}
console.log(JSON.stringify(out, null, 1));
