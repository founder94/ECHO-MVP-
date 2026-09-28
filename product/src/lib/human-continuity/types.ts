// ECHO Human Continuity Engine v0.1 — 공통 타입(2026-09-28 대표 「IMPLEMENTATION ORDER」 §3.1).
// 내부 R&D 층 전용: 화면·운영 DB·매칭 출력에 연결하지 않는다. 모델(OpenAI/Claude/Gemini)은 후보만 내고,
// 최종 상태·정정·거절·확인·매칭 자격은 이 층의 결정 함수(서버 규칙)가 정한다.

/** 정보 상태. 매칭에 쓸 수 있는 것은 사용자가 직접 말했거나 확인·정정한 것뿐(MATCHING_ELIGIBLE). */
export type InformationStatus =
  | 'USER_DIRECT'
  | 'USER_CONFIRMED'
  | 'USER_CORRECTED'
  | 'AI_INFERRED'
  | 'UNCONFIRMED'
  | 'DISPUTED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'RETRACTED';

export const INFORMATION_STATUSES: readonly InformationStatus[] = [
  'USER_DIRECT', 'USER_CONFIRMED', 'USER_CORRECTED', 'AI_INFERRED', 'UNCONFIRMED', 'DISPUTED', 'REJECTED', 'SUPERSEDED', 'RETRACTED',
];

/** 매칭·프로필로 내보낼 수 있는 상태(이 목록 밖은 절대 내보내지 않는다). */
export const MATCHING_ELIGIBLE: readonly InformationStatus[] = ['USER_DIRECT', 'USER_CONFIRMED', 'USER_CORRECTED'];

/** 실패 근거 수준(높은 것 → 낮은 것). 모르면 가장 낮은 HYPOTHESIS 로 둔다(부풀리지 않음). */
export type FailureEvidenceLevel = 'ACTUAL' | 'FOUNDER_STATEMENT' | 'REAL_AI_SCRIPTED' | 'CODE' | 'HYPOTHESIS';

/** 방어책 검증 수준. 한 칸씩만 오른다(CANDIDATE → MOCK_VERIFIED → REAL_AI_VERIFIED → USER_VERIFIED → PRODUCTION_VERIFIED). */
export type DefenseLevel = 'CANDIDATE' | 'MOCK_VERIFIED' | 'REAL_AI_VERIFIED' | 'USER_VERIFIED' | 'PRODUCTION_VERIFIED';
export const DEFENSE_LEVELS: readonly DefenseLevel[] = ['CANDIDATE', 'MOCK_VERIFIED', 'REAL_AI_VERIFIED', 'USER_VERIFIED', 'PRODUCTION_VERIFIED'];

export const UNKNOWN = 'UNKNOWN' as const;
export type Unknown = typeof UNKNOWN;

/** 사람이 치른 비용 한 칸. 숫자로 잰 적이 없으면 quantity 는 UNKNOWN 그대로(추정 금지). */
export interface HumanCostValue {
  /** 기록에 적힌 설명(원문 그대로) · 없으면 UNKNOWN */
  note: string | Unknown;
  /** 잰 값. v0.1 기록에는 잰 값이 없어 모두 UNKNOWN */
  quantity: number | Unknown;
  /** 이 칸의 근거 수준 · 설명이 없으면 UNKNOWN */
  evidence: FailureEvidenceLevel | Unknown;
}

export interface HumanCost {
  emotional: HumanCostValue;
  time: HumanCostValue;
  financial: HumanCostValue;
  mental: HumanCostValue;
}

// ── 사람 상태(Canonical State) ─────────────────────────────────────────────

/** 사용자가 한 말 원문. 어떤 사건에도 지우거나 고치지 않는다. */
export interface RawStatement {
  id: string;
  seq: number;
  event: HumanStateEventType;
  text: string;
  /** 「잘 모르겠어」·「딱히 생각 안 나」 같은 불확실한 답이었는지(사실로 올리지 않는다) */
  uncertain: boolean;
}

export interface HumanStateFact {
  id: string;
  /** 무엇에 대한 말인지(예: contact_style) */
  slot: string;
  /** 사람이 읽는 뜻 */
  meaning: string;
  /** 같은 뜻 비교용 정규화 키 */
  meaningKey: string;
  status: InformationStatus;
  /** 이 사실이 나온 원문 */
  sourceStatementId: string;
  createdSeq: number;
  updatedSeq: number;
  /** 정정으로 밀렸으면 새 사실 id */
  supersededBy?: string;
  /** 정정 계보(옛 사실 id 들 · 오래된 순) */
  lineage: string[];
}

export interface CorrectionEdge {
  from: string;
  to: string;
  statementId: string;
  seq: number;
}

export interface RejectionEdge {
  factId: string | null;
  meaningKey: string;
  statementId: string;
  seq: number;
  /** 거절이 모호해 여러 해석을 확인 중으로 돌렸으면 true */
  ambiguous: boolean;
}

export interface CanonicalState {
  version: 1;
  seq: number;
  statements: RawStatement[];
  facts: HumanStateFact[];
  corrections: CorrectionEdge[];
  rejections: RejectionEdge[];
  /** 거절된 뜻 키(Rejection Firewall) — AI 가 다시 사실로 올리지 못한다 */
  rejectedMeanings: string[];
}

export type HumanStateEventType = 'USER_MESSAGE' | 'CONFIRM' | 'CORRECT' | 'REJECT' | 'RETRACT';

/** 사용자 한 번의 행동(또는 모델이 낸 해석 후보를 싣고 온 사용자 말). */
export interface HumanStateEvent {
  type: HumanStateEventType;
  /** 사용자 원문(항상 보존) */
  text: string;
  /** 대상 사실 id(CONFIRM·CORRECT·REJECT·RETRACT) */
  targetId?: string;
  /** 대상 뜻(거절할 뜻을 id 대신 글로 줄 때) */
  targetMeaning?: string;
  /** 새 사실 칸·뜻(USER_MESSAGE·CORRECT) */
  slot?: string;
  meaning?: string;
  /** 뜻을 누가 냈나: USER = 사용자가 직접 말함 · MODEL = 모델 해석 후보(AI_INFERRED) */
  proposedBy?: 'USER' | 'MODEL';
}

export type TransitionKind =
  | 'RAW_KEPT'
  | 'FACT_ADDED'
  | 'UNCERTAIN_NOT_PROMOTED'
  | 'CONFIRMED'
  | 'SUPERSEDED'
  | 'CORRECTED'
  | 'REJECTED'
  | 'DISPUTED'
  | 'RETRACTED'
  | 'BLOCKED_REJECTED_MEANING'
  | 'IGNORED_INVALID_TARGET';

export interface StateTransition {
  kind: TransitionKind;
  factId: string | null;
  from: InformationStatus | null;
  to: InformationStatus | null;
  statementId: string;
  reason: string;
}

export interface MatchingSafeFact {
  factId: string;
  slot: string;
  meaning: string;
  status: InformationStatus;
}

export interface CompileResult {
  state: CanonicalState;
  transitions: StateTransition[];
  corrections: CorrectionEdge[];
  rejections: RejectionEdge[];
  matchingSafe: MatchingSafeFact[];
}

// ── 실패 · 방어 ────────────────────────────────────────────────────────────

export type ProprietaryEngine =
  | 'Context Memory'
  | 'Correction Engine'
  | 'Rejection Firewall'
  | 'Information Status'
  | 'Direction Lock'
  | 'Action Router / Action Ledger'
  | 'Release Gate'
  | 'Verification Gate'
  | 'Agent Orchestration'
  | 'Cost Visibility Gate'
  | 'UNMAPPED';

export type RootCauseLayer = 'Orchestration' | 'Product Contract' | 'Model' | 'Evaluation' | 'Context' | 'Infrastructure' | 'UNKNOWN';

export interface FailureRecordNormalized {
  id: string;
  corpus: 'failures' | 'echo-failure-dataset';
  title: string;
  /** 회사 실패 가족(F-REPEAT 등) · 없으면 UNKNOWN */
  family: string;
  types: string[];
  layers: RootCauseLayer[];
  primaryLayer: RootCauseLayer;
  evidenceLevel: FailureEvidenceLevel;
  /** 원본 기록의 출처 표기(바꾸지 않고 보관) */
  originRaw: string;
  humanCost: HumanCost;
  /** 원본 기록이 주장하는 방어 수준(참고용 — 승격 근거로 자동 사용하지 않음) */
  claimedDefenseLevel: string | Unknown;
  mockResult: 'PASS' | 'FAIL' | Unknown;
  realAiResult: 'PASS' | 'FAIL' | Unknown;
  userResult: 'PASS' | 'FAIL' | Unknown;
  counterTestNote: string | Unknown;
  reproductionNote: string | Unknown;
  expected: string | Unknown;
}

export type ResultValue = 'PASS' | 'FAIL' | Unknown;

export interface DefenseCandidate {
  id: string;
  failure_ids: string[];
  family: ProprietaryEngine;
  proposed_guard: string;
  counter_test: string;
  qa_test: string;
  mock_result: ResultValue;
  real_ai_result: ResultValue;
  user_result: ResultValue;
  production_result: ResultValue;
  defense_level: DefenseLevel;
}

export interface CompiledFailure {
  failure: FailureRecordNormalized;
  family: string;
  rootCauseLayer: RootCauseLayer;
  humanCostSummary: string;
  linkedEngine: ProprietaryEngine;
  defenseCandidate: DefenseCandidate;
  counterTestCandidate: string;
  qaTestCandidate: string;
  evidenceLevel: FailureEvidenceLevel;
}

// ── 사람 수고 비용(AI·시스템이 사람에게 지운 부담 — 사람 평가 아님) ─────────────

export type HumanEffortEventType =
  | 'repeated_explanation'
  | 'correction_required'
  | 'rejected_meaning_reappeared'
  | 'completed_action_re_requested'
  | 'blocked_path_repeated'
  | 'unnecessary_manual_step'
  | 'unnecessary_long_explanation'
  | 'wrong_navigation'
  | 'false_completion_report'
  | 'qa_prod_mix'
  | 'cost_not_disclosed';

export const HUMAN_EFFORT_EVENT_TYPES: readonly HumanEffortEventType[] = [
  'repeated_explanation', 'correction_required', 'rejected_meaning_reappeared', 'completed_action_re_requested', 'blocked_path_repeated',
  'unnecessary_manual_step', 'unnecessary_long_explanation', 'wrong_navigation', 'false_completion_report', 'qa_prod_mix', 'cost_not_disclosed',
];

export interface HumanEffortEvent {
  type: HumanEffortEventType;
  /** 누가 부담을 만들었나 — 항상 시스템 쪽(AI·앱·개발 AI·배포) */
  causedBy: 'AI' | 'APP' | 'DEV_AI' | 'RELEASE';
  /** 근거(실패 id·원문 위치 등) */
  evidence: string;
  count?: number;
}

export type EffortBand = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HumanEffortResult {
  /** 평가 대상은 항상 시스템(사람의 성격·능력 평가 아님) */
  subject: 'SYSTEM';
  /** 내부 R&D 전용 — 화면·매칭·사용자 프로필에 쓰지 않는다 */
  scope: 'INTERNAL_RD_ONLY';
  events: HumanEffortEvent[];
  rawScore: number;
  band: EffortBand;
  evidence: string[];
  reason: string;
  /** 무시된 입력(허용 목록 밖 사건 등)과 이유 */
  rejectedInputs: { input: string; reason: string }[];
  weightsNote: string;
}
