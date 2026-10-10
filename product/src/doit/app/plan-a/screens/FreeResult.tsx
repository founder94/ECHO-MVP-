import { useEffect, useState } from "react";
import FxStage, { WaitHook } from "@/doit/fx/FxStage";
import { TAROT_HOOKS } from "@/doit/fx/hooks";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  Info,
  Pencil,
  Loader2,
} from "lucide-react";
import { colors, serif, surfaces } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  generateTarotInterpretation,
  TarotError,
  type TarotErrorKind,
  type TarotInterpretation,
} from "@/doit/lib/openai";
import { Link } from "react-router-dom";
import { TAROT_DECK } from "../tarotDeck";
import { TarotCardArt } from "../components/TarotCardArt";
import { ResultCard, SajuPreviewSection, readSelectedCard } from "./FreeResult.parts";
import { OPEN_PERIOD } from "@/doit/lib/openPeriod";

interface Props {
  mode: "saju" | "taro";
  onJoin: () => void;
  onExit: () => void;
}

export function FreeResult({
  mode,
  onJoin,
  onExit,
}: Props) {
  const [selectedCard, setSelectedCard] =
    useState<(typeof TAROT_DECK)[number] | null>(null);

  const [fit, setFit] = useState<
    null | "similar" | "different"
  >(null);

  const [showNote, setShowNote] =
    useState(false);

  const [note, setNote] = useState("");

  const [tarotResult, setTarotResult] =
    useState<TarotInterpretation | null>(null);

  const [tarotLoading, setTarotLoading] =
    useState(false);

  const [tarotError, setTarotError] =
    useState<string | null>(null);

  // 2026-10-05 타로 해석 실패 복구: 실패 종류(로그인 · 준비 중 · 한도 · 몰림 · 실패) · 같은 카드로 한 번 다시(누를 때만 · 연타 = 요청 하나)
  const [tarotErrorKind, setTarotErrorKind] = useState<TarotErrorKind | null>(null);
  const [tarotTry, setTarotTry] = useState(0);

  useEffect(() => {
    if (mode !== "taro") {
      return;
    }

    const selected = readSelectedCard();

    if (!selected) {
      setTarotError("카드 정보를 찾을 수 없어요. 다시 선택해 주세요.");
      return;
    }

    setSelectedCard(selected.card);

    let cancelled = false;

    setTarotLoading(true);
    setTarotError(null);
    setTarotErrorKind(null);

    generateTarotInterpretation(
      selected.card.nameKo,
      selected.purpose,
    )
      .then((result) => {
        if (!cancelled) {
          setTarotResult(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTarotError(
            err instanceof Error
              ? err.message
              : "잠시 후 다시 시도해 주세요.",
          );
          setTarotErrorKind(err instanceof TarotError ? err.kind : "failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTarotLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, tarotTry]);

  // 사주는 실제 엔진 연동 전 → 가짜 결과 대신 "준비 중"을 명확히 표시한다.
  const isSajuPreparing = mode === "saju";

  const hasRealTarot =
    mode === "taro" && tarotResult !== null && !tarotLoading && !tarotError;

  // 타로는 실제 AI 결과가 있어야만 내용을 보여주고,
  // 로딩·오류 중에는 가짜(데모) 내용을 절대 노출하지 않는다.
  const showResultContent =
    mode !== "taro" || hasRealTarot;

  const displayTags =
    showResultContent && !isSajuPreparing
      ? hasRealTarot
        ? tarotResult!.tags
        : []
      : [];

  const displayCards =
    showResultContent && !isSajuPreparing
      ? hasRealTarot
        ? tarotResult!.cards
        : []
      : [];

  const displaySummary =
    hasRealTarot
      ? tarotResult!.summary
      : isSajuPreparing
        ? "사주 분석 기능은 현재 준비 중이에요. 정확한 명식과 해석은 실제 사주 엔진이 연결된 뒤 제공될 예정이에요."
        : "";

  const statusText =
    mode === "taro" && tarotLoading
      ? "AI가 카드를 해석하고 있어요"
      : mode === "taro" && tarotError
        ? "해석을 불러오지 못했어요"
        : mode === "taro" && tarotResult
          ? "AI 해석"
          : mode === "saju"
            ? "준비 중"
            : "무료 결과";

  return (
    <div
      className="flex flex-col echo-min-h-svh"
      style={{
        backgroundColor: surfaces.page,
      }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-4">
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          className="flex items-center gap-1.5 mb-5"
        >
          <Info
            size={12}
            color={surfaces.onPageFaint}
          />

          <span
            style={{
              color: surfaces.onPageFaint,
              fontSize: 11,
              letterSpacing: "0.08em",
            }}
          >
            {mode === "taro" && tarotLoading && (
              <Loader2
                size={11}
                className="inline mr-1 animate-spin"
                color={colors.accent}
              />
            )}

            {statusText}
          </span>
        </motion.div>

        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
          className="mb-7"
        >
          <p
            style={{
              color: surfaces.onPageFaint,
              fontSize: 11,
              letterSpacing: "0.18em",
              marginBottom: 8,
            }}
          >
            FREE ·{" "}
            {mode === "saju"
              ? "사주"
              : "타로"}
          </p>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 30,
              lineHeight: 1.2,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            지금의 당신에게 보이는 흐름
          </h1>

          {mode === "taro" && selectedCard && (
            <div className="mx-auto mb-6 flex flex-col items-center">
              <div
                className="h-[280px] w-[182px] rounded-[14px] p-[2px]"
                style={{
                  background:
                    "linear-gradient(145deg,#f6e2a6,#725b30,#f6e2a6)",
                  boxShadow:
                    "0 18px 48px var(--fortune-shadow, rgba(0,0,0,.55)),0 0 30px rgba(187,252,158,.18)",
                }}
              >
                <TarotCardArt
                  card={selectedCard}
                  active
                />
              </div>
              <p
                className="mt-3 text-center text-[11px] tracking-[.18em]"
                style={{
                  color: surfaces.onPageFaint,
                }}
              >
                {selectedCard.nameEn}
              </p>
            </div>
          )}

          <p
            style={{
              color: surfaces.onPage,
              fontSize: 15,
              lineHeight: 1.7,
              marginBottom: 12,
            }}
          >
            이 결과는 미래를 단정하지 않아요. 지금의
            마음과 선택을 돌아보는 참고로 봐주세요.
          </p>

          {/* 2026-10-10 대표 전달 효과: 해석을 기다리는 동안 유리 카드 바람개비 + 한 줄 안내(짧게 끝나면 안 띄움) */}
          {mode === "taro" && tarotLoading && (
            <div className="doit-fx-wait">
              <FxStage fx="glass" delayMs={300} />
              <WaitHook lines={TAROT_HOOKS} delayMs={300} />
            </div>
          )}

          {mode === "taro" && tarotError && (
            <p
              style={{
                color: surfaces.onPage,
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              {tarotError}
            </p>
          )}
          {mode === "taro" && tarotError && (tarotErrorKind === "failed" || tarotErrorKind === "busy") && (
            <button
              type="button"
              className="echo-glass-btn echo-glass-btn--primary mt-3 rounded-2xl min-h-12 px-4"
              disabled={tarotLoading}
              onClick={() => { if (!tarotLoading) setTarotTry((n) => n + 1); }}
            >
              같은 카드로 다시 보기
            </button>
          )}
          {mode === "taro" && tarotError && tarotErrorKind === "login" && (
            <Link className="echo-glass-btn echo-glass-btn--primary mt-3 inline-flex items-center justify-center rounded-2xl min-h-12 px-4" to="/login" state={{ from: "/doit/fortune?view=taro" }}>
              로그인하고 해석 보기
            </Link>
          )}

          {showResultContent && (
            <p
              style={{
                color: colors.text,
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              {displaySummary}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.15,
          }}
          className="flex flex-wrap gap-2 mb-6"
        >
          {displayTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-3 py-1"
              style={{
                fontSize: 12,
                color: surfaces.onPage,
                backgroundColor:
                  surfaces.card,
                border: `1px solid ${colors.border}`,
              }}
            >
              {tag}
            </span>
          ))}
        </motion.div>

        {mode === "saju" && <SajuPreviewSection />}

        {!tarotError && (
          <div className="flex flex-col gap-3">
            {displayCards.map(
              (card, index) => (
                <ResultCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  delay={
                    0.18 +
                    index * 0.08
                  }
                />
              ),
            )}
          </div>
        )}

        {mode === "saju" && (
          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.4,
            }}
            className="mt-6 rounded-2xl p-5"
            style={{
              backgroundColor: surfaces.card,
              border: `1px solid ${colors.border}`,
            }}
          >
            <p
              style={{
                color: colors.text,
                fontSize: 14.5,
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              이 관점은 실제 나와 비슷한가요?
            </p>

            <div className="flex gap-2">
              {[
                {
                  key: "similar" as const,
                  label: "비슷해요",
                },
                {
                  key: "different" as const,
                  label: "조금 달라요",
                },
              ].map((option) => {
                const active =
                  fit === option.key;

                return (
                  <button aria-pressed={active}
                    key={option.key}
                    onClick={() => {
                      setFit(option.key);
                      setShowNote(
                        option.key ===
                          "different",
                      );
                    }}
                    className="echo-glass-btn echo-glass-btn--choice flex-1 rounded-full flex items-center justify-center"
                    style={{ height: 44, fontSize: 14, transition:
                        "background-color 0.15s ease, color 0.15s ease" }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {showNote && (
                <motion.div
                  initial={{
                    opacity: 0,
                    height: 0,
                  }}
                  animate={{
                    opacity: 1,
                    height: "auto",
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                  }}
                  transition={{
                    duration: 0.25,
                  }}
                  style={{
                    overflow: "hidden",
                  }}
                >
                  <p
                    style={{
                      color:
                        surfaces.onPage,
                      fontSize: 13,
                      lineHeight: 1.55,
                      margin:
                        "14px 0 10px",
                    }}
                  >
                    아니어도 괜찮아요. 내가 다시 설명할 수
                    있어요.
                  </p>

                  <textarea
                    value={note}
                    onChange={(event) =>
                      setNote(
                        event.target
                          .value,
                      )
                    }
                    placeholder="어떤 점이 다른지 편하게 적어주세요 (지금 안 써도 괜찮아요)"
                    rows={3}
                    className="w-full resize-none rounded-2xl px-4 py-3 outline-none"
                    style={{
                      backgroundColor:
                        surfaces.page,
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      fontSize: 14,
                      lineHeight: 1.5,
                      fontFamily: serif,
                    }}
                  />

                  <div className="flex items-center gap-1.5 mt-2">
                    <Pencil
                      size={12}
                      color={
                        surfaces.onPageFaint
                      }
                    />

                    <span
                      style={{
                        color:
                          surfaces.onPageFaint,
                        fontSize: 11,
                      }}
                    >
                      적은 내용은 이 화면에만 있고
                      저장되지 않아요
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.5,
          }}
          className="mt-8 rounded-3xl p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            border: `1px solid ${colors.borderStrong}`,
          }}
        >
          <p
            style={{
              color: surfaces.onPage,
              fontSize: 13.5,
              lineHeight: 1.65,
            }}
          >
            {/* 2026-10-01 UI/UX FINAL CLOSE: 타로는 참고 콘텐츠 — 연결(매칭) 근거로 약속하지 않는다. 대화의 주체는 ECHO. */}
            카드는 재미로 보는 참고예요. 내가 원하는 관계는
            ECHO와 직접 이야기하면서 정리할 수 있어요.
          </p>
        </motion.div>

        <p
          className="mt-5 text-center"
          style={{
            color: surfaces.onPageFaint,
            fontSize: 11.5,
            lineHeight: 1.6,
          }}
        >
          사주·타로 결과는 참고이며 미래·결혼·건강을
          <br />
          단정하는 내용이 아니에요.
        </p>
        {OPEN_PERIOD.active && (
          <p className="mt-2 text-center" style={{ color: surfaces.onPageFaint, fontSize: 11.5, lineHeight: 1.6 }}>{OPEN_PERIOD.result}</p>
        )}
      </div>

      <div
        className="px-6 pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))] flex flex-col gap-3"
        style={{
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <PrimaryButton onClick={onJoin}>
          ECHO와 조금 더 이야기하기
        </PrimaryButton>

        <PrimaryButton
          variant="ghost"
          onClick={onExit}
        >
          오늘은 여기까지만 볼게요
        </PrimaryButton>
      </div>
    </div>
  );
}