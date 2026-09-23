/* eslint-disable react-refresh/only-export-components -- 화면 보조 조각(상수+컴포넌트) 한 파일 유지. 동작 영향 없음 */
import { motion } from "motion/react";
import { colors, serif } from "../theme";
import { TAROT_DECK } from "../tarotDeck";

// FreeResult 화면의 보조 조각들. 파일 길이 제한(레디 20,000자)으로 FreeResult.tsx 에서 분리했다.
// 내용·동작은 원본과 같다(2026-09-05 A·B 통합).

export const dayKey = () =>
  new Date().toLocaleDateString("sv-SE");

export function readSelectedCard(): {
  card: (typeof TAROT_DECK)[number];
  purpose: string;
} | null {
  try {
    const raw = localStorage.getItem(
      `echo-tarot-daily:${dayKey()}`,
    );

    if (!raw) {
      return null;
    }

    const saved = JSON.parse(raw) as {
      cardId: string;
      purpose: string;
    };

    const card = TAROT_DECK.find(
      (item) => item.id === saved.cardId,
    );

    if (!card) {
      return null;
    }

    return {
      card,
      purpose: saved.purpose || "",
    };
  } catch {
    return null;
  }
}

export const SAJU_PILLARS = [
  {
    label: "시주",
    top: "時",
    bottom: "支",
    note: "출생시간 기준",
  },
  {
    label: "일주",
    top: "日",
    bottom: "支",
    note: "나를 보는 중심",
  },
  {
    label: "월주",
    top: "月",
    bottom: "支",
    note: "계절과 환경",
  },
  {
    label: "년주",
    top: "年",
    bottom: "支",
    note: "태어난 해",
  },
];

export const FIVE_ELEMENTS = [
  {
    name: "목",
    color: "#69966e",
  },
  {
    name: "화",
    color: "#c86f59",
  },
  {
    name: "토",
    color: "#b89861",
  },
  {
    name: "금",
    color: "#b9b6aa",
  },
  {
    name: "수",
    color: "#6686a8",
  },
];

export function ResultCard({
  label,
  value,
  delay,
}: {
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay,
        duration: 0.4,
      }}
      className="rounded-2xl p-4"
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
      }}
    >
      <p
        style={{
          color: colors.textFaint,
          fontSize: 11,
          letterSpacing: "0.1em",
          marginBottom: 6,
        }}
      >
        {label}
      </p>

      <p
        style={{
          color: colors.text,
          fontSize: 14.5,
          lineHeight: 1.55,
        }}
      >
        {value}
      </p>
    </motion.div>
  );
}

// 사주 명식 예시 구역(준비 중 표시). FreeResult 에서 분리 — 동작·문구 동일.
export function SajuPreviewSection() {
  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 12,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: 0.17,
      }}
      className="mb-6 rounded-3xl p-5"
      style={{
        backgroundColor:
          colors.surface,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center justify-between">
        <p
          style={{
            fontFamily: serif,
            color: colors.text,
            fontSize: 16,
          }}
        >
          나의 기본 명식 (예시 · 준비 중)
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {SAJU_PILLARS.map(
          (pillar) => (
            <div
              key={pillar.label}
              className="text-center"
            >
              <p
                style={{
                  color:
                    colors.textFaint,
                  fontSize: 10,
                }}
              >
                {pillar.label}
              </p>

              <div
                className="mt-2 overflow-hidden rounded-xl"
                style={{
                  border: `1px solid ${colors.borderStrong}`,
                }}
              >
                <div
                  className="flex h-12 items-center justify-center text-lg"
                  style={{
                    background:
                      "rgba(105,150,110,.16)",
                    color: "#d9e4d5",
                    fontFamily:
                      serif,
                  }}
                >
                  {pillar.top}
                </div>

                <div
                  className="flex h-12 items-center justify-center text-lg"
                  style={{
                    background:
                      "rgba(102,134,168,.16)",
                    color: "#d6dfeb",
                    fontFamily:
                      serif,
                  }}
                >
                  {pillar.bottom}
                </div>
              </div>

              <p
                className="mt-2 leading-4"
                style={{
                  color:
                    colors.textFaint,
                  fontSize: 9,
                }}
              >
                {pillar.note}
              </p>
            </div>
          ),
        )}
      </div>

      <div className="mt-5">
        <p
          style={{
            color: colors.textMuted,
            fontSize: 12,
          }}
        >
          오행은 많고 적음의 점수가 아니라 서로 돕는
          흐름으로 읽어요.
        </p>

        <div className="mt-3 flex gap-2">
          {FIVE_ELEMENTS.map(
            (element) => (
              <div
                key={element.name}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <span
                  className="h-8 w-8 rounded-full"
                  style={{
                    background:
                      element.color,
                    boxShadow: `0 0 18px ${element.color}33`,
                  }}
                />

                <span
                  style={{
                    color:
                      colors.textFaint,
                    fontSize: 10,
                  }}
                >
                  {element.name}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <p
        className="mt-4 text-[11px] leading-5"
        style={{
          color: colors.textFaint,
        }}
      >
        사주 명식은 아직 준비 중입니다. 실제 천간·지지·오행
        산출은 사주 엔진 연동 후 제공되며, 지금 보이는
        구조는 예시입니다.
      </p>
    </motion.section>
  );
}