// Pure/HTTP-shaped source tests. DB/provider are synthetic; these are not live QA/model/device results.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import ts from 'typescript'; import vm from 'node:vm';
import {load,newState,ID,rid,T} from './memory-harness.mjs';
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../supabase/functions/doit-agent/history-retrieval.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date,JSON,String,Number,Object,Array,Set,Error});const H=mod.exports;
const persisted=JSON.parse(readFileSync(new URL('./fixtures/long-term-memory-synthetic.json',import.meta.url),'utf8'));
const state=k=>structuredClone(persisted[k]);const session=s=>s.tables.doit_request_events.find(r=>r.action==='agent_session');
const OLD='10년 뒤 회사가치 500억 원이면 매각을 검토한다'; const NEW='10년 뒤 회사가치 5,000억 원이면 매각을 검토한다';
test('invalid and cross-scope recall cursors fail before any provider call',async()=>{for(const [intent,cursor] of [['history',{offset:1000001}],['history',{match:100001}],['current',{offset:50}]]){const s=state('a');s.aiCalls=[];const r=await load(s).call({action:'agent_recall',query:'회사가치',intent,cursor});assert.equal(r.status,400);assert.equal(s.aiCalls.length,0);}});
test('A old original outside recent ten retrieved by actual memory HTTP path with source; no AI/state write',async()=>{
 const s=state('a'),row=session(s),before=JSON.stringify(s.tables);s.aiCalls=[];const r=await load(s).call({action:'agent_recall',query:'처음 회사가치 목표',intent:'history'});assert.equal(r.status,200,JSON.stringify(r));assert.ok(r.body.memory.evidence.some(e=>e.quote===OLD&&e.turn===1));assert.equal(s.aiCalls.length,0);assert.equal(JSON.stringify(s.tables),before);assert.ok(!row.response_payload.state.turns.slice(-10).some(t=>t.user===OLD));
});
test('B corrected current number and historical original remain distinct with exact citations',async()=>{
 const s=state('b');const api=load(s);const old=await api.call({action:'agent_recall',query:'처음 회사가치 목표',intent:'history'});assert.ok(old.body.memory.evidence.some(e=>e.quote===OLD&&e.validity==='HISTORICAL_ONLY'));
 const current=await api.call({action:'agent_recall',query:'회사가치 목표',intent:'current'});assert.ok(current.body.memory.evidence.some(e=>e.quote===NEW&&e.validity==='CURRENT_CONFIRMED'));assert.ok(!current.body.memory.evidence.some(e=>e.quote===OLD));assert.equal(H.verifyCitation(current.body.memory,'fake',NEW,true),false);
});
test('C rejected AI meaning is not a recalled original or current Matching fact',async()=>{
 const s=state('c');const r=await load(s).call({action:'agent_recall',query:'매일 연락을 좋아하는 사람',intent:'current'});assert.equal(r.status,200);assert.ok(!r.body.memory.evidence.some(e=>e.quote==='매일 연락을 좋아하는 사람'));assert.equal(r.body.memory.evidence.some(e=>e.matching_promotion),false);
});
test('D missing history is explicit NOT_FOUND with no made-up amount',async()=>{const r=await load(state('a')).call({action:'agent_recall',query:'목성 탐사선의 선장',intent:'history'});assert.equal(r.status,200);assert.equal(r.body.memory.status,'NOT_FOUND');assert.equal(r.body.memory.evidence.length,0);assert.equal(r.body.reply.includes('500'),false);});
test('E foreign user isolation and read failure preserve saved state/provider=0',async()=>{
 const s=state('a');s.authUser.id=ID.other;s.aiCalls=[];const before=JSON.stringify(s.tables);const foreign=await load(s).call({action:'agent_recall',query:'회사가치',intent:'history'});assert.equal(foreign.body.memory.status,'NOT_FOUND');assert.equal(JSON.stringify(s.tables),before);
 s.authUser.id=ID.user;s.failReads=['doit_request_events'];const failed=await load(s).call({action:'agent_recall',query:'회사가치',intent:'history'});assert.ok(failed.status>=500);assert.equal(s.aiCalls.length,0);assert.equal(JSON.stringify(s.tables),before);
});
test('F forgotten original excluded from historical retrieval and next model input',async()=>{
 const s=state('f');const r=await load(s).call({action:'agent_recall',query:'주말 연락',intent:'history'});assert.ok(!r.body.memory.evidence.some(e=>e.quote.includes('주말에만 연락')));const row=session(s);assert.ok(!H.allowedRecent(row.response_payload.state,10).some(t=>t.user.includes('주말에만 연락')));
});
test('history can read old owned round/purpose explicitly without resuming or changing current scope',async()=>{
 const s=state('a');s.authUser.user_metadata={doit_round_started_at:'2026-12-01T00:00:00Z'};const before=JSON.stringify(s.tables);const r=await load(s).call({action:'agent_recall',query:'회사가치',intent:'history'});assert.equal(r.status,200);assert.ok(r.body.memory.evidence.some(e=>e.quote===OLD));assert.equal(JSON.stringify(s.tables),before);const current=await load(s).call({action:'agent_recall',query:'회사가치',intent:'current'});assert.equal(current.body.memory.evidence.length,0);
});
test('control help/fatigue/skip never promoted, AI-only notes never become original',()=>{
 const r=session(state('a'));for(const kind of ['fatigue','help','skip','repair','stop'])r.response_payload.state.turns.push({n:100+r.response_payload.state.turns.length,user:'회사가치 목표가 너무 많아요',kind});const m=H.recallRows([r],ID.user,'회사가치','history',r.request_id);assert.ok(!m.evidence.some(e=>e.quote==='회사가치 목표가 너무 많아요'));assert.ok(!m.evidence.some(e=>e.quote==='장기 계획을 소중하게 생각함'));
});
test('invalid cursors/Infinity and malformed record fail closed',async()=>{const r=session(state('a'));assert.throws(()=>H.recallRows([r],ID.user,'회사가치','history',r.request_id,{match:Infinity}));const invalid=await load(state('a')).call({action:'agent_recall',query:'회사가치',cursor:{offset:-1}});assert.equal(invalid.status,400);const bad=structuredClone(r);bad.applied_revision=null;assert.throws(()=>H.recallRows([bad],ID.user,'회사가치','history',bad.request_id));});
test('explicit recall during conversation is model-free and does not overwrite preferences',async()=>{
 const s=state('a');s.aiCalls=[];const row=session(s),before=JSON.stringify(s.tables);const r=await load(s).call({action:'agent_turn',sessionId:row.request_id,requestId:rid(),text:'처음 정한 회사 가치 목표가 얼마였나요?'});assert.equal(r.status,200);assert.equal(r.body.turn.saved,false);assert.ok(r.body.turn.reply.includes('500억'));assert.equal(s.aiCalls.length,0);assert.equal(JSON.stringify(s.tables),before);
});
test('ordinary turn includes relevant old original through existing provider; no added provider',async()=>{
 const s=state('a');s.ai=[T({kind:'ask',next:{type:'core',purpose:'values_character',question:'목표 얘기하며 떠오른 장면이 있어요?'}})];s.aiCalls=[];const row=session(s);const r=await load(s).call({action:'agent_turn',sessionId:row.request_id,requestId:rid(),text:'회사가치 목표에 관해 이야기하고 싶어요'});assert.equal(r.status,200,JSON.stringify(r));assert.ok(s.aiCalls.some(c=>c.input?.memory_context?.evidence.some(e=>e.quote===OLD)));assert.equal(s.aiCalls.filter(c=>c.input?.memory_context).length,1);
});
test('30 self notes do not silently discard earliest when next save requested',async()=>{
 const s=state('notes');const row=s.tables.doit_request_events.find(r=>r.action==='agent_self_notes');assert.ok(row);row.response_payload.notes=Array.from({length:30},(_,i)=>({id:'note'+i,text:'내가 직접 남긴 문장 '+i,at:'2026-01-01T00:00:00Z',origin:'self'}));const before=JSON.stringify(row.response_payload.notes);const r=await load(s).call({action:'agent_self_note',requestId:rid(),text:'새로 추가하려는 문장'});assert.equal(r.status,409);assert.equal(r.body.code,'MEMORY_FULL');assert.equal(JSON.stringify(row.response_payload.notes),before);
});
test('paging signals unread rows and excess matches instead of complete/no memory',()=>{
 const r=session(state('a'));r.response_payload.state.turns=Array.from({length:9},(_,i)=>({n:i+1,user:'회사가치 목표 '+i,kind:'answer'}));r.response_payload.state.slots={};const one=H.recallRows([r],ID.user,'회사가치','history',r.request_id,{rowMore:true});assert.equal(one.status,'PARTIAL');assert.equal(one.complete,false);assert.equal(one.next.match,6);const two=H.recallRows([r],ID.user,'회사가치','history',r.request_id,{match:6,rowMore:true});assert.equal(two.evidence.length,3);assert.equal(two.next.offset,1);
});
// 2026-10-10 Codex P1(4236595815): 실제로 묻거나 청할 때만 기억 찾기 — 「기억하는 사람」 같은 선호 답은 보통 답으로 저장
test('memoryQuestion: preference answers about remembering are ordinary answers, real asks are recall',()=>{
 for(const t of ['뭐든 잘 기억하는 사람이 좋아요','어떤 이야기도 기억하는 사람이 편해요','작은 것도 기억해 주는 친구가 좋아요','기억하는 사람이 좋아요?']) assert.equal(H.memoryQuestion(t),false,t);
 for(const t of ['처음 정한 회사 가치 목표가 얼마였나요?','내가 예전에 뭐라고 말했는지 기억해?','지금 정한 목표 알려 주세요','제가 처음에 말한 목표가 뭐였지']) assert.equal(H.memoryQuestion(t),true,t);
});
// 2026-10-10 Codex P2(4236595819): 한 턴의 여러 줄 중 한 줄만 지워도 나머지 확인된 줄은 찾는다 · 지운 줄은 0
test('recallRows: deleting one line of a multi-fact turn keeps the other confirmed line findable',()=>{
 const st={goal:'friend',turns:[{n:1,user:'저는 주말마다 등산을 다니고 고양이 두 마리를 키워요',kind:'answer'}],slots:{a:{items:[{turn:1,quote:'주말마다 등산을 다니고',note:'주말 등산',status:'FORGOTTEN',source_type:'USER_DIRECT'},{turn:1,quote:'고양이 두 마리를 키워요',note:'고양이 두 마리',status:'CONFIRMED',source_type:'USER_DIRECT'}]}},forgotten:['주말 등산']};
 const row={user_id:'u1',request_id:'s1',action:'agent_session',status:'applied',created_at:'2026-10-10T00:00:00Z',applied_revision:3,response_payload:{state:st}};
 for(const intent of ['current','history']){
  const cat=H.recallRows([row],'u1','고양이',intent,'s1');assert.ok(cat.evidence.some(e=>e.quote==='고양이 두 마리를 키워요'),intent);
  const hike=H.recallRows([row],'u1','등산',intent,'s1');assert.equal(hike.evidence.length,0,`${intent}: 지운 줄 0`);
 }
 // 줄로 나뉘지 않은 원문은 그 턴에 지운 것이 있으면 통째로 쓰지 않는다
 const raw=structuredClone(row);raw.response_payload.state.slots.a.items=[{turn:1,quote:'주말마다 등산을 다니고',note:'주말 등산',status:'FORGOTTEN',source_type:'USER_DIRECT'}];
 assert.equal(H.recallRows([raw],'u1','고양이','history','s1').evidence.length,0);
});
// 2026-10-10 Codex P1(4236681719): 지난 말을 되묻는 진짜 기억 질문은 「기억해 주는 친구」가 들어 있어도 기억 찾기
test('memoryQuestion: a real recall of a remembered-person preference is still recall',()=>{
 for(const t of ['작은 것도 기억해 주는 친구가 좋다고 내가 말했지?','기억하는 사람이 좋다고 제가 예전에 말했나요?']) assert.equal(H.memoryQuestion(t),true,t);
 for(const t of ['뭐든 잘 기억하는 사람이 좋아요','작은 것도 기억해 주는 친구가 좋아요','기억하는 사람이 좋아요?']) assert.equal(H.memoryQuestion(t),false,t);
});
