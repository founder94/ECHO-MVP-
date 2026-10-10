import { getSupabase } from "./supabase";
import { agentTarot, ECHO_AGENT_ENABLED } from "./agentApi";
import { UnderstandingError } from "./understandingApi";

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

// 사주 「ECHO의 이야기」(2026-10-06 대표 「사람냄새나게」) — 화면이 계산한 결과 두 가지(나를 뜻하는 글자·다섯 기운 개수)만 보낸다(생년월일·시간·성별 0).
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

export interface TarotInterpretation {
  summary: string;
  tags: string[];
  cards: { label: string; value: string }[];
}

// 2026-10-05 대표 「타로 해석 실패 이유를 알아내서 최종 완성」: 원인 = QA 서버에 예전 openai-chat 함수가 없음(호출 404 · 모든 오류를 같은 「잠시 후」로 숨김).
//   → 해석은 ECHO 서버(doit-agent agent_tarot · 로그인 · 하루 한도 · 사용 기록)로 부른다. 실패는 종류별 안내(TarotError.kind) — 화면은 같은 카드로 다시 시도·끝내기를 준다.
export type TarotErrorKind = "login" | "not_ready" | "limit" | "busy" | "paused" | "failed";
export class TarotError extends Error { kind: TarotErrorKind; constructor(kind: TarotErrorKind, message: string) { super(message); this.kind = kind; } }
export const TAROT_ERROR: Record<TarotErrorKind, string> = {
  login: "로그인하면 이 카드의 해석을 볼 수 있어요. 고른 카드는 그대로 둘게요.",
  not_ready: "해석 기능을 아직 준비하고 있어요. 고른 카드는 그대로 볼 수 있어요.",
  limit: "오늘 볼 수 있는 해석을 다 봤어요. 내일 같은 카드로 다시 볼 수 있어요.",
  busy: "요청이 몰렸어요. 잠시 뒤 같은 카드로 다시 해 볼 수 있어요.",
  // Codex P2(4186782778): 회사 AI 예산으로 멈춘 상태 — 바로 다시 해도 같은 결과라 「다시 보기」를 주지 않는다
  paused: "지금은 해석을 잠시 멈췄어요. 고른 카드는 그대로 볼 수 있어요.",
  failed: "해석을 만들지 못했어요. 같은 카드로 다시 해 볼 수 있어요.",
};
export const tarotErrorKind = (code: string | undefined): TarotErrorKind =>
  code === "UNAUTHORIZED" ? "login"
    : code === "AI_COMPANY_BUDGET" ? "paused"
    : code === "AI_NOT_CONFIGURED" || code === "NOT_FOUND" ? "not_ready"
      : code === "AI_DAILY_LIMIT" || code === "AI_BUDGET" ? "limit"
        : code === "RATE_LIMITED" || code === "BUSY" || code === "REQUEST_CONFLICT" || code === "AI_USAGE_UNKNOWN" || code === "CLAIM_UNCONFIRMED" ? "busy"
          : "failed";

export async function generateTarotInterpretation(
  cardName: string,
  purpose: string,
): Promise<TarotInterpretation> {
  const supabase = getSupabase();
  const userId = supabase ? (await supabase.auth.getSession()).data.session?.user.id : undefined;
  if (!userId) throw new TarotError("login", TAROT_ERROR.login);
  if (!ECHO_AGENT_ENABLED) throw new TarotError("not_ready", TAROT_ERROR.not_ready);
  try {
    return await agentTarot(userId, cardName, purpose);
  } catch (e) {
    const kind = tarotErrorKind(e instanceof UnderstandingError ? e.code : undefined);
    throw new TarotError(kind, TAROT_ERROR[kind]);
  }

}
