import type { CSSProperties } from "react";

// 사주·타로 시작 화면 그림(2026-10-06 대표 지정). 390px 폰 기준 한 화면 안에 글·버튼이 함께 보이도록 높이를 제한한다.
export const startArtStyle: CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 300,
  aspectRatio: "5 / 4",
  objectFit: "cover",
  objectPosition: "center 40%",
  margin: "0 auto 18px",
  borderRadius: 24,
  boxShadow: "0 12px 32px rgba(0,0,0,.18)",
};
