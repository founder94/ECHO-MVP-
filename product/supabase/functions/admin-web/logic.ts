// ADMIN WEB(admin.do-it.company) 서버 계산 — 읽기만 한다(쓰기 0). 2026-09-28 대표 「ADMIN WEB FINAL BUILD ORDER」.
// 원칙: 저장된 실제 값에서만 센다. 값을 만들 수 없는 칸은 숫자 대신 이유(없음 · 연결 필요 · 확인 필요)를 돌려준다.
// 대화 품질 판정은 대화 서버(doit-agent/agent.ts)의 같은 규칙을 가져다 쓴다 — 관리자 화면만의 다른 기준을 만들지 않는다.
import { COUNSEL, SIMILAR_Q, askedEcho, goalOf, goalResidue, type AgentState, type Item } from "../doit-agent/agent.ts";

export type Json = Record<string, unknown>;
export type Period = "today" | "7d" | "30d";
export const PERIODS: Period[] = ["today", "7d", "30d"];

// 한국 시각(KST) 기준 기간 시작.
export function periodStart(period: Period, now = new Date()): string {
  if (period === "7d") return new Date(now.getTime() - 7 * 86400_000).toISOString();
  if (period === "30d") return new Date(now.getTime() - 30 * 86400_000).toISOString();
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const midnightKst = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000;
  return new Date(midnightKst).toISOString();
}

// 개인정보 최소 노출: 메일은 앞 한 글자 + 도메인, 사용자 id 는 앞 8자리만 화면에 쓴다(전체 id 는 관리자 서버 응답 안에서만 연결용).
export function maskEmail(email: unknown): string | null {
  const e = typeof email === "string" ? email.trim() : "";
  const at = e.indexOf("@");
  if (at < 1) return e ? "***" : null;
  return `${e[0]}***${e.slice(at)}`;
}
export const shortId = (id: unknown) => String(id ?? "").slice(0, 8);

const bare = (t: unknown) => String(t ?? "").normalize("NFKC").replace(/\s+/g, "").replace(/[.,!?~…·"'「」]/g, "");
const pairs = (t: string) => { const o = new Set<string>(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o; };
export function dice(a: string, b: string): number { const A = pairs(a), B = pairs(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return (2 * n) / (A.size + B.size); }

// ── 사용자 확정 상태(대표 §7): 저장된 항목의 상태·출처를 여섯 가지 한국어 이름으로.
export type FactState = "확정" | "사용자 정정" | "미확정" | "폐기" | "거절" | "분쟁 중";
export function factState(item: Pick<Item, "status" | "source_type">): FactState {
  if (item.status === "RETRACTED") return "거절";
  if (item.status === "DISPUTED") return "분쟁 중";
  if (item.status === "SUPERSEDED") return "폐기";
  return item.source_type === "USER_CORRECTED" ? "사용자 정정" : "확정";
}
// 연결(매칭)에 쓰는 값은 지금 확정(CONFIRMED)인 것뿐이다 — 추측·폐기·거절·분쟁은 쓰지 않는다.
export const usedForMatching = (s: FactState) => s === "확정" || s === "사용자 정정";

export interface FactRow { area: string; text: string; state: FactState; matching: boolean; turn: number }
export function factsOf(st: AgentState): FactRow[] {
  const rows: FactRow[] = [];
  for (const [area, slot] of Object.entries(st.slots ?? {})) {
    for (const it of slot.items ?? []) { const s = factState(it); rows.push({ area, text: it.note, state: s, matching: usedForMatching(s), turn: it.turn }); }
  }
  for (const inf of st.inferred ?? []) rows.push({ area: "추측", text: inf.trait, state: "미확정", matching: false, turn: inf.turn });
  return rows;
}

// ── 질문 품질 모니터(대표 §9): 사용자에게 실제로 보인 것(질문·받아주기·정리)만으로 판정한다.
export type QualityKey = "repeat" | "goal_mismatch" | "counsel" | "correction_ignored" | "unsure_repeat" | "summary_mismatch";
export const QUALITY_LABEL: Record<QualityKey, string> = {
  repeat: "반복 질문", goal_mismatch: "목적 불일치", counsel: "상담사 말투",
  correction_ignored: "정정 후 방향 미변경", unsure_repeat: "「잘 모르겠어」 뒤 같은 질문", summary_mismatch: "정리 목적 불일치",
};
export function shownQuestions(st: AgentState): string[] { return (st.asked ?? []).map((a) => a.text).filter(Boolean); }
export function qualityOf(st: AgentState): Record<QualityKey, number> {
  const out: Record<QualityKey, number> = { repeat: 0, goal_mismatch: 0, counsel: 0, correction_ignored: 0, unsure_repeat: 0, summary_mismatch: 0 };
  const asked = shownQuestions(st);
  for (let i = 0; i < asked.length; i++) for (let j = i + 1; j < asked.length; j++) if (dice(bare(asked[i]), bare(asked[j])) >= SIMILAR_Q) out.repeat++;
  const turns = st.turns ?? [];
  for (const t of turns) {
    if ((t.question && goalResidue(st, t.question)) || (t.reply && goalResidue(st, t.reply))) out.goal_mismatch++;
    if (t.reply && COUNSEL.test(t.reply)) out.counsel++;
  }
  // 턴 n 의 사용자 말은 앞 턴이 보인 질문(prev)에 대한 답이다. 정정·모르겠다 뒤 새 질문이 앞 질문과 거의 같으면 실패로 센다.
  for (let k = 0; k < turns.length; k++) {
    const t = turns[k]; const prevQ = k === 0 ? (st.asked?.[0]?.text ?? t.ai ?? null) : (turns[k - 1].question ?? null);
    if (!t.question || !prevQ) continue;
    const same = dice(bare(prevQ), bare(t.question)) >= SIMILAR_Q;
    if (same && t.guard?.rule === "goal_mismatch") out.correction_ignored++;
    if (same && (t.kind === "unsure" || t.guard?.rule === "unsure_only")) out.unsure_repeat++;
  }
  const finals = [...(st.summary ?? []).map((s) => s.text), st.closing ?? "", ...(st.intro?.lines ?? []).map((l) => l.text)].filter(Boolean);
  if (finals.some((x) => goalResidue(st, x) || askedEcho(st, x))) out.summary_mismatch++;
  return out;
}
const sumQ = (q: Record<QualityKey, number>) => Object.values(q).reduce((a, b) => a + b, 0);

// 목적 이름만 바꾼 질문(대표 §9): 친구 대화의 질문에서 목적 낱말을 빼면 연애 대화의 질문과 거의 같은지(기간 안의 실제 질문끼리).
export const LABEL_ONLY_MAX = 250;
export function labelOnlyPairs(sessions: { goal: string; questions: string[] }[], limit = 5): { a: string; b: string }[] {
  const strip = (t: string) => bare(t).replace(/친구|연인|연애|사람|상대|분|동료|함께일할/g, "");
  // 서로 다른 질문만 · 목적마다 최대 LABEL_ONLY_MAX 개(실제 QA 실측: 1,000개 대화를 전부 맞대면 함수 계산 한도 546).
  const uniq = (goal: string) => [...new Set(sessions.filter((s) => s.goal === goal).flatMap((s) => s.questions.slice(1)))].slice(0, LABEL_ONLY_MAX);
  const f = uniq("friend"); const r = uniq("romantic").map((x) => ({ x, s: strip(x) }));
  const out: { a: string; b: string }[] = [];
  for (const a of f) { const sa = strip(a); const b = r.find((x) => dice(sa, x.s) >= 0.8); if (b) out.push({ a, b: b.x }); if (out.length >= limit) break; }
  return out;
}

// ── 세션 한 줄 요약(목록용). 원문은 목록에 넣지 않는다(상세에서만).
export interface SessionRowIn { request_id: string; user_id: string; created_at: string; updated_at: string; response_payload: { agent?: string; state?: AgentState } | null }
export function sessionSummary(r: SessionRowIn) {
  const st = r.response_payload?.state;
  const q = st ? qualityOf(st) : null;
  const turns = st?.turns ?? [];
  return {
    id: r.request_id, user: shortId(r.user_id), user_id: r.user_id, created_at: r.created_at, updated_at: r.updated_at,
    agent: r.response_payload?.agent ?? null, goal: st ? (st.goal ?? "open") : null, goal_label: st?.goal_label ?? (st ? goalOf(st).name : null),
    phase: st?.phase ?? null, done: st ? st.phase !== "talk" : false, turns: turns.length, questions: st ? shownQuestions(st).length : 0,
    corrections: turns.filter((t) => t.kind === "correction").length, rejections: turns.filter((t) => t.kind === "repair").length,
    quality: q, quality_total: q ? sumQ(q) : 0,
    summary: (st?.summary ?? []).map((s) => s.text).slice(0, 5),
  };
}
export type SessionSummary = ReturnType<typeof sessionSummary>;

// ── 턴 기록(서버가 턴마다 남긴 관측 줄): 실패·모델·판 번호.
export interface TurnRowIn { user_id?: string; target_id: string; created_at: string; status: string; response_payload: { record?: Json | null } | null }
export function turnFailed(t: TurnRowIn): boolean {
  const rec = (t.response_payload?.record ?? {}) as Json;
  return t.status === "failed" || rec.kind === "error";
}
export function turnModel(t: TurnRowIn): string | null {
  const rec = (t.response_payload?.record ?? {}) as { calls?: { model?: string | null }[] };
  return rec.calls?.find((c) => c.model)?.model ?? null;
}

// ── 대시보드(20초) 판정: 정상 · 주의 · 오류 세 가지만.
export type Level = "정상" | "주의" | "오류";
export interface Health { level: Level; reasons: string[] }
export function serviceHealth(x: { turns: number; failedTurns: number; quality: number; openReports: number; severeReports: number; dataErrors: string[] }): Health {
  const reasons: string[] = [];
  let level: Level = "정상";
  const bump = (l: Level) => { if (l === "오류" || (l === "주의" && level === "정상")) level = l; };
  if (x.dataErrors.length) { bump("오류"); reasons.push(`자료를 읽지 못한 곳: ${x.dataErrors.join(", ")}`); }
  const rate = x.turns ? x.failedTurns / x.turns : 0;
  if (x.failedTurns && rate >= 0.2) { bump("오류"); reasons.push(`AI 가 답을 못 만든 대화 ${x.failedTurns}건(${Math.round(rate * 100)}%)`); }
  else if (x.failedTurns) { bump("주의"); reasons.push(`AI 가 답을 못 만든 대화 ${x.failedTurns}건`); }
  if (x.severeReports) { bump("오류"); reasons.push(`중대 의심 신고 ${x.severeReports}건`); }
  else if (x.openReports) { bump("주의"); reasons.push(`처리 안 된 신고 ${x.openReports}건`); }
  if (x.quality) { bump("주의"); reasons.push(`대화 품질 실패 ${x.quality}건`); }
  return { level, reasons };
}

// 신고 사유 글자로 중대 의심을 고른다(판정·제재 아님 — 사람이 본다).
export const SEVERE = /폭력|위협|협박|성적|성희롱|성추행|미성년|사기|스토킹|자해|자살|불법|몰카|촬영/;

// 대표가 확인할 것 — 결정이 필요한 것만 최대 3개. 모두 실제 값에서 나온다.
export function decisions(x: { severeReports: number; openReports: number; failedTurns: number; qualityTop: { label: string; n: number } | null; eligible: number | null; candidates: number | null; google: boolean | null }): string[] {
  const out: string[] = [];
  if (x.severeReports) out.push(`중대 의심 신고 ${x.severeReports}건을 직접 확인하세요.`);
  if (x.google === false) out.push("Google 로그인이 이 서버에서 꺼져 있습니다.");
  if (x.failedTurns) out.push(`AI 가 답을 못 만든 대화 ${x.failedTurns}건을 확인하세요.`);
  if (x.qualityTop && x.qualityTop.n) out.push(`대화 품질 실패(${x.qualityTop.label}) ${x.qualityTop.n}건을 확인하세요.`);
  if (x.openReports && !x.severeReports) out.push(`처리 안 된 신고 ${x.openReports}건이 있습니다.`);
  if (x.eligible === 0) out.push("연결 준비가 된 사용자가 0명입니다.");
  else if (x.candidates === 0) out.push("연결 후보가 0쌍입니다.");
  return out.slice(0, 3);
}
