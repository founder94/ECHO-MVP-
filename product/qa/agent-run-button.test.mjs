// PR #103 Codex Code Review(리뷰 5400659793 · f5d1206) P2 재현 — 실행 예산을 다 쓴 끝 상태(on_hold · waiting=budget)면 버튼을 닫고 「기다리면 준비」 문구를 쓰지 않음
// 실제 컴포넌트 함수 + 가짜 hooks/API(모의 UI 검사 · 브라우저·실기기 확인 아님). Codex 독립 재현(qa-independent/codex-agent-client-contract.test.mjs)과 같은 방식.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const api = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL('../src/doit/lib/agentApi.ts', import.meta.url), 'utf8').replace('import.meta.env.VITE_ECHO_AGENT_ENABLED', "'true'")), {
  module: api, exports: api.exports, console, require: () => ({ prepareUnderstandingRequest: async (_u, body) => ({ body, complete() {} }), serverFunctionRequest: async () => ({}) }),
});
const run = o => ({ version: 'echo-run-v1', goal: 'friend', plan_rev: 1, outcome: 'on_hold', waiting: 'budget', next: 'wait', missing: [], steps: [], candidates: null, ...o });
function mount(result, onRun) {
  let cursor = 0; const state = []; const memos = [];
  const hooks = {
    useState(i) { const k = cursor++; if (!(k in state)) state[k] = i; return [state[k], v => { state[k] = typeof v === 'function' ? v(state[k]) : v; }]; },
    useMemo(fn, deps) { const k = cursor++; const p = memos[k]; if (!p || deps.some((v, j) => !Object.is(v, p.deps[j]))) memos[k] = { deps, value: fn() }; return memos[k].value; },
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  const mod = { exports: {} };
  vm.runInNewContext(compile(readFileSync(new URL('../src/doit/components/feature/AsleepConnections.tsx', import.meta.url), 'utf8')) + '\nexports.__button=AgentRunButton;', {
    module: mod, exports: mod.exports, console,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/doit/lib/agentApi') return { ...api.exports, agentGet: async () => ({ id: 's' }), agentRun: async () => { onRun(); return { run: result, tool: null }; } };
      if (name === '@/doit/lib/understandingApi') return { UnderstandingError: class extends Error {}, A_STRUCTURE_SERVER_ENABLED: true };
      return {};
    },
  });
  const props = { userId: 'u', onOpenCandidates() {} };
  return () => { cursor = 0; return mod.exports.__button(props); };
}
const kids = el => [el.props.children].flat().filter(Boolean);
const text = el => JSON.stringify(el);

test('예산을 다 쓴 끝 상태: 버튼 비활성 · 다시 눌러도 실행 0 · 「후보를 준비하면」 문구 아님', async () => {
  let runs = 0; const render = mount(run(), () => { runs++; });
  await render().props.children[0].props.onClick();
  await new Promise(r => setTimeout(r, 0));
  const el = render(); const btn = kids(el)[0];
  assert.equal(btn.props.disabled, true, '끝 상태면 버튼 닫음');
  const status = kids(el).filter(x => x.type === 'p').map(text).join('');
  assert.ok(status.length > 0, '끝 상태를 보여 줌');
  assert.doesNotMatch(status, /준비하면/, '「기다리면 후보가 준비된다」로 보이지 않음');
  assert.equal(runs, 1);
});
test('예산이 아닌 대기(no_candidates_yet · wait)는 지금처럼 버튼 열림(과차단 0)', async () => {
  const render = mount(run({ waiting: 'no_candidates_yet' }), () => {});
  await render().props.children[0].props.onClick();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(kids(render())[0].props.disabled, false);
});
test('Codex P2(리뷰 4174523875) 사용자가 멈춘 끝 상태(user_stopped · resume_if_wanted): 버튼 비활성 · 멈춤 문구 · 다시 눌러도 실행 0(다시 시작 화면 승인 전)', async () => {
  let runs = 0; const render = mount(run({ outcome: 'stopped', waiting: 'user_stopped', next: 'resume_if_wanted' }), () => { runs++; });
  await render().props.children[0].props.onClick();
  await new Promise(r => setTimeout(r, 0));
  const el = render();
  assert.equal(kids(el)[0].props.disabled, true, '멈춘 상태면 버튼 닫음');
  assert.match(kids(el).filter(x => x.type === 'p').map(text).join(''), /멈춰 두었어요/);
  assert.equal(runs, 1, '첫 결과를 받은 뒤 더 부르지 않음');
});
