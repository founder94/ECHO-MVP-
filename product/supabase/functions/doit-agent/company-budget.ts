// 회사 한 달 AI 예산 장부 연결(2026-10-05 대표 승인 정책: 월 30,000원 · 50% 점검 · 80% 경고) — 서버 쪽 코드만.
// 장부 표·함수는 supabase/drafts/PENDING_20261005_company_ai_budget.sql(실행 전 초안 · 대표 승인 대상). 그 전까지 이 코드는 꺼져 있다.
// - 켜기: 환경값 COMPANY_AI_BUDGET=on (+ COMPANY_AI_KRW_PER_USD 고정 환율 · AI_POLICY 의 단가·요청당 금액 상한). 꺼져 있으면 아무것도 하지 않는다(지금 동작 그대로).
// - 켜져 있으면 「닫힌 쪽으로 실패」: 금액을 정할 수 없거나(단가·상한·환율 없음) 장부가 답하지 않거나 예약이 거절되면 업체 호출 0.
// - 한 요청(재시도·제공사 전환 포함) = 예약 한 번(최대 금액 = 요청당 금액 상한 × 환율) → 끝나면 실제 금액으로 정산(모르면 최대 금액 = uncertain).
// - 50%/80% 는 상태 값(로그)만 · 발송 0. 키·청구 원문 0.
import type { AiPolicy, RouterSummary } from "./modelRouter.ts";

export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
export interface BudgetConfig { krwPerUsd: number | null }
export type ReserveResult = { ok: true; level: "OK" | "CHECK50" | "WARN80" } | { ok: false; code: string };

const KRW_PER_USD_MIN = 500, KRW_PER_USD_MAX = 3000;
/** 꺼져 있으면 null(지금 동작 그대로). */
const denoEnv = (k: string): string | undefined => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);
export function budgetConfig(get: (k: string) => string | undefined = denoEnv): BudgetConfig | null {
  if ((get("COMPANY_AI_BUDGET") ?? "").trim().toLowerCase() !== "on") return null;
  const r = Number((get("COMPANY_AI_KRW_PER_USD") ?? "").trim());
  return { krwPerUsd: Number.isFinite(r) && r >= KRW_PER_USD_MIN && r <= KRW_PER_USD_MAX ? r : null };
}

/** 이 요청의 최대 금액(원). 요청당 금액 상한이나 환율이 없으면 null(=예약 불가 → 호출 0). 제공사 단가가 없으면 라우터가 그 제공사를 건너뛴다(price_unknown). */
export function maxKrw(policy: AiPolicy, cfg: BudgetConfig): number | null {
  const cap = policy.limits.max_cost_usd_per_request;
  if (cap == null || !(cap > 0) || cfg.krwPerUsd == null) return null;
  return Math.max(1, Math.ceil(cap * cfg.krwPerUsd));
}

/** 정산 금액(원): 확인된 금액이 완전하면 올림한 원 · 아니면 null(장부가 최대 금액으로 확정). */
export function actualKrw(s: Pick<RouterSummary, "cost_usd" | "cost_complete">, cfg: BudgetConfig): number | null {
  if (cfg.krwPerUsd == null || s.cost_usd == null || !s.cost_complete) return null;
  return Math.ceil(s.cost_usd * cfg.krwPerUsd);
}

export async function reserve(rpc: Rpc, a: { key: string; fingerprint: string; attempt: string; maxKrw: number }): Promise<ReserveResult> {
  const { data, error } = await rpc("company_ai_reserve", { p_request_key: a.key, p_fingerprint: a.fingerprint, p_attempt: a.attempt, p_max_krw: a.maxKrw });
  if (error || typeof data !== "string") return { ok: false, code: "LEDGER_UNAVAILABLE" };
  const m = /^RESERVED:(OK|CHECK50|WARN80)$/.exec(data);
  return m ? { ok: true, level: m[1] as "OK" | "CHECK50" | "WARN80" } : { ok: false, code: (data.startsWith("DUPLICATE:") ? data : data.split(":")[0]).slice(0, 24) || "REFUSED" }; // 중복은 앞선 예약의 상태까지(DUPLICATE:reserved = 끝나지 않은 예약)
}

export async function settle(rpc: Rpc, a: { key: string; attempt: string; actualKrw: number | null }): Promise<string> {
  const { data, error } = await rpc("company_ai_settle", { p_request_key: a.key, p_attempt: a.attempt, p_actual_krw: a.actualKrw });
  return error || typeof data !== "string" ? "LEDGER_UNAVAILABLE" : data.slice(0, 24);
}
