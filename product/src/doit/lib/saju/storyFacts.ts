import { ELEMENT_KO, ELEMENT_ORDER, STEMS_KO, type SajuResult, type TenGod } from './engine';
import { currentFlow } from './explain';

// 사주 「ECHO의 이야기」에 보낼 값(2026-10-06). 화면이 이미 계산한 것 중 네 가지만 — 생년월일·시간·성별·나이는 보내지 않는다.
// 서버(openai-chat saju_reading)는 이 네 가지가 정해진 목록 안의 값인지 다시 검사한다.
export interface SajuStoryFacts { dayMaster: string; elements: Record<string, number>; cycleGod: TenGod | null; yearGod: TenGod | null }

export function sajuStoryFacts(r: SajuResult, now: Date = new Date()): SajuStoryFacts {
  const cf = currentFlow(r, now);
  const elements: Record<string, number> = {};
  for (const k of ELEMENT_ORDER) elements[ELEMENT_KO[k]] = r.five_elements[k];
  return {
    dayMaster: `${STEMS_KO[r.day_master.stem]}${ELEMENT_KO[r.day_master.element]}`,
    elements,
    cycleGod: cf.cycle?.tenGod ?? null,
    yearGod: cf.year?.tenGod ?? null,
  };
}
