// 2026-10-05 Codex echo-spec 20261005-plan-a-pm-retention P1 재현 — Codex 가 준 입력·기대값 그대로(실제 보기 누름 처리 함수를 TypeScript 로 뽑아 돌리는 모의 검사 · 브라우저 아님).
// 바꾼 곳은 실행 장치뿐: 검사할 소스·typescript 경로 기본값 = 이 저장소.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Script, createContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const source = process.env.ECHO_UI_REVIEW_SOURCE ?? fileURLToPath(new URL('../../', import.meta.url));
assert.ok(source, 'Set the exact reviewed source directory');
const require = createRequire(import.meta.url);
const ts = require(process.env.ECHO_REVIEW_TYPESCRIPT ?? 'typescript');
const file = path.join(source, 'product/src/doit/components/feature/AgentConversation.tsx');
const content = readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = [];
function visit(node) {
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(sf) === 'button') {
    const props = node.attributes.properties;
    const cls = props.find(a => ts.isJsxAttribute(a) && a.name.getText(sf) === 'className');
    const click = props.find(a => ts.isJsxAttribute(a) && a.name.getText(sf) === 'onClick');
    if (cls?.initializer?.getText(sf).includes('echo-option') && click?.initializer?.expression)
      handlers.push(click.initializer.expression.getText(sf));
  }
  ts.forEachChild(node, visit);
}
visit(sf);
assert.equal(handlers.length, 1, 'Exactly one actual rescue-choice handler must be identified');
function chooseWithDraft(initialDraft) {
  let draft = initialDraft, pick = null;
  const context = createContext({
    picked: null, question: 'synthetic-current-question', choice: '조용히 전시를 보고 싶어요',
    setDraft: value => { draft = typeof value === 'function' ? value(draft) : value; },
    setPick: value => { pick = value; },
  });
  const js = ts.transpileModule('const handler = ' + handlers[0] + '; handler();',
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Script(js).runInContext(context);
  return { draft, pick };
}
test('selecting a rescue choice must preserve an existing unsent free-text answer', () => {
  const original = '전시는 좋아하지만 시끄러운 곳은 싫어요.';
  assert.equal(chooseWithDraft(original).draft, original,
    'An optional rescue choice must not silently erase an unsent answer');
});
test('selecting a rescue choice with no draft retains the valid selected text', () => {
  const result = chooseWithDraft('');
  assert.equal(result.draft, '');
  assert.equal(result.pick.choice, '조용히 전시를 보고 싶어요');
  assert.equal(result.pick.q, 'synthetic-current-question');
});
