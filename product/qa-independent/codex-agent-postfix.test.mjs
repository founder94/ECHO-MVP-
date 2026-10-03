import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/doit/lib/agentApi.ts', import.meta.url), 'utf8');
let reply;
const compile = s => ts.transpileModule(s, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const api = { exports:{} };
vm.runInNewContext(compile(source.replace('import.meta.env.VITE_ECHO_AGENT_ENABLED', "'true'")), {
  module:api,exports:api.exports,console,
  require:()=>({prepareUnderstandingRequest:async (_u,body)=>({body,complete(){}}),serverFunctionRequest:async()=>structuredClone(reply)})
});
const valid = overrides => ({version:'echo-run-v1',goal:'friend',plan_rev:1,outcome:'done',waiting:null,next:'open_candidates',missing:[],steps:[{id:'tool:candidates',status:'done',why:null}],candidates:{outcome:'found',count:1,at:'2026-10-03T00:00:00Z',fresh:true},...overrides});
const session = run => ({id:'s',phase:'done',progress:{asked:5},messages:[],run});

test('control: current server-shaped run is accepted',()=>assert.equal(api.exports.validRun(valid()),true));
test('required goal and waiting types must reject malformed execution records',()=>{
  assert.equal(api.exports.validRun(valid({goal:17,waiting:{bogus:true}})),false);
});
test('candidate result enum and count/fresh types must reject malformed records',()=>{
  assert.equal(api.exports.validRun(valid({candidates:{outcome:'fabricated',count:'many',at:17,fresh:'yes'}})),false);
});
test('agentRun must not publish malformed candidates as a successful run',async()=>{
  const run=valid({candidates:{outcome:'fabricated',count:'many',at:17,fresh:'yes'}});
  reply={session:session(run),run,tool:null};
  await assert.rejects(api.exports.agentRun('u','s'),/INVALID_RESPONSE/);
});

// Actual component functions with mocked hooks/API. This is a mock UI test, not browser or device verification.
function mountButton(run) {
  let cursor=0; const state=[];const memos=[];
  const hooks={
    useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];},
    useMemo(fn,deps){const i=cursor++;const prior=memos[i];if(!prior||deps.some((v,j)=>!Object.is(v,prior.deps[j])))memos[i]={deps,value:fn()};return memos[i].value;},
    useEffect(){}
  };
  const jsx=(type,props)=>({type,props});
  const mod={exports:{}};
  const ui=readFileSync(new URL('../src/doit/components/feature/AsleepConnections.tsx',import.meta.url),'utf8');
  vm.runInNewContext(compile(ui)+'\nexports.__button=AgentRunButton;',{
    module:mod,exports:mod.exports,console,
    require(name){
      if(name==='react')return hooks;
      if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
      if(name==='@/doit/lib/agentApi')return {...api.exports,agentGet:async()=>session(null),agentRun:async()=>({run,tool:null})};
      if(name==='@/doit/lib/understandingApi')return {UnderstandingError:class extends Error{},A_STRUCTURE_SERVER_ENABLED:true};
      return {};
    }
  });
  const props={userId:'u',onOpenCandidates(){}};
  const render=()=>{cursor=0;return mod.exports.__button(props);};
  return {render};
}
for(const [outcome,waiting,next] of [['stopped','user_stopped','resume_if_wanted'],['on_hold','lookup_failed','retry_later']]){
  test(`successful server ${outcome}/${waiting} response must have a visible status`,async()=>{
    const m=mountButton(valid({outcome,waiting,next,candidates:null}));
    await m.render().props.children[0].props.onClick();
    await new Promise(r=>setTimeout(r,0));
    const status=m.render().props.children.filter(x=>x&&x.type==='p');
    assert.ok(status.length>0,'server outcome silently disappears: button only, no status/error');
  });
}

// Codex 독립 재현(5969058987 · f5d1206 기준) 두 건 — 댓글 원문 그대로(아래 import 두 줄 포함)
import { createModelRouter, defaultPolicy } from '../supabase/functions/doit-agent/modelRouter.ts';
import { ProviderError } from '../supabase/functions/doit-agent/providers.ts';
test('independent P1: unknown usage carries conservative token bound into next request',async()=>{
 const policy=defaultPolicy('fixture'); policy.limits.same_provider_retries=0;
 const router=createModelRouter({policy,params:{temperature:0,max_tokens:10},providers:{openai:{id:'openai',call:async()=>{throw new ProviderError('openai','http_500',1,{status:500});}}}});
 await assert.rejects(router.llm('turn','synthetic',{text:'가'.repeat(1000)}));
 assert.ok(router.summary().tokens_reserved_unconfirmed>=3000);
});
test('independent P2: terminal budget state disables further run actions',async()=>{
 const m=mountButton(valid({outcome:'on_hold',waiting:'budget',next:'wait',candidates:null}));
 await m.render().props.children[0].props.onClick(); await new Promise(r=>setTimeout(r,0));
 assert.equal(m.render().props.children[0].props.disabled,true);
});
