import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createModelRouter,defaultPolicy} from '../supabase/functions/doit-agent/modelRouter.ts';
const makeRouter=(text)=>{
 const policy=defaultPolicy('fixture');policy.providers.openai.price={in_usd_per_1m:1,out_usd_per_1m:1};policy.limits.max_cost_usd_per_request=.0015;policy.limits.same_provider_retries=0;
 let calls=0;const router=createModelRouter({policy,params:{temperature:0,max_tokens:10},providers:{openai:{id:'openai',call:async()=>{calls++;return {text:'{}',provider:'openai',model_requested:'fixture',model_served:'fixture',input_tokens:text.length>100?2000:10,output_tokens:0,cached_tokens:0,latency_ms:1,truncated:false};}}}});
 return {router,calls:()=>calls};
};
test('P1 monetary cap: token-dense input must be rejected before a request',async()=>{
 const h=makeRouter('가'.repeat(1000));let failed=false;
 try{await h.router.llm('turn','s',{text:'가'.repeat(1000)});}catch{failed=true;}
 assert.equal(h.calls(),0,'estimated dollar amount admitted a request that settled above cap');
 assert.equal(failed,true);
});
test('control: inexpensive short input remains usable',async()=>{const h=makeRouter('short');await h.router.llm('turn','s',{text:'short'});assert.equal(h.calls(),1);assert.ok(h.router.summary().cost_usd<=.0015);});
const source=readFileSync(new URL('../src/doit/lib/agentApi.ts',import.meta.url),'utf8');
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(source.replace('import.meta.env.VITE_ECHO_AGENT_ENABLED',"'true'"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:()=>({}),console});
const terminal={version:'echo-run-v1',goal:'friend',plan_rev:1,outcome:'on_hold',waiting:'budget',next:'wait',missing:[],steps:[],candidates:null};
test('P2 remount: stored budget exhaustion is reused without another write',async()=>{
 let calls=0;let displayed;
 const t=m.exports.createAgentRunTrigger({getSession:async()=>({id:'s',run:terminal}),run:async()=>{calls++;return {run:terminal,tool:null};},onResult:r=>{displayed=r;},onError:e=>{throw e;}});
 await t();assert.equal(calls,0,'stored terminal run still triggers agentRun');assert.equal(displayed.waiting,'budget');
});
test('control: no stored execution keeps explicit click behavior',async()=>{
 let calls=0;const t=m.exports.createAgentRunTrigger({getSession:async()=>({id:'s',run:null}),run:async()=>{calls++;return {run:terminal,tool:null};},onResult:()=>{},onError:e=>{throw e;}});await t();assert.equal(calls,1);
});

