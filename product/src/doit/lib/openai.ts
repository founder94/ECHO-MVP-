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