// ADMIN WEB QA 검사용 계정 두 개(관리자 후보 · 일반 사용자)를 QA 에만 만든다(있으면 로그인만). 비밀번호는 QA 씨앗에서 계산(출력 0).
import { createHash } from 'node:crypto';
const { QA_REF, QA_ANON, QA_PW_SEED } = process.env;
if (QA_REF !== 'mutniujeiyujhkobadkd' || !QA_ANON || !QA_PW_SEED) { console.error('QA 환경값 없음/불일치'); process.exit(2); }
const URL0 = `https://${QA_REF}.supabase.co`;
const pw = (run, tag) => `Qa!${createHash('sha256').update(`${QA_PW_SEED}:${run}:${tag}`).digest('base64url').slice(0, 24)}`;
const post = async (path, body) => { const r = await fetch(`${URL0}${path}`, { method: 'POST', headers: { apikey: QA_ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; };
for (const [acct, tag] of [['adminweb', 'admin'], ['userweb', 'user']]) {
  const email = `qa-${acct}-20260928@do-it.company`; const password = pw(acct, tag);
  let r = await post('/auth/v1/token?grant_type=password', { email, password });
  if (r.status !== 200) { const s = await post('/auth/v1/signup', { email, password, data: { nickname: `QA-${acct}` } }); console.log(`${acct}: 가입 HTTP ${s.status}`); r = await post('/auth/v1/token?grant_type=password', { email, password }); }
  console.log(`${acct}: 로그인 HTTP ${r.status}`);
  if (r.status !== 200) process.exit(1);
}
