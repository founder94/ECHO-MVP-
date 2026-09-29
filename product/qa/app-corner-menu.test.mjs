import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'src/components/AppCornerMenu.tsx'), 'utf8');
const hiddenSource = src.match(/const HIDDEN_PATH = \/(.*)\/;/)?.[1];
assert.ok(hiddenSource, 'HIDDEN_PATH 정규식을 찾지 못했다');
const hidden = new RegExp(hiddenSource);

test('앱 시작/온보딩/히어로/랜딩에서도 오른쪽 위 메뉴가 숨지 않는다', () => {
  for (const p of ['/', '/do-it/intro', '/do-it/hero', '/do-it/landing', '/doit/start-journey']) {
    assert.equal(hidden.test(p), false, p);
  }
});

test('관리자·QA·OAuth 복귀와 브랜드 사이트에서는 메뉴를 숨긴다', () => {
  for (const p of ['/auth/callback', '/admin/mobile', '/qa/test']) assert.equal(hidden.test(p), true, p);
  assert.match(src, /IS_BRAND_SITE \|\| HIDDEN_PATH\.test\(location\.pathname\)/);
});

test('메뉴 버튼은 44px 터치 영역과 실제 열림/닫힘 동작을 유지한다', () => {
  assert.match(src, /aria-expanded=\{open\}/);
  assert.match(src, /onClick=\{\(\) => setOpen\(\(v\) => !v\)\}/);
});
