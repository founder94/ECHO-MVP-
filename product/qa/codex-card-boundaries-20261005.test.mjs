// 2026-10-05 Codex echo-review(PR140 ecacd5b · FAIL) 독립 검사 원본 — 기대값 그대로(완화 0). 바꾼 곳 두 군데: 소스 위치(ECHO_SOURCE_ROOT 없으면 이 저장소) · READING 입력 모양(키워드·카드 3개).
// Exact reviewed source; repository DB/provider harness. No real API or DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
const source=process.env.ECHO_SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url));
assert.ok(source);
let helper=readFileSync(path.join(source,'product/qa/agent-server.test.mjs'),'utf8');
helper=helper.slice(0,helper.indexOf("test('로그인 안 함"));
function replace(a,b){assert.equal(helper.split(a).length,2,a);helper=helper.replace(a,b);}
replace("import ts from 'typescript';",`import ts from ${JSON.stringify(pathToFileURL(path.join(source,'product/node_modules/typescript/lib/typescript.js')).href)};`);
replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);",`const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source,'product/supabase/functions/doit-agent/')).href+'/')});`);
replace("let filters = []; let op = 'select';","let filters = []; let faultAction = null; let op = 'select';");
replace("eq: (col, v) => { filters.push","eq: (col, v) => { if(col === 'action') faultAction = v; filters.push");
replace("const run = () => {","const run = () => { if(state.zeroCardFinish && name === 'doit_request_events' && op === 'update' && faultAction === 'agent_turn_claim' && patch?.status === 'applied') {state.injected=(state.injected??0)+1;return {data:[],error:null};} if(state.failUsageRead && name === 'doit_request_events' && op === 'select' && faultAction === 'agent_usage'){state.injected=(state.injected??0)+1;return {data:null,count:null,error:{code:'SYNTHETIC_READ'}};}");
helper+='\nexport {load,newState,rid,ID,ts};\n';
const helperPath=path.join(mkdtempSync(path.join(tmpdir(),'echo-card-boundaries-')),'helpers.mjs');
writeFileSync(helperPath,helper);
const {load,newState,rid,ID,ts}=await import(pathToFileURL(helperPath));
// 2026-10-05 Codex P2(4186782787)로 해석 모양 = 키워드 3 · 카드 줄 3 이 아니면 성공이 아님 → 입력 자료만 그 모양으로 채움(기대값은 원본 그대로).
const READING={summary:'천천히 돌아보는 참고 내용이에요.',tags:['여유','정리','속도'],cards:[{label:'생각거리',value:'내 속도'},{label:'흐름의 방향',value:'천천히'},{label:'놓치지 말 것',value:'쉬어 가기'}]};
function setup(){const s=newState();s.env={AI_POLICY:JSON.stringify({version:'synthetic-card-boundaries',providers:{openai:{model:'fixture',allow_user_text:true}},tasks:{default:['openai']},limits:{max_tokens_per_request:60000}})};return {s,h:load(s),second:load(s)};}
const body=()=>({action:'agent_card',requestId:rid(),cardName:'별',purpose:''});
const usages=s=>s.tables.doit_request_events.filter(r=>r.action==='agent_usage');
async function concurrent(f,same){let release;const gate=new Promise(r=>{release=r;});f.s.fail={openai:[{gate}]};f.s.ai.push(READING,READING);const req=body();const first=f.h.call(req);for(let i=0;i<80&&!f.s.providerCalls?.length;i++)await new Promise(r=>setTimeout(r,5));assert.equal(f.s.providerCalls?.length,1);const other=await f.second.call(same?req:body());release();return [await first,other];}
test('card same in-flight request across workers: one provider and one usage',async()=>{const f=setup();const replies=await concurrent(f,true);assert.equal(replies[0].status,200);assert.ok([409,503].includes(replies[1].status),JSON.stringify(replies));assert.equal(f.s.providerCalls.length,1);assert.equal(usages(f.s).length,1);});
test('card last daily slot: competing different request blocked before provider',async()=>{const f=setup();f.s.tables.doit_request_events=Array.from({length:199},()=>({user_id:ID.user,request_id:rid(),action:'agent_usage',status:'applied',created_at:new Date().toISOString(),response_payload:{usage:{attempts:1}}}));const replies=await concurrent(f,false);assert.equal(replies[0].status,200);assert.equal(replies[1].status,429,JSON.stringify(replies));assert.equal(f.s.providerCalls.length,1);assert.equal(usages(f.s).length,200);});
test('card quota read failure: no provider call and no successful response',async()=>{const f=setup();f.s.failUsageRead=true;f.s.ai.push(READING);const r=await f.h.call(body());assert.ok(f.s.injected>0);assert.equal(f.s.providerCalls?.length??0,0);assert.notEqual(r.status,200);});
test('card completion CAS zero rows: no applied claim or success',async()=>{const f=setup();f.s.zeroCardFinish=true;f.s.ai.push(READING);const r=await f.h.call(body());assert.equal(r.status,503,JSON.stringify(r));assert.equal(r.body.code,'CLAIM_UNCONFIRMED');assert.equal(f.s.providerCalls.length,1);assert.equal(usages(f.s).length,1);assert.ok(f.s.tables.doit_request_events.some(x=>x.action==='agent_turn_claim'&&x.status==='pending'));});
function client(f,storage){
  const supabase={auth:{getSession:async()=>({data:{session:{user:{id:ID.user},access_token:'synthetic'}}})},functions:{invoke:async(_fn,{body})=>{const r=await f.h.call(body);return r.status===200?{data:r.body,error:null}:{data:null,error:{context:new Response(JSON.stringify(r.body),{status:r.status})}};}}};
  const common={crypto:globalThis.crypto,TextEncoder,Response,localStorage:storage,console};
  const compile=p=>ts.transpileModule(readFileSync(path.join(source,p),'utf8').replace(/^export const (A_STRUCTURE_SERVER_ENABLED|ECHO_AGENT_ENABLED) = import\.meta\.env\.[^;]+;/m,'export const $1 = false;'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const u={exports:{}};vm.runInNewContext(compile('product/src/doit/lib/understandingApi.ts'),{...common,module:u,exports:u.exports,require:n=>{assert.equal(n,'@/lib/supabase/client');return {supabase};}});
  const a={exports:{}};vm.runInNewContext(compile('product/src/doit/lib/agentApi.ts'),{...common,module:a,exports:a.exports,require:n=>{assert.equal(n,'@/doit/lib/understandingApi');return u.exports;}});
  return a.exports;
}
test('successful same-card re-entry/reload: stored interpretation reused without another paid call',async()=>{const f=setup();f.s.ai.push(READING,READING);const map=new Map();const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};await client(f,storage).agentTarot(ID.user,'별','');const firstClaim=f.s.tables.doit_request_events.find(x=>x.action==='agent_turn_claim').request_id;await client(f,storage).agentTarot(ID.user,'별','');const detail={providerCalls:f.s.providerCalls.length,usage:usages(f.s).length,claims:f.s.tables.doit_request_events.filter(x=>x.action==='agent_turn_claim').map(x=>x.request_id),firstClaim};assert.equal(f.s.providerCalls.length,1,JSON.stringify(detail));assert.equal(usages(f.s).length,1);});

