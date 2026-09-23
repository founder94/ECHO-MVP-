import {
  useMemo,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import {
  MoonStar,
  RotateCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  TarotCardArt,
  TarotCardBack,
} from "../components/TarotCardArt";
import {
  TAROT_DECK,
  type TarotCard,
} from "../tarotDeck";

interface Props {
  onNext: () => void;
  onSwitchToSaju?: () => void;
}

const purposes = [
  "친구 관계",
  "이성 관계",
  "동성 친구 관계",
  "동료 관계",
  "관심사 기반 관계",
  "가치관 기반 관계",
  "창업가 그룹",
  "전문직 그룹",
  "크리에이터 그룹",
  "프로젝트·스터디·성장",
  "목적성 기반 대화",
  "성소수자 보호 공간",
];

const dayKey = () =>
  new Date().toLocaleDateString("sv-SE");

const storageKey = () =>
  `echo-tarot-daily:${dayKey()}`;

function shuffled() {
  const cards = [...TAROT_DECK];

  for (
    let index = cards.length - 1;
    index > 0;
    index -= 1
  ) {
    const target = Math.floor(
      Math.random() * (index + 1),
    );

    [cards[index], cards[target]] = [
      cards[target],
      cards[index],
    ];
  }

  return cards;
}

export function TaroCardSelect({
  onNext,
  onSwitchToSaju,
}: Props) {
  const saved = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem(
          storageKey(),
        ) || "null",
      ) as {
        cardId: string;
        purpose: string;
      } | null;
    } catch {
      return null;
    }
  }, []);

  const [purpose, setPurpose] = useState(
    saved?.purpose || "",
  );

  const [deck, setDeck] =
    useState<TarotCard[]>(() =>
      shuffled(),
    );

  const [phase, setPhase] = useState<
    "purpose" | "deck" | "reveal"
  >(saved ? "reveal" : "purpose");

  const [selected, setSelected] =
    useState<TarotCard | null>(() =>
      saved
        ? TAROT_DECK.find(
            (card) =>
              card.id === saved.cardId,
          ) || null
        : null,
    );

  const choose = (card: TarotCard) => {
    setSelected(card);
    setPhase("reveal");

    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        cardId: card.id,
        purpose,
      }),
    );
  };

  const reshuffle = () => {
    setDeck(shuffled());
  };

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        backgroundColor: colors.bg,
      }}
    >
      <motion.div
        className="pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
        animate={{
          opacity: [0.12, 0.3, 0.12],
          scale: [0.9, 1.08, 0.9],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
        }}
        style={{
          background:
            "radial-gradient(circle,rgba(205,174,117,.46),transparent 68%)",
        }}
      />

      <div className="relative z-10 flex-1 px-5 pb-4 pt-9">
        <p
          style={{
            color: colors.textFaint,
            fontSize: 11,
            letterSpacing: ".2em",
            marginBottom: 9,
          }}
        >
          FREE · 오늘의 타로 · 하루 한 장
        </p>

        <AnimatePresence mode="wait">
          {phase === "purpose" && (
            <motion.section
              key="purpose"
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1
                style={{
                  fontFamily: serif,
                  fontSize: 27,
                  lineHeight: 1.28,
                  color: colors.text,
                }}
              >
                오늘, 어떤 사람을
                <br />
                만나고 싶나요?
              </h1>

              <p
                className="mt-3 text-sm leading-6"
                style={{
                  color: colors.textMuted,
                }}
              >
                관계 목적을 먼저 고르면 카드와 대화가
                오늘의 탐색 맥락이 됩니다.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2">
                {purposes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setPurpose(item)
                    }
                    className="min-h-12 rounded-2xl px-3 text-left text-[13px] transition"
                    style={{
                      color:
                        purpose === item
                          ? "#f3dfa8"
                          : colors.textMuted,
                      border: `1px solid ${
                        purpose === item
                          ? "#c6a866"
                          : colors.border
                      }`,
                      background:
                        purpose === item
                          ? "rgba(198,168,102,.12)"
                          : colors.surface,
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <PrimaryButton
                  disabled={!purpose}
                  onClick={() =>
                    setPhase("deck")
                  }
                >
                  78장 카드 만나기
                </PrimaryButton>
              </div>
            </motion.section>
          )}

          {phase === "deck" && (
            <motion.section
              key="deck"
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <h1
                style={{
                  fontFamily: serif,
                  fontSize: 27,
                  lineHeight: 1.28,
                  color: colors.text,
                }}
              >
                78장 중 오늘 마음이
                <br />
                멈추는 한 장을 고르세요
              </h1>

              <p
                className="mt-2 text-xs"
                style={{
                  color: "#d6ba78",
                }}
              >
                {purpose}
              </p>

              <p
                className="mt-2 text-sm leading-6"
                style={{
                  color: colors.textMuted,
                }}
              >
                모든 카드는 서로 다른 원화예요. 좌우로
                천천히 넘겨 한 장을 선택해 주세요.
              </p>

              <div className="relative -mx-5 mt-7 overflow-hidden py-7">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0A0D14] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0A0D14] to-transparent" />

                <div className="flex snap-x gap-2.5 overflow-x-auto px-[42%] pb-5 [scrollbar-width:none]">
                  {deck.map(
                    (card, index) => (
                      <motion.button
                        key={card.id}
                        type="button"
                        aria-label={`78장 중 ${
                          index + 1
                        }번째 카드 선택`}
                        onClick={() =>
                          choose(card)
                        }
                        whileHover={{
                          y: -10,
                        }}
                        whileTap={{
                          scale: 0.96,
                        }}
                        className="h-[218px] w-[142px] shrink-0 snap-center rounded-[14px] p-[2px]"
                        style={{
                          background:
                            "linear-gradient(145deg,#eed99f,#725b30,#eed99f)",
                          boxShadow:
                            "0 18px 38px rgba(0,0,0,.5)",
                        }}
                      >
                        <TarotCardBack
                          index={index}
                        />
                      </motion.button>
                    ),
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={reshuffle}
                className="mx-auto flex h-11 items-center gap-2 rounded-full px-5 text-sm"
                style={{
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <RotateCcw size={14} />
                카드 다시 섞기
              </button>
            </motion.section>
          )}

          {phase === "reveal" &&
            selected && (
              <motion.section
                key="reveal"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                className="text-center"
              >
                <p
                  className="text-xs tracking-[.18em]"
                  style={{
                    color: colors.textFaint,
                  }}
                >
                  {saved
                    ? "오늘 이미 선택한 카드"
                    : "오늘 당신이 고른 카드"}
                </p>

                <motion.div
                  initial={{
                    rotateY: 180,
                    scale: 0.8,
                  }}
                  animate={{
                    rotateY: 0,
                    scale: 1,
                  }}
                  transition={{
                    duration: 0.8,
                    type: "spring",
                    bounce: 0.22,
                  }}
                  className="mx-auto mt-5 h-[390px] w-[254px] rounded-[18px] p-[2px]"
                  style={{
                    background:
                      "linear-gradient(145deg,#f6e2a6,#725b30,#f6e2a6)",
                    boxShadow:
                      "0 26px 70px rgba(0,0,0,.62),0 0 45px rgba(205,174,117,.2)",
                  }}
                >
                  <TarotCardArt
                    card={selected}
                    active
                  />
                </motion.div>

                <h2
                  className="mt-5 text-xl"
                  style={{
                    fontFamily: serif,
                    color: colors.text,
                  }}
                >
                  {selected.nameKo}
                </h2>

                <p
                  className="mt-1 text-[11px] tracking-[.18em]"
                  style={{
                    color: colors.textFaint,
                  }}
                >
                  {selected.nameEn}
                </p>

                <div
                  className="mt-4 rounded-2xl p-4 text-left"
                  style={{
                    background:
                      colors.surface,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div
                    className="flex items-center gap-2 text-sm"
                    style={{
                      color: "#e4cb8f",
                    }}
                  >
                    <MoonStar size={15} />
                    오늘 밤 탐색에 반영할 맥락
                  </div>

                  <p
                    className="mt-2 text-sm leading-6"
                    style={{
                      color: colors.textMuted,
                    }}
                  >
                    <b
                      style={{
                        color: colors.text,
                      }}
                    >
                      {purpose}
                    </b>{" "}
                    목적과 오늘의 카드에서 시작된 대화를
                    함께 참고해, 당신이 잠든 사이 AI가
                    공개 동의된 정보 안에서 어울릴 사람과
                    추천 이유를 준비합니다.
                  </p>
                </div>
              </motion.section>
            )}
        </AnimatePresence>

        <div
          className="mt-5 flex items-start gap-2.5 rounded-2xl p-3.5"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <ShieldCheck
            size={15}
            color={colors.textFaint}
            className="mt-0.5 shrink-0"
          />

          <p
            style={{
              color: colors.textFaint,
              fontSize: 11.5,
              lineHeight: 1.55,
            }}
          >
            카드는 미래를 확정하거나 사람을 단독 판정하지
            않아요. 결과는 참고로만 봐주세요.
          </p>
        </div>
      </div>

      <div
        className="relative z-10 flex flex-col gap-3 px-6 py-5"
        style={{
          borderTop: `1px solid ${colors.border}`,
          background:
            "rgba(15,15,20,.88)",
          backdropFilter: "blur(18px)",
        }}
      >
        {phase === "reveal" && (
          <PrimaryButton onClick={onNext}>
            카드 이야기 듣기
          </PrimaryButton>
        )}

        {phase !== "reveal" &&
          onSwitchToSaju && (
            <button
              type="button"
              onClick={onSwitchToSaju}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm"
              style={{
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
              }}
            >
              <Star size={14} />
              사주로 시작할래요
            </button>
          )}
      </div>
    </div>
  );
}