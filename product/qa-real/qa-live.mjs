// ECHO-QA 실환경 관통 검사(2026-09-27 대표 「ACTUAL DEPLOY + END-TO-END VALIDATION」) — QA 프로젝트 전용.
// 실제 Supabase Auth(이메일 가입·로그인) · 실제 DB · 실제 RLS(사용자 JWT) · 실제 Edge Functions · 실제 OpenAI.
// 서버 관리 키(service_role)는 쓰지 않는다(토큰 권한에 API 키 읽기 없음 · 대표 지시로 권한 확대 금지).
//  - 가입·로그인·RLS 는 공개 키(QA anon · 출처: Supabase 연결 도구의 QA 프로젝트 조회) + 사용자 JWT 로만.
//  - 대화 상태·신고·차단 확인은 QA 관리자 계정의 실제 로그인 JWT 로(관리자 지정은 QA DB 에서 한 번 · 보고서에 명시).
// 두 단계: QA_PHASE=signup(실제 가입만) → (QA 관리자 지정) → QA_PHASE=full(실제 로그인부터 끝까지).
// 비밀값(키·JWT·비밀번호)은 출력하지 않는다. 비밀번호는 워크플로가 준 씨앗(QA_PW_SEED · 마스킹)에서 계정마다 만든다.
import { writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

const { QA_REF, QA_URL, QA_ANON, QA_PW_SEED, QA_RUN } = process.env;
const PHASE = process.env.QA_PHASE === 'signup' ? 'signup' : 'full';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
if (!QA_REF || !QA_URL || !QA_ANON || !QA_PW_SEED || !QA_RUN) { console.error('QA 환경값 없음'); process.exit(2); }
if (QA_REF !== 'mutniujeiyujhkobadkd' || QA_URL !== `https://${QA_REF}.supabase.co`) { console.error('QA ref 불일치 — 중단'); process.exit(3); }
if (!/^[a-z0-9]{1,12}$/.test(QA_RUN)) { console.error('QA_RUN 형식'); process.exit(2); }

const checks = []; const log = []; const timings = [];
const check = (id, ok, detail = '') => { checks.push({ id, result: ok === null ? 'INVALID' : ok ? 'PASS' : 'FAIL', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); };
const emailOf = (tag) => `qa-${tag}-${QA_RUN}@example.com`;
const passwordOf = (tag) => `Qa!${createHash('sha256').update(`${QA_PW_SEED}:${QA_RUN}:${tag}`).digest('base64url').slice(0, 24)}`;

async function http(path, { method = 'GET', jwt = null, body = null, headers = {} } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${QA_URL}${path}`, { method, headers: { apikey: QA_ANON, Authorization: `Bearer ${jwt ?? QA_ANON}`, ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body == null ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body) });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 200); }
  return { status: res.status, data, ms: Date.now() - t0 };
}
const fn = async (name, jwt, body, label) => { const r = await http(`/functions/v1/${name}`, { method: 'POST', jwt, body }); if (label) timings.push({ label, ms: r.ms, status: r.status }); return r; };
const errOf = (r) => ({ status: r.status, code: r.data?.error_code ?? r.data?.code ?? null, msg: typeof r.data?.msg === 'string' ? r.data.msg.slice(0, 120) : typeof r.data?.message === 'string' ? r.data.message.slice(0, 120) : null });
const rid = () => randomUUID();
const TAGS = ['a', 'b', 'admin'];

async function signup() {
  const out = {};
  for (const tag of TAGS) {
    const r = await http('/auth/v1/signup', { method: 'POST', body: { email: emailOf(tag), password: passwordOf(tag), data: { nickname: `QA-${tag.toUpperCase()}` } } });
    out[tag] = { ...errOf(r), user: !!(r.data?.id ?? r.data?.user?.id), session: !!r.data?.access_token, confirmed: !!(r.data?.email_confirmed_at ?? r.data?.user?.email_confirmed_at) };
  }
  check('가입: 실제 이메일 가입(QA Auth · 공개 키) — 계정 3개 생성', TAGS.every((t) => out[t].status === 200 && out[t].user), out);
  return { signup: out, emails: Object.fromEntries(TAGS.map((t) => [t, emailOf(t)])) };
}

async function login(tag) {
  const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: emailOf(tag), password: passwordOf(tag) } });
  return { id: r.data?.user?.id ?? null, jwt: r.data?.access_token ?? null, login: r.status, err: r.status === 200 ? null : errOf(r) };
}

async function full() {
  const users = {};
  for (const t of TAGS) users[t] = await login(t);
  check('로그인: 실제 이메일·비밀번호 로그인 → 사용자 JWT 발급(3계정)', TAGS.every((t) => users[t].login === 200 && !!users[t].jwt && !!users[t].id), Object.fromEntries(TAGS.map((t) => [t, { login: users[t].login, jwt: !!users[t].jwt, err: users[t].err }])));
  const A = users.a, B = users.b, ADM = users.admin;
  if (!A.jwt || !B.jwt || !ADM.jwt) return { stop: 'login_failed' };

  // 가입 트리거 · 자기 profile 읽기(사용자 JWT)
  const own = await http(`/rest/v1/profiles?id=eq.${A.id}&select=id,role,verification_status,is_admin,grade`, { jwt: A.jwt });
  check('가입 트리거 + RLS: 본인 profile 읽기 가능(role=user · pending)', own.status === 200 && own.data?.[0]?.role === 'user' && own.data?.[0]?.verification_status === 'pending', own.data?.[0] ?? errOf(own));
  const admOwn = await http(`/rest/v1/profiles?id=eq.${ADM.id}&select=role`, { jwt: ADM.jwt });
  check('관리자 계정: role=admin(QA DB 에서 지정됨)', admOwn.data?.[0]?.role === 'admin', admOwn.data?.[0] ?? errOf(admOwn));

  // 준비(사용자 JWT · RLS 경로): 목적·소개·동의·사진 3장
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  for (const [u, bio] of [[A, '천천히 알아가고 싶어요'], [B, '대화가 잘 통하는 사람이 좋아요']]) {
    const p = await http(`/rest/v1/profiles?id=eq.${u.id}`, { method: 'PATCH', jwt: u.jwt, body: { purpose_id: 'friend', purpose_label: '친구', bio }, headers: { Prefer: 'return=minimal' } });
    const m = await http('/auth/v1/user', { method: 'PUT', jwt: u.jwt, body: { data: { doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: new Date().toISOString() } } });
    let up = 0, rows = 0;
    for (const slot of [1, 2, 3]) {
      const s = await http(`/storage/v1/object/profile-photos/${u.id}/${slot}-${QA_RUN}.jpg`, { method: 'POST', jwt: u.jwt, body: img, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } });
      if (s.status === 200) up++;
      const r = await http('/rest/v1/profile_photos', { method: 'POST', jwt: u.jwt, body: { user_id: u.id, slot, storage_path: `${u.id}/${slot}-${QA_RUN}.jpg`, is_primary: slot === 1 }, headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' } });
      if (r.status === 201 || r.status === 200) rows++;
    }
    const mine = await http(`/rest/v1/profile_photos?user_id=eq.${u.id}&select=slot`, { jwt: u.jwt });
    u.prep = { profile: p.status, consent: m.status, uploads: up, photo_rows: rows, own_photos_visible: (mine.data ?? []).length };
  }
  check('준비(사용자 JWT): 본인 목적·소개 저장 · 동의 · 본인 사진 3장 업로드 · 본인 사진 목록 읽기', [A, B].every((u) => u.prep.profile === 204 && u.prep.consent === 200 && u.prep.uploads === 3 && u.prep.own_photos_visible === 3), { a: A.prep, b: B.prep });

  // 실제 RLS(사용자 JWT)
  const deny = {};
  for (const [col, val] of [['role', 'admin'], ['verification_status', 'verified'], ['is_admin', true], ['grade', 'vip']]) {
    const r = await http(`/rest/v1/profiles?id=eq.${A.id}`, { method: 'PATCH', jwt: A.jwt, body: { [col]: val }, headers: { Prefer: 'return=minimal' } });
    deny[col] = r.status;
  }
  const after = await http(`/rest/v1/profiles?id=eq.${A.id}&select=role,verification_status,is_admin,grade`, { jwt: A.jwt });
  check('RLS: role·verification_status·is_admin·grade 변경 거부(HTTP 상태) · 값 그대로', Object.values(deny).every((s) => s === 401 || s === 403) && after.data?.[0]?.role === 'user' && after.data?.[0]?.verification_status === 'pending' && after.data?.[0]?.is_admin === false && after.data?.[0]?.grade == null, { status: deny, now: after.data?.[0] });
  const otherProfile = await http(`/rest/v1/profiles?id=eq.${B.id}&select=id,bio`, { jwt: A.jwt });
  const otherPhotos = await http(`/rest/v1/profile_photos?user_id=eq.${B.id}&select=id`, { jwt: A.jwt });
  const otherObj = await http(`/storage/v1/object/profile-photos/${B.id}/1-${QA_RUN}.jpg`, { jwt: A.jwt });
  const otherUpload = await http(`/storage/v1/object/profile-photos/${B.id}/x-${QA_RUN}.jpg`, { method: 'POST', jwt: A.jwt, body: img, headers: { 'Content-Type': 'image/jpeg' } });
  const events = await http('/rest/v1/doit_request_events?select=id&limit=1', { jwt: A.jwt });
  const anonRead = await http('/rest/v1/profiles?select=id&limit=5');
  check('RLS: 남의 프로필 0 · 남의 사진 목록 0 · 남의 사진 파일 읽기 거부 · 남의 폴더 업로드 거부 · 대화 상태 표 직접 읽기 거부 · 비로그인 프로필 0',
    Array.isArray(otherProfile.data) && otherProfile.data.length === 0 && Array.isArray(otherPhotos.data) && otherPhotos.data.length === 0 && otherObj.status >= 400 && otherUpload.status >= 400 && [401, 403].includes(events.status) && Array.isArray(anonRead.data) && anonRead.data.length === 0,
    { other_profile: otherProfile.data?.length ?? otherProfile.status, other_photos: otherPhotos.data?.length ?? otherPhotos.status, other_object: otherObj.status, other_upload: otherUpload.status, events: events.status, anon_profiles: anonRead.data?.length ?? anonRead.status });

  // 실제 AI 대화(doit-agent · 사용자 JWT) · 상태 확인은 관리자 JWT 로 admin_session
  const stateOf = async (sid) => (await fn('doit-agent', ADM.jwt, { action: 'admin_session', sessionId: sid })).data?.session?.stored;
  const say = async (u, who, sid, text, extra = {}) => { const r = await fn('doit-agent', u.jwt, { action: 'agent_turn', requestId: rid(), sessionId: sid, text, ...extra }, 'agent_turn'); log.push({ who, text, status: r.status, kind: r.data?.turn?.kind ?? null, reply: r.data?.turn?.reply ?? null, question: r.data?.turn?.question ?? null, code: r.data?.code ?? null, ms: r.ms }); return r; };
  const start = async (u, who, first) => { const r = await fn('doit-agent', u.jwt, { action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: first }, 'agent_start'); log.push({ who, text: `(시작) ${first}`, status: r.status, code: r.data?.code ?? null, ms: r.ms }); return r.data?.session?.id; };
  const live = (st, id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED');
  const sq = (t) => String(t ?? '').replace(/\s/g, '');

  const sidA = await start(A, 'A', '친구처럼 편하게 대화하는 사이를 원해요');
  check('실제 AI: A 대화 시작(QA Edge → OpenAI)', !!sidA, log.at(-1));
  if (!sidA) return { stop: 'agent_start_failed', users: { a: A.id?.slice(0, 8) } };
  await say(A, 'A', sidA, '조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(A, 'A', sidA, '연락은 매일 하는 게 좋아요');
  const beforeReject = structuredClone((await stateOf(sidA)).state);
  await say(A, 'A', sidA, '아니 그런 뜻 아니야');
  const afterReject = structuredClone((await stateOf(sidA)).state);
  await say(A, 'A', sidA, '오늘은 여기까지 할게요');
  const stA1 = (await stateOf(sidA)).state;
  const fix = await say(A, 'A', sidA, '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요', { correction: { purpose: 'relationship_style' } });
  const SA = await stateOf(sidA);
  const ownGet = await fn('doit-agent', A.jwt, { action: 'agent_get' });
  check('RLS/본인 Agent 상태: 사용자 본인 대화 불러오기 가능(agent_get)', ownGet.status === 200 && ownGet.data?.session?.id === sidA, { status: ownGet.status });
  const peek = await fn('doit-agent', B.jwt, { action: 'admin_session', sessionId: sidA });
  check('RLS/남의 Agent 상태: 일반 사용자 B 가 A 대화 읽기 거부(403)', peek.status === 403, `status=${peek.status}`);

  const sidB = await start(B, 'B', '친구처럼 편하게 대화하는 사이를 원해요');
  await say(B, 'B', sidB, '조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(B, 'B', sidB, '천천히 알아가고 싶어요');
  await say(B, 'B', sidB, '오늘은 여기까지 할게요');
  const SB = await stateOf(sidB);
  check('실제 AI: 대화 실패 0(모든 턴 200)', log.every((l) => l.status === 200), log.filter((l) => l.status !== 200));

  // 거절(전제: 해석이 저장되고 화면에 보였는가)
  const rejTurn = beforeReject.turns.length + 1;
  const shown = (beforeReject.turns.at(-1)?.presented ?? []).map((p) => `${p.purpose}|${p.note}`);
  const pre = Object.entries(beforeReject.slots).flatMap(([id, s]) => s.items.filter((i) => i.status === 'CONFIRMED' && i.source_type === 'AI_EXTRACTED' && i.turn === rejTurn - 1 && shown.includes(`${id}|${i.note}`)).map((i) => ({ id, note: i.note, turn: i.turn })));
  const preAfter = pre.map((p) => ({ ...p, status: afterReject.slots[p.id].items.find((i) => i.turn === p.turn && i.note === p.note)?.status }));
  const rawKept = Object.values(afterReject.slots).flatMap((s) => s.items.filter((i) => i.source_type === 'USER_DIRECT' && i.turn === rejTurn - 1)).every((i) => i.status === 'CONFIRMED');
  check('거절: 전제(AI 해석 저장 + 화면에 보임) → 보인 해석만 거둠(1개 RETRACTED · 여럿 DISPUTED) · 사용자 원문 보존', pre.length ? preAfter.every((p) => (pre.length === 1 ? p.status === 'RETRACTED' : p.status === 'DISPUTED')) && rawKept : null, { pre, after: preAfter, raw_kept: rawKept, rule: afterReject.turns.at(-1)?.vague_reject ?? null });
  const rejLog = log.find((l) => l.who === 'A' && l.text === '아니 그런 뜻 아니야');
  check('거절: 다음 응답에 거둔 뜻 재등장 0', pre.length ? !pre.some((p) => sq(p.note).length >= 4 && [rejLog?.reply, rejLog?.question].some((t) => t && sq(t).includes(sq(p.note)))) : null, { reply: rejLog?.reply, question: rejLog?.question });

  // 정정 · 다른 칸 · Canonical State · Profile · 소개
  const styleNow = live(SA.state, 'relationship_style');
  check('정정: 화면 정정 → 정정(correction)으로 확정', fix.data?.turn?.kind === 'correction', `kind=${fix.data?.turn?.kind}`);
  check('정정: 최신 값 = 주말(USER_CORRECTED)', styleNow.length >= 1 && styleNow.every((i) => /주말/.test(i.note + i.quote) && i.source_type === 'USER_CORRECTED'), styleNow.map((i) => [i.note, i.source_type]));
  const bare = (t) => sq(t).replace(/[.,!?~…·"'「」]/g, '');
  const oldSrc = stA1.slots.relationship_style.items.filter((i) => /매일/.test(i.quote) && !/부담/.test(i.quote)).map((i) => ({ turn: i.turn, q: bare(i.quote) }));
  const copies = Object.entries(SA.state.slots).flatMap(([id, s]) => s.items.filter((i) => oldSrc.some((o) => o.turn === i.turn && o.q === bare(i.quote))).map((i) => ({ id, note: i.note, status: i.status })));
  check('다른 칸 정정: 옛 「매일」 과 같은 출처 값이 어느 칸에도 지금 값(CONFIRMED)으로 없음', oldSrc.length ? copies.every((c) => c.status !== 'CONFIRMED') : null, { old: oldSrc.length, copies });
  const allLive = Object.values(SA.state.slots).flatMap((s) => s.items.filter((i) => i.status === 'CONFIRMED'));
  check('Canonical State: 지금 값에 옛 「매일」 0 · 매일+주말 동시 존재 0 · 지금 값은 CONFIRMED 뿐', !allLive.some((i) => /매일/.test(i.note) && !/부담|주말/.test(i.note)), allLive.map((i) => [i.note, i.source_type]));
  const profA = SA.profile;
  check('Profile: 매칭 프로필 = CONFIRMED 만 · 연락 방식 = 주말', !!profA && ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'].every((id) => (profA[id].items ?? []).every((i) => i.status === 'CONFIRMED')) && (profA.relationship_style.items ?? []).every((i) => /주말/.test(i.note)), profA?.relationship_style?.items?.map((i) => i.note));
  const intro = (SA.state.intro?.lines ?? []).map((l) => l.text).join(' ');
  check('소개: 옛 값(매일 연락) 문장 0', !(/매일/.test(intro) && !/부담|주말/.test(intro)), intro);

  // 연결 준비 · Matching(QA MATCH_SOURCE=agent)
  const prevA = await fn('doit-understanding', A.jwt, { action: 'connection_preview' }, 'connection_preview');
  check('연결 준비(doit-understanding · 운영 v29+1줄): 응답 200', prevA.status === 200, { status: prevA.status, code: prevA.data?.code ?? null });
  const cand = await fn('doit-connect', ADM.jwt, { action: 'admin_candidates' }, 'admin_candidates');
  const pair = (cand.data?.candidates ?? []).find((c) => [c.user_a, c.user_b].sort().join() === [A.id, B.id].sort().join());
  const commonA = pair ? (pair.user_a === A.id ? pair.common_a : pair.common_b) : [];
  check('Matching(agent): A-B 실제 후보 생성', !!pair, { status: cand.status, n: (cand.data?.candidates ?? []).length, eligible: cand.data?.eligible, missing: cand.data?.missing, code: cand.data?.code ?? null });
  check('Matching: 겹친 말 > 0 · 점수 > 0', !!pair && commonA.length > 0 && (pair.score ?? 0) > 0, { commonA, score: pair?.score });
  check('Matching: 옛 「매일」·거둔 뜻 사용 0 · 사주/타로 0', !commonA.some((c) => (/매일/.test(c) && !/부담|주말/.test(c)) || /사주|타로|궁합|운세/.test(c)), commonA);
  check('전화: 전화 미인증 A 가 후보', !!pair && pair[pair.user_a === A.id ? 'a' : 'b']?.phone_verified === false, pair ? { a: pair.a, b: pair.b } : null);

  // 연결(현재 구현: 관리자 승인 → AI 첫 질문 → 둘 다 답 → 공개 → 대화) · 안전
  const dec = await fn('doit-connect', ADM.jwt, { action: 'admin_decide', userA: A.id, userB: B.id, decision: 'approve' }, 'admin_decide');
  const mA0 = await fn('doit-connect', A.jwt, { action: 'my_matches' });
  const match = (mA0.data?.matches ?? [])[0];
  check('연결: 관리자 승인 → 연결 생성 · AI 첫 질문', dec.status === 200 && !!match && !!match.first_question, { status: dec.status, code: dec.data?.code ?? null, first_question: match?.first_question ?? null, source: dec.data?.question_source ?? null });
  if (match) {
    await fn('doit-connect', A.jwt, { action: 'answer', matchId: match.id, text: '한강 산책길이요' });
    const mid = await fn('doit-connect', A.jwt, { action: 'my_matches' });
    await fn('doit-connect', B.jwt, { action: 'answer', matchId: match.id, text: '조용한 북카페요' });
    const both = await fn('doit-connect', A.jwt, { action: 'my_matches' });
    check('상호 공개: 둘 다 답하기 전 상대 정보 0 → 둘 다 답하면 열림', mid.data?.matches?.[0]?.revealed === false && !('partner' in (mid.data?.matches?.[0] ?? {})) && both.data?.matches?.[0]?.revealed === true, { before: mid.data?.matches?.[0]?.revealed, after: both.data?.matches?.[0]?.revealed });
    const msg = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: '반가워요' });
    const phone = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: '010-1234-5678 로 연락 주세요' });
    const link = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: 'https://open.kakao.com/o/abc 여기로 와요' });
    const sexual = await fn('doit-connect', A.jwt, { action: 'message', matchId: match.id, text: '오늘 밤 원나잇 할래요?' });
    check('안전: 대화 보내기 200 · 연락처 차단 · 외부 링크 차단', msg.status === 200 && phone.data?.code === 'BLOCKED_CONTENT' && link.data?.code === 'BLOCKED_CONTENT', { msg: msg.status, phone: phone.data?.code ?? phone.status, link: link.data?.code ?? link.status });
    check('안전: 성적 목적 문장 차단', sexual.data?.code === 'BLOCKED_CONTENT' ? true : sexual.status === 200 ? false : null, { status: sexual.status, code: sexual.data?.code ?? null });
    const leave = await fn('doit-connect', B.jwt, { action: 'leave', matchId: match.id, block: true, report: true });
    const again = await fn('doit-connect', ADM.jwt, { action: 'admin_candidates' });
    const re = await fn('doit-connect', ADM.jwt, { action: 'admin_decide', userA: A.id, userB: B.id, decision: 'approve', noCommonOk: true });
    const rep = await http(`/rest/v1/user_reports?reporter_id=eq.${B.id}&select=id,status`, { jwt: ADM.jwt });
    const blk = await http(`/rest/v1/blocks?blocker_id=eq.${B.id}&select=id`, { jwt: ADM.jwt });
    const repByA = await http(`/rest/v1/user_reports?reporter_id=eq.${B.id}&select=id`, { jwt: A.jwt });
    check('안전: 그만하기·차단·신고 → 신고·차단 기록 · 다시 후보 0 · 재승인 거부(409) · 신고당한 사람은 신고 기록 못 봄', leave.status === 200 && (rep.data ?? []).length === 1 && (blk.data ?? []).length === 1 && !(again.data?.candidates ?? []).some((c) => [c.user_a, c.user_b].includes(A.id) && [c.user_a, c.user_b].includes(B.id)) && re.status === 409 && (repByA.data ?? []).length === 0, { leave: leave.status, reports: (rep.data ?? []).length, blocks: (blk.data ?? []).length, re: re.status, report_visible_to_target: (repByA.data ?? []).length });
  }
  const verif = await http(`/rest/v1/profiles?id=in.(${A.id},${B.id})&select=verification_status`, { jwt: ADM.jwt });
  check('전화: verification_status 자동 변경 0', (verif.data ?? []).length === 2 && (verif.data ?? []).every((p) => p.verification_status === 'pending'), verif.data);

  // 관리자(서버 응답 · 화면은 QA 화면에서 따로)
  const adm = await fn('doit-agent', ADM.jwt, { action: 'admin_sessions' });
  const sess = adm.data?.sessions ?? [];
  const failed = (adm.data?.turns ?? []).filter((t) => t.record?.kind === 'error').length;
  check('관리자(서버 응답): 대화 세션 2 · Agent 판 v2.2.2 · 실패 턴 0', adm.status === 200 && sess.length === 2 && sess.every((s) => s.stored?.agent === 'echo-agent-v2.2.2') && failed === 0, { status: adm.status, n: sess.length, versions: sess.map((s) => s.stored?.agent), failed });
  const notAdmin = await fn('doit-agent', A.jwt, { action: 'admin_sessions' });
  check('관리자 권한: 일반 사용자 관리자 요청 거부(403)', notAdmin.status === 403, `status=${notAdmin.status}`);

  const ms = timings.filter((t) => t.label === 'agent_turn' || t.label === 'agent_start').map((t) => t.ms).sort((x, y) => x - y);
  const pct = (p) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * (ms.length - 1) + 0.5))] : null;
  const calls = (adm.data?.turns ?? []).flatMap((t) => t.record?.calls ?? []);
  const perf = { ai_turns: ms.length, p50_ms: pct(0.5), p95_ms: pct(0.95), max_ms: ms.at(-1) ?? null, http_5xx: timings.filter((t) => t.status >= 500).length, provider_errors: calls.filter((c) => c.error).length, retries: (adm.data?.turns ?? []).reduce((n, t) => n + ((t.record?.retry ?? []).length), 0), fallback: (adm.data?.turns ?? []).reduce((n, t) => n + (t.record?.fallback ?? 0), 0) };
  const models = [...new Set(calls.map((c) => c.model).filter(Boolean))];
  return { perf, models, conversation: log,
    state: { A: Object.fromEntries(Object.entries(SA.state.slots).map(([k, s]) => [k, s.items.map((i) => [i.note, i.status, i.source_type])])), B: Object.fromEntries(Object.entries(SB.state.slots).map(([k, s]) => [k, s.items.map((i) => [i.note, i.status, i.source_type])])), A_intro: intro, A_rejected: profA?.rejected_meanings ?? [] },
    matching: pair ? { common_a: pair.common_a, common_b: pair.common_b, score: pair.score } : null,
    test_accounts: { a: A.id?.slice(0, 8), b: B.id?.slice(0, 8), admin: ADM.id?.slice(0, 8) } };
}

async function main() {
  const extra = PHASE === 'signup' ? await signup() : await full();
  const summary = { env: 'ECHO-QA', ref: QA_REF, phase: PHASE, run: QA_RUN, pass: checks.filter((c) => c.result === 'PASS').length, fail: checks.filter((c) => c.result === 'FAIL').length, invalid: checks.filter((c) => c.result === 'INVALID').length, checks, ...extra };
  const text = JSON.stringify(summary, null, 1);
  if (OUT) writeFileSync(OUT, text);
  console.log(text);
  process.exitCode = summary.fail ? 1 : 0;
}
main().catch((e) => { console.error('QA 실행 오류:', e?.message ?? 'unknown'); process.exit(1); });
