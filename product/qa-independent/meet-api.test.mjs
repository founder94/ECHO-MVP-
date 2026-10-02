import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetApi} from '../supabase/functions/doit-connect/meetApi.ts';
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
test('default disabled: zero database access',async()=>{const {s,db}=fixture();const api=createMeetApi(db,async()=>{throw Error('must not read');});await assert.rejects(api.status(mid,a),e=>e.code==='MEET_NOT_CONFIGURED');assert.equal(s.reads,0);});
test('nonparticipant cannot read existing room or mutate confirmation',async()=>{const {s,api}=fixture();await assert.rejects(api.status(mid,c),e=>e.status===404);await assert.rejects(api.check(mid,c,sid),e=>e.status===404);assert.equal(s.writes,0);});
test('server evidence alone does not imply appearance or meeting intent',async()=>{const {api}=fixture();assert.deepEqual(await api.status(mid,a),{ok:true,state:'need_my_check',allowed:false,sessionId:sid});});
test('unsigned, other room, or camera off evidence cannot enable confirmation',async()=>{for(const mutate of [s=>s.t.doit_video_sessions[0].signature_verified=false,s=>s.t.doit_video_sessions[0].match_id=mid.replace('4','7'),s=>s.t.doit_video_participation[1].camera_on_seconds=0]){const {s,api}=fixture();mutate(s);await assert.rejects(api.check(mid,a,sid),e=>e.code==='MEET_UNAVAILABLE');assert.equal(s.writes,0);}});
test('each participant confirms own appearance; retries preserve one row',async()=>{const {s,api}=fixture();await api.check(mid,a,sid);const replay=await api.check(mid,a,sid);assert.equal(replay.replayed,true);assert.equal(s.t.doit_meet_checks.length,1);assert.equal(s.t.doit_meet_checks[0].user_id,a);await assert.rejects(api.requireMeetingAllowed(mid,a),e=>e.code==='MEET_UNAVAILABLE');});
test('both checks and both yes permit plan; new no intent closes permission',async()=>{const {s,api}=fixture();await api.check(mid,a,sid);await api.check(mid,b,sid);await api.intent(mid,a,sid,'yes',rid);await api.intent(mid,b,sid,'yes',rid);assert.deepEqual(await api.requireMeetingAllowed(mid,a),{matchId:mid,sessionId:sid});s.t.doit_meet_intents.push({session_id:sid,user_id:b,intent:'no',created_at:'2026-10-02T00:02:00Z'});await assert.rejects(api.requireMeetingAllowed(mid,a),e=>e.code==='MEET_UNAVAILABLE');});
test('logical intent retry stable, changed payload conflict, actors separate',async()=>{const {s,api}=fixture();await api.intent(mid,a,sid,'yes',rid);assert.equal((await api.intent(mid,a,sid,'yes',rid)).replayed,true);await assert.rejects(api.intent(mid,a,sid,'no',rid),e=>e.code==='REQUEST_CONFLICT');await api.intent(mid,b,sid,'no',rid);assert.equal(s.t.doit_meet_intents.length,2);const status=await api.status(mid,a);assert.equal(JSON.stringify(status).includes('intent'),false);});
test('current policy block, withdrawal, stage, safety prevent writes',async()=>{for(const mutate of [s=>s.policy.blocked=true,s=>s.policy.consent.b=null,s=>s.policy.lastStepOpen=false,s=>s.policy.safetyHold=true]){const {s,api}=fixture();mutate(s);await assert.rejects(api.check(mid,a,sid),e=>e.code==='MEET_UNAVAILABLE');assert.equal(s.writes,0);}});
test('connection closes during evidence reads: current read prevents write',async()=>{const {s,api}=fixture();s.hook=n=>{if(n==='doit_meet_intents')s.t.doit_matches[0].status='closed';};await assert.rejects(api.check(mid,a,sid),e=>e.code==='MEET_UNAVAILABLE');assert.equal(s.writes,0);});
test('read failure and partial evidence fail closed rather than empty',async()=>{const {s,api}=fixture();s.fail='doit_video_sessions';await assert.rejects(api.status(mid,a),e=>e.code==='MEET_READ_FAILED');s.fail=null;s.t.doit_video_sessions=Array.from({length:501},()=>s.t.doit_video_sessions[0]);await assert.rejects(api.status(mid,a),e=>e.code==='MEET_READ_INCOMPLETE');});
test('policy or durable write failure cannot grant meeting permission',async()=>{const {s,api}=fixture();s.fail='policy';await assert.rejects(api.status(mid,a));s.fail=null;s.writeFail='doit_meet_checks';await assert.rejects(api.check(mid,a,sid),e=>e.code==='MEET_WRITE_FAILED');assert.equal(s.t.doit_meet_checks.length,0);});

test('HTTP adapter uses verified actor; body assertions cannot bypass final stage',async()=>{const {s,api}=fixture();s.policy.lastStepOpen=false;const r=await api.handle('meet_check',{matchId:mid,sessionId:sid,user_id:b,allowed:true,lastStepOpen:true},a);assert.equal(r.status,409);assert.equal(s.writes,0);const noauth=await api.handle('meet_status',{matchId:mid,user_id:a},'');assert.equal(noauth.status,401);});
test('equal latest intent timestamps fail closed, not arbitrary yes',async()=>{const {s,api}=fixture();s.t.doit_meet_intents=[{session_id:sid,user_id:a,intent:'yes',created_at:'2026-10-02T00:01:00Z'},{session_id:sid,user_id:a,intent:'no',created_at:'2026-10-02T00:01:00Z'}];await assert.rejects(api.status(mid,a),e=>e.code==='MEET_INTENT_ORDER_UNRESOLVED');});
test('unknown policy errors never expose internal details through HTTP',async()=>{const {s,api}=fixture();s.fail='policy';const r=await api.handle('meet_status',{matchId:mid},a);assert.deepEqual(r,{status:503,body:{ok:false,code:'MEET_UNAVAILABLE'}});});

test('joint session id is visible only with current confirmation access',async()=>{const {s,api}=fixture();assert.equal((await api.status(mid,a)).sessionId,sid);s.policy.blocked=true;assert.equal('sessionId' in await api.status(mid,a),false);s.policy.blocked=false;s.policy.lastStepOpen=false;assert.equal('sessionId' in await api.status(mid,a),false);});
