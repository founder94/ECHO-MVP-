// 휴대폰 시험 페이지 만들기: core.mjs 를 글자 그대로 넣는다(export 낱말만 뺀다). 페이지와 Golden 재생이 같은 코어를 쓰는지 검사가 대조한다.
// 실행: node spike/core-20260925/build-page.mjs --out <page.html>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const inlineCore = (src) => src.replace(/^export (async function|function|const) /gm, '$1 ');
export function buildPage() {
  const core = inlineCore(readFileSync(path.join(HERE, 'core.mjs'), 'utf8'));
  const tpl = readFileSync(path.join(HERE, 'page.template.html'), 'utf8');
  if (!tpl.includes('/*__CORE__*/')) throw new Error('template marker missing');
  return tpl.replace('/*__CORE__*/', () => core);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out');
  writeFileSync(i > 0 ? process.argv[i + 1] : path.join(HERE, 'page.html'), buildPage());
}
