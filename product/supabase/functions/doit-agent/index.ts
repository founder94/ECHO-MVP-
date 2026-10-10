// doit-agent — ECHO Conversation Agent 운영 서버(2026-09-25, 대표 「구현 → 운영배포 → 운영검증」 FINAL).
// - 모든 요청은 getUser() 실검증. 관리자 요청은 profiles.role = 'admin' 을 서버가 다시 확인한다(doit-connect 와 같은 방식).
// - DB·RLS 변경 0: 기존 표만 쓴다.
//   · 대화 상태 = doit_request_events 한 줄(action "agent_session", request_id = 세션 id, response_payload = 상태, applied_revision = 판 번호 — 동시 쓰기 막기)
//   · 턴 기록 = doit_request_events 한 줄(action "agent_turn", request_id = 화면이 만든 요청 id → 같은 요청 재전송은 저장된 결과를 돌려준다, target_id = 세션 id)
//   · 매칭에 쓰는 답 = 기존 RPC doit_apply_record_create 로 doit_records 에(소개 초안·연결 화면이 그대로 읽는다)
// - 모델 = 서버 선택 규칙(modelRouter.ts · AI_POLICY). 정책이 없으면 기존 승인 모델(resolveModel(OPENAI_MODEL) · 운영 Secret 그대로 · 새 키 0). 호출 주소는 환경변수로 바꿀 수 없다(providers.ts 고정).
// - 로그에는 코드·개수·시간만 남긴다(사용자 원문·토큰·키 0).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import * as A from "./agent.ts";
import * as CR from "./card-reading.ts"; // 카드 해석(대화 상태·매칭과 분리 · agent_card 한 곳에서만 씀)
import * as RT from "./reference-talk.ts"; // 참고 이야기(대화 상태·매칭과 분리 · agent_ref 한 곳에서만 씀)
import * as CB from "./company-budget.ts"; // 회사 한 달 AI 예산 장부(환경값으로 켤 때만 · 기본 꺼짐)
import * as FT from "./free-talk.ts"; // 2026-10-06 유료 자유 대화(스위치 기본 꺼짐 · agent_free_talk 한 곳에서만 씀)
import { FAILURE_INTELLIGENCE_VERSION } from "./failure-intelligence.ts";
import { routerFromEnv, type ModelRouter, type RouterHealth } from "./modelRouter.ts";
import * as R from "./run.ts";

type Db = SupabaseClient;
type Json = Record<string, unknown>;

const SESSION_ACTION = "agent_session";
const TURN_ACTION = "agent_turn";
const USAGE_ACTION = "agent_usage"; // 턴 기록 밖의 모델 사용(시작 인사 · 소개 · 보기 · 저장에 진 요청) — 하루 한도에 함께 센다 · 코드·수치만(원문 0)
const RUN_ACTION = "agent_run";
// 실행 요청 임대 시간: Edge 함수 한 번의 최대 실행 시간(무료 150초 · 유료 400초)보다 길게 → 이 시간이 지난 pending 은 끊긴 요청으로 보고 다시 잡을 수 있다
const RUN_LEASE_MS = 420_000;
// 실행 행의 도구 상태 표시(error_code 칸 · 표 구조 변경 0): 도구를 부르기 직전 = 시작 · 시작 뒤 결과를 확인하지 못한 채 다시 온 요청 = 불확실(다시 실행 안 함)
const RUN_TOOL_STARTED = "TOOL_STARTED";
const RUN_TOOL_UNCERTAIN = "TOOL_UNCERTAIN";
// 2026-10-05 Codex echo-spec 20261005-company-cost-security: 유료 AI 를 부르기 「전에」 자리를 잡는다(기존 표 · 고유 키 (user_id, request_id) · 표 구조 변경 0).
//   · 턴 자리(agent_turn_claim · pending) = 화면 요청 id 로 한 줄. 같은 요청이 동시에 두 번 와도 자리를 잡은 한쪽만 AI 를 부른다(다른 쪽 = 23505 → 409 처리 중).
//     성공하면 그 줄을 턴 기록(agent_turn · applied)으로 바꾼다. 실패가 확실하면(사용량은 실패 턴·사용 기록에 따로 남음) 「놓음(failed)」 → 같은 요청 다시 보내기 = 다시 잡기.
//     결과를 모르는 채 끝나면(예외 · 임대 시간 지남) 「불확실」 — 하루 한도에 계속 세고, 임대 시간이 지난 뒤에만 다시 잡는다(바로 다시 부르기 0).
//   · 사용자 잠금(agent_admission) = 사용자마다 한 줄 · 판 번호 비교 저장. 「하루 한도 세기 → 자리 잡기」를 한 번에 하나씩 → 마지막 한 번은 한 요청만 얻는다(여러 화면·서버 일꾼 공통).
const CLAIM_ACTION = "agent_turn_claim";
const TURN_UNCERTAIN = "TURN_UNCERTAIN";
// 2026-10-05 Codex P2(4181336996): 처리 중인 자리 가운데 AI 를 부를 수 있는 자리만 하루 한도에 센다(error_code = PAID) — 모델이 필요 없는 턴의 자리는 세지 않음.
const CLAIM_PAID = "PAID";
// 2026-10-05 Codex echo-review 20261005-other-actions-original: 시작(agent_start)·소개(agent_intro)·보기(agent_rescue)도 AI 를 부르기 전에 같은 방식으로 자리를 잡는다.
//   그 요청들의 마지막 기록 줄은 요청 id 를 이미 쓰므로(세션 줄 · 턴 줄) 자리 id 는 「요청 id:claim:동작」에서 만든 다른 id 다(동작마다 따로 — 같은 요청 id 를 다른 동작에 써도 서로 막지 않음). 끝나면 자리 = applied(세지 않음 · 사용량은 기존 사용 기록).
const LOCK_ACTION = "agent_admission";
const LOCK_LEASE_MS = 5_000; // 잠금을 쥔 채 끊긴 일꾼이 있어도 이 시간 뒤엔 다른 요청이 잡는다(쥐는 동안 하는 일 = 세기·자리 잡기 몇 번의 조회)
const LOCK_TRIES = 80;
const LOCK_WAIT_MS = 25;
const ACTIONS = new Set(["agent_get", "agent_start", "agent_turn", "agent_rescue", "agent_intro", "agent_intro_mark", "agent_run", "admin_sessions", "admin_session", "agent_card", "agent_ref", "agent_confirm", "agent_forget", "agent_self_note", "agent_free_talk", "admin_free_summary"]);
// 2026-10-06 대표 「기억 영수증」: agent_confirm = 「맞아요」(지금 이해를 사용자 확인으로) · agent_forget = 「ECHO가 아는 나」 줄 지우기 · agent_self_note = 사주·타로 이어 대화에서 사용자가 「프로필에도 반영」을 고른 자기 문장(해석 원문 0)
const SELF_NOTES_ACTION = "agent_self_notes"; const SELF_NOTES_MAX = 30; const SELF_NOTE_MAX = 200;
interface SelfNote { text: string; at: string; origin: "ref_correction" | "self"; id?: string } // id = 지우기 열쇠(검수 P2-12 · 같은 밀리초 두 줄 구분)
const INTRO_USES = new Set(["as_is", "edited", "own"]);
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TEXT_MAX = 1000;
const BODY_MAX_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const ADMIN_LIST_MAX = 50;

function resolveModel(raw: string | undefined): string {
  const model = (raw ?? "").trim();
  return !model || model === "gpt-40-mini" ? "gpt-4o-mini" : model;
}

const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const corsHeaders = (origin: string | null): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
const fail = (code: string, error: string, status: number, origin: string | null) => json({ ok: false, code, error }, status, origin);

const buckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { buckets.set(userId, arr); return true; }
  arr.push(now); buckets.set(userId, arr); return false;
}
function logDiag(fields: Json): void {
  try { console.log(JSON.stringify({ evt: "doit_agent", ...fields })); } catch { /* 로그 실패는 무시 */ }
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// 턴 요청 id 에서 기록용 요청 id 를 정해진 방식으로 만든다 → 같은 턴을 다시 저장해도 RPC 가 같은 기록을 돌려준다.
async function derivedUuid(seed: string): Promise<string> {
  const h = await sha256(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function roundStartOf(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const raw = user.user_metadata?.doit_round_started_at;
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

// 2026-10-03 대표 「3개 AI 제공사 통합」: 모델 호출은 modelRouter(서버 선택 규칙) 한 곳으로. 요청 하나 = 라우터 하나(한도·전환·기록) · 연속 오류 차단 상태는 함수 인스턴스 단위로 공유.
// AI_POLICY 가 없으면 지금 승인 그대로(OpenAI · OPENAI_MODEL · 다른 제공사 0).
const AI_HEALTH: RouterHealth = {};
// 사용자 요청이 끊기면(req.signal) 진행 중인 모델 호출도 끊고 더 부르지 않는다.
const routerForRequest = (signal?: AbortSignal): ModelRouter => routerFromEnv((k) => Deno.env.get(k), A.AGENT_PARAMS, AI_HEALTH, fetch, resolveModel, signal);
// 사용자 단위 하루 한도(24시간 · 기존 턴 기록 수로 셈 · 새 표 0). QA 실측: 사용자·하루 최대 64턴(호출 125) → 200턴.
const USER_DAILY_TURNS = 200;
const DAILY_SCAN_ROWS = 1000; // 하루 턴 기록을 한 번에 읽는 최대 줄 수(넘으면 전부 셈)
// 셈 = 모델을 실제로 부른 턴(기록의 ai_usage.attempts > 0) + 턴 밖 모델 사용 기록(agent_usage · 호출 있을 때만 남음).
// 모델을 부르지 않은 턴(개인정보 안내 · 마친 대화 답 · 보기 모두 아님 등)은 세지 않는다(리뷰 5401213108).
async function userDailyTurns(admin: Db, userId: string): Promise<number | null> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: usage, error: e1 } = await admin.from("doit_request_events").select("request_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", USAGE_ACTION).gte("created_at", since);
  // 읽는 줄 수에 상한이 있으므로 먼저 전체 턴 수를 센다 → 상한을 넘으면 모델 사용 여부와 상관없이 전부 셈(빠진 줄로 한도를 우회 0 · 리뷰 5401266902)
  const { count: allTurns, error: e0 } = await admin.from("doit_request_events").select("request_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", TURN_ACTION).gte("created_at", since);
  // 처리 중인 턴 자리 · 결과를 모르는 자리도 센다(AI 를 이미 불렀을 수 있음 — 놓은 자리는 사용량이 따로 남으므로 세지 않음)
  const { count: inflight, error: e3 } = await admin.from("doit_request_events").select("request_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", CLAIM_ACTION).eq("status", "pending").eq("error_code", CLAIM_PAID).gte("created_at", since);
  const { count: unsure, error: e4 } = await admin.from("doit_request_events").select("request_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", CLAIM_ACTION).eq("error_code", TURN_UNCERTAIN).gte("created_at", since);
  if (e1 || e0 || e3 || e4) return null;
  const held = (inflight ?? 0) + (unsure ?? 0);
  if ((allTurns ?? 0) > DAILY_SCAN_ROWS) return (usage ?? 0) + (allTurns ?? 0) + held;
  const { data: turns, error: e2 } = await admin.from("doit_request_events").select("request_id, attempts:response_payload->record->ai_usage->attempts")
    .eq("user_id", userId).eq("action", TURN_ACTION).gte("created_at", since).limit(DAILY_SCAN_ROWS);
  if (e2) return null;
  const modelTurns = (turns ?? []).filter((r) => {
    const x = r as { attempts?: unknown; response_payload?: { record?: { ai_usage?: { attempts?: unknown } } } };
    const a = x.attempts ?? x.response_payload?.record?.ai_usage?.attempts; // 실제 DB = 경로 선택 값 · 시험용 가짜 DB = 행 전체
    return typeof a === "number" ? a > 0 : true; // 기록이 없거나 모양이 다르면 세는 쪽(한도를 느슨하게 만들지 않음)
  }).length;
  return (usage ?? 0) + modelTurns + held;
}

// 사용자 잠금(판 번호 비교 저장): 잡으면 { id, rev } · 끝내 못 잡으면 null. 쥐는 동안 = 하루 한도 세기 + 자리 잡기만(AI 호출은 잠금 밖).
async function lockAdmission(admin: Db, userId: string): Promise<{ id: string; rev: number } | null> {
  const id = await derivedUuid(`${userId}:agent-admission`);
  for (let i = 0; i < LOCK_TRIES; i++) {
    const { data: row } = await admin.from("doit_request_events").select("applied_revision, response_payload")
      .eq("user_id", userId).eq("request_id", id).eq("action", LOCK_ACTION).maybeSingle();
    if (!row) { await admin.from("doit_request_events").insert({ user_id: userId, request_id: id, action: LOCK_ACTION, status: "applied", payload_hash: "", applied_revision: 0, response_payload: { until: 0 } }); continue; } // 처음 = 한 줄 만들기(겹치면 23505 → 다시 읽기)
    const rev = Number(row.applied_revision ?? 0);
    if (Number((row.response_payload as Json | null)?.until ?? 0) <= Date.now()) {
      const { data } = await admin.from("doit_request_events").update({ applied_revision: rev + 1, response_payload: { until: Date.now() + LOCK_LEASE_MS }, updated_at: new Date().toISOString() })
        .eq("user_id", userId).eq("request_id", id).eq("action", LOCK_ACTION).eq("applied_revision", rev).select("request_id");
      if (data && data.length) return { id, rev: rev + 1 };
    }
    await new Promise((ok) => setTimeout(ok, LOCK_WAIT_MS));
  }
  return null;
}
async function unlockAdmission(admin: Db, userId: string, lock: { id: string; rev: number }) {
  const { error } = await admin.from("doit_request_events").update({ applied_revision: lock.rev + 1, response_payload: { until: 0 }, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("request_id", lock.id).eq("action", LOCK_ACTION).eq("applied_revision", lock.rev); // 임대가 지나 다른 요청이 잡았으면 0행(그쪽 잠금을 풀지 않음)
  if (error) logDiag({ step: "admission_unlock", error: true });
}
// 턴 자리 놓기(실패가 확실함 · 사용량은 실패 턴·사용 기록에 따로 남음) · 결과를 모름(불확실 — 하루 한도에 계속 셈)
// 2026-10-05 Codex(5990710066): 시도 번호(attempt = applied_revision 칸)가 주어지면 그 시도의 자리만 바꾼다 — 늦은 시도가 같은 요청 id 를 다시 잡은 새 시도의 자리를 놓지 못하게.
async function settleClaim(admin: Db, userId: string, requestId: string, code: string, attempt?: number) {
  let q = admin.from("doit_request_events").update({ status: "failed", error_code: code, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("request_id", requestId).eq("action", CLAIM_ACTION).eq("status", "pending");
  if (attempt != null) q = q.eq("applied_revision", attempt);
  const { error } = await q;
  if (error) logDiag({ step: "claim_settle", code, error: true });
}
// 끝난 자리(시작·소개·보기 — 턴 줄로 바뀌지 않는 자리) = applied(하루 한도에 세지 않음 · 사용량은 사용 기록에)
// Codex P2(4182821561): 쓰기 오류면 두 번 더 · 끝내 못 바꾸면 false — 부른 쪽은 「끝남」으로 답하지 않는다(자리는 처리 중으로 남아 하루 한도에 셈).
async function finishClaim(admin: Db, userId: string, id: string, attempt?: number, payload?: Json): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    let q = admin.from("doit_request_events").update({ status: "applied", error_code: null, updated_at: new Date().toISOString(), ...(payload ? { response_payload: payload } : {}) }) // payload = 같은 요청 재전송 때 돌려줄 결과(타로 해석)
      .eq("user_id", userId).eq("request_id", id).eq("action", CLAIM_ACTION).eq("status", "pending");
    if (attempt != null) q = q.eq("applied_revision", attempt);
    const { data, error } = await q.select("request_id");
    if (!error) { if (data && data.length) return true; break; } // Codex P2(4183004866): 0행 = 자리가 그사이 바뀜(다른 시도 · 이미 놓음) → 끝냄 확인 실패
  }
  // 서버 검수(P2): 같은 요청이 거의 동시에 다시 와서 같은 시도 번호의 자리를 먼저 끝냈으면(맞추기) 그것도 끝남이다 — 원래 요청에 가짜 503 을 주지 않는다.
  //   결과를 함께 남겨야 하는 자리(payload)는 남긴 것을 확인할 수 없으니 그대로 실패로 둔다.
  if (!payload && attempt != null) {
    const { data: row, error: re } = await admin.from("doit_request_events").select("status, applied_revision").eq("user_id", userId).eq("request_id", id).eq("action", CLAIM_ACTION).maybeSingle();
    if (!re && row?.status === "applied" && Number(row.applied_revision ?? -1) === attempt) return true;
  }
  logDiag({ step: "claim_finish", error: true });
  return false;
}
const unconfirmed = (origin: string | null) => fail("CLAIM_UNCONFIRMED", "저장은 했는데 마무리를 확인하지 못했어요. 잠시 뒤 다시 불러올게요.", 503, origin);
// Codex P1(4181336991): 세기가 임대 시간보다 길어졌으면 그 사이 다른 요청이 잠금을 잡았을 수 있다 → 자리를 잡기 직전에 판 번호를 다시 확인하며 임대를 늘린다(못 하면 자리 0).
async function renewAdmission(admin: Db, userId: string, lock: { id: string; rev: number }): Promise<{ id: string; rev: number } | null> {
  const { data } = await admin.from("doit_request_events").update({ applied_revision: lock.rev + 1, response_payload: { until: Date.now() + LOCK_LEASE_MS }, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("request_id", lock.id).eq("action", LOCK_ACTION).eq("applied_revision", lock.rev).select("request_id");
  return data && data.length ? { id: lock.id, rev: lock.rev + 1 } : null;
}
type ClaimRow = { action?: unknown; status?: unknown; error_code?: unknown; target_id?: unknown; payload_hash?: unknown; updated_at?: unknown; applied_revision?: unknown };
// 자리 잡기(모든 유료 호출 경로 공통): 같은 id 가 있으면 끝남(done) · 처리 중(409) · 다른 요청(409) · 놓은 자리 = 다시 잡기 · 결과 모름 = 임대 시간 뒤에만 다시 잡기.
//   사용자 잠금 안에서 「(유료면) 하루 한도 세기 → 잠금 다시 확인 → 자리 줄」. AI 호출은 잠금 밖에서, 자리를 잡은 요청만 한다.
async function admitClaim(admin: Db, userId: string, o: { id: string; target: string | null; hash: string; paid: boolean; capped: (reserved?: number) => Promise<Response | null>; origin: string | null; prior?: ClaimRow | null; payload?: Json }): Promise<{ res: Response | null; done: boolean; attempt: number }> {
  const attempt = Math.floor(Math.random() * 2_000_000_000) + 1; // 이번 시도 번호(자리 줄 applied_revision 칸 · 놓기·끝내기는 이 번호의 자리만)
  const busy = () => fail("REQUEST_CONFLICT", "같은 요청을 아직 처리하고 있어요. 잠시 뒤 다시 불러올게요.", 409, o.origin);
  let prior = o.prior;
  if (prior === undefined) ({ data: prior } = await admin.from("doit_request_events").select("action, status, error_code, target_id, payload_hash, updated_at, applied_revision").eq("user_id", userId).eq("request_id", o.id).maybeSingle());
  let reclaim: { status: string; updatedAt: string; uncertain: boolean; paidUnknown: boolean; attempt: number } | null = null;
  if (prior) {
    if (prior.action !== CLAIM_ACTION || (prior.target_id ?? null) !== o.target || prior.payload_hash !== o.hash) return { res: fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, o.origin), done: false, attempt };
    if (prior.status === "applied") return { res: null, done: true, attempt };
    const aged = typeof prior.updated_at === "string" && Date.now() - Date.parse(prior.updated_at) > RUN_LEASE_MS;
    const uncertain = prior.status === "pending" || prior.error_code === TURN_UNCERTAIN;
    if (uncertain && !aged) return { res: busy(), done: false, attempt };
    // Codex P2(4181735009): 결과 모르는 사용량 기록은 AI 를 불렀을 수 있는 자리(PAID · 이미 불확실)만 — 모델이 필요 없던 자리는 0
    reclaim = { status: String(prior.status), updatedAt: String(prior.updated_at), uncertain, paidUnknown: uncertain && (prior.error_code === CLAIM_PAID || prior.error_code === TURN_UNCERTAIN), attempt: Number(prior.applied_revision ?? 0) };
  }
  let lock = await lockAdmission(admin, userId);
  if (!lock) return { res: fail("BUSY", "요청이 몰렸어요. 잠시 뒤 다시 보내 주세요.", 503, o.origin), done: false, attempt };
  try {
    if (o.paid) { const capped = await o.capped(); if (capped) return { res: capped, done: false, attempt }; }
    const fresh = await renewAdmission(admin, userId, lock);
    if (!fresh) return { res: fail("BUSY", "요청이 몰렸어요. 잠시 뒤 다시 보내 주세요.", 503, o.origin), done: false, attempt };
    lock = fresh;
    const mark = o.paid ? CLAIM_PAID : null;
    // 2026-10-05 Codex(5990710066 ②): 결과 모르는 앞선 유료 시도의 사용 기록은 자리를 쓰기 「전에」 남긴다 — 이 쓰기가 늦어도 앞선 자리는 아직 하루 수에 잡혀 있고,
    //   쓰기에 실패하면 자리를 잡지 않는다(로그만 남기고 새 호출 허용 0).
    //   2026-10-05 Codex echo-review(5990995468): 같은 앞선 시도를 두 요청이 함께 다시 잡아도 그 시도의 사용 기록은 한 줄 — id·지문을 「앞선 자리 + 그 시도 번호 + 마지막 갱신 시각」으로 고정(무작위 id 0).
    //   이미 있으면(23505) 같은 사용자·동작·대상·지문의 기록인지 읽어 확인한 뒤에만 그대로 쓴다 · 읽기 실패·불일치·다른 쓰기 오류 = 자리 0(호출 0).
    if (reclaim?.paidUnknown) {
      const keeperId = await derivedUuid(`${userId}:${o.id}:uncertain:${reclaim.attempt}:${reclaim.updatedAt}`);
      const keeperHash = await sha256(`usage:claim_uncertain:${o.id}:${reclaim.attempt}:${reclaim.updatedAt}`);
      const { error: keepError } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: keeperId, action: USAGE_ACTION, target_id: o.target, status: "applied",
        payload_hash: keeperHash, applied_revision: 0, response_payload: { usage: { why: "claim_uncertain", attempts_unknown: true } } });
      if (keepError) {
        let same = false;
        if (keepError.code === "23505") {
          const { data: kept, error: readError } = await admin.from("doit_request_events").select("action, target_id, payload_hash").eq("user_id", userId).eq("request_id", keeperId).maybeSingle();
          same = !readError && !!kept && kept.action === USAGE_ACTION && (kept.target_id ?? null) === o.target && kept.payload_hash === keeperHash;
        }
        if (!same) { logDiag({ step: "usage_log", error: true }); return { res: fail("ERROR", "서버 오류가 발생했어요. 잠시 뒤 다시 보내 주세요.", 500, o.origin), done: false, attempt }; }
      }
    }
    if (reclaim) {
      // Codex P1(4181735001): 다시 잡은 시도는 지금 시각으로 센다(created_at 갱신)
      const now = new Date().toISOString();
      const { data: again, error } = await admin.from("doit_request_events").update({ status: "pending", error_code: mark, applied_revision: attempt, created_at: now, updated_at: now, ...(o.payload ? { response_payload: o.payload } : {}) })
        .eq("user_id", userId).eq("request_id", o.id).eq("action", CLAIM_ACTION).eq("status", reclaim.status).eq("updated_at", reclaim.updatedAt).select("request_id");
      if (error || !again || !again.length) return { res: busy(), done: false, attempt };
    } else {
      const { error } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: o.id, action: CLAIM_ACTION, target_id: o.target, status: "pending", error_code: mark, applied_revision: attempt, payload_hash: o.hash, ...(o.payload ? { response_payload: o.payload } : {}) });
      if (error) return { res: error.code === "23505" ? busy() : fail("ERROR", "서버 오류가 발생했어요.", 500, o.origin), done: false, attempt };
    }
    // 2026-10-05 Codex echo-review(5990414265): 자리 쓰기가 늦어 그 사이 잠금이 넘어갔으면 AI 를 부르지 않는다 — 자리를 쓴 「뒤」 잠금 판 번호를 한 번 더 확인.
    //   잃었으면 「이 시도 번호」의 자리만 놓는다(같은 요청 id 를 이미 다시 잡은 새 시도의 자리는 그대로 · 앞선 불확실 사용량은 위에서 이미 기록됨) → 503 · 업체 호출 0.
    const held = await renewAdmission(admin, userId, lock);
    if (!held) {
      await settleClaim(admin, userId, o.id, "LOST_LOCK", attempt);
      return { res: fail("BUSY", "요청이 몰렸어요. 잠시 뒤 다시 보내 주세요.", 503, o.origin), done: false, attempt };
    }
    lock = held;
    // Codex P1(4182156201): 24시간이 지난 결과 모름 자리를 다시 잡으면 처음 세기에는 그 자리가 빠져 있다 → 사용 기록과 새 자리를 쓴 「뒤」 한 번 더 센다(새 자리까지 합쳐 한도를 넘으면 이 시도 자리만 놓음 · 앞선 시도 기록은 그대로).
    if (o.paid && reclaim?.paidUnknown) {
      const over = await o.capped(1);
      if (over) { await settleClaim(admin, userId, o.id, "DAILY_RECHECK", attempt); return { res: over, done: false, attempt }; }
    }
    return { res: null, done: false, attempt };
  } finally { await unlockAdmission(admin, userId, lock); }
}
// 관리자 관측용 호출 기록(코드·수치만 · 사용자 원문 0).
const aiTrace = (r: ModelRouter) => { const m = r.summary(); return { provider: m.provider ?? "none", providers: m.providers, model_requested: r.policy.providers[m.provider ?? "openai"]?.model ?? null, fallback: m.fallback, ai_policy_version: r.policy.version, ai_calls: r.log.map((x) => ({ ...x })),
  // 확인된 사용량 · 미확인 시도(예약 추정치) · 금액(단가 있을 때만 · 미확인 시도가 있으면 cost_complete=false)을 섞지 않는다
  ai_usage: { attempts: m.calls, tokens_in: m.tokens_in, tokens_out: m.tokens_out, unconfirmed_attempts: m.unconfirmed_attempts, tokens_reserved_unconfirmed: m.tokens_reserved_unconfirmed, cost_usd: m.cost_usd, cost_complete: m.cost_complete } }; };

interface SessionRow { request_id: string; user_id: string; created_at: string; updated_at: string; applied_revision: number | null; response_payload: Json | null }
type TurnOut = { kind: string; reply: string; question: string | null; saved: boolean; finish: boolean; after: boolean; receipt?: A.Receipt | null; cite?: string | null };
interface Stored { agent: string; state: A.AgentState; round_since: string | null; profile?: A.MatchingProfile | null; handoff?: Json | null; run?: R.Run | null; last_turns?: { rid: string; turn: TurnOut }[]; intro_claim?: { id: string; attempt: number } | null }

// 화면에 줄 모습. 내부 상태(추측·되묻기 수 등)는 주지 않는다.
export function sessionView(id: string, stored: Stored, extras: { self_notes?: SelfNote[] } = {}) {
  const st = stored.state;
  const messages: { role: "ai" | "user"; text: string }[] = [];
  st.turns.forEach((t, k) => {
    if (k === 0 && t.ai) messages.push({ role: "ai", text: t.ai });
    messages.push({ role: "user", text: t.user });
    if (t.reply) messages.push({ role: "ai", text: t.reply });
    if (t.question) messages.push({ role: "ai", text: t.cite ? `${t.cite} ${t.question}` : t.question }); // 2026-10-06 정정 직후 질문은 고친 내용 인용과 함께
    if ((t.decision ?? "").startsWith("finish") && st.closing) messages.push({ role: "ai", text: st.closing });
  });
  if (!st.turns.length) { if (st.opening_reply) messages.push({ role: "ai", text: st.opening_reply }); if (st.current) messages.push({ role: "ai", text: st.current.text }); }
  const done = st.phase !== "talk";
  return {
    id, agent: stored.agent, tone: st.tone, mode: st.mode, phase: done ? "done" : "talk",
    goal: A.isGoal(st.goal) ? st.goal : null, goal_label: st.goal_label ?? null, // v2.4 이 세션의 관계 목적(기기마다 다른 목적이면 다른 세션)
    progress: { asked: A.coreAsked(st).length, of: A.MAX_CORE_QUESTIONS },
    // 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE」: 주관식 본체 + 객관식 구조대.
    //   current_rescue = { options(서버가 거른 보기 2~4) · show(서버가 먼저 펼침: 모르겠다·넘기기·도움·피로 뒤 · 고르기 모양 질문) · fallback(보기를 못 만듦 → 안전 안내만) }.
    //   current_choices = 예전 앱용(서버가 먼저 펼친 보기만 · 「잘 모르겠어요」는 섞지 않는다). previous = 직전 질문이 보기로 답한 질문이면 그 보기와 고른 것(뒤로·고치기 복원).
    current_question: st.current ? (st.current.cite ? `${st.current.cite} ${st.current.text}` : st.current.text) : null, current_hint: done ? null : st.current?.hint ?? null, current_choices: done || !st.current?.rescue_show ? null : A.choicesFor(st),
    current_rescue: done ? null : A.rescueView(st), previous: done ? null : previousView(st), messages,
    summary: done ? st.summary : [], closing: done ? st.closing : null,
    profile: done ? A.profileView(st) : null, handoff: done ? stored.handoff ?? null : null, // 2026-10-04 화면용: 같은 원문의 원문 복사본 한 줄 빼기(저장 프로필·매칭·준비 판단은 그대로)
    // v1.6 소개 초안: 문장과 상태만(근거 인용·버린 이유는 관리자 화면에서만).
    intro: done && st.intro ? { status: st.intro.status, text: A.introText(st.intro), lines: st.intro.lines.map((l) => l.text), tries_left: Math.max(0, A.INTRO_TRIES_MAX - st.intro.tries), used: st.intro.used } : null,
    // 2026-10-03 실행 기록(목표 · 계획 단계 · 도구 결과 · 대기 이유 · 예산) — 코드·수치만. 예전 대화는 지금 상태로 계산해 보여 준다(저장 0).
    run: R.runView(stored.run ?? R.syncRun(null, st, new Date().toISOString())),
    // 2026-10-06 「ECHO가 아는 나」 네 칸(대화 중에도) — 사주·타로 이어 대화에서 반영한 자기 문장(self_notes)은 「내가 고친 것」에 함께.
    known: knownWith(st, extras.self_notes ?? []),
  };
}
function knownWith(st: A.AgentState, notes: SelfNote[]): A.KnownView {
  const k = A.knownView(st);
  for (const n of notes) k.corrected.push({ key: `self:${n.id ?? n.at}`, text: n.text, quote: null, purpose: null, at: n.at, sensitive: A.SENSITIVE_TOPIC.test(n.text), from: [], origin: n.origin === "ref_correction" ? "self_note_ref" : "self_note" });
  return k;
}
// ── 2026-10-06 유료 자유 대화 상태(모델 0 · 읽기만). 자리(claim) 지문 = "free:trial:<sha>" / "free:paid:<sha>" — 맛보기·유료를 세는 열쇠(원문 0).
//   권한 = QA 시험용 권한 목록(FREE_TALK_TEST_USERS) 또는 doit_entitlements 표(초안 PENDING_20261006_free_talk.sql · 표가 없으면 권한 0 · 오류도 권한 0).
interface FreeRow { payload_hash: string | null; status: string | null; error_code?: string | null; created_at: string | null; free: { cost_usd?: unknown; tokens?: unknown } | null }
async function freeStatus(admin: Db, userId: string, cfg: FT.FreeTalkConfig, appMeta: Record<string, unknown> | null = null): Promise<{ entitled: boolean; trials_used: number; trial_left: number; daily_used: number; daily_left: number; month_krw: number | null; month_turns: number; company_krw: number | null; unknown: boolean }> {
  let entitled = cfg.testUsers.has(userId) || appMeta?.doit_free_talk === true || appMeta?.doit_free_chat === true; // 계정 메타(app_metadata · 서버만 쓰는 칸)로도 유료 권한(2026-10-06 인계 보강)
  if (!entitled) {
    try {
      const { data, error } = await admin.from("doit_entitlements").select("feature, status, ends_at").eq("user_id", userId).eq("feature", "free_talk").eq("status", "active").limit(5);
      if (!error) entitled = ((data ?? []) as { ends_at: string | null }[]).some((r) => !r.ends_at || Date.parse(r.ends_at) > Date.now());
    } catch { entitled = false; }
  }
  const monthStart = (() => { const k = new Date(Date.now() + 9 * 3_600_000); return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3_600_000).toISOString(); })();
  // 검수 P2-3·P2-11: 결과 모름(UNCERTAIN)도 센다(error_code 를 같이 읽음) · 이번 달 줄만 읽고(상한 2000) 맛보기는 개수만 따로 센다(평생 · 계정당)
  const counts = (r: FreeRow) => r.status === "applied" || r.status === "pending" || /UNCERTAIN/.test(String(r.error_code ?? ""));
  const { data, error } = await admin.from("doit_request_events").select("payload_hash, status, error_code, created_at, free:response_payload->free")
    .eq("user_id", userId).eq("action", CLAIM_ACTION).like("payload_hash", "free:%").gte("created_at", monthStart).limit(2000);
  const { count: trialRows, error: e2 } = await admin.from("doit_request_events").select("request_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", CLAIM_ACTION).like("payload_hash", "free:trial:%").in("status", ["applied", "pending"]);
  const { count: trialUnsure, error: e3 } = await admin.from("doit_request_events").select("request_id", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", CLAIM_ACTION).like("payload_hash", "free:trial:%").eq("error_code", TURN_UNCERTAIN);
  const rows = (error ? [] : (data ?? [])) as unknown as FreeRow[];
  const month = rows.filter(counts);
  const since = Date.now() - 86_400_000;
  const trials_used = (e2 || e3) ? cfg.trials : (trialRows ?? 0) + (trialUnsure ?? 0); // 세지 못하면 닫힌 쪽(맛보기 0)
  const daily_used = month.filter((r) => r.created_at && Date.parse(r.created_at) >= since).length;
  let usd = 0, unknown = false;
  for (const r of month) { const c = r.free?.cost_usd; if (typeof c === "number" && Number.isFinite(c)) usd += c; else if (r.status === "applied") unknown = true; }
  const month_krw = cfg.krwPerUsd == null ? null : Math.ceil(usd * cfg.krwPerUsd);
  // 회사 전체 이번 달(모든 사용자 · 금액만 · 원문 0) — 못 읽으면 닫힌 쪽(company_krw = null → 상한 판정에서 503)
  const { data: co, error: e4 } = await admin.from("doit_request_events").select("status, error_code, free:response_payload->free").eq("action", CLAIM_ACTION).like("payload_hash", "free:%").gte("created_at", monthStart).limit(5000);
  let coUsd = 0;
  for (const r of (e4 ? [] : (co ?? [])) as unknown as FreeRow[]) { if (!counts(r)) continue; const c = r.free?.cost_usd; if (typeof c === "number" && Number.isFinite(c)) coUsd += c; }
  const company_krw = e4 || cfg.krwPerUsd == null ? null : Math.ceil(coUsd * cfg.krwPerUsd);
  return { entitled, trials_used, trial_left: Math.max(0, cfg.trials - trials_used), daily_used, daily_left: error ? 0 : Math.max(0, cfg.daily - daily_used), month_krw, month_turns: month.length, company_krw, unknown: unknown || error != null }; // 읽기 오류 = 닫힌 쪽
}
// 자기 문장 보관 줄(사용자마다 하나 · request_id 는 사용자 id 에서 만든다). 세션과 따로 — 대화가 없어도 남는다.
async function selfNotesRow(admin: Db, userId: string): Promise<{ id: string; rev: number; notes: SelfNote[] }> {
  const id = await derivedUuid(`${userId}:self_notes`);
  const { data } = await admin.from("doit_request_events").select("request_id, applied_revision, response_payload").eq("user_id", userId).eq("request_id", id).eq("action", SELF_NOTES_ACTION).maybeSingle();
  const raw = (data?.response_payload as Json | null)?.notes;
  const notes = Array.isArray(raw) ? (raw as unknown[]).filter((n): n is SelfNote => !!n && typeof (n as SelfNote).text === "string" && typeof (n as SelfNote).at === "string").slice(0, SELF_NOTES_MAX) : [];
  return { id, rev: data ? Number(data.applied_revision ?? 0) : -1, notes };
}
async function saveSelfNotes(admin: Db, userId: string, row: { id: string; rev: number }, notes: SelfNote[]): Promise<boolean> {
  if (row.rev < 0) { const { error } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: row.id, action: SELF_NOTES_ACTION, status: "applied", payload_hash: "", applied_revision: 1, response_payload: { notes } }); return !error; }
  const { data, error } = await admin.from("doit_request_events").update({ response_payload: { notes }, applied_revision: row.rev + 1 }).eq("user_id", userId).eq("request_id", row.id).eq("action", SELF_NOTES_ACTION).eq("applied_revision", row.rev).select("request_id");
  return !error && !!data && data.length > 0;
}

function previousView(st: A.AgentState): { question: string; options: string[]; chosen: string } | null {
  const t = st.turns.at(-1);
  if (!t?.choice || !t.ai) return null;
  const asked = [...st.asked].reverse().find((a) => a.text === t.ai);
  return { question: t.ai, options: asked?.choices?.length ? [...asked.choices] : [t.choice], chosen: t.choice };
}

// v2.4 세션 격리(2026-09-28 대표 「SESSION SAFETY」): 같은 계정이라도 관계 목적(goal)이 다르면 다른 세션이다.
// goal 을 주면 이번 회차에서 그 목적의 가장 최근 세션만(다른 목적 세션을 이어받지 않음). goal 이 없으면(예전 앱) 예전처럼 가장 최근 세션.
async function currentSession(admin: Db, userId: string, since: string | null, goal: A.GoalId | null = null): Promise<SessionRow | null> {
  let q = admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
    .eq("user_id", userId).eq("action", SESSION_ACTION).eq("status", "applied");
  if (since) q = q.gte("created_at", since);
  const { data } = await q.order("created_at", { ascending: false }).limit(goal ? 20 : 1);
  const rows = ((data ?? []) as SessionRow[]).filter((r) => r.response_payload && typeof r.response_payload === "object");
  if (!goal) return rows[0] ?? null;
  return rows.find((r) => ((r.response_payload as unknown as Stored).state?.goal ?? "open") === goal) ?? null;
}
// 기기가 기억한 세션 id 로 읽기(그 계정 · 이번 회차 세션일 때만). 없거나 다른 회차면 null.
async function sessionById(admin: Db, userId: string, id: string, since: string | null): Promise<SessionRow | null> {
  const { data } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
    .eq("user_id", userId).eq("request_id", id).eq("action", SESSION_ACTION).eq("status", "applied").maybeSingle();
  const row = data as SessionRow | null;
  if (!row || !row.response_payload || typeof row.response_payload !== "object") return null;
  if (since && String(row.created_at) < since) return null;
  return row;
}

async function isAdmin(admin: Db, userId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return !!data && String(data.role) === "admin";
}

// 이 도우미가 모델을 부르게 되나: 상태 사본에 「첫 호출에서 바로 멈추는」 가짜 llm 을 넣어 돌려 본다(네트워크·저장 0). 하루 한도를 「모델을 실제로 부를 때」에만 걸기 위함.
const PROBE = new Error("probe");
async function callsModel(stored: Stored, run: (st: A.AgentState, llm: A.Llm) => Promise<unknown>): Promise<boolean> {
  let called = false;
  await run(structuredClone(stored.state), async () => { called = true; throw PROBE; }).catch(() => undefined);
  return called;
}

// 이번 요청의 라우터 사용량(시도 수 · 확인된 토큰 · 미확인 예약)을 대화 예산(stored.run)에 접는다. 모델을 부른 모든 저장 경로(턴 · 실패한 턴 · 소개 · 구조대)가 쓴다.
const foldUsage = (stored: Stored, router: ModelRouter) => {
  const u = router.summary();
  stored.run = R.syncRun(stored.run, stored.state, new Date().toISOString(), { calls: u.calls, tokens_in: u.tokens_in, tokens_out: u.tokens_out, tokens_unconfirmed: u.tokens_reserved_unconfirmed });
};

// 상태를 저장하지 못한(저장 경쟁에 짐 · 취소 · 예산 멈춤) 요청도 실제로 부른 모델 사용량은 남긴다.
type UsageCtx = { admin: Db; userId: string; router: ModelRouter };
// ① 하루 한도용 사용 기록 한 줄(모델 호출이 있었을 때만)
// 돌려주는 값 = 하루 한도에 남았는지(호출 0 이면 남길 것 없음 = true). false 면 부른 쪽이 자리를 「결과 모름」으로 남긴다(Codex P1 4182156210 — 기록 실패로 유료 사용이 사라지지 않게).
async function logUsage(c: UsageCtx, sessionId: string | null, why: string): Promise<boolean> {
  if (c.router.summary().calls <= 0) return true;
  const { error } = await c.admin.from("doit_request_events").insert({ user_id: c.userId, request_id: crypto.randomUUID(), action: USAGE_ACTION, target_id: sessionId, status: "applied",
    payload_hash: await sha256(`usage:${why}:${crypto.randomUUID()}`), applied_revision: 0, response_payload: { usage: { why, ...aiTrace(c.router) } } });
  if (error) { logDiag({ step: "usage_log", error: true }); return false; }
  return true;
}
// ② 지금 저장된 대화에 예산만 접어 넣기(대화 상태 그대로 · 판 번호를 올리는 비교 저장 = 동시에 접거나 저장하는 쪽이 서로 덮지 못함 · 끼면 다시 읽어 최대 3번)
async function foldIntoSaved(c: UsageCtx, sessionId: string) {
  if (c.router.summary().calls <= 0) return;
  for (let i = 0; i < 3; i++) {
    const { data: row } = await c.admin.from("doit_request_events").select("request_id, applied_revision, response_payload")
      .eq("user_id", c.userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).maybeSingle();
    if (!row || !row.response_payload) return;
    const cur = structuredClone(row.response_payload) as unknown as Stored;
    foldUsage(cur, c.router);
    const rv = Number(row.applied_revision ?? 0);
    const { data, error } = await c.admin.from("doit_request_events").update({ response_payload: cur, applied_revision: rv + 1 })
      .eq("user_id", c.userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).eq("applied_revision", rv).select("request_id");
    if (!error && data && data.length) return;
  }
  logDiag({ step: "usage_fold", code: "stale" });
}
const keepUsage = async (c: UsageCtx, sessionId: string | null, why: string): Promise<boolean> => { const ok = await logUsage(c, sessionId, why); if (sessionId) await foldIntoSaved(c, sessionId); return ok; };
// 자리 놓기 코드: 사용 기록이 남았으면 그 코드 · 못 남겼으면 「결과 모름」(하루 한도에 계속 셈)
const keptOr = (ok: boolean, code: string) => ok ? code : TURN_UNCERTAIN;
// Codex P2(4183132885): 자리 하나의 사용 기록은 한 줄 — id·지문을 「자리 + 시도 번호」로 고정. 이미 있으면(23505) 같은 기록인지 읽어 확인한 뒤 남은 것으로 본다.
async function usageOnce(c: UsageCtx, sessionId: string | null, why: string, claimId: string, attempt: number, usage: Json): Promise<boolean> {
  const id = await derivedUuid(`${claimId}:usage:${attempt}`), hash = await sha256(`usage:${claimId}:${attempt}`);
  const { error } = await c.admin.from("doit_request_events").insert({ user_id: c.userId, request_id: id, action: USAGE_ACTION, target_id: sessionId, status: "applied", payload_hash: hash, applied_revision: 0, response_payload: { usage: { why, ...usage } } });
  if (!error) return true;
  if (error.code === "23505") {
    const { data: kept, error: readError } = await c.admin.from("doit_request_events").select("action, target_id, payload_hash").eq("user_id", c.userId).eq("request_id", id).maybeSingle();
    if (!readError && kept && kept.action === USAGE_ACTION && (kept.target_id ?? null) === sessionId && kept.payload_hash === hash) return true;
  }
  logDiag({ step: "usage_log", error: true });
  return false;
}
// 모델 없이 끝나는 같은 요청(앞선 시도가 이미 저장함): 그 시도의 유료 자리가 아직 처리 중이면 사용 기록을 한 줄로 맞추고 끝낸다(하루 한도 이중 셈 0).
// 돌려주는 값: null = 맞출 자리 없음 · true = 끝냄 · false = 끝내지 못함(부른 쪽은 503).
async function reconcilePaid(c: UsageCtx, o: { claimId: string; claimTarget: string | null; usageTarget: string | null; why: string; turnRowId?: string; attempt?: number }): Promise<boolean | null | "other_attempt"> {
  const { data: prior, error } = await c.admin.from("doit_request_events").select("action, status, error_code, target_id, applied_revision").eq("user_id", c.userId).eq("request_id", o.claimId).maybeSingle();
  if (error) return false;
  if (!prior || prior.action !== CLAIM_ACTION || prior.status !== "pending" || prior.error_code !== CLAIM_PAID || (prior.target_id ?? null) !== o.claimTarget) return null;
  const attempt = Number(prior.applied_revision ?? 0);
  // Codex echo-review 5993988460 P1: 저장된 결과가 가리키는 시도 번호와 지금 자리의 시도 번호가 다르면(더 새 시도가 같은 요청을 다시 잡음) 건드리지 않는다
  if (o.attempt != null && o.attempt !== attempt) return "other_attempt";
  // 첫 답 시작: 사용 기록 = 그 요청의 턴 기록(하루 한도에 이미 셈) → 있으면 새 줄 없이 끝냄
  let counted = false;
  if (o.turnRowId) { const { data: t, error: te } = await c.admin.from("doit_request_events").select("action").eq("user_id", c.userId).eq("request_id", o.turnRowId).eq("action", TURN_ACTION).maybeSingle(); if (te) return false; counted = !!t; }
  if (!counted && !(await usageOnce(c, o.usageTarget, `${o.why}_replay`, o.claimId, attempt, { attempts_unknown: true }))) return false;
  return finishClaim(c.admin, c.userId, o.claimId, attempt);
}
// 라우터가 「보내기 전에」 멈춘 까닭: 사용자가 끊음(cancelled) · 예산(budget_exceeded). 이때 도우미가 만든 상태(실패한 소개 · 빈 정리 · 대체 보기)는 저장하지 않는다.
type Halt = "cancelled" | "session" | "request" | "company";
// 회사 예산 장부가 이 요청의 예약을 거절했거나 답하지 않음(업체 호출 0) — 라우터 기록과 따로 표시한다.
const companyHalted = new WeakSet<ModelRouter>();
const MAX_LEDGER_TRIES = 5; // 같은 요청 id 로 정산까지 끝난 시도 뒤 다시 보내기 허용 횟수(장부 예약 열쇠 번호)
const haltedBy = (r: ModelRouter): Halt | null => companyHalted.has(r) ? "company" : r.log.some((x) => x.error === "cancelled") ? "cancelled"
  : r.log.some((x) => x.error === "budget_exceeded" && x.reason === "session_budget") ? "session" : r.log.some((x) => x.error === "budget_exceeded") ? "request" : null;
// 대화 예산 = 429(다시 보내도 안 됨) · 이번 요청 한도 = 502(다시 보내면 됨) · 사용자가 끊음 = 499
const haltFail = (why: Halt, origin: string | null) => why === "company" ? fail("AI_COMPANY_BUDGET", "지금은 AI 사용을 잠시 멈췄어요. 적은 말은 그대로 있어요.", 503, origin)
  : why === "session" ? fail("AI_BUDGET", "이 대화에서 쓸 수 있는 AI 사용량을 다 썼어요.", 429, origin)
  : why === "request" ? fail("AI_ERROR", "AI 가 답을 만들지 못했어요. 적은 말은 그대로 있으니 다시 보내 주세요.", 502, origin) : fail("CANCELLED", "요청이 취소됐어요. 다시 보내 주세요.", 499, origin);

// 한 턴(또는 시작의 첫 답)을 돌리고 결과를 저장한다. 판 번호가 바뀌었으면(다른 창에서 먼저 저장) 저장하지 않고 409.
async function runAndSave(ctx: { admin: Db; userId: string; llm: A.Llm; router: ModelRouter; origin: string | null; claim?: { id: string; turnRow: boolean; attempt?: number } }, sessionId: string, stored: Stored, rev: number, text: string, requestId: string, fresh: boolean, ui: A.UiCorrection | null = null, rescue: { choice?: unknown; rescueOpen?: boolean } = {}) {
  const t0 = Date.now();
  const st = stored.state;
  const before = st.turns.length;
  ctx.router.limitTo(R.remainingBudget(stored.run)); // 이번 요청(재시도·전환 포함)도 대화에 남은 예산 안에서만
  const { obs, response } = await A.runTurn(st, text, ctx.llm, { ui, ...rescue }); // v2.2.1 P0-5: 화면 정정 표시는 서버가 정정으로 확정 · 2026-10-01 고른 보기·펼친 보기
  const halt = haltedBy(ctx.router);
  if (response.error) {
    const ai = ctx.router.summary();
    logDiag({ step: "turn", code: response.error, calls: obs.calls.length, retry: obs.retry, provider: ai.provider, fallback: ai.fallback, ai_errors: ctx.router.log.filter((x) => !x.ok).map((x) => `${x.provider ?? "-"}:${x.error}`), policy: ctx.router.policy.version });
    // v2.0 실패 관측: AI 가 답을 못 만든 턴도 기존 표(doit_request_events · status failed)에 코드·수치만 남긴다(원문 0 · 새 표 0). 관리자 TURN_ERROR 후보의 재료.
    // request_id 는 새로 만든다 — 사용자가 같은 요청을 다시 보냈을 때 성공 기록과 부딪히지 않게.
    const failed = { turn_index: null, session_id: sessionId, agent: A.AGENT_VERSION, input_mode: st.mode, tone: st.tone, kind: "error", error: String(response.error), saved: false, decision: "error",
      question_index: A.coreAsked(st).length, question_purpose: st.current?.purpose ?? null, flags: {}, ...aiTrace(ctx.router), ...A.versionTrace(), calls: obs.calls, retry: obs.retry,
      tone_mismatch_observed: false, id_leak: false, record_error: null, total_ms: Date.now() - t0 };
    // 모델을 한 번도 안 불렀으면(보내기 전 예산 멈춤 등) 실패 턴 기록·하루 한도 차감 0
    let failKept = true;
    if (ai.calls > 0) {
      const { error: failLogError } = await ctx.admin.from("doit_request_events").insert({ user_id: ctx.userId, request_id: crypto.randomUUID(), action: TURN_ACTION, target_id: sessionId, status: "failed",
        payload_hash: await sha256(`${sessionId}:error:${requestId}`), applied_revision: rev, response_payload: { record: failed } });
      if (failLogError) { logDiag({ step: "turn_fail_log", error: true }); failKept = false; } // Codex P1(4182156216): 실패 턴 기록이 없으면 자리를 「결과 모름」으로
      // 실패한 시도도 지금 저장된 대화의 예산에 넣는다(대화 상태·판 번호 그대로 · 실패 되풀이로 대화 상한 우회 0)
      if (!fresh) await foldIntoSaved(ctx, sessionId);
    }
    if (ctx.claim) await settleClaim(ctx.admin, ctx.userId, ctx.claim.id, keptOr(failKept, String(response.error)), ctx.claim.attempt); // 사용량은 위 실패 턴 기록에 · 같은 요청 다시 보내기 = 다시 잡기
    if (halt === "session" || halt === "cancelled" || halt === "company") return haltFail(halt, ctx.origin); // 대화 예산 = 429(다시 보내라 하지 않음) · 끊음 = 499 · 회사 예산 = 503 · 요청 한도 = 아래 기존 502
    return fail(response.error === "PROVIDER" ? "AI_ERROR" : "AI_READ_FAILED", "AI 가 답을 만들지 못했어요. 적은 말은 그대로 있으니 다시 보내 주세요.", 502, ctx.origin);
  }
  // 도중에 끊기거나 예산으로 멈췄으면, 도우미가 빈 값으로 채운 상태(빈 정리 등)를 저장하지 않는다 — 사용량만 남김
  if (halt) { const ok = await keepUsage(ctx, fresh ? null : sessionId, `turn_${halt}`); if (ctx.claim) await settleClaim(ctx.admin, ctx.userId, ctx.claim.id, keptOr(ok, `HALT_${halt}`), ctx.claim.attempt); return haltFail(halt, ctx.origin); }
  const lastTurn = st.turns.length > before ? st.turns.at(-1) : undefined; // 저장 금지 입력·대화 상한은 턴을 만들지 않는다
  if (response.finish || response.after) { stored.profile = A.matchingProfile(st); stored.handoff = A.matchingHandoff(stored.profile); }
  foldUsage(stored, ctx.router); // 같은 판 번호 저장에 함께(정정 → 계획·도구 결과 무효화)
  // Codex P2(4182589941): 턴 결과를 상태 저장에 함께 넣는다(최근 5개) — 아래 턴 기록 마무리가 실패해도 같은 요청 재전송은 이 결과로 답한다(모델 0 · 앞선 상태에 다시 돌리기 0).
  const turnOut: TurnOut = { kind: String(response.kind ?? ""), reply: typeof response.reply === "string" ? response.reply : "", question: typeof response.question === "string" ? response.question : null, saved: response.saved === true, finish: response.finish === true, after: response.after === true,
    receipt: (response.receipt as A.Receipt | null | undefined) ?? null, cite: typeof response.cite === "string" && response.cite ? response.cite : null }; // 2026-10-06 영수증은 상태 저장이 성공한 뒤 이 응답으로만 화면에 간다
  stored.last_turns = [...(stored.last_turns ?? []).filter((x) => x.rid !== requestId), { rid: requestId, turn: turnOut }].slice(-5);
  // 1) 상태 저장(판 번호 확인) — 이긴 쪽만 아래 기록을 남긴다.
  if (fresh) {
    const { error } = await ctx.admin.from("doit_request_events").insert({ user_id: ctx.userId, request_id: sessionId, action: SESSION_ACTION, status: "applied", payload_hash: "", applied_revision: rev + 1, response_payload: stored });
    if (error) { const ok = await keepUsage(ctx, sessionId, "turn_lost_race"); if (ctx.claim) await settleClaim(ctx.admin, ctx.userId, ctx.claim.id, keptOr(ok, "LOST_RACE"), ctx.claim.attempt); return fail("REQUEST_CONFLICT", "대화를 시작하지 못했어요. 다시 눌러 주세요.", 409, ctx.origin); }
  } else {
    const { data, error } = await ctx.admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
      .eq("user_id", ctx.userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
    if (error || !data || !data.length) { const ok = await keepUsage(ctx, sessionId, "turn_lost_race"); if (ctx.claim) await settleClaim(ctx.admin, ctx.userId, ctx.claim.id, keptOr(ok, "LOST_RACE"), ctx.claim.attempt); return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 이어졌어요. 새로 불러올게요.", 409, ctx.origin); } // 진 쪽이 부른 모델도 하루 한도·대화 예산에
  }
  // 2) 매칭에 쓰는 답이면 기록으로도 남긴다(기존 RPC · 같은 턴은 같은 기록).
  let recordId: string | null = null; let recordError: string | null = null;
  // v2.4.7 「앞말을 고치는 뜻이 맞나요?」에 「네」로 답한 턴: 답 기록은 확인한 원문(「아니요, …」)으로 남긴다(「네」 자체는 답이 아니다).
  const recordText = typeof response.record_text === "string" && response.record_text ? response.record_text : text;
  if (response.saved === true && lastTurn) {
    const { data, error } = await ctx.admin.rpc("doit_apply_record_create", { p_user_id: ctx.userId, p_request_id: await derivedUuid(`${requestId}:record`), p_action: "record_create",
      p_payload_hash: await sha256(recordText), p_text: recordText, p_original_text: recordText, p_emotion: "", p_status: "confirmed" });
    const out = data as { ok?: boolean; record?: { id?: string } } | null;
    if (error || !out?.ok) recordError = "record_save_failed"; else recordId = out.record?.id ?? null;
  }
  // 2-1) 「아까 말했는데」처럼 앞선 말에서 되살린 정보: 그 앞선 말(사용자 원문)을 그 턴의 기록으로 남긴다(같은 턴은 같은 기록 · 항의 문장은 남기지 않음).
  for (const n of lastTurn?.recovered_from ?? []) {
    const earlier = st.turns.find((t) => t.n === n); if (!earlier?.user) continue;
    const { data, error } = await ctx.admin.rpc("doit_apply_record_create", { p_user_id: ctx.userId, p_request_id: await derivedUuid(`${sessionId}:turn:${n}:record`), p_action: "record_create",
      p_payload_hash: await sha256(earlier.user), p_text: earlier.user, p_original_text: earlier.user, p_emotion: "", p_status: "confirmed" });
    const out = data as { ok?: boolean } | null;
    if (error || !out?.ok) recordError = recordError ?? "recovered_record_save_failed";
  }
  // 3) 턴 기록(관리자 관측 · 실패/성공 후보의 재료). 원문은 상태에 있고 여기엔 코드·수치만.
  const view = sessionView(sessionId, stored);
  const kind = String(response.kind ?? "");
  const text4 = [response.reply, response.closing, response.question].filter((x) => typeof x === "string" && x).join("\n");
  const record = {
    turn_index: lastTurn?.n ?? null, session_id: sessionId, agent: A.AGENT_VERSION, input_mode: st.mode, tone: st.tone, kind,
    saved: response.saved === true, extracted: lastTurn?.extracted ?? [], recovered: lastTurn?.recovered ?? [], recovered_from: lastTurn?.recovered_from ?? [], dropped: lastTurn?.dropped ?? null, hint_shown: !!lastTurn?.hint, question_check: lastTurn?.check ?? null, decision: lastTurn?.decision ?? kind, question_index: A.coreAsked(st).length,
    question_purpose: lastTurn?.question_purpose ?? null, next_purpose: response.question_purpose ?? null,
    // v2.0: 서버 말 종류 가드(guard)가 바로잡은 턴은 규칙 이름을 남긴다(LLM 이 무엇이라 했는지 → 서버가 무엇으로 봤는지).
    guard: lastTurn?.guard ?? null, superseded: lastTurn?.superseded ?? 0,
    // 2026-10-01 Failure Intelligence 코드(보기 · 도움 행동) — 사용자 사실이 아니다(관리자 실패 후보의 재료).
    fi: lastTurn?.fi ?? [], rescue: { shown: !!st.current?.rescue_show, options: st.current?.choices?.length ?? 0, fallback: !!st.current?.rescue_fallback },
    flags: { ui_correction: !!ui, correction: kind === "correction", rejection: kind === "repair" && lastTurn?.guard?.rule !== "fatigue", complaint: kind === "repair" && lastTurn?.guard?.rule !== "fatigue", skip: kind === "skip", fatigue: kind === "stop" || lastTurn?.guard?.rule === "fatigue", unsure: kind === "unsure", ask: kind === "ask", help: kind === "help", blocked: kind === "blocked", choice: !!lastTurn?.choice, choices_none: lastTurn?.guard?.rule === "choices_none" },
    ...aiTrace(ctx.router), calls: obs.calls, retry: obs.retry,
    ...A.versionTrace(), failure_intelligence_version: FAILURE_INTELLIGENCE_VERSION, // 2026-09-26 VERSION TRACE: 에이전트·프롬프트·서버 규칙·파이프라인 판(실패를 판과 묶는다)
    tone_mismatch_observed: text4 ? A.toneMismatch(st.tone, text4) : false, id_leak: A.leaksId(text4),
    record_id: recordId, record_error: recordError, total_ms: Date.now() - t0,
  };
  const turnRow = { action: TURN_ACTION, target_id: sessionId, status: "applied", payload_hash: await sha256(`${sessionId}:${text}`), applied_revision: rev + 1, response_payload: { turn: turnOut, record } };
  let turnError: unknown = null;
  if (ctx.claim?.turnRow) {
    // 잡아 둔 자리를 턴 기록으로 바꾼다(그 자리가 아직 이 요청의 처리 중일 때만)
    //   쓰기 오류면 두 번 더(자리를 잃은 경우 = 다시 하지 않음). 끝내 못 바꾸면 자리는 처리 중(하루 한도에 셈)으로 남고, 재전송은 위 상태 속 결과로 답한다.
    for (let i = 0; i < 3; i++) {
      let fin = ctx.admin.from("doit_request_events").update({ ...turnRow, error_code: null, updated_at: new Date().toISOString() })
        .eq("user_id", ctx.userId).eq("request_id", requestId).eq("action", CLAIM_ACTION).eq("status", "pending");
      if (ctx.claim.attempt != null) fin = fin.eq("applied_revision", ctx.claim.attempt);
      const { data: done, error } = await fin.select("request_id");
      turnError = error ?? (!done || !done.length ? "claim_lost" : null);
      if (!error) break;
    }
  } else {
    ({ error: turnError } = await ctx.admin.from("doit_request_events").insert({ user_id: ctx.userId, request_id: requestId, ...turnRow }));
    // 2026-10-05 Codex echo-review(5991933980): 첫 답 시작의 턴 기록(= 하루 한도용 사용 기록)을 못 쓰면 자리를 「결과 모름」으로 남긴다(applied 로 끝내지 않음 · 하루 한도에 계속 셈)
    if (ctx.claim) {
      if (turnError) await settleClaim(ctx.admin, ctx.userId, ctx.claim.id, TURN_UNCERTAIN, ctx.claim.attempt);
      else if (!(await finishClaim(ctx.admin, ctx.userId, ctx.claim.id, ctx.claim.attempt))) return unconfirmed(ctx.origin);
    }
  }
  logDiag({ step: "turn", kind, saved: record.saved, decision: record.decision, q: record.question_index, calls: obs.calls.length, retry: obs.retry,
    tokens_in: obs.calls.reduce((n, c) => n + (c.input_tokens ?? 0), 0), tokens_out: obs.calls.reduce((n, c) => n + (c.output_tokens ?? 0), 0),
    model: obs.calls.find((c) => c.model)?.model ?? null, provider: record.provider, fallback: record.fallback, policy: record.ai_policy_version, record_error: recordError, turn_log_error: !!turnError, ms: record.total_ms,
    ...(response.finish ? { intro: st.intro?.status ?? null, intro_lines: st.intro?.lines.length ?? 0, intro_dropped: st.intro?.dropped ?? {}, intro_error: st.intro?.error ?? null } : {}) });
  return json({ ok: true, session: view, turn: turnOut }, 200, ctx.origin);
}

// 도구: 후보 조회 = 기존 연결 서버 doit-connect 의 사용자 본인 동작(my_candidates) 하나 — 그 사용자의 로그인 토큰으로(권한 그대로 · 새 키 0).
// 결과에서 개수·준비 부족 이유 코드만 읽는다(후보 id·이유 글은 Agent 상태에 넣지 않음). 시간 초과·오류 = failed(성공이라 하지 않음).
const CONNECT_ACTION = "my_candidates";
async function candidatesTool(baseUrl: string, anonKey: string, authHeader: string): Promise<{ outcome: R.ToolOutcome; count: number | null; missing: string[]; code: string | null; ms: number }> {
  const t0 = Date.now();
  if (!baseUrl) return { outcome: "failed", count: null, missing: [], code: "not_configured", ms: 0 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), R.RUN_LIMITS.tool_timeout_ms);
  try {
    const res = await fetch(`${baseUrl}/functions/v1/doit-connect`, { method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey }, body: JSON.stringify({ action: CONNECT_ACTION }) });
    const data = await res.json().catch(() => null);
    return { ...R.candidatesOutcome(res.status, data), ms: Date.now() - t0 };
  } catch {
    return { outcome: "failed", count: null, missing: [], code: ctrl.signal.aborted ? "timeout" : "network", ms: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  let budgetDone: (() => Promise<void>) | null = null; // 회사 예산 예약을 잡은 요청이면 응답 전에 정산
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405, origin);
  try {
    if (Number(req.headers.get("content-length") ?? 0) > BODY_MAX_BYTES) return fail("TOO_LARGE", "요청이 너무 커요.", 413, origin);
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) return fail("ERROR", "서버 저장 설정이 필요해요.", 500, origin);
    const sb: Db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
    const admin: Db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userId = user.id;
    if (rateLimited(userId)) return fail("RATE_LIMITED", "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.", 429, origin);

    const body = (await req.json().catch(() => null)) as Json | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("BAD_REQUEST", "요청 형식이 잘못됐어요.", 400, origin);
    const action = typeof body.action === "string" ? body.action : "";
    if (!ACTIONS.has(action)) return fail("BAD_REQUEST", "알 수 없는 요청이에요.", 400, origin);
    const since = roundStartOf(user);

    if (action === "agent_get") {
      // v2.3: 기기가 기억한 세션 id 가 있으면 그 세션(다른 기기의 다른 목적 세션을 섞어 보이지 않는다). 없으면 예전처럼 가장 최근 세션.
      const want = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      const row = (want ? await sessionById(admin, userId, want, since) : null) ?? await currentSession(admin, userId, since);
      const notes = (await selfNotesRow(admin, userId)).notes;
      const ftCfg = FT.freeTalkConfig((k) => Deno.env.get(k));
      const free_talk = ftCfg.enabled ? await (async () => { const f = await freeStatus(admin, userId, ftCfg, (user.app_metadata ?? null) as Record<string, unknown> | null); return { enabled: true, entitled: f.entitled, trial_left: f.trial_left, daily_left: f.daily_left }; })() : { enabled: false };
      // 검수 P2-6: 대화 세션이 없어도(사주·타로 [반영할게요]만 한 사람) 자기 문장은 보고 지울 수 있어야 한다 → known 을 따로도 준다
      return json({ ok: true, session: row ? sessionView(row.request_id, row.response_payload as unknown as Stored, { self_notes: notes }) : null, self_notes: notes.length, known: knownWith(row ? (row.response_payload as unknown as Stored).state : A.newState(), notes), free_talk }, 200, origin);
    }

    // 2026-10-06 대표 「기억 영수증 · ECHO가 아는 나」 — 모델 호출 0 · 턴 기록 0 · 상태만 판 번호로 저장(동시 쓰기 = 409).
    if (action === "agent_confirm" || action === "agent_forget") {
      const key = typeof body.key === "string" ? body.key.slice(0, 300) : "";
      if (action === "agent_forget" && !key) return fail("BAD_REQUEST", "지울 줄을 골라 주세요.", 400, origin);
      // 자기 문장(self:) 지우기는 세션과 무관한 보관 줄에서
      if (action === "agent_forget" && key.startsWith("self:")) {
        const row = await selfNotesRow(admin, userId);
        const at = key.slice("self:".length);
        const left = row.notes.filter((n) => (n.id ?? n.at) !== at);
        if (left.length === row.notes.length) return fail("NOT_FOUND", "지울 줄을 찾지 못했어요.", 404, origin);
        if (!(await saveSelfNotes(admin, userId, row, left))) return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 바뀌었어요. 새로 불러올게요.", 409, origin);
        const sess = (typeof body.sessionId === "string" && UUID.test(body.sessionId) ? await sessionById(admin, userId, body.sessionId, since) : null) ?? await currentSession(admin, userId, since);
        return json({ ok: true, session: sess ? sessionView(sess.request_id, sess.response_payload as unknown as Stored, { self_notes: left }) : null, known: knownWith(sess ? (sess.response_payload as unknown as Stored).state : A.newState(), left) }, 200, origin);
      }
      const want = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      const row = (want ? await sessionById(admin, userId, want, since) : null) ?? await currentSession(admin, userId, since);
      if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
      const stored = row.response_payload as unknown as Stored; const st = stored.state; const rev = Number(row.applied_revision ?? 0);
      let changed = 0;
      if (action === "agent_confirm") changed = A.confirmKnown(st);
      else if (!A.forgetKnown(st, key)) return fail("NOT_FOUND", "지울 줄을 찾지 못했어요.", 404, origin);
      if (st.phase !== "talk") { stored.profile = A.matchingProfile(st); stored.handoff = A.matchingHandoff(stored.profile); } // 지금 값이 바뀌면 매칭 프로필도 지금 상태로
      const { data, error } = await admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
        .eq("user_id", userId).eq("request_id", row.request_id).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
      if (error || !data || !data.length) return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 바뀌었어요. 새로 불러올게요.", 409, origin);
      const notes = (await selfNotesRow(admin, userId)).notes;
      logDiag({ step: action, changed, phase: st.phase });
      return json({ ok: true, session: sessionView(row.request_id, stored, { self_notes: notes }), changed }, 200, origin);
    }
    if (action === "agent_self_note") {
      const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
      const origin_ = body.origin === "ref_correction" ? "ref_correction" as const : "self" as const;
      if (text.length < 2 || text.length > SELF_NOTE_MAX) return fail("BAD_REQUEST", "두 글자 이상, 200자 안쪽으로 적어 주세요.", 400, origin);
      if (A.PRIVATE_DATA.test(text)) return fail("PRIVATE_DATA", "연락처·번호·링크는 여기에 적지 않아요.", 422, origin);
      const row = await selfNotesRow(admin, userId);
      if (row.notes.some((n) => n.text === text)) { const sess = await currentSession(admin, userId, since); return json({ ok: true, session: sess ? sessionView(sess.request_id, sess.response_payload as unknown as Stored, { self_notes: row.notes }) : null, duplicate: true }, 200, origin); }
      // 검수 P2-8: 금지어·민감 주제·위기 문장은 자기 문장으로 받지 않는다(매칭 재료로 새지 않게 · 안내 한 줄)
      if (/(데이팅|소개팅|궁합|점술|심리치료|성격검사)/.test(text) || A.SENSITIVE_TOPIC.test(text) || RT.crisisSignal(text)) return fail("NOT_ALLOWED", "이 문장은 프로필에 넣지 않을게요. 건강·돈·성·위기 같은 민감한 내용은 여기서만 기억해요.", 422, origin);
      const notes = [...row.notes, { text, at: new Date().toISOString(), origin: origin_, id: crypto.randomUUID() }].slice(-SELF_NOTES_MAX);
      if (!(await saveSelfNotes(admin, userId, row, notes))) return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 바뀌었어요. 새로 불러올게요.", 409, origin);
      const sess = await currentSession(admin, userId, since);
      logDiag({ step: action, origin: origin_, count: notes.length });
      return json({ ok: true, session: sess ? sessionView(sess.request_id, sess.response_payload as unknown as Stored, { self_notes: notes }) : null, known: knownWith(sess ? (sess.response_payload as unknown as Stored).state : A.newState(), notes), note: { text, at: notes.at(-1)!.at } }, 200, origin);
    }

    // 2026-10-06 관리자: 유료 자유 대화 이번 달 요약(수치만 · 글 0 · 모델 0). 관리자 역할은 서버가 다시 확인한다.
    if (action === "admin_free_summary") {
      if (!(await isAdmin(admin, userId))) return fail("FORBIDDEN", "관리자 권한이 없어요.", 403, origin);
      const cfg = FT.freeTalkConfig((k) => Deno.env.get(k));
      const price = routerForRequest(req.signal).policy.providers.openai?.price ?? null;
      const monthStart = (() => { const k = new Date(Date.now() + 9 * 3_600_000); return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3_600_000).toISOString(); })();
      const { data, error } = await admin.from("doit_request_events").select("user_id, status, error_code, free:response_payload->free").eq("action", CLAIM_ACTION).like("payload_hash", "free:%").gte("created_at", monthStart).limit(5000);
      if (error) return fail("ERROR", "요약을 불러오지 못했어요.", 500, origin);
      let usd = 0, tin = 0, tout = 0, calls = 0, failed = 0, requests = 0; const users = new Set<string>();
      for (const r of (data ?? []) as unknown as (FreeRow & { user_id: string })[]) {
        if (!(r.status === "applied" || r.status === "pending" || /UNCERTAIN/.test(String(r.error_code ?? "")))) continue;
        requests++; users.add(r.user_id); if (r.status !== "applied") failed++;
        const c = r.free?.cost_usd; if (typeof c === "number" && Number.isFinite(c)) usd += c;
        const t = r.free?.tokens as { in?: unknown; out?: unknown; calls?: unknown } | undefined; tin += Number(t?.in ?? 0) || 0; tout += Number(t?.out ?? 0) || 0; calls += Number(t?.calls ?? 0) || 0;
      }
      return json({ ok: true, enabled: cfg.enabled, month_start: monthStart, users: users.size, requests, failed, calls, tokens_in: tin, tokens_out: tout, krw: cfg.krwPerUsd == null ? null : Math.ceil(usd * cfg.krwPerUsd), price_known: !!price && cfg.krwPerUsd != null,
        limits: { trial: cfg.trials, daily: cfg.daily, user_month_krw: cfg.monthKrw, company_month_krw: cfg.companyMonthKrw, max_cost_usd: cfg.maxCostUsd } }, 200, origin);
    }
    if (action === "admin_sessions" || action === "admin_session") {
      if (!(await isAdmin(admin, userId))) return fail("FORBIDDEN", "관리자 권한이 없어요.", 403, origin);
      if (action === "admin_sessions") {
        const { data, error } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
          .eq("action", SESSION_ACTION).eq("status", "applied").order("updated_at", { ascending: false }).limit(ADMIN_LIST_MAX);
        if (error) return fail("ERROR", "대화 목록을 읽지 못했어요.", 500, origin);
        const rows = (data ?? []) as SessionRow[];
        const ids = rows.map((r) => r.request_id);
        const { data: turns } = ids.length ? await admin.from("doit_request_events").select("target_id, created_at, response_payload").eq("action", TURN_ACTION).in("target_id", ids).limit(2000) : { data: [] };
        const userIds = [...new Set(rows.map((r) => r.user_id))];
        const { data: profs } = userIds.length ? await admin.from("profiles").select("id, nickname, verification_status, bio").in("id", userIds) : { data: [] };
        const profRows = (profs ?? []) as { id: string; nickname: string | null; verification_status: string | null; bio: string | null }[];
        const nick = new Map(profRows.map((p) => [p.id, p.nickname]));
        // 연결 준비의 부족 조건(MASTER §20): 참·거짓만 보낸다. 전화번호·인증번호·소개 글은 보내지 않는다.
        const ready = new Map(profRows.map((p) => [p.id, { phone_verified: p.verification_status === "verified", intro_saved: !!(p.bio ?? "").trim() }]));
        // 사진은 이미 있는 칸만 읽는다(장수·대표 사진·마지막으로 올린 시각). 사진 파일·주소는 주지 않는다. 최근 2개월 확인 상태는 저장하는 칸이 없다(새 칸 = 승인 필요).
        const { data: photoRows } = userIds.length ? await admin.from("profile_photos").select("user_id, is_primary, updated_at").in("user_id", userIds) : { data: [] };
        const photos = new Map<string, { count: number; primary: boolean; last_updated_at: string | null }>();
        for (const ph of (photoRows ?? []) as { user_id: string; is_primary: boolean | null; updated_at: string | null }[]) {
          const cur = photos.get(ph.user_id) ?? { count: 0, primary: false, last_updated_at: null };
          cur.count++; if (ph.is_primary) cur.primary = true; if (ph.updated_at && (!cur.last_updated_at || ph.updated_at > cur.last_updated_at)) cur.last_updated_at = ph.updated_at;
          photos.set(ph.user_id, cur);
        }
        return json({ ok: true, sessions: rows.map((r) => ({ id: r.request_id, user: r.user_id.slice(0, 8), nickname: nick.get(r.user_id) ?? null, created_at: r.created_at, updated_at: r.updated_at, stored: r.response_payload, photos: photos.get(r.user_id) ?? { count: 0, primary: false, last_updated_at: null }, readiness: ready.get(r.user_id) ?? { phone_verified: false, intro_saved: false } })),
          turns: ((turns ?? []) as { target_id: string; created_at: string; response_payload: Json | null }[]).map((t) => ({ session_id: t.target_id, created_at: t.created_at, record: (t.response_payload as Json | null)?.record ?? null })) }, 200, origin);
      }
      const id = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      if (!id) return fail("BAD_REQUEST", "대화를 골라 주세요.", 400, origin);
      const { data: row } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, response_payload").eq("action", SESSION_ACTION).eq("request_id", id).maybeSingle();
      if (!row) return fail("NOT_FOUND", "대화를 찾지 못했어요.", 404, origin);
      const { data: turns } = await admin.from("doit_request_events").select("created_at, response_payload").eq("action", TURN_ACTION).eq("target_id", id).order("created_at", { ascending: true }).limit(200);
      return json({ ok: true, session: { id, user: String(row.user_id).slice(0, 8), created_at: row.created_at, updated_at: row.updated_at, stored: row.response_payload },
        turns: ((turns ?? []) as { created_at: string; response_payload: Json | null }[]).map((t) => ({ created_at: t.created_at, record: t.response_payload?.record ?? null })) }, 200, origin);
    }

    // ── 대화(agent_start · agent_turn)
    const requestId = typeof body.requestId === "string" && UUID.test(body.requestId) ? body.requestId : "";
    if (!requestId) return fail("BAD_REQUEST", "요청 식별값이 없어요.", 400, origin);
    const { data: prior } = await admin.from("doit_request_events").select("action, status, error_code, target_id, payload_hash, response_payload, updated_at, applied_revision").eq("user_id", userId).eq("request_id", requestId).maybeSingle();
    const router = routerForRequest(req.signal);
    const aiReady = (kind: Parameters<A.Llm>[0]) => router.usable(kind).length > 0; // 키·모델·전달 허용이 갖춰진 제공사가 하나라도 있나(키 값은 보지 않음)
    // 회사 한 달 AI 예산(켜져 있을 때만): 이 요청의 첫 업체 호출 직전에 예약 한 번(재시도·전환 포함 최대 금액) · 거절·장부 응답 없음·금액 미정 = 업체 호출 0.
    const budgetCfg = CB.budgetConfig();
    let llm: A.Llm = router.llm;
    if (budgetCfg) {
      const rpc: CB.Rpc = (fn, args) => admin.rpc(fn, args);
      let held: { key: string; attempt: string } | null = null, stop = false;
      llm = async (kind, system, input) => {
        if (!held && !stop) {
          const max = CB.maxKrw(router.policy, budgetCfg);
          // Codex P2(4186974029): 예약 열쇠 = 사용자·동작·요청 id 로 정한 값(시도마다 새로 만들지 않음) — 시도 UUID 는 정산 주인 표시로만.
          //   앞선 시도의 예약이 아직 「reserved」(정산 전에 끊긴 요청)면 같은 요청을 다시 보내도 새 예약·업체 호출 0(DUPLICATE:reserved = 막음).
          //   앞선 예약이 정산까지 끝났으면(실패 뒤 다시 보내기) 다음 번호 열쇠로 새 예약 — 최대 MAX_LEDGER_TRIES 번.
          const attempt = crypto.randomUUID();
          const base = `${userId}:${action}:${requestId}`;
          const fingerprint = await sha256(`${action}:${requestId}:${router.policy.version}`);
          let r: CB.ReserveResult = { ok: false, code: "UNPRICED" }, key = "";
          if (max != null) for (let n = 0; n < MAX_LEDGER_TRIES; n++) {
            key = await sha256(n ? `${base}:${n}` : base);
            r = await CB.reserve(rpc, { key, fingerprint, attempt, maxKrw: max });
            if (r.ok || !("code" in r) || !r.code.startsWith("DUPLICATE:") || r.code === "DUPLICATE:reserved") break;
            if (n === MAX_LEDGER_TRIES - 1) r = { ok: false, code: "RETRY_LIMIT" };
          }
          if (r.ok) { held = { key, attempt }; if (r.level !== "OK") logDiag({ step: "company_budget", level: r.level }); }
          else { stop = true; companyHalted.add(router); logDiag({ step: "company_budget", code: "code" in r ? r.code : "REFUSED" }); }
        }
        if (stop) throw new Error("company_budget");
        return router.llm(kind, system, input);
      };
      budgetDone = async () => { if (!held) return; logDiag({ step: "company_budget_settle", result: await CB.settle(rpc, { key: held.key, attempt: held.attempt, actualKrw: CB.actualKrw(router.summary(), budgetCfg) }) }); };
    }
    const ctx = { admin, userId, llm, router, origin };
    // 사용자 하루 한도: 모델을 「실제로 부르기 직전」에만 본다(세기 실패 = 막지 않음 · 기록만). 같은 요청 재전송 재생 · 이미 있는 세션 돌려주기 · agent_run · agent_intro_mark 처럼 모델 호출이 없는 길은 막지 않는다.
    // reserved = 이미 써 둔 자리 수(자리를 쓴 「뒤」 다시 셀 때 1 — 그 자리까지 합쳐 한도를 넘는지)
    const reloadSession = async (sid: string): Promise<Stored | null> => {
      const { data } = await admin.from("doit_request_events").select("response_payload").eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).maybeSingle();
      return (data?.response_payload as unknown as Stored | null) ?? null;
    };
    const dailyCapped = async (reserved = 0): Promise<Response | null> => {
      const used = await userDailyTurns(admin, userId);
      // 2026-10-05 Codex echo-review(5990054694): 사용량을 못 세면 유료 호출을 시작하지 않는다(모르는 사용량 = 0 으로 보지 않음 · 이 함수는 모델이 필요한 새 요청에서만 불림)
      if (used == null) { logDiag({ step: "daily_count", error: true }); return fail("AI_USAGE_UNKNOWN", "지금은 사용량을 확인하지 못했어요. 잠시 뒤 다시 보내 주세요.", 503, origin); }
      if (used >= USER_DAILY_TURNS + reserved) { logDiag({ step: "daily_limit", used }); return fail("AI_DAILY_LIMIT", "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이어서 해 주세요.", 429, origin); }
      return null;
    };

    // 카드 해석·참고 이야기(대화 상태·프로필·매칭과 분리된 유료 호출 한 번)가 함께 쓰는 보호:
    //   끝난 요청 재전송 = 보관한 결과(AI 준비 확인보다 먼저 · Codex P2 4184790634) → AI 사전 확인 → 자리 잡기(하루 한도) → 호출 →
    //   사용 기록 한 줄 → 모양이 틀리면 502(가짜 성공 0) → 결과를 자리에 보관. 사용 기록을 못 남기면 자리 = 결과 모름(하루 한도에 계속 셈).
    const paidOnce = async <T,>(o: { tag: string; key: string; hash: string; kind: Parameters<A.Llm>[0]; run: (obs: A.Obs) => Promise<T | null>; reply: (r: T, duplicate: boolean) => Json; aiMsg: string; fmtMsg: string; keep?: (r: T) => Json; noReplay?: boolean; capped?: (reserved?: number) => Promise<Response | null> }): Promise<Response> => {
      const claimId = await derivedUuid(`${requestId}:claim:${o.tag}`);
      // 보안 검수(P2): noReplay = 결과 글을 서버에 남기지 않는 동작(참고 이야기) — 끝난 요청을 다시 보내면 보관한 답 대신 「이미 보냄」(409 · 앱은 새 요청으로 다시 보낼 수 있음)
      const replayKept = (k: T | undefined) => !k ? fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin)
        : o.noReplay ? fail("ALREADY_DONE", "이미 보낸 말이에요. 다시 보내면 새로 답할게요.", 409, origin)
        : json({ ok: true, ...o.reply(k, true), duplicate: true }, 200, origin);
      const kept = (row: { response_payload?: unknown } | null) => (row?.response_payload as Json | null)?.[o.key] as T | undefined;
      const { data: prior } = await admin.from("doit_request_events").select("action, status, error_code, target_id, payload_hash, updated_at, applied_revision, response_payload").eq("user_id", userId).eq("request_id", claimId).maybeSingle();
      if (prior && prior.action === CLAIM_ACTION && prior.status === "applied" && (prior.target_id ?? null) === null && prior.payload_hash === o.hash) {
        const k = kept(prior);
        return replayKept(k);
      }
      if (!aiReady(o.kind)) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
      const admit = await admitClaim(admin, userId, { id: claimId, target: null, hash: o.hash, paid: true, capped: o.capped ?? dailyCapped, origin, prior: (prior ?? null) as ClaimRow | null }); // capped 를 바꿔 끼우면(자유 대화 상한) 사용자 잠금 안에서 함께 센다(동시 요청 초과 0)
      if (admit.res) return admit.res;
      if (admit.done) {
        const { data: row } = await admin.from("doit_request_events").select("response_payload").eq("user_id", userId).eq("request_id", claimId).eq("action", CLAIM_ACTION).maybeSingle();
        const k = kept(row);
        return replayKept(k);
      }
      const attempt = admit.attempt;
      const obs: A.Obs = { calls: [], retry: [] };
      let result: T | null = null;
      try { result = await o.run(obs); }
      catch (e) {
        const halt = haltedBy(router);
        const ok = await keepUsage(ctx, null, halt ? `${o.tag}_${halt}` : `${o.tag}_error`);
        await settleClaim(admin, userId, claimId, keptOr(ok, halt ? `HALT_${halt}` : "AI_ERROR"), attempt);
        if (halt) return haltFail(halt, origin);
        logDiag({ step: o.tag, code: "ai_error", ai_errors: router.log.filter((x) => !x.ok).map((x) => `${x.provider ?? "-"}:${x.error}`), policy: router.policy.version });
        void e; return fail("AI_ERROR", o.aiMsg, 502, origin);
      }
      const usageOk = router.summary().calls > 0 ? await usageOnce(ctx, null, o.tag, claimId, attempt, aiTrace(router)) : true;
      if (!result) {
        await settleClaim(admin, userId, claimId, keptOr(usageOk, "AI_FORMAT"), attempt);
        logDiag({ step: o.tag, code: "format", calls: obs.calls.length });
        return fail("AI_FORMAT", o.fmtMsg, 502, origin);
      }
      if (!usageOk) { await settleClaim(admin, userId, claimId, TURN_UNCERTAIN, attempt); return json({ ok: true, ...o.reply(result, false) }, 200, origin); }
      if (!(await finishClaim(admin, userId, claimId, attempt, { [o.key]: (o.keep ? o.keep(result) : result as unknown as Json) }))) return unconfirmed(origin);
      logDiag({ step: o.tag, calls: obs.calls.length, model: obs.calls.find((c) => c.model)?.model ?? null, provider: router.summary().provider, policy: router.policy.version });
      return json({ ok: true, ...o.reply(result, false) }, 200, origin);
    };

    // 2026-10-05 대표 지시 「카드 해석 실패 이유를 알아내서 최종 완성」(Codex echo-spec 20261005 카드 해석 A): QA 에 예전 openai-chat 이 없어 해석이 늘 실패했다.
    //   받는 것 = 카드 이름 + 관계 목적 글(선택) · 대화 상태·프로필·매칭 쓰기 0 · 해석 글은 이 요청 자리(claim) 안에만 남는다.
    if (action === "agent_card") {
      const input = CR.cardInput(body.cardName, body.purpose);
      if (!input) return fail("BAD_REQUEST", "카드를 다시 골라 주세요.", 400, origin);
      return await paidOnce<CR.CardReading>({ tag: "card", key: "card", hash: await sha256(`card:${input.card}:${input.purpose}`), kind: "card_reading",
        run: (obs) => CR.readCard(input.card, input.purpose, ctx.llm, obs), reply: (r) => ({ reading: r as unknown as Json }),
        aiMsg: "해석을 만들지 못했어요. 같은 카드로 다시 해 볼 수 있어요.", fmtMsg: "해석 모양이 잘못 왔어요. 같은 카드로 다시 해 볼 수 있어요." });
    }

    // 2026-10-05 Codex echo-spec 20261005 B: 결과 뒤 참고 이야기(질문 기본 0 · 저장 0). 받는 것 = 결과 종류 + 이번 이야기 앞 줄(최대 8) + 지금 말.
    //   빈 말 = 여는 한 줄(모델 0) · 그만/질문 싫음 = 짧은 한 줄(모델 0) · 질문은 이번 말이 직접 청할 때만 한 개.
    if (action === "agent_ref") {
      const seed = RT.refSeed(body.ref);
      const history = RT.refHistory(body.history);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!seed || !history || text.length > RT.REF_TEXT_MAX) return fail("BAD_REQUEST", "이야기를 다시 시작해 주세요.", 400, origin);
      // Codex P1(4187208757): 전화·이메일·링크·식별번호가 든 말은 모델에 보내지 않는다(agent_turn 과 같은 PRIVATE_DATA) — 앞 줄도 같은 기준(든 줄이 있으면 요청 전체 거절).
      if (history.some((l) => A.PRIVATE_DATA.test(l.text))) return fail("BAD_REQUEST", "이야기를 다시 시작해 주세요.", 400, origin);
      if (text && A.PRIVATE_DATA.test(text)) return fail("PRIVATE_DATA", "연락처·번호·링크는 여기에 적지 않아요. 그 부분만 빼고 다시 적어 주세요.", 422, origin);
      if (!text) return json({ ok: true, reply: RT.refOpener(seed), question: null }, 200, origin);
      // 제품 기준: 위기 신호면 분석·질문 생성을 멈추고 안전 안내(모델 호출 0 · 저장 0 · 강제 종료 아님)
      if (RT.crisisSignal(text)) return json({ ok: true, reply: RT.CRISIS_LINE, question: null, crisis: true }, 200, origin);
      if (RT.wantsStop(text)) return json({ ok: true, reply: RT.STOP_LINE, question: null }, 200, origin);
      // 2026-10-06 대표 「사주·타로 정정 → 매칭 사용」: 해석을 부정하고 자기 말로 고치면 고정 영수증(모델 0 · 저장 0) + correction 후보 → 화면이 「프로필에도 반영할까요?」를 묻고 [반영할게요]일 때만 agent_self_note.
      { const d = RT.denyInterpretation(text); if (d) return json({ ok: true, reply: RT.denyReceipt(seed, d.text), question: null, correction: { text: d.text } }, 200, origin); }
      const allow = RT.asksQuestion(text);
      const talkHistory = history.filter((l) => !(l.role === "user" && RT.crisisSignal(l.text))); // 위기 원문은 모델에 다시 보내지 않는다
      return await paidOnce<RT.RefReply>({ tag: "ref", key: "ref", hash: await sha256(`ref:${JSON.stringify(seed)}:${JSON.stringify(history)}:${text}`), kind: "ref_talk",
        run: (obs) => RT.refTalk(seed, talkHistory, text, allow, ctx.llm, obs), reply: (r) => ({ reply: r.reply, question: r.question }),
        aiMsg: "답을 만들지 못했어요. 같은 말로 다시 보내 볼 수 있어요.", fmtMsg: "답 모양이 잘못 왔어요. 같은 말로 다시 보내 볼 수 있어요.",
        keep: () => ({ done: true }), noReplay: true }); // 답 글은 서버에 남기지 않는다(자리 끝남 표시만)
    }

    // 2026-10-06 대표 「유료 자유 대화」(C·D·E): 스위치 꺼짐 = 503 · 권한(유료·QA 시험용) 없으면 맛보기 3회 · 하루·월 상한 · 요청당 호출/토큰 상한 · OpenAI 첫 후보만 · 답 글 저장 0(사용량·금액만).
    if (action === "agent_free_talk") {
      const cfg = FT.freeTalkConfig((k) => Deno.env.get(k));
      if (!cfg.enabled) return fail("FREE_TALK_OFF", "자유 대화는 아직 열리지 않았어요.", 503, origin);
      const history = FT.freeHistory(body.history);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!history || !text || text.length > FT.FREE_TEXT_MAX) return fail("BAD_REQUEST", "할 말을 적어 주세요.", 400, origin);
      if (history.some((l) => A.PRIVATE_DATA.test(l.text)) || FT.historyTainted(history)) return fail("BAD_REQUEST", "이야기를 다시 시작해 주세요.", 400, origin); // 검수 P2-7: 앞 줄도 같은 가드
      // 단가(정책 openai.price)·환율이 없으면 금액을 셀 수 없다 = 호출 0(503 · 2026-10-06 인계 보강). 요청당 토큰 상한은 금액 상한(0.01달러)으로 다시 계산.
      const tokenCap = FT.freeTokenCap(cfg, router.policy.providers.openai?.price ?? null);
      if (cfg.krwPerUsd == null || tokenCap == null || tokenCap < 1000) { logDiag({ step: "free_config", rate: cfg.krwPerUsd != null, price: tokenCap != null }); return fail("FREE_TALK_CONFIG", FT.CONFIG_LINE, 503, origin); }
      const appMeta = (user.app_metadata ?? null) as Record<string, unknown> | null;
      // 상한 판정(맛보기·하루·월) — 자리 잡기 잠금 안에서 다시 센다(freeCapped · 동시 요청 두 개가 같은 마지막 한 번을 둘 다 쓰지 못하게)
      const freeLimit = (f: Awaited<ReturnType<typeof freeStatus>>): Response | null => {
        const m: "paid" | "trial" | null = f.entitled ? "paid" : f.trial_left > 0 ? "trial" : null;
        if (!m) return json({ ok: false, code: "TRIAL_USED", error: FT.trialNotice(0), trial_left: 0, entitled: false }, 402, origin);
        if (f.company_krw == null || f.company_krw >= cfg.companyMonthKrw) return json({ ok: false, code: "FREE_TALK_COMPANY", error: FT.COMPANY_LINE, trial_left: f.trial_left, entitled: f.entitled }, 503, origin); // 회사 월 상한(못 세면 닫힘)
        if (f.daily_left <= 0) return json({ ok: false, code: "FREE_TALK_DAILY", error: FT.DAY_LINE, trial_left: f.trial_left, entitled: f.entitled }, 429, origin);
        if (f.month_krw != null && f.month_krw >= cfg.monthKrw) return json({ ok: false, code: "FREE_TALK_MONTH", error: FT.MONTH_LINE, trial_left: f.trial_left, entitled: f.entitled }, 429, origin);
        return null;
      };
      const st = await freeStatus(admin, userId, cfg, appMeta);
      { const r = freeLimit(st); if (r) return r; }
      const mode: "paid" | "trial" = st.entitled ? "paid" : "trial";
      const freeCapped = async (reserved = 0): Promise<Response | null> => (await dailyCapped(reserved)) ?? freeLimit(await freeStatus(admin, userId, cfg, appMeta));
      // 안전 가드(모델 0 · 저장 0): 위기 → 안전 안내 · 연락처 422 · 성적 표현 · 규칙 무시/타인 정보 · 연인 역할극
      const g = FT.freeGuard(text);
      if (g) { logDiag({ step: "free_guard", kind: g.kind }); return g.status === 200 ? json({ ok: true, reply: g.reply, ai: false, guard: g.kind, trial_left: st.trial_left, entitled: st.entitled }, 200, origin) : fail(g.code, g.reply, g.status, origin); }
      // 모델: 정책의 free_talk 첫 후보가 OpenAI 가 아니면 부르지 않는다(검증 전 Claude·Gemini 비활성)
      const first = router.explain("free_talk").order[0] ?? null;
      if (first !== "openai") return fail("FREE_TALK_PROVIDER", "자유 대화는 아직 준비 중이에요.", 503, origin);
      router.limitTo({ calls: cfg.maxCalls, tokens: tokenCap }); // 요청당 호출 3 · 토큰 8,000 과 금액 0.01달러 중 작은 쪽(재시도 포함)
      // 답변 재료 = 본인 「아는 나」(확인·고친 것·거절 의미·짐작 표시)만 — 다른 사용자 0
      const sess = await currentSession(admin, userId, since);
      const known = knownWith(sess ? (sess.response_payload as unknown as Stored).state : A.newState(), (await selfNotesRow(admin, userId)).notes);
      const talkHistory = history.filter((l) => !(l.role === "user" && RT.crisisSignal(l.text)));
      const tag = mode === "trial" ? "free:trial" : "free:paid";
      return await paidOnce<FT.FreeReply>({ tag: "free", key: "free", hash: `${tag}:${await sha256(`free:${JSON.stringify(history)}:${text}`)}`, kind: "free_talk",
        run: (obs) => FT.freeTalk(known, talkHistory, text, ctx.llm, obs),
        reply: (r) => ({ reply: r.reply, ai: true, trial_left: mode === "trial" ? Math.max(0, st.trial_left - 1) : st.trial_left, entitled: st.entitled, notice: mode === "trial" ? FT.trialNotice(Math.max(0, st.trial_left - 1)) : null }),
        aiMsg: "답을 만들지 못했어요. 적은 말은 그대로 있어요.", fmtMsg: "답 모양이 잘못 왔어요. 다시 보내 볼 수 있어요.",
        keep: () => { const u = router.summary(); return { done: true, mode, cost_usd: u.cost_complete ? u.cost_usd : null, tokens: { in: u.tokens_in, out: u.tokens_out, calls: u.calls } }; }, noReplay: true, capped: freeCapped }); // 답 글 0 · 금액·토큰만(월 상한 계산용)
    }

    if (action === "agent_start") {
      // 이번 회차에 이미 대화가 있으면 새로 만들지 않고 그것을 돌려준다(같은 요청 재전송 포함).
      // v2.3: 같은 목적(goal)의 세션만 이어받는다. 다른 기기에서 다른 목적으로 시작한 세션은 이어받지 않고 새 세션을 만든다.
      const goal = A.isGoal(body.goal) ? body.goal : null;
      const goalLabel = goal && typeof body.goalLabel === "string" ? body.goalLabel.trim().slice(0, 40) || null : null;
      if (body.goal != null && !goal) return fail("BAD_REQUEST", "고른 만남을 다시 골라 주세요.", 400, origin);
      const existing = await currentSession(admin, userId, since, goal);
      if (existing) {
        // Codex P2(4183520284): 이 요청이 만든 세션인데 마무리만 못 했으면(503) 그 유료 자리를 여기서 끝낸다(하루 한도 이중 셈 0)
        const firstSid = await derivedUuid(`${requestId}:session`);
        if (existing.request_id === requestId || existing.request_id === firstSid) {
          const done = await reconcilePaid(ctx, { claimId: await derivedUuid(`${requestId}:claim:start`), claimTarget: null, usageTarget: existing.request_id, why: "opening", ...(existing.request_id === firstSid ? { turnRowId: requestId } : {}) });
          if (done === false) return unconfirmed(origin);
        }
        return json({ ok: true, session: sessionView(existing.request_id, existing.response_payload as unknown as Stored), existing: true }, 200, origin);
      }
      if (prior) return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
      const tone = A.isTone(body.tone) ? body.tone : A.DEFAULT_TONE;
      const mode = body.mode === "VOICE" ? "VOICE" : "TEXT";
      const firstRaw = typeof body.firstAnswer === "string" ? body.firstAnswer.trim().slice(0, TEXT_MAX) : "";
      // 2026-10-10 MVP 마감(제품 기준 「위기 신호 → 분석·질문 생성 멈춤 · 안전 안내 · 원문은 개인화 재료로 쓰지 않음」):
      //   첫 답이 위기 신호면 그 말은 모델·저장에 쓰지 않고(첫 답 없이 시작) 응답에 안전 안내를 함께 준다(강제 종료 아님).
      const startCrisis = !!firstRaw && RT.crisisSignal(firstRaw);
      const first = startCrisis ? "" : firstRaw;
      const stored: Stored = { agent: A.AGENT_VERSION, state: A.newState({ tone, mode, goal: goal ?? "open", goalLabel }), round_since: since, profile: null, handoff: null };
      if (first) A.seedFirstQuestion(stored.state);
      // 이미 있는 세션은 위에서 돌려줌(모델 0). 새로 만들 때: 첫 질문 만들기 = 모델 호출 · 첫 답은 모델이 필요할 때만(개인정보 안내 등 = 모델 0) AI 사전 확인
      const startPaid = !first || await callsModel(stored, (st, llm) => A.runTurn(st, first, llm, { ui: null }));
      // 2026-10-05 Codex(other-actions): 모델을 부를 시작이면 AI 호출 전에 자리를 잡는다(같은 요청 동시 2개 = 한쪽만 · 하루 마지막 한 번 = 한 요청만)
      const startClaim = startPaid ? await derivedUuid(`${requestId}:claim:start`) : null;
      let startAttempt: number | undefined;
      if (startPaid) {
        // 첫 답이 없으면 다음 호출은 첫 질문 만들기(opening) 하나 → 그 작업의 경로로 확인(작업별 정책 존중)
        if (!aiReady(first ? "turn" : "opening")) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
        const admit = await admitClaim(admin, userId, { id: startClaim!, target: null, hash: await sha256(`start:${goal ?? ""}:${first}`), paid: true, capped: dailyCapped, origin });
        if (admit.res) return admit.res;
        if (admit.done) return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
        startAttempt = admit.attempt;
      }
      const settleStart = async (code: string) => { if (startClaim) await settleClaim(admin, userId, startClaim, code, startAttempt); };
      if (first) {
        // 앱의 첫 질문(목적 타일 화면)에 한 답 = 첫 턴. 세션 id 는 요청 id 에서 만들고, 턴 기록은 요청 id 로 남긴다.
        try {
          return await runAndSave(startClaim ? { ...ctx, claim: { id: startClaim, turnRow: false, attempt: startAttempt } } : ctx, await derivedUuid(`${requestId}:session`), stored, 0, first, requestId, true);
        } catch (e) { await settleStart(TURN_UNCERTAIN); throw e; }
      }
      try {
      const obs: A.Obs = { calls: [], retry: [] };
      const opened = await A.runOpening(stored.state, ctx.llm, obs).catch(() => null);
      if (!opened) {
        logDiag({ step: "opening", code: "failed", calls: obs.calls.length, ai_errors: router.log.filter((x) => !x.ok).map((x) => `${x.provider ?? "-"}:${x.error}`), policy: router.policy.version });
        // 세션이 아직 없어 대화 예산에는 못 넣는다 → 실패 턴 기록(status failed)으로 남겨 하루 한도에 센다(새 요청 id 로 되풀이해 한도 우회 0 · 원문 0).
        let openingKept = true;
        if (router.summary().calls > 0) {
          const failed = { turn_index: null, session_id: null, agent: A.AGENT_VERSION, kind: "error", error: "OPENING", saved: false, decision: "error", ...aiTrace(router), ...A.versionTrace(), calls: obs.calls, retry: obs.retry };
          const { error: failLogError } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: crypto.randomUUID(), action: TURN_ACTION, target_id: null, status: "failed", // 새 id — 같은 요청을 다시 보내도 409 가 아니게
            payload_hash: await sha256(`opening:error:${requestId}`), applied_revision: 0, response_payload: { record: failed } });
          if (failLogError) { logDiag({ step: "opening_fail_log", error: true }); openingKept = false; }
        }
        await settleStart(keptOr(openingKept, "OPENING")); // 사용량은 위 실패 턴 기록에
        // 사용자가 끊은 경우는 다른 모델 경로처럼 499(CANCELLED) — 사용 기록은 위에서 남겼다(리뷰 5401309056)
        { const h = haltedBy(router); if (h === "cancelled" || h === "company") return haltFail(h, origin); }
        return fail("AI_ERROR", "첫 질문을 만들지 못했어요. 다시 눌러 주세요.", 502, origin);
      }
      { const u = router.summary(); stored.run = R.syncRun(null, stored.state, new Date().toISOString(), { calls: u.calls, tokens_in: u.tokens_in, tokens_out: u.tokens_out, tokens_unconfirmed: u.tokens_reserved_unconfirmed }); }
      const { error } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: requestId, action: SESSION_ACTION, status: "applied", payload_hash: "", applied_revision: 1, response_payload: stored });
      const usageOk = startClaim && startAttempt != null && router.summary().calls > 0 ? await usageOnce(ctx, error ? null : requestId, "opening", startClaim, startAttempt, aiTrace(router)) : await logUsage(ctx, error ? null : requestId, "opening"); // 첫 질문 만들기도 하루 한도에 셈(성공·저장 실패 모두 · 자리마다 한 줄)
      if (error) { await settleStart(keptOr(usageOk, "LOST_RACE")); return fail("REQUEST_CONFLICT", "대화를 시작하지 못했어요. 다시 눌러 주세요.", 409, origin); }
      if (startClaim) { if (!usageOk) await settleStart(TURN_UNCERTAIN); else if (!(await finishClaim(admin, userId, startClaim, startAttempt))) return unconfirmed(origin); } // Codex P1(4182156210): 사용 기록이 남은 뒤에만 자리를 끝냄
      logDiag({ step: "opening", calls: obs.calls.length, model: obs.calls.find((c) => c.model)?.model ?? null, provider: router.summary().provider, fallback: router.summary().fallback, policy: router.policy.version });
      return json({ ok: true, session: sessionView(requestId, stored), ...(startCrisis ? { crisis: true, reply: RT.CRISIS_LINE } : {}) }, 200, origin);
      } catch (e) { await settleStart(TURN_UNCERTAIN); throw e; }
    }

    // v1.6 소개 초안 다시 쓰기 · 사용자가 고른 것 기록(agent_intro · agent_intro_mark). 판 번호로 동시 쓰기를 막는다. 턴 기록·doit_records 는 만들지 않는다.
    if (action === "agent_intro" || action === "agent_intro_mark") {
      const sid = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      if (!sid) return fail("BAD_REQUEST", "대화를 찾지 못했어요.", 400, origin);
      const { data: row } = await admin.from("doit_request_events").select("request_id, created_at, applied_revision, response_payload")
        .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).maybeSingle();
      if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
      const stored = row.response_payload as unknown as Stored;
      if (stored.state.phase === "talk") return fail("NOT_READY", "다섯 가지 이야기를 마친 뒤에 소개를 쓸 수 있어요.", 409, origin);
      const rev = Number(row.applied_revision ?? 0);
      let obs: A.Obs = { calls: [], retry: [] }; let limited = false; let introClaim: string | null = null; let introAttempt: number | undefined;
      if (action === "agent_intro_mark") {
        const how = typeof body.how === "string" && INTRO_USES.has(body.how) ? body.how as "as_is" | "edited" | "own" : null;
        if (!how) return fail("BAD_REQUEST", "잘못된 요청이에요.", 400, origin);
        const base = stored.state.intro ?? { status: "none" as const, lines: [], dropped: {}, tries: 0, error: null, used: null, used_at: null };
        stored.state.intro = { ...base, used: how, used_at: new Date().toISOString() };
      } else {
        // Codex P2(4183520274): 같은 요청의 소개가 이미 저장됐으면(마무리만 못 함) 다시 쓰지 않고 그 자리를 끝낸 뒤 저장된 상태로 답한다(모델 0)
        const introClaimId = await derivedUuid(`${requestId}:claim:intro`);
        if (stored.intro_claim?.id === introClaimId) {
          const done = await reconcilePaid(ctx, { claimId: introClaimId, claimTarget: sid, usageTarget: sid, why: "intro", attempt: stored.intro_claim.attempt });
          if (done === false) return unconfirmed(origin);
          if (done === "other_attempt") return fail("REQUEST_CONFLICT", "같은 요청을 아직 처리하고 있어요. 잠시 뒤 다시 불러올게요.", 409, origin); // 더 새 시도의 자리·사용 기록은 그대로
          return json({ ok: true, session: sessionView(sid, stored), limited: false, duplicate: true }, 200, origin);
        }
        // 모델을 부를 때만 AI 사전 확인(설정 · 대화 예산 · 하루 한도). 상한 도달·들은 말 없음 = 모델 0 → 평소 결과(limited · 빈 소개)
        if (await callsModel(stored, (st, llm) => A.draftIntro(st, llm))) {
          if (!aiReady("intro")) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
          if (!R.modelAllowed(stored.run)) return fail("AI_BUDGET", "이 대화에서 쓸 수 있는 AI 사용량을 다 썼어요.", 429, origin);
          // 2026-10-05 Codex(other-actions): AI 호출 전에 자리 잡기 — 같은 요청 동시 2개 = 한쪽만 · 하루 마지막 한 번 = 한 요청만 · 끝난 같은 요청 = 지금 상태 그대로(호출 0)
          introClaim = introClaimId;
          const admit = await admitClaim(admin, userId, { id: introClaim, target: sid, hash: await sha256(`intro:${sid}`), paid: true, capped: dailyCapped, origin });
          if (admit.res) return admit.res;
          if (admit.done) { const now = await reloadSession(sid); return json({ ok: true, session: sessionView(sid, now ?? stored), limited: false, duplicate: true }, 200, origin); } // Codex P2(4182589949): 끝난 같은 요청 = 지금 저장된 상태로
          introAttempt = admit.attempt;
        }
        try {
          router.limitTo(R.remainingBudget(stored.run));
          const r = await A.draftIntro(stored.state, ctx.llm, obs); obs = r.obs; limited = r.limited;
          const halt = haltedBy(router);
          if (halt) { const ok = await keepUsage(ctx, sid, `intro_${halt}`); if (introClaim) await settleClaim(admin, userId, introClaim, keptOr(ok, `HALT_${halt}`), introAttempt); return haltFail(halt, origin); } // 끊김·예산 멈춤 = 쓰던 소개를 「실패」로 덮지 않음
          if (router.summary().calls > 0) foldUsage(stored, router); // 소개 호출도 대화 예산에
        } catch (e) { if (introClaim) await settleClaim(admin, userId, introClaim, TURN_UNCERTAIN, introAttempt); throw e; }
      }
      let usageOk = true;
      if (!limited) {
        if (introClaim && introAttempt != null) stored.intro_claim = { id: introClaim, attempt: introAttempt }; // 같은 요청 재전송 = 저장된 소개로(다시 쓰기 0)
        const { data, error } = await admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
          .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
        if (error || !data || !data.length) { const ok = await keepUsage(ctx, sid, "intro_lost_race"); if (introClaim) await settleClaim(admin, userId, introClaim, keptOr(ok, "LOST_RACE"), introAttempt); return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 바뀌었어요. 새로 불러올게요.", 409, origin); }
        usageOk = introClaim && introAttempt != null && router.summary().calls > 0 ? await usageOnce(ctx, sid, "intro", introClaim, introAttempt, aiTrace(router)) : await logUsage(ctx, sid, "intro"); // 하루 한도에 셈(예산은 위 저장에 들어감 · 자리마다 한 줄)
      }
      if (introClaim) { if (!usageOk) await settleClaim(admin, userId, introClaim, TURN_UNCERTAIN, introAttempt); else if (!(await finishClaim(admin, userId, introClaim, introAttempt))) return unconfirmed(origin); } // Codex P1(4182156210)
      const intro = stored.state.intro;
      logDiag({ step: action, intro: intro?.status ?? null, lines: intro?.lines.length ?? 0, dropped: intro?.dropped ?? {}, error: intro?.error ?? null, used: intro?.used ?? null, limited,
        calls: obs.calls.length, tokens_in: obs.calls.reduce((n, c) => n + (c.input_tokens ?? 0), 0), tokens_out: obs.calls.reduce((n, c) => n + (c.output_tokens ?? 0), 0), model: obs.calls.find((c) => c.model)?.model ?? null, provider: router.summary().provider, ai_fallback: router.summary().fallback, policy: router.policy.version });
      return json({ ok: true, session: sessionView(sid, stored), limited }, 200, origin);
    }

    // 2026-10-01 「잘 모르겠어요」 = 구조 요청(답 아님). 턴·답 기록 0 · 상태(보기 · 요청 수)만 판 번호로 저장.
    if (action === "agent_rescue") {
      const sid = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      if (!sid) return fail("BAD_REQUEST", "대화를 찾지 못했어요.", 400, origin);
      const { data: row } = await admin.from("doit_request_events").select("request_id, created_at, applied_revision, response_payload")
        .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).maybeSingle();
      if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
      const stored = row.response_payload as unknown as Stored;
      if (stored.state.phase !== "talk" || !stored.state.current) return json({ ok: true, session: sessionView(sid, stored) }, 200, origin);
      // 모델을 부를 때만 AI 사전 확인. 들고 있던 보기·대체 보기 = 모델 0 → 설정·예산·한도와 무관하게 보여 준다
      let rescueClaim: string | null = null; let rescueAttempt: number | undefined;
      const rescueClaimId = await derivedUuid(`${requestId}:claim:rescue`);
      if (!(await callsModel(stored, (st, llm) => A.requestRescue(st, llm)))) {
        // Codex P2(4183132885): 앞선 시도가 보기를 저장하고 마무리만 못 했으면(503) 그 자리를 여기서 끝낸다
        if ((await reconcilePaid(ctx, { claimId: rescueClaimId, claimTarget: sid, usageTarget: sid, why: "rescue" })) === false) return unconfirmed(origin);
      } else {
        if (!aiReady("choices")) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
        if (!R.modelAllowed(stored.run)) return fail("AI_BUDGET", "이 대화에서 쓸 수 있는 AI 사용량을 다 썼어요.", 429, origin);
        // 2026-10-05 Codex(other-actions): AI 호출 전에 자리 잡기 — 같은 요청 동시 2개 = 한쪽만 · 하루 마지막 한 번 = 한 요청만 · 끝난 같은 요청 = 지금 상태 그대로(호출 0)
        rescueClaim = rescueClaimId;
        const admit = await admitClaim(admin, userId, { id: rescueClaim, target: sid, hash: await sha256(`rescue:${sid}:${stored.state.current.text}`), paid: true, capped: dailyCapped, origin });
        if (admit.res) return admit.res;
        if (admit.done) { const now = await reloadSession(sid); return json({ ok: true, session: sessionView(sid, now ?? stored), duplicate: true }, 200, origin); } // Codex P2(4182589949)
        rescueAttempt = admit.attempt;
      }
      const rev = Number(row.applied_revision ?? 0);
      let r: Awaited<ReturnType<typeof A.requestRescue>>;
      try {
        router.limitTo(R.remainingBudget(stored.run));
        r = await A.requestRescue(stored.state, ctx.llm);
      } catch (e) { if (rescueClaim) await settleClaim(admin, userId, rescueClaim, TURN_UNCERTAIN, rescueAttempt); throw e; }
      const halt = haltedBy(router);
      if (halt) { const ok = await keepUsage(ctx, sid, `rescue_${halt}`); if (rescueClaim) await settleClaim(admin, userId, rescueClaim, keptOr(ok, `HALT_${halt}`), rescueAttempt); return haltFail(halt, origin); } // 끊김·예산 멈춤 = 대체 보기를 굳히지 않음
      if (router.summary().calls > 0) foldUsage(stored, router); // 보기 호출도 대화 예산에(들고 있던 보기 = 호출 0 → 그대로)
      const { data, error } = await admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
        .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
      if (error || !data || !data.length) { const ok = await keepUsage(ctx, sid, "rescue_lost_race"); if (rescueClaim) await settleClaim(admin, userId, rescueClaim, keptOr(ok, "LOST_RACE"), rescueAttempt); return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 바뀌었어요. 새로 불러올게요.", 409, origin); }
      const usageOk = rescueClaim && rescueAttempt != null && router.summary().calls > 0 ? await usageOnce(ctx, sid, "rescue", rescueClaim, rescueAttempt, aiTrace(router)) : await logUsage(ctx, sid, "rescue"); // 하루 한도에 셈(자리마다 한 줄)
      if (rescueClaim) { if (!usageOk) await settleClaim(admin, userId, rescueClaim, TURN_UNCERTAIN, rescueAttempt); else if (!(await finishClaim(admin, userId, rescueClaim, rescueAttempt))) return unconfirmed(origin); } // Codex P1(4182156210)
      logDiag({ step: "rescue", options: stored.state.current?.choices?.length ?? 0, fallback: !!stored.state.current?.rescue_fallback, fi: r.fi, calls: r.obs.calls.length, retry: r.obs.retry, provider: router.summary().provider, ai_fallback: router.summary().fallback, policy: router.policy.version });
      return json({ ok: true, session: sessionView(sid, stored) }, 200, origin);
    }

    // 2026-10-03 실행 단계(agent_run): 지금 상태로 계획을 맞추고, 서버가 정한 도구 하나만 실행 → 결과 기록 → 완료·질문·보류·중단. 모델 호출 0.
    // 도구 = 허용 목록(R.TOOLS)뿐 · 사용자 몫 행동(상호 선택·동의·약속) 실행 0. 같은 요청 id = 저장된 결과 · 도구가 도는 사이 정정되면(판 번호) 결과를 버린다.
    if (action === "agent_run") {
      const sid = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      if (!sid) return fail("BAD_REQUEST", "대화를 찾지 못했어요.", 400, origin);
      // 다시 잡기: ① 도구를 부르기 전에 실패(failed · STATE_CHANGED/MARK_FAILED)로 끝난 같은 요청 id ② 도구 시작 표시 없이 끊겨 오래 남은 pending(임대 시간 RUN_LEASE_MS 지남)
      //   — 앱은 성공 전까지 같은 id 를 다시 보낸다. 다시 잡기도 상태(+ pending 이면 마지막 갱신 시각) 조건 update 라 동시에 다시 잡는 요청 중 하나만 실행한다.
      //   도구를 부르기 직전에 실행 행에 「도구 시작(TOOL_STARTED)」을 적는다. 이 표시가 있는 오래된 pending 은 도구(my_candidates — 조회 전에 후보 준비 쓰기 포함)가
      //   이미 돌았을 수 있으므로 같은 요청 id 로는 다시 잡지 않는다: 세션에 그 요청 결과가 있으면 재생, 없으면 복구 가능한 409(RUN_UNCERTAIN · 행은 failed/TOOL_UNCERTAIN 로 남김).
      //   앱은 RUN_UNCERTAIN 을 받으면 그 요청 id 를 내려놓는다 → 사용자가 다시 누르면 새 요청(새 실행). 같은 요청 id 의 도구 실행 = 최대 1번(장애 포함 · 표시 저장이 실패하면 도구를 부르지 않음).
      let reclaim: { status: "failed" | "pending"; updatedAt: string | null } | null = null;
      if (prior) {
        const p = prior.response_payload as Json | null;
        if (prior.action === RUN_ACTION && prior.target_id === sid) {
          const { data: again } = await admin.from("doit_request_events").select("request_id, response_payload").eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).maybeSingle();
          if (again && p?.run) return json({ ok: true, session: sessionView(sid, again.response_payload as unknown as Stored), run: p.run, tool: p.tool ?? null, duplicate: true }, 200, origin);
          // 먼저 잡아 둔 요청(pending)인데 결과 기록이 비었으면: 세션에 함께 저장된 그 요청의 결과로(도구 재실행 0) · 아직 처리 중이면 409
          const kept = again ? (again.response_payload as unknown as Stored).run?.recent_requests?.find((x) => x.id === requestId) : undefined;
          if (again && kept?.run) return json({ ok: true, session: sessionView(sid, again.response_payload as unknown as Stored), run: kept.run, tool: kept.tool, duplicate: true }, 200, origin);
          const stale = prior.status === "pending" && typeof prior.updated_at === "string" && Date.now() - Date.parse(prior.updated_at) > RUN_LEASE_MS;
          if (!p?.run && prior.status === "pending" && !stale) return fail("REQUEST_CONFLICT", "같은 요청을 아직 처리하고 있어요. 잠시 뒤 다시 불러올게요.", 409, origin);
          if (!p?.run && (prior.error_code === RUN_TOOL_STARTED || prior.error_code === RUN_TOOL_UNCERTAIN)) {
            // 도구가 돌았는지 확인할 수 없는 요청: 다시 실행하지 않는다(성공처럼 처리 0 · 행 삭제 0)
            if (prior.status === "pending") await admin.from("doit_request_events").update({ status: "failed", error_code: RUN_TOOL_UNCERTAIN, updated_at: new Date().toISOString() })
              .eq("user_id", userId).eq("request_id", requestId).eq("action", RUN_ACTION).eq("status", "pending").eq("updated_at", prior.updated_at);
            logDiag({ step: "run", code: "uncertain" });
            return fail("RUN_UNCERTAIN", "지난 확인 결과를 불러오지 못했어요. 다시 눌러 새로 확인해 주세요.", 409, origin);
          }
          if (!p?.run && (prior.status === "failed" || stale)) reclaim = { status: prior.status as "failed" | "pending", updatedAt: (prior.updated_at as string | null) ?? null };
        }
        if (!reclaim) return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
      }
      const { data: row } = await admin.from("doit_request_events").select("request_id, created_at, applied_revision, response_payload")
        .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).maybeSingle();
      if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
      const stored = row.response_payload as unknown as Stored;
      if (since && (stored.round_since ?? null) !== since && String(row.created_at) < since) return fail("ROUND_CHANGED", "처음부터 다시 시작한 대화예요. 새로 불러올게요.", 409, origin);
      // 재생 기록(agent_run 행)이 남지 않았어도, 세션에 함께 저장된 마지막 실행 요청이면 그 결과를 돌려준다(도구 재실행 0)
      const kept = stored.run?.recent_requests?.find((x) => x.id === requestId);
      // 돌려주는 실행 기록은 그 요청 당시의 것(kept.run) — 그 뒤 다른 요청이 실행 기록을 바꿔도 같은 요청의 결과(outcome·next)는 그대로
      if (kept) return kept.run ? json({ ok: true, session: sessionView(sid, stored), run: kept.run, tool: kept.tool, duplicate: true }, 200, origin)
        : fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
      const rev = Number(row.applied_revision ?? 0);
      // 도구를 부르기 전에 요청 id 를 먼저 잡는다(사용자·요청 id 고유 제약) → 같은 id 가 겹쳐 들어와도 도구는 한 번만(나중 것 = 409)
      const runHash = await sha256(`${sid}:run:${rev}`);
      if (reclaim) {
        // 실패 행을 pending 으로 되돌리는 것도 한 번만 성공(상태가 failed 인 행만 · 겹친 요청은 0행 → 409)
        let q = admin.from("doit_request_events").update({ status: "pending", error_code: null, payload_hash: runHash, updated_at: new Date().toISOString() })
          .eq("user_id", userId).eq("request_id", requestId).eq("action", RUN_ACTION).eq("status", reclaim.status);
        if (reclaim.status === "pending") q = q.eq("updated_at", reclaim.updatedAt); // 오래 남은 pending 은 본 그 시각 그대로일 때만(겹친 다시 잡기 = 0행 → 409)
        const { data: claimed, error: claimError } = await q.select("request_id");
        if (claimError || !claimed || !claimed.length) return fail("REQUEST_CONFLICT", "같은 요청을 아직 처리하고 있어요. 잠시 뒤 다시 불러올게요.", 409, origin);
      } else {
        const { error: reserveError } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: requestId, action: RUN_ACTION, target_id: sid, status: "pending", payload_hash: runHash });
        if (reserveError) return reserveError.code === "23505" ? fail("REQUEST_CONFLICT", "같은 요청을 아직 처리하고 있어요. 잠시 뒤 다시 불러올게요.", 409, origin) : fail("ERROR", "서버 오류가 발생했어요.", 500, origin);
      }
      const t0 = Date.now();
      let run = R.syncRun(stored.run, stored.state, new Date().toISOString());
      if (body.resume === true && run.user_stopped) run = R.resumeRun(run, stored.state, new Date().toISOString()); // 사용자가 직접 누른 「다시 이어서」만
      const due = R.dueTool(run, Date.now());
      let tool: { tool: R.ToolId; outcome: R.ToolOutcome; count: number | null; code: string | null } | null = null;
      if (due.tool === "candidates") {
        // 도구 시작 표시(같은 요청 id 로 다시 잡혀 후보 준비 쓰기가 또 도는 것 방지) — 표시를 못 남기면 도구를 부르지 않는다
        const { data: marked, error: markError } = await admin.from("doit_request_events").update({ error_code: RUN_TOOL_STARTED, updated_at: new Date().toISOString() })
          .eq("user_id", userId).eq("request_id", requestId).eq("action", RUN_ACTION).eq("status", "pending").select("request_id");
        if (markError || !marked || !marked.length) {
          await admin.from("doit_request_events").update({ status: "failed", error_code: "MARK_FAILED" }).eq("user_id", userId).eq("request_id", requestId).eq("action", RUN_ACTION).eq("status", "pending");
          return fail("ERROR", "서버 오류가 발생했어요. 다시 시도해 주세요.", 500, origin);
        }
        const r = await candidatesTool(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", authHeader);
        run = R.recordTool(run, stored.state, { tool: "candidates", ...r, at: new Date().toISOString() }, new Date().toISOString());
        tool = { tool: "candidates", outcome: r.outcome, count: r.count, code: r.code };
      }
      const view = R.runView(run)!; // 실행 기록 보기는 recent_requests 를 담지 않는다 → 저장 전에 만들어 요청별로 함께 남긴다
      run.recent_requests = [...(run.recent_requests ?? []), { id: requestId, tool, run: view }].slice(-R.RUN_LIMITS.requests_kept);
      stored.run = run;
      const { data: saved, error: saveError } = await admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
        .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
      if (saveError || !saved || !saved.length) {
        logDiag({ step: "run", code: "stale", tool: tool?.outcome ?? null });
        // 도구가 이미 돌았으면(후보 준비 쓰기 포함) 같은 요청 id 로 다시 잡지 않도록 불확실 표시(리뷰 4175329388) · 도구 없이 끝난 실행만 STATE_CHANGED(다시 잡기 가능)
        await admin.from("doit_request_events").update({ status: "failed", error_code: tool ? RUN_TOOL_UNCERTAIN : "STATE_CHANGED" }).eq("user_id", userId).eq("request_id", requestId).eq("action", RUN_ACTION);
        return fail("STATE_CHANGED", "그사이 대화가 바뀌어 이 결과는 쓰지 않았어요. 다시 불러올게요.", 409, origin);
      }
      const { error: runLogError } = await admin.from("doit_request_events").update({ status: "applied", applied_revision: rev + 1, response_payload: { run: view, tool } })
        .eq("user_id", userId).eq("request_id", requestId).eq("action", RUN_ACTION);
      logDiag({ step: "run", outcome: run.outcome, waiting: run.waiting, plan_rev: run.plan_rev, tool: tool?.outcome ?? null, tool_code: tool?.code ?? null, count: tool?.count ?? null, skipped: due.tool ? null : due.why, run_log_error: !!runLogError, ms: Date.now() - t0 });
      return json({ ok: true, session: sessionView(sid, stored), run: view, tool, model_calls: router.summary().calls }, 200, origin); // 실행 단계 자체의 모델 호출 = 0(라우터를 쓰지 않음)
    }

    // agent_turn
    const sessionId = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
    // v2.2.1 P0-5: 화면 정정(body.correction · 예전 앱의 고정 머리 「「칸」 부분을 고칠게요.」)은 사용자 말만 떼어 정정으로 넘긴다.
    const ui = A.uiCorrectionFrom(body as { text?: unknown; correction?: unknown });
    if (body.correction != null && !ui) return fail("BAD_REQUEST", "고칠 칸을 다시 골라 주세요.", 400, origin);
    const text = ui ? ui.text : typeof body.text === "string" ? body.text.trim() : "";
    if (!sessionId || !text) return fail("BAD_REQUEST", "보낼 말을 적어 주세요.", 400, origin);
    if (text.length > TEXT_MAX) return fail("TOO_LARGE", `한 번에 ${TEXT_MAX}자까지 보낼 수 있어요.`, 400, origin);
    // 2026-10-10 MVP 마감: 위기 신호 → 분석·질문 생성을 멈추고 안전 안내(모델 0 · 저장 0 · 턴 기록 0 · 세션 그대로 = 강제 종료 아님).
    //   원문은 저장하지 않으므로 이후 대화·프로필·추천 재료가 되지 않는다. 같은 세션에서 다른 말을 보내면 평소대로 이어진다.
    if (RT.crisisSignal(text)) {
      const { data: cur } = await admin.from("doit_request_events").select("request_id, response_payload")
        .eq("user_id", userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).maybeSingle();
      if (!cur || !cur.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
      logDiag({ step: "turn", code: "crisis" });
      return json({ ok: true, session: sessionView(sessionId, cur.response_payload as unknown as Stored), crisis: true,
        turn: { kind: "crisis", reply: RT.CRISIS_LINE, question: null, saved: false, finish: false, after: true, receipt: null } }, 200, origin);
    }
    const turnHash = await sha256(`${sessionId}:${text}`);
    // 같은 요청 id 가 이미 있으면: 끝난 턴 = 저장된 결과(모델 0) · 그 밖(처리 중 · 놓은 자리 · 결과 모름 · 다른 요청)은 아래 자리 잡기(admitClaim)가 정한다
    if (prior) {
      const p = prior.response_payload as Json | null;
      if (prior.action === TURN_ACTION && prior.target_id === sessionId && p?.turn) {
        const { data: again } = await admin.from("doit_request_events").select("request_id, response_payload").eq("user_id", userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).maybeSingle();
        if (again) return json({ ok: true, session: sessionView(sessionId, again.response_payload as unknown as Stored), turn: p.turn, duplicate: true }, 200, origin);
      }
      if (prior.action !== CLAIM_ACTION) return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
    }
    const { data: row } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
      .eq("user_id", userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).maybeSingle();
    if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
    const stored = row.response_payload as unknown as Stored;
    if (since && (stored.round_since ?? null) !== since && String(row.created_at) < since) return fail("ROUND_CHANGED", "처음부터 다시 시작한 대화예요. 새로 불러올게요.", 409, origin);
    // Codex P2(4182589941): 상태에는 이미 반영됐는데 턴 기록 마무리를 못 한 같은 요청 = 상태 속 결과로 답한다(모델 0 · 다시 돌리기 0)
    const savedTurn = prior?.action === CLAIM_ACTION ? stored.last_turns?.find((x) => x.rid === requestId) : undefined;
    if (savedTurn) return json({ ok: true, session: sessionView(sessionId, stored), turn: savedTurn.turn, duplicate: true }, 200, origin);
    // Codex P2(4182821579): 결과가 상태에서 밀려났더라도, 이 요청이 자리를 잡은 뒤 대화가 이미 앞으로 갔으면 옛 말을 다시 돌리지 않는다(모델 0 · 다시 불러오기)
    //   기준 = 턴 수(실패한 시도의 사용량 접기는 판 번호만 올리고 턴은 늘리지 않음 → 다시 보내기 정상 처리)
    const baseTurns = (prior?.action === CLAIM_ACTION ? (prior.response_payload as Json | null)?.base_turns : null);
    if (typeof baseTurns === "number" && stored.state.turns.length > baseTurns) return fail("STATE_CHANGED", "그사이 대화가 이어졌어요. 새로 불러올게요.", 409, origin);
    // 같은 요청 재전송은 위에서 저장된 결과로(모델 0). 모델이 필요 없는 입력(개인정보 안내 · 마친 대화 상한 · 보기 모두 아님)은 AI 사전 확인 없이 평소 응답.
    const turnOpts = { ui, choice: typeof body.choice === "string" ? body.choice.slice(0, 40) : undefined, rescueOpen: body.rescueOpen === true };
    const needsModel = await callsModel(stored, (st, llm) => A.runTurn(st, text, llm, turnOpts));
    if (needsModel) {
      if (!aiReady("turn")) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
      if (!R.modelAllowed(stored.run)) return fail("AI_BUDGET", "이 대화에서 쓸 수 있는 AI 사용량을 다 썼어요.", 429, origin);
    }
    // 자리 잡기: 사용자 잠금 안에서 「하루 한도 세기 → 이 요청의 자리 잡기」(AI 호출은 잠금 밖 · 자리를 잡은 요청만 AI 를 부른다)
    const admit = await admitClaim(admin, userId, { id: requestId, target: sessionId, hash: turnHash, paid: needsModel, capped: dailyCapped, origin, prior: prior as ClaimRow | null, payload: { base_turns: stored.state.turns.length } });
    if (admit.res) return admit.res;
    if (admit.done) return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
    try {
      return await runAndSave({ ...ctx, claim: { id: requestId, turnRow: true, attempt: admit.attempt } }, sessionId, stored, Number(row.applied_revision ?? 0), text, requestId, false, ui, { choice: turnOpts.choice, rescueOpen: turnOpts.rescueOpen });
    } catch (e) {
      await settleClaim(admin, userId, requestId, needsModel ? TURN_UNCERTAIN : "FAILED", admit.attempt); // 결과를 모름 — 유료 자리는 하루 한도에 계속 세고, 임대 시간 뒤에만 다시 잡는다
      throw e;
    }
  } catch (e) {
    logDiag({ step: "unhandled", code: e instanceof Error ? e.name : "unknown" });
    return fail("ERROR", "서버 오류가 발생했어요.", 500, origin);
  } finally {
    // 예약을 잡은 요청은 성공·실패와 관계없이 정산(장부 쓰기 실패 = 예약 유지 → 보수적으로 막힘)
    if (budgetDone) await budgetDone().catch(() => logDiag({ step: "company_budget_settle", error: true }));
  }
});
