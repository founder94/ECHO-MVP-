/**
 * 이야기 임시 글 — 이 기기(브라우저)의 localStorage 에만 둔다. 서버·AI·외부로 보내지 않는다(대표 지시 §9).
 * 화면을 오가거나 홈페이지로 돌아갔다 와도 지워지지 않고, 사용자가 「임시 글 지우기」를 눌러야 지워진다.
 * 저장소를 쓸 수 없는 환경(사생활 보호 창 등)에서는 조용히 메모리로만 동작한다.
 */
const KEY = "doit-echo-link:story-draft:v1";

export interface StoryDraft {
  /** 사용자가 쓴 원문 그대로. */
  text: string;
  /** 확인 화면에서 사용자가 고치거나 뺀 뒤의 문장들(원문은 text 에 그대로 남는다). */
  lines?: string[];
  updatedAt: number;
}

let memory: StoryDraft | null = null;

export const loadDraft = (): StoryDraft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as Partial<StoryDraft>;
    if (typeof parsed.text !== "string") return memory;
    return {
      text: parsed.text,
      lines: Array.isArray(parsed.lines) ? parsed.lines.filter((l): l is string => typeof l === "string") : undefined,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return memory;
  }
};

export const saveDraft = (draft: Omit<StoryDraft, "updatedAt">): void => {
  memory = { ...draft, updatedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* 저장소를 못 쓰면 이 탭의 메모리로만 */
  }
};

export const clearDraft = (): void => {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
};

export const hasDraft = (): boolean => (loadDraft()?.text.trim().length ?? 0) > 0;

/** 문장 단위로 나눈다(마침표·물음표·느낌표·줄바꿈). 원문 글자는 바꾸지 않는다. */
export const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?。？！])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
