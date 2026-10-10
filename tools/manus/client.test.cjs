'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { client, classify, submitOnce, receive, verifySmoke, SMOKE_SHA } = require('./client.cjs');
const ok = value => new Response(JSON.stringify({ ok: true, ...value }));
const approval = { fixture_sha256: SMOKE_SHA, cost_reported: true, paid_test_approved: true, estimated_credits: 1, approved_credits: 1 }; // Synthetic only; not a real estimate.
function store() { const m = new Map(); return { get: async k => m.get(k), cas: async (k, old, next) => { if ((m.get(k) ?? null) !== old) return false; m.set(k, next); return true; } }; }
test('read-only authentication exposes no key or account identifier', async () => {
  const seen = []; const api = client({ apiKey: 'synthetic-secret', fetchImpl: async (url, init) => { seen.push({ url, init }); return ok({ user_id: 'synthetic-account' }); } });
  const r = await api.auth(); assert.deepEqual(r, { authenticated: true }); assert.equal(seen[0].init.method, 'GET'); assert.equal(seen[0].url, 'https://api.manus.ai/v2/user.me');
});
test('authentication rejects HTTP denial and malformed identities without echoing response', async () => {
  for (const response of [new Response('synthetic-secret',{status:401}),ok({user_id:null})]) { const api=client({apiKey:'synthetic-secret',fetchImpl:async()=>response}); await assert.rejects(api.auth(),e=>!e.message.includes('synthetic-secret')); }
});
test('empty credentials and Infinity timeout rejected before network', () => { assert.throws(()=>client({apiKey:''})); assert.throws(()=>client({apiKey:'fake',timeoutMs:Infinity})); });
test('paid create is blocked unless exact reported synthetic fixture and positive finite estimate approved', async () => {
  let n=0;const api=client({apiKey:'fake',fetchImpl:async()=>{n++;return ok({task_id:'fixture',share_visibility:'private'});}});
  for(const a of [null,{...approval,cost_reported:false},{...approval,estimated_credits:null},{...approval,estimated_credits:Infinity},{...approval,fixture_sha256:'wrong'}]) await assert.rejects(api.createSmoke(a),e=>e.code==='PAID_TEST_BLOCKED');assert.equal(n,0);
});
test('one private task from racing workers; exact prompt has no files/internal records', async () => {
  let n=0; const api=client({apiKey:'fake',fetchImpl:async(url,init)=>{n++;const b=JSON.parse(init.body);assert.equal(b.share_visibility,'private');assert.equal(b.agent_profile,'lite');assert.equal(b.message.content.includes('supabase'),false);assert.deepEqual(b.message.connectors,[]);return ok({task_id:'fixture',share_visibility:'private'});}});
  const s=store();const r=await Promise.all([submitOnce(api,s,'approved-fixture',approval),submitOnce(api,s,'approved-fixture',approval)]);assert.equal(n,1);assert.ok(r.some(x=>x.state==='SUBMITTED'));assert.equal((await s.get('approved-fixture')).taskId,'fixture');
});
test('ambiguous create timeout retained; retry never submits another paid task', async () => {
  let n=0;const api=client({apiKey:'fake',fetchImpl:async()=>{n++;throw new Error('synthetic-secret');}});const s=store();await assert.rejects(submitOnce(api,s,'one',approval),e=>e.code==='NETWORK_FAILED'&&e.uncertain);const r=await submitOnce(api,s,'one',approval);assert.equal(r.state,'CREATE_UNCERTAIN');assert.equal(n,1);
});
test('receipt CAS failure does not become success or allow re-create', async () => {
  let calls=0;const api={createSmoke:async()=>{calls++;return{taskId:'fixture'};}};const s=store();const base=s.cas;s.cas=async(k,o,n)=>n.state==='SUBMITTED'?false:base(k,o,n);await assert.rejects(submitOnce(api,s,'one',approval),e=>e.code==='RECEIPT_CAS_FAILED');await submitOnce(api,s,'one',approval);assert.equal(calls,1);
});
test('stopped without background status, background jobs, errors and waiting never imply success',()=>{assert.equal(classify({status:'stopped'}),'UNKNOWN');assert.equal(classify({status:'stopped',has_running_background_jobs:true}),'RUNNING');assert.equal(classify({status:'error'}),'FAILED');assert.equal(classify({status:'waiting'}),'WAITING');});
test('authenticated wrong task and messages IDs rejected',async()=>{const api=client({apiKey:'fake',fetchImpl:async()=>ok({task:{id:'other'},task_id:'other',messages:[],has_more:false})});await assert.rejects(api.detail('fixture'));await assert.rejects(api.messages('fixture'));});
test('bounded polling timeout does not delete, restart or declare completion',async()=>{let n=0;const r=await receive({detail:async()=>{n++;return{status:'running'};}},'fixture',{maxPolls:2,wait:async()=>{}});assert.equal(r.state,'POLL_TIMEOUT');assert.equal(r.verified,false);assert.equal(n,2);});
test('message pagination followed; exact typed synthetic result verified separately',async()=>{
  let n=0;const api={detail:async()=>({id:'fixture',status:'stopped',has_running_background_jobs:false}),messages:async(id,cursor)=>{n++;return cursor?{messages:[{id:'result',type:'assistant_message',assistant_message:{delivery_kind:'result',content:'{"echo":"ECHO_MANUS_SYNTHETIC_V1"}'}}],has_more:false}:{messages:[],has_more:true,next_cursor:'page2'};}};
  const r=await receive(api,'fixture',{wait:async()=>{}});assert.equal(r.verified,false);assert.equal(n,2);assert.equal(verifySmoke(r),true);assert.equal(verifySmoke({...r,candidateMessages:[{id:'x',type:'user_message',user_message:{content:'{"echo":"ECHO_MANUS_SYNTHETIC_V1"}'}}]}),false);
});
test('body PASS/no findings or user interruption never proves task result',()=>{for(const content of ['PASS','No findings','{"echo":"ECHO_MANUS_SYNTHETIC_V1","extra":true}'])assert.equal(verifySmoke({state:'RESULT_CANDIDATE',fixtureSha:SMOKE_SHA,candidateMessages:[{id:'result',type:'assistant_message',assistant_message:{delivery_kind:'result',content}}]}),false);});
test('cancel, invalid task identifiers, invalid poll limits rejected',async()=>{const api=client({apiKey:'fake',fetchImpl:async()=>{throw Error('must not run');}});await assert.rejects(api.detail('agent-default-main_task'));await assert.rejects(receive(api,'fixture',{maxPolls:Infinity}));await assert.rejects(receive(api,'fixture',{signal:{aborted:true}}),e=>e.code==='CANCELLED');});

test('progress-only or missing final-result typing is not completion, even with the exact JSON',()=>{for(const delivery_kind of [undefined,'progress','opening'])assert.equal(verifySmoke({state:'RESULT_CANDIDATE',fixtureSha:SMOKE_SHA,candidateMessages:[{id:'result',type:'assistant_message',assistant_message:{delivery_kind,content:'{"echo":"ECHO_MANUS_SYNTHETIC_V1"}'}}]}),false);for(const type of ['user_stop','error_message'])assert.equal(verifySmoke({state:'RESULT_CANDIDATE',fixtureSha:SMOKE_SHA,candidateMessages:[{id:'result',type:'assistant_message',assistant_message:{delivery_kind:'result',content:'{"echo":"ECHO_MANUS_SYNTHETIC_V1"}'}},{id:'stopped',type}]}),false);});

 
// Cancellation regressions: synthetic providers only; no HTTP, paid task or remote stop.
test('cancellation during detail read must stop before fetching result messages', async () => {
  const controller = new AbortController(); let messageReads = 0;
  const api = {
    async detail() { controller.abort(); return { id: 'synthetic-task', status: 'stopped', has_running_background_jobs: false }; },
    async messages() { messageReads++; return { messages: [{ id: 'synthetic-result', type: 'assistant_message', assistant_message: { delivery_kind: 'result', content: '{"echo":"ECHO_MANUS_SYNTHETIC_V1"}' } }], has_more: false }; },
  };
  await assert.rejects(receive(api, 'synthetic-task', { maxPolls: 1, signal: controller.signal }), error => error.code === 'CANCELLED');
  assert.equal(messageReads, 0);
});
test('cancellation while reading a page must stop before the next page', async () => {
  const controller = new AbortController(); let pageReads = 0;
  const api = {
    async detail() { return { id: 'synthetic-task', status: 'stopped', has_running_background_jobs: false }; },
    async messages() {
      pageReads++;
      if (pageReads === 1) { controller.abort(); return { messages: [], has_more: true, next_cursor: 'synthetic-page-two' }; }
      return { messages: [{ id: 'synthetic-result', type: 'assistant_message', assistant_message: { delivery_kind: 'result', content: '{"echo":"ECHO_MANUS_SYNTHETIC_V1"}' } }], has_more: false };
    },
  };
  await assert.rejects(receive(api, 'synthetic-task', { maxPolls: 1, signal: controller.signal }), error => error.code === 'CANCELLED');
  assert.equal(pageReads, 1);
});
test('final-page cancellation cannot deliver a candidate after abort', async () => {
  const controller = new AbortController(); let pages = 0;
  const api = {
    detail: async () => ({ status: 'stopped', has_running_background_jobs: false }),
    messages: async () => { pages++; controller.abort(); return { messages: [{ id: 'synthetic-final', type: 'assistant_message', assistant_message: { delivery_kind: 'result', content: '{"echo":"ECHO_MANUS_SYNTHETIC_V1"}' } }], has_more: false }; },
  };
  await assert.rejects(receive(api, 'synthetic-task', { maxPolls: 1, signal: controller.signal }), error => error.code === 'CANCELLED');
  assert.equal(pages, 1);
});
