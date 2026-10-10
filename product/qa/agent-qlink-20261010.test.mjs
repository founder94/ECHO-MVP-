// 2026-10-10 MVP 마감 — 실서버 「질문이 방금 답과 이어지지 않음」(qa-core-live 「v2.5 질문 = 방금 답과 맥락 연결」 3회 중 2회 실패).
// 원인: 마침표 없이 친 첫 답(「천천히 대화하면서 스며드는 친구」)을 목적 타일 버튼으로 잘못 봐서 낱말 잇기 검사가 꺼지고 「그 낱말로 묻지 말라」가 붙었다.
// 고침: 세션에 고른 목적 글자(goal_label)가 있으면 그 글자와 같을 때만 버튼. 가짜 AI·가짜 DB — 실제 AI 품질 판정 아님.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
let helper = readFileSync(new URL('./agent-server.test.mjs', import.meta.url), 'utf8');
helper = helper.slice(0, helper.indexOf("test('로그인 안 함"));
helper = helper.replace("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.resolve('node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(new URL('../supabase/functions/doit-agent/', import.meta.url).href)});`);
helper += '\nexport {load,newState,T,Q,X,rid};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'qlink-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid } = await import(file.href);
const ts = (await import(pathToFileURL(path.resolve('node_modules/typescript/lib/typescript.js')).href)).default;
const adir = mkdtempSync(path.join(tmpdir(), 'qlink-a-'));
// 같은 폴더의 .ts 가져오기(예: agent.ts → ./history-retrieval.ts)는 함께 옮긴 .mjs 를 보게 바꾼다.
const emit = (p, out) => { const f = path.join(adir, out); writeFileSync(f, ts.transpileModule(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from "\.\/([\w-]+)\.ts"/g, 'from "./$1.mjs"')); return pathToFileURL(f).href; };
emit('supabase/functions/doit-agent/matching.ts', 'matching.mjs');
emit('supabase/functions/doit-agent/history-retrieval.ts', 'history-retrieval.mjs');
const A = await import(emit('supabase/functions/doit-agent/agent.ts', 'agent.mjs'));

const LABEL = '친구를 만나고 싶어요';
test('버튼 판단: 목적 글자가 있으면 그 글자와 같을 때만 버튼 · 마침표 없이 친 글은 버튼 아님', () => {
  const FQ = A.FIRST_QUESTION;
  assert.equal(A.buttonInput(FQ, false, LABEL, LABEL), true, '타일만 누름');
  assert.equal(A.buttonInput(FQ, false, `${LABEL}.`, LABEL), true, '끝 마침표만 다름');
  assert.equal(A.buttonInput(FQ, false, '천천히 대화하면서 스며드는 친구', LABEL), false, '마침표 없이 친 글');
  assert.equal(A.buttonInput(FQ, false, '같이 밥 먹으면서 얘기할 친구요', LABEL), false);
  assert.equal(A.buttonInput(FQ, false, `${LABEL}. 음악 얘기가 잘 통하는 사람`, LABEL), false, '타일 + 한 줄');
  assert.equal(A.buttonInput('다른 질문', false, LABEL, LABEL), false, '첫 질문이 아니면 버튼 아님');
  assert.equal(A.buttonInput(FQ, true, '아무 글', LABEL), true, '고른 보기는 버튼');
  // 목적 글자가 없는 예전 세션은 예전 판단 그대로
  assert.equal(A.buttonInput(FQ, false, '친구'), true);
  assert.equal(A.buttonInput(FQ, false, '친구. 음악 얘기가 잘 통하는 사람이 좋아요'), false);
});

test('agent_start: 마침표 없이 친 첫 답에 이어지지 않는 질문은 다시 청해 방금 답에 잇는다', async () => {
  const s = newState(); s.strictAnchor = true; const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '천천히 스며드는 친구', '천천히 대화하면서 스며드는 친구')], ...Q('attraction_comfort', '처음 만날 때 밥부터 먹는 게 좋아요?') }));
  s.ai.push(T({ extracted: [X('relationship_intent', '천천히 스며드는 친구', '천천히 대화하면서 스며드는 친구')], ...Q('attraction_comfort', '대화가 잘 통하는 친구랑은 주로 뭐 하고 놀아요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: LABEL, firstAnswer: '천천히 대화하면서 스며드는 친구' });
  assert.equal(r.status, 200);
  assert.equal(r.body.session.current_question, '대화가 잘 통하는 친구랑은 주로 뭐 하고 놀아요?', '방금 답에 이어진 질문');
});

test('agent_start: 타일만 누른 경우(목적 글자 그대로)는 예전처럼 목적의 뜻으로 묻는다(낱말 잇기 검사 0)', async () => {
  const s = newState(); s.strictAnchor = true; const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', LABEL)], ...Q('attraction_comfort', '친구랑 있을 때 어떤 순간이 제일 편해요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: LABEL, firstAnswer: LABEL });
  assert.equal(r.status, 200);
  assert.equal(r.body.session.current_question, '친구랑 있을 때 어떤 순간이 제일 편해요?');
});

test('낱말 잇기: 바람·싫음 낱말(싶어·싫고·원해)만 겹친 질문은 이어진 질문이 아니다', () => {
  const ans = '돈 관계는 싫고 천천히 대화하면서 스며드는 친구를 만나고 싶어요';
  assert.equal(A.anchored(ans, '혼자 있을 때 생각나는 친구가 있어요?'), false);
  assert.equal(A.anchored(ans, '처음 만날 때 뭐 먹고 싶어요?'), false, '싶어만 겹침');
  assert.equal(A.anchored(ans, '대화가 천천히 이어지는 친구랑은 뭐 하고 놀아요?'), true);
  assert.equal(A.anchored(ans, '돈 얘기 없이 편한 관계면 어떤 순간이 좋아요?'), true);
});

test('낱말 잇기: 바람·싫음 낱말(싶어·싫고·원해)만 겹친 질문은 이어진 질문이 아니다', () => {
  const ans = '돈 관계는 싫고 천천히 대화하면서 스며드는 친구를 만나고 싶어요';
  assert.equal(A.anchored(ans, '혼자 있을 때 생각나는 친구가 있어요?'), false);
  assert.equal(A.anchored(ans, '처음 만날 때 뭐 먹고 싶어요?'), false, '싶어만 겹침');
  assert.equal(A.anchored(ans, '대화가 천천히 이어지는 친구랑은 뭐 하고 놀아요?'), true);
  assert.equal(A.anchored(ans, '돈 얘기 없이 편한 관계면 어떤 순간이 좋아요?'), true);
});
