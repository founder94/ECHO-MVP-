import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {fixtureClient} from '../qa-real/connect-fixture-scope.ts';
import {isolatedConnect} from '../qa-real/build-isolated-connect.mjs';
const A='10000000-0000-4000-8000-00000000000a',B='20000000-0000-4000-8000-00000000000b',C='30000000-0000-4000-8000-00000000000c';
function db(tables={},who=A){
 const state={queries:[],writes:[],signed:[],authIds:[]};
 const client={
  from(name){let predicates=[],start=0,end=Infinity;const run=()=>Promise.resolve({data:(tables[name]??[]).filter(r=>predicates.every(p=>p(r))).slice(start,end),error:null});const q={
   select:()=>q,in:(col,ids)=>{state.queries.push({name,col,ids});predicates.push(r=>ids.includes(r[col]));return q;},eq:(col,v)=>{predicates.push(r=>r[col]===v);return q;},
   order:()=>q,limit:()=>q,range:(from,to)=>{start=from;end=to+1;return q;},is:(col,v)=>{predicates.push(r=>(r[col]??null)===v);return q;},
   not:()=>q,update:()=>q,then:(ok,bad)=>run().then(ok,bad),maybeSingle:async()=>{const r=await run();return {...r,data:r.data[0]??null};},
   insert:async row=>{state.writes.push({name,row});return {error:null};},upsert:async row=>{state.writes.push({name,row});return {error:null};},
  };return q;},
  auth:{getUser:async()=>({data:{user:{id:who,phone:''}},error:null}),admin:{getUserById:async id=>{state.authIds.push(id);return {data:{user:{id}},error:null};},listUsers:()=>{throw Error('global auth scan');}}},
  storage:{from:()=>({createSignedUrl:async p=>{state.signed.push(p);return {data:{signedUrl:'test-only'},error:null};}})},
 };return {client,state};
}
function handler(who=A,tables={}){
 const {client,state}=db(tables,who);let h;
 const load=file=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module.exports,module,require:n=>load(path.join(path.dirname(file),n))});return module.exports;};
 const source=isolatedConnect(readFileSync('supabase/functions/doit-connect/index.ts','utf8'),[A,B]);
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{exports:{},console:{log(){},error(){}},Request,Response,Headers,URL,crypto:globalThis.crypto,TextEncoder,setTimeout,clearTimeout,AbortController,
  Deno:{env:{get:k=>({SUPABASE_URL:'QA',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[k]},serve:f=>h=f},
  require:n=>n.startsWith('npm:')?{createClient:()=>client}:n==='./fixtureScope.ts'?{fixtureClient,fixtureAllowed:(id,ids)=>ids.includes(id)}:load(path.join('supabase/functions/doit-connect',n)),
 });
 return {state,call:async(body,auth=true)=>{const r=await h(new Request('https://qa-only/',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fixture'}:{})},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}};
}
test('isolated HTTP contract: C=403/non-ok/code, no IDs; A spoofed body does not authorize C',async()=>{
 const c=handler(C);const r=await c.call({action:'phone_sync',user_id:A});assert.equal(r.status,403);assert.equal(r.body.code,'QA_FIXTURE_ONLY');assert.equal(r.body.ok,false);assert.ok(!JSON.stringify(r.body).includes(A));assert.equal(c.state.queries.length,0);
 assert.equal((await handler(A).call({action:'phone_sync',user_id:C})).status,200);
 assert.equal((await handler(A).call({action:'phone_sync'},false)).status,401);
});
test('isolated admin requests always HTTP403 without global admin reads',async()=>{
 const h=handler(A);for(const action of ['admin_matches','admin_members','admin_decide','admin_candidates','admin_run_matching'])assert.equal((await h.call({action})).status,403);
 assert.ok(h.state.queries.every(q=>q.name==='doit_matches'));
});
test('allowed actor cannot fetch outside connection or write answer/message/outcome/report',async()=>{
 const id='40000000-0000-4000-8000-000000000001';const h=handler(A,{doit_matches:[{id,user_a:A,user_b:C,status:'approved'}]});
 assert.deepEqual((await h.call({action:'my_matches'})).body.matches,[]);
 for(const action of ['answer','message','outcome','leave']){
  const r=await h.call({action,matchId:id,text:'safe fixture text',met:'yes',block:true,reason:'spam'});assert.equal(r.status,404,action);
 }
 assert.equal(h.state.writes.length,0);assert.equal(h.state.signed.length,0);
});
test('allowed actor cannot choose outside candidate',async()=>{
 const id='40000000-0000-4000-8000-000000000002';const h=handler(A,{doit_match_candidates:[{id,user_a:A,user_b:C,status:'proposed'}]});
 assert.equal((await h.call({action:'choose',candidateId:id,choice:'yes'})).status,404);assert.equal(h.state.writes.length,0);
});
test('fixture service client scopes records, pair reads and assets; global auth scan is replaced',async()=>{
 const raw=db({doit_matches:[{id:'ab',user_a:A,user_b:B},{id:'ac',user_a:A,user_b:C}],profiles:[{id:A},{id:C}],doit_match_messages:[{match_id:'ab',sender_id:A},{match_id:'ac',sender_id:A}]});
 const c=await fixtureClient(raw.client,[A,B]);
 assert.deepEqual((await c.from('profiles').select('*')).data,[{id:A}]);
 assert.equal((await c.from('doit_match_messages').select('*')).data.length,1);
 assert.throws(()=>c.from('user_reports').insert({reporter_id:A,target_user_id:C}));
 assert.throws(()=>c.from('doit_match_answers').insert({user_id:A,match_id:'ac'}));
 assert.throws(()=>c.from('doit_match_candidates').insert({user_a:A,user_b:C}));
 assert.throws(()=>c.from('doit_match_candidates').update({user_b:C}));
 assert.throws(()=>c.storage.from('profile-photos').createSignedUrl(C+'/x.jpg',600));
 assert.throws(()=>c.storage.from('public-bucket'));assert.throws(()=>c.from('unexpected_table'));
 assert.equal((await c.auth.admin.listUsers({page:1})).data.users.length,2);assert.deepEqual(raw.state.authIds,[A,B]);
 assert.equal(raw.state.signed.length,0);assert.equal(raw.state.writes.length,0);
});
test('isolation build fails closed when source markers change',()=>{
 assert.throws(()=>isolatedConnect('unexpected source',[A,B]));assert.throws(()=>isolatedConnect('unexpected source',[A,A]));
});
