// 2026-10-09 테스트 전용: 서버 함수가 부르는 ../_shared/*.ts(요청 크기·출처·빈도 방어)를 실제 파일 그대로 읽어 실행한다(가짜 0).
// agent-server.test.mjs 의 loadSharedSecurity 와 같은 방식 — 보안 보강 뒤 다른 하네스들이 「Unexpected dependency」로 멈추던 것을 막는다.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const SHARED = new URL('../supabase/functions/_shared/', import.meta.url);
const cache = new Map();
export function loadShared(name) {
  if (!/^\.\.\/_shared\/[\w-]+\.ts$/.test(name)) throw new Error(`Unexpected dependency ${name}`);
  if (!cache.has(name)) {
    const mod = { exports: {} };
    const code = ts.transpileModule(readFileSync(new URL(name.slice('../_shared/'.length), SHARED), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module: mod, exports: mod.exports, TextDecoder, Uint8Array, Error, Number, JSON }, { filename: name });
    cache.set(name, mod.exports);
  }
  return cache.get(name);
}
