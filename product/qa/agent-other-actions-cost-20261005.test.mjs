// 2026-10-05 Codex echo-review 20261005-other-actions-original(PR #132 댓글 5989819734) 재현 — Codex 입력·기대값 그대로(가짜 DB·가짜 AI).
// 바꾼 곳은 실행 장치뿐: ECHO_SOURCE_ROOT 기본값 = 이 저장소 · 생성 도우미는 임시 폴더.
// Independent review of remaining paid-call paths. Exact source; synthetic DB/AI only.
// Reuse existing repository helpers. No product edit, installed package or real API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const source = process.env.ECHO_SOURCE_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));
assert.ok(source, 'Pin ECHO_SOURCE_ROOT to the source under review');
const original = readFileSync(path.join(source, 'product/qa/agent-server.test.mjs'), 'utf8');
const prefix = original.slice(0, original.indexOf("test('로그인 안 함"));
assert.ok(prefix.includes('function load(state)') && prefix.includes('const newState'));
const helper = prefix
  .replace("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.join(source, 'product/node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(source, 'product/supabase/functions/doit-agent/')).href + '/')});`)
  + '\nexport {load,newState,T,Q,X,rid,ID};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'other-actions-')), 'pinned-other-actions-helpers.mjs'));
writeFileSync(file, helper);
const {load,newState,T,Q,X,rid,ID} = await import(file.href);
function setup() {
  const state = newState();
  state.env = { AI_POLICY: JSON.stringify({ version: 'synthetic-inflight-review', providers: { openai: { model: 'fixture', allow_user_text: true } }, tasks: { default: ['openai'] }, limits: { max_tokens_per_request: 60000 } }) };
  return {state,first:load(state),second:load(state)};
}
const opening = () => T({ extracted: [X('relationship_intent','편한 친구','친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort','어떤 사람이 편해요?') });
async function started() {
  const f = setup();
  f.state.ai.push(opening());
  const start = await f.first.call({action:'agent_start',requestId:rid(),firstAnswer:'친구. 편하게 만나고 싶어요'});
  assert.equal(start.status,200,JSON.stringify(start.body));
  return {...f,sessionId:start.body.session.id};
}
async function twoPending(f,body,sameRequest) {
  let release;
  const gate = new Promise(resolve=>{release=resolve;});
  f.state.fail = {openai:[{gate},{gate}]};
  const before = f.state.providerCalls?.length ?? 0;
  const request = {...body,requestId:rid()};
  const running = [f.first.call(request), f.second.call({...request,requestId:sameRequest?request.requestId:rid()})];
  let admitted;
  try {
    for(let i=0;i<80 && (f.state.providerCalls?.length??0)<before+2;i++) await new Promise(resolve=>setTimeout(resolve,5));
    admitted=(f.state.providerCalls?.length??0)-before;
  } finally {release();}
  const replies=await Promise.all(running);
  return {admitted,statuses:replies.map(r=>r.status)};
}
function atLastDailySlot(f) {
  const rows=f.state.tables.doit_request_events;
  const already=rows.filter(r=>r.action==='agent_usage' || (r.action==='agent_turn' && (r.response_payload?.record?.ai_usage?.attempts??0)>0)).length;
  assert.ok(already>=1 && already<199);
  rows.push(...Array.from({length:199-already},()=>({user_id:ID.user,request_id:rid(),action:'agent_turn',status:'applied',created_at:new Date().toISOString(),response_payload:{record:{ai_usage:{attempts:1}}}})));
}
test('agent_start: same in-flight request across workers admits at most one provider call',async()=>{
  const f=setup();f.state.ai.push(opening(),opening());
  const r=await twoPending(f,{action:'agent_start',firstAnswer:'친구. 편하게 만나고 싶어요'},true);
  assert.equal(r.admitted,1,JSON.stringify(r));
});
test('agent_intro: same in-flight request across workers admits at most one provider call',async()=>{
  const f=await started();
  // Reuse original server test's genuine stop-to-intro precondition.
  f.state.ai.push(T({kind:'stop'}),{summary:[],closing:'고마워요.',intro:[{text:'저는 요리를 잘해요.',basis:'요리'}]});
  const end=await f.first.call({action:'agent_turn',requestId:rid(),sessionId:f.sessionId,text:'그만할래요'});
  assert.equal(end.status,200,JSON.stringify(end.body));assert.equal(end.body.session.intro.status,'failed');
  f.state.ai.push(...Array.from({length:2},()=>({intro:[{text:'저는 편하게 만나는 사이가 좋아요.',basis:'편하게 만나고'}]})));
  const r=await twoPending(f,{action:'agent_intro',sessionId:f.sessionId},true);
  assert.equal(r.admitted,1,JSON.stringify(r));
});
test('agent_rescue: same in-flight request across workers admits at most one provider call',async()=>{
  const f=await started();
  f.state.rescue=[{choices:['잘 웃는 사람','말을 잘 들어주는 사람']},{choices:['잘 웃는 사람','말을 잘 들어주는 사람']}];
  const r=await twoPending(f,{action:'agent_rescue',sessionId:f.sessionId},true);
  assert.equal(r.admitted,1,JSON.stringify(r));
});
test('agent_rescue: last daily slot admits at most one of two different pending requests',async()=>{
  const f=await started();atLastDailySlot(f);
  f.state.rescue=[{choices:['잘 웃는 사람','말을 잘 들어주는 사람']},{choices:['잘 웃는 사람','말을 잘 들어주는 사람']}];
  const r=await twoPending(f,{action:'agent_rescue',sessionId:f.sessionId},false);
  assert.equal(r.admitted,1,JSON.stringify(r));
});

