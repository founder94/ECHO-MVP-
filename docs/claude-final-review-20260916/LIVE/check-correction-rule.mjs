// 새 규칙(정정 우선)을 캐너리 실제 대화에 대입해 본다: 과차단이 나지 않는지 확인.
// 진짜 rules.ts 를 그대로 불러 쓴다(재구현 금지).
import { readFileSync } from 'node:fs';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from '/home/user/readdy-v88/node_modules/typescript/lib/typescript.js';

const src = readFileSync('work/supabase/functions/get-step-question/rules.ts', 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dir = mkdtempSync(join(tmpdir(), 'rules-'));
const file = join(dir, 'rules.mjs');
writeFileSync(file, js);
const { reflectsCorrection, correctionContentWords } = await import(file);

const rows = readFileSync('livetest/canary-results.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
let checked = 0;
for (const r of rows) {
  const evs = r.events ?? [];
  const ci = evs.findIndex((e) => e.kind === 'choose' && (e.choice === 'alittle' || e.choice === 'explain'));
  if (ci < 0) continue;
  checked++;
  const correction = evs[ci].text;
  const words = correctionContentWords(correction);
  const after = evs.slice(ci + 1).filter((e) => e.kind === 'ask');
  console.log(`\n#${r.i} ${r.type}  내용어=${JSON.stringify(words)}`);
  for (const [n, e] of after.entries()) {
    const q = String(e.shown ?? '');
    console.log(`  ${n === 0 ? '→ 직후' : '   이후'} [${e.status}] 반영=${reflectsCorrection(q, correction) ? 'O' : 'X'} ${JSON.stringify(q.replace(/\n\n/g, ' / ').slice(0, 70))}`);
    if (n >= 3) break;
  }
}
console.log(`\n정정이 있던 대화 ${checked}건 검사`);
