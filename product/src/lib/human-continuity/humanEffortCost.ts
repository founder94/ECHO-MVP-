// Human Effort Cost v0.1(대표 「IMPLEMENTATION ORDER」 §3.4) — AI·시스템이 사람에게 지운 부담을 센다. 사람(사용자·대표)을 평가하지 않는다.
// 가중치는 바꿀 수 있는 기본값일 뿐 과학적 측정값이 아니다. 결과는 내부 R&D 전용(화면·매칭·프로필 사용 금지).
import {
  HUMAN_EFFORT_EVENT_TYPES,
  type EffortBand,
  type FailureRecordNormalized,
  type HumanEffortEvent,
  type HumanEffortEventType,
  type HumanEffortResult,
} from './types.ts';

/** 기본 가중치(조정 가능 · 근거 있는 측정값 아님). 사람을 다시 설명하게 만든 사건일수록 무겁게 둔 회사 판단. */
export const DEFAULT_EFFORT_WEIGHTS: Readonly<Record<HumanEffortEventType, number>> = Object.freeze({
  repeated_explanation: 3,
  correction_required: 2,
  rejected_meaning_reappeared: 4,
  completed_action_re_requested: 3,
  blocked_path_repeated: 3,
  unnecessary_manual_step: 2,
  unnecessary_long_explanation: 1,
  wrong_navigation: 2,
  false_completion_report: 5,
  qa_prod_mix: 5,
  cost_not_disclosed: 3,
});

const CAUSES = new Set(['AI', 'APP', 'DEV_AI', 'RELEASE']);

export function bandOf(score: number): EffortBand {
  if (score <= 0) return 'NONE';
  if (score < 4) return 'LOW';
  if (score < 10) return 'MEDIUM';
  if (score < 20) return 'HIGH';
  return 'CRITICAL';
}

/**
 * 사건 목록 → 내부 점수. 허용 목록 밖 사건(예: 사용자 성격·태도 평가)은 세지 않고 rejectedInputs 로 돌려준다.
 * 입력은 바꾸지 않는다.
 */
export function evaluateHumanEffort(input: readonly unknown[], weights: Readonly<Record<HumanEffortEventType, number>> = DEFAULT_EFFORT_WEIGHTS): HumanEffortResult {
  const events: HumanEffortEvent[] = [];
  const rejectedInputs: { input: string; reason: string }[] = [];
  for (const raw of input) {
    const e = raw as Partial<HumanEffortEvent> & Record<string, unknown>;
    const label = JSON.stringify(raw)?.slice(0, 120) ?? String(raw);
    if (!e || typeof e !== 'object') { rejectedInputs.push({ input: label, reason: '사건 형식 아님' }); continue; }
    if (!HUMAN_EFFORT_EVENT_TYPES.includes(e.type as HumanEffortEventType)) { rejectedInputs.push({ input: label, reason: '허용 목록 밖 사건(시스템 부담이 아닌 평가는 세지 않음)' }); continue; }
    if (!CAUSES.has(String(e.causedBy))) { rejectedInputs.push({ input: label, reason: '원인이 시스템(AI·앱·개발 AI·배포)이 아님 — 사람 탓으로 세지 않음' }); continue; }
    if (typeof e.evidence !== 'string' || !e.evidence.trim()) { rejectedInputs.push({ input: label, reason: '근거 없음' }); continue; }
    const count = Number.isInteger(e.count) && (e.count as number) > 0 ? (e.count as number) : 1;
    events.push({ type: e.type as HumanEffortEventType, causedBy: e.causedBy as HumanEffortEvent['causedBy'], evidence: e.evidence, count });
  }
  const rawScore = events.reduce((s, e) => s + weights[e.type] * (e.count ?? 1), 0);
  const band = bandOf(rawScore);
  const top = [...new Set(events.map((e) => e.type))];
  return {
    subject: 'SYSTEM',
    scope: 'INTERNAL_RD_ONLY',
    events,
    rawScore,
    band,
    evidence: events.map((e) => e.evidence),
    reason: events.length ? `시스템이 사람에게 지운 부담: ${top.join(', ')}` : '센 부담 없음',
    rejectedInputs,
    weightsNote: '가중치는 조정 가능한 회사 기본값 — 과학적 측정값 아님',
  };
}

/** 실패 종류 → 사람 수고 사건(기록된 실패 1건 = 사건 1번 · 추정해서 횟수를 늘리지 않음). */
const TYPE_EVENT: readonly (readonly [RegExp, HumanEffortEventType, HumanEffortEvent['causedBy']])[] = [
  [/반복설명 강요|질문의도 반복|이미 답한 것 재질문/, 'repeated_explanation', 'AI'],
  [/정정무시|정정 누락/, 'correction_required', 'AI'],
  [/거절 의미 재등장/, 'rejected_meaning_reappeared', 'AI'],
  [/완료 행동 재요구/, 'completed_action_re_requested', 'DEV_AI'],
  [/막힌 경로 반복 안내/, 'blocked_path_repeated', 'DEV_AI'],
  [/대표 중계 과부하|대표 수작업 전가/, 'unnecessary_manual_step', 'DEV_AI'],
  [/잘못된 보고|허위 보고/, 'false_completion_report', 'DEV_AI'],
  [/출구 없음|흐름 혼란|이동 막힘/, 'wrong_navigation', 'APP'],
  [/비용 가시성 부족/, 'cost_not_disclosed', 'DEV_AI'],
  [/QA.*(운영|PROD)|(운영|PROD).*QA|혼입/, 'qa_prod_mix', 'RELEASE'],
];

export function effortEventsFromFailure(f: Pick<FailureRecordNormalized, 'id' | 'types'>): HumanEffortEvent[] {
  const out: HumanEffortEvent[] = [];
  for (const [rx, type, causedBy] of TYPE_EVENT) {
    const hit = f.types.find((t) => rx.test(t));
    if (hit && !out.some((e) => e.type === type)) out.push({ type, causedBy, evidence: `${f.id}: ${hit}`, count: 1 });
  }
  return out;
}

/** 행동 장부 대조: 이미 COMPLETED·DECIDED 인 것을 다시 요구하거나 BLOCKED 인 길을 같은 방식으로 다시 안내하면 사건. */
export interface LedgerItem { id: string; what: string; state: string }
export function ledgerEvents(ledger: readonly LedgerItem[], requested: readonly { id: string; how?: 'request' | 'suggest_same_path' }[]): HumanEffortEvent[] {
  const out: HumanEffortEvent[] = [];
  for (const r of requested) {
    const item = ledger.find((i) => i.id === r.id);
    if (!item) continue;
    if ((item.state === 'COMPLETED' || item.state === 'DECIDED') && (r.how ?? 'request') === 'request') out.push({ type: 'completed_action_re_requested', causedBy: 'DEV_AI', evidence: `${item.id}(${item.state}): ${item.what}` });
    if (item.state === 'BLOCKED' && r.how === 'suggest_same_path') out.push({ type: 'blocked_path_repeated', causedBy: 'DEV_AI', evidence: `${item.id}(BLOCKED): ${item.what}` });
  }
  return out;
}

/**
 * 운영 산출물 글에 QA 표식(QA 프로젝트 ref · QA 사이트 주소)이 있으면 qa_prod_mix 사건.
 * 표식은 호출하는 쪽이 넘긴다(이 층에 주소를 박아 두지 않음).
 */
export function qaProdMixEvents(artifactName: string, content: string, qaMarkers: readonly string[]): HumanEffortEvent[] {
  return qaMarkers.filter((m) => m && content.includes(m)).map((m) => ({ type: 'qa_prod_mix' as const, causedBy: 'RELEASE' as const, evidence: `${artifactName} 에 QA 표식 「${m}」` }));
}
