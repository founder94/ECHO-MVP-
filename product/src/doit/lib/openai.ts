import { getSupabase } from "./supabase";

// A구조 전용 OpenAI 서버 호출 서비스 계층.
// 브라우저는 OpenAI 를 직접 호출하지 않고, 반드시 이 모듈을 통해
// Supabase Edge Function(openai-chat)을 경유합니다.
// OPENAI_API_KEY 는 서버 Secrets 에만 존재하며 프론트에는 없습니다.

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface InvokeResult {
  content?: string;
  parsed?: unknown;
  error?: string;
}

const ANON_SESSION_KEY = "doit-anon-session";

export function getAnonSessionId(): string {
  let id = localStorage.getItem(ANON_SESSION_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_SESSION_KEY, id);
  }

  return id;
}

export function clearAnonSession(): void {
  localStorage.removeItem(ANON_SESSION_KEY);
}

async function invokeChat(body: Record<string, unknown>): Promise<string> {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error("잠시 후 다시 시도해 주세요.");
  }

  const anonSession = getAnonSessionId();

  const { data, error } = await supabase.functions.invoke<InvokeResult>(
    "openai-chat",
    {
      body,
      headers: {
        "x-anon-session": anonSession,
      },
    },
  );

  if (error) {
    throw new Error("잠시 후 다시 시도해 주세요.");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.content ?? "";
}

function extractJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export interface ConversationStep {
  reading: string;
  question: string;
  semanticKey?: string;
}

export interface ConversationHistoryItem {
  reading: string;
  reaction: string;
  status: "confirmed" | "rejected" | "changed" | "partial" | "uncertain";
  semanticKey?: string;
  note: string;
}

export async function generateConversationStep(
  history: ConversationHistoryItem[],
): Promise<ConversationStep> {
  const content = await invokeChat({
    type: "conversation",
    history,
  });

  const parsed = extractJson<ConversationStep>(content);

  if (parsed?.reading && parsed?.question) {
    return {
      reading: parsed.reading.trim(),
      question: parsed.question.trim(),
      semanticKey:
        typeof parsed.semanticKey === "string"
          ? parsed.semanticKey.trim()
          : undefined,
    };
  }

  throw new Error("잠시 후 다시 시도해 주세요.");
}

export interface TarotInterpretation {
  summary: string;
  tags: string[];
  cards: { label: string; value: string }[];
}

export async function generateTarotInterpretation(
  cardName: string,
  purpose: string,
): Promise<TarotInterpretation> {
  const content = await invokeChat({
    type: "tarot_reading",
    cardName,
    purpose,
  });

  const parsed = extractJson<TarotInterpretation>(content);

  if (parsed?.summary) {
    return {
      summary: parsed.summary.trim(),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      cards: Array.isArray(parsed.cards) ? parsed.cards.slice(0, 3) : [],
    };
  }

  throw new Error("잠시 후 다시 시도해 주세요.");
}
// 사주 「ECHO의 이야기」(2026-10-06 대표 「사람냄새나게」) — 화면이 계산한 네 가지 값만 보낸다(생년월일·시간·성별 0).
// 실패하면 화면은 규칙 해설을 그대로 두고 「지금은 이야기를 만들지 못했어요」만 알린다(가짜 이야기 0 · 저장 0).
export interface SajuStory { story: string; closing: string }

export async function generateSajuStory(facts: import("./saju/storyFacts").SajuStoryFacts): Promise<SajuStory> {
  const content = await invokeChat({ type: "saju_reading", facts });
  const parsed = extractJson<SajuStory>(content);
  if (parsed && typeof parsed.story === "string" && parsed.story.trim() && typeof parsed.closing === "string") {
    return { story: parsed.story.trim(), closing: parsed.closing.trim() };
  }
  throw new Error("잠시 후 다시 시도해 주세요.");
}
