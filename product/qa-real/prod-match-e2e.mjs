// PROD 2계정 매칭 E2E(2026-09-29 대표 「PROD RELEASE CLOSING ORDER」 §4) — 시험 계정 a·b 만 · 목적 friend(실사용자 0 확인 뒤) · 비밀값 출력 0.
// 앱과 같은 경로: 새 회차(user_metadata) · 목적·소개(profiles) · 사진 3장(Storage profile-photos + profile_photos) · 연결 동의(user_metadata) · 대화(doit-agent)
// → my_candidates → A yes → (한쪽 yes 로 연결 0) → B yes → mutual → my_matches(열림 · 첫 답 전 상대 정보 0) → 같은 선택 재전송(중복 0) → outcome.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const SB = 'https://zyyhhxyupizcqhxqnxuu.supabase.co', KEY = 'sb_publishable_ZLm0g3z7ad2-N0--kB5uFQ_sho1OGtn';
const ACCTS = JSON.parse(readFileSync(process.env.ACCT_FILE, 'utf8'));
const JPEG = readFileSync(process.env.JPEG_FILE);
const results = []; const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); return !!ok; };
const http = async (path, { method = 'GET', jwt = null, body = null, headers = {}, raw = null } = {}) => {
  const r = await fetch(`${SB}${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${jwt ?? KEY}`, ...(raw ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); }
  return { status: r.status, data };
};
const fn = (name, jwt, body) => http(`/functions/v1/${name}`, { method: 'POST', jwt, body });
const STOP = (why) => { console.log(`STOP ${why}`); const f = results.filter((x) => !x).length; console.log(`PROD MATCH E2E: ${results.length - f} PASS / ${f} FAIL (STOPPED)`); process.exit(1); };
const ANSWERS = ['주말에 카페에서 이야기 나눌 친구를 찾고 있어요', '대화가 잘 통하고 편한 사람이 좋아요', '약속을 잘 지키는 사람이 중요해요', '연락은 이틀에 한 번 정도가 편해요', '갑자기 약속을 취소하는 건 피하고 싶어요', '산책이나 전시 보는 걸 좋아해요', '천천히 알아가는 게 좋아요', '오늘은 여기까지 할게요'];

async function prepare(tag) {
  const a = ACCTS[tag];
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: a.email, password: a.password } });
  let jwt = tok.data?.access_token; const uid = tok.data?.user?.id; const refresh = tok.data?.refresh_token;
  if (!check(`${tag}: 로그인`, !!jwt, `status=${tok.status}`)) STOP('login');
  // 새 회차 + 연결 동의(앱과 같은 user_metadata)
  const now = new Date().toISOString();
  const md = await http('/auth/v1/user', { method: 'PUT', jwt, body: { data: { doit_round_started_at: now, doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: now } } });
  check(`${tag}: 새 회차 · 연결 동의 저장`, md.status === 200, `status=${md.status}`);
  const t2 = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refresh } }); jwt = t2.data?.access_token ?? jwt;
  const pr = await http(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', jwt, body: { purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', bio: `QA 시험 계정 ${tag} — 주말에 편하게 이야기 나눌 친구를 찾아요.` }, headers: { Prefer: 'return=minimal' } });
  check(`${tag}: 목적(friend)·소개 저장`, pr.status === 204, `status=${pr.status}`);
  for (const slot of [1, 2, 3]) {
    const path = `${uid}/${slot}/${randomUUID()}.jpg`;
    const up = await http(`/storage/v1/object/profile-photos/${path}`, { method: 'POST', jwt, raw: JPEG, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' } });
    const row = await http('/rest/v1/profile_photos?on_conflict=user_id,slot', { method: 'POST', jwt, body: { user_id: uid, slot, storage_path: path, is_primary: slot === 1, updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    if (!check(`${tag}: 사진 ${slot} 업로드·연결(앱 경로)`, up.status === 200 && [201, 204].includes(row.status), `storage=${up.status} row=${row.status}`)) STOP('photo');
  }
  const st = await fn('doit-agent', jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구', firstAnswer: '친구를 만나고 싶어요' });
  let s = st.data?.session; let n = 0;
  check(`${tag}: 새 회차 대화 시작(friend)`, st.status === 200 && !!s?.id && !st.data?.existing, `status=${st.status} existing=${st.data?.existing}`);
  for (const t of ANSWERS) { if (!s || s.phase === 'done') break; const r = await fn('doit-agent', jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: s.id, text: t }); s = r.data?.session ?? s; n++; }
  check(`${tag}: 대화 마침(phase=done)`, s?.phase === 'done', `turns=${n} agent=${s?.profile?.version ?? '-'}`);
  return { tag, jwt, uid, sid: s?.id };
}

const A = await prepare('a'); const B = await prepare('b');
// 쓰기 직전 격리 재확인은 러너 밖 SQL 로 이미 했다(friend = 시험 계정 2명뿐). 여기서는 후보 상대가 B 인지 서버 응답으로 다시 확인한다.
const ca = await fn('doit-connect', A.jwt, { action: 'my_candidates' });
check('A: 연결 자격(eligible)', ca.status === 200 && ca.data?.eligible === true, `status=${ca.status} missing=${JSON.stringify(ca.data?.missing)} prepared=${ca.data?.prepared}`);
const candA = (ca.data?.candidates ?? [])[0];
if (!check('A: 서버가 후보 1개 준비', (ca.data?.candidates ?? []).length === 1, `count=${(ca.data?.candidates ?? []).length}`)) STOP('no candidate');
const leakKeys = Object.keys(candA).filter((k) => /user|nick|name|photo|bio|email|phone|partner/i.test(k));
check('A: 후보 화면 자료에 상대 개인정보 0(이름·사진·소개·연락처·id)', leakKeys.length === 0, `keys=${JSON.stringify(Object.keys(candA))}`);
const cb = await fn('doit-connect', B.jwt, { action: 'my_candidates' });
const candB = (cb.data?.candidates ?? [])[0];
check('B: 같은 후보를 봄(시험 계정끼리만)', cb.status === 200 && candB?.id === candA.id, `eligible=${cb.data?.eligible} count=${(cb.data?.candidates ?? []).length}`);
const ya = await fn('doit-connect', A.jwt, { action: 'choose', candidateId: candA.id, choice: 'yes' });
check('A yes → 기다림(한쪽 yes 로 연결 0)', ya.status === 200 && ya.data?.status === 'waiting', `status=${ya.status} ${ya.data?.status}`);
const ma0 = await fn('doit-connect', A.jwt, { action: 'my_matches' });
check('한쪽 yes 뒤 A 의 연결 0', ma0.status === 200 && (ma0.data?.matches ?? []).length === 0, `matches=${(ma0.data?.matches ?? []).length}`);
const yb = await fn('doit-connect', B.jwt, { action: 'choose', candidateId: candA.id, choice: 'yes' });
check('B yes → 상호(mutual) · 연결 열림', yb.status === 200 && yb.data?.status === 'mutual' && !!yb.data?.match_id, `status=${yb.status} ${yb.data?.status} q=${yb.data?.question_source}`);
const matchId = yb.data?.match_id;
const again = await fn('doit-connect', B.jwt, { action: 'choose', candidateId: candA.id, choice: 'yes' });
check('같은 선택 재전송 → 같은 연결(중복 0)', again.status === 200 && again.data?.status === 'mutual' && again.data?.match_id === matchId, `status=${again.status} same=${again.data?.match_id === matchId}`);
const mA = await fn('doit-connect', A.jwt, { action: 'my_matches' }); const mB = await fn('doit-connect', B.jwt, { action: 'my_matches' });
const itA = (mA.data?.matches ?? []).find((m) => m.id === matchId), itB = (mB.data?.matches ?? []).find((m) => m.id === matchId);
check('A·B 모두 연결 1개 · 열림(open)', (mA.data?.matches ?? []).length === 1 && (mB.data?.matches ?? []).length === 1 && itA?.status === 'open' && itB?.status === 'open');
check('첫 답 전 상대 정보 0(blind-first: partner 없음 · revealed=false)', !itA?.partner && !itB?.partner && itA?.revealed === false && itB?.revealed === false);
const oc = await fn('doit-connect', A.jwt, { action: 'outcome', matchId, talked: 'yes', again: 'unsure' });
check('A 결과 기록(outcome) 저장', oc.status === 200 && oc.data?.ok === true, `status=${oc.status}`);
const mA2 = await fn('doit-connect', A.jwt, { action: 'my_matches' });
check('A 결과가 내 연결에 보임(본인 것만)', mA2.data?.matches?.[0]?.outcome?.talked === 'yes');
const bad = await fn('doit-connect', B.jwt, { action: 'outcome', matchId: randomUUID(), talked: 'yes' });
check('남의/없는 연결에 결과 기록 차단(404)', bad.status === 404, `status=${bad.status}`);
writeFileSync('prod-match-e2e.ids.json', JSON.stringify({ a: A.uid, b: B.uid, aSession: A.sid, bSession: B.sid, candidate: candA.id, match: matchId }));
const f = results.filter((x) => !x).length;
console.log(`PROD MATCH E2E: ${results.length - f} PASS / ${f} FAIL`);
process.exit(f ? 1 : 0);
