// 2026-10-05 Codex echo-review(PR #132 댓글 5990710066) 재현 — 입력·기대값 그대로(가짜 DB 지연 · 가짜 시계 · 가짜 AI). 바꾼 곳은 실행 장치뿐(소스 경로 기본값 · 임시 폴더).
// New 693 fence regression boundaries. Exact source; existing fakeDB/provider only.
// Never execute SQL, access real users/providers or change product source.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const source=process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));assert.ok(source);
const original=readFileSync(path.join(source,'product/qa/agent-server.test.mjs'),'utf8');
let helper=original.slice(0,original.indexOf("test('로그인 안 함"));
function replaceOnce(a,b){assert.equal(helper.split(a).length,2,`Existing helper seam ${a}`);helper=helper.replace(a,b);}
replaceOnce("import ts from 'typescript';",`import ts from ${JSON.stringify(pathToFileURL(path.join(source,'product/node_modules/typescript/lib/typescript.js')).href)};`);
replaceOnce("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);",`const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source,'product/supabase/functions/doit-agent/')).href+'/')});`);
replaceOnce("let filters = []; let op = 'select';","let filters = []; let actionFilter = null; let op = 'select';");
replaceOnce('eq: (col, v) => { filters.push','eq: (col, v) => { if(col === "action") actionFilter = v; filters.push');
replaceOnce('const run = () => {',`const run = () => {
      if(state.delayFence && op === 'update' && actionFilter === 'agent_admission') {
        state.lockWrites = (state.lockWrites ?? 0) + 1;
        if(state.lockWrites === 3) { const plan=state.delayFence;state.delayFence=null;plan.entered();return plan.gate.then(run); }
      }`);
replaceOnce('insert: (row) => {',`insert: async (row) => {
        if(state.delayUnknownUsage && row.action === 'agent_usage' && row.response_payload?.usage?.why === 'claim_uncertain') {
          const plan=state.delayUnknownUsage;state.delayUnknownUsage=null;plan.entered();await plan.gate;
        }`);
replaceOnce('function load(state) {',`function load(state) {
  class ClockDate extends Date {
    constructor(...args){args.length?super(...args):super(Date.now()+(state.clockOffsetMs??0));}
    static now(){return Date.now()+(state.clockOffsetMs??0);}
  }`);
replaceOnce('const g = { console, setTimeout, clearTimeout, AbortController, JSON, Date,','const g = { console, setTimeout, clearTimeout, AbortController, JSON, Date: ClockDate,');
replaceOnce('setTimeout, clearTimeout, structuredClone, Date, JSON,','setTimeout, clearTimeout, structuredClone, Date: ClockDate, JSON,');
helper+='\nexport {load,newState,T,Q,X,rid,ID};\n';
const file=pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(),'late-owner-')),'pinned-late-owner-uncertain-helpers.mjs'));writeFileSync(file,helper);
const {load,newState,T,Q,X,rid,ID}=await import(file.href);
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const hash=async t=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))).toString('hex');
const turn=()=>T({extracted:[X('attraction_comfort','조용함','조용한')],...Q('values_character','뭘 봐요?')});
async function waitFor(p){for(let i=0;i<100;i++){if(p())return;await new Promise(r=>setTimeout(r,5));}assert.ok(p(),'scheduled provider boundary reached');}
async function setup(){
 const state=newState();state.env={AI_POLICY:JSON.stringify({version:'synthetic-late-owner-review',providers:{openai:{model:'fixture',allow_user_text:true}},tasks:{default:['openai']},limits:{max_tokens_per_request:60000}})};
 const first=load(state),second=load(state);
 state.ai.push(T({extracted:[X('relationship_intent','친구','친구')],...Q('attraction_comfort','어떤 사람이 편해요?')}));
 const start=await first.call({action:'agent_start',requestId:rid(),firstAnswer:'친구'});assert.equal(start.status,200);
 return {state,first,second,sessionId:start.body.session.id,rows:state.tables.doit_request_events};
}
test('a late admission owner cannot settle or release a newer owner\'s pending paid claim',async()=>{
 const f=await setup(),entered=defer(),fenceGate=defer(),providerGate=defer();
 f.state.delayFence={entered:entered.resolve,gate:fenceGate.promise};f.state.lockWrites=0;
 f.state.fail={openai:[{gate:providerGate.promise}]};f.state.ai.push(turn());
 const request={action:'agent_turn',requestId:rid(),sessionId:f.sessionId,text:'조용한 사람'};
 const before=f.state.providerCalls.length,a=f.first.call(request);let b,observed;
 try{
  await entered.promise; // A wrote its claim; A's post-write ownership CAS has not executed.
  f.state.clockOffsetMs=480000; // exceeds actual RUN_LEASE_MS=420000; leave all row revisions unchanged
  b=f.second.call(request);await waitFor(()=>f.state.providerCalls.length>before);
  const newer=f.rows.find(r=>r.request_id===request.requestId);
  assert.equal(newer.status,'pending');assert.equal(newer.error_code,'PAID');
  fenceGate.resolve();const late=await a;
  observed={late_status:late.status,newer_status:newer.status,newer_error:newer.error_code};
 }finally{fenceGate.resolve();providerGate.resolve();await Promise.all([a,...(b?[b]:[])]);}
 console.log('synthetic late owner cleanup',JSON.stringify(observed));
 assert.deepEqual(observed,{late_status:503,newer_status:'pending',newer_error:'PAID'});
});
test('uncertain usage transfer delayed after the fence must not authorize an extra paid attempt after lease expiry',async()=>{
 const f=await setup(),requestId=rid(),text='조용한 사람';
 const counted=f.rows.filter(r=>r.action==='agent_usage'||(r.action==='agent_turn'&&(r.response_payload?.record?.ai_usage?.attempts??0)>0)).length;
 assert.ok(counted>0&&counted<198);
 f.rows.push(...Array.from({length:198-counted},()=>({user_id:ID.user,request_id:rid(),action:'agent_turn',status:'applied',created_at:new Date().toISOString(),response_payload:{record:{ai_usage:{attempts:1}}}})));
 f.rows.push({user_id:ID.user,request_id:requestId,action:'agent_turn_claim',target_id:f.sessionId,status:'pending',error_code:'PAID',created_at:new Date().toISOString(),updated_at:new Date(Date.now()-480000).toISOString(),payload_hash:await hash(`${f.sessionId}:${text}`)});
 // 198 current uses + 1 genuinely uncertain pending paid attempt = 199. Only one new slot remains.
 const entered=defer(),usageGate=defer(),providerGate=defer();
 f.state.delayUnknownUsage={entered:entered.resolve,gate:usageGate.promise};
 f.state.fail={openai:[{gate:providerGate.promise},{gate:providerGate.promise}]};
 f.state.ai.push(turn());f.state.rescue=[{choices:['잘 웃는 사람','말을 잘 들어주는 사람']}];
 const before=f.state.providerCalls.length,a=f.first.call({action:'agent_turn',requestId,sessionId:f.sessionId,text});
 let b,calls;
 try{
  await entered.promise;f.state.clockOffsetMs=6000;
  b=f.second.call({action:'agent_rescue',requestId:rid(),sessionId:f.sessionId});
  await waitFor(()=>f.state.providerCalls.length>before);
  usageGate.resolve();
  for(let i=0;i<60&&f.state.providerCalls.length<before+2;i++)await new Promise(r=>setTimeout(r,5));
  calls=f.state.providerCalls.length-before;
 }finally{usageGate.resolve();providerGate.resolve();}
 const replies=await Promise.all([a,...(b?[b]:[])]),observed={calls,statuses:replies.map(r=>r.status)};
 console.log('synthetic uncertain transfer/lease boundary',JSON.stringify(observed));
 assert.equal(calls,1,JSON.stringify(observed));
});

