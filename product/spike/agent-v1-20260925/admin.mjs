// ECHO 관리자 관측(v1.1 명세 §12~§19) — 대표 전용 시험 페이지의 「관리자」 화면이 쓰는 순수 함수. 제품·운영 코드가 아니다.
// - 데이터 = 이 페이지 db 의 sessions 문서(대표 휴대폰 시험의 실제 기록). 가짜 데이터·가짜 수치를 만들지 않는다.
// - 옛 core-0.1 시험 문서와 echo-agent-v1.x 문서를 둘 다 읽는다(모양이 다르다 — 없는 값은 「기록 없음」).
// - 자동 후보는 늘 CANDIDATE 이다(VERIFIED 자동 승격 금지). 증거 수준: ACTUAL = 기록에서 그대로 보이는 사건, HYPOTHESIS = 문장 끝 추정 같은 관측.

export const ADMIN_VERSION = 'echo-admin-v0.1';
const PURPOSE_IDS = ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'];
const LEAK = /relationship_|attraction_comfort|values_character|RELATIONSHIP_INTENT/i;

export function normalizeSession(id, doc) {
  const d = doc ?? {};
  const v11 = typeof d.agent === 'string';
  const agent = v11 ? d.agent : d.core ? `core ${d.core}` : '알 수 없음';
  let turns;
  if (v11 && Array.isArray(d.records)) {
    turns = d.records.map((r) => ({ i: r.turn_index, user: r.user_raw_text ?? null, assistant: r.assistant_text ?? '', question_index: r.question_index ?? null, question_purpose: r.question_purpose ?? null,
      action: r.agent_action ?? null, flags: { correction: !!r.correction, rejection: !!r.rejection, complaint: !!r.complaint, skip: !!r.skip, fatigue: !!r.fatigue },
      provider: r.model_provider ?? null, model: r.model_tier_applied ?? r.model ?? null, latency: r.latency_ms ?? null, error: r.error ?? null, retry: r.retry ?? [], tone_mismatch: !!r.tone_mismatch_observed, audio_ms: r.audio_output_ms ?? null }));
  } else {
    turns = (d.turns ?? []).map((t, k) => ({ i: t.n ?? k + 1, user: t.user ?? null, assistant: [t.reply, t.question].filter(Boolean).join('\n'), question_index: null, question_purpose: null, action: t.kind ?? null,
      flags: { correction: t.kind === 'correction', rejection: t.kind === 'repair', complaint: t.kind === 'repair', skip: false, fatigue: t.kind === 'stop' },
      provider: 'anthropic (claude.ai sample)', model: (d.calls ?? [])[k + 1]?.tier ?? null, latency: (d.calls ?? [])[k + 1]?.ms ?? null, error: null, retry: [], tone_mismatch: null, audio_ms: null, prev_ai: t.ai ?? null }));
  }
  const core = v11 ? (d.asked ?? []).filter((q) => q.type === 'core').length : null;
  return { id, agent, v11, mode: d.mode ?? (v11 ? null : 'TEXT'), tone: d.tone ?? null, phase: d.phase ?? null, started: d.started ?? null, updated: d.updated ?? null,
    turns, core, clarify: v11 ? (d.asked ?? []).filter((q) => q.type === 'clarify').length : null, profile: d.profile ?? null, handoff: d.handoff ?? null, calls: d.calls ?? [], facts: d.facts ?? null };
}

const pct = (xs, p) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };

export function dashboard(sessions) {
  const calls = sessions.flatMap((s) => s.calls);
  const ms = calls.filter((c) => !c.error && Number.isFinite(c.ms)).map((c) => c.ms);
  const cand = sessions.map(candidates);
  const count = (f) => sessions.filter(f).length;
  return {
    sessions: sessions.length, in_progress: count((s) => s.phase === 'talk'), done: count((s) => s.phase === 'done'),
    text: count((s) => s.mode === 'TEXT'), voice: count((s) => s.mode === 'VOICE'),
    progress: Object.fromEntries([0, 1, 2, 3, 4, 5].map((n) => [n, count((s) => s.v11 && s.core === n)])), progress_unknown: count((s) => !s.v11),
    matching_ready: count((s) => !!s.handoff), matching_status: [...new Set(sessions.map((s) => s.handoff?.status).filter(Boolean))],
    failure_candidates: cand.reduce((n, c) => n + c.failure.length, 0), success_candidates: cand.reduce((n, c) => n + c.success.length, 0),
    ai_calls: calls.length, ai_errors: calls.filter((c) => c.error).length, latency_p50: pct(ms, 50), latency_p95: pct(ms, 95),
    tokens: '확인 불가 — 페이지의 Claude 호출은 토큰 수를 돌려주지 않는다', cost: '확인 불가 — 토큰 수·공식 단가 없음',
  };
}

// 자동 후보(실패·성공). 증거가 기록에 그대로 있는 것만 ACTUAL.
export function candidates(s) {
  const failure = []; const success = [];
  const f = (type, t, evidence, note) => failure.push({ type, session: s.id, turn: t?.i ?? null, user: t?.user ?? null, agent: t?.assistant ?? null, evidence, status: 'CANDIDATE', note });
  const ok = (type, t, evidence, note) => success.push({ type, session: s.id, turn: t?.i ?? null, user: t?.user ?? null, agent: t?.assistant ?? null, evidence, status: 'CANDIDATE', note });
  if (s.v11 && s.core > 5) f('QUESTIONS_OVER_5', null, 'ACTUAL', `핵심 질문 ${s.core}개`);
  if (s.phase === 'talk' && s.turns.length >= 6) f('CONVERSATION_EXIT_FAILURE', s.turns.at(-1), 'ACTUAL', `${s.turns.length}턴째 대화가 끝나지 않음`);
  const seen = new Map();
  for (const t of s.turns) {
    if (t.error) f('TURN_ERROR', t, 'ACTUAL', String(t.error));
    if (t.assistant && LEAK.test(t.assistant)) f('PROMPT_ID_LEAK', t, 'ACTUAL', '내부 목적 이름이 화면 문장에 나옴');
    if (t.tone_mismatch) f('TONE_MISMATCH', t, 'HYPOTHESIS', '문장 끝으로 본 말투가 고른 말투와 다름(관측 추정)');
    if ((t.retry ?? []).some((r) => String(r).endsWith(':kept'))) f('CONTRACT_KEPT_AFTER_RETRY', t, 'ACTUAL', (t.retry ?? []).join(','));
    if (t.flags.complaint || t.flags.fatigue) f(t.flags.fatigue ? 'QUESTION_FATIGUE' : 'USER_COMPLAINT', t, 'ACTUAL', '사용자가 항의·피로를 말함(원인 확인 전)');
    const q = (t.assistant ?? '').split('\n').at(-1);
    if (q && /[?？]$/.test(q)) { const k = q.replace(/\s+/g, ''); if (seen.has(k)) f('SAME_QUESTION_REPEATED', t, 'ACTUAL', `턴 ${seen.get(k)} 와 글자까지 같은 질문`); else seen.set(k, t.i); }
  }
  if (s.v11 && s.phase === 'done' && s.core <= 5) ok('FINISHED_WITHIN_5', s.turns.at(-1), 'ACTUAL', `핵심 질문 ${s.core}개로 마침`);
  if (s.profile) {
    const confirmed = PURPOSE_IDS.filter((id) => s.profile[id]?.status === 'CONFIRMED').length;
    if (confirmed >= 3) ok('PROFILE_READY', null, 'ACTUAL', `직접 말한 목적 ${confirmed}/5`);
    if ((s.profile.user_corrections ?? []).length) ok('CORRECTION_RECORDED', null, 'ACTUAL', `정정 ${s.profile.user_corrections.length}건이 프로필에 남음`);
  }
  s.turns.forEach((t, k) => {
    const next = s.turns[k + 1];
    if (t.flags.skip && next && next.question_purpose !== t.question_purpose) ok('SKIP_HONORED', t, 'ACTUAL', '넘긴 뒤 다른 목적으로 이동');
    if (t.action === 'ask' && t.assistant) ok('ANSWERED_USER_QUESTION', t, 'HYPOTHESIS', '질문에 먼저 답했는지는 사람이 확인');
  });
  return { failure, success };
}

export function observability(sessions) {
  const rows = {};
  for (const s of sessions) for (const c of s.calls) {
    const key = `${s.agent} · ${s.mode ?? '?'} · ${c.tier ?? '등급 기록 없음'}`;
    const r = rows[key] ??= { key, provider: 'anthropic (claude.ai sample)', calls: 0, errors: 0, ms: [], truncated: 0 };
    r.calls++; if (c.error) r.errors++; else if (Number.isFinite(c.ms)) r.ms.push(c.ms); if (c.truncated) r.truncated++;
  }
  const retries = sessions.reduce((n, s) => n + s.turns.reduce((m, t) => m + (t.retry ?? []).length, 0), 0);
  return { retries, fallback: 0, rows: Object.values(rows).map((r) => ({ key: r.key, provider: r.provider, calls: r.calls, errors: r.errors, truncated: r.truncated, p50: pct(r.ms, 50), p95: pct(r.ms, 95),
    tokens: '확인 불가', cost: '확인 불가' })) };
}
