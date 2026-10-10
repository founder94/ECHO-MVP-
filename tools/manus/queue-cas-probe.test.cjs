'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {transition,verified}=require('./queue-cas-probe.cjs');
test('synthetic probe preserves pre-existing STOP, fifth round, receipts and tasks',()=>{
 const old={tasks:[{id:'synthetic',state:'BLOCKED',rounds:5}],STOP:true,manus_receipts:{other:{opaque:true}}};
 const first=transition(old,'synthetic_probe','init'),next=transition(first,'synthetic_probe','write');
 assert.deepEqual(next.tasks,old.tasks);assert.equal(next.STOP,true);assert.deepEqual(next.manus_receipts,old.manus_receipts);assert.ok(!old.manus_cas_probes);
 assert.equal(verified(next,'synthetic_probe',[true,false]),true);
 assert.equal(verified(next,'synthetic_probe',[true,true]),false);
 assert.equal(verified(next,'synthetic_probe',[false,false]),false);
 assert.equal(verified(next,'synthetic_probe',['true',false]),false);
});
test('duplicate or late probe cannot reset state and task modification is not PASS',()=>{
 const init=transition({tasks:[]},'synthetic_probe','init');
 assert.throws(()=>transition(init,'synthetic_probe','init'),/DUPLICATE_PROBE/);
 const next=transition(init,'synthetic_probe','write');
 assert.throws(()=>transition(next,'synthetic_probe','write'),/STALE_PROBE/);
 next.tasks.push({id:'changed'});assert.equal(verified(next,'synthetic_probe',[true,false]),false);
 assert.throws(()=>transition({tasks:null},'synthetic_probe','init'),/INVALID_QUEUE_STATE/);
});
