// Actual QA-only Auth/Edge E2E. Photos/profiles are synthetic fixtures, never identity verification evidence.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const url='https://mutniujeiyujhkobadkd.supabase.co', key=JSON.parse(readFileSync('/tmp/qa-public-key.json')).key;
const file='/tmp/qa-cto-accounts.json', results=[];
const check=(name,ok)=>{results.push({name,passed:!!ok});console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)throw Error(name);};
async function http(path,jwt=key,body,method=body?'POST':'GET',raw=false){
 const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:`Bearer ${jwt}`,'Content-Type':raw?'image/jpeg':'application/json'},body:body===undefined?undefined:raw?body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 return {status:r.status,data:await r.json().catch(()=>null),cache:r.headers.get('cache-control')};
}
const fn=(slug,u,body)=>http('/functions/v1/'+slug,u.jwt,body);
if(process.argv[2]==='provision'){
 const users=[],run=Date.now();
 for(const tag of ['a','b']){
  const email=`echo-qa-cto-${tag}-${run}@example.com`,password=`Qa!${randomUUID()}z9`;
  const r=await http('/auth/v1/signup',key,{email,password});check(`${tag} actual signup/session`,r.status===200&&!!r.data?.access_token);
  const u={tag,email,password,uid:r.data.user.id,jwt:r.data.access_token,refresh:r.data.refresh_token};users.push(u);writeFileSync(file,JSON.stringify(users),{mode:0o600});
  const now=new Date().toISOString();check(`${tag} explicit reveal consent`,(await http('/auth/v1/user',u.jwt,{data:{doit_connect_consent_version:'connect-v1',doit_connect_consent_at:now,doit_round_started_at:now}},'PUT')).status===200);
  const fields={purpose_id:'conversation',purpose_label:'깊은 대화부터 시작하고 싶어요',bio:`QA synthetic CTO profile ${tag}`};
  const p=await http('/rest/v1/profiles',u.jwt,{id:u.uid,nickname:`QA CTO ${tag}`,...fields});
  check(`${tag} profile`,[200,201,204].includes(p.status)||[200,204].includes((await http(`/rest/v1/profiles?id=eq.${u.uid}`,u.jwt,fields,'PATCH')).status));
  for(const slot of [1,2,3]){const storage_path=`${u.uid}/${slot}/${randomUUID()}.jpg`;
   check(`${tag} synthetic JPEG ${slot}`,[200,201].includes((await http('/storage/v1/object/profile-photos/'+storage_path,u.jwt,readFileSync(`/tmp/qa-cto-${slot}.jpg`),'POST',true)).status));
   check(`${tag} photo row ${slot}`,[200,201,204].includes((await http('/rest/v1/profile_photos',u.jwt,{user_id:u.uid,slot,storage_path,is_primary:slot===1})).status));
  }
  let r1=await fn('doit-agent',u,{action:'agent_start',requestId:randomUUID(),tone:'polite',mode:'TEXT',goal:'conversation',goalLabel:fields.purpose_label,firstAnswer:fields.purpose_label});
  check(`${tag} Agent start`,r1.status===200&&!!r1.data?.session?.id);let session=r1.data.session;
  for(const text of ['카페에서 서로의 일상 이야기를 천천히 나누고 싶어요.','상대방 말을 끝까지 듣고 내 생각도 편하게 말하고 싶어요.','서로 약속 시간을 지키는 사람이 좋아요.','퇴근 뒤 한두 시간 산책하며 알아가고 싶어요.','거짓말하지 않고 솔직하게 이야기하고 싶어요.','처음엔 부담 없이 친구처럼 이야기하고 싶어요.','조용한 카페에서 음악과 책 이야기를 나누고 싶어요.','주말 낮에 만나서 함께 산책하고 싶어요.']){
   if(['done','post'].includes(session.phase))break;
   r1=await fn('doit-agent',u,{action:'agent_turn',requestId:randomUUID(),sessionId:session.id,text});check(`${tag} Agent turn`,r1.status===200&&!!r1.data?.session);session=r1.data.session;
  }
  u.agent_phase=session.phase;writeFileSync(file,JSON.stringify(users),{mode:0o600});check(`${tag} Agent completed`,['done','post'].includes(session.phase));
 }
}else{
 const [a,b]=JSON.parse(readFileSync(file)),slug='doit-connect-cto-qa';const call=(u,body)=>fn(slug,u,body);
 for(const u of [a,b]){
  const login=await http('/auth/v1/token?grant_type=password',key,{email:u.email,password:u.password});
  check(`${u.tag} current login/subject`,login.status===200&&login.data?.user?.id===u.uid&&!!login.data?.access_token);
  u.jwt=login.data.access_token;u.refresh=login.data.refresh_token;
  const me=await http('/auth/v1/user',u.jwt);check(`${u.tag} verified session`,me.status===200&&me.data?.id===u.uid);
 }
 writeFileSync(file,JSON.stringify([a,b]),{mode:0o600});
 check('unauthenticated denied',(await http('/functions/v1/'+slug,key,{action:'my_matches'})).status===401);
 const ca=await call(a,{action:'my_candidates'}),cb=await call(b,{action:'my_candidates'});
 for(const [u,r] of [[a,ca],[b,cb]]){
  console.log(JSON.stringify({account:u.tag,http:r.status,code:r.data?.code??null,ok:r.data?.ok??null,eligible:r.data?.eligible??null,missing:r.data?.missing??null}));
  check(`${u.tag} confirmed eligibility`,r.status===200&&r.data?.ok===true&&r.data?.eligible===true);
 }
 for(const action of ['admin_matches','admin_members','admin_candidates','admin_decide','admin_run_matching']){
  const r=await call(a,{action});check(`${action} denied`,r.status===403&&r.data?.ok===false&&r.data?.code==='QA_ADMIN_DISABLED');
 }
 for(const action of ['answer','message','outcome','leave']){
  const r=await call(a,{action,matchId:randomUUID(),text:'QA synthetic permission probe',met:'yes',block:true,reason:'spam'});
  check(`${action} unknown target denied`,r.status===404&&r.data?.ok===false);
 }
 check('isolated candidates exactly 1',ca.data.candidates.length===1&&cb.data.candidates.length===1);
 const cid=ca.data.candidates[0].id;check('candidate privacy',! /photo_url|storage_path|partner|nickname|bio/.test(JSON.stringify(ca.data.candidates))&&cb.data.candidates[0].id===cid);
 check('A YES waits',(await call(a,{action:'choose',candidateId:cid,choice:'yes'})).data?.status==='waiting');
 check('one-sided connection 0',(await call(a,{action:'my_matches'})).data?.matches?.length===0);
 const yes=await call(b,{action:'choose',candidateId:cid,choice:'yes'});check('B YES mutual',yes.data?.status==='mutual'&&!!yes.data.match_id);const mid=yes.data.match_id;
 check('duplicate YES same connection',(await call(b,{action:'choose',candidateId:cid,choice:'yes'})).data?.match_id===mid);
 let ma=await call(a,{action:'my_matches'}),mb=await call(b,{action:'my_matches'});let m=ma.data.matches[0];
 check('same first question',m.first_question===mb.data.matches[0].first_question);
 check('server 72H room and blind-first',m.room?.status==='open'&&Date.parse(m.room.expires_at)-Date.parse(m.room.opened_at)===72*3600000&&!m.partner&&!mb.data.matches[0].partner);
 check('no-store response',ma.cache?.includes('no-store'));
 const zz=await Promise.all([call(a,{action:'zzarit_seen',matchId:mid}),call(a,{action:'zzarit_seen',matchId:mid})]);check('server ZZARIT exactly once',zz.filter(r=>r.data?.zzarit_event).length===1);check('refresh ZZARIT ineligible',(await call(a,{action:'my_matches'})).data.matches[0].zzarit_eligible===false);
 check('early chat denied',(await call(a,{action:'message',matchId:mid,text:'반가워요',requestId:randomUUID()})).status===409);
 for(const u of [a,b]){const body={action:'answer',matchId:mid,text:'천천히 서로의 이야기를 나누고 싶어요.'};check(`${u.tag} answer`,(await call(u,body)).data?.ok===true);check(`${u.tag} answer retry`,(await call(u,body)).data?.replayed===true);}
 ma=await call(a,{action:'my_matches'});mb=await call(b,{action:'my_matches'});check('full reveal after both answers/consent',ma.data.matches[0].reveal_state==='FULL_SAFE'&&mb.data.matches[0].reveal_state==='FULL_SAFE'&&!!ma.data.matches[0].partner.photo_url);
 const sent=[];
 for(const u of [a,b]){const body={action:'message',matchId:mid,text:'오늘은 어떤 이야기를 나누고 싶어요?',requestId:randomUUID()};sent.push(body);const r=await Promise.all([call(u,body),call(u,body)]);check(`${u.tag} concurrent chat retry`,r.every(x=>x.status===200&&x.data?.ok===true)&&r.some(x=>x.data?.replayed===true));
  const conflict=await call(u,{...body,text:'다른 논리적 전송은 새 아이디가 필요해요.'});check(`${u.tag} requestId content conflict`,conflict.status===409&&conflict.data?.ok===false);
 }
 const cross=await call(b,sent[0]);check('requestId actor conflict',cross.status===409&&cross.data?.ok===false);
 ma=await call(a,{action:'my_matches'});check('bidirectional chat count 2',ma.data.matches[0].messages.length===2&&ma.data.matches[0].messages.some(m=>m.mine)&&ma.data.matches[0].messages.some(m=>!m.mine));
 const outs=await Promise.all([call(a,{action:'outcome',matchId:mid,talked:'yes'}),call(a,{action:'outcome',matchId:mid,met:'planned'})]);check('concurrent outcome',outs.every(x=>x.data?.ok===true));
 const login=await http('/auth/v1/token?grant_type=password',key,{email:a.email,password:a.password});check('new login session',!!login.data?.access_token);a.jwt=login.data.access_token;
 ma=await call(a,{action:'my_matches'});check('refresh state restored',ma.data.matches[0].outcome.talked==='yes'&&ma.data.matches[0].outcome.met==='planned'&&ma.data.matches[0].messages.length===2);
 const leave=await call(a,{action:'leave',matchId:mid,block:true,reason:'spam'});check('block/report saved',leave.data?.blocked===true&&leave.data?.reported===true);
 check('chat after block denied',(await call(b,{action:'message',matchId:mid,text:'반가워요',requestId:randomUUID()})).status===409);
 ma=await call(b,{action:'my_matches'});check('closed no partner',ma.data.matches[0].status==='closed'&&!ma.data.matches[0].partner);
 check('duplicate YES cannot reopen',(await call(b,{action:'choose',candidateId:cid,choice:'yes'})).status===409);
 check('no blocked re-proposal',(await call(a,{action:'my_candidates'})).data?.candidates?.length===0);
}
writeFileSync(`/tmp/qa-cto-${process.argv[2]==='provision'?'provision':'live'}-results.json`,JSON.stringify({project:'mutniujeiyujhkobadkd',synthetic:true,results},null,2));
console.log(`QA LIVE ${results.length} PASS / 0 FAIL`);
