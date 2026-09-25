// ECHO 마음 원문 공식 전달 구조 (화면 담당)
//
// ⚠️ 중요: 이 구조는 서버 저장이 아니다. 같은 탭(sessionStorage)에만 남는
// 브라우저 임시 초안이다. 탭을 닫거나 다른 기기로 가면 사라진다.
// 서버가 원문을 실제로 수신했다는 확인이 있기 전에는 "저장 완료"로 취급하면 안 된다.

export const STORY_HANDOFF_KEY = 'echo:story-handoff';
const LEGACY_DRAFT_KEY = 'echo:mind-draft';

export interface StoryHandoffValue {
  mindText: string;
  createdAt: number;
}

export function readStoryHandoff(): StoryHandoffValue | null {
  try {
    const raw = sessionStorage.getItem(STORY_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoryHandoffValue>;
    if (!parsed || typeof parsed.mindText !== 'string' || parsed.mindText.trim() === '') {
      return null;
    }
    return {
      mindText: parsed.mindText,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
    };
  } catch {
    return null;
  }
}

export function writeStoryHandoff(mindText: string): boolean {
  try {
    const value: StoryHandoffValue = { mindText, createdAt: Date.now() };
    sessionStorage.setItem(STORY_HANDOFF_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearStoryHandoff(): void {
  try {
    sessionStorage.removeItem(STORY_HANDOFF_KEY);
  } catch {
    /* 무시 */
  }
}

export function readLegacyDraft(): string | null {
  try {
    const value = sessionStorage.getItem(LEGACY_DRAFT_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function clearLegacyDraft(): void {
  try {
    sessionStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    /* 무시 */
  }
}

// §5 처리 순서 ①~③
// ① 공식 전달값이 이미 있으면 그것을 우선한다
// ② 없고 echo:mind-draft 만 있으면 공식 구조로 한 번 옮긴다
// ③ 두 키를 오래 중복 보관하지 않도록, 옮긴 뒤 레거시 초안을 정리한다
export function migrateLegacyDraftOnce(): void {
  if (readStoryHandoff()) return;
  const legacy = readLegacyDraft();
  if (legacy) {
    writeStoryHandoff(legacy);
    clearLegacyDraft();
  }
}