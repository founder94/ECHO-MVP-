// 2026-10-09 테스트 전용: agent.ts 를 임시 폴더에 풀어 import 하는 검사들이 agent.ts 의 「./history-retrieval.ts」(2026-10-08 기억 찾기)를 찾게 한다.
// 실제 파일을 그대로 풀어 쓴다(가짜 0) — 풀어 쓴 agent 코드의 import 주소만 이 파일로 바꾼다.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const file = path.join(mkdtempSync(path.join(tmpdir(), 'agent-deps-')), 'history-retrieval.mjs');
writeFileSync(file, ts.transpileModule(readFileSync(new URL('../supabase/functions/doit-agent/history-retrieval.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
export const AGENT_DEP = '"./history-retrieval.ts"';
export const AGENT_DEP_URL = JSON.stringify(pathToFileURL(file).href);
