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

// 2026-09-26 대표 「FINAL PRODUCT/AGENT IMPLEMENTATION DIRECTIVE」 §15: 타로에 들어오면 늘 새로 뽑는다(지난 카드 자동 노출 0).
// 지난 카드는 「지난 카드 보기」에서만(이 기기에만 · 보기 전용 · 다시 해석하지 않음). 오늘 키는 결과 화면이 방금 고른 카드를 읽는 데 쓴다.
const HISTORY_KEY = "echo-tarot-history";
const HISTORY_MAX = 20;
const SPREAD = 7; // 한 번에 펼치는 카드 뒷면 수(섞은 78장 중)
type Drawn = { cardId: string; purpose: string; at: string };
function readHistory(): Drawn[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const items: Drawn[] = Array.isArray(list)
      ? list.filter((x): x is Drawn => !!x && typeof x.cardId === "string" && typeof x.purpose === "string" && typeof x.at === "string")
      : [];
    // 예전 방식(하루 한 장 키)으로 오늘 뽑은 카드가 있으면 지난 카드에 함께 보인다.
    const today = JSON.parse(localStorage.getItem(`echo-tarot-daily:${dayKey()}`) || "null") as { cardId?: string; purpose?: string } | null;
    if (today?.cardId && !items.some((x) => x.cardId === today.cardId && x.at.startsWith(dayKey()))) items.unshift({ cardId: today.cardId, purpose: today.purpose ?? "", at: dayKey() });
    return items.slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

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
  const history = useMemo(() => readHistory(), []);

  const [purpose, setPurpose] = useState(
    history[0]?.purpose || "",
  );

  const [deck, setDeck] =
    useState<TarotCard[]>(() =>
      shuffled(),
    );

  const [phase, setPhase] = useState<
    "purpose" | "deck" | "reveal" | "history"
  >("purpose");

  const [selected, setSelected] =
    useState<TarotCard | null>(null);
  // 고르는 순간 그 카드만 떠오르는 선택 효과(0.45초) 뒤에 공개한다.
  const [picking, setPicking] = useState<string | null>(null);

  const choose = (card: TarotCard) => {
    if (picking) return;
    setPicking(card.id);
    window.setTimeout(() => {
      setSelected(card);
      setPhase("reveal");
      setPicking(null);
    }, 450);
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify({
          cardId: card.id,
          purpose,
        }),
      );
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify([{ cardId: card.id, purpose, at: new Date().toISOString() }, ...history].slice(0, HISTORY_MAX)),
      );
    } catch {
      /* 저장이 막힌 브라우저에서도 카드 공개는 그대로 */
    }
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
          FREE · 오늘의 타로
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
                  새 카드 뽑기
                </PrimaryButton>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPhase("history")}
                  className="mx-auto mt-3 flex h-11 items-center justify-center rounded-full px-5 text-sm"
                  style={{ color: colors.textMuted, border: `1px solid ${colors.border}` }}
                >
                  지난 카드 보기
                </button>
              )}
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
                섞은 카드 중 마음이
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
                78장을 섞어 {SPREAD}장을 펼쳤어요. 직접
                한 장을 골라 주세요.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-2.5 py-2">
                {deck.slice(0, SPREAD).map(
                  (card, index) => (
                    <motion.button
                      key={card.id}
                      type="button"
                      aria-label={`펼친 ${SPREAD}장 중 ${index + 1}번째 카드 고르기`}
                      onClick={() => choose(card)}
                      initial={{ opacity: 0, y: 18, rotate: (index - 3) * 2 }}
                      animate={
                        picking === card.id
                          ? { opacity: 1, y: -18, scale: 1.08, rotate: 0 }
                          : picking
                            ? { opacity: 0.35, y: 0, scale: 0.96, rotate: (index - 3) * 2 }
                            : { opacity: 1, y: 0, scale: 1, rotate: (index - 3) * 2 }
                      }
                      transition={{ delay: picking ? 0 : index * 0.05, duration: 0.35 }}
                      whileHover={picking ? undefined : { y: -8 }}
                      whileTap={picking ? undefined : { scale: 0.96 }}
                      className="h-[150px] w-[98px] shrink-0 rounded-[12px] p-[2px]"
                      style={{
                        background:
                          "linear-gradient(145deg,#eed99f,#725b30,#eed99f)",
                        boxShadow:
                          picking === card.id
                            ? "0 22px 44px rgba(0,0,0,.55),0 0 34px rgba(238,217,159,.45)"
                            : "0 14px 30px rgba(0,0,0,.5)",
                      }}
                    >
                      <TarotCardBack index={index} />
                    </motion.button>
                  ),
                )}
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
                다시 섞어 펼치기
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
                  방금 당신이 고른 카드
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
                    이 카드는 참고예요
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
                    목적으로 고른 카드예요. 카드는 당신을
                    정하지 않아요. ECHO와 이어서 이야기하면
                    당신이 직접 한 말만 기억하고, 카드 결과는
                    연결에 쓰지 않아요.
                  </p>
                </div>
              </motion.section>
            )}
          {phase === "history" && (
            <motion.section key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 style={{ fontFamily: serif, fontSize: 27, lineHeight: 1.28, color: colors.text }}>지난 카드</h1>
              <p className="mt-2 text-sm leading-6" style={{ color: colors.textMuted }}>
                이 기기에서 뽑은 카드예요. 보기만 할 수 있어요.
              </p>
              <ul className="mt-5 flex flex-col gap-2">
                {history.map((h) => {
                  const card = TAROT_DECK.find((c) => c.id === h.cardId);
                  if (!card) return null;
                  return (
                    <li key={`${h.cardId}-${h.at}`} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: colors.surface, border: `1px solid ${colors.border}` }}>
                      <div className="h-[72px] w-[47px] shrink-0 overflow-hidden rounded-[8px]">
                        <TarotCardArt card={card} />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-sm" style={{ color: colors.text }}>{card.nameKo}</p>
                        <p className="mt-0.5 text-xs" style={{ color: colors.textFaint }}>{h.at.slice(0, 10)}{h.purpose ? ` · ${h.purpose}` : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6">
                <PrimaryButton onClick={() => setPhase("purpose")}>새 카드 뽑기</PrimaryButton>
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