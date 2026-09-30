// QA-only ECHO Matching E2E fixture provisioning.
// Creates two isolated QA accounts through public Auth/Storage/app server paths only.
// No PROD URL, no direct DB writes, no service-role key, no account deletion.
// Trigger marker: 2026-09-30 post-release closing run.
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const KEY = process.env.SB_KEY;
if (!KEY) throw new Error('SB_KEY missing');
if ((process.env.SB_URL ?? SB) !== SB) throw new Error('QA URL only');

const PURPOSE = { id: 'conversation', label: '깊은 대화부터 시작하고 싶어요', goal: 'conversation' };
const ACCT_FILE = process.env.ACCT_FILE ?? 'qa-match-accts.json';
const PREFLIGHT_FILE = process.env.QA_PAIR_PREFLIGHT_FILE ?? 'qa-match-preflight.json';
const results = [];
const check = (name, ok, detail='') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
  if (!ok) throw new Error(name);
};

const http = async (path, { method='GET', jwt=null, body=null, raw=null, headers={} }={}) => {
  const r = await fetch(`${SB}${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${jwt ?? KEY}`,
      ...(raw ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const t = await r.text();
  let data = null;
  try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 300); }
  return { status: r.status, data, headers: r.headers };
};
const fn = (name, jwt, body) => http(`/functions/v1/${name}`, { method:'POST', jwt, body });

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k=0;k<8;k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length,0); t.copy(out,4); data.copy(out,8);
  const crc = crc32(Buffer.concat([t,data]));
  out.writeUInt32BE(crc,8+data.length);
  return out;
}
function png(r,g,b) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1,0); ihdr.writeUInt32BE(1,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const raw = Buffer.from([0,r,g,b,255]);
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',deflateSync(raw)), chunk('IEND',Buffer.alloc(0))]);
}
const IMAGES = [png(220,70,70), png(70,180,90), png(70,110,220)];

const ANSWERS = [
  '처음엔 카페에서 한두 시간 편하게 이야기하고 싶어요',
  '서로 말 끊지 않고 천천히 듣는 대화가 좋아요',
  '약속 시간을 잘 지키는 건 중요해요',
  '연락은 이틀에 한 번 정도면 편해요',
  '갑자기 잠수하는 건 피하고 싶어요',
  '전시나 산책처럼 같이 이야기할 거리가 있으면 좋아요',
  '처음부터 너무 가까워지기보다 천천히 알아가고 싶어요',
  '오늘은 여기까지 할게요',
];

async function makeAccount(tag, seed) {
  const email = `qa-e2e-close-${seed}-${tag}@do-it.company`;
  const password = `Qa!${randomUUID()}aA1`;
  const su = await http('/auth/v1/signup', { method:'POST', body:{ email, password } });
  check(`${tag}: QA 가입`, [200,201].includes(su.status), `status=${su.status}`);

  const tok = await http('/auth/v1/token?grant_type=password', { method:'POST', body:{ email, password } });
  let jwt = tok.data?.access_token;
  const uid = tok.data?.user?.id;
  const refresh = tok.data?.refresh_token;
  check(`${tag}: 로그인`, !!jwt && !!uid && !!refresh, `status=${tok.status}`);

  const now = new Date().toISOString();
  const md = await http('/auth/v1/user', {
    method:'PUT', jwt,
    body:{ data:{ doit_round_started_at:now, doit_connect_consent_version:'connect-v1', doit_connect_consent_at:now } }
  });
  check(`${tag}: 새 회차·연결 동의`, md.status===200, `status=${md.status}`);

  const rt = await http('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token:refresh } });
  jwt = rt.data?.access_token ?? jwt;

  const pr = await http(`/rest/v1/profiles?id=eq.${uid}`, {
    method:'PATCH', jwt,
    body:{
      purpose_id:PURPOSE.id,
      purpose_label:PURPOSE.label,
      consent_version:'v1.0',
      bio:`QA E2E ${tag} — 깊은 대화부터 천천히 알아갈 사람을 찾고 있어요.`
    },
    headers:{ Prefer:'return=minimal' }
  });
  check(`${tag}: 목적·소개 저장`, pr.status===204, `status=${pr.status}`);

  for (let i=0;i<3;i++) {
    const slot=i+1;
    const storagePath=`${uid}/${slot}/${randomUUID()}.png`;
    const up=await http(`/storage/v1/object/profile-photos/${storagePath}`, {
      method:'POST', jwt, raw:IMAGES[i],
      headers:{ 'Content-Type':'image/png', 'x-upsert':'false' }
    });
    check(`${tag}: Storage 사진 ${slot}`, [200,201].includes(up.status), `status=${up.status}`);
    const row=await http('/rest/v1/profile_photos?on_conflict=user_id,slot', {
      method:'POST', jwt,
      body:{ user_id:uid, slot, storage_path:storagePath, is_primary:slot===1, updated_at:new Date().toISOString() },
      headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }
    });
    check(`${tag}: 사진 row ${slot}`, [200,201,204].includes(row.status), `status=${row.status}`);
  }

  const st=await fn('doit-agent',jwt,{
    action:'agent_start',requestId:randomUUID(),tone:'polite',mode:'TEXT',
    goal:PURPOSE.goal,goalLabel:PURPOSE.label,firstAnswer:PURPOSE.label
  });
  let session=st.data?.session;
  check(`${tag}: ECHO Agent 시작`, st.status===200 && !!session?.id, `status=${st.status}`);
  let turns=0;
  for (const text of ANSWERS) {
    if (!session || session.phase==='done') break;
    const rr=await fn('doit-agent',jwt,{ action:'agent_turn',requestId:randomUUID(),sessionId:session.id,text });
    check(`${tag}: Agent turn ${turns+1}`, rr.status===200, `status=${rr.status}`);
    session=rr.data?.session ?? session;
    turns++;
  }
  check(`${tag}: Agent 완료`, session?.phase==='done', `turns=${turns}`);

  const prior=await fn('doit-connect',jwt,{action:'my_matches'});
  check(`${tag}: 기존 연결 0`, prior.status===200 && (prior.data?.matches??[]).length===0);
  return { tag,email,password,jwt,uid,purpose:PURPOSE.id };
}

const seed = `${Date.now()}`;
const A=await makeAccount('a',seed);
const B=await makeAccount('b',seed);

const ca=await fn('doit-connect',A.jwt,{action:'my_candidates'});
check('A: eligible', ca.status===200 && ca.data?.eligible===true, `count=${(ca.data?.candidates??[]).length}`);
check('A: 후보 정확히 1', (ca.data?.candidates??[]).length===1, `count=${(ca.data?.candidates??[]).length}`);
const candA=(ca.data?.candidates??[])[0];

const cb=await fn('doit-connect',B.jwt,{action:'my_candidates'});
check('B: eligible', cb.status===200 && cb.data?.eligible===true, `count=${(cb.data?.candidates??[]).length}`);
check('B: 후보 정확히 1', (cb.data?.candidates??[]).length===1, `count=${(cb.data?.candidates??[]).length}`);
const candB=(cb.data?.candidates??[])[0];
check('A/B 같은 후보', !!candA?.id && candB?.id===candA.id);

writeFileSync(ACCT_FILE, JSON.stringify({
  a:{email:A.email,password:A.password},
  b:{email:B.email,password:B.password}
}), { mode:0o600 });
writeFileSync(PREFLIGHT_FILE, JSON.stringify({
  project:'mutniujeiyujhkobadkd',
  purpose:PURPOSE.id,
  eligibleCount:2,
  accountIds:[A.uid,B.uid],
  verifiedAt:new Date().toISOString()
}), { mode:0o600 });
console.log(`QA MATCH PROVISION: ${results.filter(Boolean).length} PASS / 0 FAIL`);
