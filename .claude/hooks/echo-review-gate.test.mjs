import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {reviewGate} from './echo-review-gate.mjs';
function fixture(enabled=true){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'echo-gate-'));
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
 git('init','-b','echo-qa');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
 fs.mkdirSync(path.join(dir,'.claude'));fs.writeFileSync(path.join(dir,'.claude/echo-review-gate.json'),JSON.stringify({enabled,max_reviews:3,timeout_ms:45000,base_ref:'echo-qa'}));
 fs.writeFileSync(path.join(dir,'app.txt'),'base');git('add','.');git('commit','-m','base');git('checkout','-b','work');fs.writeFileSync(path.join(dir,'app.txt'),'changed');
 return {dir,git,input:{cwd:dir,session_id:'test'}};
}
function executor(verdict='PASS',count={n:0},change){return(args)=>{count.n++;if(change)change();fs.writeFileSync(args[args.indexOf('-o')+1],JSON.stringify({verdict,reason:'fixture'}));return {status:0};};}
test('OFF: no executor calls',()=>{const f=fixture(false),n={n:0};assert.deepEqual(reviewGate(f.input,{execute:executor('PASS',n)}),{});assert.equal(n.n,0);});
test('FAIL -> Claude receives block -> changed source PASS -> cached PASS, only two calls',()=>{const f=fixture(),n={n:0};assert.equal(reviewGate(f.input,{execute:executor('FAIL',n)}).decision,'block');fs.writeFileSync(path.join(f.dir,'app.txt'),'fixed');assert.match(reviewGate(f.input,{execute:executor('PASS',n)}).systemMessage,/PASS/);assert.deepEqual(reviewGate(f.input,{execute:executor('FAIL',n)}),{});assert.equal(n.n,2);});
test('three failed rounds -> HOLD, no fourth call',()=>{const f=fixture(),n={n:0};for(let i=0;i<3;i++)assert.equal(reviewGate(f.input,{execute:executor('FAIL',n)}).decision,'block');assert.equal(reviewGate(f.input,{execute:executor('PASS',n)}).continue,false);assert.equal(n.n,3);});
test('executor failure/timeout is HOLD, not PASS',()=>{const f=fixture();assert.equal(reviewGate(f.input,{execute:()=>({status:1})}).continue,false);});
test('source changes during review -> block, not approval',()=>{const f=fixture();assert.equal(reviewGate(f.input,{execute:executor('PASS',{n:0},()=>fs.writeFileSync(path.join(f.dir,'app.txt'),'newer'))}).decision,'block');});
test('malformed review output cannot approve',()=>{const f=fixture();assert.equal(reviewGate(f.input,{execute:args=>{fs.writeFileSync(args[args.indexOf('-o')+1],'{}');return {status:0};}}).continue,false);});
test('missing session is HOLD without executor',()=>{assert.equal(reviewGate({cwd:'/tmp'}).continue,false);});
test('existing lock is retained, not removed by another attempt',()=>{const f=fixture();const d=path.join(f.dir,'.git/echo-review-gate');fs.mkdirSync(d);const lock=path.join(d,crypto.createHash('sha256').update('test').digest('hex')+'.lock');fs.writeFileSync(lock,'other');assert.equal(reviewGate(f.input,{execute:()=>{throw Error('must not run');}}).continue,false);assert.equal(fs.readFileSync(lock,'utf8'),'other');});
test('base commit changed -> HOLD before call',()=>{const f=fixture();reviewGate(f.input,{execute:executor('FAIL')});f.git('add','.');f.git('commit','-m','new');f.git('branch','-f','echo-qa','HEAD');let n=0;assert.equal(reviewGate(f.input,{execute:()=>{n++;return {status:0};}}).continue,false);assert.equal(n,0);});
