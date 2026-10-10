import { ELEMENT_KO, ELEMENT_ORDER, STEMS_KO, type SajuResult } from './engine';

// 사주 「ECHO의 이야기」에 보낼 값(2026-10-06). 화면이 이미 계산한 것 중 두 가지(일간 · 오행 개수)만 — 생년월일·시간·성별·나이·시기(10년 흐름·올해)는 보내지 않는다.
// 시기를 보내면 AI 가 앞날을 말하게 되므로(Codex 4187020963) 이야기는 「지금 이 사람의 결」만 그린다. 서버(openai-chat saju_reading)가 두 값을 다시 검사한다.
export interface SajuStoryFacts { dayMaster: string; elements: Record<string, number> }

export function sajuStoryFacts(r: SajuResult): SajuStoryFacts {
  const elements: Record<string, number> = {};
  for (const k of ELEMENT_ORDER) elements[ELEMENT_KO[k]] = r.five_elements[k];
  return { dayMaster: `${STEMS_KO[r.day_master.stem]}${ELEMENT_KO[r.day_master.element]}`, elements };
}
