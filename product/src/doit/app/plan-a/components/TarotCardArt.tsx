/* eslint-disable react-refresh/only-export-components -- A 구조 원본 구조 유지(컴포넌트+훅 같은 파일). 동작 영향 없음 */
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import type { TarotCard } from "../tarotDeck";

// =============================================================
// 타로 원본 스프라이트 시트 복원 준비
// 현재 상태: "78장 데이터 완성 / 원화 연결 대기"
//   - 78장 식별·선택·하루 한 장 기록은 tarotDeck.ts로 정상 동작.
//   - 원본 6장 PNG가 아직 없어 카드 이름 플레이스홀더를 표시 중.
// 업로드할 파일(src/imports/):
//   tarot-major-0-10.png    (메이저 0~10, 4x3 그리드)
//   tarot-major-11-21.png   (메이저 11~21, 4x3 그리드)
//   tarot-wands.png         (완드 14장, 5x3 그리드)
//   tarot-cups.png          (컵 14장, 5x3 그리드)
//   tarot-swords.png        (소드 14장, 5x3 그리드)
//   tarot-pentacles.png     (펜타클 14장, 5x3 그리드)
// 파일 업로드 후 원화 연결 절차:
//   1) import majorA from "@/doit/imports/tarot-major-0-10.png"; (6장 모두)
//   2) const sheetUrlMap = { majorA, majorB, wands, cups, swords, pentacles };
//   3) TarotCardArt 본문에서 플레이스홀더 대신 아래처럼 렌더링:
//        <div
//          className="absolute inset-0 bg-cover bg-no-repeat"
//          style={{
//            backgroundImage: `url(${sheetUrlMap[card.sheet]})`,
//            ...spriteStyle(card),
//          }}
//        />
// 각 카드 좌표는 tarotDeck.ts의 TarotCard(row, col, cols, rows)가 기준입니다.
// =============================================================

const SHEET_URLS: Record<string, string> = {
  majorA:
    "https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/6313df40-2ad8-4c3b-997f-8f7e7af9b9d5_compressed_tarot-major-0-10.webp",
  majorB:
    "https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/03cb025b-e2b3-4ba3-86bd-0b6c8367e6f9_compressed_tarot-major-11-21.webp",
  wands:
    "https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/33a15caa-0a03-4ce5-a7af-8330d4898d25_compressed_tarot-wands.webp",
  cups:
    "https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/b5b5298b-f389-4b3a-b050-84b52ca812e9_compressed_tarot-cups.webp",
  swords:
    "https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/e3636873-6b5f-4349-9d71-1d30b53027e6_compressed_tarot-swords.webp",
  pentacles:
    "https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/235261f6-9be6-4f56-866d-b71403d4a1ca_compressed_tarot-pentacles.webp",
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