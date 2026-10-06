import type { CSSProperties } from 'react';
import type { TarotCard } from '@/doit/app/plan-a/tarotDeck';

// 타로 원화 스프라이트 시트(78장). 기존 plan-a 원화 URL을 그대로 재사용.
// 새 이미지를 임의 생성·교체하지 않는다.
export const SHEET_URLS: Record<string, string> = {
  // 2026-10-06 대표 「그림 복사해」: 원화 6장을 저장소(public/doit/tarot)로 옮김. 외부 서버(Readdy) 의존 0.
  majorA: '/doit/tarot/tarot-major-0-10.webp',
  majorB: '/doit/tarot/tarot-major-11-21.webp',
  wands: '/doit/tarot/tarot-wands.webp',
  cups: '/doit/tarot/tarot-cups.webp',
  swords: '/doit/tarot/tarot-swords.webp',
  pentacles: '/doit/tarot/tarot-pentacles.webp',
};

// 스프라이트 시트에서 카드 한 장의 영역을 계산한다.
export function spriteStyle(card: TarotCard): CSSProperties {
  const { col, row, cols, rows } = card;
  const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return {
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
  };
}

export const SERIF = '"Noto Serif KR", "Nanum Myeongjo", Georgia, serif';

// 다크 스페이스 배경(이미지 아님, CSS 그라디언트). 별 + 골드 은은한 글로우.
export const SPACE_BG: CSSProperties = {
  background:
    'radial-gradient(circle at 50% -10%, rgba(201,162,75,0.16) 0%, transparent 46%), radial-gradient(circle at 85% 20%, rgba(201,162,75,0.08) 0%, transparent 40%), #0A0B0F',
};