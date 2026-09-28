// Defense Registry v0.1(대표 「IMPLEMENTATION ORDER」 §3.5) — 방어 후보 장부. 운영 강제 0(후보를 기록할 뿐 어디에도 적용하지 않음).
// 승격은 한 칸씩만(단조) · 그 칸에 맞는 근거가 있어야만. CANDIDATE → VERIFIED 지름길 없음. 원본 기록이 주장하는 수준으로 자동 승격하지 않는다.
import { DEFENSE_LEVELS, UNKNOWN, type DefenseCandidate, type DefenseLevel, type ResultValue } from './types.ts';

export interface DefenseRegistry {
  readonly entries: readonly DefenseCandidate[];
  readonly history: readonly PromotionRecord[];
}

export interface PromotionRecord {
  id: string;
  from: DefenseLevel;
  to: DefenseLevel;
  evidence: string;
  accepted: boolean;
  reason: string;
}

/** 승격 근거. 칸마다 필요한 결과·참조가 다르다. */
export interface PromotionEvidence {
  /** MOCK_VERIFIED: 가짜 AI 검사 PASS + 규칙을 끄면 검사가 실패함을 확인 */
  mockPass?: boolean;
  counterTestFailsWhenDisabled?: boolean;
  /** REAL_AI_VERIFIED: 실제 AI 실행 PASS + 실행 참조(Actions run 등) */
  realAiPass?: boolean;
  realAiRunRef?: string;
  /** USER_VERIFIED: 실제 사용자(대표 실기기 등) 확인 PASS + 참조 */
  userPass?: boolean;
  userRef?: string;
  /** PRODUCTION_VERIFIED: 운영 관측 PASS + 참조 */
  productionPass?: boolean;
  productionRef?: string;
}

export function createRegistry(candidates: readonly DefenseCandidate[] = []): DefenseRegistry {
  const seen = new Set<string>();
  const entries: DefenseCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    entries.push({ ...c, failure_ids: [...c.failure_ids], defense_level: 'CANDIDATE' }); // 들어올 때는 항상 CANDIDATE
  }
  return Object.freeze({ entries: Object.freeze(entries), history: Object.freeze([]) }) as DefenseRegistry;
}

const indexOf = (l: DefenseLevel) => DEFENSE_LEVELS.indexOf(l);

function evidenceCheck(to: DefenseLevel, ev: PromotionEvidence): { ok: boolean; reason: string; patch: Partial<DefenseCandidate> } {
  const ref = (s?: string) => typeof s === 'string' && s.trim().length > 0;
  switch (to) {
    case 'MOCK_VERIFIED':
      return ev.mockPass === true && ev.counterTestFailsWhenDisabled === true
        ? { ok: true, reason: '가짜 AI 검사 PASS + 반대 검사 확인', patch: { mock_result: 'PASS' } }
        : { ok: false, reason: 'MOCK_VERIFIED 에는 가짜 AI 검사 PASS 와 반대 검사(규칙을 끄면 실패) 둘 다 필요', patch: {} };
    case 'REAL_AI_VERIFIED':
      return ev.realAiPass === true && ref(ev.realAiRunRef)
        ? { ok: true, reason: `실제 AI PASS(${ev.realAiRunRef})`, patch: { real_ai_result: 'PASS' } }
        : { ok: false, reason: 'REAL_AI_VERIFIED 에는 실제 AI PASS 와 실행 참조가 필요', patch: {} };
    case 'USER_VERIFIED':
      return ev.userPass === true && ref(ev.userRef)
        ? { ok: true, reason: `사용자 확인 PASS(${ev.userRef})`, patch: { user_result: 'PASS' } }
        : { ok: false, reason: 'USER_VERIFIED 에는 실제 사용자 확인 PASS 와 참조가 필요', patch: {} };
    case 'PRODUCTION_VERIFIED':
      return ev.productionPass === true && ref(ev.productionRef)
        ? { ok: true, reason: `운영 관측 PASS(${ev.productionRef})`, patch: { production_result: 'PASS' } }
        : { ok: false, reason: 'PRODUCTION_VERIFIED 에는 운영 관측 PASS 와 참조가 필요', patch: {} };
    default:
      return { ok: false, reason: 'CANDIDATE 로의 승격은 없음', patch: {} };
  }
}

/** 한 칸 승격 시도. 거절돼도 기록은 남고 장부 값은 그대로다. 입력 장부는 바꾸지 않는다. */
export function promote(registry: DefenseRegistry, id: string, to: DefenseLevel, evidence: PromotionEvidence): DefenseRegistry {
  const entry = registry.entries.find((e) => e.id === id);
  const from: DefenseLevel = entry?.defense_level ?? 'CANDIDATE';
  const record = (accepted: boolean, reason: string): PromotionRecord => ({ id, from, to, evidence: JSON.stringify(evidence), accepted, reason });
  if (!entry) return freeze(registry.entries, [...registry.history, record(false, '장부에 없는 후보')]);
  if (indexOf(to) !== indexOf(from) + 1) {
    const why = indexOf(to) <= indexOf(from) ? '승격은 위로만(내리거나 같은 칸 없음)' : `한 칸씩만 — ${from} 다음은 ${DEFENSE_LEVELS[indexOf(from) + 1]}`;
    return freeze(registry.entries, [...registry.history, record(false, why)]);
  }
  const check = evidenceCheck(to, evidence);
  if (!check.ok) return freeze(registry.entries, [...registry.history, record(false, check.reason)]);
  const entries = registry.entries.map((e) => (e.id === id ? { ...e, ...check.patch, defense_level: to } : e));
  return freeze(entries, [...registry.history, record(true, check.reason)]);
}

function freeze(entries: readonly DefenseCandidate[], history: readonly PromotionRecord[]): DefenseRegistry {
  return Object.freeze({ entries: Object.freeze([...entries]), history: Object.freeze([...history]) }) as DefenseRegistry;
}

/** 장부 불변식: 각 수준이 그 수준까지의 근거 결과를 모두 갖고 있어야 한다(지름길·근거 없는 수준 0). */
export function checkRegistryInvariants(registry: DefenseRegistry): string[] {
  const v: string[] = [];
  const need: [DefenseLevel, keyof DefenseCandidate][] = [['MOCK_VERIFIED', 'mock_result'], ['REAL_AI_VERIFIED', 'real_ai_result'], ['USER_VERIFIED', 'user_result'], ['PRODUCTION_VERIFIED', 'production_result']];
  for (const e of registry.entries) {
    const lvl = indexOf(e.defense_level);
    for (const [level, field] of need) if (lvl >= indexOf(level) && (e[field] as ResultValue) !== 'PASS') v.push(`${e.id}: ${e.defense_level} 인데 ${String(field)} 가 PASS 아님(${String(e[field] ?? UNKNOWN)})`);
    const accepted = registry.history.filter((h) => h.id === e.id && h.accepted).length;
    if (accepted !== lvl) v.push(`${e.id}: 수준 ${e.defense_level} 과 승인된 승격 수 ${accepted} 불일치(지름길 의심)`);
  }
  return v;
}
