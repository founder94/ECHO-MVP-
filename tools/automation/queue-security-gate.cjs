// Pure pre-experiment security gate (no I/O, no network, not wired into any workflow).
// Not a replacement for approval / budget / trusted Codex verdicts: passing only means "this task may enter the existing START path".
// Classification and evidence live on the task, written only by the owner-approved registration path (initQueue, verified sender).
// Never taken from comment text, event sender fields, or model sentences. Compat design:
//  - gate OFF (config.securityGate unset): old behaviour, old tasks without scope are untouched.
//  - gate ON: scope must be exactly 'development' or 'experiment'. A missing/unknown scope is DENIED (never guessed as development),
//    so a new experiment cannot be downgraded to development by omitting the field.
//  - 'development' (explicit, owner registered) skips only the experiment evidence; approval/budget/actor checks stay in place.
//  - 'experiment' needs every REQUIRED item: status exactly 'PASS', sha === task.experimentSha (the exact reviewed SHA), trusted evidence id.
//    Missing / FAIL / not run / string 'true' / "no findings" / thumbs / old SHA are all denied.
// Operational security settings are NOT inferable from code: an item with no recorded evidence is BLOCKED, never assumed.
const SHA = /^[a-f0-9]{40}$/;
const EVIDENCE_ID = /^[A-Za-z0-9._-]{1,64}$/;
const SCOPES = ['development', 'experiment'];
const REQUIRED = Object.freeze([
  'responsible_backup', // responsible owner + backup owner + notification/report decision path
  'privacy_notice_match', // privacy notice vs actual processing reconciled
  'blocked_user_exclusion', // blocked counterpart excluded
  'latest_correction_refusal', // newest correction/refusal reflected
  'both_sides_choice', // both-side choice confirmed
  'public_preconditions', // public-release preconditions met
]);

// -> {ok:true} | {ok:false, reason:'scope_missing'|'scope_unknown'|'experiment_sha_invalid'|'evidence_missing:<item>'|'evidence_not_pass:<item>'|'evidence_stale:<item>'|'evidence_id_invalid:<item>'}
// resolveEvidence(id, {criterion, taskId, ref, sha}) is a RUNTIME-ONLY injected verifier (never read from task/event/comment/env).
// It must return a typed attestation {id, criterion, taskId, ref, sha, status:'PASS', completed:true, trusted:true} produced by a separate
// verifier that checked the real author/permission/completed result. No resolver (or lookup failure/null/mismatch) => BLOCKED.
// The owner-registered descriptor alone is NOT proof of a completed check. No real resolver exists yet: live experiments stay BLOCKED.
function attested(a, e, k, task) {
  return !!a && typeof a === 'object' && a.id === e.id && a.criterion === k && a.taskId === task.id && a.ref === task.ref && a.sha === task.experimentSha
    && a.status === 'PASS' && a.completed === true && a.trusted === true;
}
function gateDecision(task, { resolveEvidence } = {}) {
  if (!task || typeof task !== 'object') return { ok: false, reason: 'scope_missing' };
  if (task.scope === undefined || task.scope === null) return { ok: false, reason: 'scope_missing' };
  if (!SCOPES.includes(task.scope)) return { ok: false, reason: 'scope_unknown' };
  if (task.scope === 'development') return { ok: true };
  if (!SHA.test(task.experimentSha || '')) return { ok: false, reason: 'experiment_sha_invalid' };
  const ev = task.evidence && typeof task.evidence === 'object' ? task.evidence : {};
  for (const k of REQUIRED) {
    const e = Object.prototype.hasOwnProperty.call(ev, k) ? ev[k] : undefined;
    if (!e || typeof e !== 'object') return { ok: false, reason: `evidence_missing:${k}` };
    if (e.status !== 'PASS') return { ok: false, reason: `evidence_not_pass:${k}` };
    if (e.sha !== task.experimentSha) return { ok: false, reason: `evidence_stale:${k}` };
    if (typeof e.id !== 'string' || !EVIDENCE_ID.test(e.id)) return { ok: false, reason: `evidence_id_invalid:${k}` };
  }
  if (typeof resolveEvidence !== 'function') return { ok: false, reason: 'resolver_missing' };
  for (const k of REQUIRED) {
    const e = ev[k]; let a;
    try { a = resolveEvidence(e.id, { criterion: k, taskId: task.id, ref: task.ref, sha: task.experimentSha }); } catch { return { ok: false, reason: `evidence_lookup_failed:${k}` }; }
    if (!attested(a, e, k, task)) return { ok: false, reason: `evidence_unverified:${k}` };
  }
  return { ok: true };
}

// Shape-only copy for the registration path (the gate itself decides on the stored value). Returns {} fields only when present.
function pickGateFields(t) {
  const o = {};
  if (t.scope !== undefined) o.scope = t.scope;
  if (t.experimentSha !== undefined) o.experimentSha = t.experimentSha;
  if (t.evidence !== undefined) o.evidence = JSON.parse(JSON.stringify(t.evidence));
  return o;
}

module.exports = { gateDecision, pickGateFields, REQUIRED, SCOPES };
