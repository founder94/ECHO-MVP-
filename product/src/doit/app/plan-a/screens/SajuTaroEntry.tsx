import {
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import { Sparkles, Star } from "lucide-react";
import { colors, serif } from "../theme";

interface Props {
  onSaju: () => void;
  onTaro: () => void;
}

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 32 }, (_, index) => ({
        id: index,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.8,
        delay: Math.random() * 3,
        duration: Math.random() * 2 + 2,
      })),
    [],
  );

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        opacity: 0.55,
      }}
      aria-hidden="true"
    >
      {stars.map((star) => (
        <circle
          key={star.id}
          cx={`${star.x}%`}
          cy={`${star.y}%`}
          r={star.size}
          fill="white"
          style={{
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
          className="animate-pulse"
        />
      ))}
    </svg>
  );
}

function PathCard({
  label,
  eyebrow,
  description,
  symbol,
  delay,
  onClick,
}: {
  label: string;
  eyebrow: string;
  description: string;
  symbol: ReactNode;
  delay: number;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      initial={{
        opacity: 0,
        y: 24,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      className="relative w-full text-left rounded-3xl overflow-hidden flex flex-col"
      style={{
        padding: "28px 24px 24px",
        backgroundColor: pressed
          ? "#12151c"
          : colors.surface,
        border: `1px solid ${
          pressed
            ? "rgba(255,255,255,0.18)"
            : colors.border
        }`,
        transform: pressed
          ? "scale(0.985)"
          : "scale(1)",
        transition:
          "transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease",
        minHeight: 200,
      }}
    >
      <div
        className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(255,255,255,0.06) 0%, transparent 70%)",
        }}
      />

      <div
        className="flex items-center justify-center rounded-2xl mb-5"
        style={{
          width: 52,
          height: 52,
          backgroundColor: colors.accentSoft,
          border: `1px solid ${colors.borderStrong}`,
        }}
      >
        {symbol}
      </div>

      <p
        style={{
          color: colors.textFaint,
          fontSize: 11,
          letterSpacing: "0.18em",
          marginBottom: 6,
        }}
      >
        {eyebrow}
      </p>

      <p
        style={{
          fontFamily: serif,
          fontSize: 22,
          color: colors.text,
          lineHeight: 1.2,
          marginBottom: 10,
        }}
      >
        {label}
      </p>

      <p
        style={{
          color: colors.textMuted,
          fontSize: 13.5,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      <div
        className="mt-auto pt-5 flex items-center gap-1.5"
        style={{
          color: colors.textMuted,
          fontSize: 12.5,
        }}
      >
        <span>시작하기</span>
        <span style={{ fontSize: 14 }}>→</span>
      </div>
    </motion.button>
  );
}

export function SajuTaroEntry({
  onSaju,
  onTaro,
}: Props) {
  return (
    <div
      className="relative flex flex-col min-h-screen"
      style={{
        backgroundColor: colors.bg,
      }}
    >
      <StarField />

      <div className="relative z-10 flex flex-col flex-1 px-6">
        <motion.div
          initial={{
            opacity: 0,
            y: -12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
          className="pt-16 pb-8"
        >
          <p
            style={{
              color: colors.textFaint,
              fontSize: 11,
              letterSpacing: "0.22em",
              marginBottom: 14,
            }}
          >
            DO IT — PLAN A
          </p>

          <h1
            style={{
              fontFamily: serif,
              fontSize: 32,
              lineHeight: 1.2,
              color: colors.text,
              marginBottom: 12,
            }}
          >
            오늘의 나를
            <br />
            먼저 만나볼까요?
          </h1>

          <p
            style={{
              color: colors.textMuted,
              fontSize: 14.5,
              lineHeight: 1.7,
            }}
          >
            부담 없이 사주 또는 타로를 골라보세요. 기본
            결과는 무료이며, 사람 연결은 나중에 직접 선택할
            수 있어요.
          </p>
        </motion.div>

        <div className="flex flex-col gap-4 flex-1">
          <PathCard
            eyebrow="FREE · 사주"
            label="무료 사주"
            description="태어난 시간을 바탕으로 지금의 흐름을 살펴봐요."
            symbol={
              <Star
                size={22}
                color={colors.accent}
              />
            }
            delay={0.15}
            onClick={onSaju}
          />

          <PathCard
            eyebrow="FREE · 타로"
            label="무료 타로"
            description="지금 마음에 가장 가까운 카드를 골라봐요."
            symbol={
              <Sparkles
                size={22}
                color={colors.accent}
              />
            }
            delay={0.28}
            onClick={onTaro}
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center py-8"
          style={{
            color: colors.textFaint,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          사주·타로만 보고 종료해도 괜찮아요.
        </motion.p>
      </div>
    </div>
  );
}