// 2026-10-10: 서버 함수 파일이 문법상 읽히는지(엄격한 구문 검사) — transpileModule 은 문법 오류를 메워 넘겨서
// 단위 검사가 통과해도 실제 배포(Supabase 묶기)가 「Expected ','」로 실패한 일이 있었다(echo-qa a4e29cd · agent.ts:87).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = new URL('../supabase/functions/', import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) files.push(p); } };
walk(root);

test('supabase/functions 의 모든 .ts 파일은 구문 오류 0', () => {
  assert.ok(files.length > 10, `파일 수 ${files.length}`);
  const bad = [];
  for (const f of files) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.ES2022, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const d of sf.parseDiagnostics ?? []) bad.push(`${path.relative(root, f)}:${sf.getLineAndCharacterOfPosition(d.start).line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  }
  assert.deepEqual(bad, []);
});
