import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Moon, ServerCog, Loader2, Check } from "lucide-react";
import { colors, serif } from "../theme";
import { PrimaryButton } from "../components/PrimaryButton";

interface Props {
  purpose?: string;
  onLaunched: () => void;
  onStop?: () => void;
}

type Phase = "ready" | "launching";

const COMPARE_LENS = [
  "연결 목적",
  "사주 궁합",
  "가치관",
  "성격과 대화 성향",
  "생활패턴",
  "연락 성향",
  "관심사",
  "거리와 가능한 시간",
  "필수 조건",
  "기존 선택·거절 기록",
  "본인·사진·프로필 확인 상태",
  "신고·차단·안전 상태",
];

function StarOrb() {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 120, height: 120 }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 5,
            height: 5,
            backgroundColor: "rgba(255,255,255,0.5)",
            top: "50%",
            left: -2.5,
            marginTop: -2.5,
          }}
        />
      </motion.div>

      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="absolute rounded-full"
        style={{
          width: 90,
          height: 90,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      />

      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: 64,
          height: 64,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <Moon size={26} color="rgba(255,255,255,0.85)" />
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div
      className="w-full rounded-2xl p-4 text-left"
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
          marginBottom: 10,
        }}
      >
        {title}
      </p>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-2">
            <Check
              size={13}
              color={colors.textMuted}
              className="mt-0.5 shrink-0"
            />
            <span
              style={{
                color: colors.textMuted,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 잠들기 전 자동 탐색 시작.
// 시연 화면이며 실제 탐색에는 서버 연동이 필요하다.
export function AutoSearchLaunch({
  purpose,
  onLaunched,
  onStop,
}: Props) {
  const [phase, setPhase] = useState<Phase>("ready");

  function handleLaunch() {
    if (phase === "launching") return;

    setPhase("launching");
    setTimeout(() => onLaunched(), 1400);
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        backgroundColor: colors.bg,
        background:
          `radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), ${colors.bg}`,
      }}
    >
      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-4 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col items-center gap-7 w-full"
        >
          <StarOrb />

          <div>
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
                fontSize: 28,
                lineHeight: 1.25,
                color: colors.text,
                marginBottom: 14,
              }}
            >
              오늘 밤, AI가 먼저 찾아볼까요?
            </h1>

            <p
              style={{
                color: colors.textMuted,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              내가 고른 목적과 공개에 동의한 정보만 비교해, 아침에 이유와
              함께 어울리는 사람을 준비합니다.
            </p>
          </div>

          {purpose && (
            <div
              className="w-full rounded-2xl p-4 text-left flex items-center gap-2.5"
              style={{
                backgroundColor: colors.accentSoft,
                border: `1px solid ${colors.borderStrong}`,
              }}
            >
              <span
                style={{
                  color: colors.textFaint,
                  fontSize: 12,
                }}
              >
                내가 선택한 목적
              </span>

              <span
                style={{
                  color: colors.text,
                  fontSize: 14,
                  marginLeft: "auto",
                  fontFamily: serif,
                }}
              >
                {purpose}
              </span>
            </div>
          )}

          <InfoBlock
            title="AI가 함께 살펴보는 정보"
            items={COMPARE_LENS}
          />

          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-2.5 text-left"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div className="flex items-start gap-2.5">
              <Check
                size={14}
                color={colors.textMuted}
                className="mt-0.5 shrink-0"
              />
              <p
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                AI가 나인 척 상대와 몰래 대화하지 않아요.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <Check
                size={14}
                color={colors.textMuted}
                className="mt-0.5 shrink-0"
              />
              <p
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                서로 공개에 동의한 정보만 비교해요.
              </p>
            </div>
          </div>

          <div
            className="w-full rounded-2xl p-4 flex items-start gap-2.5 text-left"
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
                lineHeight: 1.55,
              }}
            >
              서버 연동 필요 · 실제 탐색·후보 준비는 서버 연동 이후
              작동하고, 원하면 언제든 탐색을 멈출 수 있어요.
            </p>
          </div>
        </motion.div>
      </div>

      <div
        className="px-6 py-6 shrink-0 flex flex-col gap-2.5"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        <AnimatePresence mode="wait">
          {phase === "launching" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-[52px] flex items-center justify-center gap-2"
            >
              <Loader2
                size={18}
                color={colors.textMuted}
                className="animate-spin"
              />
              <span
                style={{
                  color: colors.textMuted,
                  fontSize: 14,
                }}
              >
                탐색을 준비하고 있어요…
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <PrimaryButton onClick={handleLaunch}>
                오늘 밤 탐색 시작하기
              </PrimaryButton>
            </motion.div>
          )}
        </AnimatePresence>

        {onStop && phase === "ready" && (
          <PrimaryButton variant="ghost" onClick={onStop}>
            탐색하지 않을게요
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}