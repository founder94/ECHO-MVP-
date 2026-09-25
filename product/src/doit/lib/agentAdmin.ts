// ECHO Conversation Agent 관리자 관측(2026-09-25). 서버(doit-agent)가 준 실제 세션·턴 기록만으로 계산한다 — 가짜 사용자·가짜 수치 0.
// 시험판 product/spike/agent-v1-20260925/admin.mjs 를 운영 데이터 모양에 맞게 옮겼다.
// 자동 후보는 늘 CANDIDATE 이다(VERIFIED 자동 승격 금지). ACTUAL = 기록에 그대로 보이는 사건, HYPOTHESIS = 문장 끝 말투 같은 추정 관측.
import { serverFunctionRequest } from '@/doit/lib/understandingApi';

export const PURPOSE_IDS = ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'] as const;

interface StateTurn { n: number; ai: string | null; question_purpose: string | null; user: string; kind: string; reply?: string; question?: string | null; decision?: string; saved?: boolean; recovered?: string[]; dropped?: string }
interface StoredState { tone: string; mode: string; phase: string; turns: StateTurn[]; asked: { type: string; purpose: string; text: string }[]; closing: string | null; corrections: string[]; disputed: string[] }
export interface PhotoInfo { count: number; primary: boolean; last_updated_at: string | null }
export interface RawSession { id: string; user: string; nickname: string | null; created_at: string; updated_at: string; photos?: PhotoInfo; stored: { agent?: string; state?: StoredState; profile?: Record<string, unknown> | null; handoff?: { status?: string } | null } | null }
export interface CallRec { kind: string; ms: number; model: string | null; input_tokens: number | null; output_tokens: number | null; error: string | null }
export interface TurnRecord { turn_index: number | null; kind: string; saved: boolean; decision: string; question_index: number; question_purpose: string | null; flags: Record<string, boolean>; provider: string; model_requested: string; calls: CallRec[]; retry: string[]; fallback: number; tone_mismatch_observed: boolean; id_leak: boolean; record_error: string | null; total_ms: number }
export interface RawTurn { session_id: string; created_at: string; record: TurnRecord | null }

export interface Turn { i: number; user: string; assistant: string; question_purpose: string | null; action: string; flags: Record<string, boolean>; rec: TurnRecord | null; decision: string | null; recovered: string[] }
export interface Session { id: string; user: string; nickname: string | null; agent: string; mode: string; tone: string; phase: string; created_at: string; updated_at: string; core: number; clarify: number; turns: Turn[]; profile: Record<string, unknown> | null; handoff: { status?: string } | null; records: TurnRecord[]; photos: PhotoInfo | null }

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
    turns, profile: raw.stored?.profile ?? null, handoff: raw.stored?.handoff ?? null, records, photos: raw.photos ?? null };
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

export interface Candidate { type: string; session: string; turn: number | null; user: string | null; agent: string | null; evidence: 'ACTUAL' | 'HYPOTHESIS'; status: 'CANDIDATE'; note: string }
export function candidates(s: Session): { failure: Candidate[]; success: Candidate[] } {
  const failure: Candidate[] = []; const success: Candidate[] = [];
  const add = (list: Candidate[]) => (type: string, t: Turn | null, evidence: Candidate['evidence'], note: string) => list.push({ type, session: s.id, turn: t?.i ?? null, user: t?.user ?? null, agent: t?.assistant ?? null, evidence, status: 'CANDIDATE', note });
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
