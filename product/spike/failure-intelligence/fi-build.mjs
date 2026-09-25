// Failure Intelligence 문서 생성·검사. 실행: node product/spike/failure-intelligence/fi-build.mjs [--check]
//   --check : 데이터 검증 + 생성 결과가 저장된 .md 와 같은지만 본다(쓰지 않음). 다르면 종료 코드 1.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { load, validate, renderLibrary, renderSolutions, renderGraph, renderLedger, DOCS } from './fi-lib.mjs';

const d = load();
const errs = validate(d);
if (errs.length) { console.error(`검증 실패 ${errs.length}건\n- ${errs.join('\n- ')}`); process.exit(1); }
const outputs = { 'FAILURE_LIBRARY.md': renderLibrary(d), 'FAILED_SOLUTIONS_ARCHIVE.md': renderSolutions(d), 'FAILURE_GRAPH.md': renderGraph(d), 'ACTION_LEDGER.md': renderLedger(d) };
const check = process.argv.includes('--check');
let drift = 0;
for (const [name, text] of Object.entries(outputs)) {
  const p = path.join(DOCS, name);
  if (check) { if (!existsSync(p) || readFileSync(p, 'utf8') !== text) { console.error(`생성본과 다름: ${name}`); drift++; } }
  else writeFileSync(p, text);
}
if (drift) process.exit(1);
console.log(`${check ? '검사' : '생성'} 완료 · 실패 ${d.failures.length} · 실패한 해결책 ${d.solutions.length} · 관계 ${d.graph.edges.length}`);
