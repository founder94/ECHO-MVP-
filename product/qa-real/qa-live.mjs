// ECHO-QA 실환경 관통 검사(2026-09-27 대표 「QA DEPLOY · TOKEN SAFETY LOCK」) — QA 프로젝트 전용.
// 실제 Supabase Auth(이메일 가입·로그인) · 실제 DB · 실제 RLS(사용자 JWT) · 실제 Edge Functions · 실제 OpenAI.
// 비밀값(키·JWT·비밀번호)은 출력하지 않는다. 결과 JSON 에는 코드·상태·수치·합성 문장만 남는다.
// 환경: QA_REF · QA_URL · QA_ANON · QA_SERVICE(워크플로가 마스킹). 실행: node qa-real/qa-live.mjs --out 결과.json
import { writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';

const { QA_REF, QA_URL, QA_ANON, QA_SERVICE } = process.env;
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
if (!QA_REF || !QA_URL || !QA_ANON || !QA_SERVICE) { console.error('QA 환경값 없음'); process.exit(2); }
if (QA_REF !== 'mutniujeiyujhkobadkd' || !QA_URL.startsWith(`https://${QA_REF}.supabase.co`)) { console.error('QA ref 불일치 — 중단'); process.exit(3); }

const run = randomBytes(3).toString('hex');
const checks = []; const log = []; const timings = [];
const check = (id, ok, detail = '') => { checks.push({ id, result: ok === null ? 'INVALID' : ok ? 'PASS' : 'FAIL', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); };

async function http(path, { method = 'GET', key = QA_ANON, jwt = null, body = null, headers = {} } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${QA_URL}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${jwt ?? key}`, ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body == null ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body) });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 200); }
  return { status: res.status, data, ms: Date.now() - t0 };
}
const svc = (path, opts = {}) => http(path, { ...opts, key: QA_SERVICE, jwt: QA_SERVICE });
const fn = async (name, jwt, body, label) => { const r = await http(`/functions/v1/${name}`, { method: 'POST', jwt, body }); if (label) timings.push({ label, ms: r.ms, status: r.status }); return r; };

// ── 1) 테스트 계정(QA 전용 · 합성 이메일) — 서버 관리 API 로 만들고(이메일 확인 완료), 로그인은 실제 비밀번호 로그인으로 한다.
const users = {};
async function makeUser(tag) {
  const email = `qa-${tag}-${run}@example.com`; const password = randomBytes(18).toString('base64url');
  const c = await svc('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true, user_metadata: { nickname: `QA-${tag.toUpperCase()}` } } });
  const login = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  users[tag] = { id: c.data?.id ?? login.data?.user?.id, jwt: login.data?.access_token ?? null, created: c.status, login: login.status };
  return users[tag];
}
const rid = () => randomUUID();

async function main() {
  for (const t of ['a', 'b', 'admin']) await makeUser(t);
  check('로그인: 실제 이메일 가입(QA Auth) + 비밀번호 로그인 → 세션(JWT) 발급', Object.values(users).every((u) => u.created === 200 && u.login === 200 && !!u.jwt && !!u.id), Object.fromEntries(Object.entries(users).map(([k, u]) => [k, { created: u.created, login: u.login, jwt: !!u.jwt }])));
  const A = users.a, B = users.b, ADM = users.admin;
  const prof = await svc(`/rest/v1/profiles?id=in.(${A.id},${B.id},${ADM.id})&select=id,role,verification_status`);
  check('가입 트리거: profiles 자동 생성(role=user · verification_status=pending)', Array.isArray(prof.data) && prof.data.length === 3 && prof.data.every((p) => p.role === 'user' && p.verification_status === 'pending'), prof.data);

  // ── 2) 사용자 준비(실제 사용자 JWT · RLS 경로): 목적·소개·동의·사진 3장
  for (const [u, bio] of [[A, '천천히 알아가고 싶어요'], [B, '대화가 잘 통하는 사람이 좋아요']]) {
    const p = await http(`/rest/v1/profiles?id=eq.${u.id}`, { method: 'PATCH', jwt: u.jwt, body: { purpose_id: 'friend', purpose_label: '친구', bio }, headers: { Prefer: 'return=minimal' } });
    const m = await http('/auth/v1/user', { method: 'PUT', jwt: u.jwt, body: { data: { doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: new Date().toISOString() } } });
    let up = 0, rows = 0;
    for (const slot of [1, 2, 3]) {
      const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
      const s = await http(`/storage/v1/object/profile-photos/${u.id}/${slot}-${run}.jpg`, { method: 'POST', jwt: u.jwt, body: img, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } });
      if (s.status === 200) up++;
      const r = await http('/rest/v1/profile_photos', { method: 'POST', jwt: u.jwt, body: { user_id: u.id, slot, storage_path: `${u.id}/${slot}-${run}.jpg`, is_primary: slot === 1 }, headers: { Prefer: 'return=minimal' } });
      if (r.status === 201) rows++;
    }
    u.prep = { profile: p.status, consent: m.status, uploads: up, photo_rows: rows };
  }
  check('준비(사용자 JWT): 목적·소개 저장 · 동의 · 사진 3장 업로드 · 사진 3줄', [A, B].every((u) => u.prep.profile === 204 && u.prep.consent === 200 && u.prep.uploads === 3 && u.prep.photo_rows === 3), { a: A.prep, b: B.prep });

  // ── 3) 실제 RLS(사용자 JWT): 권한 칸 변경 불가 · 남의 정보 접근 불가
  const deny = {};
  for (const [col, val] of [['role', 'admin'], ['verification_status', 'verified'], ['is_admin', true], ['grade', 'vip']]) {
    const r = await http(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', jwt: A.jwt, body: { [col]: val }, headers: { Prefer: 'return=minimal' } });
    deny[col] = r.status;
  }
  const after = await svc(`/rest/v1/profiles?id=eq.${A.id}&select=role,verification_status,is_admin,grade`);
  check('RLS: 일반 사용자는 role·verification_status·is_admin·grade 변경 불가(거부 · 값 그대로)', Object.values(deny).every((s) => s === 401 || s === 403) && after.data?.[0]?.role === 'user' && after.data?.[0]?.verification_status === 'pending' && after.data?.[0]?.is_admin === false && after.data?.[0]?.grade == null, { status: deny, now: after.data?.[0] });
  const otherProfile = await http(`/rest/v1/profiles?id=eq.${B.id}&select=id,bio`, { jwt: A.jwt });
  const otherPhotos = await http(`/rest/v1/profile_photos?user_id=eq.${B.id}&select=id`, { jwt: A.jwt });
  const events = await http(`/rest/v1/doit_request_events?select=id&limit=1`, { jwt: A.jwt });
  const otherUpload = await http(`/storage/v1/object/profile-photos/${B.id}/x-${run}.jpg`, { method: 'POST', jwt: A.jwt, body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), headers: { 'Content-Type': 'image/jpeg' } });
  const anonRead = await http(`/rest/v1/profiles?select=id&limit=5`);
  check('RLS: 남의 프로필·사진 목록 0 · 대화 상태 표 직접 읽기 거부 · 남의 사진 폴더 업로드 거부 · 비로그인 프로필 0', Array.isArray(otherProfile.data) && otherProfile.data.length === 0 && Array.isArray(otherPhotos.data) && otherPhotos.data.length === 0 && [401, 403].includes(events.status) && otherUpload.status >= 400 && Array.isArray(anonRead.data) && anonRead.data.length === 0,
    { other_profile: otherProfile.data?.length, other_photos: otherPhotos.data?.length, events: events.status, other_upload: otherUpload.status, anon_profiles: anonRead.data?.length });

  // 관리자: 서버 키로만 역할 지정(사용자 JWT 로는 불가함을 위에서 확인)
  const mk = await svc(`/rest/v1/profiles?id=eq.${ADM.id}`, { method: 'PATCH', body: { role: 'admin' }, headers: { Prefer: 'return=minimal' } });
  check('관리자 지정(서버 키 · QA 전용 계정)', mk.status === 204, `status=${mk.status}`);

  // ── 4) 실제 AI 대화(doit-agent · 사용자 JWT)
  const stateOf = async (u) => (await svc(`/rest/v1/doit_request_events?user_id=eq.${u.id}&action=eq.agent_session&select=response_payload&order=updated_at.desc&limit=1`)).data?.[0]?.response_payload;
  const say = async (u, who, sid, text, extra = {}) => { const r = await fn('doit-agent', u.jwt, { action: 'agent_turn', requestId: rid(), sessionId: sid, text, ...extra }, 'agent_turn'); log.push({ who, text, status: r.status, kind: r.data?.turn?.kind ?? null, reply: r.data?.turn?.reply ?? null, question: r.data?.turn?.question ?? null, code: r.data?.code ?? null, ms: r.ms }); return r; };
  const start = async (u, who, first) => { const r = await fn('doit-agent', u.jwt, { action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: first }, 'agent_start'); log.push({ who, text: `(시작) ${first}`, status: r.status, code: r.data?.code ?? null, ms: r.ms }); return r.data?.session?.id; };
  const live = (st, id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED');
  const sq = (t) => String(t ?? '').replace(/\s/g, '');

  const sidA = await start(A, 'A', '친구처럼 편하게 대화하는 사이를 원해요');
  check('실제 AI: A 대화 시작(QA Edge → OpenAI)', !!sidA, log.at(-1));
  await say(A, 'A', sidA, '조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(A, 'A', sidA, '연락은 매일 하는 게 좋아요');
  const beforeReject = structuredClone((await stateOf(A)).state);
  await say(A, 'A', sidA, '아니 그런 뜻 아니야');
  const afterReject = structuredClone((await stateOf(A)).state);
  await say(A, 'A', sidA, '오늘은 여기까지 할게요');
  const stA1 = (await stateOf(A)).state;
  const fix = await say(A, 'A', sidA, '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요', { correction: { purpose: 'relationship_style' } });
  const SA = await stateOf(A);

  const sidB = await start(B, 'B', '친구처럼 편하게 대화하는 사이를 원해요');
  await say(B, 'B', sidB, '조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(B, 'B', sidB, '천천히 알아가고 싶어요');
  await say(B, 'B', sidB, '오늘은 여기까지 할게요');
  const SB = await stateOf(B);
  check('실제 AI: 대화 실패 0(모든 턴 200)', log.every((l) => l.status === 200), log.filter((l) => l.status !== 200));

  // 거절(전제: 해석이 저장되고 화면에 보였는가)
  const rejTurn = beforeReject.turns.length + 1;
  const shown = (beforeReject.turns.at(-1)?.presented ?? []).map((p) => `${p.purpose}|${p.note}`);
  const pre = Object.entries(beforeReject.slots).flatMap(([id, s]) => s.items.filter((i) => i.status === 'CONFIRMED' && i.source_type === 'AI_EXTRACTED' && i.turn === rejTurn - 1 && shown.includes(`${id}|${i.note}`)).map((i) => ({ id, note: i.note, turn: i.turn })));
  const preAfter = pre.map((p) => ({ ...p, status: afterReject.slots[p.id].items.find((i) => i.turn === p.turn && i.note === p.note)?.status }));
  const rawKept = Object.values(afterReject.slots).flatMap((s) => s.items.filter((i) => i.source_type === 'USER_DIRECT' && i.turn === rejTurn - 1)).every((i) => i.status === 'CONFIRMED');
  check('거절: 전제(AI 해석 저장 + 화면에 보임) → 보인 해석만 거둠(1개 RETRACTED · 여럿 DISPUTED) · 사용자 원문 보존', pre.length ? preAfter.every((p) => (pre.length === 1 ? p.status === 'RETRACTED' : p.status === 'DISPUTED')) && rawKept : null, { pre, after: preAfter, raw_kept: rawKept, rule: afterReject.turns.at(-1)?.vague_reject ?? null });
  const rejLog = log.find((l) => l.who === 'A' && l.text === '아니 그런 뜻 아니야');
  check('거절: 다음 응답에 거둔 뜻 재등장 0', !pre.some((p) => sq(p.note).length >= 4 && [rejLog?.reply, rejLog?.question].some((t) => t && sq(t).includes(sq(p.note)))), { reply: rejLog?.reply, question: rejLog?.question });

  // 정정 · 다른 칸 · Canonical State · Profile · 소개
  const styleNow = live(SA.state, 'relationship_style');
  check('정정: 화면 정정 → 정정(correction)으로 확정', fix.data?.turn?.kind === 'correction', `kind=${fix.data?.turn?.kind}`);
  check('정정: 최신 값 = 주말(USER_CORRECTED)', styleNow.length >= 1 && styleNow.every((i) => /주말/.test(i.note + i.quote) && i.source_type === 'USER_CORRECTED'), styleNow.map((i) => [i.note, i.source_type]));
  const oldSrc = stA1.slots.relationship_style.items.filter((i) => /매일/.test(i.quote) && !/부담/.test(i.quote)).map((i) => ({ turn: i.turn, q: sq(i.quote) }));
  const copies = Object.entries(SA.state.slots).flatMap(([id, s]) => s.items.filter((i) => oldSrc.some((o) => o.turn === i.turn && o.q.replace(/[.,!?~]/g, '') === sq(i.quote).replace(/[.,!?~]/g, ''))).map((i) => ({ id, note: i.note, status: i.status })));
  check('다른 칸 정정: 옛 「매일」 과 같은 출처 값이 어느 칸에도 지금 값(CONFIRMED)으로 없음', copies.every((c) => c.status !== 'CONFIRMED'), copies);
  const allLive = Object.values(SA.state.slots).flatMap((s) => s.items.filter((i) => i.status === 'CONFIRMED'));
  check('Canonical State: 지금 값에 거둔·밀린·확인 중 값 0 · 충돌하는 최신값 동시 존재 0(매일+주말)', !allLive.some((i) => /매일/.test(i.note) && !/부담|주말/.test(i.note)), allLive.map((i) => i.note));
  const profA = SA.profile;
  check('Profile: 매칭 프로필 = CONFIRMED 만 · 연락 방식 = 주말', !!profA && ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'].every((id) => (profA[id].items ?? []).every((i) => i.status === 'CONFIRMED')) && (profA.relationship_style.items ?? []).every((i) => /주말/.test(i.note)), profA?.relationship_style?.items?.map((i) => i.note));
  const intro = (SA.state.intro?.lines ?? []).map((l) => l.text).join(' ');
  check('소개: 옛 값(매일 연락) 문장 0', !(/매일/.test(intro) && !/부담|주말/.test(intro)), intro);

  // ── 5) 연결 준비(doit-understanding · 사용자 JWT) · Matching(doit-connect · 관리자 JWT · QA MATCH_SOURCE=agent)
  const prevA = await fn('doit-understanding', A.jwt, { action: 'connection_preview' }, 'connection_preview');
  check('연결 준비(doit-understanding): 전화 미인증이어도 준비 계산에서 막지 않음', prevA.status === 200, { status: prevA.status, code: prevA.data?.code ?? null, readiness: prevA.data?.readiness ?? prevA.data?.preview?.readiness ?? null });
  const cand = await fn('doit-connect', ADM.jwt, { action: 'admin_candidates' }, 'admin_candidates');
  const pair = (cand.data?.candidates ?? []).find((c) => [c.user_a, c.user_b].sort().join() === [A.id, B.id].sort().join());
  const commonA = pair ? (pair.user_a === A.id ? pair.common_a : pair.common_b) : [];
  check('Matching(agent): A-B 실제 후보 생성', !!pair, { status: cand.status, n: (cand.data?.candidates ?? []).length, eligible: cand.data?.eligible, missing: cand.data?.missing, code: cand.data?.code ?? null });
  check('Matching: 겹친 말 > 0 · 점수 > 0', !!pair && commonA.length > 0 && (pair.score ?? 0) > 0, { commonA, score: pair?.score });
  check('Matching: 옛 「매일」·거둔 뜻 사용 0 · AI 추정 0 · 사주/타로 0', !commonA.some((c) => (/매일/.test(c) && !/부담|주말/.test(c)) || /사주|타로|궁합|운세/.test(c)), commonA);
  check('전화: 전화 미인증 A 가 후보 · verification_status 그대로', !!pair && pair[pair.user_a === A.id ? 'a' : 'b']?.phone_verified === false, pair ? { a: pair.a, b: pair.b } : null);

  // ── 6) 연결 흐름(현재 구현: 관리자 승인 → AI 첫 질문 → 둘 다 답 → 공개 → 대화) · 안전
  const dec = await fn('doit-connect', ADM.jwt, { action: 'admin_decide', userA: A.id, userB: B.id, decision: 'approve' }, 'admin_decide');
  const mA0 = await fn('doit-connect', A.jwt, { action: 'my_matches' });
  const match = mA0.data?.matches?.[0];
  check('연결: 관리자 승인 → 연결 생성 · 첫 질문', dec.status === 200 && !!match, { status: dec.status, code: dec.data?.code ?? null, first_question: match?.first_question ?? match?.question ?? null });
  if (match) {
    await fn('doit-connect', A.jwt, { action: 'answer', matchId: match.id, text: '한강 산책길이요' });
    const mid = await fn('doit-connect', A.jwt, { action: 'my_matches' });
    await fn('doit-connect', B.jwt, { action: 'answer', matchId: match.id, text: '조용한 북카페요' });
    const both = await fn('doit-connect', A.jwt, { action: 'my_matches' });
    check('상호 공개: 둘 다 답하기 전 상대 정보 0 → 둘 다 답하면 열림', mid.data?.matches?.[0]?.revealed === false && !('partner' in (mid.data?.matches?.[0] ?? {})) && both.data?.matches?.[0]?.revealed === true, { before: mid.data?.matches?.[0]?.revealed, after: both.data?.matches?.[0]?.revealed });
    const msg = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: '반가워요' });
    const phone = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: '010-1234-5678 로 연락 주세요' });
    const link = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: 'https://open.kakao.com/o/abc 여기로 와요' });
    check('안전: 대화 보내기 200 · 연락처 차단 · 외부 링크 차단', msg.status === 200 && phone.data?.code === 'BLOCKED_CONTENT' && link.data?.code === 'BLOCKED_CONTENT', { msg: msg.status, phone: phone.data?.code ?? phone.status, link: link.data?.code ?? link.status });
    const leave = await fn('doit-connect', B.jwt, { action: 'leave', matchId: match.id, block: true, report: true });
    const again = await fn('doit-connect', ADM.jwt, { action: 'admin_candidates' });
    const re = await fn('doit-connect', ADM.jwt, { action: 'admin_decide', userA: A.id, userB: B.id, decision: 'approve', noCommonOk: true });
    const rep = await svc(`/rest/v1/user_reports?reporter_id=eq.${B.id}&select=id,status`);
    const blk = await svc(`/rest/v1/blocks?blocker_id=eq.${B.id}&select=id`);
    check('안전: 그만하기·차단·신고 → 신고·차단 기록 · 다시 후보 0 · 재승인 거부(409)', leave.status === 200 && (rep.data ?? []).length === 1 && (blk.data ?? []).length === 1 && !(again.data?.candidates ?? []).some((c) => [c.user_a, c.user_b].includes(A.id) && [c.user_a, c.user_b].includes(B.id)) && re.status === 409, { leave: leave.status, reports: (rep.data ?? []).length, blocks: (blk.data ?? []).length, re: re.status });
  }
  const verif = await svc(`/rest/v1/profiles?id=in.(${A.id},${B.id})&select=verification_status`);
  check('전화: verification_status 자동 변경 0', (verif.data ?? []).every((p) => p.verification_status === 'pending'), verif.data);

  // ── 7) 관리자(서버 응답 · 화면은 실기기에서 따로 확인)
  const adm = await fn('doit-agent', ADM.jwt, { action: 'admin_sessions' });
  const sess = adm.data?.sessions ?? [];
  const failed = (adm.data?.turns ?? []).filter((t) => t.record?.kind === 'error').length;
  check('관리자(서버 응답): 대화 세션 2 · Agent 판 v2.2.2 · 실패 턴 0', adm.status === 200 && sess.length === 2 && sess.every((s) => s.stored?.agent === 'echo-agent-v2.2.2') && failed === 0, { status: adm.status, n: sess.length, versions: sess.map((s) => s.stored?.agent), failed });
  const notAdmin = await fn('doit-agent', A.jwt, { action: 'admin_sessions' });
  check('관리자 권한: 일반 사용자 관리자 요청 거부(403)', notAdmin.status === 403, `status=${notAdmin.status}`);

  // ── 8) 성능(실제 AI 턴)
  const ms = timings.filter((t) => t.label === 'agent_turn' || t.label === 'agent_start').map((t) => t.ms).sort((x, y) => x - y);
  const pct = (p) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * (ms.length - 1) + 0.5))] : null;
  const perf = { n: ms.length, p50_ms: pct(0.5), p95_ms: pct(0.95), max_ms: ms.at(-1) ?? null, errors: timings.filter((t) => t.status >= 500).length };

  const models = [...new Set((adm.data?.turns ?? []).flatMap((t) => (t.record?.calls ?? []).map((c) => c.model)).filter(Boolean))];
  const summary = { env: 'ECHO-QA', ref: QA_REF, run, pass: checks.filter((c) => c.result === 'PASS').length, fail: checks.filter((c) => c.result === 'FAIL').length, invalid: checks.filter((c) => c.result === 'INVALID').length, perf, models, checks, conversation: log,
    state: { A: Object.fromEntries(Object.entries(SA.state.slots).map(([k, s]) => [k, s.items.map((i) => [i.note, i.status, i.source_type])])), B: Object.fromEntries(Object.entries(SB.state.slots).map(([k, s]) => [k, s.items.map((i) => [i.note, i.status, i.source_type])])), A_intro: intro, A_rejected: profA?.rejected_meanings ?? [] },
    matching: pair ? { common_a: pair.common_a, common_b: pair.common_b, score: pair.score } : null,
    test_accounts: { a: A.id?.slice(0, 8), b: B.id?.slice(0, 8), admin: ADM.id?.slice(0, 8) } };
  const text = JSON.stringify(summary, null, 1);
  if (OUT) writeFileSync(OUT, text);
  console.log(text);
  process.exitCode = summary.fail ? 1 : 0;
}
main().catch((e) => { console.error('QA 실행 오류:', e?.message ?? 'unknown'); process.exit(1); });
