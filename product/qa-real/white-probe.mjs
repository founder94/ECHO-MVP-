// 읽기 전용 흰 화면 진단(2026-09-27): 배포된 QA 주소를 실제 Chrome·WebKit(iPhone Safari 엔진)으로 열어 콘솔 오류·실패 요청·React mount 를 적고,
// 대표에게 보낸 QA ZIP(파일별 sha256 목록)과 실제 내려오는 파일을 대조한다. 쓰기 0 · 비밀값 0.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium, webkit, devices } from 'playwright-core';
const BASE = process.argv[2]; const LIST = process.argv[3];
const sha = (b) => createHash('sha256').update(b).digest('hex');
async function get(u) { try { const r = await fetch(u); return { status: r.status, type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) }; } catch (e) { return { status: 0, body: Buffer.alloc(0), error: e.message }; } }
// 1) 파일 대조
const want = readFileSync(LIST, 'utf8').trim().split('\n').map((l) => { const [h, f] = l.split(/\s+/); return { h, f }; });
const cmp = { total: want.length, same: 0, missing: [], different: [] };
for (const { h, f } of want) { const r = await get(`${BASE}/${f}`); const got = sha(r.body); if (r.status !== 200) cmp.missing.push(`${f} (${r.status})`); else if (got !== h) cmp.different.push(`${f} (${r.type})`); else cmp.same++; }
const idx = await get(`${BASE}/`); const html = idx.body.toString();
console.log(JSON.stringify({ index_status: idx.status, index_sha16: sha(idx.body).slice(0, 16), index_scripts: [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]), index_css: [...html.matchAll(/<link[^>]*stylesheet[^>]*href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^https?:/.test(h)), base_tag: (html.match(/<base [^>]*>/) || [null])[0], compare: { ...cmp, missing: cmp.missing.slice(0, 15), missing_n: cmp.missing.length, different: cmp.different.slice(0, 15), different_n: cmp.different.length } }, null, 1));
// 2) 실제 브라우저
for (const [name, type, opts] of [['chrome-android', chromium, { executablePath: '/usr/bin/google-chrome', ctx: { ...devices['Pixel 7'] } }], ['webkit-iphone', webkit, { ctx: { ...devices['iPhone 13'] } }]]) {
  const out = { engine: name, console_errors: [], page_errors: [], failed: [], http_errors: [] };
  try {
    const b = await type.launch(opts.executablePath ? { executablePath: opts.executablePath } : {}); const ctx = await b.newContext(opts.ctx); const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') out.console_errors.push(m.text().slice(0, 300)); });
    p.on('pageerror', (e) => out.page_errors.push(`${e.name}: ${e.message}`.slice(0, 400)));
    p.on('requestfailed', (r) => out.failed.push(`${r.url().replace(BASE, '')} ${r.failure()?.errorText}`.slice(0, 200)));
    p.on('response', (r) => { if (r.status() >= 400) out.http_errors.push(`${r.status()} ${r.url().replace(BASE, '')}`.slice(0, 200)); });
    await p.goto(`${BASE}/`, { waitUntil: 'load', timeout: 30000 }).catch((e) => out.goto_error = e.message.slice(0, 200));
    await p.waitForTimeout(8000);
    out.final_url = p.url(); out.root_html_len = await p.evaluate(() => document.getElementById('root')?.innerHTML.length ?? -1); out.body_text = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 160);
    out.ua = await p.evaluate(() => navigator.userAgent);
    await b.close();
  } catch (e) { out.launch_error = String(e.message).slice(0, 300); }
  console.log(JSON.stringify(out, null, 1));
}
