import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  motion,
  AnimatePresence,
} from "motion/react";
import {
  Info,
  ArrowLeft,
  Check,
  Pencil,
  Loader2,
} from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  useOpenAIConversation,
  type Reaction,
} from "@/doit/hooks/useOpenAIConversation";
import { ExplainBox, REACTIONS } from "./AIConversation.parts";

interface Props {
  onNext: () => void;
  onBack?: () => void;
}

export function AIConversation({
  onNext,
  onBack,
}: Props) {
  const {
    perspectives,
    answers,
    loading,
    error,
    maxSteps,
    start,
    generateNext,
    setAnswer,
  } = useOpenAIConversation();

  const [index, setIndex] = useState(0);
  const [showExplain, setShowExplain] =
    useState(false);
  const [draft, setDraft] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void start();
  }, [start]);

  const perspective = perspectives[index];
  const currentAnswer = answers[index];
  const isLast = index === maxSteps - 1;
  const answered =
    currentAnswer?.reaction !== null;
  const done = answers
    .slice(0, maxSteps)
    .every((answer) => answer.reaction !== null);

  useEffect(() => {
    topRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setShowExplain(
      answers[index]?.reaction === "explain" ||
        answers[index]?.reaction === "no",
    );
    setDraft(answers[index]?.note ?? "");
  }, [index, answers]);

  function setAnswerAt(
    patch: Partial<{
      reaction: Reaction;
      note: string;
      retracted: boolean;
    }>,
  ) {
    setAnswer(index, patch);
  }

  function handleReaction(reaction: Reaction) {
    if (reaction === "explain") {
      setAnswerAt({
        reaction: "explain",
        retracted: false,
      });
      setShowExplain(true);
      return;
    }

    if (reaction === "no") {
      setAnswerAt({
        reaction: "no",
        retracted: true,
      });
      setShowExplain(true);
      return;
    }

    setAnswerAt({
      reaction,
      retracted: false,
    });
    setShowExplain(false);
  }

  function saveExplain() {
    setAnswerAt({
      note: draft.trim(),
    });
    setShowExplain(false);
  }

  async function goNext() {
    if (!isLast) {
      if (perspectives.length <= index + 1) {
        setAdvancing(true);

        try {
          await generateNext();
        } finally {
          setAdvancing(false);
        }
      }

      setIndex((currentIndex) =>
        currentIndex + 1,
      );
    }
  }

  function goPrevious() {
    if (index > 0) {
      setIndex((currentIndex) =>
        currentIndex - 1,
      );
      return;
    }

    onBack?.();
  }

  const nextDisabled = !answered || advancing || loading;

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100dvh",
        backgroundColor: colors.bg,
      }}
    >
      <div
        className="px-6 pt-10 pb-4 shrink-0 flex items-start gap-3"
        style={{
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {(onBack || index > 0) && (
          <button
            type="button"
            onClick={goPrevious}
            aria-label="이전으로"
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 36,
              height: 36,
              border: `1px solid ${colors.border}`,
            }}
          >
            <ArrowLeft
              size={18}
              color={colors.text}
            />
          </button>
        )}

        <div className="flex-1">
          <p
            style={{
              color: colors.textFaint,
              fontSize: 11,
              letterSpacing: "0.18em",
              marginBottom: 4,
            }}
          >
            AI 대화
          </p>

          <h2
            style={{
              fontFamily: serif,
              fontSize: 20,
              color: colors.text,
            }}
          >
            어떤 사람과 어떤 관계를 원하세요?
          </h2>

          <div className="flex items-center gap-1.5 mt-2">
            <Info
              size={11}
              color={colors.textFaint}
            />

            <span
              style={{
                color: colors.textFaint,
                fontSize: 11,
              }}
            >
              정해진 답은 없어요. 편한 말로 이야기해
              주세요.
            </span>
          </div>
        </div>
      </div>

      <div
        ref={topRef}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {error && !perspective && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p
              style={{
                color: colors.textMuted,
                fontSize: 14,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              {error}
            </p>
          </div>
        )}

        {!perspective && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2
              size={22}
              color={colors.accent}
              className="animate-spin"
            />

            <p
              style={{
                color: colors.textMuted,
                fontSize: 13,
              }}
            >
              AI가 질문을 준비하고 있어요
            </p>
          </div>
        )}

        {perspective && (
          <>
            <div className="flex items-center gap-2 mb-6">
              {Array.from({ length: maxSteps }).map(
                (_, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="rounded-full"
                    style={{
                      width:
                        itemIndex === index
                          ? 22
                          : 7,
                      height: 7,
                      backgroundColor:
                        answers[itemIndex]
                          ?.reaction != null
                          ? colors.accent
                          : itemIndex === index
                            ? colors.textFaint
                            : colors.border,
                      transition:
                        "width 0.25s ease, background-color 0.25s ease",
                    }}
                  />
                ),
              )}

              <span
                style={{
                  marginLeft: "auto",
                  color: colors.textFaint,
                  fontSize: 11,
                }}
              >
                {index + 1} / {maxSteps}
              </span>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {error}
                </p>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={perspective.id}
                initial={{
                  opacity: 0,
                  y: 10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div
                  className="rounded-3xl p-5 mb-4"
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${
                      currentAnswer?.retracted
                        ? colors.border
                        : colors.borderStrong
                    }`,
                    opacity:
                      currentAnswer?.retracted
                        ? 0.55
                        : 1,
                    transition:
                      "opacity 0.3s ease, border-color 0.3s ease",
                  }}
                >
                  <p
                    style={{
                      color: colors.textFaint,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      marginBottom: 8,
                    }}
                  >
                    {currentAnswer?.retracted
                      ? "이건 제가 잘못 짐각했어요"
                      : "이렇게 느껴졌어요 (확정 아니에요)"}
                  </p>

                  <p
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      lineHeight: 1.6,
                      textDecoration:
                        currentAnswer?.retracted
                          ? "line-through"
                          : "none",
                    }}
                  >
                    {perspective.reading}
                  </p>

                  {currentAnswer?.retracted && (
                    <p
                      style={{
                        color: colors.textMuted,
                        fontSize: 13,
                        lineHeight: 1.6,
                        marginTop: 10,
                      }}
                    >
                      아니어도 괜찮아요. 내가 다시 설명할 수
                      있어요.
                    </p>
                  )}
                </div>

                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  {perspective.question}
                </p>

                <div className="flex flex-wrap gap-2">
                  {REACTIONS.map((reaction) => {
                    const active =
                      currentAnswer?.reaction ===
                      reaction.key;

                    return (
                      <motion.button
                        type="button"
                        key={reaction.key}
                        whileTap={{
                          scale: 0.96,
                        }}
                        onClick={() =>
                          handleReaction(
                            reaction.key,
                          )
                        }
                        className="rounded-full px-4 flex items-center gap-1.5"
                        style={{
                          height: 44,
                          fontSize: 14,
                          color: active
                            ? colors.onAccent
                            : colors.text,
                          backgroundColor: active
                            ? colors.accent
                            : colors.surface,
                          border: `1px solid ${
                            active
                              ? colors.accent
                              : colors.border
                          }`,
                          transition:
                            "background-color 0.15s ease, color 0.15s ease",
                        }}
                      >
                        {active && (
                          <Check size={14} />
                        )}

                        {reaction.label}
                      </motion.button>
                    );
                  })}
                </div>

                <ExplainBox open={showExplain} draft={draft} onChange={setDraft} onSave={saveExplain} />

                {currentAnswer?.note &&
                  !showExplain && (
                    <div
                      className="mt-4 rounded-2xl p-4 flex items-start gap-2.5"
                      style={{
                        backgroundColor:
                          colors.accentSoft,
                        border: `1px solid ${colors.borderStrong}`,
                      }}
                    >
                      <Pencil
                        size={13}
                        color={colors.accent}
                        className="mt-0.5 shrink-0"
                      />

                      <div className="flex-1">
                        <p
                          style={{
                            color:
                              colors.textFaint,
                            fontSize: 11,
                            marginBottom: 3,
                          }}
                        >
                          내가 설명한 것
                        </p>

                        <p
                          style={{
                            color: colors.text,
                            fontSize: 13.5,
                            lineHeight: 1.55,
                          }}
                        >
                          {currentAnswer.note}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setShowExplain(true)
                        }
                        style={{
                          color: colors.textMuted,
                          fontSize: 12,
                        }}
                      >
                        수정
                      </button>
                    </div>
                  )}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>

      <div
        className="px-6 pt-4 pb-6 shrink-0 flex flex-col gap-2"
        style={{
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        {!isLast ? (
          <PrimaryButton
            onClick={goNext}
            disabled={nextDisabled}
          >
            {advancing || loading
              ? "AI가 준비 중이에요"
              : "다음 이야기로"}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={onNext}
            disabled={!done}
          >
            연결 목적 고르기
          </PrimaryButton>
        )}

        <p
          className="text-center"
          style={{
            color: colors.textFaint,
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          오늘 밤은 여기까지 해도 괜찮아요. 결정은 내가
          합니다.
        </p>
      </div>
    </div>
  );
}