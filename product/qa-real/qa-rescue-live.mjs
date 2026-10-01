// 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE」 실제 AI 장면 A~E — QA 서버(doit-agent)·실제 AI · 새 시험 계정 · 운영 0 · 비밀값 0(QA 공개 키만).
//  A 「잘 모르겠어요」 → 자연스러운 보기 2~4 (누른 도움 요청 · 쓴 말 둘 다)
//  B 「그건 다 아닌데」 → 억지 없이 직접 말하게 · 그 보기는 다시 안 나옴
//  C 보기 고름 → 고치기 → 최신이 이김(Profile 지금 값에 옛 보기 0)
//  D 관계 속도를 이미 말함 → 다시 묻지 않음(질문·보기 둘 다)
//  E 「답답해요」 → 질문 피로(저장 0 · 성격 사실 0) · 다음 질문은 보기를 먼저 펼침
// 실행: QA_ANON=<QA 공개 키> node qa-real/qa-rescue-live.mjs   (보기 글자는 사람 검토용으로 그대로 찍는다 — 사용자 원문 아님 · 시험 계정)
import { randomUUID } from 'node:crypto';
const SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const ANON = process.env.QA_ANON;
if (!ANON) { console.error('QA_ANON 없음'); process.exit(2); }
const REPEAT = Number(process.env.RESCUE_REPEAT ?? 2);
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
const http = async (path, { method = 'GET', jwt = null, body = null, headers = {} } = {}) => {
  const r = await fetch(`${SB}${path}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${jwt ?? ANON}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); }
  return { status: r.status, data };
};
async function account(tag) {
  const email = `qa-rescue-${Date.now()}-${tag}@do-it.company`; const password = `Qa!${randomUUID()}`;
  await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-RESCUE-${tag}` } } });
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  const jwt = tok.data?.access_token; const uid = tok.data?.user?.id;
  if (jwt) await http(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', jwt, body: { purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', consent_version: 'v1.0' }, headers: { Prefer: 'return=minimal' } });
  return jwt;
}
const call = (jwt, body) => http('/functions/v1/doit-agent', { method: 'POST', jwt, body: { requestId: randomUUID(), ...body } });
const BAD_OPTION = /[?？]|모르|넘어|그만|여기까지|직접\s*(말|설명)|답답|선호|외향|내향|성향|유형|[A-Za-z]{3,}|데이팅|소개팅|궁합|점술|심리치료|성격검사/;
const goodOptions = (r) => !!r && r.options.length >= 2 && r.options.length <= 4 && r.options.every((o) => o.length <= 16 && !BAD_OPTION.test(o)) && new Set(r.options).size === r.options.length;
const liveNotes = (p) => Object.values(p ?? {}).filter((v) => v && Array.isArray(v.items)).flatMap((v) => v.items.filter((i) => i.status === 'CONFIRMED').map((i) => `${i.note} ${i.quote}`)).join(' | ');
const finish = async (jwt, sid) => { await call(jwt, { action: 'agent_turn', sessionId: sid, text: '오늘은 여기까지 할게요' }); return (await call(jwt, { action: 'agent_get', sessionId: sid })).data?.session; };

for (let k = 1; k <= REPEAT; k++) {
  // ── A 「잘 모르겠어요」(누름 = 구조 요청) → 지금 질문의 보기 2~4 · 쓴 「잘 모르겠어요」 → 저장 0 + 다음 질문 보기 먼저 펼침
  {
    const jwt = await account(`a${k}`);
    const st = await call(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '편하게 얘기할 친구를 만나고 싶어요' });
    const sid = st.data?.session?.id; const q = st.data?.session?.current_question;
    const rs = await call(jwt, { action: 'agent_rescue', sessionId: sid });
    const r = rs.data?.session?.current_rescue;
    check(`A${k} 잘 모르겠어요(누름) → 보기 2~4 · 일상 말 · 내부 말 0`, rs.status === 200 && r?.show === true && goodOptions(r), `Q「${q}」 → ${JSON.stringify(r?.options)} fallback=${r?.fallback}`);
    check(`A${k} 구조 요청은 답이 아니다(대화 기록에 사용자 말 추가 0)`, (rs.data?.session?.messages ?? []).filter((m) => m.role === 'user').length === (st.data?.session?.messages ?? []).filter((m) => m.role === 'user').length);
    const u = await call(jwt, { action: 'agent_turn', sessionId: sid, text: '잘 모르겠어요' });
    const r2 = u.data?.session?.current_rescue;
    check(`A${k} 잘 모르겠어요(씀) = unsure · 저장 0 · 다음 질문 보기 먼저 펼침(또는 안전 안내 기록)`, u.status === 200 && u.data?.turn?.kind === 'unsure' && u.data?.turn?.saved === false && (!u.data?.turn?.question || (r2?.show === true && goodOptions(r2)) || r2?.fallback === true), `Q「${u.data?.turn?.question}」 → ${JSON.stringify(r2?.options)} show=${r2?.show} fallback=${r2?.fallback}`);
  }
  // ── B 「그건 다 아닌데」 → 억지 없이 직접 · 거절 보기 재등장 0
  {
    const jwt = await account(`b${k}`);
    const st = await call(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '같이 밥 먹으면서 얘기할 친구요' });
    const sid = st.data?.session?.id;
    const rs = await call(jwt, { action: 'agent_rescue', sessionId: sid }); const shown = rs.data?.session?.current_rescue?.options ?? []; const q = rs.data?.session?.current_question;
    const no = await call(jwt, { action: 'agent_turn', sessionId: sid, text: '그건 다 아닌데', rescueOpen: true });
    const t = no.data?.turn; const s = no.data?.session;
    check(`B${k} 「그건 다 아닌데」 = 저장 0 · 같은 질문을 주관식으로 · 직접 말하게 안내`, no.status === 200 && t?.saved === false && t?.question === q && /직접|떠오르는 대로/.test(t?.reply ?? '') && s?.current_rescue?.show === false, `shown=${JSON.stringify(shown)} reply「${t?.reply}」 q「${t?.question}」`);
    const again = await call(jwt, { action: 'agent_rescue', sessionId: sid }); const r = again.data?.session?.current_rescue;
    check(`B${k} 거절한 보기는 다시 안 나옴`, !(r?.options ?? []).some((o) => shown.includes(o)), `again=${JSON.stringify(r?.options)} fallback=${r?.fallback}`);
  }
  // ── C 고름 → 고치기 → 최신이 이김
  {
    const jwt = await account(`c${k}`);
    const st = await call(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '주말에 같이 놀 친구를 찾아요' });
    const sid = st.data?.session?.id;
    const rs = await call(jwt, { action: 'agent_rescue', sessionId: sid }); const opts = rs.data?.session?.current_rescue?.options ?? [];
    const picked = opts[0];
    const p = picked ? await call(jwt, { action: 'agent_turn', sessionId: sid, text: picked, choice: picked, rescueOpen: true }) : null;
    check(`C${k} 고른 보기 = 사용자 직접 답으로 저장 · 뒤로 복원 정보(previous)`, !!p && p.status === 200 && p.data?.turn?.saved === true && p.data?.session?.previous?.chosen === picked, `picked「${picked}」 saved=${p?.data?.turn?.saved} previous=${JSON.stringify(p?.data?.session?.previous)?.slice(0, 120)}`);
    const fixText = '아니 그건 아니고 조용히 산책하면서 얘기하는 게 좋아요';
    const fx = await call(jwt, { action: 'agent_turn', sessionId: sid, text: fixText, correction: { purpose: null } });
    const done = await finish(jwt, sid); const live = liveNotes(done?.profile);
    check(`C${k} 고친 뒤 최신이 이김(지금 값에 옛 보기 0 · 고친 말 반영)`, fx.status === 200 && !!picked && !live.includes(picked) && /산책/.test(live), `phase=${done?.phase} live=${live.slice(0, 200)}`);
  }
  // ── D 관계 속도를 이미 말함 → 다시 묻지 않음(질문·보기)
  {
    const jwt = await account(`d${k}`);
    const st = await call(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '천천히 알아가는 친구가 좋고 연락은 주말에 한두 번이면 충분해요' });
    const sid = st.data?.session?.id; const asked = [st.data?.session?.current_question]; const offered = [];
    for (const a of ['솔직한 사람이 편해요', '약속 잘 지키는 게 중요해요']) {
      const rs = await call(jwt, { action: 'agent_rescue', sessionId: sid }); offered.push(...(rs.data?.session?.current_rescue?.options ?? []));
      const r = await call(jwt, { action: 'agent_turn', sessionId: sid, text: a }); asked.push(r.data?.turn?.question); offered.push(...(r.data?.session?.current_rescue?.options ?? []));
      if (r.data?.session?.phase === 'done') break;
    }
    const PACE_Q = /얼마나\s*자주|연락.{0,8}(자주|몇\s*번|빈도|얼마)|몇\s*번.{0,6}(연락|만나)|(천천히|빨리).{0,6}(알아가|가까워)/;
    const PACE_O = /천천히|주말에\s*한두\s*번|자주\s*연락|매일\s*연락/;
    check(`D${k} 이미 말한 관계 속도를 다시 묻지 않음(질문)`, !asked.filter(Boolean).some((q) => PACE_Q.test(q)), JSON.stringify(asked));
    check(`D${k} 이미 말한 관계 속도를 보기로 다시 내밀지 않음`, !offered.some((o) => PACE_O.test(o)), JSON.stringify(offered));
  }
  // ── E 「답답해요」 → 질문 피로 · 저장 0 · 성격 사실 0 · 다음 질문 보기 먼저 펼침
  {
    const jwt = await account(`e${k}`);
    const st = await call(jwt, { action: 'agent_start', tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '편하게 얘기할 친구요' });
    const sid = st.data?.session?.id;
    const e = await call(jwt, { action: 'agent_turn', sessionId: sid, text: '답답해요' });
    const r = e.data?.session?.current_rescue;
    check(`E${k} 답답해요 = 피로(repair) · 저장 0 · 다음 질문 보기 먼저 펼침(또는 안전 안내 기록)`, e.status === 200 && e.data?.turn?.kind === 'repair' && e.data?.turn?.saved === false && (!e.data?.turn?.question || (r?.show === true && goodOptions(r)) || r?.fallback === true), `Q「${e.data?.turn?.question}」 → ${JSON.stringify(r?.options)}`);
    const done = await finish(jwt, sid);
    check(`E${k} Profile·요약·소개에 「답답」 0`, !/답답/.test(JSON.stringify({ live: liveNotes(done?.profile), summary: done?.summary ?? [], intro: done?.intro?.text ?? null })), `phase=${done?.phase}`);
  }
}
const pass = results.filter(Boolean).length;
console.log(`\nRESCUE LIVE ${results.length} · PASS ${pass} · FAIL ${results.length - pass}`);
process.exit(pass === results.length ? 0 : 1);
