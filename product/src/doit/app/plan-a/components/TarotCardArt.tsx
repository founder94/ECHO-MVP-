/* eslint-disable react-refresh/only-export-components -- A 구조 원본 구조 유지(컴포넌트+훅 같은 파일). 동작 영향 없음 */
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import type { TarotCard } from "../tarotDeck";

// =============================================================
// 타로 원화 스프라이트 시트(78장) — 저장소 보관(public/doit/tarot, WebP 6장).
//   majorA(0~10)·majorB(11~21): 4x3 그리드 / wands·cups·swords·pentacles(14장): 5x3 그리드
//   각 카드 좌표는 tarotDeck.ts의 TarotCard(row, col, cols, rows)가 기준.
// =============================================================

const SHEET_URLS: Record<string, string> = {
  // 2026-10-06 대표 「그림 복사해」: 원화 6장을 저장소(public/doit/tarot)로 옮김. 외부 서버(Readdy) 의존 0.
  majorA: "/doit/tarot/tarot-major-0-10.webp",
  majorB: "/doit/tarot/tarot-major-11-21.webp",
  wands: "/doit/tarot/tarot-wands.webp",
  cups: "/doit/tarot/tarot-cups.webp",
  swords: "/doit/tarot/tarot-swords.webp",
  pentacles: "/doit/tarot/tarot-pentacles.webp",
};

const SERIF =
  '"Noto Serif KR", "Nanum Myeongjo", Georgia, serif';

// 스프라이트 시트에서 카드 한 장의 영역을 계산하는 준비된 헬퍼.
// cols/rows는 해당 시트의 그리드 크기, col/row는 카드의 좌표(0-based).
export function spriteStyle(card: TarotCard): CSSProperties {
  const { col, row, cols, rows } = card;
  const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return {
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
  };
}

function suitLabel(sheet: TarotCard["sheet"]) {
  if (sheet === "majorA" || sheet === "majorB") {
    return "MAJOR ARCANA";
  }

  if (sheet === "wands") return "WANDS";
  if (sheet === "cups") return "CUPS";
  if (sheet === "swords") return "SWORDS";
  return "PENTACLES";
}

export function TarotCardBack({
  index = 0,
}: {
  index?: number;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] border border-[#d9bb72]/70 bg-[#121a38]">
      <div className="absolute inset-[7%] rounded-[9%] border border-[#d9bb72]/45" />
      <div className="absolute inset-[13%] rounded-[9%] border border-[#d9bb72]/25" />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 50%, #e7cb7b 0 2px, transparent 3px), conic-gradient(from 45deg at 50% 50%, transparent 0 12.5%, rgba(231,203,123,.26) 12.5% 25%, transparent 25% 37.5%, rgba(231,203,123,.26) 37.5% 50%, transparent 50% 62.5%, rgba(231,203,123,.26) 62.5% 75%, transparent 75% 87.5%, rgba(231,203,123,.26) 87.5%)",
          backgroundSize: "28px 28px, 100% 100%",
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#f0d894]/70 shadow-[0_0_22px_rgba(222,190,108,.3)]" />
      <span className="absolute bottom-2 right-2 text-[8px] text-[#e7cb7b]/30">
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}

export function TarotCardArt({
  card,
  active = false,
}: {
  card: TarotCard;
  active?: boolean;
}) {
  const sheetUrl = SHEET_URLS[card.sheet];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[#e8ddbd]">
      {/* 실제 타로 카드 원화 (스프라이트 시트) */}
      {sheetUrl && (
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url(${sheetUrl})`,
            ...spriteStyle(card),
          }}
        />
      )}

      {/* 내부 장식 프레임 */}
      <div className="pointer-events-none absolute inset-[5%] rounded-[8%] border border-[#a8863f]/45" />
      <div className="pointer-events-none absolute inset-[9%] rounded-[8%] border border-[#a8863f]/25" />

      {/* 질감 오버레이 */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-[.1]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #4e3014 0 1px, transparent 1.4px)",
          backgroundSize: "11px 13px",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: active
            ? "inset 0 0 0 2px #ffeeb0, inset 0 0 24px rgba(255,209,87,.2)"
            : "inset 0 0 0 1px rgba(72,49,20,.3)",
        }}
      />

      {active && (
        <motion.div
          className="pointer-events-none absolute -inset-y-[20%] -left-[55%] w-[42%] rotate-12"
          animate={{
            x: ["0%", "390%"],
            opacity: [0, 0.45, 0],
          }}
          transition={{
            duration: 1.35,
            repeat: Infinity,
            repeatDelay: 1.2,
          }}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,249,215,.72), transparent)",
            filter: "blur(3px)",
          }}
        />
      )}
    </div>
  );
}