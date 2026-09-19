// get-step-question — HTTP 진입·DB·상태 전환
// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  AI_STEP,
  DISPLAY_STEP,
  LIMITS,
  USER_STEP,
  canAnswer,
  canCompleteFreeStage,
  isChoice,
  isStatus,
  isUserQuestion,
  isValidToken,
  nextStatusAfterAnswer,
  validateSingleQuestion,
  type Choice,
  type Context,
  type Memory,
  type MessageKind,
  type MessageRow,
  type Status,
  type UnderstandingRow
} from "./rules.ts";
import {
  followupMode,
  genFollowupQuestion,
  genStep1Question,
  genStep2Question,
  genUnderstanding,
  isLowInformationReply,
  isMetaFeedback,
  renderFollowupTurn,
  resolveModel,
  type Ai
} from "./ai.ts";
// ═══════════════════════════ db.ts (DB·중복 요청 선점) ═══════════════════════════
// get-step-question — DB 접근·중복 요청 선점·상태 응답 (index.ts 에서 사용)
// 인증은 사용자 토큰을 실검증한다. 상태 쓰기는 서비스 역할 클라이언트로만 수행하고 모든 조회·변경에 사용자 소유권을 함께 검사한다.
// 원문은 로그에 남기지 않는다.


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const CORS_HEADERS = corsHeaders;

const PENDING_MARK = "pending";
const PENDING_STALE_MS = 90_000; // 선점 후 이 시간이 지나면 죽은 요청으로 보고 새 요청이 넘겨받는다

type Db = SupabaseClient;

interface ConversationRow {
  id: string;
  user_id: string;
  status: string;
  current_step: number | null;
  request_token: string | null;
  request_action: string | null;
  updated_at: string | null;
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const fail = (code: string, error: string, status = 200) => json({ ok: false, code, error }, status);

// ── DB ──
const CONV_COLUMNS = "id, user_id, status, current_step, request_token, request_action, updated_at";

async function loadConversation(sb: Db, userId: string, conversationId: string): Promise<ConversationRow | null> {
  const { data, error } = await sb.from("conversations").select(CONV_COLUMNS).eq("id", conversationId).maybeSingle();
  if (error || !data || data.user_id !== userId) return null;
  return data as ConversationRow;
}

async function loadContext(sb: Db, conversationId: string): Promise<Context> {
  const startedAt = Date.now();
  const [emotionRes, msgRes, undRes] = await Promise.all([
    sb.from("emotions").select("mind_text").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    sb.from("messages").select("role, step, content, message_kind").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    sb.from("understanding_results").select("choice, rejected_interpretation, correction_text, self_explanation").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
  console.error(`[gsq] timing ctx_ms=${Date.now() - startedAt} msgs=${msgRes?.data?.length ?? 0}`);
  return {
    mindText: String(emotionRes?.data?.mind_text ?? ""),
    messages: (msgRes?.data ?? []) as MessageRow[],
    understandings: (undRes?.data ?? []) as UnderstandingRow[],
  };
}

// ⑤ 기억 조회(2026-09-17): 확인된 기억(doit_insights: confirmed·corrected, rejected 제외)과 지난 리포트 요약(참고)을 분리해 가져온다.
// 본인 소유(user_id)만, 현재 대화는 제외. 조회 실패는 '기억 없음'으로 숨기지 않고 lookupFailed 로 알린다.
const MEMORY_STALE_DAYS = 120;
function daysSince(value: unknown): number {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86_400_000)) : -1;
}
async function loadMemory(sb: Db, userId: string, excludeConversationId: string): Promise<Memory> {
  const memory: Memory = { summary: "", confirmed: [], lookupFailed: false };
  const [reportRes, insightRes] = await Promise.all([
    sb.from("reports").select("conversation_id, summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    sb.from("doit_insights").select("text, status, created_at, updated_at").eq("user_id", userId).in("status", ["confirmed", "corrected"]).order("updated_at", { ascending: false }).limit(LIMITS.MEMORY_MAX),
  ]);
  if (reportRes.error || insightRes.error) {
    memory.lookupFailed = true;
    console.error(`[gsq] memory_lookup_error reports=${reportRes.error ? "1" : "0"} insights=${insightRes.error ? "1" : "0"}`);
  }
  const prior = ((reportRes.data ?? []) as { conversation_id?: unknown; summary?: unknown }[]).find((row) => String(row.conversation_id ?? "") !== excludeConversationId);
  const summary = typeof prior?.summary === "string" ? prior.summary.trim() : "";
  memory.summary = summary.slice(0, LIMITS.SUMMARY_MAX);
  for (const row of (insightRes.data ?? []) as { text?: unknown; status?: unknown; created_at?: unknown; updated_at?: unknown }[]) {
    const text = String(row.text ?? "").trim();
    if (!text) continue;
    const age = daysSince(row.updated_at ?? row.created_at);
    const label = row.status === "corrected" ? "내가 바로잡음" : "내가 확인함";
    const stale = age >= 0 && age > MEMORY_STALE_DAYS ? ", 오래된 기록이라 지금도 같은지 확인 필요" : "";
    memory.confirmed.push(`${text.slice(0, LIMITS.MEMORY_TEXT_MAX)} (${label}${age >= 0 ? `, ${age}일 전` : ""}${stale})`);
  }
  return memory;
}

// ⑤ 확인된 기억 저장: 이해 확인 4버튼의 결과를 사용자 소유로 남긴다(기존 doit_insights 테이블, 스키마 변경 없음).
// 거절한 해석은 status='rejected' 로 남겨 다시 기억으로 불러오지 않는다. 저장 실패는 대화를 막지 않되 로그로 드러낸다.
async function saveConfirmedMemory(sb: Db, userId: string, choice: Choice, understanding: string, text: string): Promise<void> {
  const memoryText = (choice === "agree" ? understanding : text).trim().slice(0, LIMITS.UNDERSTANDING_MAX);
  if (!memoryText) return;
  const status = choice === "agree" ? "confirmed" : choice === "no" ? "rejected" : "corrected";
  const { error } = await sb.from("doit_insights").insert({
    user_id: userId,
    category: "memory",
    text: memoryText,
    ai_text: understanding.slice(0, LIMITS.UNDERSTANDING_MAX),
    source_text: understanding.slice(0, LIMITS.UNDERSTANDING_MAX),
    status,
    origin: choice === "agree" ? "ai" : "self",
  });
  if (error) console.error(`[gsq] memory_save_error choice=${choice} status=${status}`);
}

function latestOpenUnderstanding(ctx: Context): string {
  let open = "";
  for (const message of ctx.messages) {
    if (message.role === "ai" && message.step === AI_STEP.understanding && (message.message_kind === "understanding_summary" || message.message_kind === null)) open = message.content;
    if (message.role === "user" && message.message_kind === "understanding_choice") open = "";
  }
  return open;
}

// 2026-09-17: 사용자가 아직 답하지 않은 ECHO 의 턴.
// kind="question" 정상 질문 / kind="reply" 사용자의 물음에 답만 한 턴(질문 없음) / "" 없음.
// reply 턴을 '질문 없음'으로 보면 같은 단계에서 질문을 무한 재생성하므로 서버가 구분한다.
type OpenTurnKind = "question" | "reply" | "";
function latestOpenTurn(ctx: Context, step: number, aiKind: MessageKind, userKind: MessageKind): { content: string; kind: OpenTurnKind } {
  let open = "";
  let askedBefore = "";
  let lastUser = "";
  for (const message of ctx.messages) {
    if (message.role === "user") {
      lastUser = message.content;
      if (message.step === step && message.message_kind === userKind) open = "";
      continue;
    }
    if (message.step === step && (message.message_kind === aiKind || message.message_kind === null)) {
      open = message.content;
      askedBefore = lastUser;
    }
  }
  if (!open) return { content: "", kind: "" };
  if (!/\?/.test(open) && isUserQuestion(askedBefore)) return { content: open, kind: "reply" };
  // 2026-09-17 실기기 결함(빈 화면 + INVALID_STATE): 저장까지 끝난 질문을 화면에 낼 때
  // 생성 때보다 '더 센' 규칙으로 다시 검사해, 서버가 스스로 만든 질문을 스스로 지웠다.
  // 근거 검사(NOT_GROUNDED)는 생성 단계에서 이미 끝난 판정이다. 읽을 때는 형태만 본다.
  return validateSingleQuestion(open, LIMITS.QUESTION_MAX, true).ok ? { content: open, kind: "question" } : { content: "", kind: "" };
}

function latestUserEvidence(ctx: Context): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const message = ctx.messages[i];
    if (message.role === "user" && !isMetaFeedback(message.content) && !isLowInformationReply(message.content) && message.message_kind !== "understanding_choice") return message.content;
  }
  return ctx.mindText.trim();
}
function latestUserTurn(ctx: Context): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const message = ctx.messages[i];
    if (message.role === "user" && message.content.trim() !== "맞아요") return message.content;
  }
  return ctx.mindText.trim();
}

function hasUser(ctx: Context, step: number): boolean {
  return ctx.messages.some((m) => m.role === "user" && m.step === step);
}

// 현재 서버 상태 → 화면 표시용 응답. 알 수 없는 상태는 명시 오류(상태 보존).
async function stateResponse(sb: Db, conv: ConversationRow): Promise<Response> {
  if (!isStatus(conv.status)) return fail("UNKNOWN_STATE", "알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.");
  const status: Status = conv.status;
  const step = DISPLAY_STEP[status];
  if (status === "white_door_ready") return json({ ok: true, status, step, conversationId: conv.id });
  const ctx = await loadContext(sb, conv.id);
  if (status === "understanding") {
    const understanding = latestOpenUnderstanding(ctx);
    return json({ ok: true, status, step, conversationId: conv.id, understanding, previousAnswer: latestUserTurn(ctx), needsQuestion: !understanding });
  }
  const kind = status === "followup" ? "followup_question" : "step_question";
  const userKind = status === "followup" ? "followup_answer" : "step_answer";
  // 열린 턴은 질문일 수도, 사용자의 물음에 답만 한 턴일 수도 있다. 둘 다 사용자가 이어서 말할 수 있는 상태다.
  const open = latestOpenTurn(ctx, AI_STEP[status], kind, userKind);
  return json({ ok: true, status, step, conversationId: conv.id, question: open.content, previousAnswer: latestUserTurn(ctx), needsQuestion: !open.kind });
}

// 중복 요청 선점: 같은 토큰이면 재선점 불가, 다른 요청이 처리 중(pending, 신선)이면 불가.
type Claim = "claimed" | "duplicate_done" | "duplicate_pending" | "busy" | "invalid_state";
async function claimRequest(sb: Db, conv: ConversationRow, expectedStatus: string, token: string): Promise<Claim> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PENDING_STALE_MS).toISOString();
  const { data, error } = await sb
    .from("conversations")
    .update({ request_token: token, request_action: PENDING_MARK, updated_at: now.toISOString() })
    .eq("id", conv.id)
    .eq("status", expectedStatus)
    .or(`request_token.is.null,request_token.neq.${token}`)
    .or(`request_action.is.null,request_action.neq.${PENDING_MARK},updated_at.is.null,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!error && data && data.length === 1) return "claimed";

  const fresh = await loadConversation(sb, conv.user_id, conv.id);
  if (!fresh) return "invalid_state";
  if (fresh.request_token === token) return fresh.request_action === PENDING_MARK ? "duplicate_pending" : "duplicate_done";
  if (fresh.status !== expectedStatus) return "invalid_state";
  return "busy";
}

async function releaseClaim(sb: Db, conversationId: string, token: string, prev: ConversationRow) {
  await sb
    .from("conversations")
    .update({ request_token: prev.request_token, request_action: prev.request_action })
    .eq("id", conversationId)
    .eq("request_token", token);
}

async function commitState(sb: Db, conversationId: string, token: string, action: string, status: Status | "step3"): Promise<boolean> {
  const currentStep = status === "step3" ? 3 : DISPLAY_STEP[status];
  const { data, error } = await sb
    .from("conversations")
    .update({ status, current_step: currentStep, request_action: action, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("request_token", token)
    .select("id");
  return !error && !!data && data.length === 1;
}

async function insertMessage(
  sb: Db,
  conversationId: string,
  userId: string,
  role: "ai" | "user",
  step: number,
  content: string,
  messageKind: MessageKind,
): Promise<string | null> {
  const { data, error } = await sb.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    step,
    content,
    message_kind: messageKind,
  }).select("id").single();
  if (error || !data) return null;
  return String(data.id);
}

// 보상 삭제: 이번 요청이 만든 행만 되돌린다(실패해도 응답은 오류로 유지).
async function rollbackRows(sb: Db, table: string, ids: string[]) {
  if (!ids.length) return;
  await sb.from(table).delete().in("id", ids);
}

function claimError(claim: Claim): Response {
  switch (claim) {
    case "duplicate_pending":
      return fail("IN_PROGRESS", "이미 처리 중이에요. 잠시만 기다려 주세요.", 409);
    case "busy":
      return fail("IN_PROGRESS", "다른 요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.", 409);
    default:
      return fail("INVALID_STATE", "현재 단계에서는 진행할 수 없어요.");
  }
}

// ═══════════════════════════ index.ts (HTTP 진입·상태 전환) ═══════════════════════════
// get-step-question — ECHO 대화 서버 상태머신 (STEP 1 → STEP 2 → 이해 확인 → 후속 → 무료 STEP 3 진입)
//
// 보안·안정 원칙
// - 모든 요청은 토큰 getUser 실검증. Origin은 인증이 아니다.
// - 사용자 토큰으로 본인을 확인한 뒤, 브라우저가 상태를 직접 만들 수 없도록 서버 전용 권한으로만 상태를 쓴다.
// - 중복 요청: conversations.request_token/request_action 두 열로 "선점(pending) → 완료(action)" 2단계 표시.
//   조건부 UPDATE 1회로 선점하므로 같은 토큰의 동시 요청은 하나만 처리된다.
// - 사용자 원문·답변·정정은 AI 호출 전에 먼저 저장한다. 질문·요약 생성은 별도 ask 요청으로 분리한다.
//   완전한 원자성은 supabase/drafts/PENDING_20260904_echo_hardening.sql 의 RPC 적용 후 가능.
// - 알 수 없는 상태는 UNKNOWN_STATE로 명시 거절. 절대 STEP 1로 되돌리지 않는다.
// - 원문(마음 기록·답변·정정)은 로그에 남기지 않는다.


const START_RATE_WINDOW_MS = 10 * 60_000;
const START_RATE_MAX = 10;

type Json = Record<string, unknown>;

// ── 메인 ──
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);

    const userSb: Db = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const authStartedAt = Date.now();
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    console.error(`[gsq] timing auth_ms=${Date.now() - authStartedAt}`);
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);
    if (!serviceKey) return fail("ERROR", "서버 저장 설정이 필요해요.");
    const sb: Db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = resolveModel(Deno.env.get("OPENAI_MODEL"));
    const aiReady = !!apiKey && !!model;
    const ai: Ai = { apiKey, model };

    const body = (await req.json().catch(() => null)) as Json | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const token = isValidToken(body?.token) ? body.token : "";

    // ── start ──
    if (action === "start") {
      const mindText = typeof body?.mindText === "string" ? body.mindText.trim() : "";
      if (!mindText) return fail("BAD_REQUEST", "마음 기록이 없어요.");
      if (mindText.length > LIMITS.MIND_TEXT_MAX) return fail("BAD_REQUEST", `마음 기록은 ${LIMITS.MIND_TEXT_MAX}자까지 적을 수 있어요.`);
      if (!token) return fail("BAD_REQUEST", "요청 식별값이 없어요.");

      // 같은 토큰으로 이미 만든 대화가 있으면 그 상태를 돌려준다(재전송·연속 클릭)
      const { data: dup } = await sb.from("conversations").select(CONV_COLUMNS).eq("user_id", user.id).eq("request_token", token).maybeSingle();
      if (dup) return stateResponse(sb, dup as ConversationRow);

      // 요청 횟수 제한(Rate Limit): 최근 10분 내 시작 횟수
      const since = new Date(Date.now() - START_RATE_WINDOW_MS).toISOString();
      const { count } = await sb.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
      if ((count ?? 0) >= START_RATE_MAX) return fail("RATE_LIMITED", "잠시 후 다시 시도해 주세요.", 429);

      const { data: conv, error: convErr } = await sb
        .from("conversations")
        .insert({ user_id: user.id, status: "step1", current_step: 1, request_token: token, request_action: "start" })
        .select("id")
        .single();
      if (convErr || !conv) return fail("ERROR", "대화를 시작하지 못했어요.");
      const convId = String(conv.id);

      const { error: emoErr } = await sb.from("emotions").insert({ conversation_id: convId, user_id: user.id, mind_text: mindText });
      if (emoErr) {
        await rollbackRows(sb, "conversations", [convId]);
        return fail("ERROR", "마음 기록 저장에 실패했어요.");
      }
      return json({ ok: true, status: "step1", step: 1, conversationId: convId, needsQuestion: true });
    }

    if (!conversationId) return fail("BAD_REQUEST", "대화 식별값이 없어요.");
    const conv = await loadConversation(sb, user.id, conversationId);
    if (!conv) return fail("FORBIDDEN", "대화를 찾지 못했어요.", 403);

    // ── resume ──
    if (action === "resume") return stateResponse(sb, conv);

    if (!token) return fail("BAD_REQUEST", "요청 식별값이 없어요.");
    if (conv.request_token === token && conv.request_action === action) {
      if (conv.status === "step3") return json({ ok: true, status: "step3", step: 3, conversationId });
      if (isStatus(conv.status)) return stateResponse(sb, conv);
    }
    if (!isStatus(conv.status)) return fail("UNKNOWN_STATE", "알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.");

    // ── ask: 저장된 현재 상태를 바탕으로 질문 또는 이해 요약을 별도로 생성 ──
    if (action === "ask") {
      if (conv.status === "white_door_ready") return fail("INVALID_STATE", "현재 단계에서는 질문을 만들 수 없어요.");
      const before = await loadContext(sb, conversationId);
      if (conv.status === "understanding") {
        if (latestOpenUnderstanding(before)) return stateResponse(sb, conv);
      } else {
        const aiKind: MessageKind = conv.status === "followup" ? "followup_question" : "step_question";
        const userKind: MessageKind = conv.status === "followup" ? "followup_answer" : "step_answer";
        if (latestOpenTurn(before, AI_STEP[conv.status], aiKind, userKind).kind) return stateResponse(sb, conv);
      }
      if (!aiReady) return fail("AI_NOT_CONFIGURED", "AI 서버 설정 필요");
      const claim = await claimRequest(sb, conv, conv.status, token);
      if (claim === "duplicate_done") return stateResponse(sb, conv);
      if (claim !== "claimed") return claimError(claim);
      before.memory = await loadMemory(sb, user.id, conversationId);
      const created: string[] = [];
      try {
        let text = "";
        let step = AI_STEP[conv.status];
        let kind: MessageKind = conv.status === "followup" ? "followup_question" : "step_question";
        // ② 사용자가 물었으면 단계와 상관없이 먼저 답한다(후보 생성 경로가 reply 를 만든다).
        const askedNow = followupMode(before) === "asked";
        if (conv.status === "understanding") {
          text = await genUnderstanding(ai, before);
          step = AI_STEP.understanding;
          kind = "understanding_summary";
        } else if (askedNow || conv.status === "followup") {
          const candidate = await genFollowupQuestion(ai, before);
          text = renderFollowupTurn(candidate, before);
        } else if (conv.status === "step1") text = await genStep1Question(ai, before.mindText, before);
        else text = await genStep2Question(ai, before);
        const messageId = await insertMessage(sb, conversationId, user.id, "ai", step, text, kind);
        if (!messageId) throw new Error("DB_AI_MSG");
        created.push(messageId);
        if (!(await commitState(sb, conversationId, token, "ask", conv.status))) throw new Error("DB_STATE");
        return stateResponse(sb, { ...conv, request_token: token, request_action: "ask" });
      } catch (e) {
        await rollbackRows(sb, "messages", created);
        await releaseClaim(sb, conversationId, token, conv);
        const msg = (e as Error).message;
        if (msg === "NO_CANDIDATE") return fail("NO_CANDIDATE", "질문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        if (msg.startsWith("DB_")) return fail("ERROR", "질문 저장에 실패했어요. 다시 시도해 주세요.");
        return fail("AI_ERROR", "AI 응답을 받지 못했어요.");
      }
    }

    // ── answer ──
    if (action === "answer") {
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!answer) return fail("BAD_REQUEST", "답변을 입력해 주세요.");
      if (answer.length > LIMITS.ANSWER_MAX) return fail("BAD_REQUEST", `답변은 ${LIMITS.ANSWER_MAX}자까지 적을 수 있어요.`);
      if (conv.request_token === token && conv.request_action === "answer") return stateResponse(sb, conv);
      if (!canAnswer(conv.status)) return fail("INVALID_STATE", "현재 단계에서는 답변할 수 없어요.");

      const claim = await claimRequest(sb, conv, conv.status, token);
      if (claim === "duplicate_done") return stateResponse(sb, conv);
      if (claim !== "claimed") return claimError(claim);

      const status = conv.status;
      const repair = isMetaFeedback(answer);
      // ② 2026-09-17: 사용자가 되물은 말은 '답변'이 아니다. 질문했다는 이유로 단계를 진행하지 않는다.
      const askedBack = isUserQuestion(answer) && !isLowInformationReply(answer);
      const next = repair || askedBack ? status : nextStatusAfterAnswer(status);
      if (askedBack) console.error(`[gsq] answer_hold status=${status} reason=user_question`);
      const userStep = USER_STEP[status];
      const created: string[] = [];
      try {
        const ctx = await loadContext(sb, conversationId);
        const userMessageKind: MessageKind = status === "followup" ? "followup_answer" : "step_answer";
        const aiMessageKind: MessageKind = status === "followup" ? "followup_question" : "step_question";
        if (!latestOpenTurn(ctx, userStep, aiMessageKind, userMessageKind).kind) throw new Error("NO_QUESTION");
        const userMsgId = await insertMessage(sb, conversationId, user.id, "user", userStep, answer, userMessageKind);
        if (!userMsgId) throw new Error("DB_USER_MSG");
        created.push(userMsgId);

        if (!next || !(await commitState(sb, conversationId, token, "answer", next))) throw new Error("DB_STATE");
        return json({ ok: true, status: next, step: DISPLAY_STEP[next], conversationId, previousAnswer: repair ? latestUserEvidence(ctx) : answer, needsQuestion: true });
      } catch (e) {
        await rollbackRows(sb, "messages", created);
        await releaseClaim(sb, conversationId, token, conv);
        const msg = (e as Error).message;
        if (msg === "NO_QUESTION") return fail("INVALID_STATE", "먼저 질문을 불러와 주세요.");
        if (msg.startsWith("DB_")) return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
        return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
      }
    }

    // ── choose (SCENE 3) ──
    if (action === "choose") {
      const choice = body?.choice;
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!isChoice(choice)) return fail("BAD_REQUEST", "잘못된 선택이에요.");
      if (choice !== "agree" && !text) return fail("BAD_REQUEST", "내용을 입력해 주세요.");
      if (text.length > LIMITS.ANSWER_MAX) return fail("BAD_REQUEST", `${LIMITS.ANSWER_MAX}자까지 적을 수 있어요.`);
      if (conv.status !== "understanding") return fail("INVALID_STATE", "현재 단계에서는 선택할 수 없어요.");

      const claim = await claimRequest(sb, conv, "understanding", token);
      if (claim === "duplicate_done") return stateResponse(sb, conv);
      if (claim !== "claimed") return claimError(claim);

      const createdMsgs: string[] = [];
      const createdUnds: string[] = [];
      try {
        const ctx = await loadContext(sb, conversationId);
        const currentUnderstanding = latestOpenUnderstanding(ctx);
        if (!currentUnderstanding) throw new Error("DB_NO_UNDERSTANDING");

        // 맞아요: 서버가 STEP 1·2와 이해 확인 저장을 검증한 뒤 무료 STEP 3을 연다.
        if (choice === "agree") {
          const complete = canCompleteFreeStage({
            status: conv.status,
            hasStep1Answer: hasUser(ctx, USER_STEP.step1),
            hasStep2Answer: hasUser(ctx, USER_STEP.step2),
            hasUnderstanding: !!currentUnderstanding,
          });
          if (!complete) throw new Error("INCOMPLETE");

          const { data: und, error: undErr } = await sb
            .from("understanding_results")
            .insert({ conversation_id: conversationId, user_id: user.id, step: AI_STEP.understanding, choice, rejected_interpretation: null, correction_text: null, self_explanation: null })
            .select("id")
            .single();
          if (undErr || !und) throw new Error("DB_UND");
          createdUnds.push(String(und.id));
          const m = await insertMessage(sb, conversationId, user.id, "user", AI_STEP.understanding, "맞아요", "understanding_choice");
          if (!m) throw new Error("DB_USER_MSG");
          createdMsgs.push(m);
          if (!(await commitState(sb, conversationId, token, "choose", "step3"))) throw new Error("DB_STATE");
          await saveConfirmedMemory(sb, user.id, choice, currentUnderstanding, "");
          return json({ ok: true, status: "step3", step: 3, conversationId });
        }

        // 조금 달라요 / 그게 아니에요 / 직접 설명할게요 → 정정을 먼저 저장하고 후속 질문은 별도 ask에서 생성
        const record: UnderstandingRow = {
          choice,
          rejected_interpretation: choice === "no" ? currentUnderstanding : null,
          correction_text: choice === "alittle" || choice === "no" ? text : null,
          self_explanation: choice === "explain" ? text : null,
        };
        const { data: und, error: undErr } = await sb
          .from("understanding_results")
          .insert({ conversation_id: conversationId, user_id: user.id, step: AI_STEP.understanding, ...record })
          .select("id")
          .single();
        if (undErr || !und) throw new Error("DB_UND");
        createdUnds.push(String(und.id));
        const userMsgId = await insertMessage(sb, conversationId, user.id, "user", AI_STEP.understanding, text, "understanding_choice");
        if (!userMsgId) throw new Error("DB_USER_MSG");
        createdMsgs.push(userMsgId);
        if (!(await commitState(sb, conversationId, token, "choose", "followup"))) throw new Error("DB_STATE");
        await saveConfirmedMemory(sb, user.id, choice, currentUnderstanding, text);

        return json({ ok: true, status: "followup", step: DISPLAY_STEP.followup, conversationId, previousAnswer: text, needsQuestion: true });
      } catch (e) {
        await rollbackRows(sb, "messages", createdMsgs);
        await rollbackRows(sb, "understanding_results", createdUnds);
        await releaseClaim(sb, conversationId, token, conv);
        const msg = (e as Error).message;
        if (msg === "INCOMPLETE") return fail("INVALID_STATE", "아직 이야기가 충분히 쌓이지 않았어요.");
        if (msg.startsWith("DB_")) return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
        return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
      }
    }

    return fail("BAD_REQUEST", "알 수 없는 요청이에요.");
  } catch {
    return fail("ERROR", "서버 오류가 발생했어요.", 500);
  }
});

