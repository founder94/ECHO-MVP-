// ECHO Conversation Agent 관리자 관측(2026-09-25). 서버(doit-agent)가 준 실제 세션·턴 기록만으로 계산한다 — 가짜 사용자·가짜 수치 0.
// 시험판 product/spike/agent-v1-20260925/admin.mjs 를 운영 데이터 모양에 맞게 옮겼다.
// 자동 후보는 늘 CANDIDATE 이다(VERIFIED 자동 승격 금지). ACTUAL = 기록에 그대로 보이는 사건, HYPOTHESIS = 문장 끝 말투 같은 추정 관측.
import { serverFunctionRequest } from '@/doit/lib/understandingApi';

export const PURPOSE_IDS = ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'] as const;

interface StateTurn { n: number; ai: string | null; question_purpose: string | null; user: string; kind: string; reply?: string; question?: string | null; decision?: string; saved?: boolean; recovered?: string[]; dropped?: string }
export interface IntroInfo { status: 'ready' | 'failed' | 'none'; lines: { text: string; basis: string }[]; dropped: Record<string, number>; tries: number; error: string | null; used: 'as_is' | 'edited' | 'own' | null; used_at: string | null }
interface StoredState { tone: string; mode: string; phase: string; turns: StateTurn[]; asked: { type: string; purpose: string; text: string }[]; closing: string | null; corrections: string[]; disputed: string[]; intro?: IntroInfo | null }
// 연결 준비의 부족 조건(서버가 profiles 에서 읽은 참·거짓만 — 번호·소개 글은 오지 않는다). 예전 서버는 이 칸이 없다.
export interface ReadinessInfo { phone_verified: boolean; intro_saved: boolean }
export interface PhotoInfo { count: number; primary: boolean; last_updated_at: string | null }
export interface RawSession { id: string; user: string; nickname: string | null; created_at: string; updated_at: string; photos?: PhotoInfo; readiness?: ReadinessInfo; stored: { agent?: string; state?: StoredState; profile?: Record<string, unknown> | null; handoff?: { status?: string } | null } | null }
export interface CallRec { kind: string; ms: number; model: string | null; input_tokens: number | null; output_tokens: number | null; error: string | null }
export interface TurnRecord { agent_version?: string; prompt_version?: string; policy_version?: string; pipeline_version?: string; guard?: { from: string; to: string; rule: string } | null; superseded?: number; error?: string; turn_index: number | null; kind: string; saved: boolean; decision: string; question_index: number; question_purpose: string | null; flags: Record<string, boolean>; provider: string; model_requested: string; calls: CallRec[]; retry: string[]; fallback: number; tone_mismatch_observed: boolean; id_leak: boolean; record_error: string | null; total_ms: number }
export interface RawTurn { session_id: string; created_at: string; record: TurnRecord | null }

export interface Turn { i: number; user: string; assistant: string; question_purpose: string | null; action: string; flags: Record<string, boolean>; rec: TurnRecord | null; decision: string | null; recovered: string[] }
export interface Session { id: string; user: string; nickname: string | null; agent: string; mode: string; tone: string; phase: string; created_at: string; updated_at: string; core: number; clarify: number; turns: Turn[]; profile: Record<string, unknown> | null; handoff: { status?: string } | null; records: TurnRecord[]; photos: PhotoInfo | null; intro: IntroInfo | null; readiness: ReadinessInfo | null }

export function normalize(raw: RawSession, allTurns: RawTurn[]): Session {
  const st = raw.stored?.state;
  const records = allTurns.filter(t => t.session_id === raw.id && t.record).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(t => t.record as TurnRecord);
  const byIndex = new Map(records.filter(r => r.turn_index != null).map(r => [r.turn_index as number, r]));
  const turns: Turn[] = (st?.turns ?? []).map(t => {
    const rec = byIndex.get(t.n) ?? null;
    return { i: t.n, user: t.user, assistant: [t.reply, t.decision?.startsWith('finish') ? st?.closing : null, t.question].filter(Boolean).join('\n'), question_purpose: t.question_purpose, action: t.kind,
      flags: rec?.flags ?? { correction: t.kind === 'correction', rejection: t.kind === 'repair', complaint: t.kind === 'repair', skip: t.kind === 'skip', fatigue: t.kind === 'stop' }, rec,
      decision: t.decision ?? null, recovered: t.recovered ?? [] };
  });
  return { id: raw.id, user: raw.user, nickname: raw.nickname, agent: raw.stored?.agent ?? '알 수 없음', mode: st?.mode ?? '기록 없음', tone: st?.tone ?? '기록 없음', phase: st?.phase === 'talk' ? 'talk' : 'done',
    created_at: raw.created_at, updated_at: raw.updated_at, core: (st?.asked ?? []).filter(q => q.type === 'core').length, clarify: (st?.asked ?? []).filter(q => q.type === 'clarify').length,
    turns, profile: raw.stored?.profile ?? null, handoff: raw.stored?.handoff ?? null, records, photos: raw.photos ?? null, intro: st?.intro ?? null, readiness: raw.readiness ?? null };
}

const pct = (xs: number[], p: number): number | null => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]; };
const calls = (sessions: Session[]) => sessions.flatMap(s => s.records.flatMap(r => r.calls ?? []));
const sum = (xs: (number | null)[]) => xs.reduce<number>((n, x) => n + (Number.isFinite(x) ? (x as number) : 0), 0);

const STALL_MS = 24 * 60 * 60 * 1000; // 진행 중인데 하루 넘게 말이 없으면 「멈춤」(중도 이탈 후보)
export function dashboard(sessions: Session[], now: number = Date.now()) {
  const cs = calls(sessions);
  const ok = cs.filter(c => !c.error);
  const cand = sessions.map(candidates);
  const count = (f: (s: Session) => boolean) => sessions.filter(f).length;
  const recs = sessions.flatMap(s => s.records);
  return {
    sessions: sessions.length, in_progress: count(s => s.phase === 'talk'), done: count(s => s.phase === 'done'),
    text: count(s => s.mode === 'TEXT'), voice: count(s => s.mode === 'VOICE'),
    stalled: count(s => s.phase === 'talk' && now - Date.parse(s.updated_at) > STALL_MS),
    with_photos: count(s => (s.photos?.count ?? 0) > 0), with_primary: count(s => !!s.photos?.primary),
    // 소개 초안(서버 v1.6~): 만든 것·못 만든 것·재료 없음 · 사용자가 고른 것(그대로·고침·직접). 예전 대화는 기록 없음.
    intro: { ready: count(s => s.intro?.status === 'ready'), failed: count(s => s.intro?.status === 'failed'), none: count(s => s.intro?.status === 'none'), no_record: count(s => s.phase === 'done' && !s.intro),
      as_is: count(s => s.intro?.used === 'as_is'), edited: count(s => s.intro?.used === 'edited'), own: count(s => s.intro?.used === 'own') },
    phone_verified: count(s => !!s.readiness?.phone_verified), intro_saved: count(s => !!s.readiness?.intro_saved), readiness_unknown: count(s => !s.readiness),
    tones: { formal: count(s => s.tone === 'formal'), polite: count(s => s.tone === 'polite'), casual: count(s => s.tone === 'casual') },
    progress: Object.fromEntries([0, 1, 2, 3, 4, 5].map(n => [n, count(s => s.core === n)])) as Record<number, number>,
    flags: { correction: recs.filter(r => r.flags?.correction).length, rejection: recs.filter(r => r.flags?.rejection).length, skip: recs.filter(r => r.flags?.skip).length, fatigue: recs.filter(r => r.flags?.fatigue).length, ask: recs.filter(r => r.flags?.ask).length, help: recs.filter(r => r.flags?.help).length },
    matching_ready: count(s => !!s.handoff), matching_status: [...new Set(sessions.map(s => s.handoff?.status).filter((x): x is string => !!x))],
    failure_candidates: cand.reduce((n, c) => n + c.failure.length, 0), success_candidates: cand.reduce((n, c) => n + c.success.length, 0),
    ai_calls: cs.length, ai_errors: cs.length - ok.length, latency_p50: pct(ok.map(c => c.ms), 50), latency_p95: pct(ok.map(c => c.ms), 95),
    input_tokens: sum(ok.map(c => c.input_tokens)), output_tokens: sum(ok.map(c => c.output_tokens)),
    cost: '확인 불가 — 공식 단가를 확인하지 못해 계산하지 않음',
  };
}

// version: 실패가 어느 판(에이전트·프롬프트·모델)에서 났는지(2026-09-26 FAILURE → VERSION). 예전 기록은 판 칸이 없어 「판 기록 없음」.
export interface Candidate { type: string; session: string; turn: number | null; user: string | null; agent: string | null; evidence: 'ACTUAL' | 'HYPOTHESIS'; status: 'CANDIDATE'; note: string; version: string }
export function candidates(s: Session): { failure: Candidate[]; success: Candidate[] } {
  const failure: Candidate[] = []; const success: Candidate[] = [];
  const ver = (r: TurnRecord | null | undefined) => r?.agent_version ? `${r.agent_version} · ${r.prompt_version ?? '?'} · ${r.calls?.find((c) => c.model)?.model ?? r.model_requested ?? '모델 기록 없음'}` : `${s.agent} · 판 기록 없음`;
  const add = (list: Candidate[]) => (type: string, t: Turn | null, evidence: Candidate['evidence'], note: string) => list.push({ type, session: s.id, turn: t?.i ?? null, user: t?.user ?? null, agent: t?.assistant ?? null, evidence, status: 'CANDIDATE', note, version: ver(t?.rec ?? s.records.at(-1)) });
  const f = add(failure); const ok = add(success);
  if (s.core > 5) f('QUESTIONS_OVER_5', null, 'ACTUAL', `핵심 질문 ${s.core}개`);
  const seen = new Map<string, number>();
  for (const t of s.turns) {
    const r = t.rec;
    if (r?.calls?.some(c => c.error)) f('TURN_ERROR', t, 'ACTUAL', r.calls.filter(c => c.error).map(c => c.error).join(','));
    if (r?.id_leak) f('PROMPT_ID_LEAK', t, 'ACTUAL', '내부 목적 이름이 화면 문장에 나옴');
    if (r?.tone_mismatch_observed) f('TONE_MISMATCH', t, 'HYPOTHESIS', '문장 끝으로 본 말투가 고른 말투와 다름(관측 추정)');
    if ((r?.retry ?? []).some(x => x.endsWith(':kept'))) f('CONTRACT_KEPT_AFTER_RETRY', t, 'ACTUAL', (r?.retry ?? []).join(','));
    if (r?.record_error) f('RECORD_SAVE_FAILED', t, 'ACTUAL', r.record_error);
    // 실제 외부 사용자 피드백(2026-09-25): 질문 뜻을 되물음(「예를 들면?」) = 질문이 모호했다는 실제 신호. 어느 질문이었는지 그 턴에 붙인다.
    if (t.flags.help) f('ANSWER_SCOPE_UNCLEAR', t, 'ACTUAL', '사용자가 질문 뜻·예시를 물음(질문 구체성 확인 필요)');
    if (t.flags.complaint || t.flags.fatigue) f(t.flags.fatigue ? 'QUESTION_FATIGUE' : 'USER_COMPLAINT', t, 'ACTUAL', '사용자가 항의·피로를 말함(원인 확인 전)');
    const q = t.assistant.split('\n').at(-1) ?? '';
    if (/[?？]$/.test(q)) { const k = q.replace(/\s+/g, ''); if (seen.has(k) && t.action !== 'ask') f('SAME_QUESTION_REPEATED', t, 'ACTUAL', `턴 ${seen.get(k)} 와 글자까지 같은 질문`); else seen.set(k, t.i); }
  }
  if (s.phase === 'done' && s.core <= 5) ok('FINISHED_WITHIN_5', s.turns.at(-1) ?? null, 'ACTUAL', `핵심 질문 ${s.core}개로 마침`);
  if (s.profile) {
    const confirmed = PURPOSE_IDS.filter(id => (s.profile?.[id] as { status?: string } | undefined)?.status === 'CONFIRMED').length;
    if (confirmed >= 3) ok('PROFILE_READY', null, 'ACTUAL', `직접 말한 목적 ${confirmed}/5`);
    const corr = (s.profile.user_corrections as string[] | undefined) ?? [];
    if (corr.length) ok('CORRECTION_RECORDED', null, 'ACTUAL', `정정 ${corr.length}건이 프로필에 남음`);
  }
  s.turns.forEach((t, k) => {
    const next = s.turns[k + 1];
    if (t.flags.skip && next && next.question_purpose !== t.question_purpose) ok('SKIP_HONORED', t, 'ACTUAL', '넘긴 뒤 다른 목적으로 이동');
    if (t.action === 'ask' && t.assistant) ok('ANSWERED_USER_QUESTION', t, 'HYPOTHESIS', '질문에 먼저 답했는지는 사람이 확인');
    // 같은 질문을 다시 보인 바로 다음에 사용자가 항의 → 이미 답한 것을 다시 물은 후보(운영 2026-09-25 Galaxy 실측과 같은 모양). 원인은 사람이 확인.
    const prev = s.turns[k - 1];
    if (t.action === 'repair' && prev?.decision === 'keep_after_answer') f('ALREADY_ANSWERED_REASK', t, 'ACTUAL', `턴 ${prev.i} 뒤 같은 질문을 다시 보였고 사용자가 항의함`);
    if (t.recovered.length) ok('MEMORY_RECOVERED', t, 'ACTUAL', `앞선 말에서 되살림: ${t.recovered.join(', ')}`);
  });
  return { failure, success };
}

export function observability(sessions: Session[]) {
  const rows = new Map<string, { key: string; provider: string; calls: number; errors: number; ms: number[]; input: number; output: number }>();
  for (const s of sessions) for (const r of s.records) for (const c of r.calls ?? []) {
    const key = `${r.provider ?? '?'} · ${c.model ?? r.model_requested ?? '모델 기록 없음'} · ${c.kind}`;
    const row = rows.get(key) ?? { key, provider: r.provider, calls: 0, errors: 0, ms: [], input: 0, output: 0 };
    row.calls++; if (c.error) row.errors++; else { row.ms.push(c.ms); row.input += c.input_tokens ?? 0; row.output += c.output_tokens ?? 0; }
    rows.set(key, row);
  }
  const recs = sessions.flatMap(s => s.records);
  return { retries: recs.reduce((n, r) => n + (r.retry ?? []).length, 0), fallback: recs.reduce((n, r) => n + (r.fallback ?? 0), 0),
    rows: [...rows.values()].map(r => ({ key: r.key, provider: r.provider, calls: r.calls, errors: r.errors, p50: pct(r.ms, 50), p95: pct(r.ms, 95), input_tokens: r.input, output_tokens: r.output, cost: '확인 불가' })) };
}

export async function fetchAgentAdmin(): Promise<Session[]> {
  const r = await serverFunctionRequest<{ sessions: RawSession[]; turns: RawTurn[] }>('doit-agent', { action: 'admin_sessions' });
  if (!Array.isArray(r.sessions) || !Array.isArray(r.turns)) throw new Error('INVALID_RESPONSE');
  return r.sessions.map(s => normalize(s, r.turns));
}

// ── ECHO 전체 파이프라인(2026-09-26 대표 END-TO-END PIPELINE LOCK) — 사용자(대화 세션) 한 명이 어디까지 왔고 어디서 막혔는지.
// 서버가 준 실제 기록만 쓴다. 기록이 없으면 UNKNOWN(모름)이지 PASS 가 아니다. 외부 연결이 없어 막힌 단계는 BLOCKED 로 적고 이유를 붙인다.
export type StageState = 'PASS' | 'PARTIAL' | 'WAIT' | 'FAIL' | 'BLOCKED' | 'UNKNOWN';
export interface Stage { key: string; label: string; state: StageState; note: string }
export const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: 'input', label: '입력(글·말)' }, { key: 'conversation', label: '대화(최대 5)' }, { key: 'ai_os', label: 'AI OS(기억·정정·거절)' },
  { key: 'state', label: '확정 정보(CONFIRMED)' }, { key: 'ai_profile', label: 'AI 소개 · 사용자 확인' }, { key: 'photo', label: '사진' },
  { key: 'phone', label: '전화 인증' }, { key: 'matching_ready', label: '연결 준비' }, { key: 'candidate', label: '후보·연결' },
];
const AI_OS_FAILS = new Set(['QUESTIONS_OVER_5', 'PROMPT_ID_LEAK', 'ALREADY_ANSWERED_REASK', 'SAME_QUESTION_REPEATED', 'TURN_ERROR']);
export function pipeline(s: Session): { stages: Stage[]; stuck: Stage | null; aiOs: { guard: number; superseded: number; recovered: number; corrections: number; errors: number } } {
  const st = (key: string, state: StageState, note: string): Stage => ({ key, label: PIPELINE_STAGES.find((x) => x.key === key)!.label, state, note });
  const recs = s.records;
  const aiOs = {
    guard: recs.filter((r) => r.guard).length, superseded: recs.reduce((n, r) => n + (r.superseded ?? 0), 0),
    recovered: s.turns.filter((t) => t.recovered.length).length, corrections: recs.filter((r) => r.flags?.correction).length,
    errors: recs.filter((r) => r.kind === 'error' || (r.calls ?? []).some((c) => c.error)).length,
  };
  const fails = candidates(s).failure.filter((c) => AI_OS_FAILS.has(c.type));
  const confirmed = s.profile ? PURPOSE_IDS.filter((id) => (s.profile?.[id] as { status?: string } | undefined)?.status === 'CONFIRMED').length : null;
  const stages: Stage[] = [
    st('input', s.mode === 'TEXT' || s.mode === 'VOICE' ? 'PASS' : 'UNKNOWN', s.mode === 'VOICE' ? '말(키보드 받아쓰기) — 실시간 음성 아님' : s.mode === 'TEXT' ? '글' : '기록 없음'),
    st('conversation', s.phase === 'done' ? 'PASS' : 'WAIT', `핵심 질문 ${s.core}/5 · ${s.phase === 'done' ? '끝남' : '진행 중'}`),
    st('ai_os', fails.length ? 'PARTIAL' : recs.length ? 'PASS' : 'UNKNOWN',
      fails.length ? `문제 후보: ${[...new Set(fails.map((f) => f.type))].join(', ')}` : recs.length ? `가드 ${aiOs.guard} · 정정 교체 ${aiOs.superseded} · 되살림 ${aiOs.recovered} · 오류 ${aiOs.errors}` : '턴 기록 없음(예전 대화)'),
    st('state', confirmed == null ? (s.phase === 'done' ? 'UNKNOWN' : 'WAIT') : confirmed >= 1 ? (confirmed >= 3 ? 'PASS' : 'PARTIAL') : 'FAIL', confirmed == null ? '매칭 프로필 없음' : `직접 말한 목적 ${confirmed}/5`),
    st('ai_profile', !s.intro ? (s.phase === 'done' ? 'UNKNOWN' : 'WAIT') : s.intro.used ? 'PASS' : s.intro.status === 'ready' ? 'WAIT' : s.intro.status === 'failed' ? 'FAIL' : 'PARTIAL',
      !s.intro ? '초안 기록 없음' : s.intro.used ? `사용자 확인: ${s.intro.used === 'as_is' ? '그대로' : s.intro.used === 'edited' ? '고쳐서' : '직접 씀'}` : s.intro.status === 'ready' ? '초안 있음 · 사용자 확인 전' : s.intro.status === 'failed' ? '초안 못 만듦' : '재료 없음'),
    st('photo', !s.photos ? 'UNKNOWN' : s.photos.count > 0 && s.photos.primary ? 'PASS' : s.photos.count > 0 ? 'PARTIAL' : 'WAIT', !s.photos ? '기록 없음' : `${s.photos.count}장 · 대표 ${s.photos.primary ? '있음' : '없음'}`),
    st('phone', !s.readiness ? 'UNKNOWN' : s.readiness.phone_verified ? 'PASS' : 'BLOCKED', !s.readiness ? '기록 없음' : s.readiness.phone_verified ? '인증됨' : '문자 발송 업체 미연결(STOP · 대표 승인 필요)'),
  ];
  const needed = ['conversation', 'ai_profile', 'photo', 'phone'].filter((k) => stages.find((x) => x.key === k)!.state !== 'PASS');
  stages.push(st('matching_ready', needed.length ? (needed.includes('phone') ? 'BLOCKED' : 'WAIT') : 'PASS', needed.length ? `남은 것: ${needed.map((k) => PIPELINE_STAGES.find((x) => x.key === k)!.label).join(', ')}` : '조건 충족'));
  stages.push(st('candidate', 'BLOCKED', s.handoff?.status === 'NOT_CONNECTED' || s.handoff ? '서버 후보 결정 계약은 준비됨 · 연결 서버가 아직 쓰지 않아 후보 0(가짜 후보 0)' : '매칭 프로필 없음'));
  return { stages, stuck: stages.find((x) => x.state !== 'PASS') ?? null, aiOs };
}
// 단계별로 PASS 에 닿은 사람 수와, 가장 많은 사람이 멈춘 단계 TOP 3(병목).
export function pipelineSummary(sessions: Session[]) {
  const all = sessions.map(pipeline);
  const reached = Object.fromEntries(PIPELINE_STAGES.map((x) => [x.key, all.filter((p) => p.stages.find((y) => y.key === x.key)?.state === 'PASS').length]));
  const stuckCount = new Map<string, number>();
  for (const p of all) if (p.stuck) stuckCount.set(p.stuck.key, (stuckCount.get(p.stuck.key) ?? 0) + 1);
  const top = [...stuckCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, n]) => ({ key, label: PIPELINE_STAGES.find((x) => x.key === key)!.label, n }));
  return { total: sessions.length, reached, top };
}
