import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

// 확정 흐름 ①: 제공된 히어로 사진 + 기존 소개 순서 유지.
// 기존 버전(/do-it/hero)에서 쓰던 실제 히어로 이미지를 그대로 사용한다.
const HERO_IMAGE =
  "https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/bb9c1b4084985309d99ad7bd36d3e768.png";

export function LandingHero({
  onEnter,
  onHeroStart,
}: {
  onEnter: () => void;
  onHeroStart?: () => void;
}) {
  const heroCta = onHeroStart ?? onEnter;

  return (
    <div
      id="hero"
      className="relative w-full min-h-svh overflow-hidden"
      style={{ backgroundColor: "#0A0D14" }}
    >
      {/* 모바일 상단 히어로 이미지 영역 */}
      <div
        className="relative w-full md:hidden"
        style={{
          backgroundImage: `url(${HERO_IMAGE})`,
          backgroundSize: "155% auto",
          backgroundPosition: "50% 5%",
          backgroundRepeat: "no-repeat",
          height: "clamp(340px, 88vw, 410px)",
          overflow: "hidden",
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-[48%] bg-gradient-to-t from-[#0A0D14] via-[#0A0D14]/90 to-transparent pointer-events-none" />
      </div>

      {/* 데스크톱 전체 배경 이미지 */}
      <img
        src={HERO_IMAGE}
        alt=""
        loading="eager"
        decoding="async"
        className="hidden md:block absolute inset-0 w-full h-full object-cover"
        draggable={false}
        aria-hidden="true"
      />
      <div
        className="hidden md:block absolute inset-0 z-[1] bg-gradient-to-b from-black/30 via-black/50 to-black/85 pointer-events-none"
        aria-hidden="true"
      />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center px-5 pb-10 text-center md:absolute md:inset-0 md:justify-end md:px-8 md:pb-16">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="mb-4"
          style={{
            fontFamily: "'Do Hyeon', sans-serif",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#9CA3AF",
          }}
        >
          DO IT · ONLINE SERENDIPITY
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-white text-[clamp(27px,7.7vw,32px)] md:text-[37px]"
          style={{
            fontFamily: "'Do Hyeon', sans-serif",
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: "-0.03em",
            wordBreak: "keep-all",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          <span className="block">당신이 잠든 사이,</span>
          <span className="block">AI가 먼저 만나봅니다.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.8 }}
          className="mt-5 text-white/85 text-[clamp(13px,3.7vw,15px)] md:text-[16px]"
          style={{
            fontFamily: "'Do Hyeon', sans-serif",
            whiteSpace: "nowrap",
            wordBreak: "keep-all",
          }}
        >
          프로필보다, 함께한 행동을 봅니다.
        </motion.p>

        <motion.button
          type="button"
          onClick={heroCta}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-10 inline-flex w-full max-w-[480px] items-center justify-center gap-2 rounded-full whitespace-nowrap cursor-pointer md:w-[280px]"
          style={{
            height: 60,
            fontFamily: "'Do Hyeon', sans-serif",
            fontSize: 15,
            color: "#F5F3EF",
            background: "linear-gradient(180deg, #3C414D 0%, #363B47 100%)",
            border: "1px solid rgba(255,255,255,0.22)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.20), 0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          무료로 시작하기
          <ArrowRight size={18} />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-4"
          style={{
            fontFamily: "'Do Hyeon', sans-serif",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          DO IT · ECHO · 둘 다 — 원하는 방식을 골라요
        </motion.p>
      </div>
    </div>
  );
}