import type { FlowCell, TenGod, TwelveStage } from "./engine";

// 2026-10-10 대표 「사주 예시처럼 후킹박고 자세하게 설명」: 사주 결과 칸을 사람 말로 읽어 주는 규칙 문장(AI 0 · 정해진 일을 알려 주지 않음).

// 전통 오행 색(나무=초록 · 불=빨강 · 흙=노랑 · 쇠=흰빛 · 물=검정) — SajuResult 의 EL_TILE 과 같은 값
export const EL_COLOR: Record<string, { bg: string; fg: string; name: string }> = {
  wood: { bg: "#3f8f6b", fg: "#fff", name: "나무" },
  fire: { bg: "#e2574c", fg: "#fff", name: "불" },
  earth: { bg: "#e8b545", fg: "#2b2310", name: "흙" },
  metal: { bg: "#eef0f2", fg: "#20242a", name: "쇠" },
  water: { bg: "#23262b", fg: "#fff", name: "물" },
};

/** 12운성 한 줄 뜻 — 사람의 한 살이에 빗댄 이름(정해진 일을 알려 주지 않음) */
export const STAGE_MEANING: Record<TwelveStage, string> = {
  장생: "막 태어나 새로 시작하는 힘",
  목욕: "처음 바깥을 배우며 흔들리는 때",
  관대: "차려입고 세상에 나서는 때",
  건록: "제 힘으로 서서 일하는 때",
  제왕: "기운이 가장 차오른 때",
  쇠: "힘을 고르게 나눠 쓰는 때",
  병: "속도를 늦추고 돌보는 때",
  사: "하나를 마무리하는 때",
  묘: "거두어 갈무리하는 때",
  절: "끊고 새로 바꾸는 때",
  태: "새 씨앗이 생기는 때",
  양: "품고 기르는 때",
};

/** 십신 한 줄 뜻 */
export const GOD_MEANING: Record<TenGod, string> = {
  비견: "나와 같은 결 · 친구·동료",
  겁재: "나와 닮은 경쟁 · 나눔",
  식신: "내가 만들고 즐기는 것",
  상관: "드러내고 표현하는 힘",
  편재: "넓게 오가는 재물·기회",
  정재: "차곡차곡 모으는 재물",
  편관: "밀어붙이는 책임·도전",
  정관: "질서·약속·명예",
  편인: "남다른 배움·직감",
  정인: "돌봄·배움·든든한 뒷받침",
};

/** 칸 하나를 사람 말로 — 「이 시기 = 십신 뜻 + 12운성 뜻」 */
export function cellLine(c: FlowCell, what: string): string {
  return `${what} ${c.pillar.hangul}(${c.pillar.hanja}) — 하늘 글자는 나에게 「${c.stemGod}」(${GOD_MEANING[c.stemGod]}), 땅 글자는 「${c.branchGod}」(${GOD_MEANING[c.branchGod]}) 자리예요. 기운의 단계는 「${c.stage}」, ${STAGE_MEANING[c.stage]}에 빗대요.`;
}
