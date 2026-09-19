import {
  useCallback,
  useState,
} from "react";
import {
  generateConversationStep,
  type ConversationStep,
} from "@/doit/lib/openai";

export type Reaction =
  | "agree"
  | "little"
  | "no"
  | "explain"
  | "unsure";

export interface Perspective {
  id: string;
  reading: string;
  question: string;
  semanticKey?: string;
  generated: boolean;
}

export interface AnswerState {
  reaction: Reaction | null;
  note: string;
  retracted: boolean;
}

// 반응 → 정보 상태 계약. 거절(no)은 REJECTED, 직접 설명(explain)은 CHANGED,
// 맞아요(agree)는 CONFIRMED. INFERRED/미확인은 서버가 구분하며 프론트가 확정으로 위장하지 않는다.
export type InfoStatus =
  | "confirmed"
  | "rejected"
  | "changed"
  | "partial"
  | "uncertain";

function statusForReaction(reaction: Reaction): InfoStatus {
  switch (reaction) {
    case "agree":
      return "confirmed";
    case "no":
      return "rejected";
    case "explain":
      return "changed";
    case "little":
      return "partial";
    case "unsure":
    default:
      return "uncertain";
  }
}

const MAX_STEPS = 3;

const emptyAnswer = (): AnswerState => ({
  reaction: null,
  note: "",
  retracted: false,
});

export function useOpenAIConversation() {
  const [perspectives, setPerspectives] = useState<Perspective[]>([]);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildHistory = useCallback(
    (perspectiveList: Perspective[], answerList: AnswerState[]) =>
      perspectiveList
        .map((perspective, index) => {
          const answer = answerList[index];

          if (!answer?.reaction) {
            return null;
          }

          return {
            reading: perspective.reading,
            reaction: answer.reaction,
            status: statusForReaction(answer.reaction),
            semanticKey: perspective.semanticKey,
            note: answer.note,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [],
  );

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const step = await generateConversationStep([]);

      setPerspectives([
        {
          id: `ai-0-${Date.now()}`,
          reading: step.reading,
          question: step.question,
          semanticKey: step.semanticKey,
          generated: true,
        },
      ]);
      setAnswers([emptyAnswer()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 2026-09-16: 생성 성공 여부를 돌려준다. 실패했을 때 화면이 질문 없는 다음 칸으로 넘어가지 않게 하기 위해서다.
  const generateNext = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const history = buildHistory(perspectives, answers);
      const step = await generateConversationStep(history);
      const nextIndex = perspectives.length;

      setPerspectives((previous) => [
        ...previous,
        {
          id: `ai-${nextIndex}-${Date.now()}`,
          reading: step.reading,
          question: step.question,
          semanticKey: step.semanticKey,
          generated: true,
        },
      ]);
      setAnswers((previous) => [...previous, emptyAnswer()]);
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [buildHistory, perspectives, answers]);

  const setAnswer = useCallback(
    (index: number, patch: Partial<AnswerState>) => {
      setAnswers((previous) =>
        previous.map((answer, answerIndex) =>
          answerIndex === index
            ? { ...answer, ...patch }
            : answer,
        ),
      );
    },
    [],
  );

  return {
    perspectives,
    answers,
    loading,
    error,
    maxSteps: MAX_STEPS,
    start,
    generateNext,
    setAnswer,
  };
}