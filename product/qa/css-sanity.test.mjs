// CSS 파일이 문법적으로 닫혀 있는지(2026-09-23). 닫히지 않은 주석 하나가 아래 규칙들을 통째로 삼켜도
// 타입 검사·eslint·빌드는 모두 통과한다(실제로 brand-sections.css 에서 한 번 났다). 그래서 따로 센다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.css')) cssFiles.push(full);
  }
})(path.join(root, 'src'));

test('src 아래 CSS 파일을 찾았다', () => assert.ok(cssFiles.length > 10, String(cssFiles.length)));

for (const file of cssFiles) {
  test(`CSS 닫힘 확인: ${path.relative(root, file)}`, () => {
    const css = readFileSync(file, 'utf8');
    // 주석: 열림마다 닫힘이 있어야 한다(중첩 주석은 CSS 에 없다)
    let i = 0;
    for (;;) {
      const open = css.indexOf('/*', i);
      if (open < 0) break;
      const close = css.indexOf('*/', open + 2);
      assert.ok(close >= 0, `${open} 번째 글자의 주석이 닫히지 않았다`);
      // 닫히지 않은 주석은 다음 주석의 */ 에서 끝난 것처럼 보인다. 그래서 주석 안에 또 /* 가 있으면 앞 주석이 안 닫힌 것이다.
      const nested = css.indexOf('/*', open + 2);
      assert.ok(nested < 0 || nested > close, `${open} 번째 글자의 주석이 닫히기 전에 다른 주석이 시작된다(앞 주석이 안 닫힘)`);
      i = close + 2;
    }
    // 중괄호: 주석·문자열을 뺀 뒤 짝이 맞고, 도중에 음수가 되지 않아야 한다
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
    let depth = 0;
    for (const ch of bare) {
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; assert.ok(depth >= 0, '닫는 중괄호가 먼저 나왔다'); }
    }
    assert.equal(depth, 0, '중괄호 짝이 맞지 않는다');
  });
}
