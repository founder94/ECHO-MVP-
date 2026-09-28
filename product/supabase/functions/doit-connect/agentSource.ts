// Matching Integration(2026-09-27 대표 「FINAL IMPLEMENTATION MASTER」 §26 · PHASE 10) — 운영 미배포 · 기본 꺼짐.
// 문제: 연결(doit-connect)이 ECHO Agent 가 서버에서 확정한 상태(CONFIRMED)를 읽지 않았다(doit_insights 만 읽음 · Agent 는 그 표에 쓰지 않음 · 원문 기록 수는 밀린 값까지 셈).
// 해결: 이미 있는 표 doit_request_events 의 agent_session 줄에서 profile(= Agent matchingProfile · CONFIRMED 만)만 골라 읽는다(DB 변경 0 · 대화 원문 turns 는 읽지 않음).
// 매칭에 쓰지 않는 것: AI 추정(inferred) · 미확정(pending) · 거절(rejected) · 밀린 값(history · SUPERSEDED) · 사주·타로 결과(Agent 가 profile 에 넣지 않음 — 여기서도 한 번 더 막음).
// 중복 구현 금지: 목적 목록·「CONFIRMED 이고 추정 아님」 규칙은 기존 매칭 계약 doit-agent/matching.ts(PURPOSE_IDS · signals)를 그대로 쓴다.
import { PURPOSE_IDS, signals, type MatchingProfileLike } from "../doit-agent/matching.ts";

export interface AgentSessionRow { user_id: string; created_at: string | null; updated_at: string | null; profile: unknown; phase: unknown }
export interface AgentMatchSource { confirmed: string[]; confirmedAreas: number; finished: boolean; ready: boolean; sessionAt: string | null }

// 준비 기준(2026-09-27 대표 「v3.4 SAFE PUSH」 실측 정리): 관계 목적(친구·연애 등 profiles.purpose_id — 사용자가 1개 고름)은 index.ts 가 따로 요구하고 같은 목적끼리만 후보가 된다.
// 여기 숫자는 목적 개수가 아니다 — Agent 가 알아 가는 정보 영역 5칸(matching.ts PURPOSE_IDS: relationship_intent · attraction_comfort · values_character · relationship_style · boundaries)
// 가운데 확정(CONFIRMED · 추정 아님 · 사주·타로 아님) 정보가 있는 칸 수다. 대화를 마쳤고(끝난 뒤 고치기 포함) 이 수가 기준 이상이면 준비됨.
// 3 은 제품 확정값이 아닌 임시값(대표 확인 필요) — 이 상수 하나로만 바꾼다. MATCH_SOURCE=agent 가 아니면 쓰이지 않는다(기본 legacy).
export const AGENT_READY_MIN_CONFIRMED_AREAS = 3;
export const AGENT_CONFIRMED_MAX = 12;
const CONTENT_WORDS = /사주|타로|카드|궁합|운세/;
// 2026-09-29 대표 「FINAL RELEASE CLOSING」 매칭 안전: 사용자가 직접 말한 값 · 직접 확인한 값 · 직접 고친 값만 매칭 재료(공통점 · 준비 칸 수).
// AI 가 사용자 말을 정리한 문장(AI_EXTRACTED)은 CONFIRMED 여도 쓰지 않는다(추정 INFERRED 는 signals() 가 이미 뺌).
export const MATCH_SOURCE_TYPES = new Set(["USER_DIRECT", "USER_CONFIRMED", "USER_CORRECTED"]);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? v as Obj : null);
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "");

// 2026-09-27 출시 차단 P0-6 최소 보강(서버 규칙 2개 · 새 저장 0):
//  ① 최신 정정 우선: 같은 칸에 사용자가 고쳐 말한 값(USER_CORRECTED)이 있으면, 그보다 앞 턴의 값은 아직 CONFIRMED 로 남아 있어도 매칭에 쓰지 않는다
//     (모델이 정정을 보통 답으로 읽어 옛 값이 밀리지 않은 경우의 안전망).
//  ② 거절한 뜻 재등장 차단: 사용자가 아니라고 해 거둔 뜻(history 의 RETRACTED)과 같은 뜻을 AI 가 다른 표현으로 다시 정리(AI_EXTRACTED)했으면 쓰지 않는다.
//     부정 표현이 한쪽에만 있으면 다른 뜻 · 사용자가 직접 한 말(USER_DIRECT · USER_CORRECTED)은 사용자 최신 설명이라 그대로 쓴다.
const squashT = (t: string) => t.normalize("NFKC").replace(/\s+/g, "");
const NEG_MARK = /(안|않|못|말고|싫|없|아니)/;
const pairsOf = (t: string) => { const o = new Set<string>(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o; };
function sameMeaning(a0: string, b0: string): boolean {
  const a = squashT(a0), b = squashT(b0);
  if (!a || !b) return false;
  if (a === b) return true;
  if (NEG_MARK.test(a) !== NEG_MARK.test(b)) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.includes(short)) return true;
  const A = pairsOf(a), B = pairsOf(b); let n = 0; for (const x of A) if (B.has(x)) n++;
  return (2 * n) / (A.size + B.size) >= 0.7;
}
function retractedNotes(profile: unknown): string[] {
  const p = obj(profile); if (!p) return [];
  return PURPOSE_IDS.flatMap((id) => { const slot = obj(p[id]); return (Array.isArray(slot?.history) ? slot!.history as unknown[] : []).map(obj).filter((o): o is Obj => !!o && o.status === "RETRACTED").map((o) => clean(o.note)).filter(Boolean); });
}

// ③ 같은 출처 밀림(2026-09-27 대표 「CROSS-SLOT CORRECTION」): 정정으로 밀린 값(history 의 SUPERSEDED)과 같은 사용자 말(source_turn)의 같은 원문(quote)에서 나온
//    다른 칸의 값은 아직 CONFIRMED 로 남아 있어도 쓰지 않는다(v2.2.2 이전에 저장된 상태의 안전망). 근거는 출처(턴·원문)뿐 — 뜻 유사도는 쓰지 않는다.
const bareQuote = (t: string) => squashT(t).replace(/[.,!?~…·"'「」]/g, "");
//    거둔 값(RETRACTED)도 같은 칸에 그보다 뒤의 사용자 정정(USER_CORRECTED)이 있으면 그 정정으로 바뀐 옛 뜻으로 본다.
function supersededSources(profile: unknown): { turn: number; quote: string }[] {
  const p = obj(profile); if (!p) return [];
  return PURPOSE_IDS.flatMap((id) => {
    const slot = obj(p[id]);
    const corrected = (Array.isArray(slot?.items) ? slot!.items as unknown[] : []).map(obj).filter((o): o is Obj => !!o && o.source_type === "USER_CORRECTED" && typeof o.source_turn === "number").map((o) => o.source_turn as number);
    const lastFix = corrected.length ? Math.max(...corrected) : -1;
    return (Array.isArray(slot?.history) ? slot!.history as unknown[] : []).map(obj)
      .filter((o): o is Obj => !!o && typeof o.source_turn === "number" && typeof o.quote === "string" && !!bareQuote(o.quote as string)
        && (o.status === "SUPERSEDED" || (o.status === "RETRACTED" && (o.source_turn as number) < lastFix)))
      .map((o) => ({ turn: o.source_turn as number, quote: bareQuote(o.quote as string) }));
  });
}

/** 틀린 모양의 줄은 버린다(slot 은 객체 · items 는 배열 · 각 항목은 객체). 모양만 거르고 판정은 signals() 가 한다. */
function shapeProfile(profile: unknown): MatchingProfileLike | null {
  const p = obj(profile); if (!p) return null;
  const out: MatchingProfileLike = {};
  for (const id of PURPOSE_IDS) {
    const slot = obj(p[id]); if (!slot) continue;
    const items = (Array.isArray(slot.items) ? slot.items : []).map(obj).filter((o): o is Obj => !!o)
      .map((o) => ({ note: clean(o.note), quote: clean(o.quote), status: String(o.status ?? ""), source_type: String(o.source_type ?? ""), source_turn: typeof o.source_turn === "number" ? o.source_turn : null }));
    out[id] = { status: String(slot.status ?? ""), items };
  }
  return out;
}

/** agent_session 한 줄의 profile 에서 매칭 재료만 뽑는다. 틀린 모양이면 빈 재료(매칭에 쓰지 않음). */
export function sourceFromProfile(profile: unknown, phase: unknown, sessionAt: string | null): AgentMatchSource {
  const shaped = shapeProfile(profile);
  const s = signals(shaped); // CONFIRMED · 추정(INFERRED) 아님 — 기존 계약
  const ok = (note: string) => !!note && !CONTENT_WORDS.test(note); // 사주·타로 0
  const all = [...s.hard.map((i) => ({ purpose: "boundaries" as const, ...i })), ...s.hard_candidates.map((i) => ({ purpose: "boundaries" as const, ...i })), ...s.soft].filter((i) => ok(i.note));
  const lastCorrected = new Map<string, number>(); // ① 칸마다 가장 최근 사용자 정정 턴
  for (const i of all) if (i.source_type === "USER_CORRECTED" && typeof i.source_turn === "number") lastCorrected.set(i.purpose, Math.max(lastCorrected.get(i.purpose) ?? -1, i.source_turn));
  const rejected = retractedNotes(profile); // ②
  const gone = supersededSources(profile); // ③
  const usable = all.filter((i) => {
    if (!MATCH_SOURCE_TYPES.has(i.source_type)) return false;
    if (typeof i.source_turn === "number" && gone.some((g) => g.turn === i.source_turn && g.quote === bareQuote(i.quote ?? ""))) return false;
    const lc = lastCorrected.get(i.purpose);
    if (lc !== undefined && typeof i.source_turn === "number" && i.source_turn < lc) return false;
    if (i.source_type === "AI_EXTRACTED" && rejected.some((r) => sameMeaning(r, i.note))) return false;
    return true;
  });
  const confirmed: string[] = [];
  for (const i of usable) if (confirmed.length < AGENT_CONFIRMED_MAX && !confirmed.includes(i.note)) confirmed.push(i.note);
  const areas = PURPOSE_IDS.filter((id) => shaped?.[id]?.status === "CONFIRMED" && usable.some((i) => i.purpose === id)).length;
  const finished = phase === "done" || phase === "post";
  return { confirmed, confirmedAreas: areas, finished, ready: finished && areas >= AGENT_READY_MIN_CONFIRMED_AREAS, sessionAt };
}

/** 사용자마다 이번 회차(since 이후) 가장 최근 agent_session 하나로 매칭 재료를 만든다. */
export function agentSources(rows: AgentSessionRow[], sinceOf: (userId: string) => string | null): Map<string, AgentMatchSource> {
  const latest = new Map<string, AgentSessionRow>();
  for (const r of rows) {
    const at = r.updated_at ?? r.created_at; const since = sinceOf(r.user_id);
    if (since && at && Date.parse(at) < Date.parse(since)) continue;
    const prev = latest.get(r.user_id);
    if (!prev || Date.parse(at ?? "") > Date.parse(prev.updated_at ?? prev.created_at ?? "")) latest.set(r.user_id, r);
  }
  const out = new Map<string, AgentMatchSource>();
  for (const [uid, r] of latest) out.set(uid, sourceFromProfile(r.profile, r.phase, r.updated_at ?? r.created_at));
  return out;
}
