// 2026-10-02 대표 「핵심 구현 전환」 §2 · §10 — 앱 내 대화 → 마지막 영상통화 → 각자 상대 모습 확인 → 각자 만남 의사 → 양쪽 모두 유효할 때만 약속 기능.
// 이 파일은 판정 규칙만 담는다(순수 함수 · DB·미디어 업체·Secret 0). 기록 표와 공급자 콜백은 승인 뒤 연결한다(CORE_STRUCTURE_HANDOFF §2).
// 원칙: 통화 참여 ≠ 모습 확인 ≠ 만날 의사(서로 다른 기록). 화면이 보낸 「참여함·확인함」은 믿지 않고 서버 기록만 본다.
// 영상 확인은 신원·안전 보증이 아니다(배지·「확인된 사람」 문구 0).

export interface VideoParticipation { userId: string; joinedAt: string; leftAt: string | null; cameraOnSeconds: number }
/** 공급자 서버 콜백(서명 검증 통과)으로만 만든 세션 기록. */
export interface VideoSession { id: string; matchId: string; endedAt: string | null; signatureVerified: boolean; participants: VideoParticipation[] }
export interface AppearanceCheck { userId: string; sessionId: string; checkedAt: string }
export type Intent = "yes" | "not_now" | "no";
export interface MeetIntent { userId: string; intent: Intent; at: string; sessionId: string }

export interface GateInput {
  now: string;
  me: string;
  match: { id: string; userA: string; userB: string; status: "approved" | "closed" | "rejected"; createdAt: string };
  blocked: boolean;                 // 둘 중 누구든 상대를 차단했는가(서버가 blocks 에서 계산)
  safetyHold: boolean;              // 신고 검토 등 안전 제한(서버 계산)
  consent: { required: string; a: string | null; b: string | null }; // 공개·영상 동의 판(같아야 유효)
  sessions: VideoSession[];
  checks: AppearanceCheck[];
  intents: MeetIntent[];            // 사람마다 가장 최근 것만 유효
  lastStepOpen: boolean;            // 마지막 확인 구간(단계 규칙은 2·4·6 결정 뒤 서버가 계산 — 지금은 입력으로만 받음)
}

export type Missing =
  | "not_participant" | "connection_closed" | "blocked" | "safety_hold" | "consent_outdated" | "last_step_closed"
  | "no_joint_video" | "my_check" | "partner_check" | "my_intent" | "partner_intent";

/** 이 연결의 서명 검증된 세션 중 두 사람이 모두 카메라를 켜고 참여한 세션(가장 최근). 다른 연결의 세션·카메라 OFF·위조 콜백은 0. */
export function jointSession(input: Pick<GateInput, "match" | "sessions">): VideoSession | null {
  const { match } = input;
  const ok = input.sessions.filter((s) => s.matchId === match.id && s.signatureVerified && s.endedAt !== null
    && [match.userA, match.userB].every((u) => s.participants.some((p) => p.userId === u && p.cameraOnSeconds > 0)));
  return ok.sort((x, y) => (String(y.endedAt) > String(x.endedAt) ? 1 : -1))[0] ?? null;
}

const latest = <T extends { userId: string; at?: string; checkedAt?: string }>(rows: T[], user: string): T | null =>
  rows.filter((r) => r.userId === user).sort((x, y) => (String(y.at ?? y.checkedAt) > String(x.at ?? x.checkedAt) ? 1 : -1))[0] ?? null;

/** 약속 기능 허용 판정. 모두 갖춰야 allowed. 무엇이 비었는지는 본인에게 필요한 만큼만(상대의 「아니요」·「아직」을 드러내지 않음). */
export function meetGate(input: GateInput): { allowed: boolean; missing: Missing[]; sessionId: string | null } {
  const { match, me } = input;
  const missing: Missing[] = [];
  if (me !== match.userA && me !== match.userB) return { allowed: false, missing: ["not_participant"], sessionId: null };
  const partner = me === match.userA ? match.userB : match.userA;
  if (match.status !== "approved") missing.push("connection_closed");
  if (input.blocked) missing.push("blocked");
  if (input.safetyHold) missing.push("safety_hold");
  if (input.consent.a !== input.consent.required || input.consent.b !== input.consent.required) missing.push("consent_outdated");
  if (!input.lastStepOpen) missing.push("last_step_closed");
  const session = jointSession(input);
  if (!session) missing.push("no_joint_video");
  const sid = session?.id ?? null;
  // 모습 확인·만날 의사는 그 공동 세션에 묶인 것만 유효(다른 방 영상으로 우회 0).
  const myCheck = input.checks.some((c) => c.userId === me && c.sessionId === sid);
  const partnerCheck = input.checks.some((c) => c.userId === partner && c.sessionId === sid);
  if (!myCheck) missing.push("my_check");
  if (!partnerCheck) missing.push("partner_check");
  const mine = latest(input.intents.filter((i) => i.sessionId === sid), me);
  const theirs = latest(input.intents.filter((i) => i.sessionId === sid), partner);
  if (mine?.intent !== "yes") missing.push("my_intent");
  if (theirs?.intent !== "yes") missing.push("partner_intent");
  return { allowed: missing.length === 0, missing, sessionId: sid };
}

/** 본인에게 보여 줄 상태 — 상대가 「아니요」·「아직」인지 구분해 알리지 않는다(둘 다 「기다리는 중」). */
export function meetStatusForMe(result: ReturnType<typeof meetGate>): "allowed" | "need_video" | "need_my_check" | "need_my_intent" | "waiting_partner" | "unavailable" {
  if (result.allowed) return "allowed";
  const m = new Set(result.missing);
  if (["not_participant", "connection_closed", "blocked", "safety_hold", "consent_outdated", "last_step_closed"].some((k) => m.has(k as Missing))) return "unavailable";
  if (m.has("no_joint_video")) return "need_video";
  if (m.has("my_check")) return "need_my_check";
  if (m.has("my_intent")) return "need_my_intent";
  return "waiting_partner";
}
