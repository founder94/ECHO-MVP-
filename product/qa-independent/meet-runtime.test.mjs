import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetApi} from '../supabase/functions/doit-connect/meetApi.ts';
import {createMeetRuntime} from '../supabase/functions/doit-connect/meetRuntime.ts';
const a='10000000-0000-4000-8000-00000000000a', b='20000000-0000-4000-8000-00000000000b';
const c='30000000-0000-4000-8000-00000000000c', mid='40000000-0000-4000-8000-00000000000d';
const sid='50000000-0000-4000-8000-00000000000e', rid='60000000-0000-4000-8000-00000000000f';
function fixture() {
 const t={doit_matches:[{id:mid,user_a:a,user_b:b,status:'approved',created_at:'2026-10-01T00:00:00Z'}],
 doit_video_sessions:[{id:sid,match_id:mid,ended_at:'2026-10-02T00:00:00Z',signature_verified:true}],
 doit_video_participation:[a,b].map(user_id=>({session_id:sid,user_id,joined_at:'2026-10-01T23:59:00Z',left_at:'2026-10-02T00:00:00Z',camera_on_seconds:10})),
 doit_meet_checks:[],doit_meet_intents:[]};
 const s={reads:0,writes:0,fail:null,writeFail:null,hook:null,policy:{blocked:false,safetyHold:false,consent:{required:'v2',a:'v2',b:'v2'},lastStepOpen:true},t};
 const db={from(name){s.reads++;s.hook?.(name);let filters=[],cap=Infinity;
  const result=()=>{if(s.fail===name)return {data:null,error:{code:'08006'}};return {data:t[name].filter(r=>filters.every(f=>f(r))).slice(0,cap),error:null};};
  const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},in:(k,vs)=>{filters.push(r=>vs.includes(r[k]));return q;},limit:n=>{cap=n;return q;},
   maybeSingle:async()=>{const r=result();return {...r,data:r.data?.[0]??null};},then:(ok,bad)=>Promise.resolve(result()).then(ok,bad),
   insert:async r=>{s.writes++;if(s.writeFail===name)return {error:{code:'08006'}};
    if(t[name].some(x=>name==='doit_meet_checks'?x.user_id===r.user_id&&x.session_id===r.session_id:x.user_id===r.user_id&&x.request_id===r.request_id))return {error:{code:'23505'}};
    t[name].push({...r});return {error:null};}};
  return q;}};
 const api=createMeetApi(db,async()=>{if(s.fail==='policy')throw Error('policy unavailable');return s.policy;},{enabled:true,now:()=> '2026-10-02T00:01:00Z'});
 return {s,db,api};
}
const version='a'.repeat(64), newer='b'.repeat(64);
function runtime() {
 const {s,db}=fixture();
 const state={eligibleA:true,eligibleB:true,safetyHold:false,lastStepOpen:true,revealValid:true,stateVersion:version};
 const users=Object.fromEntries([a,b].map(id=>[id,{id,user_metadata:{doit_connect_consent_version:'connect-v2',doit_connect_consent_at:'2026-10-02T00:00:00Z'}}]));
 db.auth={admin:{getUserById:async id=>({data:{user:users[id]??null},error:s.authFail??null})}};
 s.t.blocks=[];
 s.t.doit_video_sessions[0].context_version=version;
 const rt=createMeetRuntime(db,{enabled:true,videoConsentVersion:'connect-v2',readCurrentState:async()=>state});
 const auth=id=>({getUser:async()=>({data:{user:{id}},error:null})});
 return {s,db,state,users,rt,auth};
}
test('runtime verifies Auth; body identity cannot impersonate participant',async()=>{
 const {s,rt,auth}=runtime();
 const denied=await rt.handle(auth(c),'meet_check',{matchId:mid,sessionId:sid,user_id:a,stateVersion:version});
 assert.equal(denied.status,404);assert.equal(s.writes,0);
 const expired=await rt.handle({getUser:async()=>({data:{user:{id:a}},error:Error('expired')})},'meet_status',{matchId:mid});
 assert.equal(expired.status,401);
});
test('runtime OFF/missing progression reader is unconnected, not normal zero',async()=>{
 const {db,auth}=runtime();const rt=createMeetRuntime(db,{enabled:true,videoConsentVersion:'connect-v2'});
 const r=await rt.handle(auth(a),'meet_status',{matchId:mid});
 assert.deepEqual(r,{status:503,body:{ok:false,code:'MEET_NOT_CONFIGURED'}});
});
test('old connect-v1 alone never authorizes new video flow',async()=>{
 const {db,state,auth}=runtime();const rt=createMeetRuntime(db,{enabled:true,videoConsentVersion:'connect-v1',readCurrentState:async()=>state});
 assert.equal((await rt.handle(auth(a),'meet_status',{matchId:mid})).status,503);
});
test('status publishes opaque version; stale or absent mutation version rejected',async()=>{
 const {rt,auth,s}=runtime();const r=await rt.handle(auth(a),'meet_status',{matchId:mid});
 assert.equal(r.body.stateVersion,version);
 for(const v of [undefined,newer])assert.equal((await rt.handle(auth(a),'meet_check',{matchId:mid,sessionId:sid,stateVersion:v})).body.code,'STATE_CHANGED');
 assert.equal(s.writes,0);
});
test('server eligibility, final stage, reveal version prevent confirmation',async()=>{
 for(const key of ['eligibleB','lastStepOpen','revealValid']){
  const {state,rt,auth,s}=runtime();state[key]=false;
  assert.equal((await rt.handle(auth(a),'meet_check',{matchId:mid,sessionId:sid,stateVersion:version,lastStepOpen:true,allowed:true})).status,409);
  assert.equal(s.writes,0);
 }
});
test('current Auth consent withdrawal or reverse block prevents writes',async()=>{
 for(const block of [false,true]){
  const {users,s,rt,auth}=runtime();
  if(block)s.t.blocks.push({id:rid,blocker_id:b,blocked_user_id:a});else users[b].user_metadata={};
  assert.equal((await rt.handle(auth(a),'meet_check',{matchId:mid,sessionId:sid,stateVersion:version})).status,409);
  assert.equal(s.writes,0);
 }
});
test('permission read failure is bounded error, no success or secret',async()=>{
 const {s,rt,auth}=runtime();s.authFail=Error('private token contents');
 const r=await rt.handle(auth(a),'meet_status',{matchId:mid});
 assert.deepEqual(r,{status:503,body:{ok:false,code:'MEET_PERMISSION_READ_FAILED'}});
});
test('session evidence must match current server consent/assets/context version',async()=>{
 const {s,rt,auth}=runtime();s.t.doit_video_sessions[0].context_version=newer;
 const r=await rt.handle(auth(a),'meet_check',{matchId:mid,sessionId:sid,stateVersion:version});
 assert.equal(r.status,409);assert.equal(s.writes,0);
});
test('normal persistence readback in new runtime, concurrent actor yes and retry',async()=>{
 const {s,db,state,rt,auth}=runtime();
 for(const id of [a,b])assert.equal((await rt.handle(auth(id),'meet_check',{matchId:mid,sessionId:sid,stateVersion:version})).status,200);
 const ask=id=>rt.handle(auth(id),'meet_intent',{matchId:mid,sessionId:sid,stateVersion:version,requestId:rid,intent:'yes'});
 const rs=await Promise.all([ask(a),ask(a),ask(b)]);
 assert.ok(rs.every(r=>r.status===200));assert.equal(s.t.doit_meet_intents.length,2);
 const reopened=createMeetRuntime(db,{enabled:true,videoConsentVersion:'connect-v2',readCurrentState:async()=>state});
 const restored=await reopened.handle(auth(a),'meet_status',{matchId:mid});
 assert.equal(restored.body.allowed,true);
 assert.deepEqual(await reopened.authorizePlan(auth(b),mid,version),{matchId:mid,sessionId:sid});
 assert.equal((await rt.handle(auth(a),'meet_intent',{matchId:mid,sessionId:sid,stateVersion:version,requestId:rid,intent:'no'})).status,409);
});
test('write failure then same logical retry recovers without memory fallback',async()=>{
 const {s,rt,auth}=runtime();s.writeFail='doit_meet_intents';
 const body={matchId:mid,sessionId:sid,stateVersion:version,requestId:rid,intent:'yes'};
 assert.equal((await rt.handle(auth(a),'meet_intent',body)).status,503);assert.equal(s.t.doit_meet_intents.length,0);
 s.writeFail=null;assert.equal((await rt.handle(auth(a),'meet_intent',body)).status,200);
 assert.equal(s.t.doit_meet_intents.length,1);
});
test('prior success never revives permission after consent/context/block change',async()=>{
 const {s,rt,auth}=runtime();
 for(const id of [a,b]){await rt.handle(auth(id),'meet_check',{matchId:mid,sessionId:sid,stateVersion:version});await rt.handle(auth(id),'meet_intent',{matchId:mid,sessionId:sid,stateVersion:version,requestId:rid,intent:'yes'});}
 s.t.blocks.push({id:c,blocker_id:b,blocked_user_id:a});
 await assert.rejects(rt.authorizePlan(auth(a),mid,version),e=>e.code==='MEET_UNAVAILABLE');
 assert.equal((await rt.handle(auth(a),'meet_status',{matchId:mid})).body.allowed,false);
});
test('admin uses current DB role, not claimed role; aggregate no raw intent or identities',async()=>{
 const {s,rt,auth}=runtime();s.t.profiles=[{id:a,role:'user'},{id:c,role:'admin'}];
 assert.equal((await rt.adminSummary(auth(a),mid)).status,403);
 const r=await rt.adminSummary(auth(c),mid);assert.equal(r.status,200);assert.equal(r.body.video.sessions,1);
 assert.equal(r.body.planAgreement.state,'not_connected');assert.equal(r.body.planAgreement.value,null);
 for(const value of [a,b,c,sid,'camera_on_seconds','not_now'])assert.equal(JSON.stringify(r.body).includes(value),false);
 s.t.profiles[1].role='user';assert.equal((await rt.adminSummary(auth(c),mid)).status,403);
});
test('admin read failure and disabled feature are errors, not zero counts',async()=>{
 const {s,db,rt,auth}=runtime();s.t.profiles=[{id:c,role:'admin'}];s.fail='doit_video_sessions';
 const failed=await rt.adminSummary(auth(c),mid);assert.equal(failed.status,503);assert.equal('video' in failed.body,false);
 const off=createMeetRuntime(db);const disabled=await off.adminSummary(auth(c),mid);assert.equal(disabled.body.code,'MEET_NOT_CONFIGURED');
});
