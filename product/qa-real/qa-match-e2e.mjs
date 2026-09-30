// QA 전용 2계정 매칭 E2E. 이미 정상 준비된 시험 계정과 기존 사진만 사용한다.
// 이 검사는 계정·프로필·사진·스토리지·운영 데이터를 생성하거나 고치지 않는다.
// → my_candidates → A yes → (한쪽 yes 로 연결 0) → B yes → mutual → my_matches(열림 · 첫 답 전 상대 정보 0) → 같은 선택 재전송(중복 0) → A/B 첫 답 → 상대 공개 → A↔B 메시지 → outcome.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
const QA_URL = 'https://mutniujeiyujhkobadkd.supabase.co';
if (process.env.SB_URL !== QA_URL || !process.env.SB_KEY || !process.env.ACCT_FILE || !process.env.QA_PAIR_PREFLIGHT_FILE || process.env.SIGNUP || process.env.JPEG_FILE) {
  throw new Error('QA only: explicit QA URL/key, existing test accounts and read-only pair preflight required; account/photo creation disabled');
}
const SB = QA_URL, KEY = process.env.SB_KEY;
const ACCTS = JSON.parse(readFileSync(process.env.ACCT_FILE, 'utf8'));
if (!['a', 'b'].every((tag) => typeof ACCTS[tag]?.email === 'string' && /(?:^|[._+-])(?:test|qa|e2e)(?:[._+-]|[0-9]|@)/i.test(ACCTS[tag].email) && typeof ACCTS[tag]?.password === 'string') || ACCTS.a.email === ACCTS.b.email) {
  throw new Error('two distinct existing test-only accounts required');
}
const results = []; const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); return !!ok; };
const http = async (path, { method = 'GET', jwt = null, body = null, headers = {} } = {}) => {
  const r = await fetch(`${SB}${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${jwt ?? KEY}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); }
  return { status: r.status, data };
};
const fn = (name, jwt, body) => http(`/functions/v1/${name}`, { method: 'POST', jwt, body });
const STOP = (why) => { console.log(`STOP ${why}`); const f = results.filter((x) => !x).length; console.log(`QA MATCH E2E: ${results.length - f} PASS / ${f} FAIL (STOPPED)`); process.exit(1); };

async function prepare(tag) {
  const a = ACCTS[tag];
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: a.email, password: a.password } });
  const jwt = tok.data?.access_token; const uid = tok.data?.user?.id;
  if (!check(`${tag}: 로그인`, !!jwt, `status=${tok.status}`)) STOP('login');
  const profile = await http(`/rest/v1/profiles?id=eq.${uid}&select=purpose_id,bio`, { jwt });
  if (!check(`${tag}: 기존 목적·소개`, profile.status === 200 && !!profile.data?.[0]?.purpose_id && !!profile.data?.[0]?.bio)) STOP('profile');
  const photos = await http(`/rest/v1/profile_photos?user_id=eq.${uid}&select=slot,storage_path`, { jwt });
  if (!check(`${tag}: 기존 사진 3칸`, photos.status === 200 && [1, 2, 3].every((slot) => photos.data?.some((p) => p.slot === slot && p.storage_path)))) STOP('photo rows');
  const photoHashes = [];
  for (const slot of [1, 2, 3]) {
    const path = photos.data.find((p) => p.slot === slot).storage_path;
    const res = await fetch(`${SB}/storage/v1/object/profile-photos/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: KEY, Authorization: `Bearer ${jwt}` } });
    const bytes = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0);
    if (!check(`${tag}: 기존 사진 ${slot} 실제 객체`, res.ok && res.headers.get('content-type')?.startsWith('image/') && bytes.length > 0, `status=${res.status}`)) STOP('storage');
    photoHashes.push(createHash('sha256').update(bytes).digest('hex'));
  }
  if (!check(`${tag}: 사진 3장 서로 다른 파일`, new Set(photoHashes).size === 3)) STOP('duplicate photos');
  return { tag, jwt, uid, purpose: profile.data[0].purpose_id };
}

const A = await prepare('a'); const B = await prepare('b');
if (!check('두 계정의 목적 동일', A.purpose === B.purpose)) STOP('purpose');
// 후보 생성은 읽기 전용 SQL로 확인한 QA 전용 자격 풀(정확히 이 두 계정)에서만 허용한다.
const preflight = JSON.parse(readFileSync(process.env.QA_PAIR_PREFLIGHT_FILE, 'utf8'));
if (!check('QA 후보 풀 사전검증: 최근 5분 · 두 계정만', preflight.project === 'mutniujeiyujhkobadkd'
  && preflight.purpose === A.purpose && preflight.eligibleCount === 2
  && Array.isArray(preflight.accountIds) && preflight.accountIds.length === 2
  && [A.uid, B.uid].every((id) => preflight.accountIds.includes(id))
  && Number.isFinite(Date.parse(preflight.verifiedAt))
  && Date.now() - Date.parse(preflight.verifiedAt) >= 0
  && Date.now() - Date.parse(preflight.verifiedAt) < 5 * 60_000)) STOP('pair preflight');
for (const member of [A, B]) {
  const prior = await fn('doit-connect', member.jwt, { action: 'my_matches' });
  if (!check(`${member.tag}: 기존 연결 0`, prior.status === 200 && prior.data?.matches?.length === 0)) STOP('prior matches');
}
const ca = await fn('doit-connect', A.jwt, { action: 'my_candidates' });
if (!check('A: 연결 자격(eligible)', ca.status === 200 && ca.data?.eligible === true, `status=${ca.status} missing=${JSON.stringify(ca.data?.missing)} prepared=${ca.data?.prepared}`)) STOP('eligibility');
const candA = (ca.data?.candidates ?? [])[0];
if (!check('A: 서버가 후보 1개 준비', (ca.data?.candidates ?? []).length === 1, `count=${(ca.data?.candidates ?? []).length}`)) STOP('no candidate');
const leakKeys = Object.keys(candA).filter((k) => /user|nick|name|photo|bio|email|phone|partner/i.test(k));
if (!check('A: 후보 화면 자료에 상대 개인정보 0(이름·사진·소개·연락처·id)', leakKeys.length === 0, `keys=${JSON.stringify(Object.keys(candA))}`)) STOP('privacy');
const cb = await fn('doit-connect', B.jwt, { action: 'my_candidates' });
const candB = (cb.data?.candidates ?? [])[0];
if (!check('B: 같은 후보를 봄(시험 계정끼리만)', cb.status === 200 && cb.data?.eligible === true && (cb.data?.candidates ?? []).length === 1 && candB?.id === candA.id, `eligible=${cb.data?.eligible} count=${(cb.data?.candidates ?? []).length}`)) STOP('pair isolation');
const ya = await fn('doit-connect', A.jwt, { action: 'choose', candidateId: candA.id, choice: 'yes' });
if (!check('A yes → 기다림(한쪽 yes 로 연결 0)', ya.status === 200 && ya.data?.status === 'waiting', `status=${ya.status} ${ya.data?.status}`)) STOP('A choice');
const ma0 = await fn('doit-connect', A.jwt, { action: 'my_matches' });
if (!check('한쪽 yes 뒤 A 의 연결 0', ma0.status === 200 && (ma0.data?.matches ?? []).length === 0, `matches=${(ma0.data?.matches ?? []).length}`)) STOP('premature match');
const yb = await fn('doit-connect', B.jwt, { action: 'choose', candidateId: candA.id, choice: 'yes' });
if (!check('B yes → 상호(mutual) · 연결 열림', yb.status === 200 && yb.data?.status === 'mutual' && !!yb.data?.match_id, `status=${yb.status} ${yb.data?.status} q=${yb.data?.question_source}`)) STOP('B choice');
const matchId = yb.data?.match_id;
const again = await fn('doit-connect', B.jwt, { action: 'choose', candidateId: candA.id, choice: 'yes' });
if (!check('같은 선택 재전송 → 같은 연결(중복 0)', again.status === 200 && again.data?.status === 'mutual' && again.data?.match_id === matchId, `status=${again.status} same=${again.data?.match_id === matchId}`)) STOP('duplicate choice');
const mA = await fn('doit-connect', A.jwt, { action: 'my_matches' }); const mB = await fn('doit-connect', B.jwt, { action: 'my_matches' });
const itA = (mA.data?.matches ?? []).find((m) => m.id === matchId), itB = (mB.data?.matches ?? []).find((m) => m.id === matchId);
if (!check('A·B 모두 연결 1개 · 열림(open)', (mA.data?.matches ?? []).length === 1 && (mB.data?.matches ?? []).length === 1 && itA?.status === 'open' && itB?.status === 'open')) STOP('match readback');
if (!check('첫 답 전 상대 정보 0(blind-first: partner 없음 · revealed=false)', !itA?.partner && !itB?.partner && itA?.revealed === false && itB?.revealed === false)) STOP('privacy');
const aAnswerText = '처음에는 편하게 서로의 일상 이야기를 나누고 싶어요.';
const bAnswerText = '저도 부담 없이 천천히 대화를 이어가고 싶어요.';
const aa = await fn('doit-connect', A.jwt, { action: 'answer', matchId, text: aAnswerText });
if (!check('A 첫 질문 답변 저장', aa.status === 200 && aa.data?.ok === true, `status=${aa.status}`)) STOP('A first answer');
const afterA = await fn('doit-connect', A.jwt, { action: 'my_matches' });
const afterAItem = (afterA.data?.matches ?? []).find((m) => m.id === matchId);
if (!check('A만 답한 상태에서도 상대 공개 0', afterA.status === 200 && afterAItem?.my_answer === aAnswerText && afterAItem?.partner_answered === false && afterAItem?.revealed === false && !afterAItem?.partner)) STOP('one-sided reveal');
const earlyMsg = await fn('doit-connect', A.jwt, { action: 'message', matchId, text: '아직 둘 다 답하기 전 메시지' });
if (!check('둘 다 첫 답 전 메시지 차단', earlyMsg.status === 409 && earlyMsg.data?.ok === false, `status=${earlyMsg.status}`)) STOP('early message');
const ba = await fn('doit-connect', B.jwt, { action: 'answer', matchId, text: bAnswerText });
if (!check('B 첫 질문 답변 저장', ba.status === 200 && ba.data?.ok === true, `status=${ba.status}`)) STOP('B first answer');
const [revealedA, revealedB] = await Promise.all([
  fn('doit-connect', A.jwt, { action: 'my_matches' }),
  fn('doit-connect', B.jwt, { action: 'my_matches' }),
]);
const rA = (revealedA.data?.matches ?? []).find((m) => m.id === matchId);
const rB = (revealedB.data?.matches ?? []).find((m) => m.id === matchId);
if (!check('양쪽 첫 답 완료 → 상대 공개', revealedA.status === 200 && revealedB.status === 200 && rA?.revealed === true && rB?.revealed === true && !!rA?.partner && !!rB?.partner && rA?.partner?.answer === bAnswerText && rB?.partner?.answer === aAnswerText)) STOP('reveal');
const msgA = '반가워요. 오늘 하루는 어땠어요?';
const msgB = '반가워요. 저는 괜찮았어요. 당신은요?';
const am = await fn('doit-connect', A.jwt, { action: 'message', matchId, text: msgA });
if (!check('메시지 A→B 저장', am.status === 200 && am.data?.ok === true, `status=${am.status}`)) STOP('A message');
const bm = await fn('doit-connect', B.jwt, { action: 'message', matchId, text: msgB });
if (!check('메시지 B→A 저장', bm.status === 200 && bm.data?.ok === true, `status=${bm.status}`)) STOP('B message');
const [chatA, chatB] = await Promise.all([
  fn('doit-connect', A.jwt, { action: 'my_matches' }),
  fn('doit-connect', B.jwt, { action: 'my_matches' }),
]);
const cA = (chatA.data?.matches ?? []).find((m) => m.id === matchId);
const cB = (chatB.data?.matches ?? []).find((m) => m.id === matchId);
if (!check('양방향 메시지 실제 조회', Array.isArray(cA?.messages) && Array.isArray(cB?.messages) && cA.messages.some((m) => m.mine === true && m.body === msgA) && cA.messages.some((m) => m.mine === false && m.body === msgB) && cB.messages.some((m) => m.mine === false && m.body === msgA) && cB.messages.some((m) => m.mine === true && m.body === msgB))) STOP('message readback');
const oc = await fn('doit-connect', A.jwt, { action: 'outcome', matchId, talked: 'yes', again: 'unsure' });
if (!check('A 결과 기록(outcome) 저장', oc.status === 200 && oc.data?.ok === true, `status=${oc.status}`)) STOP('outcome');
const mA2 = await fn('doit-connect', A.jwt, { action: 'my_matches' });
if (!check('A 결과가 내 연결에 보임(본인 것만)', mA2.data?.matches?.[0]?.outcome?.talked === 'yes')) STOP('outcome readback');
const bad = await fn('doit-connect', B.jwt, { action: 'outcome', matchId: randomUUID(), talked: 'yes' });
check('없는 연결에 결과 기록 차단(404)', bad.status === 404, `status=${bad.status}`);
const f = results.filter((x) => !x).length;
console.log(`QA MATCH E2E: ${results.length - f} PASS / ${f} FAIL`);
process.exit(f ? 1 : 0);
