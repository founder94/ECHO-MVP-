'use strict';
// Actual Actions runner-to-runner CAS probe using the unchanged PR118 git store.
// Synthetic state only; no Manus task, model, product file, protected ref or secret value is written.
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {resolve,join} = require('node:path');
const fs = require('node:fs');
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const SHA = /^[0-9a-f]{40}$/;
const REPO = 'founder94/ECHO-MVP-';
const QUEUE_PIN = '542fc1465bb97fd13a5dfb6a574e3a716bacdd49';
function transition(state, key, phase) {
  if (!state || !Array.isArray(state.tasks)) throw new Error('INVALID_QUEUE_STATE');
  const next = structuredClone(state);
  const probes = next.manus_cas_probes ?? {};
  if (phase === 'init') {
    if (Object.hasOwn(probes,key)) throw new Error('DUPLICATE_PROBE');
    next.manus_cas_probes = {...probes,[key]:{state:'READY',fixture:'ECHO_CAS_SYNTHETIC_V1',tasks_hash:hash(state.tasks)}};
  } else if (phase === 'write') {
    if (probes[key]?.state !== 'READY' || probes[key].fixture !== 'ECHO_CAS_SYNTHETIC_V1') throw new Error('STALE_PROBE');
    next.manus_cas_probes = {...probes,[key]:{...probes[key],state:'CAS_WRITTEN'}};
  } else throw new Error('INVALID_PHASE');
  return next;
}
function verified(state,key,wins) {
  const p = state?.manus_cas_probes?.[key];
  return Array.isArray(state?.tasks) && p?.state === 'CAS_WRITTEN' && p.fixture === 'ECHO_CAS_SYNTHETIC_V1' && p.tasks_hash === hash(state.tasks) && wins.filter(x=>x===true).length===1 && wins.every(x=>typeof x==='boolean');
}
async function main() {
  if (process.env.GITHUB_REPOSITORY!==REPO || process.env.GITHUB_EVENT_NAME!=='workflow_dispatch' || process.env.GITHUB_ACTOR!=='founder94' || !/^\d+$/.test(process.env.GITHUB_RUN_ID??'') || !SHA.test(process.env.SOURCE_SHA??'')) throw new Error('UNAUTHORIZED_CONTEXT');
  const phase=process.argv[2];
  if (!['init','write','verify'].includes(phase)) throw new Error('INVALID_PHASE');
  const code=resolve(process.env.CODE_CWD??'.'),cwd=resolve(process.env.QUEUE_CWD??'.');
  const git=(args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const codeSha=execFileSync('git',['rev-parse','HEAD'],{cwd:code,encoding:'utf8'}).trim();
  if (codeSha!==process.env.SOURCE_SHA || git(['rev-parse','HEAD'])!==QUEUE_PIN) throw new Error('SOURCE_CHANGED');
  const metadata=await fetch('https://api.github.com/repos/'+REPO+'/actions/runs/'+process.env.GITHUB_RUN_ID,{headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if (!metadata.ok) throw new Error('RUN_METADATA_UNAVAILABLE');
  const run=await metadata.json();
  if (run.repository?.full_name!==REPO || run.actor?.login!=='founder94' || run.actor?.type!=='User' || run.event!=='workflow_dispatch') throw new Error('PRINCIPAL_MISMATCH');
  const {gitStore}=require(join(cwd,'tools/automation/queue-store-git.cjs'));
  const store=gitStore({cwd,ref:'refs/heads/echo-automation-state'}),key='cas_'+process.env.GITHUB_RUN_ID;
  const snap=store.load();
  let result;
  if (phase==='init') {
    if (!store.save(snap.rev,transition(snap.state,key,'init'))) throw new Error('INIT_CAS_CONFLICT');
    const after=store.load();
    if (after.state.manus_cas_probes?.[key]?.state!=='READY') throw new Error('INIT_NOT_DURABLE');
    fs.appendFileSync(process.env.GITHUB_OUTPUT,'base_rev='+after.rev+'\n');
    result={stage:'init',durable:true,paid_tasks:0};
  } else if (phase==='write') {
    const rev=process.env.BASE_REV;
    if (!SHA.test(rev??'')) throw new Error('INVALID_BASE_REV');
    const base=JSON.parse(git(['cat-file','blob',rev+':state.json']));
    const won=store.save(rev,transition(base,key,'write'));
    fs.appendFileSync(process.env.GITHUB_OUTPUT,'won='+String(won)+'\n');
    result={stage:'writer',won,paid_tasks:0};
  } else {
    const values=[process.env.WRITER_A,process.env.WRITER_B];
    if (!values.every(x=>['true','false'].includes(x)) || !verified(snap.state,key,values.map(x=>x==='true'))) throw new Error('CAS_PROOF_FAILED');
    result={stage:'reader',persistent_cas:'PASS',writers:2,winning_writers:1,existing_tasks_preserved:true,paid_tasks:0};
  }
  process.stdout.write(JSON.stringify(result)+'\n');
}
if(require.main===module)main().catch(e=>{process.stdout.write(JSON.stringify({state:'BLOCKED',code:/^[A-Z_]+$/.test(e.message??'')?e.message:'QUEUE_OPERATION_FAILED',paid_tasks:0})+'\n');process.exitCode=1;});
module.exports={transition,verified};
