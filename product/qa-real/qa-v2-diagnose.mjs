// QA-only existing-account diagnostic. Never prints credentials, user IDs, or profile text.
import { readFileSync, writeFileSync } from 'node:fs';
const base='https://mutniujeiyujhkobadkd.supabase.co';
const key=JSON.parse(readFileSync('/tmp/qa-public-key.json')).key;
const file='/tmp/qa-cto-accounts.json', users=JSON.parse(readFileSync(file)), rows=[];
async function req(path,jwt,body){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{apikey:key,Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 return {status:r.status,data:await r.json().catch(()=>null)};
}
const code=d=>typeof d?.code==='string'?d.code:typeof d?.error_code==='string'?d.error_code:null;
for(const u of users){
 const old=await req('/auth/v1/user',u.jwt);rows.push({account:u.tag,step:'existing_session',http:old.status,code:code(old.data),subject_matches:old.data?.id===u.uid});
 const before=await req('/functions/v1/doit-connect-cto-qa',u.jwt,{action:'my_candidates'});rows.push({account:u.tag,step:'before_login_eligibility',http:before.status,code:code(before.data),ok:before.data?.ok??null,eligible:before.data?.eligible??null});
 const login=await req('/auth/v1/token?grant_type=password',key,{email:u.email,password:u.password});
 const matched=login.data?.user?.id===u.uid;rows.push({account:u.tag,step:'password_login',http:login.status,code:code(login.data),subject_matches:matched});
 if(login.status!==200||!matched||!login.data.access_token)continue;
 u.jwt=login.data.access_token;u.refresh=login.data.refresh_token;
 const me=await req('/auth/v1/user',u.jwt);rows.push({account:u.tag,step:'verified_subject',http:me.status,code:code(me.data),subject_matches:me.data?.id===u.uid});
 const c=await req('/functions/v1/doit-connect-cto-qa',u.jwt,{action:'my_candidates'});
 rows.push({account:u.tag,step:'after_login_eligibility',http:c.status,code:code(c.data),ok:c.data?.ok??null,eligible:c.data?.eligible??null,missing:c.data?.missing??null,readiness:c.data?.readiness??null,candidate_count:c.data?.candidates?.length??null});
}
writeFileSync(file,JSON.stringify(users),{mode:0o600});
const result={target:base,function:'doit-connect-cto-qa',version:2,rows};
writeFileSync('/workspace/echo-preservation/v2-diagnosis-20261002.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
