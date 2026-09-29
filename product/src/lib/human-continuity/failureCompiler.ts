// Failure Compiler v0.1(대표 「IMPLEMENTATION ORDER」 §3.3) — 회사 실제 실패 기록 → 정규화 · 원인 층 · 사람 비용 요약 ·
// 연결 엔진 · 방어 후보 · 반대 검사 후보 · QA 검사 후보 · 근거 수준. 순수 함수: 코드를 쓰거나 실행 중 동작을 바꾸지 않는다(제안만).
// 근거가 없으면 부풀리지 않는다: 모르는 비용은 UNKNOWN, 모르는 근거 수준은 HYPOTHESIS, 매핑 못 하면 UNMAPPED.
import {
  UNKNOWN,
  type CompiledFailure,
  type DefenseCandidate,
  type FailureEvidenceLevel,
  type FailureRecordNormalized,
  type HumanCost,
  type HumanCostValue,
  type ProprietaryEngine,
  type ResultValue,
  type RootCauseLayer,
  type Unknown,
} from './types.ts';

/** failures.json 한 줄(필요한 칸만 · 원본 형태 그대로 받는다). */
export interface RawFailureRecord {
  id: string;
  title?: string;
  family?: string;
  origin?: string;
  types?: string[];
  layers?: string[];
  user_harm?: Record<string, unknown>;
  defense_level?: string;
  mock_result?: string;
  real_ai?: string;
  user_result?: string;
  counter_test?: string;
  reproduction?: string;
  expected?: string;
  situation?: string;
  ai_behavior?: string;
}

/** echo-failure-dataset.json 한 줄. */
export interface RawDatasetRecord {
  id: string;
  source_type?: string;
  failure_type?: string;
  raw_context?: string;
  root_cause?: string;
  expected_behavior?: string;
  linked_engine?: string;
  reproduction_test?: string;
  retest_result?: string;
  status?: string;
}

const LAYERS: readonly RootCauseLayer[] = ['Orchestration', 'Product Contract', 'Model', 'Evaluation', 'Context', 'Infrastructure'];

/** 원본 출처 표기 → 근거 수준. 표기에 없는 것·섞인 것은 낮은 쪽으로(부풀리지 않음). */
export function evidenceLevelOf(originRaw: string | undefined): FailureEvidenceLevel {
  const o = (originRaw ?? '').trim().toUpperCase();
  if (o === 'ACTUAL') return 'ACTUAL';
  if (o === 'FOUNDER_STATEMENT') return 'FOUNDER_STATEMENT';
  if (o === 'REAL_AI_SCRIPTED') return 'REAL_AI_SCRIPTED';
  if (o === 'ACTUAL_RECONSTRUCTED') return 'FOUNDER_STATEMENT'; // 사후 재구성 — 원 기록이 아니므로 한 단계 낮춤
  if (o === 'CODE' || o === 'CODE+SYNTHETIC') return 'CODE';
  return 'HYPOTHESIS'; // SYNTHETIC·빈 값·모르는 표기
}

/** 데이터셋 source_type → 근거 수준(데이터셋에는 근거 칸이 없어 대표·본부 진술만 그 수준으로 · 나머지는 가장 낮게). */
export function datasetEvidenceLevelOf(sourceType: string | undefined): FailureEvidenceLevel {
  return sourceType === 'FOUNDER_AI' || sourceType === 'STRATEGY_HQ' ? 'FOUNDER_STATEMENT' : 'HYPOTHESIS';
}

const isUnknownText = (v: unknown): boolean => {
  if (typeof v !== 'string') return true;
  const s = v.trim();
  return !s || s === '—' || s === '-' || /^UNKNOWN\b/i.test(s) || s === '해당 없음';
};

function costValue(note: unknown, evidence: FailureEvidenceLevel): HumanCostValue {
  if (isUnknownText(note)) return { note: UNKNOWN, quantity: UNKNOWN, evidence: UNKNOWN };
  // v0.1 기록은 설명 글뿐이고 잰 값이 없다 → quantity 는 UNKNOWN 그대로(글에서 숫자를 지어내지 않음).
  return { note: String(note), quantity: UNKNOWN, evidence };
}

export function humanCostOf(harm: Record<string, unknown> | undefined, evidence: FailureEvidenceLevel): HumanCost {
  const h = harm ?? {};
  return {
    emotional: costValue(h.emotional, evidence),
    time: costValue(h.time, evidence),
    financial: costValue(h.financial ?? h.material, evidence), // 원본 칸 이름은 material(돈·물질 비용)
    mental: costValue(h.mental, evidence),
  };
}

function resultOf(v: unknown): ResultValue {
  if (typeof v !== 'string') return UNKNOWN;
  const s = v.trim();
  if (/^PASS\b/i.test(s)) return 'PASS';
  if (/^FAIL\b/i.test(s)) return 'FAIL';
  return UNKNOWN;
}

const textOr = (v: unknown): string | Unknown => (isUnknownText(v) ? UNKNOWN : String(v));

export function normalizeFailure(raw: RawFailureRecord): FailureRecordNormalized {
  const evidenceLevel = evidenceLevelOf(raw.origin);
  const layers = (raw.layers ?? []).filter((l): l is RootCauseLayer => (LAYERS as readonly string[]).includes(l));
  return {
    id: raw.id,
    corpus: 'failures',
    title: raw.title ?? raw.id,
    family: raw.family ?? UNKNOWN,
    types: [...(raw.types ?? [])],
    layers,
    primaryLayer: layers[0] ?? 'UNKNOWN',
    evidenceLevel,
    originRaw: raw.origin ?? UNKNOWN,
    humanCost: humanCostOf(raw.user_harm, evidenceLevel),
    claimedDefenseLevel: textOr(raw.defense_level),
    mockResult: resultOf(raw.mock_result),
    // real_ai 칸은 긴 설명(PASS/FAIL 로 시작하지 않음) — 판정 글자가 없으면 UNKNOWN(설명을 해석해 통과로 올리지 않음).
    realAiResult: resultOf(raw.real_ai),
    userResult: resultOf(raw.user_result),
    counterTestNote: textOr(raw.counter_test),
    reproductionNote: textOr(raw.reproduction),
    expected: textOr(raw.expected),
  };
}

export function normalizeDatasetRecord(raw: RawDatasetRecord): FailureRecordNormalized {
  const evidenceLevel = datasetEvidenceLevelOf(raw.source_type);
  return {
    id: raw.id,
    corpus: 'echo-failure-dataset',
    title: raw.raw_context ?? raw.id,
    family: UNKNOWN,
    types: raw.failure_type ? [raw.failure_type] : [],
    layers: [],
    primaryLayer: 'UNKNOWN',
    evidenceLevel,
    originRaw: raw.source_type ?? UNKNOWN,
    humanCost: humanCostOf(undefined, evidenceLevel),
    claimedDefenseLevel: UNKNOWN,
    mockResult: UNKNOWN,
    realAiResult: UNKNOWN,
    userResult: UNKNOWN,
    counterTestNote: textOr(raw.reproduction_test),
    reproductionNote: textOr(raw.reproduction_test),
    expected: textOr(raw.expected_behavior),
  };
}

// ── 연결 엔진 매핑(대표 지시 §3.3 최소 10개) ───────────────────────────────
// 1순위: 실패 종류(types) · 2순위: 실패 가족(family) · 둘 다 없으면 UNMAPPED(억지로 붙이지 않음).
// 순서가 곧 우선순위다(결정적): 앞 규칙이 먼저 맞으면 그 엔진.
export const TYPE_ENGINE_RULES: readonly (readonly [RegExp, ProprietaryEngine])[] = [
  [/거절 의미 재등장/, 'Rejection Firewall'],
  [/정정무시|정정 누락/, 'Correction Engine'],
  [/미확정 사실화|불만 사실 저장/, 'Information Status'],
  [/완료 행동 재요구|막힌 경로 반복 안내/, 'Action Router / Action Ledger'],
  [/Mock PASS \/ 실AI FAIL|검사 결함|잘못된 보고|허위 보고|자동 QA 과신|판정/, 'Verification Gate'],
  [/QA.*(운영|PROD)|(운영|PROD).*QA|혼입/, 'Release Gate'],
  [/배포 불일치|배포 부수 효과|운영·후보 차이/, 'Release Gate'],
  [/대표 중계 과부하|대표 수작업 전가/, 'Agent Orchestration'],
  [/비용 가시성 부족/, 'Cost Visibility Gate'],
  [/반복설명 강요|질문의도 반복|이미 답한 것 재질문|Context 유실|Context 오염|기억 복구 실패/, 'Context Memory'],
  [/방향이탈|무거운 질문|과잉 탐문/, 'Direction Lock'],
];

export const FAMILY_ENGINE: Readonly<Record<string, ProprietaryEngine>> = {
  'F-REPEAT': 'Context Memory',
  'F-CONTEXT': 'Context Memory',
  'F-STATUS': 'Information Status',
  'F-DRIFT': 'Direction Lock',
  'F-DEPLOY': 'Release Gate',
  'F-EVAL': 'Verification Gate',
  'F-ADVISOR': 'Agent Orchestration',
};

export function linkedEngineOf(f: Pick<FailureRecordNormalized, 'types' | 'family'>): ProprietaryEngine {
  for (const [rx, engine] of TYPE_ENGINE_RULES) if (f.types.some((t) => rx.test(t))) return engine;
  return FAMILY_ENGINE[f.family] ?? 'UNMAPPED';
}

const GUARD: Readonly<Record<ProprietaryEngine, string>> = {
  'Context Memory': '이미 들은 뜻(질문 의도·답)을 장부에 남기고, 같은 뜻 질문·재설명 요구를 서버가 막는다',
  'Correction Engine': '사용자 정정을 최신 값(USER_CORRECTED)으로 올리고 충돌하는 옛 값은 SUPERSEDED(계보 유지)',
  'Rejection Firewall': '거절된 뜻 키를 방화벽에 넣어 모델이 같은 뜻을 다시 사실로 내지 못하게 한다(원문은 보존)',
  'Information Status': '확인 전 해석은 AI_INFERRED/UNCONFIRMED 로 두고 사실처럼 말하거나 매칭에 내보내지 않는다',
  'Direction Lock': '사용자가 고른 목적·방향 밖 질문을 서버가 거른다',
  'Action Router / Action Ledger': '행동 장부에서 COMPLETED/DECIDED/BLOCKED 를 먼저 대조해 다시 요구·같은 막힌 길 안내를 막는다',
  'Release Gate': '운영 산출물에 QA 주소·QA 프로젝트 ref 가 있으면 배포를 막는다',
  'Verification Gate': '가짜 AI·빌드·배포 성공을 실제 확인으로 보고하지 않는다(검증 수준을 따로 표기)',
  'Agent Orchestration': '대표가 옮겨 줘야 하는 수작업을 에이전트가 직접 처리하고, 대표에게는 결정만 묻는다',
  'Cost Visibility Gate': '비용이 드는 실행 전 예상 비용·근거를 먼저 보인다',
  UNMAPPED: '(v0.1 매핑 밖 — 사람이 엔진을 정해야 함)',
};

export function compileFailure(f: FailureRecordNormalized): CompiledFailure {
  const linkedEngine = linkedEngineOf(f);
  const counterTest = `${linkedEngine} 규칙을 끈 상태에서 ${f.id} 재현 입력을 넣으면 검사가 실패해야 한다` +
    (f.counterTestNote !== UNKNOWN ? ` · 기록된 반대 검사: ${f.counterTestNote}` : '');
  const qaTest = `${f.id} 재현: ${f.reproductionNote !== UNKNOWN ? f.reproductionNote : '재현 기록 없음(UNKNOWN)'} → 기대: ${f.expected !== UNKNOWN ? f.expected : 'UNKNOWN'}`;
  const candidate: DefenseCandidate = {
    id: `DC-${f.id}`,
    failure_ids: [f.id],
    family: linkedEngine,
    proposed_guard: GUARD[linkedEngine],
    counter_test: counterTest,
    qa_test: qaTest,
    // 기록된 결과는 싣되, 수준은 항상 CANDIDATE 에서 시작(자동 승격 0 — 승격은 defenseRegistry.promote 로만).
    mock_result: f.mockResult,
    real_ai_result: f.realAiResult,
    user_result: f.userResult,
    production_result: UNKNOWN,
    defense_level: 'CANDIDATE',
  };
  const costs = (['emotional', 'time', 'financial', 'mental'] as const).map((k) => `${k}=${f.humanCost[k].note === UNKNOWN ? 'UNKNOWN' : 'noted'}`);
  return {
    failure: f,
    family: f.family,
    rootCauseLayer: f.primaryLayer,
    humanCostSummary: `${costs.join(' · ')} (잰 값 없음 — quantity UNKNOWN)`,
    linkedEngine,
    defenseCandidate: candidate,
    counterTestCandidate: counterTest,
    qaTestCandidate: qaTest,
    evidenceLevel: f.evidenceLevel,
  };
}

/** 여러 기록을 한 번에(순서 보존 · 결정적). */
export function compileFailures(records: readonly FailureRecordNormalized[]): CompiledFailure[] {
  return records.map(compileFailure);
}
