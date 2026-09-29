// Human State Compiler v0.1(대표 「IMPLEMENTATION ORDER」 §3.2) — 순수·결정적 함수만(네트워크·저장·시간·무작위 0).
// 사용자 한 번의 행동(USER_MESSAGE·CONFIRM·CORRECT·REJECT·RETRACT)을 받아 사람 상태(Canonical State)를 새로 만든다.
// 규칙
//  1) 사용자 원문은 어떤 경우에도 보존한다(지우거나 고치지 않음).
//  2) AI_INFERRED(모델 해석)는 사용자가 확인하기 전에는 절대 확정으로 오르지 않는다.
//  3) CORRECT 는 충돌하는 옛 사실을 SUPERSEDED 로 밀고 계보(lineage)를 남긴다 — 최신 직접 정정이 이긴다.
//  4) REJECT 는 대상 뜻을 REJECTED 로 두고 원문은 지우지 않는다. 거절된 뜻은 모델이 다시 사실로 올리지 못한다(Rejection Firewall).
//  5) 「잘 모르겠어」·「딱히 생각 안 나」는 원문만 남기고 사실로 올리지 않는다.
//  6) 매칭으로 내보낼 수 있는 것은 MATCHING_ELIGIBLE 상태뿐 — 거절·밀림·확인 중·미확인·AI 추정은 빠진다.
// React 화면에 두지 않는다(아키텍처 규칙 §6: UI → Agent → Human Continuity → 모델 후보 → 서버 검증 → 상태 → 매칭 안전 투영).
import {
  MATCHING_ELIGIBLE,
  type CanonicalState,
  type CompileResult,
  type CorrectionEdge,
  type HumanStateEvent,
  type HumanStateFact,
  type InformationStatus,
  type MatchingSafeFact,
  type RawStatement,
  type RejectionEdge,
  type StateTransition,
} from './types.ts';

/**
 * 규칙 스위치. 기본값이 안전한 값이며 운영 경로는 항상 기본값을 쓴다.
 * 스위치는 반대 검사(counter-test)가 「규칙을 끄면 검사가 실제로 실패한다」를 보이기 위해서만 있다.
 */
export interface CompilerPolicy {
  eligibleStatuses: readonly InformationStatus[];
  rejectionFirewall: boolean;
  preserveRawText: boolean;
  supersedeOnCorrect: boolean;
  modelAutoConfirm: boolean;
  uncertainAsFact: boolean;
}

export const SAFE_POLICY: Readonly<CompilerPolicy> = Object.freeze({
  eligibleStatuses: MATCHING_ELIGIBLE,
  rejectionFirewall: true,
  preserveRawText: true,
  supersedeOnCorrect: true,
  modelAutoConfirm: false,
  uncertainAsFact: false,
});

/** 「잘 모르겠어」·「딱히 생각 안 나」·「글쎄요」 류 — 답이 아니라 불확실함을 말한 것. */
const UNCERTAIN = /(잘\s*)?모르겠|딱히\s*(생각|없|떠오르)|생각\s*(이\s*)?안\s*나|떠오르는\s*게\s*없|글쎄|몰라요?$|^몰라/;
export function isUncertainStatement(text: string): boolean {
  return UNCERTAIN.test(text.trim());
}

/** 같은 뜻 비교용 키: 유니코드 정규화 · 소문자 · 공백·문장부호 제거. */
export function meaningKeyOf(meaning: string): string {
  return meaning.normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function emptyState(): CanonicalState {
  return { version: 1, seq: 0, statements: [], facts: [], corrections: [], rejections: [], rejectedMeanings: [] };
}

const ACTIVE: readonly InformationStatus[] = ['USER_DIRECT', 'USER_CONFIRMED', 'USER_CORRECTED', 'AI_INFERRED', 'UNCONFIRMED', 'DISPUTED'];
const TERMINAL: readonly InformationStatus[] = ['REJECTED', 'SUPERSEDED', 'RETRACTED'];
const CONFIRMABLE: readonly InformationStatus[] = ['USER_DIRECT', 'AI_INFERRED', 'UNCONFIRMED', 'DISPUTED'];

/** 한 사건을 적용한다. 입력 상태는 바꾸지 않고 새 상태를 돌려준다. */
export function compileHumanState(current: CanonicalState, event: HumanStateEvent, policy: CompilerPolicy = SAFE_POLICY): CompileResult {
  const state: CanonicalState = structuredClone(current);
  const seq = state.seq + 1;
  state.seq = seq;
  const statementId = `S${seq}`;
  const transitions: StateTransition[] = [];
  const corrections: CorrectionEdge[] = [];
  const rejections: RejectionEdge[] = [];
  const t = (kind: StateTransition['kind'], fact: HumanStateFact | null, from: InformationStatus | null, to: InformationStatus | null, reason: string) =>
    transitions.push({ kind, factId: fact?.id ?? null, from, to, statementId, reason });
  const set = (fact: HumanStateFact, to: InformationStatus, kind: StateTransition['kind'], reason: string) => {
    const from = fact.status;
    fact.status = to;
    fact.updatedSeq = seq;
    t(kind, fact, from, to, reason);
  };

  // 1) 원문 보존
  const uncertain = isUncertainStatement(event.text);
  const raw: RawStatement = { id: statementId, seq, event: event.type, text: policy.preserveRawText ? event.text : '', uncertain };
  state.statements.push(raw);
  t('RAW_KEPT', null, null, null, uncertain ? '불확실한 답 — 원문만 보관' : '원문 보관');

  const byId = (id?: string) => (id ? state.facts.find((f) => f.id === id) ?? null : null);
  const newFact = (slot: string, meaning: string, status: InformationStatus, lineage: string[] = []): HumanStateFact => {
    const fact: HumanStateFact = { id: `F${seq}`, slot, meaning, meaningKey: meaningKeyOf(meaning), status, sourceStatementId: statementId, createdSeq: seq, updatedSeq: seq, lineage };
    state.facts.push(fact);
    return fact;
  };
  const firewallBlocks = (meaning: string) => policy.rejectionFirewall && state.rejectedMeanings.includes(meaningKeyOf(meaning));

  switch (event.type) {
    case 'USER_MESSAGE': {
      if (!event.slot || !event.meaning) break; // 뜻을 뽑지 않은 말 — 원문만 남김
      if (uncertain && !policy.uncertainAsFact) {
        t('UNCERTAIN_NOT_PROMOTED', null, null, null, `「${event.text}」은 불확실한 답이라 사실로 올리지 않음`);
        break;
      }
      const byModel = event.proposedBy === 'MODEL';
      if (byModel && firewallBlocks(event.meaning)) {
        t('BLOCKED_REJECTED_MEANING', null, null, null, '사용자가 거절한 뜻을 모델이 다시 냄 — 차단');
        break;
      }
      if (!byModel && state.rejectedMeanings.includes(meaningKeyOf(event.meaning))) {
        // 사용자가 스스로 다시 말하면 사용자의 최신 말이 이긴다(거절 해제 · 이력은 남김).
        state.rejectedMeanings = state.rejectedMeanings.filter((k) => k !== meaningKeyOf(event.meaning));
      }
      const status: InformationStatus = byModel ? (policy.modelAutoConfirm ? 'USER_CONFIRMED' : 'AI_INFERRED') : 'USER_DIRECT';
      const fact = newFact(event.slot, event.meaning, status);
      t('FACT_ADDED', fact, null, status, byModel ? '모델 해석 후보(확인 전)' : '사용자가 직접 말함');
      break;
    }
    case 'CONFIRM': {
      const fact = byId(event.targetId);
      if (!fact || !CONFIRMABLE.includes(fact.status)) {
        t('IGNORED_INVALID_TARGET', fact, fact?.status ?? null, null, fact ? `${fact.status} 는 확인할 수 없음` : '대상 없음');
        break;
      }
      set(fact, 'USER_CONFIRMED', 'CONFIRMED', '사용자가 맞다고 확인');
      break;
    }
    case 'CORRECT': {
      const target = byId(event.targetId);
      const slot = event.slot ?? target?.slot;
      if (!slot || !event.meaning) {
        t('IGNORED_INVALID_TARGET', target, target?.status ?? null, null, '정정할 칸·뜻 없음');
        break;
      }
      const key = meaningKeyOf(event.meaning);
      const olds = target ? (TERMINAL.includes(target.status) ? [] : [target]) : state.facts.filter((f) => f.slot === slot && ACTIVE.includes(f.status) && f.meaningKey !== key);
      const lineage = olds.flatMap((o) => [...o.lineage, o.id]);
      const fresh = newFact(slot, event.meaning, 'USER_CORRECTED', [...new Set(lineage)]);
      if (state.rejectedMeanings.includes(key)) state.rejectedMeanings = state.rejectedMeanings.filter((k) => k !== key); // 사용자 정정이 최신
      t('CORRECTED', fresh, null, 'USER_CORRECTED', '사용자 정정 — 최신 값');
      if (policy.supersedeOnCorrect) {
        for (const old of olds) {
          old.supersededBy = fresh.id;
          set(old, 'SUPERSEDED', 'SUPERSEDED', `정정으로 ${fresh.id} 에 밀림`);
          const edge: CorrectionEdge = { from: old.id, to: fresh.id, statementId, seq };
          state.corrections.push(edge); corrections.push(edge);
        }
      }
      break;
    }
    case 'REJECT': {
      const reject = (fact: HumanStateFact | null, key: string, ambiguous: boolean) => {
        const edge: RejectionEdge = { factId: fact?.id ?? null, meaningKey: key, statementId, seq, ambiguous };
        state.rejections.push(edge); rejections.push(edge);
      };
      const addFirewall = (key: string) => { if (!state.rejectedMeanings.includes(key)) state.rejectedMeanings.push(key); };
      const target = byId(event.targetId);
      if (target) {
        if (TERMINAL.includes(target.status)) { t('IGNORED_INVALID_TARGET', target, target.status, null, '이미 끝난 사실'); break; }
        set(target, 'REJECTED', 'REJECTED', '사용자가 아니라고 함');
        addFirewall(target.meaningKey); reject(target, target.meaningKey, false);
        break;
      }
      if (event.targetMeaning) {
        const key = meaningKeyOf(event.targetMeaning);
        addFirewall(key);
        const hits = state.facts.filter((f) => f.meaningKey === key && ACTIVE.includes(f.status));
        for (const f of hits) set(f, 'REJECTED', 'REJECTED', '사용자가 이 뜻을 거절');
        reject(hits[0] ?? null, key, false);
        break;
      }
      // 대상을 짚지 않은 거절(「그런 뜻 아니야」): 확인 전 AI 해석이 하나면 그것, 여럿이면 모두 DISPUTED(지우지 않고 확인 중).
      const candidates = state.facts.filter((f) => f.status === 'AI_INFERRED' || f.status === 'UNCONFIRMED');
      if (candidates.length === 1) {
        set(candidates[0], 'REJECTED', 'REJECTED', '직전 AI 해석을 사용자가 거절');
        addFirewall(candidates[0].meaningKey); reject(candidates[0], candidates[0].meaningKey, false);
      } else if (candidates.length > 1) {
        for (const f of candidates) { set(f, 'DISPUTED', 'DISPUTED', '어느 해석을 거절했는지 모호 — 확인 중'); reject(f, f.meaningKey, true); }
      } else {
        t('IGNORED_INVALID_TARGET', null, null, null, '거절할 AI 해석이 없음');
      }
      break;
    }
    case 'RETRACT': {
      const fact = byId(event.targetId);
      if (!fact || TERMINAL.includes(fact.status)) { t('IGNORED_INVALID_TARGET', fact, fact?.status ?? null, null, fact ? '이미 끝난 사실' : '대상 없음'); break; }
      set(fact, 'RETRACTED', 'RETRACTED', '사용자가 자기 말을 거둠');
      break;
    }
  }

  return { state, transitions, corrections, rejections, matchingSafe: matchingSafeProjection(state, policy) };
}

/** 여러 사건을 차례로 적용(재생). */
export function replayEvents(events: readonly HumanStateEvent[], policy: CompilerPolicy = SAFE_POLICY, start: CanonicalState = emptyState()): CompileResult {
  let result: CompileResult = { state: start, transitions: [], corrections: [], rejections: [], matchingSafe: matchingSafeProjection(start, policy) };
  const transitions: StateTransition[] = [];
  for (const e of events) {
    result = compileHumanState(result.state, e, policy);
    transitions.push(...result.transitions);
  }
  return { ...result, transitions, corrections: result.state.corrections, rejections: result.state.rejections };
}

/** 매칭·프로필로 내보낼 수 있는 사실만. */
export function matchingSafeProjection(state: CanonicalState, policy: CompilerPolicy = SAFE_POLICY): MatchingSafeFact[] {
  return state.facts
    .filter((f) => policy.eligibleStatuses.includes(f.status))
    .filter((f) => !policy.rejectionFirewall || !state.rejectedMeanings.includes(f.meaningKey))
    .map((f) => ({ factId: f.id, slot: f.slot, meaning: f.meaning, status: f.status }));
}

/**
 * 상태 불변식 검사(운영 규칙이 실제로 지켜지는지). 반대 검사가 규칙을 끈 정책으로 이 검사를 실패시키는 데 쓴다.
 * 돌려주는 목록이 비어 있어야 정상이다.
 */
export function checkStateInvariants(events: readonly HumanStateEvent[], result: CompileResult): string[] {
  const v: string[] = [];
  const { state, matchingSafe } = result;
  for (const m of matchingSafe) {
    if (!MATCHING_ELIGIBLE.includes(m.status)) v.push(`매칭 투영에 허용되지 않은 상태 ${m.status}(${m.factId})`);
    const fact = state.facts.find((f) => f.id === m.factId);
    if (fact && state.rejectedMeanings.includes(fact.meaningKey)) v.push(`매칭 투영에 거절된 뜻(${m.factId})`);
  }
  if (state.statements.length !== events.length) v.push(`원문 수 ${state.statements.length} ≠ 사건 수 ${events.length}`);
  events.forEach((e, i) => { if (state.statements[i]?.text !== e.text) v.push(`원문 ${i + 1} 이 보존되지 않음`); });
  for (const f of state.facts) {
    if (f.status === 'SUPERSEDED') {
      const next = state.facts.find((n) => n.id === f.supersededBy);
      if (!next || !next.lineage.includes(f.id)) v.push(`정정 계보 끊김(${f.id})`);
    }
    if (f.status === 'USER_CONFIRMED' || f.status === 'USER_CORRECTED' || f.status === 'USER_DIRECT') {
      const src = state.statements.find((s) => s.id === f.sourceStatementId);
      if (src?.uncertain) v.push(`불확실한 답이 사실로 올라감(${f.id})`);
    }
  }
  // 같은 칸에서 정정으로 대체된 옛 값이 여전히 매칭 투영에 있으면 안 된다(최신 정정이 이긴다).
  for (const edge of state.corrections) if (matchingSafe.some((m) => m.factId === edge.from)) v.push(`밀린 옛 값이 매칭 투영에 남음(${edge.from})`);
  for (const f of state.facts) if (f.status === 'USER_CORRECTED') {
    for (const oldId of f.lineage) if (matchingSafe.some((m) => m.factId === oldId)) v.push(`정정 계보의 옛 값이 매칭 투영에 남음(${oldId})`);
  }
  // 거절된 뜻을 모델이 거절 뒤에 다시 사실(후보 포함)로 올리면 안 된다(Rejection Firewall).
  for (const f of state.facts) {
    const src = events[f.createdSeq - 1];
    if (src?.proposedBy !== 'MODEL') continue;
    if (state.rejections.some((r) => r.meaningKey === f.meaningKey && r.seq < f.createdSeq && !r.ambiguous)) v.push(`거절된 뜻이 모델 후보로 다시 올라옴(${f.id})`);
  }
  // 모델 해석은 사용자 확인 사건 없이 확인 상태가 될 수 없다.
  for (const f of state.facts) if (f.status === 'USER_CONFIRMED') {
    const confirmedByUser = events.some((e, i) => e.type === 'CONFIRM' && e.targetId === f.id && i + 1 >= f.createdSeq);
    const src = events[f.createdSeq - 1];
    if (src?.proposedBy === 'MODEL' && !confirmedByUser) v.push(`모델 해석이 사용자 확인 없이 확정됨(${f.id})`);
  }
  return v;
}
