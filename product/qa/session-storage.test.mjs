// Approved security contract: retire wide-domain cookies, never migrate their token values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/supabase/sessionStorage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports});
const {retireSharedSessionCookies}=module.exports;
const key='sb-synthetic-auth-token';
function browser(host='app.do-it.company',protocol='https:') {
  const values=new Map([[key+'.0','old-access'],[key+'.2','old-refresh'],[key+'-code-verifier','old-verifier'],['theme','mint'],['sb-other-auth-token.0','other-project']]);
  const writes=[],local=new Map([['draft','keep']]);
  return {values,writes,local,win:{location:{hostname:host,protocol},document:{get cookie(){return [...values].map(([k,v])=>k+'='+v).join('; ');},set cookie(v){writes.push(v);const name=v.split('=')[0];if(v.includes('Max-Age=0'))values.delete(name);}},localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v)}}};
}
test('legacy chunks including gaps and verifier are expired, other cookies remain',()=>{
  const b=browser();retireSharedSessionCookies(key,b.win);
  assert.deepEqual([...b.values.keys()],['theme','sb-other-auth-token.0']);
  assert.equal(b.writes.length,3);
  for(const v of b.writes){assert.match(v,/Max-Age=0; Domain=do-it\.company; Path=\/; Secure;/);assert.doesNotMatch(v,/old-access|old-refresh|old-verifier/);}
});
test('legacy credentials are never copied to origin storage and draft is preserved',()=>{
  const b=browser();retireSharedSessionCookies(key,b.win);assert.deepEqual([...b.local],[['draft','keep']]);
});
test('QA, local and lookalike domains do not alter cookies or drafts',()=>{
  for(const host of ['localhost','echo-app-qa.netlify.app','evil-do-it.company']){const b=browser(host,'http:');retireSharedSessionCookies(key,b.win);assert.equal(b.writes.length,0);assert.equal(b.values.size,5);}
});
test('branded HTTP refuses authentication initialization',()=>{
  const b=browser('app.do-it.company','http:');assert.throws(()=>retireSharedSessionCookies(key,b.win),/HTTPS_REQUIRED/);assert.equal(b.writes.length,0);
});
test('cookie-disabled browsers do not recover legacy tokens',()=>{
  assert.doesNotThrow(()=>retireSharedSessionCookies(key,{location:{hostname:'app.do-it.company',protocol:'https:'},document:{get cookie(){throw new Error('blocked');}}}));
});
