// Codex-owned integration boundary; Claude registers this in the single shared router.
// No new Auth/DB/provider configuration; callbacks must read existing SERVER state.
import { createMeetApi, MeetApiError } from "./meetApi.ts";
export interface CurrentMeetState {
  eligibleA: boolean; eligibleB: boolean;
  safetyHold: boolean; lastStepOpen: boolean; revealValid: boolean;
  // Opaque digest of current consent/public asset/progression versions, not client input.
  stateVersion: string;
}
type User = { id: string; user_metadata?: Record<string, unknown> };
type Auth = { getUser(): Promise<{ data: { user: User | null }; error: unknown }> };
type Admin = { from(table: string): any; auth: { admin: { getUserById(id: string): Promise<{ data: { user: User | null }; error: unknown }> } } };
type Config = {
  enabled?: boolean;
  // Approval-B video consent version. Existing connect-v1 alone is insufficient.
  videoConsentVersion?: string;
  readCurrentState?: (matchId: string, a: string, b: string) => Promise<CurrentMeetState>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createMeetRuntime(admin: Admin, config: Config = {}) {
  const configured = config.enabled === true && !!config.readCurrentState &&
    !!config.videoConsentVersion && config.videoConsentVersion !== "connect-v1";
  const api = createMeetApi(admin, async (matchId, a, b) => {
    if (!configured) throw new MeetApiError("MEET_NOT_CONFIGURED", 503);
    const [ab, ba, au, bu, state] = await Promise.all([
      admin.from("blocks").select("id").eq("blocker_id", a).eq("blocked_user_id", b).limit(1),
      admin.from("blocks").select("id").eq("blocker_id", b).eq("blocked_user_id", a).limit(1),
      admin.auth.admin.getUserById(a), admin.auth.admin.getUserById(b),
      config.readCurrentState!(matchId, a, b),
    ]);
    if (ab.error || ba.error || au.error || bu.error || au.data.user?.id !== a || bu.data.user?.id !== b)
      throw new MeetApiError("MEET_PERMISSION_READ_FAILED", 503);
    if (!state || !/^[a-f0-9]{64}$/.test(state.stateVersion) ||
      [state.eligibleA,state.eligibleB,state.safetyHold,state.lastStepOpen,state.revealValid].some(x=>typeof x!=="boolean"))
      throw new MeetApiError("MEET_POLICY_NOT_CONNECTED", 503);
    const consent = (u: User) => {
      const m = u.user_metadata ?? {};
      return m.doit_connect_consent_version === config.videoConsentVersion &&
        typeof m.doit_connect_consent_at === "string" && Number.isFinite(Date.parse(m.doit_connect_consent_at))
        ? config.videoConsentVersion! : null;
    };
    return {
      blocked: !!ab.data?.length || !!ba.data?.length,
      safetyHold: state.safetyHold,
      lastStepOpen: state.lastStepOpen,
      eligible: state.eligibleA && state.eligibleB,
      revealValid: state.revealValid, stateVersion: state.stateVersion,
      consent: { required: config.videoConsentVersion!, a: consent(au.data.user!), b: consent(bu.data.user!) },
    };
  }, { enabled: configured, requireStateVersion: true });

  // Reusable route dispatch; never reads user_id/role/allowed from request body.
  async function handle(auth: Auth, action: string, body: Record<string, unknown>) {
    try {
      const verified = await auth.getUser();
      const actor = verified.data.user?.id;
      if (verified.error || !actor || !uuid.test(actor)) throw new MeetApiError("UNAUTHORIZED", 401);
      return await api.handle(action, body, actor);
    } catch (error) {
      const e = error instanceof MeetApiError ? error : new MeetApiError("MEET_UNAVAILABLE", 503);
      return { status: e.status, body: { ok: false, code: e.code } };
    }
  }
  async function authorizePlan(auth: Auth, matchId: string, stateVersion: string) {
    const verified = await auth.getUser();
    const actor = verified.data.user?.id;
    if (verified.error || !actor || !uuid.test(actor)) throw new MeetApiError("UNAUTHORIZED", 401);
    // Internal guard only. The actual plan insert must share a DB transaction
    // with current block/state validation and a unique logical plan request.
    return api.requireMeetingAllowed(matchId, actor, stateVersion);
  }
  async function adminSummary(auth: Auth, matchId: string) {
    try {
      const verified = await auth.getUser();
      const actor = verified.data.user?.id;
      if (verified.error || !actor || !uuid.test(actor)) throw new MeetApiError("UNAUTHORIZED", 401);
      const profile = await admin.from("profiles").select("role").eq("id", actor).maybeSingle();
      if (profile.error) throw new MeetApiError("MEET_PERMISSION_READ_FAILED", 503);
      if (profile.data?.role !== "admin") throw new MeetApiError("FORBIDDEN", 403);
      if (!configured) throw new MeetApiError("MEET_NOT_CONFIGURED", 503);
      if (!uuid.test(matchId)) throw new MeetApiError("BAD_REQUEST", 400);
      const match = await admin.from("doit_matches").select("user_a").eq("id", matchId).maybeSingle();
      if (match.error) throw new MeetApiError("MEET_READ_FAILED", 503);
      if (!match.data) throw new MeetApiError("NOT_FOUND", 404);
      return { status: 200, body: await api.summary(matchId, match.data.user_a) };
    } catch (error) {
      const e = error instanceof MeetApiError ? error : new MeetApiError("MEET_UNAVAILABLE", 503);
      return { status: e.status, body: { ok: false, code: e.code } };
    }
  }
  return { handle, authorizePlan, adminSummary };
}
