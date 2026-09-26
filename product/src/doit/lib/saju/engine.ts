// ECHO 사주 계산 엔진(2026-09-26 대표 「SAJU / TAROT FINAL LOCK」). 계산은 이 파일만 한다 — AI(LLM)는 명식을 만들지 않는다.
// - 새 패키지·외부 API 0. 브라우저에서 계산하고, 입력(생년월일·시간)은 서버로 보내지도 저장하지도 않는다.
// - 절기(입춘·경칩 …)는 태양 황경으로 계산한다(Meeus 『Astronomical Algorithms』 저정밀 태양 위치식 · 오차 약 0.01° ≈ 15분).
//   그래서 절기 경계 ±1시간 안의 출생은 결과에 「경계 가까움」 표시를 붙인다(전문 만세력으로 확인 권장).
// - 시간 기준: 한국 표준시(KST)를 UTC 로 바꾼 뒤, 한국 중앙 경도 127.5°의 평균 태양시(UTC+8:30)로 시·일주를 정한다.
//   즉 자시(子時) = 한국 시계 23:30~01:30, 날짜는 23:30 에 바뀐다(자시부터 다음 날). 출생지별 경도 보정은 하지 않는다.
// - 한국 옛 표준시·서머타임: 1954-03-21~1961-08-09 UTC+8:30, 1987·1988 서머타임을 반영한다. 그 밖의 1961년 이전 서머타임은 반영하지 않는다(결과에 표시).
// - 양력 입력만 계산한다. 음력(윤달 포함) 변환표가 저장소에 없어 음력 입력은 계산하지 않는다(가짜 변환 0).
// - 대운: 양남음녀 순행 · 음남양녀 역행, 시작 나이 = 태어난 때부터 다음(순행)·이전(역행) 절까지 날 수 ÷ 3(1일 = 4개월). 성별을 고르지 않으면 계산하지 않는다.
// - 오행 개수: 천간 4 + 지지 4(시간 모름이면 3 + 3)의 본 오행만 센다(지장간 미포함). 점수로 바꾸지 않는다.

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const ELEMENT_KO: Record<Element, string> = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
export const ELEMENT_ORDER: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
const STEM_ELEMENT: Element[] = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
const BRANCH_ELEMENT: Element[] = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
// 지지의 본기(本氣) 천간 — 십신 계산용(子=癸 · 午=丁 · 巳=丙 · 亥=壬 …)
const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];

export type TenGod = '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

export interface Pillar { stem: number; branch: number; index: number; hanja: string; hangul: string }
export interface SajuInput { date: string; time: string | null; gender: 'female' | 'male' | 'unspecified'; calendar: 'solar' | 'lunar' | 'leap' }
export interface MajorCycle { order: number; startAge: number; startYear: number; pillar: Pillar; tenGod: TenGod }
export interface AnnualFlow { year: number; pillar: Pillar; tenGod: TenGod }
export interface SajuResult {
  input: SajuInput;
  calendar_basis: { calendar: 'solar'; utc_offset_minutes: number; local_mean_meridian: 127.5; day_boundary: '23:30 KST' };
  four_pillars: { hour: Pillar | null; day: Pillar; month: Pillar; year: Pillar };
  day_master: { stem: number; element: Element; yang: boolean };
  five_elements: Record<Element, number>;
  ten_gods: { year: [TenGod, TenGod]; month: [TenGod, TenGod]; day: [null, TenGod]; hour: [TenGod, TenGod] | null };
  major_cycles: { direction: 'forward' | 'backward'; startAgeText: string; cycles: MajorCycle[] } | null;
  annual_flow: AnnualFlow[];
  calculation_meta: { engine: 'echo-saju-v1'; term_boundary_near: boolean; notes: string[] };
}
export type SajuErrorCode = 'LUNAR_UNSUPPORTED' | 'BAD_DATE' | 'OUT_OF_RANGE' | 'BAD_TIME';
export class SajuError extends Error { code: SajuErrorCode; constructor(code: SajuErrorCode, message: string) { super(message); this.code = code; } }

export const ENGINE_VERSION = 'echo-saju-v1';
const RAD = Math.PI / 180;
const mod = (n: number, m: number) => ((n % m) + m) % m;

export function pillarOf(index: number): Pillar {
  const i = mod(index, 60); const stem = i % 10; const branch = i % 12;
  return { stem, branch, index: i, hanja: STEMS[stem] + BRANCHES[branch], hangul: STEMS_KO[stem] + BRANCHES_KO[branch] };
}
const indexOf = (stem: number, branch: number) => { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; };

/** 율리우스일(JD) — UTC 밀리초에서 */
export const jdFromMs = (ms: number) => ms / 86400000 + 2440587.5;
const msFromJd = (jd: number) => (jd - 2440587.5) * 86400000;

/** 태양의 겉보기 황경(도) — Meeus 25장 저정밀식 */
export function solarLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * RAD;
  return mod(L0 + C - 0.00569 - 0.00478 * Math.sin(omega), 360);
}

/** 황경이 target 이 되는 순간(UTC ms) — approx 근처 ±20일에서 이분법 */
export function termInstant(target: number, approxMs: number): number {
  let lo = jdFromMs(approxMs) - 20, hi = jdFromMs(approxMs) + 20;
  const diff = (jd: number) => mod(solarLongitude(jd) - target + 180, 360) - 180;
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (diff(mid) < 0) lo = mid; else hi = mid; }
  return msFromJd((lo + hi) / 2);
}

// 절(節) 12개: 월지 인(寅)=입춘 315° 부터 30°씩
const JIE_LONGITUDES = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285];
/** 어떤 순간 앞뒤의 절 두 개(UTC ms) */
function surroundingJie(ms: number): { prev: number; next: number; monthIndex: number } {
  const lam = solarLongitude(jdFromMs(ms));
  const monthIndex = Math.floor(mod(lam - 315, 360) / 30); // 0 = 寅월
  const prevTarget = JIE_LONGITUDES[monthIndex];
  const nextTarget = JIE_LONGITUDES[(monthIndex + 1) % 12];
  const prevApprox = ms - (mod(lam - prevTarget, 360) / 360) * 365.2422 * 86400000;
  const nextApprox = ms + (mod(nextTarget - lam, 360) / 360) * 365.2422 * 86400000;
  return { prev: termInstant(prevTarget, prevApprox), next: termInstant(nextTarget, nextApprox), monthIndex };
}

/** 한국 시계 기준 UTC 오프셋(분) — 옛 표준시·1987/88 서머타임 */
export function koreaOffsetMinutes(y: number, m: number, d: number, hh: number): number {
  const key = y * 1000000 + m * 10000 + d * 100 + hh;
  if (key >= 1954032100 && key < 1961081000) return 510;
  if (key >= 1987051002 && key < 1987101103) return 600;
  if (key >= 1988050802 && key < 1988100903) return 600;
  return 540;
}

function parseInput(input: SajuInput) {
  if (input.calendar !== 'solar') throw new SajuError('LUNAR_UNSUPPORTED', '음력 날짜는 아직 계산하지 못해요. 양력 생일로 입력해 주세요.');
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date ?? '');
  if (!dm) throw new SajuError('BAD_DATE', '생년월일을 다시 확인해 주세요.');
  const y = +dm[1], m = +dm[2], d = +dm[3];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) throw new SajuError('BAD_DATE', '생년월일을 다시 확인해 주세요.');
  if (y < 1920 || y > 2050) throw new SajuError('OUT_OF_RANGE', '1920년부터 2050년 사이 생일만 계산할 수 있어요.');
  let hh = 12, mi = 0;
  if (input.time) {
    const tm = /^(\d{2}):(\d{2})$/.exec(input.time);
    if (!tm || +tm[1] > 23 || +tm[2] > 59) throw new SajuError('BAD_TIME', '태어난 시간을 다시 확인해 주세요.');
    hh = +tm[1]; mi = +tm[2];
  }
  return { y, m, d, hh, mi };
}

const REL = ['same', 'output', 'wealth', 'officer', 'resource'] as const;
const GOD_NAME: Record<(typeof REL)[number], [TenGod, TenGod]> = { same: ['비견', '겁재'], output: ['식신', '상관'], wealth: ['편재', '정재'], officer: ['편관', '정관'], resource: ['편인', '정인'] };
const EL_INDEX: Record<Element, number> = { wood: 0, fire: 1, earth: 2, metal: 3, water: 4 };
/** 일간(dayStem) 기준 다른 천간(stem)의 십신 */
export function tenGodOf(dayStem: number, stem: number): TenGod {
  const a = EL_INDEX[STEM_ELEMENT[dayStem]], b = EL_INDEX[STEM_ELEMENT[stem]];
  const rel = REL[mod(b - a, 5)]; // 0 같음 · 1 내가 생함 · 2 내가 극함 · 3 나를 극함 · 4 나를 생함
  const sameYinYang = dayStem % 2 === stem % 2;
  return GOD_NAME[rel][sameYinYang ? 0 : 1];
}
const branchGod = (dayStem: number, branch: number) => tenGodOf(dayStem, BRANCH_MAIN_STEM[branch]);

export function calculateSaju(input: SajuInput, now: Date = new Date()): SajuResult {
  const { y, m, d, hh, mi } = parseInput(input);
  const hasTime = !!input.time;
  const offset = koreaOffsetMinutes(y, m, d, hh);
  const birthMs = Date.UTC(y, m - 1, d, hh, mi) - offset * 60000;
  // 127.5° 평균 태양시(UTC+8:30)
  const lmt = new Date(birthMs + 510 * 60000);
  let dayY = lmt.getUTCFullYear(), dayM = lmt.getUTCMonth(), dayD = lmt.getUTCDate();
  const lmtHour = lmt.getUTCHours() + lmt.getUTCMinutes() / 60;
  if (hasTime && lmtHour >= 23) { const nd = new Date(Date.UTC(dayY, dayM, dayD + 1)); dayY = nd.getUTCFullYear(); dayM = nd.getUTCMonth(); dayD = nd.getUTCDate(); }
  // 일주: 율리우스 적일(JDN) — 2000-01-01 = 戊午(54)
  const jdn = Math.floor(Date.UTC(dayY, dayM, dayD) / 86400000 + 2440587.5 + 0.5);
  const day = pillarOf(jdn + 49);
  // 연주·월주: 절기 기준(입춘에 해가 바뀜)
  const jie = surroundingJie(birthMs);
  // 그 해 입춘(황경 315°, 2월 4일 무렵) 전이면 전 해로 센다
  const lichun = termInstant(315, Date.UTC(y, 1, 4));
  const sajuYear = birthMs < lichun ? y - 1 : y;
  const year = pillarOf(sajuYear - 4);
  const monthStemStart = mod((year.stem % 5) * 2 + 2, 10); // 甲己년 → 丙寅
  const month = pillarOf(indexOf(mod(monthStemStart + jie.monthIndex, 10), mod(2 + jie.monthIndex, 12)));
  let hour: Pillar | null = null;
  if (hasTime) {
    const hb = Math.floor(mod(lmtHour + 1, 24) / 2); // 子 = 23~01(평균 태양시)
    const hs = mod((day.stem % 5) * 2 + hb, 10);
    hour = pillarOf(indexOf(hs, hb));
  }
  const pillars = [year, month, day, ...(hour ? [hour] : [])];
  const five_elements: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of pillars) { five_elements[STEM_ELEMENT[p.stem]]++; five_elements[BRANCH_ELEMENT[p.branch]]++; }
  const ds = day.stem;
  const ten_gods: SajuResult['ten_gods'] = {
    year: [tenGodOf(ds, year.stem), branchGod(ds, year.branch)], month: [tenGodOf(ds, month.stem), branchGod(ds, month.branch)],
    day: [null, branchGod(ds, day.branch)], hour: hour ? [tenGodOf(ds, hour.stem), branchGod(ds, hour.branch)] : null,
  };
  // 대운
  let major_cycles: SajuResult['major_cycles'] = null;
  if (input.gender !== 'unspecified') {
    const yangYear = year.stem % 2 === 0;
    const forward = (yangYear && input.gender === 'male') || (!yangYear && input.gender === 'female');
    const days = Math.abs((forward ? jie.next : jie.prev) - birthMs) / 86400000;
    const startYears = Math.floor(days / 3); const startMonths = Math.round((days % 3) * 4);
    const startAge = startYears + startMonths / 12;
    const cycles: MajorCycle[] = [];
    for (let k = 1; k <= 10; k++) {
      const p = pillarOf(month.index + (forward ? k : -k));
      const age = Math.round(startAge + (k - 1) * 10);
      cycles.push({ order: k, startAge: age, startYear: y + age, pillar: p, tenGod: tenGodOf(ds, p.stem) });
    }
    major_cycles = { direction: forward ? 'forward' : 'backward', startAgeText: `${startYears}세 ${startMonths}개월`, cycles };
  }
  // 세운: 올해 앞뒤
  const thisYear = now.getFullYear();
  const annual_flow: AnnualFlow[] = [];
  for (let yy = thisYear - 1; yy <= thisYear + 5; yy++) { const p = pillarOf(yy - 4); annual_flow.push({ year: yy, pillar: p, tenGod: tenGodOf(ds, p.stem) }); }
  // 메모·경계
  const nearMs = 60 * 60000;
  const term_boundary_near = Math.abs(birthMs - jie.prev) < nearMs || Math.abs(jie.next - birthMs) < nearMs;
  const notes: string[] = [];
  if (!hasTime) notes.push('태어난 시간을 몰라 시주는 비워 뒀어요. 밤 11시 반 넘어 태어났다면 일주가 달라질 수 있어요.');
  if (term_boundary_near) notes.push('절기가 바뀌는 시각과 1시간 안쪽이라 월주·연주가 달라질 수 있어요. 정확히 보려면 만세력으로 한 번 더 확인해 주세요.');
  if (y < 1962 && offset === 540) notes.push('1961년 이전 출생은 당시 서머타임을 모두 반영하지 못했어요.');
  if (input.gender === 'unspecified') notes.push('성별을 고르지 않아 10년 흐름(대운)은 계산하지 않았어요.');
  return {
    input, calendar_basis: { calendar: 'solar', utc_offset_minutes: offset, local_mean_meridian: 127.5, day_boundary: '23:30 KST' },
    four_pillars: { hour, day, month, year }, day_master: { stem: ds, element: STEM_ELEMENT[ds], yang: ds % 2 === 0 },
    five_elements, ten_gods, major_cycles, annual_flow, calculation_meta: { engine: ENGINE_VERSION, term_boundary_near, notes },
  };
}

/** 그 해 입춘 순간(UTC ms) — 검사용 */
export const lichunOf = (year: number) => termInstant(315, Date.UTC(year, 1, 4));

export const elementOfStem = (s: number) => STEM_ELEMENT[s];
export const elementOfBranch = (b: number) => BRANCH_ELEMENT[b];
