// 「나의 이해」 화면에 보일 모양(2026-09-26 대표 「FINAL HUMAN UX」 §11~§14 · §30~§33). 순수 함수 — 저장된 데이터는 바꾸지 않는다(DB 삭제·변경 0).
// - 지금의 나: 같은 뜻의 말은 가장 최근 것 하나만(예: 「연애는 하고 싶어요」 · 「연애는 하고 싶다」). 겹친 옛 말은 「지난 기록」으로.
// - 다섯 칸: ECHO 대화(doit-agent)가 정리한 말은 서버가 정한 칸 그대로. 예전 기록(value·pattern·memory)은 낱말 규칙으로만 나누고,
//   규칙에 안 걸리면 억지로 넣지 않고 「아직 나누지 않은 말」에 둔다(AI 판단 0).
// - 같은 뜻 판정은 글자 규칙이다(띄어쓰기·끝말을 뺀 뒤 한쪽이 다른 쪽을 품거나, 네 글자 이상 같은 조각이 겹치거나, 글자 조각이 60% 이상 같다).
//   「안·않·싫·불·없」 같은 반대 말이 한쪽에만 있으면 같은 뜻으로 보지 않는다.
import { AGENT_PURPOSE_LABELS } from '@/doit/lib/agentApi';

export type AreaId = keyof typeof AGENT_PURPOSE_LABELS | 'unsorted';
export const AREA_ORDER: AreaId[] = ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries', 'unsorted'];
export const AREA_LABEL: Record<AreaId, string> = { ...AGENT_PURPOSE_LABELS, unsorted: '아직 나누지 않은 말' } as Record<AreaId, string>;

export interface ViewItem {
  key: string;
  text: string;
  area: AreaId;
  origin: 'conversation' | 'confirmed' | 'corrected' | 'self';
  source?: string | null; // 처음 남긴 이야기(원문)
  at?: string | null; // 날짜(ISO) — 이번 대화 정리는 없음
  order: number; // 클수록 최근
}

const AREA_RULES: [AreaId, RegExp][] = [
  ['boundaries', /(싫|안\s?맞|피하|절대|못\s?참|별로|없었으면|꼭\s?있|필수)/],
  ['relationship_style', /(연락|천천히|속도|자주|주말|매일|만나는|알아가|데이트|시간을\s?두|빨리)/],
  ['relationship_intent', /(연애|친구|결혼|만남을|사귀|진지한\s?관계)/],
  ['attraction_comfort', /(편한|편하|편해|끌리|끌려|취미|대화가\s?잘|같이\s?있으면|웃음|유머)/],
  ['values_character', /(진심|가식|솔직|배려|책임|예의|성실|약속|신뢰|믿음|중요)/],
];
export function areaOf(text: string): AreaId {
  for (const [id, re] of AREA_RULES) if (re.test(text)) return id;
  return 'unsorted';
}

const norm = (t: string) => String(t ?? '').normalize('NFKC').replace(/[\s.,!?~…·"'「」()]/g, '')
  .replace(/(습니다|이에요|예요|해요|어요|아요|네요|군요|거든요|이요|요|다)$/, '').replace(/(해|하|이|어|아)$/, '');
const NEG = /(안|않|싫|불|없|못)/;
const grams = (s: string) => { const g = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) ?? 0) + 1); } return g; };
function dice(a: string, b: string): number {
  const A = grams(a), B = grams(b); let n = 0, ta = 0, tb = 0;
  for (const v of A.values()) ta += v; for (const v of B.values()) tb += v;
  for (const [k, v] of A) n += Math.min(v, B.get(k) ?? 0);
  return ta + tb ? (2 * n) / (ta + tb) : 0;
}
function longestCommon(a: string, b: string): number {
  let best = 0; const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = dp[j]; dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0; if (dp[j] > best) best = dp[j]; prev = tmp; } }
  return best;
}
export function sameMeaning(x: string, y: string): boolean {
  const a = norm(x), b = norm(y);
  if (!a || !b) return false;
  if (a === b) return true;
  if (NEG.test(a) !== NEG.test(b)) return false;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;
  return longestCommon(a, b) >= 4 || dice(a, b) >= 0.6;
}

/** 최근 것부터 보며 같은 뜻이 이미 있으면 「지난 기록」으로 보낸다. */
export function splitCurrent(items: ViewItem[]): { current: ViewItem[]; past: ViewItem[] } {
  const current: ViewItem[] = []; const past: ViewItem[] = [];
  for (const it of [...items].sort((p, q) => q.order - p.order)) {
    if (current.some((c) => sameMeaning(c.text, it.text))) past.push(it); else current.push(it);
  }
  return { current, past };
}

export function groupByArea(items: ViewItem[]): { area: AreaId; items: ViewItem[] }[] {
  return AREA_ORDER.map((area) => ({ area, items: items.filter((i) => i.area === area) })).filter((g) => g.items.length > 0);
}
