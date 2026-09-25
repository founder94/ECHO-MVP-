import type { CSSProperties } from 'react';
import type { TarotCard } from '@/doit/app/plan-a/tarotDeck';

// 타로 원화 스프라이트 시트(78장). 기존 plan-a 원화 URL을 그대로 재사용.
// 새 이미지를 임의 생성·교체하지 않는다.
export const SHEET_URLS: Record<string, string> = {
  majorA:
    'https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/6313df40-2ad8-4c3b-997f-8f7e7af9b9d5_compressed_tarot-major-0-10.webp',
  majorB:
    'https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/03cb025b-e2b3-4ba3-86bd-0b6c8367e6f9_compressed_tarot-major-11-21.webp',
  wands:
    'https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/33a15caa-0a03-4ce5-a7af-8330d4898d25_compressed_tarot-wands.webp',
  cups:
    'https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/b5b5298b-f389-4b3a-b050-84b52ca812e9_compressed_tarot-cups.webp',
  swords:
    'https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/e3636873-6b5f-4349-9d71-1d30b53027e6_compressed_tarot-swords.webp',
  pentacles:
    'https://storage.helloreaddy.io/project_files/5373f95c-3561-4ff8-be0c-c1fc7b33ff2e/235261f6-9be6-4f56-866d-b71403d4a1ca_compressed_tarot-pentacles.webp',
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