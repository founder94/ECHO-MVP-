// Existing TypeScript AST/VM approach; source handlers + synthetic API only.
// Does not establish browser, actual server/model, accessibility or device success.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createContext,Script} from 'node:vm';
const file=new URL('../src/doit/components/feature/AgentConversation.tsx',import.meta.url);
const sf=ts.createSourceFile(file.pathname,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const handlers={};
const attr=(node,name)=>node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(sf)===name)?.initializer;
function visit(n){
 if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='run')handlers.run=n.initializer.getText(sf);
 if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
  const cls=attr(n,'className'),id=attr(n,'id');
  if(n.tagName.getText(sf)==='form'&&cls&&ts.isStringLiteral(cls)&&cls.text==='echo-history')handlers.search=attr(n,'onSubmit').expression.getText(sf);
  if(n.tagName.getText(sf)==='input'&&id&&ts.isStringLiteral(id)&&id.text==='echo-memory-query')handlers.edit=attr(n,'onChange').expression.getText(sf);
  if(n.tagName.getText(sf)==='button'&&n.parent.getText(sf).includes('기록 더 찾기'))handlers.more=attr(n,'onClick').expression.getText(sf);
 }
 ts.forEachChild(n,visit);
}
visit(sf);for(const name of ['run','search','edit','more'])assert.ok(handlers[name],name);
const code=ts.transpileModule(Object.entries(handlers).map(([name,fn])=>`globalThis.actual_${name}=${fn};`).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function fixture({fail=false}={}){
 const state={draft:'대화창에 아직 보내지 않은 내 말',memoryQuery:'회사가치 목표',memory:{intent:'history',next:{offset:50,match:0},evidence:[]},notice:null,error:null,busy:null,calls:[]};
 let resolve,reject;const gate=new Promise((a,b)=>{resolve=a;reject=b;});const jobs=[];
 const set=(name,value)=>{state[name]=typeof value==='function'?value(state[name]):value;};
 const context=createContext({busy:null,userId:'synthetic-user',memoryQuery:state.memoryQuery,memory:state.memory,alive:{current:true},inFlight:{current:false},
  setBusy:v=>set('busy',v),setError:v=>set('error',v),setNotice:v=>set('notice',v),setMemory:v=>set('memory',v),setMemoryQuery:v=>set('memoryQuery',v),
  agentRecall:async(...args)=>{state.calls.push(args);return gate;},UnderstandingError:class extends Error{},load:async()=>{},SEND_ERROR:'synthetic request failed'});
 new Script(code).runInContext(context);
 context.run=(...args)=>{const p=context.actual_run(...args);jobs.push(p);return p;};
 return {state,context,finish:async()=>{fail?reject(new Error('synthetic read failure')):resolve({memory:{intent:'history',next:null,evidence:[{quote:'합성 원문'}]},reply:'합성 기록 확인'});await Promise.all(jobs);}};
}
test('history search returns a source while preserving the separate unsent conversation draft',async()=>{
 const f=fixture(),draft=f.state.draft;f.context.actual_search({preventDefault(){}});
 assert.equal(f.context.inFlight.current,true);assert.equal(f.state.draft,draft);
 await f.finish();assert.equal(f.state.draft,draft);assert.equal(f.state.error,null);assert.equal(f.state.memory.evidence.length,1);
 assert.equal(f.state.calls.length,1);assert.equal(f.state.calls[0][1],'회사가치 목표');assert.equal(f.state.calls[0][2],'history');
});
test('failed history read retains the draft, query and old cursor for retry without another request',async()=>{
 const f=fixture({fail:true}),old=structuredClone(f.state);f.context.actual_search({preventDefault(){}});await f.finish();
 assert.equal(f.state.draft,old.draft);assert.equal(f.state.memoryQuery,old.memoryQuery);assert.deepEqual(f.state.memory,old.memory);assert.ok(f.state.error);assert.equal(f.state.calls.length,1);assert.equal(f.context.inFlight.current,false);
});
test('editing the search query discards an old pagination cursor without editing the conversation draft',()=>{
 const f=fixture(),draft=f.state.draft;f.context.actual_edit({target:{value:'다른 검색어'}});
 assert.equal(f.state.memoryQuery,'다른 검색어');assert.equal(f.state.memory,null);assert.equal(f.state.draft,draft);assert.equal(f.state.calls.length,0);
});
test('double pagination click sends one request with the same query, intent and cursor',async()=>{
 const f=fixture(),draft=f.state.draft;f.context.actual_more();f.context.actual_more();
 assert.equal(f.state.calls.length,1);assert.equal(f.state.calls[0][1],'회사가치 목표');assert.equal(f.state.calls[0][2],'history');
 assert.equal(f.state.calls[0][3].offset,50);assert.equal(f.state.calls[0][3].match,0);
 await f.finish();assert.equal(f.state.draft,draft);assert.equal(f.state.error,null);
});
