// ECHO Agent 서버의 모델 선택 규칙(2026-10-03 대표 「3개 AI 제공사 통합」).
// 제품 주체는 ECHO Agent 다. 모델은 내부 도구일 뿐이고, 무엇을 부를지 · 받은 글을 쓸지 · 상태에 반영할지는 서버가 정한다:
//   · 이 파일 = 「이번 호출에 어느 제공사·모델을 쓸지」와 실패 시 전환 · 한도만 정한다.
//   · 응답 채택(형식·회사 규칙 검사) · 상태 반영 · 다음 행동 = agent.ts(서버 규칙) · 저장 = index.ts(판 번호 비교 저장 · 같은 요청 재전송 = 저장된 결과).
// 고정 원칙
//   · 한 호출 = 모델 하나. 매 요청 세 제공사를 함께 부르지 않는다.
//   · 검증되지 않은 우열(「Claude=분석」「Gemini=검색」)을 코드에 두지 않는다 — 작업별 후보 순서는 정책(AI_POLICY)으로만 정하고, 정책이 없으면 지금 승인된 OpenAI 하나.
//   · 사용자 글이 들어가는 호출은, 정책에 그 제공사로의 전달 허용(allow_user_text)이 있어야만 보낸다(개인정보 국외 전송·처리 위탁 승인 전 = 보내지 않음).
//   · 안전상 거절(refused)은 다른 모델로 돌려 피하지 않는다 — 바로 실패.
//   · 재시도·전환 횟수 · 요청 전체 기한 · 토큰 상한이 있다(무한 재시도·순환 0). 모두 실패하면 던진다 → Agent 는 상태를 건드리지 않는다.
//   · 로그에는 제공사·모델·이유·정책판·성공/오류 코드·지연·사용량만(사용자 원문 · 키 · 업체 오류 글 0).
import { anthropicProvider, geminiProvider, openAIProvider, ProviderError, PROVIDER_IDS, type ModelProvider, type ProviderErrorCode, type ProviderId, type ProviderUsage } from "./providers.ts";
import type { Llm, LlmResult } from "./agent.ts";

export type TaskKind = Parameters<Llm>[0];
// 제공사 하나의 조건. 선택 순서 = 작업 종류 → 데이터 전달 허용 → 켜짐 → 품질 조건(그 작업에서 검증됨) → 사용 가능(키·연속 오류) → 비용·시간 한도 → 정책 순서의 첫 후보.
//   enabled: Gemini 는 명시적으로 켤 때만(검증 전 기본 꺼짐) · verified_tasks: 실제 비교로 통과한 작업(require_verified 일 때만 걸러냄)
//   price: 1백만 토큰당 달러(공식 단가 확인 뒤 정책에 적음 · 없으면 금액 계산 「확인 불가」)
export interface ProviderPolicy { model: string; allow_user_text: boolean; sampling?: "temperature" | "none"; enabled: boolean; verified_tasks: string[] | null; price: { in_usd_per_1m: number; out_usd_per_1m: number } | null }
export interface AiPolicy {
  version: string;
  providers: Partial<Record<ProviderId, ProviderPolicy>>;
  tasks: Partial<Record<TaskKind | "default", ProviderId[]>>; // 작업별 후보 순서(앞이 먼저)
  switch_on_invalid: boolean; // Agent 가 형식·규칙 검사에서 거절하고 다시 청할 때(previous_attempt) 다음 후보로
  require_verified: boolean; // true = 그 작업을 verified_tasks 에 적은 제공사만(품질 조건)
  // 토큰 상한과 금액 상한은 다르다: max_tokens_per_request = 토큰 수 · max_cost_usd_per_request = 금액(단가가 적힌 제공사만 계산 · null = 금액 상한 없음)
  limits: { max_calls_per_request: number; max_tokens_per_request: number; deadline_ms: number; call_timeout_ms: number; same_provider_retries: number; retry_wait_ms: number; max_cost_usd_per_request: number | null };
  circuit: { open_after: number; cooldown_ms: number };
}
// 요청 하나(모든 호출이 같이 쓰는 예산)의 기본 한도 — 2026-10-03 QA 실측(최근 14일 agent_turn 6,800건 · 호출 17,196번 · OpenAI 기본 모델) 근거:
//   턴 하나의 호출 p50 2 · p99 6~7 · 최대 8(코드상 최대 11 = turn 3 + 겹침 전환 1 + 고르기 1 + 질문 다시 쓰기 2 + 받아주기 1 + 마침 1 + 소개 1 + 보기 1)
//   → 14 = 코드상 최대 11 + 재시도·전환 3. 토큰: 턴 최대 17,459 · 코드상 재시도 없는 최대 약 25,000 → 30,000.
//   시간: 턴 p99 11.3초 · p99.9 16.3초 · 최대 54.2초(60초 넘은 턴 0) → 60초. 호출 하나 18초(지금 운영 그대로).
export const DEFAULT_LIMITS: AiPolicy["limits"] = { max_calls_per_request: 14, max_tokens_per_request: 30_000, deadline_ms: 60_000, call_timeout_ms: 18_000, same_provider_retries: 1, retry_wait_ms: 1500, max_cost_usd_per_request: null };
const DEFAULT_CIRCUIT: AiPolicy["circuit"] = { open_after: 3, cooldown_ms: 60_000 };
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:\-/]{1,79}$/;

/** 정책이 없을 때 = 지금 운영 승인 그대로(OpenAI · OPENAI_MODEL · 다른 제공사 0). */
export function defaultPolicy(openaiModel: string): AiPolicy {
  return { version: "ai-policy-default-openai", providers: { openai: { model: openaiModel, allow_user_text: true, enabled: true, verified_tasks: null, price: null } }, tasks: { default: ["openai"] }, switch_on_invalid: false, require_verified: false, limits: { ...DEFAULT_LIMITS }, circuit: { ...DEFAULT_CIRCUIT } };
}

/** AI_POLICY(JSON) 읽기 — 모양이 틀리면 null(→ 기본 정책). 모델 이름은 비어 있거나 추정 모양이면 그 제공사를 빼고, 한도는 안전 범위로 자른다. */
export function parsePolicy(raw: string | undefined | null): AiPolicy | null {
  if (!raw || !raw.trim()) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== "object" || typeof o.version !== "string" || !o.version.trim()) return null;
  const providers: AiPolicy["providers"] = {};
  for (const id of PROVIDER_IDS) {
    const p = (o.providers as Record<string, Record<string, unknown>> | undefined)?.[id];
    if (!p || typeof p.model !== "string" || !MODEL_ID.test(p.model)) continue;
    const price = p.price && typeof p.price === "object" ? p.price as Record<string, unknown> : null;
    const usd = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1000 ? v : null);
    providers[id] = { model: p.model, allow_user_text: p.allow_user_text === true, ...(p.sampling === "none" ? { sampling: "none" as const } : {}),
      // Gemini 는 할당량·응답 모양이 실제 호출로 확인되기 전에는 명시적으로 켜야만 쓴다(지원 코드는 유지)
      enabled: id === "gemini" ? p.enabled === true : p.enabled !== false,
      verified_tasks: Array.isArray(p.verified_tasks) ? (p.verified_tasks as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 12) : null,
      price: price && usd(price.in_usd_per_1m) != null && usd(price.out_usd_per_1m) != null ? { in_usd_per_1m: usd(price.in_usd_per_1m)!, out_usd_per_1m: usd(price.out_usd_per_1m)! } : null };
  }
  const tasks: AiPolicy["tasks"] = {};
  for (const [k, v] of Object.entries((o.tasks ?? {}) as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const list = [...new Set(v.filter((x): x is ProviderId => PROVIDER_IDS.includes(x as ProviderId)))];
    if (list.length) tasks[k as TaskKind] = list;
  }
  if (!tasks.default) tasks.default = ["openai"];
  const l = (o.limits ?? {}) as Record<string, unknown>;
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  const c = (o.circuit ?? {}) as Record<string, unknown>;
  return {
    version: o.version.trim().slice(0, 60), providers, tasks, switch_on_invalid: o.switch_on_invalid === true, require_verified: o.require_verified === true,
    limits: {
      max_calls_per_request: clamp(l.max_calls_per_request, 1, 40, DEFAULT_LIMITS.max_calls_per_request),
      max_tokens_per_request: clamp(l.max_tokens_per_request, 1000, 1_000_000, DEFAULT_LIMITS.max_tokens_per_request),
      deadline_ms: clamp(l.deadline_ms, 5000, 140_000, DEFAULT_LIMITS.deadline_ms),
      call_timeout_ms: clamp(l.call_timeout_ms, 2000, 60_000, DEFAULT_LIMITS.call_timeout_ms),
      same_provider_retries: clamp(l.same_provider_retries, 0, 2, DEFAULT_LIMITS.same_provider_retries),
      retry_wait_ms: clamp(l.retry_wait_ms, 0, 10_000, DEFAULT_LIMITS.retry_wait_ms),
      max_cost_usd_per_request: typeof l.max_cost_usd_per_request === "number" && Number.isFinite(l.max_cost_usd_per_request) && l.max_cost_usd_per_request > 0 ? Math.min(10, l.max_cost_usd_per_request) : null,
    },
    circuit: { open_after: clamp(c.open_after, 1, 20, DEFAULT_CIRCUIT.open_after), cooldown_ms: clamp(c.cooldown_ms, 1000, 600_000, DEFAULT_CIRCUIT.cooldown_ms) },
  };
}

// 모델에 보내면 안 되는 칸(마지막 안전망 · Agent 는 원래 넣지 않는다).
const PII_KEYS = /^(birth|birth_?date|birth_?time|birthday|dob|phone|phone_?number|email|address|real_?name|resident|rrn|password|token|access_?token)$/i;
export function piiKeys(input: unknown, path = ""): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input)) return input.flatMap((v, i) => piiKeys(v, `${path}[${i}]`));
  const at = (k: string) => (path ? `${path}.${k}` : k);
  return Object.entries(input as Record<string, unknown>).flatMap(([k, v]) => [...(PII_KEYS.test(k) ? [at(k)] : []), ...piiKeys(v, at(k))]);
}

// 자유 문장 속 개인정보 가리기(마지막 안전망). 칸 이름 차단(piiKeys)만으로는 문장 속 번호를 막지 못한다.
// Agent 는 이미 전화·이메일·주소(URL)·주민번호가 든 말을 모델에 보내지 않고 저장도 하지 않는다(PRIVATE_DATA) — 여기서는 그 밖의 경로와 생년월일·카드 번호까지 가린 뒤 보낸다.
// 다른 사람의 이름·사정 같은 「제3자 정보」는 글자 규칙으로 가려낼 수 없다 → 가리지 못함(남은 한계 · 문서 §23).
// 카드 번호를 맨 앞에: 붙여 쓴 번호를 전화·주민번호 규칙이 먼저 일부만 가리면 나머지 숫자가 그대로 나가므로
// 카드 = ① 네 자리씩 네 묶음(16자리 · 띄어 쓰기/붙여 쓰기 · 예전 규칙 그대로) ② 그 밖의 13~19자리(붙여 쓰기 · 4-6-5/4-6-4 묶음 · 4자리 묶음 3~4개 + 끝 1~3자리)는
//   카드 검증 숫자(Luhn)가 맞을 때만 — 아무 긴 숫자(주문 번호 등)를 가리지 않게. 앞뒤가 숫자인 더 긴 수의 일부는 잡지 않는다.
const CARD = /(?<!\d)(?:\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?:[-\s]?\d{1,3})?|\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{1,3}|\d{4}[-\s]\d{6}[-\s]\d{4,5}|\d{13,19})(?!\d)/g; // 4-4-4-1~3 = 13~15자리 묶음(Luhn 필요)
const FOUR_BY_FOUR = /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/;
function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) { let d = digits.charCodeAt(digits.length - 1 - i) - 48; if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; } sum += d; }
  return sum % 10 === 0;
}
const isCard = (m: string) => { const d = m.replace(/[-\s]/g, ""); return FOUR_BY_FOUR.test(m) || (d.length >= 13 && d.length <= 19 && luhnOk(d)); };
// 4묶음 뒤의 1~3자리는 다음 일반 숫자(「… 1111 2번」)일 수도 있다 → 전체가 카드가 아니면 앞 4묶음만 카드로 보고 꼬리는 그대로 둔다
const HEAD16 = /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/;
const cardMask = (m: string): string | null => {
  if (isCard(m)) return "[가림]";
  const h = m.match(HEAD16)?.[0];
  return h && h.length < m.length ? `[가림]${m.slice(h.length)}` : null;
};
const MASKS: [string, RegExp, ((m: string) => string | null)?][] = [
  ["card", CARD, cardMask],
  ["phone", /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g],
  ["landline", /0(2|[3-6][1-5])[-\s.]\d{3,4}[-\s.]\d{4}/g],
  ["email", /[\w.+-]{1,64}@[\w-]{1,63}\.[\w.]{1,63}/g], // 반복 길이를 묶어 긴 글에서도 선형 시간(무한 되돌림 0)
  ["rrn", /\d{6}[-\s]?[1-4]\d{6}/g],
  ["birth", /(19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g],
];
export function maskPii(input: unknown): { value: unknown; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") { let t = v; for (const [name, re, mask] of MASKS) t = t.replace(re, (m) => { const out = mask ? mask(m) : "[가림]"; if (out == null) return m; counts[name] = (counts[name] ?? 0) + 1; return out; }); return t; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const value = walk(input);
  // 기록 순서는 예전 그대로(전화·유선·이메일·주민번호·카드·생년월일) — 가리는 순서(카드 먼저)와 따로
  const ordered: Record<string, number> = {};
  for (const k of ["phone", "landline", "email", "rrn", "card", "birth"]) if (counts[k]) ordered[k] = counts[k];
  return { value, counts: ordered };
}

// 라우터가 스스로 멈춘 이유(제공사 오류가 아님). Agent 는 e.code 만 읽는다.
export type RouterStopCode = "pii_blocked" | "not_configured" | "budget_exceeded" | "deadline_exceeded" | "all_unavailable" | "cancelled" | "refused";
export class RouterError extends Error { code: RouterStopCode; constructor(code: RouterStopCode) { super(`router:${code}`); this.code = code; } }

export interface AiCallLog {
  seq: number; kind: TaskKind; provider: ProviderId | null; model_requested: string | null; model_served: string | null;
  reason: string; policy_version: string; attempt: number; ok: boolean; error: string | null;
  status: number | null; latency_ms: number; input_tokens: number | null; output_tokens: number | null; cached_tokens: number | null;
  // usage: confirmed = 업체가 사용량을 알려 줌(성공·실패 무관) · unknown = 보냈을 수 있으나 사용량 응답 없음(시간 초과·연결 끊김·HTTP 오류) · none = 보내지 않음
  usage?: "confirmed" | "unknown" | "none"; reserved_tokens?: number;
}
export type RouterHealth = Partial<Record<ProviderId, { consecutive_errors: number; open_until: number }>>;
export interface RouterDeps {
  policy: AiPolicy; providers: Partial<Record<ProviderId, ModelProvider>>; params: { temperature: number; top_p?: number; max_tokens: number };
  health?: RouterHealth; now?: () => number; sleep?: (ms: number) => Promise<void>;
  signal?: AbortSignal; // 사용자 요청이 끊기면(창 닫힘 등) 진행 중 호출을 끊고 더 부르지 않는다
}
export type SkipWhy = "not_in_policy" | "data_not_allowed" | "disabled" | "not_verified_for_task" | "no_key" | "price_unknown" | "cost_cap";
// 예산 표시 세 가지를 섞지 않는다: tokens_in/out = 업체가 알려 준 확인된 사용량 · tokens_reserved_unconfirmed = 보냈지만 사용량을 모르는 시도의 보장 상한(입력 바이트 + 출력 상한 · 다음 요청의 대화 예산에 그대로 넘김 · 청구액 아님) · cost_usd = 확인된 사용량 × 정책 단가(단가 모르면 null) · cost_complete = 미확인 시도가 없을 때만 true
export interface RouterSummary { provider: ProviderId | null; providers: ProviderId[]; model: string | null; fallback: number; calls: number; errors: number; tokens_in: number; tokens_out: number; tokens_reserved_unconfirmed: number; unconfirmed_attempts: number; cost_usd: number | null; cost_complete: boolean }
export interface ModelRouter { llm: Llm; log: AiCallLog[]; policy: AiPolicy; limitTo(rem: { calls: number; tokens: number }): void; usable(kind?: TaskKind): ProviderId[]; explain(kind?: TaskKind): { order: ProviderId[]; skipped: { provider: ProviderId; why: SkipWhy }[] }; summary(): RouterSummary }

// 제공사가 아니라 요청 자체 문제라 다른 모델로 돌려도 안 되는 오류: 거절(안전). 다음 후보로 넘기는 오류: 일시 오류 · 형식 · 4xx(모델 이름·설정 문제) · 빈 답 · 잘림.
const NO_SWITCH: ProviderErrorCode[] = ["refused"];
const MSG_OVERHEAD_TOKENS = 64; // 역할·메시지 구분 등 업체가 덧붙이는 토큰(넉넉히)
const SAME_RETRY: ProviderErrorCode[] = ["http_429", "http_5xx", "network"]; // 지금 운영과 같음 — 시간 초과는 같은 곳에 다시 안 함(기다림 상한)

/** 요청 하나(Agent 행동 하나)에 라우터 하나 — 한도·전환·기록은 요청 단위, 건강 상태(연속 오류 차단)는 함수 인스턴스 단위로 공유. */
export function createModelRouter(d: RouterDeps): ModelRouter {
  const now = d.now ?? Date.now;
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const health = d.health ?? {};
  const { policy } = d;
  const L = policy.limits;
  const log: AiCallLog[] = [];
  // 요청 전체 기한: 따로 타이머를 두지 않고, 호출마다 남은 시간을 그 호출의 시간 제한으로 준다(넘으면 그 호출이 timeout) · 다음 호출 전에 다시 본다.
  const started = now();
  let seq = 0;
  const lastUsed = new Map<TaskKind, ProviderId>();
  // 공유 예산(이 라우터 = 요청 하나 · 그 안의 모든 호출·재시도·전환·동시 호출이 같이 씀). 보내기 「전에」 같은 동기 구간에서 확보한다(await 사이 끼어들기 0):
  //   started = 시작한 시도 수(진행 중 포함) · held = 진행 중이거나 사용량을 모르는 시도의 예약 토큰(추정) · 확인된 사용량은 기록(log)에서.
  // 보호 범위: 이 라우터 하나(= Edge 실행 하나의 요청 하나). 여러 요청·여러 서버 실행 사이는 여기서 막지 않는다(대화·사용자 한도 = index.ts · DB 원자 예약 없음 → 문서 §24).
  let started_attempts = 0;
  // 대화 단위 남은 예산(index.ts 가 저장된 대화 예산에서 계산해 넘김) — 요청 한도와 둘 중 작은 쪽을 쓴다(대화 상한을 요청 하나가 넘지 않게)
  let sessionLeft = { calls: Infinity, tokens: Infinity };
  const limitTo = (rem: { calls: number; tokens: number }) => { sessionLeft = { calls: Math.max(0, rem.calls), tokens: Math.max(0, rem.tokens) }; };
  // 예약 = 토큰 수 + 그 토큰의 추정 금액(단가 있는 제공사만 · 없으면 0). 진행 중이거나 사용량을 모르는 시도는 예약을 유지 → 토큰·금액 상한 모두에 보수적으로 들어간다.
  // max = 보장된 상한(입력 UTF-8 바이트 수 + 메시지 덧붙임 + 출력 상한) — 대화 예산 경계에서는 어림값이 아니라 이 값으로 본다(바이트 단위 토크나이저는 토큰 수 ≤ 바이트 수).
  const held = new Map<number, { tokens: number; max: number; usd: number }>();
  let holdSeq = 0;
  const confirmedTokens = () => log.reduce((n, r) => n + (r.usage === "confirmed" ? (r.input_tokens ?? 0) + (r.output_tokens ?? 0) : 0), 0);
  const heldTokens = () => [...held.values()].reduce((n, x) => n + x.tokens, 0);
  const heldMax = () => [...held.values()].reduce((n, x) => n + x.max, 0);
  const heldUsd = () => [...held.values()].reduce((n, x) => n + x.usd, 0);
  // 금액: 단가가 적힌 제공사만 계산(모르면 null). 상한 판단·미확인 예약 금액은 입력 보장 상한(inputMax · 바이트 + 덧붙임) + 출력 상한으로.
  const costOf = (id: ProviderId, tin: number, tout: number) => { const pr = policy.providers[id]?.price; return pr ? (tin * pr.in_usd_per_1m + tout * pr.out_usd_per_1m) / 1e6 : null; };
  // 확인된 사용량 × 단가의 합. 시도한 제공사 중 하나라도 단가를 모르면 null(0원으로 치지 않음). 사용량을 모르는 시도는 금액에 넣지 않고 cost_complete=false 로 따로 알린다.
  const spentUsd = () => log.reduce<number | null>((n, r) => {
    if (n == null || !r.provider || (r.usage !== "confirmed" && r.usage !== "unknown")) return n;
    if (!policy.providers[r.provider]?.price) return null;
    return r.usage === "confirmed" ? n + costOf(r.provider, r.input_tokens ?? 0, r.output_tokens ?? 0)! : n;
  }, 0);
  // 금액 상한 판단에 쓰는 값: 확인된 금액 + 진행 중·미확인 시도의 예약 금액(미확인 실패를 0원으로 치지 않음). 보고용 cost_usd(확인된 것만)와 따로.
  const committedUsd = () => { const c = spentUsd(); return c == null ? null : c + heldUsd(); };
  /** 작업 종류 → 데이터 전달 허용 → 켜짐 → 품질 조건 → 사용 가능(키) → 금액 한도 → 정책 순서. 연속 오류(건강)는 호출 때 본다. */
  const explain = (kind: TaskKind = "turn", estChars = 0) => {
    const order = policy.tasks[kind] ?? policy.tasks.default ?? [];
    const out: ProviderId[] = []; const skipped: { provider: ProviderId; why: SkipWhy }[] = [];
    for (const id of order) {
      const p = policy.providers[id];
      const on = p?.enabled === true || (p?.enabled === undefined && id !== "gemini"); // Gemini = 명시적으로 켤 때만
      const why: SkipWhy | null = !p ? "not_in_policy" : !p.allow_user_text ? "data_not_allowed" : !on ? "disabled"
        : policy.require_verified && !(p.verified_tasks ?? []).some((t) => t === kind || t === "*") ? "not_verified_for_task"
        : !d.providers[id] ? "no_key"
        : L.max_cost_usd_per_request == null ? null
        : !p.price ? "price_unknown"
        : (committedUsd() ?? Infinity) + (costOf(id, Math.ceil(estChars / 1.5), d.params.max_tokens) ?? Infinity) > L.max_cost_usd_per_request ? "cost_cap" : null;
      if (why) skipped.push({ provider: id, why }); else out.push(id);
    }
    return { order: out, skipped };
  };
  const usable = (kind: TaskKind = "turn") => explain(kind).order;
  const push = (r: Omit<AiCallLog, "seq" | "policy_version">) => { log.push({ seq: ++seq, policy_version: policy.version, ...r }); };

  // 한 요청에서 한 번이라도 안전상 거절이 나오면, 같은 요청의 뒤따르는 호출(다시 쓰기·받아주기·정리·보기 등)도 보내지 않는다 → 거절된 글을 다른 작업·다른 제공사로 다시 보내지 않음
  let refusedInRequest = false;
  const llm: Llm = async (kind, system, input) => {
    if (refusedInRequest) { push({ kind, provider: null, model_requested: null, model_served: null, reason: "refused_earlier_in_request", attempt: 0, ok: false, error: "refused", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); throw new RouterError("refused"); }
    const leak = piiKeys(input);
    if (leak.length) { push({ kind, provider: null, model_requested: null, model_served: null, reason: `pii_keys:${leak.slice(0, 5).join(",")}`, attempt: 0, ok: false, error: "pii_blocked", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); throw new RouterError("pii_blocked"); }
    // 문장 속 개인정보는 가리고 보낸다(모든 후보·재시도·전환에 같은 가린 글) · 기록에는 종류별 개수만
    const masked = maskPii(input);
    const sendInput = masked.value;
    const maskNote = Object.keys(masked.counts).length ? `|masked:${Object.entries(masked.counts).map(([k, n]) => `${k}=${n}`).join(",")}` : "";
    const estChars = JSON.stringify(sendInput ?? "").length + system.length;
    const inputMax = new TextEncoder().encode(JSON.stringify(sendInput ?? "") + system).length + MSG_OVERHEAD_TOKENS; // 입력 토큰의 보장된 상한
    const sel = explain(kind, estChars);
    let order = sel.order;
    // Agent 가 받은 글을 서버 검사에서 거절하고 다시 청함(previous_attempt) → 정책이 허용하면 직전에 쓴 제공사 다음 후보부터
    const retryAfterInvalid = !!(input && typeof input === "object" && (input as Record<string, unknown>).previous_attempt != null);
    let reasonBase = `policy_order${maskNote}`;
    if (retryAfterInvalid && policy.switch_on_invalid && order.length > 1) {
      const prev = lastUsed.get(kind);
      const i = prev ? order.indexOf(prev) : -1;
      if (i >= 0) { order = [...order.slice(i + 1), ...order.slice(0, i + 1)]; reasonBase = `switch_on_invalid_from:${prev}${maskNote}`; }
    }
    if (!order.length) { push({ kind, provider: null, model_requested: null, model_served: null, reason: `no_usable_provider:${sel.skipped.map((x) => `${x.provider}=${x.why}`).join(",") || "empty_policy"}`, attempt: 0, ok: false, error: "not_configured", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); throw new RouterError("not_configured"); }
    // 연속 오류 차단은 「건너뛸 다른 후보」가 있을 때만 — 후보가 모두 막혔거나 하나뿐이면(기본 정책) 지금 운영처럼 그대로 부른다(차단 때문에 모든 요청이 실패하지 않게).
    const isOpen = (id: ProviderId) => (health[id]?.open_until ?? 0) > now();
    const skipOpen = order.some((id) => !isOpen(id)) && order.length > 1;
    let lastErr: ProviderError | null = null; let idx = 0;
    for (const id of order) {
      const h = health[id] ??= { consecutive_errors: 0, open_until: 0 };
      if (skipOpen && isOpen(id)) { push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason: "circuit_open", attempt: 0, ok: false, error: "skipped_unhealthy", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null }); continue; }
      const reason = idx++ === 0 ? reasonBase : `fallback_from:${lastErr?.provider}:${lastErr?.code}`;
      for (let attempt = 1; attempt <= 1 + L.same_provider_retries; attempt++) {
        // 토큰 상한: 이미 쓴(확인 + 예약) 양에 「이번 시도의 예약」까지 더해 본다 → 재시도·전환·동시 호출이 합쳐 상한을 넘지 않게
        const reserve = Math.ceil(estChars / 1.5) + d.params.max_tokens;
        // 대화에 남은 토큰: 어림값이 아니라 보장된 상한으로(확인된 사용량 + 진행 중·미확인 시도의 상한 + 이번 시도의 상한) → 실제 사용량이 어림보다 많아도 대화 상한을 넘지 않음
        const reserveMax = inputMax + d.params.max_tokens;
        // 요청 상한도 같은 보장된 상한으로 본다 → 글자 수 어림보다 실제 토큰이 많은 글(한글·기호 등)도 요청 상한을 넘겨 들어가지 못함
        const overRequest = started_attempts >= L.max_calls_per_request || confirmedTokens() + heldMax() + reserveMax > L.max_tokens_per_request;
        const overSession = started_attempts >= sessionLeft.calls || (Number.isFinite(sessionLeft.tokens) && confirmedTokens() + heldMax() + reserveMax > sessionLeft.tokens);
        if (overRequest || overSession) {
          // 까닭을 남긴다: 대화 예산(session_budget · 다시 보내도 안 됨) / 이번 요청 한도(request_budget · 다시 보내면 됨)
          push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason: overSession && !overRequest ? "session_budget" : "request_budget", attempt: 0, ok: false, error: "budget_exceeded", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null });
          throw new RouterError("budget_exceeded");
        }
        // 금액 상한은 시작 때 한 번만이 아니라 시도(재시도·전환)마다 다시 본다: 확인된 금액 + 이번 호출 추정 > 상한 → 보내지 않고 다음 후보로(더 싼 후보만 남을 수 있음)
        if (L.max_cost_usd_per_request != null && (committedUsd() ?? Infinity) + (costOf(id, inputMax, d.params.max_tokens) ?? Infinity) > L.max_cost_usd_per_request) { // 금액도 입력 보장 상한(inputMax)으로
          push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason, attempt: 0, ok: false, error: "cost_cap", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null });
          break;
        }
        if (d.signal?.aborted) {
          push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason, attempt: 0, ok: false, error: "cancelled", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null });
          throw new RouterError("cancelled");
        }
        if (now() - started >= L.deadline_ms) {
          push({ kind, provider: id, model_requested: policy.providers[id]!.model, model_served: null, reason, attempt: 0, ok: false, error: "deadline_exceeded", status: null, latency_ms: 0, input_tokens: null, output_tokens: null, cached_tokens: null });
          throw new RouterError("deadline_exceeded");
        }
        const p = policy.providers[id]!;
        // 보내기 전에 같은 동기 구간에서 시도 1과 추정 토큰(입력 글자 ÷ 1.5 + 출력 상한)을 예약 → 동시 호출도 같은 예산을 두 번 쓰지 못함
        started_attempts++;
        const hk = ++holdSeq; held.set(hk, { tokens: reserve, max: reserveMax, usd: costOf(id, inputMax, d.params.max_tokens) ?? 0 });
        const settle = (usage: ProviderUsage | null, sent: boolean) => { if (usage || !sent) held.delete(hk); return usage ? "confirmed" as const : sent ? "unknown" as const : "none" as const; };
        try {
          const r = await d.providers[id]!.call({ model: p.model, system, input: sendInput, maxTokens: d.params.max_tokens, temperature: d.params.temperature, topP: d.params.top_p, timeoutMs: Math.min(L.call_timeout_ms, Math.max(1, L.deadline_ms - (now() - started))), signal: d.signal });
          lastUsed.set(kind, id);
          // 길이 상한에서 잘린 답: 다음 후보가 있으면 그쪽으로(이 글은 쓰지 않음) · 마지막 후보면 빈 글을 넘겨 Agent 형식 재요청으로(잘린 글 채택 0).
          const hasNext = order.slice(order.indexOf(id) + 1).some((x) => !(skipOpen && isOpen(x)));
          const usageOk = r.input_tokens != null && r.output_tokens != null; // 입력·출력 둘 다 있어야 확인된 사용량(한쪽만 = 미확인 · 예약 유지)
          const u1 = settle(usageOk ? r : null, true);
          if (r.truncated && hasNext) {
            push({ kind, provider: id, model_requested: p.model, model_served: r.model_served, reason, attempt, ok: false, error: "truncated", status: null, latency_ms: r.latency_ms, input_tokens: r.input_tokens, output_tokens: r.output_tokens, cached_tokens: r.cached_tokens, usage: u1, reserved_tokens: held.get(hk)?.tokens ?? 0 });
            lastErr = new ProviderError(id, "truncated", r.latency_ms);
            break;
          }
          h.consecutive_errors = 0;
          // 마지막 후보의 잘린 답: 글은 넘기지 않는다(빈 글) — JSON 모양이 우연히 맞아도 잘린 내용을 Agent 가 채택·저장하지 않게. Agent 의 기존 형식 재요청이 다시 청한다(사용량은 위에서 이미 집계).
          push({ kind, provider: id, model_requested: p.model, model_served: r.model_served, reason, attempt, ok: true, error: r.truncated ? "truncated_discarded" : null, status: null, latency_ms: r.latency_ms, input_tokens: r.input_tokens, output_tokens: r.output_tokens, cached_tokens: r.cached_tokens, usage: u1, reserved_tokens: held.get(hk)?.tokens ?? 0 });
          const out: LlmResult = { text: r.truncated ? "" : r.text, model: r.model_served ?? r.model_requested, input_tokens: r.input_tokens, output_tokens: r.output_tokens };
          return out;
        } catch (e) {
          const pe = e instanceof ProviderError ? e : new ProviderError(id, "network", 0);
          // 실패여도 업체가 사용량을 알려 줬으면 확인된 사용량으로 센다(전환 전에 예산에 반영). 키 없음 = 보내지 않음. 그 밖에 사용량 없는 실패 = 미확인(예약 유지 · 0원으로 치지 않음).
          // 사용량 칸이 있어도 숫자가 하나도 없으면(거절·빈 답의 메타만) 확인된 사용량이 아니다 → 미확인(예약 유지)
          const peUsage = pe.usage && pe.usage.input_tokens != null && pe.usage.output_tokens != null ? pe.usage : null;
          const u2 = settle(peUsage, pe.code !== "no_key");
          push({ kind, provider: id, model_requested: p.model, model_served: pe.usage?.model_served ?? null, reason, attempt, ok: false, error: pe.code, status: pe.detail.status, latency_ms: pe.latency_ms,
            input_tokens: pe.usage?.input_tokens ?? null, output_tokens: pe.usage?.output_tokens ?? null, cached_tokens: pe.usage?.cached_tokens ?? null, usage: u2, reserved_tokens: held.get(hk)?.tokens ?? 0 });
          lastErr = pe;
          lastUsed.set(kind, id);
          if (pe.code === "cancelled") throw new RouterError("cancelled"); // 사용자가 끊음 → 재시도·전환 0(기록은 위에 error=cancelled)
          if (NO_SWITCH.includes(pe.code)) { refusedInRequest = true; throw pe; } // 안전상 거절 → 다른 모델로 우회하지 않음 · 이 요청의 뒤 호출도 0
          // 사용자가 끊은 요청(abort)은 업체 건강 문제가 아니다 → 연속 오류(차단기)에 넣지 않음
          if (pe.code !== "no_key" && !d.signal?.aborted && ++h.consecutive_errors >= policy.circuit.open_after) h.open_until = now() + policy.circuit.cooldown_ms;
          if (SAME_RETRY.includes(pe.code) && attempt <= L.same_provider_retries && (!skipOpen || !isOpen(id))) {
            // 기다림도 요청 전체 기한 안에서만: 기다린 뒤 기한을 넘기면 같은 곳 재시도는 하지 않는다(다음 후보 → 기한 확인)
            const wait = Math.min(L.retry_wait_ms, pe.detail.retry_after_ms ?? L.retry_wait_ms);
            if (now() - started + wait < L.deadline_ms) { await sleep(wait); continue; }
          }
          break; // 다음 후보로
        }
      }
    }
    throw lastErr ?? new RouterError("all_unavailable");
  };
  const summary = (): RouterSummary => {
    const ok = log.filter((r) => r.ok);
    const first = log.find((r) => r.attempt > 0) ?? null;
    return {
      provider: ok[0]?.provider ?? first?.provider ?? null, providers: [...new Set(log.filter((r) => r.attempt > 0 && r.provider).map((r) => r.provider!))], model: ok[0]?.model_served ?? ok[0]?.model_requested ?? null,
      fallback: log.filter((r) => r.reason.startsWith("fallback_from") || r.reason.startsWith("switch_on_invalid")).length,
      calls: started_attempts, errors: log.filter((r) => !r.ok).length,
      tokens_in: log.reduce((n, r) => n + (r.usage === "confirmed" ? r.input_tokens ?? 0 : 0), 0), tokens_out: log.reduce((n, r) => n + (r.usage === "confirmed" ? r.output_tokens ?? 0 : 0), 0),
      tokens_reserved_unconfirmed: heldMax(), unconfirmed_attempts: log.filter((r) => r.usage === "unknown").length,
      cost_usd: spentUsd(), cost_complete: !log.some((r) => r.usage === "unknown") && spentUsd() != null,
    };
  };
  return { llm, log, policy, limitTo, usable, explain: (kind?: TaskKind) => explain(kind), summary };
}

/** Edge 함수에서: 환경 → 정책 · 제공사 부품. 키는 있는지만 본다(값을 로그·응답에 넣지 않음). */
export function routerFromEnv(get: (k: string) => string | undefined, params: RouterDeps["params"], health: RouterHealth, f: typeof fetch = fetch, resolveOpenAiModel: (raw: string | undefined) => string = (r) => (r ?? "").trim(), signal?: AbortSignal): ModelRouter {
  const policy = parsePolicy(get("AI_POLICY")) ?? defaultPolicy(resolveOpenAiModel(get("OPENAI_MODEL")));
  const keys: Record<ProviderId, string> = { openai: get("OPENAI_API_KEY") ?? "", anthropic: get("ANTHROPIC_API_KEY") ?? "", gemini: get("GEMINI_API_KEY") ?? "" };
  const providers: Partial<Record<ProviderId, ModelProvider>> = {};
  if (keys.openai) providers.openai = openAIProvider(keys.openai, f);
  if (keys.anthropic) providers.anthropic = anthropicProvider(keys.anthropic, { sampling: policy.providers.anthropic?.sampling }, f);
  if (keys.gemini) providers.gemini = geminiProvider(keys.gemini, f);
  return createModelRouter({ policy, providers, params, health, signal });
}
