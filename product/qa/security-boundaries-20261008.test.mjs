// Synthetic records/providers only. Reuses the existing agent HTTP harness.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import ts from 'typescript';
const product=fileURLToPath(new URL('../',import.meta.url));
let helper=fs.readFileSync(new URL('./agent-server.test.mjs',import.meta.url),'utf8').split("test('로그인 안 함")[0];
helper=helper.replace("import ts from 'typescript';",`import ts from ${JSON.stringify(pathToFileURL(path.join(product,'node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);",`const DIR = new URL(${JSON.stringify(pathToFileURL(path.join(product,'supabase/functions/doit-agent/')).href+'/')});`);
const temp=path.join(fs.mkdtempSync(path.join(tmpdir(),'echo-security-harness-')),'harness.mjs');
fs.writeFileSync(temp,helper+'\nexport {load,newState,ID};\n');
const {load,newState,ID}=await import(pathToFileURL(temp).href);
function moduleAt(relative){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(product,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,Error,Number,Array,JSON,Uint8Array,TextDecoder});return m.exports;}
const {readJsonObject}=moduleAt('supabase/functions/_shared/read-json-limited.ts');
const {browserOriginAllowed,browserCorsHeaders}=moduleAt('supabase/functions/_shared/browser-cors.ts');
const {durableRateDecision}=moduleAt('supabase/functions/_shared/durable-rate-limit.ts');
const req=(body,type='application/json')=>new Request('https://synthetic.invalid',{method:'POST',headers:{'content-type':type},body});

test('actual agent rejects 64KiB JSON without Content-Length before DB/model action',async()=>{
  const s=newState(),r=await load(s).call({action:'agent_get',padding:'x'.repeat(65536)});
  assert.equal(r.status,413);assert.equal(s.aiCalls.length,0);assert.equal(s.tables.doit_request_events?.length??0,0);
});
test('actual agent counts UTF-8 bytes, not characters',async()=>{
  const s=newState(),r=await load(s).call({action:'agent_get',padding:'가'.repeat(12000)});assert.equal(r.status,413);assert.equal(s.aiCalls.length,0);
});
test('bounded parser accepts ordinary object and rejects malformed JSON/media/array/UTF-8',async()=>{
  assert.equal((await readJsonObject(req('{"action":"agent_get"}'),32768)).action,'agent_get');
  for(const [body,type,status] of [['{}','text/plain',415],['{','application/json',400],['[]','application/json',400],[new Uint8Array([123,34,120,34,58,34,255,34,125]),'application/json',400]]){
    await assert.rejects(readJsonObject(req(body,type),32768),e=>e.status===status);
  }
});
test('server byte limits preserve agent/connect 32KiB, understanding 64KiB and admin 8KiB',async()=>{
  await assert.rejects(readJsonObject(req(JSON.stringify({padding:'x'.repeat(8192)})),8192),e=>e.status===413);
  assert.equal((await readJsonObject(req(JSON.stringify({padding:'x'.repeat(40000)})),65536)).padding.length,40000);
});
test('untrusted browser origin is rejected without authorizing or writing',async()=>{
  const s=newState(),h=load(s);const r=await h.raw(new Request('https://synthetic.invalid',{method:'POST',headers:{origin:'https://untrusted.invalid','content-type':'application/json',authorization:'Bearer synthetic'},body:'{"action":"agent_get"}'}));
  assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);assert.match(r.headers.get('vary'),/Origin/);assert.equal(s.aiCalls.length,0);
});
test('CORS exact allowlist has no wildcard, rejects null/lookalikes and retains token-independent server requests',()=>{
  const allow=['https://app.do-it.company'];
  assert.equal(browserOriginAllowed(null,allow),true);
  for(const origin of ['null','*','https://app.do-it.company.evil.invalid','https://evil.invalid'])assert.equal(browserOriginAllowed(origin,allow),false);
  assert.equal(browserOriginAllowed('https://app.do-it.company',allow),true);
  assert.equal(browserCorsHeaders('https://app.do-it.company',allow)['Access-Control-Allow-Origin'],'https://app.do-it.company');
  assert.equal(browserCorsHeaders('https://evil.invalid',allow)['Access-Control-Allow-Origin'],undefined);
});
test('enabled durable limiter fails closed for RPC exception, error, unknown and nonboolean response',async()=>{
  for(const rpc of [async()=>{throw new Error('down');},async()=>({data:true,error:{code:'error'}}),async()=>({data:null,error:null}),async()=>({data:'true',error:null})])assert.equal(await durableRateDecision({rpc},ID.user,'agent',true),'unavailable');
  assert.equal(await durableRateDecision({rpc:async()=>({data:false,error:null})},ID.user,'agent',true),'limited');
});
test('actual agent enabled limiter shares synthetic atomic decisions across two workers; trusted identity only',async()=>{
  const s=newState();s.env={ECHO_DURABLE_RATE_LIMIT_ENABLED:'true'};let used=0;
  s.securityRateRpc=async(name,args)=>{assert.equal(name,'echo_consume_api_rate');assert.equal(args.p_user_id,ID.user);assert.equal(args.p_route,'agent');return {data:++used<=30,error:null};};
  const a=load(s),b=load(s);
  for(let i=0;i<30;i++)assert.equal((await a.call({action:'agent_get',userId:'forged-other-user'})).status,200);
  assert.equal((await b.call({action:'agent_get'})).status,429);assert.equal(s.aiCalls.length,0);
});
test('actual agent enabled missing limiter prevents a successful action without hiding an error',async()=>{
  const s=newState();s.env={ECHO_DURABLE_RATE_LIMIT_ENABLED:'true'};s.securityRateRpc=async()=>({data:null,error:{code:'42883'}});
  const r=await load(s).call({action:'agent_get'});assert.equal(r.status,503);assert.equal(s.aiCalls.length,0);
});
test('disabled limiter keeps old local policy explicitly; no claim of distributed runtime enforcement',async()=>{
  let calls=0;assert.equal(await durableRateDecision({rpc:async()=>{calls++;}},ID.user,'agent',false),'disabled');assert.equal(calls,0);
});

test('actual disabled legacy handler denies anonymous and authenticated calls without provider or DB access',async()=>{
  let handler;let calls=0;
  const blocked=()=>{calls++;throw new Error('LEGACY_PROVIDER_OR_DB_ACCESS');};
  const module={exports:{}};
  const source=fs.readFileSync(path.join(product,'supabase/functions/openai-chat/index.ts'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    module,exports:module.exports,require:()=>({createClient:blocked}),
    Deno:{env:{get:()=>undefined},serve:h=>{handler=h;}},Request,Response,fetch:blocked,
  });
  for(const authorization of [undefined,'Bearer synthetic']){
    const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:'{"prompt":"synthetic"}'}));
    assert.equal(response.status,410);assert.equal((await response.json()).code,'LEGACY_DISABLED');
  }
  assert.equal((await handler(new Request('https://synthetic.invalid',{method:'OPTIONS'}))).status,204);
  assert.equal(calls,0);
});
