// 2026-10-05 Codex echo-review(PR #131 댓글 5990611762) 재현 — 입력·기대값 그대로(실제 run/send/onPop 처리 함수를 뽑아 돌리는 모의 검사 · 브라우저 아님). 바꾼 곳은 경로 기본값뿐.
// Exact UI source handler integration; synthetic pending server replies.
// Not a browser, real device, real server or render/accessibility PASS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Script,createContext} from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=process.env.ECHO_UI_REVIEW_SOURCE ?? fileURLToPath(new URL('../../', import.meta.url));
assert.ok(root);
const ts=createRequire(import.meta.url)(process.env.ECHO_REVIEW_TYPESCRIPT ?? 'typescript');
const file=path.join(root,'product/src/doit/components/feature/AgentConversation.tsx');
const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const found={run:[],send:[],onPop:[]};
function visit(n){
 if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&found[n.name.text]&&n.initializer&&ts.isArrowFunction(n.initializer))found[n.name.text].push(n.initializer.getText(sf));
 ts.forEachChild(n,visit);
}
visit(sf);
for(const [name,items] of Object.entries(found))assert.equal(items.length,1,`Exactly one current ${name} handler`);
const js=ts.transpileModule(`globalThis.actualRun=${found.run[0]};globalThis.send=${found.send[0]};globalThis.onPop=${found.onPop[0]};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function fixture({fail=false}={}){
 const state={draft:'보기를 고르기 전에 적어 둔 내 설명',pick:{choice:'말을 잘 들어주는 사람'},editing:false,busy:null,error:null,notices:[],providerCalls:0};
 let resolve,reject;
 const gate=new Promise((a,b)=>{resolve=a;reject=b;});
 const tasks=[];
 const setter=(k,v)=>{state[k]=typeof v==='function'?v(state[k]):v;};
 const context=createContext({
  session:{id:'synthetic-session',phase:'active',current_question:'어떤 사람이 편해요?',current_rescue:{show:true},mode:'TEXT',messages:[]},
  rescueFor:null,userId:'synthetic-user',alive:{current:true},inFlight:{current:false},
  voice:{listening:false,stop(){}},voiceTurn:{current:false},unlockSpeech(){},VOICE_CONVERSATION_ENABLED:false,TEXT_MAX:4000,
  speakNew(){},setSession(v){state.session=v;},
  setDraft:v=>setter('draft',v),setPick:v=>setter('pick',v),setBusy:v=>setter('busy',v),setError:v=>setter('error',v),
  setNotice:v=>state.notices.push(v),setEditingPrevious:v=>setter('editing',v),setHintFor(){},
  editingRef:{current:false},lastAnswerRef:{current:'앞에서 확정한 답'},
  window:{history:{state:null,pushState(v){this.state=v;}}},
  mark(){context.window.history.pushState({echoBackGuard:true},'');},
  agentTurn:async()=>{state.providerCalls++;return gate;},
  UnderstandingError:class extends Error{},SEND_ERROR:'synthetic send failed',load:async()=>{}
 });
 new Script(js).runInContext(context);
 context.run=(...args)=>{const p=context.actualRun(...args);tasks.push(p);return p;};
 const reply={session:{id:'synthetic-session',phase:'active',current_question:'다음 질문',messages:[]},turn:{after:false,reply:''}};
 return {state,context,finish:async()=>{fail?reject(new Error('synthetic network failure')):resolve(reply);await Promise.all(tasks);}};
}
test('sending a rescue choice keeps the draft while pending, then clears it only after server success',async()=>{
 const f=fixture(),original=f.state.draft;
 f.context.send('말을 잘 들어주는 사람',false,false,'말을 잘 들어주는 사람');
 assert.equal(f.state.draft,original);assert.equal(f.context.inFlight.current,true);
 await f.finish();
 assert.equal(f.state.providerCalls,1);assert.equal(f.state.draft,'');assert.equal(f.context.inFlight.current,false);
});
test('failed rescue-choice send preserves the draft and selected answer for retry',async()=>{
 const f=fixture({fail:true}),original=f.state.draft;
 f.context.send('말을 잘 들어주는 사람',false,false,'말을 잘 들어주는 사람');
 await f.finish();
 assert.equal(f.state.draft,original);assert.equal(f.state.pick.choice,'말을 잘 들어주는 사람');assert.equal(f.context.inFlight.current,false);
});
test('hardware back during a pending send must not replace the current draft or open an unrelated correction editor',async()=>{
 const f=fixture(),original=f.state.draft;
 f.context.send('말을 잘 들어주는 사람',false,false,'말을 잘 들어주는 사람');
 let observed;
 try{
  assert.equal(f.context.inFlight.current,true);
  f.context.onPop();
  observed={draft:f.state.draft,editing:f.state.editing};
 }finally{await f.finish();}
 console.log('synthetic pending-send popstate',JSON.stringify(observed));
 assert.deepEqual(observed,{draft:original,editing:false});
});

