// ECHO 매칭 결정 계약(2026-09-26 대표 FINAL MISSING CONTRACTS · 1~3). 순수 함수 — DB·AI 호출 0.
// 흐름: 대화 상태 → 매칭 프로필(agent.ts matchingProfile) → [여기] 서버 자격 확인 → 서버 후보 집합 → (매칭 에이전트 = LLM 이 이유 후보만) → [여기] 이유 검증 → 추천.
// LLM 은 후보를 넣거나 빼지 못한다. 서버가 먼저 거르고, LLM 이 쓴 「연결한 이유」는 양쪽 사용자의 지금 값(CONFIRMED)에서 근거를 찾을 때만 보인다.
// 지금 상태: 연결 서버(doit-connect)가 아직 이 계약을 부르지 않는다(운영 연결 = 전화 인증·대표 승인 뒤). 가짜 후보·가짜 이유 0.

export const PURPOSE_IDS = ["relationship_intent", "attraction_comfort", "values_character", "relationship_style", "boundaries"] as const;
export type Pid = (typeof PURPOSE_IDS)[number];

export interface LineageItem { note: string; quote: string; status: string; source_type: string; source_turn: number | null }
export interface ProfileSlot { status: string; items: LineageItem[]; history?: LineageItem[] }
export type MatchingProfileLike = Partial<Record<Pid, ProfileSlot>> & { inferred_candidates?: { trait: string }[] };

export interface Person {
  user_id: string;
  real_user: boolean;             // 실제 가입자(시험·가짜 계정 아님) — 서버가 계정에서 확인
  conversation_done: boolean;     // 다섯 가지 대화 끝
  intro_confirmed: boolean;       // AI 소개를 사용자가 고르거나 직접 써서 저장
  photo_primary: boolean;         // 대표 사진 있음
  phone_verified: boolean;        // 실제 문자 인증 완료(화면만 있음 = false)
  purpose_id: string | null;      // 사용자가 고른 만남 목적(목적 타일 · PROFILE_DIRECT)
  profile: MatchingProfileLike | null;
}

// ── 1) 서버 자격 확인(Matching Ready). 빠진 것을 이름으로 돌려준다.
export function eligibility(p: Person): { eligible: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!p.real_user) missing.push("real_user");
  if (!p.conversation_done) missing.push("conversation");
  if (!p.intro_confirmed) missing.push("intro_confirmed");
  if (!p.photo_primary) missing.push("photo");
  if (!p.phone_verified) missing.push("phone_verified");
  if (!p.purpose_id) missing.push("relationship_intent");
  if (!p.profile || !PURPOSE_IDS.some((id) => (p.profile?.[id]?.items ?? []).some((i) => i.status === "CONFIRMED"))) missing.push("confirmed_info");
  return { eligible: missing.length === 0, missing };
}

// ── 2) HARD FILTER / SOFT SIGNAL. HARD = 사용자가 「반드시·절대」라고 직접 확인한 조건만(USER_CONFIRMED · PROFILE_DIRECT).
// AI 가 정리한 말(AI_EXTRACTED)·추측(AI_INFERRED·PHOTO_INFERRED)으로는 HARD 를 만들지 않는다 — 확인 전 「꼭 있었으면/피하고 싶은 것」은 hard_candidates(사용자 확인 필요).
const HARD_SOURCES = new Set(["USER_CONFIRMED", "PROFILE_DIRECT"]);
export function signals(profile: MatchingProfileLike | null) {
  const active = (id: Pid) => (profile?.[id]?.items ?? []).filter((i) => i.status === "CONFIRMED");
  const hard = active("boundaries").filter((i) => HARD_SOURCES.has(i.source_type));
  const hard_candidates = active("boundaries").filter((i) => !HARD_SOURCES.has(i.source_type) && !/INFERRED/.test(i.source_type));
  const soft = PURPOSE_IDS.filter((id) => id !== "boundaries").flatMap((id) => active(id).filter((i) => !/INFERRED/.test(i.source_type)).map((i) => ({ purpose: id, ...i })));
  return { hard, hard_candidates, soft, inferred_ignored: (profile?.inferred_candidates ?? []).length };
}

// ── 3) 서버 후보 집합. 제외 이유는 서버 규칙으로만: 나 자신 · 자격 미달 · 차단 관계 · 만남 목적 다름(사용자가 직접 고른 값).
// 자유 글 HARD 조건은 서버가 글자로 판정할 수 없으므로 자동 제외하지 않고 review 로 남긴다(추측으로 사람을 빼지 않는다).
export function candidateSet(me: Person, others: Person[], blocked: Set<string>) {
  const out: { user_id: string }[] = []; const excluded: { user_id: string; reason: string }[] = []; const review: { user_id: string; reason: string }[] = [];
  const pair = (a: string, b: string) => [a, b].sort().join(":");
  if (!eligibility(me).eligible) return { candidates: out, excluded: others.map((o) => ({ user_id: o.user_id, reason: "me_not_eligible" })), review };
  for (const o of others) {
    if (o.user_id === me.user_id) continue;
    const e = eligibility(o);
    if (!e.eligible) { excluded.push({ user_id: o.user_id, reason: `not_eligible:${e.missing.join(",")}` }); continue; }
    if (blocked.has(pair(me.user_id, o.user_id))) { excluded.push({ user_id: o.user_id, reason: "blocked" }); continue; }
    if (me.purpose_id !== o.purpose_id) { excluded.push({ user_id: o.user_id, reason: "relationship_intent_differs" }); continue; }
    if (signals(me.profile).hard.length || signals(o.profile).hard.length) review.push({ user_id: o.user_id, reason: "hard_filter_text_needs_review" });
    out.push({ user_id: o.user_id });
  }
  return { candidates: out, excluded, review };
}

// ── 4) 「ECHO 가 연결한 이유」 검증. LLM 이유 후보는 양쪽 근거(quote)가 각 사용자의 지금 값(CONFIRMED)에 있어야 보인다.
// 교체·거절된 값(SUPERSEDED·RETRACTED)·추측(INFERRED)은 근거가 될 수 없다. 심리 진단·성격 단정 낱말은 막는다.
export interface ReasonCandidate { text: string; evidence: { side: "a" | "b"; purpose: string; quote: string }[] }
const PSYCH = /성격(이|은)?\s*(맞|잘\s*맞)|궁합|운명|MBTI|애착\s*유형|트라우마|심리|진단|데이팅|소개팅|점술/i;
const squash = (t: unknown) => String(t ?? "").normalize("NFKC").replace(/\s+/g, "");
export function validateReason(r: ReasonCandidate, a: MatchingProfileLike | null, b: MatchingProfileLike | null): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!r.text?.trim()) errors.push("empty");
  if (PSYCH.test(r.text ?? "")) errors.push("psych_or_banned");
  const activeQuotes = (p: MatchingProfileLike | null, purpose: string) => ((p?.[purpose as Pid]?.items) ?? []).filter((i) => i.status === "CONFIRMED" && !/INFERRED/.test(i.source_type)).map((i) => squash(i.quote));
  const sides = new Set<string>();
  for (const e of r.evidence ?? []) {
    const q = squash(e.quote);
    const pool = activeQuotes(e.side === "a" ? a : b, e.purpose);
    if (q.length < 2 || !pool.some((x) => x.includes(q) || q.includes(x))) { errors.push(`no_basis:${e.side}:${e.purpose}`); continue; }
    sides.add(e.side);
  }
  if (!sides.has("a") || !sides.has("b")) errors.push("needs_both_sides");
  return { ok: errors.length === 0, errors };
}
