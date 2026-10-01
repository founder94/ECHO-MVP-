// QA-only ECHO Matching E2E fixture provisioning.
// Creates two isolated QA accounts through public Auth/Storage/app server paths only.
// No PROD URL, no direct DB writes, no service-role key, no account deletion.
// Trigger marker: 2026-09-30 post-release closing run.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

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

const JPEG_BASE = readFileSync(new URL('../brand-src/echo-app-icon-original-20260925.jpg', import.meta.url));
// Storage bucket allows image/jpeg only. Keep real JPEG bytes and append harmless slot markers so the three files hash differently.
const IMAGES = [1, 2, 3].map((slot) => Buffer.concat([JPEG_BASE, Buffer.from('\nQA-E2E-SLOT-' + slot + '\n')]));

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
    const storagePath=`${uid}/${slot}/${randomUUID()}.jpg`;
    const up=await http(`/storage/v1/object/profile-photos/${storagePath}`, {
      method:'POST', jwt, raw:IMAGES[i],
      headers:{ 'Content-Type':'image/jpeg', 'x-upsert':'false' }
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
// 2026-10-01: QA 풀에는 앞선 마감 실행이 남긴 시험 계정(qa-e2e-close-*)도 자격이 있어 A 에게 후보가 여럿 올 수 있다(읽기 전용 SQL 로 확인 · 실사용자 0).
// 이 검사는 A·B 둘 다에게 보이는 공통 후보(A↔B 쌍) 하나만 쓰고, 다른 후보는 고르지도 숨기지도 않는다(다른 계정 상태 변경 0).
const listA=(ca.data?.candidates??[]);
const cb=await fn('doit-connect',B.jwt,{action:'my_candidates'});
check('B: eligible', cb.status===200 && cb.data?.eligible===true, `count=${(cb.data?.candidates??[]).length}`);
const listB=(cb.data?.candidates??[]);
const shared=listA.filter((c)=>listB.some((d)=>d.id===c.id));
check('A/B 공통 후보 정확히 1(A↔B 쌍)', shared.length===1, `A=${listA.length} B=${listB.length} 공통=${shared.length}`);
const candA=shared[0];

writeFileSync(ACCT_FILE, JSON.stringify({
  a:{email:A.email,password:A.password},
  b:{email:B.email,password:B.password}
}), { mode:0o600 });
writeFileSync(PREFLIGHT_FILE, JSON.stringify({
  project:'mutniujeiyujhkobadkd',
  purpose:PURPOSE.id,
  eligibleCount:2, // 이 쌍(A·B)만 · 다른 자격 계정이 있어도 E2E 는 공통 후보 하나만 쓴다
  pairCandidateId:candA.id,
  accountIds:[A.uid,B.uid],
  verifiedAt:new Date().toISOString()
}), { mode:0o600 });
console.log(`QA MATCH PROVISION: ${results.filter(Boolean).length} PASS / 0 FAIL`);
