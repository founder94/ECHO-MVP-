// Provider callback boundary. Not a user action. No provider chosen/configured here.
// Verifier must validate provider signature/replay window and FETCH its canonical
// terminal session. Client telemetry / caller "verified:true" is never sufficient.
export interface FinalVideoEvidence {
  provider: string; providerSessionRef: string; contextVersion: string;
  endedAt: string;
  participants: { userId: string; joinedAt: string; leftAt: string; cameraOnSeconds: number }[];
}
type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
type Config = {
  enabled?: boolean;
  verifyAndFetchFinalSession?: (request: Request) => Promise<FinalVideoEvidence | { pending: true } | null>;
};
export function createVideoEvidenceHandler(db: Rpc, config: Config = {}) {
  return async (request: Request) => {
    const fail = (code: string, status: number) => ({ status, body: { ok: false, code } });
    if (config.enabled !== true || !config.verifyAndFetchFinalSession) return fail("VIDEO_NOT_CONFIGURED", 503);
    try {
      const evidence = await config.verifyAndFetchFinalSession(request);
      if (!evidence) return fail("VIDEO_SIGNATURE_INVALID", 401);
      // Signed out-of-order/nonterminal notification: no stored final proof.
      if ("pending" in evidence) return { status: 202, body: { ok: true, pending: true, saved: false } };
      if (!evidence.provider || evidence.provider.length > 40 || !evidence.providerSessionRef ||
        evidence.providerSessionRef.length > 200 || !/^[a-f0-9]{64}$/.test(evidence.contextVersion) ||
        !Number.isFinite(Date.parse(evidence.endedAt)) || evidence.participants.length > 2 ||
        new Set(evidence.participants.map(p => p.userId)).size !== evidence.participants.length ||
        evidence.participants.some(p => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.userId) ||
          !Number.isFinite(Date.parse(p.joinedAt)) || !Number.isFinite(Date.parse(p.leftAt)) ||
          Date.parse(p.leftAt) < Date.parse(p.joinedAt) || Date.parse(p.leftAt) > Date.parse(evidence.endedAt) ||
          !Number.isInteger(p.cameraOnSeconds) || p.cameraOnSeconds < 0 ||
          p.cameraOnSeconds * 1000 > Date.parse(p.leftAt) - Date.parse(p.joinedAt)))
        return fail("VIDEO_EVIDENCE_INVALID", 400);
      // NEW approval-B RPC, not present in current QA. It must bind provider/ref
      // to an already server-created session and atomically persist final proof.
      // No match/user id from request body. No fallback multi-request writes.
      const result = await db.rpc("doit_finalize_video_evidence", { evidence: {
        provider: evidence.provider, provider_session_ref: evidence.providerSessionRef,
        context_version: evidence.contextVersion, ended_at: evidence.endedAt,
        participants: evidence.participants.map(p => ({
          user_id: p.userId, joined_at: p.joinedAt, left_at: p.leftAt, camera_on_seconds: p.cameraOnSeconds,
        })),
      } });
      if (result.error) return fail("VIDEO_EVIDENCE_WRITE_FAILED", 503);
      const receipt = result.data as { saved?: boolean; replayed?: boolean } | null;
      if (receipt?.saved !== true || typeof receipt.replayed !== "boolean") return fail("VIDEO_EVIDENCE_WRITE_FAILED", 503);
      return { status: 200, body: { ok: true, saved: true, replayed: receipt.replayed } };
    } catch {
      return fail("VIDEO_EVIDENCE_UNAVAILABLE", 503);
    }
  };
}
