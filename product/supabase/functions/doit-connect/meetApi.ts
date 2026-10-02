// Approval B staging module. No route registration, provider, secrets or schema changes.
// actor must come from verified Auth, policy from current SERVER progression/consent.
import { jointSession, meetGate, meetStatusForMe, type GateInput, type Intent } from "./meetGate.ts";

type Db = { from(table: string): any };
type Policy = Pick<GateInput, "blocked" | "safetyHold" | "consent" | "lastStepOpen"> & { stateVersion?: string; eligible?: boolean; revealValid?: boolean };
export type MeetPolicyReader = (matchId: string, a: string, b: string) => Promise<Policy>;
export class MeetApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const checked = async (query: any) => {
  const r = await query;
  if (r.error) throw new MeetApiError("MEET_READ_FAILED", 503);
  return r.data;
};
const all = async (query: any): Promise<any[]> => {
  const rows = (await checked(query.limit(501))) ?? [];
  // Partial reads must not become a complete permission decision.
  if (rows.length > 500) throw new MeetApiError("MEET_READ_INCOMPLETE", 503);
  return rows;
};

/** Uses the EXISTING approval-B draft column names. Disabled until approved activation. */
export function createMeetApi(db: Db, readPolicy: MeetPolicyReader, options: { enabled?: boolean; now?: () => string; requireStateVersion?: boolean } = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const enabled = () => {
    if (options.enabled !== true) throw new MeetApiError("MEET_NOT_CONFIGURED", 503);
  };
  async function read(matchId: string, actor: string): Promise<GateInput & { stateVersion?: string }> {
    enabled();
    if (!validId(matchId) || !validId(actor)) throw new MeetApiError("BAD_REQUEST", 400);
    const m = await checked(db.from("doit_matches").select("id,user_a,user_b,status,created_at").eq("id", matchId).maybeSingle());
    if (!m || (m.user_a !== actor && m.user_b !== actor)) throw new MeetApiError("NOT_FOUND", 404);
    const sessionColumns = options.requireStateVersion ? "id,match_id,ended_at,signature_verified,context_version" : "id,match_id,ended_at,signature_verified";
    const sessions = await all(db.from("doit_video_sessions").select(sessionColumns).eq("match_id", matchId));
    const ids = sessions.map(s => s.id);
    const [participation, checks, intents] = ids.length ? await Promise.all([
      all(db.from("doit_video_participation").select("session_id,user_id,joined_at,left_at,camera_on_seconds").in("session_id", ids)),
      all(db.from("doit_meet_checks").select("session_id,user_id,checked_at").in("session_id", ids)),
      all(db.from("doit_meet_intents").select("session_id,user_id,intent,created_at").in("session_id", ids)),
    ]) : [[], [], []];
    // Policy is re-read AFTER evidence queries; failure never grants permission.
    const current = await checked(db.from("doit_matches").select("id,user_a,user_b,status,created_at").eq("id", matchId).maybeSingle());
    if (!current || current.user_a !== m.user_a || current.user_b !== m.user_b) throw new MeetApiError("NOT_FOUND", 404);
    const policy = await readPolicy(matchId, m.user_a, m.user_b);
    // Existing gate orders by timestamp. Conflicting equally-new intents have
    // no authoritative order in the current draft: never choose an arbitrary yes.
    for (const sessionId of ids) for (const userId of [m.user_a, m.user_b]) {
      const mine = intents.filter(i => i.session_id === sessionId && i.user_id === userId);
      const newest = mine.map(i => i.created_at).sort().at(-1);
      if (new Set(mine.filter(i => i.created_at === newest).map(i => i.intent)).size > 1)
        throw new MeetApiError("MEET_INTENT_ORDER_UNRESOLVED", 503);
    }
    return {
      now: now(), me: actor, match: { id: current.id, userA: current.user_a, userB: current.user_b, status: current.status, createdAt: current.created_at },
      ...policy,
      safetyHold: policy.safetyHold || policy.eligible === false || policy.revealValid === false,
      sessions: sessions.map(s => ({
        id: s.id, matchId: s.match_id, endedAt: s.ended_at, signatureVerified: s.signature_verified === true && (!options.requireStateVersion || (!!policy.stateVersion && s.context_version === policy.stateVersion)),
        participants: participation.filter(p => p.session_id === s.id).map(p => ({
          userId: p.user_id, joinedAt: p.joined_at, leftAt: p.left_at, cameraOnSeconds: p.camera_on_seconds,
        })),
      })),
      checks: checks.map(c => ({ userId: c.user_id, sessionId: c.session_id, checkedAt: c.checked_at })),
      intents: intents.map(i => ({ userId: i.user_id, sessionId: i.session_id, intent: i.intent, at: i.created_at })),
    };
  }
  async function status(matchId: string, actor: string) {
    const input = await read(matchId, actor);
    const gate = meetGate(input);
    const usableSession = gate.sessionId && !gate.missing.some(m =>
      ["not_participant", "connection_closed", "blocked", "safety_hold", "consent_outdated", "last_step_closed", "no_joint_video"].includes(m));
    // Do not expose partner intent, participation duration, or provider room ref.
    return { ok: true, state: meetStatusForMe(gate), allowed: gate.allowed,
      ...(usableSession ? { sessionId: gate.sessionId } : {}),
      ...(options.requireStateVersion ? { stateVersion: input.stateVersion ?? null } : {}) };
  }
  async function authorizeEvidence(matchId: string, actor: string, sessionId: string, stateVersion?: string) {
    if (!validId(sessionId)) throw new MeetApiError("BAD_REQUEST", 400);
    const input = await read(matchId, actor);
    if (options.requireStateVersion && (!stateVersion || stateVersion !== input.stateVersion)) throw new MeetApiError("STATE_CHANGED", 409);
    const gate = meetGate(input);
    const disallowed = ["not_participant", "connection_closed", "blocked", "safety_hold", "consent_outdated", "last_step_closed", "no_joint_video"];
    if (gate.sessionId !== sessionId || gate.missing.some(m => disallowed.includes(m))) throw new MeetApiError("MEET_UNAVAILABLE", 409);
    return input;
  }
  async function check(matchId: string, actor: string, sessionId: string, stateVersion?: string) {
    const input = await authorizeEvidence(matchId, actor, sessionId, stateVersion);
    const prior = input.checks.some(c => c.userId === actor && c.sessionId === sessionId);
    if (!prior) {
      const r = await db.from("doit_meet_checks").insert({ session_id: sessionId, user_id: actor, checked_at: now() });
      if (r.error && r.error.code !== "23505") throw new MeetApiError("MEET_WRITE_FAILED", 503);
    }
    // A write success is not an atomic permission grant; recompute current state.
    return { ...await status(matchId, actor), replayed: prior };
  }
  async function intent(matchId: string, actor: string, sessionId: string, value: Intent, requestId: string, stateVersion?: string) {
    if (!validId(requestId) || !["yes", "not_now", "no"].includes(value)) throw new MeetApiError("BAD_REQUEST", 400);
    await authorizeEvidence(matchId, actor, sessionId, stateVersion);
    const prior = await checked(db.from("doit_meet_intents").select("session_id,user_id,intent").eq("user_id", actor).eq("request_id", requestId).maybeSingle());
    const same = (row: any) => row?.session_id === sessionId && row?.user_id === actor && row?.intent === value;
    if (prior && !same(prior)) throw new MeetApiError("REQUEST_CONFLICT", 409);
    if (!prior) {
      const r = await db.from("doit_meet_intents").insert({ session_id: sessionId, user_id: actor, intent: value, request_id: requestId, created_at: now() });
      if (r.error?.code === "23505") {
        const raced = await checked(db.from("doit_meet_intents").select("session_id,user_id,intent").eq("user_id", actor).eq("request_id", requestId).maybeSingle());
        if (!same(raced)) throw new MeetApiError("REQUEST_CONFLICT", 409);
      } else if (r.error) throw new MeetApiError("MEET_WRITE_FAILED", 503);
    }
    return { ...await status(matchId, actor), replayed: !!prior };
  }
  async function requireMeetingAllowed(matchId: string, actor: string, stateVersion?: string) {
    const input = await read(matchId, actor);
    if (options.requireStateVersion && (!stateVersion || stateVersion !== input.stateVersion)) throw new MeetApiError("STATE_CHANGED", 409);
    const gate = meetGate(input);
    if (!gate.allowed) throw new MeetApiError("MEET_UNAVAILABLE", 409);
    return { matchId, sessionId: gate.sessionId! };
  }
  // Internal aggregate only; runtime checks current admin role before calling.
  async function summary(matchId: string, participant: string) {
    const input = await read(matchId, participant);
    const gate = meetGate(input);
    return {
      ok: true, observedAt: input.now, definitionVersion: "meet-summary-v1",
      scope: "current_connection", units: { video: "sessions", completion: "connection_pairs" },
      video: { state: "connected", sessions: input.sessions.length,
        jointSessions: input.sessions.filter(s => jointSession({ match: input.match, sessions: [s] })).length },
      appearance: { state: "connected", bothConfirmed: !!gate.sessionId && !gate.missing.includes("my_check") && !gate.missing.includes("partner_check") },
      meetingIntent: { state: "connected", bothYes: !!gate.sessionId && !gate.missing.includes("my_intent") && !gate.missing.includes("partner_intent") },
      permission: { allowed: gate.allowed },
      planAgreement: { state: "not_connected", value: null },
    };
  }
  // HTTP adapter: verifiedActor is supplied by getUser(), never body.user_id.
  async function handle(action: string, body: Record<string, unknown>, verifiedActor: string) {
    try {
      if (!validId(verifiedActor)) throw new MeetApiError("UNAUTHORIZED", 401);
      if (!validId(body.matchId)) throw new MeetApiError("BAD_REQUEST", 400);
      let result;
      if (action === "meet_status") result = await status(body.matchId, verifiedActor);
      else if (action === "meet_check" && validId(body.sessionId)) result = await check(body.matchId, verifiedActor, body.sessionId, typeof body.stateVersion === "string" ? body.stateVersion : undefined);
      else if (action === "meet_intent" && validId(body.sessionId) && validId(body.requestId))
        result = await intent(body.matchId, verifiedActor, body.sessionId, body.intent as Intent, body.requestId, typeof body.stateVersion === "string" ? body.stateVersion : undefined);
      else throw new MeetApiError("BAD_REQUEST", 400);
      return { status: 200, body: result };
    } catch (error) {
      // No SQL message, provider detail, identities or secret in response.
      const failure = error instanceof MeetApiError ? error : new MeetApiError("MEET_UNAVAILABLE", 503);
      return { status: failure.status, body: { ok: false, code: failure.code } };
    }
  }
  return { status, check, intent, requireMeetingAllowed, summary, handle };
}
