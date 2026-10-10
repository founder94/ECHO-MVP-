// QA 서버 함수 배포 묶음 검사(2026-10-10 · echo-qa-edge-deploy.yml): 임시 묶음 안 .ts 파일의 상대 경로 import 가 모두 묶음 안에 있는지.
// 하나라도 없으면 1 로 끝나 배포하지 않는다(e18cb84 「Module not found: _shared/read-json-limited.ts」 재발 방지).
// 사용: node product/scripts/check-edge-imports.mjs <묶음의 supabase/functions 폴더>
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root || !existsSync(root)) { console.log(`FAIL: 폴더 없음 ${root}`); process.exit(1); }
const IMPORT = /(?:import|export)\s[^;]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)|^\s*import\s*["'](\.{1,2}\/[^"']+)["']/gm;
let count = 0;
const missing = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.ts')) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(IMPORT)) {
      const rel = m[1] ?? m[2] ?? m[3];
      count++;
      if (!existsSync(path.resolve(path.dirname(p), rel))) missing.push(`${path.relative(root, p)} -> ${rel}`);
    }
  }
};
walk(root);
console.log(`상대 import ${count}개 확인`);
if (missing.length) { console.log(`FAIL: 묶음에 없는 파일 ${missing.length}개\n${missing.join('\n')}`); process.exit(1); }
console.log('PASS: 묶음 안 상대 import 누락 0');
