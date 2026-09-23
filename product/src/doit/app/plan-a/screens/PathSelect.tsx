import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, Users, Layers } from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";

// 확정 흐름 ②단계: DO IT만 / ECHO만 / 둘 다 선택.
// - DO IT만 · 둘 다  → A 구조 진입(목적 선택으로 계속)
// - ECHO만          → B 구조(ECHO) 홈으로 이동
// 7화면 자기이해·마음 날씨는 A 필수 진입에서 제외되므로 여기서 다루지 않는다.

export type PathChoice = "doit" | "echo" | "both";

interface Props {
  onDoit: (choice: PathChoice) => void;
  onEcho: () => void;
  onSkipToFortune?: () => void;
}

const OPTIONS: Array<{
  id: PathChoice;
  label: string;
  note: string;
  icon: typeof Users;
}> = [
  {
    id: "doit",
    label: "DO IT만 할게요",
    note: "함께한 행동으로 사람을 만나는 A 여정만 시작해요.",
    icon: Users,
  },
  {
    id: "echo",
    label: "ECHO만 할게요",
    note: "오늘의 나를 기록하는 ECHO만 이용해요.",
    icon: Sparkles,
  },
  {
    id: "both",
    label: "둘 다 할게요",
    note: "기록(ECHO)과 연결(DO IT)을 함께 이어가요.",
    icon: Layers,
  },
];

export function PathSelect({ onDoit, onEcho, onSkipToFortune }: Props) {
  const [selected, setSelected] = useState<PathChoice | null>(null);

  function handleContinue() {
    if (!selected) return;
    if (selected === "echo") {
      onEcho();
      return;
    }
    onDoit(selected);
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: colors.bg }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-14 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <p
            style={{
              color: colors.textFaint,
              fontSize: 11,
              letterSpacing: "0.2em",
              marginBottom: 12,
            }}
          >
            어떻게 시작할까요
          </p>
          <h1
            style={{
              fontFamily: serif,
              fontSize: 28,
              lineHeight: 1.28,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            무엇부터
            <br />
            함께해 볼까요?
          </h1>
          <p
            style={{
              color: colors.textMuted,
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            원하는 방식을 하나 고르세요. 언제든 나중에 바꿀 수 있어요.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt, index) => {
            const active = selected === opt.id;
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.4 }}
                onClick={() => setSelected(opt.id)}
                className="w-full rounded-3xl px-5 py-5 text-left"
                style={{
                  backgroundColor: active
                    ? colors.accentSoft
                    : colors.surface,
                  border: `1px solid ${
                    active ? colors.accent : colors.border
                  }`,
                  transition:
                    "background-color 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      width: 46,
                      height: 46,
                      backgroundColor: active
                        ? colors.accent
                        : colors.bg,
                      border: `1px solid ${colors.borderStrong}`,
                    }}
                  >
                    <Icon
                      size={20}
                      color={active ? colors.onAccent : colors.accent}
                    />
                  </div>
                  <div className="flex-1">
                    <p
                      style={{
                        fontFamily: serif,
                        fontSize: 17,
                        color: colors.text,
                        marginBottom: 4,
                      }}
                    >
                      {opt.label}
                    </p>
                    <p
                      style={{
                        color: colors.textMuted,
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {opt.note}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {onSkipToFortune && (
          <button
            type="button"
            onClick={onSkipToFortune}
            className="mt-6 flex w-full items-center justify-center gap-1.5"
            style={{
              color: colors.textFaint,
              fontSize: 13,
            }}
          >
            먼저 무료 사주·타로만 보고 싶어요
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div
        className="px-6 py-6"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        <PrimaryButton onClick={handleContinue} disabled={!selected}>
          이대로 시작하기
        </PrimaryButton>
      </div>
    </div>
  );
}