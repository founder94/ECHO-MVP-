// 로그인 전(consent 이전)에 입력한 목적(purpose)을 sessionStorage에 임시 보관한다.
// - 개인정보 아님(목적 ID·라벨만). 브라우저 임시값이며 로그인 복귀 후 DB 영속화 성공 시 즉시 삭제된다.
// - 장기 저장 구조가 아니므로 새로고침·재로그인을 넘어 영구 보존을 보장하지 않는다.
// - DB 저장은 auth user 확보 후에만 수행한다(브라우저 임의 user id 생성 금지).

// stale 방지: draft에 "명시적으로 선택한 시각(selectedAt)"을 남긴다.
// 실DB의 최신 확정 값이 오래된 draft보다 우선한다.
// 단, "이번 인증 직전에 사용자가 명시적으로 새 목적을 선택한" 최신 draft만 서버에 반영할 수 있다.
// 이를 위해 draft가 일정 시간(DRAFT_FRESH_MS) 이내에 생성된 경우에만 "fresh(현재 흐름의 선택)"로 인정하고,
// 그보다 오래된 draft는 stale로 간주해 서버 값을 덮어쓰지 않는다.

const DRAFT_KEY = "doit:journey-draft";

// fresh로 인정하는 최대 경과 시간. 로그인 + Google callback 복귀가 통상 수 분 이내이므로 넉넉히 30분.
// INTERNAL IMPLEMENTATION DEFAULT — 제품 정책(법무 확정)이 아니다. 대표가 최종 값을 확정하기 전까지
// 기술 구현 기본값으로만 사용하며, 법적 동의·보존 기간과 무관하다.
const DRAFT_FRESH_MS = 30 * 60 * 1000;

export interface JourneyDraft {
  purposeId: string;
  purposeLabel: string;
  // 목적을 명시적으로 선택한 시각(epoch ms). stale 판정의 기준.
  selectedAt: number;
}

interface JourneyDraftInput {
  purposeId: string;
  purposeLabel: string;
}

export function saveJourneyDraft(input: JourneyDraftInput): void {
  const draft: JourneyDraft = {
    purposeId: input.purposeId,
    purposeLabel: input.purposeLabel,
    selectedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 저장 불가 시 목적은 유실될 수 있지만, 흐름을 막지 않는다.
  }
}

export function loadJourneyDraft(): JourneyDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as JourneyDraft).purposeId === "string" &&
      typeof (parsed as JourneyDraft).purposeLabel === "string" &&
      typeof (parsed as JourneyDraft).selectedAt === "number" &&
      Number.isFinite((parsed as JourneyDraft).selectedAt)
    ) {
      return parsed as JourneyDraft;
    }
    // selectedAt이 없거나 올바르지 않으면(구형 draft) stale로 간주한다.
    return null;
  } catch {
    return null;
  }
}

// draft가 "현재 흐름의 명시적 선택"인지(즉 stale이 아닌지) 판정한다.
export function isJourneyDraftFresh(
  draft: JourneyDraft,
  now: number = Date.now(),
): boolean {
  return now - draft.selectedAt <= DRAFT_FRESH_MS;
}

// fresh한 draft만 반환한다. stale하면 삭제하고 null을 돌려 서버 값이 우선하게 한다.
export function loadFreshJourneyDraft(): JourneyDraft | null {
  const draft = loadJourneyDraft();
  if (!draft) return null;
  if (!isJourneyDraftFresh(draft)) {
    clearJourneyDraft();
    return null;
  }
  return draft;
}

export function clearJourneyDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // 무시
  }
}