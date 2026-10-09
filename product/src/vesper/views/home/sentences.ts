/** 승인 문장을 글자 하나 바꾸지 않고 문장 단위로만 나눈다(대표 승인 2026-10-09: 긴 문단은 짧게 나눠 읽기 쉽게). */
export const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
