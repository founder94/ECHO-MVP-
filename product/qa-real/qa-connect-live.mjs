// QA 서버 doit-connect 실서버 확인(2026-09-29 PROD PRE-FLIGHT) — 배포한 소스가 부팅되고 인증·권한·요청 검사가 그대로인지. 새 시험 계정 · 운영 0.
// 전체 연결 루프(후보 → 서로 선택 → 연결 → 결과)는 run 72(45/45 · 같은 index.ts)에서 확인. 여기서는 배포 직후 서버 계약만 본다.
import { randomUUID } from 'node:crypto';
const SB = process.env.SB_URL ?? 'https://mutniujeiyujhkobadkd.supabase.co';
const ANON = process.env.QA_ANON;
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
const call = async (jwt, body) => { const r = await fetch(`${SB}/functions/v1/doit-connect`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }, body: JSON.stringify(body) }); let data = null; try { data = await r.json(); } catch { /* 빈 응답 */ } return { status: r.status, data }; };
const post = (path, body, jwt) => fetch(`${SB}${path}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwt ?? ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());

let s;
if (process.env.ACCT_FILE) { const acc = JSON.parse((await import('node:fs')).readFileSync(process.env.ACCT_FILE, 'utf8'))[process.env.ACCT ?? 'a']; s = await post('/auth/v1/token?grant_type=password', { email: acc.email, password: acc.password }); }
else { const email = `qa-connectlive-${Date.now()}@do-it.company`; const password = `Qa!${randomUUID()}`; await post('/auth/v1/signup', { email, password }); s = await post('/auth/v1/token?grant_type=password', { email, password }); }
const jwt = s?.access_token;
if (!jwt) { check('QA 시험 계정', false); process.exit(1); }

const anon = await call(null, { action: 'my_candidates' });
check('로그인 없음 = 401', anon.status === 401, `status=${anon.status}`);
const mc = await call(jwt, { action: 'my_candidates' });
check('my_candidates 200 · 자격 없는 새 계정 = eligible false · 후보 0 · 상대 정보 0', mc.status === 200 && mc.data?.ok === true && mc.data?.eligible === false && Array.isArray(mc.data?.candidates) && mc.data.candidates.length === 0, `status=${mc.status} eligible=${mc.data?.eligible} missing=${JSON.stringify(mc.data?.missing)}`);
const mm = await call(jwt, { action: 'my_matches' });
check('my_matches 200', mm.status === 200 && mm.data?.ok !== false, `status=${mm.status}`);
const ch = await call(jwt, { action: 'choose', candidateId: randomUUID(), choice: 'yes' });
check('choose 남의·없는 후보 = 404(쓰기 0)', ch.status === 404, `status=${ch.status}`);
const chBad = await call(jwt, { action: 'choose', candidateId: 'x', choice: 'maybe' });
check('choose 잘못된 요청 = 400', chBad.status === 400, `status=${chBad.status}`);
// 2026-10-01 v2.1 안전: 잘못된 신고 사유·「이어지고 싶어요」+차단은 쓰기 전에 400 · 없는 후보 차단·신고는 404(쓰기 0)
const chYesBlock = await call(jwt, { action: 'choose', candidateId: randomUUID(), choice: 'yes', block: true });
check('choose yes + 차단 = 400(모순)', chYesBlock.status === 400, `status=${chYesBlock.status}`);
const chBadReason = await call(jwt, { action: 'choose', candidateId: randomUUID(), choice: 'hide', block: true, reason: 'hack' });
check('choose 모르는 신고 사유 = 400', chBadReason.status === 400, `status=${chBadReason.status}`);
const chReport = await call(jwt, { action: 'choose', candidateId: randomUUID(), choice: 'hide', block: true, reason: 'spam' });
check('choose 없는 후보 차단·신고 = 404(쓰기 0)', chReport.status === 404, `status=${chReport.status}`);
const lvBad = await call(jwt, { action: 'leave', matchId: randomUUID(), block: true, reason: 'threat' });
check('leave 없는 연결 신고 = 404(쓰기 0)', lvBad.status === 404, `status=${lvBad.status}`);
const oc = await call(jwt, { action: 'outcome', matchId: randomUUID(), met: 'yes' });
check('outcome 없는 연결 = 404(쓰기 0)', oc.status === 404, `status=${oc.status}`);
const ocBad = await call(jwt, { action: 'outcome', matchId: randomUUID(), met: 'maybe' });
check('outcome 허용 밖 값 = 400', ocBad.status === 400, `status=${ocBad.status}`);
for (const a of ['admin_run_matching', 'admin_candidates', 'admin_members']) { const r = await call(jwt, { action: a }); check(`${a} 일반 사용자 = 403 · 데이터 0`, r.status === 403 && !r.data?.candidates && !r.data?.members, `status=${r.status}`); }
const unk = await call(jwt, { action: 'nope' });
check('알 수 없는 요청 = 400', unk.status === 400, `status=${unk.status}`);

const fail = results.filter((x) => !x).length;
console.log(`QA CONNECT LIVE: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
