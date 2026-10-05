// 2026-10-05 Codex echo-review(PR #132 댓글 5990995468) 재현 — 입력·기대값 그대로. 바꾼 곳은 실행 장치뿐(소스 경로 기본값 · 임시 폴더).
// New boundary after moving unknown usage before reclaim CAS: one prior attempt, one receipt.
// Exact product source, existing fakeDB/provider only. Synthetic data; no live writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const source=process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));assert.ok(source);
const original=readFileSync(path.join(source,'product/qa/agent-server.test.mjs'),'utf8');
const prefix=original.slice(0,original.indexOf("test('로그인 안 함"));
assert.ok(prefix.includes('function load(state)')&&prefix.includes('const newState'));
const helper=prefix.replace("import ts from 'typescript';",`import ts from ${JSON.stringify(pathToFileURL(path.join(source,'product/node_modules/typescript/lib/typescript.js')).href)};`)
 .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);",`const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source,'product/supabase/functions/doit-agent/')).href+'/')});`)
 +'\nexport {load,newState,T,Q,X,rid,ID};\n';
const file=pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(),'echo-reclaim-')),'helpers.mjs'));writeFileSync(file,helper);
const {load,newState,T,Q,X,rid,ID}=await import(file.href);
test('two workers reclaiming one stale paid claim must preserve its uncertain usage exactly once',async()=>{
 const s=newState();s.env={AI_POLICY:JSON.stringify({version:'synthetic-reclaim-dedup',providers:{openai:{model:'fixture',allow_user_text:true}},tasks:{default:['openai']},limits:{max_tokens_per_request:60000}})};
 const a=load(s),b=load(s);
 s.ai.push(T({extracted:[X('relationship_intent','친구','친구')],...Q('attraction_comfort','어떤 사람이 편해요?')}));
 const start=await a.call({action:'agent_start',requestId:rid(),firstAnswer:'친구'});assert.equal(start.status,200);
 const text='조용한 사람',requestId=rid(),sessionId=start.body.session.id;
 const payload_hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${sessionId}:${text}`))).toString('hex');
 s.tables.doit_request_events.push({user_id:ID.user,request_id:requestId,action:'agent_turn_claim',target_id:sessionId,status:'pending',error_code:'PAID',created_at:new Date().toISOString(),updated_at:new Date(Date.now()-480000).toISOString(),payload_hash});
 let release;const gate=new Promise(r=>{release=r;});s.fail={openai:[{gate}]};
 s.ai.push(T({extracted:[X('attraction_comfort','조용함','조용한')],...Q('values_character','뭘 봐요?')}));
 const before=s.providerCalls.length,request={action:'agent_turn',requestId,sessionId,text};
 const first=a.call(request),second=b.call(request);let secondDone=false;
 second.then(()=>{secondDone=true;});
 try{for(let i=0;i<100&&!secondDone;i++)await new Promise(r=>setTimeout(r,5));}
 finally{release();}
 const replies=await Promise.all([first,second]);
 const receipts=s.tables.doit_request_events.filter(r=>r.action==='agent_usage'&&r.response_payload?.usage?.why==='claim_uncertain');
 const observed={calls:s.providerCalls.length-before,statuses:replies.map(r=>r.status),unknown_receipts:receipts.length};
 console.log('synthetic stale reclaim receipt dedup',JSON.stringify(observed));
 assert.equal(observed.calls,1,'Only one new paid attempt is allowed for this same request');
 assert.equal(observed.unknown_receipts,1,'The same older uncertain attempt must not be counted twice when another reclaim CAS loses');
});

