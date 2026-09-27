// ECHO-QA 실제 AI 반복검사(2026-09-27 대표 「FINAL RELEASE CLOSING」 §4) — CROSS_SLOT_STALE_STATE P0 · QA 프로젝트 전용.
// 1차 FAIL 과 같은 원래 사용자 흐름: 시작 → 카페 → A(매일) → 「아니 그런 뜻 아니야」 → 그만 → 화면 정정 B 1회(relationship_style) · 사용자 칸 수동 수정 0.
// 판정 근거는 출처(turn)뿐. Matching source 는 배포본과 같은 agentSource.ts(sourceFromProfile) 로 계산. 비밀값 출력 0.
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { QA_REF, QA_ANON, QA_PW_SEED, QA_AGENT_SOURCE, N = '20', PREFIX = 'x', OUT } = process.env;
if (QA_REF !== 'mutniujeiyujhkobadkd' || !QA_ANON || !QA_PW_SEED || !QA_AGENT_SOURCE) { console.error('QA 환경값 없음/불일치'); process.exit(2); }
const URL0 = `https://${QA_REF}.supabase.co`;
const { sourceFromProfile } = await import(QA_AGENT_SOURCE);
const OLD = '연락은 매일 하는 게 좋아요', NEW = '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요';
const A_MEANING = /(매일|자주|항상|날마다)[^.!?]{0,20}연락|연락[^.!?]{0,20}(매일|자주|항상|날마다)/;
const pw = (run, tag) => `Qa!${createHash('sha256').update(`${QA_PW_SEED}:${run}:${tag}`).digest('base64url').slice(0, 24)}`;
async function http(path, { method = 'GET', jwt = null, body = null } = {}) {
  const r = await fetch(`${URL0}${path}`, { method, headers: { apikey: QA_ANON, Authorization: `Bearer ${jwt ?? QA_ANON}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d = null; try { d = JSON.parse(t); } catch { d = t.slice(0, 200); } return { status: r.status, data: d };
}
const login = async (email, password) => (await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })).data?.access_token ?? null;
const adminJwt = await login('qa-admin-20260927-r4@do-it.company', pw('r4', 'admin'));
if (!adminJwt) { console.error('관리자 로그인 실패'); process.exit(3); }
const fn = (jwt, body) => http('/functions/v1/doit-agent', { method: 'POST', jwt, body: { requestId: randomUUID(), ...body } });
const stateOf = async (sid) => (await fn(adminJwt, { action: 'admin_session', sessionId: sid })).data?.session?.stored;
const items = (st) => Object.entries(st.slots).flatMap(([slot, s]) => s.items.map((i) => ({ slot, ...i })));

async function one(k) {
  const run = `${PREFIX}${String(k).padStart(2, '0')}`; const email = `qa-${run}-20260927@do-it.company`; const password = pw(run, 'user');
  const su = await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-${run}` } } });
  const jwt = su.data?.access_token ?? await login(email, password); if (!jwt) return { run, error: `signup ${su.status}` };
  const st0 = await fn(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', firstAnswer: '친구처럼 편하게 대화하는 사이를 원해요' });
  const sid = st0.data?.session?.id; if (!sid) return { run, error: `start ${st0.status}` };
  const say = async (text, extra = {}) => { const r = await fn(jwt, { action: 'agent_turn', sessionId: sid, text, ...extra }); if (r.status !== 200) throw new Error(`turn ${r.status} ${r.data?.code ?? ''}`); return r.data?.turn; };
  await say('조용한 카페에서 오래 이야기하는 걸 좋아해요');
  await say(OLD);
  const afterA = (await stateOf(sid)).state; const turnA = afterA.turns.at(-1).n;
  await say('아니 그런 뜻 아니야'); await say('오늘은 여기까지 할게요');
  const beforeB = (await stateOf(sid)).state;
  const fix = await say(NEW, { correction: { purpose: 'relationship_style' } });
  const S = await stateOf(sid); const st = S.state; const turnB = st.turns.at(-1).n;
  const aSaved = items(afterA).filter((i) => i.turn === turnA);
  const aBeforeB = items(beforeB).filter((i) => i.turn === turnA && i.status === 'CONFIRMED');
  const aNow = items(st).filter((i) => i.turn === turnA && ['CONFIRMED', 'USER_CORRECTED'].includes(i.status));
  const bNow = items(st).filter((i) => i.turn === turnB && i.status === 'CONFIRMED' && i.source_type === 'USER_CORRECTED');
  const linkInStyle = items(beforeB).some((i) => i.slot === 'relationship_style' && i.turn === turnA); // v2.0 연결 고리(정정 칸의 옛 값) 존재
  const pickedByAi = aBeforeB.filter((b) => items(st).some((i) => i.slot === b.slot && i.turn === b.turn && i.note === b.note && i.status === 'RETRACTED'));
  const otherBefore = items(beforeB).filter((i) => i.turn !== turnA && i.turn !== turnB && i.status === 'CONFIRMED');
  const otherLost = otherBefore.filter((o) => !items(st).some((i) => i.slot === o.slot && i.turn === o.turn && i.note === o.note && i.status === 'CONFIRMED'));
  const aNotes = new Set(aSaved.map((i) => i.note.replace(/\s/g, '')));
  const prof = S.profile ?? {}; const profNotes = Object.values(prof).flatMap((s) => (s?.items ?? []).map((i) => i.note));
  const profA = profNotes.filter((n) => aNotes.has(String(n).replace(/\s/g, '')) || (A_MEANING.test(n) && !/부담|주말|한두\s*번/.test(n)));
  const intro = (st.intro?.lines ?? []).map((l) => l.text).join(' ');
  const introA = intro.split(/(?<=[.!?。])\s+/).filter((x) => A_MEANING.test(x) && !/부담|주말|한두\s*번/.test(x));
  const src = sourceFromProfile(S.profile, st.phase, null).confirmed;
  const srcA = src.filter((n) => aNotes.has(String(n).replace(/\s/g, '')) || (A_MEANING.test(n) && !/부담|주말|한두\s*번/.test(n)));
  const srcB = src.filter((n) => bNow.some((b) => b.note === n));
  return { run, agent: S.agent, kind: fix?.kind, a_saved: aSaved.map((i) => [i.slot, i.source_type, i.status, i.note]), a_current_before_B: aBeforeB.length, link_in_style: linkInStyle,
    no_link_case: aBeforeB.length > 0 && !linkInStyle, ai_picked: pickedByAi.length, a_current_after: aNow.length, b_current: bNow.length, other_lost: otherLost.map((i) => [i.slot, i.note]),
    profile_a: profA, intro_a: introA, source_a: srcA, source_b: srcB.length, intro,
    p0_fail: aNow.length > 0 || profA.length > 0 || introA.length > 0 || srcA.length > 0 || bNow.length === 0 || otherLost.length > 0 };
}
const n = +N; const results = []; const conc = 4; let next = 1;
await Promise.all(Array.from({ length: conc }, async () => { while (next <= n) { const k = next++; try { results.push(await one(k)); } catch (e) { results.push({ run: `${PREFIX}${String(k).padStart(2, '0')}`, error: e.message }); } } }));
results.sort((a, b) => a.run.localeCompare(b.run));
const ok = results.filter((r) => !r.error);
const summary = { total: n, completed: ok.length, errors: results.filter((r) => r.error).length, agent_versions: [...new Set(ok.map((r) => r.agent))],
  a_had_current_before_B: ok.filter((r) => r.a_current_before_B > 0).length, no_link_cases: ok.filter((r) => r.no_link_case).length,
  ai_picked_runs: ok.filter((r) => r.ai_picked > 0).length, ai_missed_in_no_link: ok.filter((r) => r.no_link_case && r.ai_picked === 0).length,
  a_remaining_runs: ok.filter((r) => r.a_current_after > 0).length, profile_reappear: ok.filter((r) => r.profile_a.length).length, intro_reappear: ok.filter((r) => r.intro_a.length).length,
  matching_reuse: ok.filter((r) => r.source_a.length).length, b_missing: ok.filter((r) => r.b_current === 0).length, other_fact_wrongly_removed: ok.filter((r) => r.other_lost.length).length,
  p0_fail_runs: ok.filter((r) => r.p0_fail).length };
if (OUT) writeFileSync(OUT, JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
process.exitCode = summary.p0_fail_runs || summary.errors ? 1 : 0;
