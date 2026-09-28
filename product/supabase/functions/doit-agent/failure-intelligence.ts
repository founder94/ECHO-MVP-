// ECHO Failure Intelligence runtime contract
// Source: founder/AI failures accumulated over ~9 months.
// Purpose: convert repeated AI/operations failures into server-side invariants.
// IMPORTANT: These are internal quality rules, never user/profile/matching facts.

export const FAILURE_INTELLIGENCE_VERSION = "fi-2026-09-28-v1";

export const FAILURE_RULES = Object.freeze({
  direction_lock: {
    priority: "P0",
    rule: "Keep the active user goal locked until completion or explicit direction change.",
  },
  correction_supersede: {
    priority: "P0",
    rule: "Latest explicit user correction supersedes older conflicting state.",
  },
  information_status: {
    priority: "P0",
    rule: "Do not promote unverified inference to confirmed user or operational fact.",
  },
  rejected_semantic_block: {
    priority: "P0",
    rule: "Rejected AI meanings must not reappear as user facts, profile facts, or matching facts.",
  },
  release_evidence_gate: {
    priority: "P0",
    rule: "Build/test/deploy success is not equivalent to live-device product success.",
  },
  prod_qa_guard: {
    priority: "P0",
    rule: "Production and QA origins/projects must never mix.",
  },
  action_router_one_next: {
    priority: "P1",
    rule: "When execution is requested, perform available work first and reduce user manual actions.",
  },
  failed_solution_block: {
    priority: "P1",
    rule: "Do not repeat an already failed or already completed action under the same conditions.",
  },
  public_boundary: {
    priority: "P1",
    rule: "Internal design/security details require a public-safe boundary before external publication.",
  },
  human_cost_capture: {
    priority: "P1",
    rule: "Severe failures should retain emotional, time, financial, and mental cost when known; never invent amounts.",
  },
} as const;

export type FailureRuleKey = keyof typeof FAILURE_RULES;
