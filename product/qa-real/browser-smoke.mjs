import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const app = 'http://127.0.0.1:8770';
const brand = 'http://127.0.0.1:8773';
for (const [name, browserType] of [['Chrome', chromium], ['WebKit', webkit]]) {
  const browser = await browserType.launch();
  try {
    for (const [device, width, height] of [['iPhone', 390, 844], ['Galaxy', 412, 915]]) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(app, { waitUntil: 'networkidle' });
      assert.equal(await page.title(), 'ECHO');
      assert.equal(await page.locator('link[rel=manifest]').count(), 1);
      assert.equal(await page.locator('meta[name=apple-mobile-web-app-title]').getAttribute('content'), 'ECHO');
      const manifest = await (await context.request.get(`${app}/manifest.webmanifest`)).json();
      assert.equal(manifest.name, 'ECHO');
      assert.equal(manifest.short_name, 'ECHO');
      for (const icon of manifest.icons) {
        const response = await context.request.get(new URL(icon.src, app).href);
        assert.equal(response.status(), 200);
        assert.match(response.headers()['content-type'] ?? '', /image\//);
      }
      await page.goto(`${app}/doit/start-journey`, { waitUntil: 'networkidle' });
      assert.doesNotMatch(await page.locator('body').innerText(), /움직임 줄이기|DO IT QA|ECHO QA|QA BUILD/);
      assert.deepEqual(errors, [], `${name}/${device} APP JS errors`);
      await page.goto(brand, { waitUntil: 'networkidle' });
      assert.match(await page.title(), /DO IT COMPANY/);
      assert.equal(await page.locator('link[rel=manifest]').count(), 0);
      assert.doesNotMatch(await page.locator('body').innerText(), /움직임 줄이기|DO IT QA|ECHO QA|QA BUILD/);
      assert.deepEqual(errors, [], `${name}/${device} BRAND JS errors`);
      console.log(`${name}/${device}: APP + BRAND PASS`);
      await context.close();
    }
  } finally { await browser.close(); }
}
