import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Moon, ServerCog, Sparkles } from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";

interface Props {
  onMorning: () => void;
  onStop?: () => void;
}

// 밤사이 분석 전환 화면.
// 후보 수·진행률·퍼센트·완료 시간·순위는 표시하지 않는다.
// 실제 분석에는 서버 연동이 필요하다.
export function NightAnalyzing({
  onMorning,
  onStop,
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: colors.bg,
        background:
          `radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.05) 0%, transparent 55%), ${colors.bg}`,
      }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-14 pb-4 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-7 flex h-52 w-52 items-center justify-center">
            <motion.div
              className="absolute inset-2 rounded-full border"
              style={{ borderColor: "rgba(234,212,158,.16)" }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {[0, 1, 2, 3].map((item) => (
                <motion.span
                  key={item}
                  className="absolute h-2.5 w-2.5 rounded-full"
                  style={{
                    left: item % 2 === 0 ? "8%" : "88%",
                    top: item < 2 ? "18%" : "78%",
                    background:
                      item === 0
                        ? "#ead49e"
                        : "rgba(255,255,255,.58)",
                    boxShadow:
                      "0 0 18px rgba(234,212,158,.42)",
                  }}
                  animate={{
                    scale: [0.7, 1.35, 0.7],
                    opacity: [0.35, 1, 0.35],
                  }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    delay: item * 0.42,
                  }}
                />
              ))}
            </motion.div>

            <motion.div
              className="absolute inset-8 rounded-full border border-dashed"
              style={{
                borderColor: "rgba(255,255,255,.13)",
              }}
              animate={{ rotate: -360 }}
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: "linear",
              }}
            />

            <motion.div
              animate={{
                opacity: [0.55, 1, 0.55],
                scale: [1, 1.06, 1],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: 88,
                height: 88,
                background:
                  "radial-gradient(circle, rgba(234,212,158,.18) 0%, rgba(255,255,255,0.03) 70%)",
                border:
                  "1px solid rgba(234,212,158,.28)",
                boxShadow:
                  "0 0 54px rgba(210,176,109,.13)",
              }}
            >
              <Moon size={32} color="#ead49e" />
            </motion.div>

            <motion.div
              className="absolute right-4 top-6"
              animate={{
                opacity: [0.2, 1, 0.2],
                rotate: [0, 18, 0],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
              }}
            >
              <Sparkles
                size={18}
                color="rgba(234,212,158,.75)"
              />
            </motion.div>
          </div>

          <p
            style={{
              color: colors.textFaint,
              fontSize: 11,
              letterSpacing: "0.2em",
              marginBottom: 12,
            }}
          >
            준비 중 · 서버 연동 필요
          </p>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 26,
              lineHeight: 1.3,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            AI가 밤사이 인연을
            <br />
            살펴보고 있어요
          </h1>

          <p
            style={{
              color: colors.textMuted,
              fontSize: 14,
              lineHeight: 1.7,
              maxWidth: 320,
            }}
          >
            목적과 대화, 생활과 안전 정보를 함께 비교해 추천 이유를
            정리합니다.
          </p>

          <p
            style={{
              color: colors.textFaint,
              fontSize: 13,
              lineHeight: 1.7,
              marginTop: 14,
            }}
          >
            앱을 닫아도 괜찮아요. 아침에 다시 확인할 수 있어요.
          </p>
        </motion.div>

        <div
          className="mt-8 w-full rounded-2xl p-4 flex items-start gap-2.5 text-left"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <ServerCog
            size={14}
            color={colors.textFaint}
            className="mt-0.5 shrink-0"
          />
          <p
            style={{
              color: colors.textFaint,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            실제 분석 방식·판정 기준·후보 준비는 서버 연동 이후에
            정해져요. 여기서 점수나 순위, 진행률을 사실로 보여주지
            않아요.
          </p>
        </div>
      </div>

      <div
        className="px-6 pt-4 pb-6 shrink-0 flex flex-col gap-2.5"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        <PrimaryButton
          onClick={onMorning}
          disabled={!ready}
        >
          {ready
            ? "아침 결과 보기"
            : "살펴보는 중이에요…"}
        </PrimaryButton>

        {onStop && (
          <PrimaryButton
            variant="ghost"
            onClick={onStop}
          >
            탐색 중단하기
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}