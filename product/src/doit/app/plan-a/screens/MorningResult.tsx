import { motion } from "motion/react";
import {
  Sunrise,
  Shield,
  Info,
  ChevronRight,
} from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";

interface Props {
  onEnterSpace: () => void;
  onBack: () => void;
}

// 자동 탐색 결과 화면.
// 아직 서버 연동 전이므로 가짜 후보를 실제 결과처럼 보여주지 않고
// "준비 중" 안내를 명확히 표시한다.
export function MorningResult({
  onEnterSpace,
  onBack,
}: Props) {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: colors.bg,
      }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-11 pb-4">
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
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sunrise
              size={16}
              color={colors.accent}
            />
            <span
              style={{
                color: colors.textFaint,
                fontSize: 11,
                letterSpacing: "0.18em",
              }}
            >
              GOOD MORNING · 준비 중
            </span>
          </div>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 26,
              lineHeight: 1.3,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            좋은 아침이에요.
          </h1>

          <p
            style={{
              color: colors.textMuted,
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            이유 있는 인연을 아침에 전해드릴 준비를 하고
            있어요.
          </p>
        </motion.div>

        {/* 준비 중 안내 */}
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
            delay: 0.15,
            duration: 0.5,
          }}
          className="rounded-3xl p-6 flex flex-col items-center text-center gap-4"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <Sunrise size={26} color={colors.accent} />
          </div>

          <div>
            <p
              style={{
                fontFamily: serif,
                fontSize: 19,
                color: colors.text,
              }}
            >
              준비 중
            </p>

            <p
              style={{
                color: colors.textMuted,
                fontSize: 13.5,
                lineHeight: 1.65,
                marginTop: 6,
                maxWidth: 300,
              }}
            >
              자동 탐색과 후보 추천은 아직 준비 중이에요.
              실제 서버 연동이 완료되면, 내가 공개에 동의한
              정보를 바탕으로 이유 있는 인연을 정리해 아침에
              보여드릴게요.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 rounded-2xl p-4 flex items-start gap-2.5"
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Shield
            size={14}
            color={colors.textFaint}
            className="mt-0.5 shrink-0"
          />
          <p
            style={{
              color: colors.textFaint,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            지금은 결과 대신 기능 안내만 표시돼요. 후보 추천은
            아직 준비 중이며, 실제 서버 연동이 완료되면 확인
            상태와 함께 이유를 설명해 드릴게요.
          </p>
        </motion.div>

        <div className="mt-4 flex items-center gap-1.5 justify-center">
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
            상대의 실명·연락처는 관계가 열리기 전까지
            공개되지 않아요
          </span>
        </div>
      </div>

      <div
        className="px-6 pt-4 pb-6 flex flex-col gap-3"
        style={{
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <PrimaryButton onClick={onEnterSpace}>
          <span className="flex items-center gap-1.5">
            홈으로 이동하기
            <ChevronRight size={16} />
          </span>
        </PrimaryButton>

        <PrimaryButton
          variant="ghost"
          onClick={onBack}
        >
          이전 화면으로
        </PrimaryButton>
      </div>
    </div>
  );
}