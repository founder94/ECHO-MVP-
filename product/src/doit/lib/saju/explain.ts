// 사주 해설 — 계산 결과(engine.ts)에서 정해진 규칙으로만 문장을 만든다(AI·LLM 0 · 계산에 없는 내용 창작 0).
// - 전통 해석의 뼈대(일간 비유 · 십신 묶음의 뜻)만 쓰고, 단정·예언(「반드시」「결혼한다」 …)은 쓰지 않는다. 늘 「~로 봐요 · ~로 해석할 수 있어요」.
// - 점수·순위 0. 숫자는 명식에 실제로 있는 글자 수만.
// - AI 설명(대화형 풀이)은 서버 함수 변경·배포가 필요해 대표 승인 전 STOP — 그 전까지 이 규칙 문장만 쓴다.
import { ELEMENT_KO, ELEMENT_ORDER, STEMS_KO, type Element, type SajuResult, type TenGod } from './engine';

export type GodGroup = 'peer' | 'output' | 'wealth' | 'officer' | 'resource';
export const GOD_GROUP: Record<TenGod, GodGroup> = { 비견: 'peer', 겁재: 'peer', 식신: 'output', 상관: 'output', 편재: 'wealth', 정재: 'wealth', 편관: 'officer', 정관: 'officer', 편인: 'resource', 정인: 'resource' };
export const GROUP_NAME: Record<GodGroup, string> = { peer: '비견·겁재', output: '식신·상관', wealth: '편재·정재', officer: '편관·정관', resource: '편인·정인' };
const GROUP_FLOW: Record<GodGroup, string> = {
  peer: '내 힘으로 밀고 가는 흐름으로 봐요. 나와 비슷한 사람들과 나란히 가는 일이 많아질 수 있어요.',
  output: '하고 싶은 걸 꺼내 보이고 표현하는 흐름으로 봐요.',
  wealth: '돈·생활처럼 현실적인 걸 챙기는 흐름으로 봐요.',
  officer: '책임과 규칙, 맡은 일의 무게가 느껴지는 흐름으로 봐요.',
  resource: '배우고 채우고, 도움을 받는 흐름으로 봐요.',
};
export const groupFlow = (god: TenGod) => GROUP_FLOW[GOD_GROUP[god]];

const DAY_MASTER: string[] = [
  '큰 나무에 비유해요. 한 방향으로 꾸준히 자라는 쪽으로 봐요.',
  '풀꽃이나 덩굴에 비유해요. 상황에 맞춰 부드럽게 길을 찾는 쪽으로 봐요.',
  '한낮의 해에 비유해요. 밝게 드러나고 주변을 데우는 쪽으로 봐요.',
  '촛불이나 등불에 비유해요. 가까운 곳을 따뜻하게 비추는 쪽으로 봐요.',
  '넓은 산이나 큰 땅에 비유해요. 묵직하게 버티고 받쳐 주는 쪽으로 봐요.',
  '밭의 흙에 비유해요. 가꾸고 길러 내는 쪽으로 봐요.',
  '다듬기 전 쇠나 바위에 비유해요. 분명하게 자르고 정하는 쪽으로 봐요.',
  '다듬은 보석에 비유해요. 섬세하고 깔끔한 쪽으로 봐요.',
  '큰 강이나 바다에 비유해요. 넓게 흐르고 담아내는 쪽으로 봐요.',
  '비나 이슬에 비유해요. 조용히 스며드는 쪽으로 봐요.',
];
const josa = (word: string, withBatchim: string, without: string) => { const c = word.charCodeAt(word.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? withBatchim : without; };

/** 일간(나)을 뺀 자리들의 십신 개수 */
export function godCounts(r: SajuResult): Record<GodGroup, number> {
  const n: Record<GodGroup, number> = { peer: 0, output: 0, wealth: 0, officer: 0, resource: 0 };
  const t = r.ten_gods; const all: TenGod[] = [...t.year, ...t.month, t.day[1], ...(t.hour ?? [])];
  for (const g of all) n[GOD_GROUP[g]]++;
  return n;
}

export function elementSummary(r: SajuResult): string[] {
  const e = r.five_elements; const max = Math.max(...ELEMENT_ORDER.map((k) => e[k]));
  const many = ELEMENT_ORDER.filter((k) => e[k] === max && max >= 3);
  const none = ELEMENT_ORDER.filter((k) => e[k] === 0);
  const lines: string[] = [];
  if (many.length) lines.push(`${many.map((k) => ELEMENT_KO[k]).join('·')}${josa(ELEMENT_KO[many[many.length - 1]], '이', '가')} ${max}개로 많은 편이에요.`);
  if (none.length) lines.push(`${none.map((k) => ELEMENT_KO[k]).join('·')}${josa(ELEMENT_KO[none[none.length - 1]], '은', '는')} 명식 겉에는 없어요. 없다고 나쁜 건 아니에요.`);
  if (!lines.length) lines.push('다섯 오행이 한쪽으로 크게 몰리지 않은 편이에요.');
  return lines;
}

export interface CurrentFlow { age: number; cycle: NonNullable<SajuResult['major_cycles']>['cycles'][number] | null; year: SajuResult['annual_flow'][number] | null; lines: string[] }
export function currentFlow(r: SajuResult, now: Date = new Date()): CurrentFlow {
  const birthYear = +r.input.date.slice(0, 4);
  const age = now.getFullYear() - birthYear;
  const cycles = r.major_cycles?.cycles ?? [];
  const cycle = [...cycles].reverse().find((c) => c.startAge <= age) ?? null;
  const year = r.annual_flow.find((a) => a.year === now.getFullYear()) ?? null;
  const lines: string[] = [];
  if (cycle) lines.push(`지금은 ${cycle.pillar.hangul}(${cycle.pillar.hanja}) 10년 흐름 안에 있어요. ${cycle.tenGod} 자리라 ${groupFlow(cycle.tenGod)}`);
  else if (r.major_cycles) lines.push('아직 첫 10년 흐름이 시작되기 전이에요.');
  if (year) lines.push(`올해 ${year.year}년은 ${year.pillar.hangul}(${year.pillar.hanja})년이에요. 나에게는 ${year.tenGod} 자리라 ${groupFlow(year.tenGod)}`);
  return { age, cycle, year, lines };
}

export interface Topic { id: 'me' | 'relation' | 'work' | 'money' | 'life'; title: string; lines: string[] }
export function topics(r: SajuResult, now: Date = new Date()): Topic[] {
  const ds = r.day_master.stem; const g = godCounts(r); const dm = STEMS_KO[ds];
  const el: Element = r.day_master.element; const cf = currentFlow(r, now);
  return [
    { id: 'me', title: '나', lines: [`나를 뜻하는 일간은 ${dm}(${ELEMENT_KO[el]})이에요. 사주에서는 ${DAY_MASTER[ds]}`, ...elementSummary(r)] },
    { id: 'relation', title: '관계', lines: [
      `사주에서 곁에 있는 사람은 비견·겁재(나와 나란한 사람) 자리로 많이 봐요. 명식에 ${g.peer}개 있어요.`,
      g.peer >= 3 ? '주변 사람과 부대끼며 힘을 얻는 쪽으로 해석하기도 해요.' : g.peer === 0 ? '혼자 정리하는 시간이 필요한 쪽으로 해석하기도 해요.' : '사람과의 거리를 스스로 조절하는 쪽으로 볼 수 있어요.',
      '실제 관계는 사주보다 내가 직접 말한 게 더 정확해요.',
    ] },
    { id: 'work', title: '일', lines: [
      `일은 편관·정관(책임·규칙)과 식신·상관(표현·만들기)으로 많이 봐요. 명식에 관 ${g.officer}개, 식상 ${g.output}개가 있어요.`,
      g.officer > g.output ? '맡은 걸 책임지고 해내는 쪽이 더 편할 수 있어요.' : g.output > g.officer ? '직접 만들고 드러내는 쪽이 더 편할 수 있어요.' : '두 쪽이 비슷해서 상황에 따라 달라질 수 있어요.',
    ] },
    { id: 'money', title: '돈', lines: [
      `돈과 현실 감각은 편재·정재로 봐요. 명식에 ${g.wealth}개 있어요.`,
      g.wealth === 0 ? '재성이 겉에 없다고 돈이 없다는 뜻은 아니에요. 돈을 대하는 방식이 다른 쪽으로 봐요.' : g.wealth >= 3 ? '현실적인 계산이 빠른 쪽으로 해석하기도 해요.' : '필요한 만큼 챙기는 쪽으로 볼 수 있어요.',
    ] },
    { id: 'life', title: '생활 흐름', lines: cf.lines.length ? cf.lines : ['성별을 고르지 않아 10년 흐름은 계산하지 않았어요.'] },
  ];
}

/** 사주 → ECHO 대화 이야기 거리(관계 주제의 세 갈래 중 하나 · topics 「관계」와 같은 기준). 사용자 사실이 아니다. */
export function sajuSeedKey(r: SajuResult): 'peer_many' | 'peer_none' | 'peer_some' {
  const n = godCounts(r).peer; return n >= 3 ? 'peer_many' : n === 0 ? 'peer_none' : 'peer_some';
}

export function summaryLines(r: SajuResult, now: Date = new Date()): string[] {
  const cf = currentFlow(r, now);
  const lines = [`일간 ${STEMS_KO[r.day_master.stem]}(${ELEMENT_KO[r.day_master.element]}) · ${elementSummary(r)[0]}`];
  if (cf.year) lines.push(`올해는 ${cf.year.tenGod} 흐름이에요.`);
  lines.push('사주는 참고로만 봐 주세요. 나를 가장 잘 아는 건 나예요.');
  return lines;
}
