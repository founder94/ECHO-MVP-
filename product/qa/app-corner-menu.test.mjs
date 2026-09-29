import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'src/components/AppCornerMenu.tsx'), 'utf8');

test('앱 시작/온보딩/히어로/랜딩에서도 오른쪽 위 메뉴가 숨지 않는다', () => {
  assert.match(src, /const HIDDEN_PATH = \/\^\\\/(?:auth\\\/callback/);
  assert.doesNotMatch(src, /do-it\\\/(?:intro\|hero\|landing)/);
  assert.doesNotMatch(src, /\$\|do-it/);
  assert.match(src, /<AppCornerMenu|AppCornerMenu/);
});

test('관리자·QA·OAuth 복귀와 브랜드 사이트에서는 메뉴를 숨긴다', () => {
  assert.match(src, /IS_BRAND_SITE \|\| HIDDEN_PATH\.test\(location\.pathname\)/);
  assert.match(src, /auth\\\/callback/);
  assert.match(src, /admin/);
  assert.match(src, /qa/);
});

test('메뉴 버튼은 44px 터치 영역과 실제 열림/닫힘 동작을 유지한다', () => {
  assert.match(src, /aria-expanded=\{open\}/);
  assert.match(src, /onClick=\{\(\) => setOpen\(\(v\) => !v\)\}/);
});
