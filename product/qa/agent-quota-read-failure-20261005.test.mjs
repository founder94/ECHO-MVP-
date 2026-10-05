// 2026-10-05 Codex echo-review(PR #132 댓글 5990054694) 재현 — 입력·기대값 그대로(가짜 DB 읽기 오류 주입 · 가짜 AI). 바꾼 곳은 실행 장치뿐(소스 경로 기본값 · 임시 폴더).
// New independent fault-injection case: existing daily quota lookup cannot fail open.
// Existing exact source and repository fake DB/provider helpers; synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const source=process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));
assert.ok(source);
const original=readFileSync(path.join(source,'product/qa/agent-server.test.mjs'),'utf8');
let prefix=original.slice(0,original.indexOf("test('로그인 안 함"));
const injections=[
  ["let filters = []; let op = 'select';", "let filters = []; let faultAction = null; let op = 'select';"],
  ["eq: (col, v) => { filters.push", "eq: (col, v) => { if(col === 'action') faultAction = v; filters.push"],
  ["const run = () => {", "const run = () => { if(state.failUsageRead && name === 'doit_request_events' && op === 'select' && faultAction === 'agent_usage') { state.injectedQuotaFailures = (state.injectedQuotaFailures ?? 0) + 1; return {data:null,count:null,error:{code:'SYNTHETIC_READ_UNAVAILABLE'}}; }"]
];
for(const [before,after] of injections){assert.equal(prefix.split(before).length,2,'Reuse exact original fake DB, not another implementation');prefix=prefix.replace(before,after);}
prefix=prefix
  .replace("import ts from 'typescript';",`import ts from ${JSON.stringify(pathToFileURL(path.join(source,'product/node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);",`const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source,'product/supabase/functions/doit-agent/')).href+'/')});`)
  +'\nexport {load,newState,T,Q,X,rid};\n';
const file=pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(),'quota-fault-')),'pinned-quota-fault-helpers.mjs'));
writeFileSync(file,prefix);
const {load,newState,T,Q,X,rid}=await import(file.href);
test('quota read unavailable: paid model call must not begin without proof of available quota',async()=>{
  const s=newState();
  s.env={AI_POLICY:JSON.stringify({version:'synthetic-inflight-review',providers:{openai:{model:'fixture',allow_user_text:true}},tasks:{default:['openai']},limits:{max_tokens_per_request:60000}})};
  const h=load(s);
  s.ai.push(T({extracted:[X('relationship_intent','친구','친구')],...Q('attraction_comfort','어떤 사람이 편해요?')}));
  const started=await h.call({action:'agent_start',requestId:rid(),firstAnswer:'친구'});
  assert.equal(started.status,200,JSON.stringify(started.body));
  s.ai.push(T({extracted:[X('attraction_comfort','조용함','조용한')],...Q('values_character','뭘 봐요?')}));
  s.failUsageRead=true;
  const before=s.providerCalls.length;
  const result=await h.call({action:'agent_turn',requestId:rid(),sessionId:started.body.session.id,text:'조용한 사람'});
  assert.ok(s.injectedQuotaFailures>0,'The daily counter actually receives a DB read error');
  assert.equal(s.providerCalls.length-before,0,`quota failures=${s.injectedQuotaFailures}, paid calls=${s.providerCalls.length-before}, HTTP=${result.status}`);
  assert.notEqual(result.status,200,'Unknown quota must not be presented as a successful new paid turn');
});
