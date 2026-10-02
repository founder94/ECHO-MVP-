// Deterministic inspection overlay: no DB/auth/storage configuration, no shared deployment.
import {readFileSync} from 'node:fs';
export function isolatedConnect(source, actors) {
 if(actors.length!==2 || new Set(actors).size!==2 || actors.some(x=>! /^[a-f0-9-]{36}$/.test(x)))throw Error('QA actor configuration');
 const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Source marker changed: '+before.slice(0,55));source=source.replace(before,after);};
 replace('type Json =',`import { fixtureAllowed, fixtureClient } from "./fixtureScope.ts";\nconst QA_ACTORS = ${JSON.stringify(actors)};\ntype Json =`);
 replace('const admin: Db = createClient(url, serviceKey, { auth: { persistSession: false } });',`if (!fixtureAllowed(user.id, QA_ACTORS)) return fail("QA_FIXTURE_ONLY", "검수 계정만 사용할 수 있어요.", 403, origin);\n    const admin: Db = await fixtureClient(createClient(url, serviceKey, { auth: { persistSession: false } }), QA_ACTORS) as Db;`);
 replace('if (!ACTIONS.has(action)) return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);','if (!ACTIONS.has(action)) return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);\n    if (action.startsWith("admin_")) return fail("QA_ADMIN_DISABLED", "검수 함수에서는 관리자 자료를 제공하지 않아요.", 403, origin);');
 return source;
}
export function isolatedFiles(root, actors) {
 const read=path=>readFileSync(root+'/'+path,'utf8');
 return [
  {name:'functions/doit-connect/index.ts',content:isolatedConnect(read('supabase/functions/doit-connect/index.ts'),actors)},
  {name:'functions/doit-connect/fixtureScope.ts',content:read('qa-real/connect-fixture-scope.ts')},
  ...['agentSource.ts','lifecycle.ts'].map(file=>({name:'functions/doit-connect/'+file,content:read('supabase/functions/doit-connect/'+file)})),
  {name:'functions/doit-agent/agent.ts',content:read('supabase/functions/doit-agent/agent.ts')},
 ];
}
