// admin-dashboard — aggregate-only operations snapshot for administrators
//
// Security and metric semantics:
// - The caller's bearer token is verified with auth.getUser(), then profiles.role='admin'
//   is checked again with the server-only service role client.
// - No message/report body, payment key/receipt, raw identifier, or unmasked profile PII
//   is selected or returned. This function performs no database mutations.
// - Periods are KST calendar windows: today is the current KST day; 7d/30d include
//   today plus the preceding 6/29 KST days. All windows end at the captured `asOf`.
// - `started` uses conversation.created_at. `step7Completed` uses an actual saved user
//   STEP 7 answer created in the period and requires the conversation to currently be
//   report_ready/report_done. Legacy white_door_ready is never a completion.
// - There is no White Door page-view source. `whiteDoorReached` is therefore the same
//   verified-completion set and means "eligible to see the White Door guidance", not a
//   measured route visit. DO IT route telemetry is likewise explicitly not collected.
// - A query failure makes its whole section `error` with null/empty metrics. Errors are
//   never converted to zero and do not erase independently successful sections.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.57.4";

type Db = SupabaseClient;
type Json = Record<string, unknown>;
type PeriodKey = "today" | "7d" | "30d";
type DataStatus = "success" | "empty" | "error";
type FeatureStatus = "ok" | "error" | "needs_check" | "not_run" | "review_pending";

const ALLOWED_ORIGINS = new Set([
  "https://do-it.company",
  "https://www.do-it.company",
]);
const PERIODS = new Set<PeriodKey>(["today", "7d", "30d"]);
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const RECENT_LIMIT = 20;
const MAX_COMPLETION_ROWS = 2_000;
const ID_CHUNK_SIZE = 100;
const COMPLETED_STATUSES = ["report_ready", "report_done"];
const STEP_ANSWER_KINDS = ["step_answer", "journey_answer"];

interface PeriodWindow {
  key: PeriodKey;
  startAt: string;
  endAt: string;
  timezone: "Asia/Seoul";
}

interface UsersSection {
  status: DataStatus;
  total: number | null;
  periodNew: number | null;
  recent: Array<{
    id: string;
    emailMasked: string | null;
    nickname: string | null;
    createdAt: string | null;
  }>;
}

interface EchoSection {
  status: DataStatus;
  started: number | null;
  step7Completed: number | null;
  whiteDoorReached: number | null;
  currentByStep: Array<{ step: number; count: number }>;
}

interface PaymentsSection {
  status: DataStatus;
  periodPaid: number | null;
  lifetimePaid: number | null;
  recent: Array<{
    orderIdMasked: string;
    amount: number;
    status: string;
    approvedAt: string | null;
  }>;
  paymentMode: "review_pending";
  purchaseAvailable: false;
}

interface DoItSection {
  status: DataStatus;
  records: number | null;
  insights: number | null;
  handoffs: number | null;
  requestErrors: number | null;
  purposes: number | null;
  spaces: number | null;
  routeTelemetry: "not_collected";
}

interface OperationsSection {
  status: DataStatus;
  reportsOpen: number | null;
  blocks: number | null;
  auditRecords: number | null;
  auditRecent: Array<{ action: string; createdAt: string | null }>;
  reportRecent: Array<{ status: string; createdAt: string | null }>;
  diagnosticsStatus: "unavailable";
}

interface MessageEvidence {
  status: DataStatus;
  count: number | null;
  latestAt: string | null;
}

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    ...(origin && isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const fail = (req: Request, code: string, error: string, status: number) =>
  json(req, { ok: false, code, error }, status);

function kstDayStart(now: Date, daysInclusive: number): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const shiftedMidnightUtc = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - (daysInclusive - 1),
    0,
    0,
    0,
    0,
  );
  return new Date(shiftedMidnightUtc - KST_OFFSET_MS);
}

function periodWindow(period: PeriodKey, now: Date): PeriodWindow {
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  return {
    key: period,
    startAt: kstDayStart(now, days).toISOString(),
    endAt: now.toISOString(),
    timezone: "Asia/Seoul",
  };
}

function maskIdentifier(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!id) return "***";
  if (id.length <= 8) return `${id.slice(0, 1)}***`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function maskEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return email ? "***" : null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localMasked = local.length === 1
    ? "*"
    : `${local.slice(0, 1)}${"*".repeat(Math.min(4, local.length - 1))}`;
  return `${localMasked}@${domain}`;
}

function maskNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const chars = Array.from(value.trim());
  if (!chars.length) return null;
  if (chars.length === 1) return "*";
  return `${chars[0]}${"*".repeat(Math.min(3, chars.length - 1))}`;
}

function maskOrderId(value: unknown): string {
  const orderId = String(value ?? "").trim();
  if (!orderId) return "***";
  if (orderId.length <= 10) return `${orderId.slice(0, 2)}***`;
  return `${orderId.slice(0, 6)}…${orderId.slice(-4)}`;
}

function safeAuditAction(value: unknown): string {
  // Audit action is metadata, not an error. Only known non-PII labels leave the server;
  // free-form action values could contain identifiers and are collapsed to a safe label.
  return value === "admin_conversation_view" ? "admin_conversation_view" : "activity";
}

function hasCount(result: { count: number | null; error: unknown }): result is { count: number; error: null } {
  return !result.error && typeof result.count === "number";
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

async function requireAdmin(req: Request): Promise<
  | { ok: true; admin: Db; user: User }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!authHeader.startsWith("Bearer ") || !authHeader.slice(7).trim()) {
    return { ok: false, response: fail(req, "UNAUTHORIZED", "로그인이 필요합니다.", 401) };
  }
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { ok: false, response: fail(req, "SERVER_CONFIG", "관리자 서버 설정을 확인해 주세요.", 500) };
  }

  const userClient: Db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: fail(req, "UNAUTHORIZED", "로그인이 필요합니다.", 401) };
  }

  const admin: Db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, response: fail(req, "ADMIN_CHECK_FAILED", "관리자 권한을 확인하지 못했습니다.", 500) };
  }
  if (!profile || profile.role !== "admin") {
    return { ok: false, response: fail(req, "FORBIDDEN", "관리자 권한이 없습니다.", 403) };
  }
  return { ok: true, admin, user };
}

async function loadUsers(admin: Db, period: PeriodWindow): Promise<UsersSection> {
  try {
    // `neq` alone excludes NULL under SQL three-valued logic. This predicate means
    // exactly "anything other than an administrator", including legacy NULL roles.
    const nonAdmin = "role.is.null,role.neq.admin";
    const [totalResult, periodResult, recentResult] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }).or(nonAdmin),
      admin.from("profiles").select("id", { count: "exact", head: true }).or(nonAdmin)
        .gte("created_at", period.startAt).lt("created_at", period.endAt),
      admin.from("profiles").select("id, email, nickname, display_name, created_at").or(nonAdmin)
        .order("created_at", { ascending: false }).limit(RECENT_LIMIT),
    ]);
    if (!hasCount(totalResult) || !hasCount(periodResult) || recentResult.error) throw new Error("USERS_QUERY");

    const recent = (recentResult.data ?? []).map((row) => ({
      id: maskIdentifier(row.id),
      emailMasked: maskEmail(row.email),
      nickname: maskNickname(row.nickname ?? row.display_name),
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
    }));
    return {
      status: totalResult.count === 0 ? "empty" : "success",
      total: totalResult.count,
      periodNew: periodResult.count,
      recent,
    };
  } catch {
    return { status: "error", total: null, periodNew: null, recent: [] };
  }
}

async function loadEcho(admin: Db, period: PeriodWindow): Promise<EchoSection> {
  try {
    const startedPromise = admin.from("conversations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", period.startAt)
      .lt("created_at", period.endAt);
    const stepPromises = Array.from({ length: 7 }, (_, index) => {
      const step = index + 1;
      return admin.from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("current_step", step);
    });
    const completionMessagesPromise = admin.from("messages")
      .select("conversation_id", { count: "exact" })
      .eq("role", "user")
      .eq("step", 7)
      .in("message_kind", STEP_ANSWER_KINDS)
      .gte("created_at", period.startAt)
      .lt("created_at", period.endAt)
      .range(0, MAX_COMPLETION_ROWS - 1);

    const [startedResult, stepResults, completionMessagesResult] = await Promise.all([
      startedPromise,
      Promise.all(stepPromises),
      completionMessagesPromise,
    ]);
    if (!hasCount(startedResult) || stepResults.some((result) => !hasCount(result)) ||
      completionMessagesResult.error || typeof completionMessagesResult.count !== "number") {
      throw new Error("ECHO_QUERY");
    }

    const completionRows = completionMessagesResult.data ?? [];
    // A configured PostgREST row cap can be lower than our explicit bound. Either form
    // of truncation makes the aggregate unknowable, so surface an error rather than a
    // plausible-but-wrong count.
    if (completionMessagesResult.count > MAX_COMPLETION_ROWS ||
      completionMessagesResult.count > completionRows.length) {
      throw new Error("ECHO_COMPLETION_BOUND");
    }

    const completionConversationIds = [...new Set(
      completionRows.map((row) => String(row.conversation_id ?? "")).filter(Boolean),
    )];
    const completedIds = new Set<string>();
    for (const ids of chunk(completionConversationIds, ID_CHUNK_SIZE)) {
      const result = await admin.from("conversations")
        .select("id")
        .in("id", ids)
        .in("status", COMPLETED_STATUSES)
        .limit(ids.length);
      if (result.error) throw new Error("ECHO_COMPLETION_STATUS");
      for (const row of result.data ?? []) completedIds.add(String(row.id));
    }

    const currentByStep = stepResults.map((result, index) => ({
      step: index + 1,
      count: result.count as number,
    }));
    const step7Completed = completedIds.size;
    const empty = startedResult.count === 0 && step7Completed === 0 &&
      currentByStep.every((item) => item.count === 0);
    return {
      status: empty ? "empty" : "success",
      started: startedResult.count,
      step7Completed,
      // Proxy semantics are documented at the top of this file and in the feature detail.
      whiteDoorReached: step7Completed,
      currentByStep,
    };
  } catch {
    return {
      status: "error",
      started: null,
      step7Completed: null,
      whiteDoorReached: null,
      currentByStep: [],
    };
  }
}

async function loadPayments(admin: Db, period: PeriodWindow): Promise<PaymentsSection> {
  try {
    const [periodResult, lifetimeResult, recentResult] = await Promise.all([
      admin.from("payments").select("id", { count: "exact", head: true })
        .eq("status", "paid").eq("amount", 4_900)
        .gte("approved_at", period.startAt).lt("approved_at", period.endAt),
      admin.from("payments").select("id", { count: "exact", head: true })
        .eq("status", "paid").eq("amount", 4_900),
      admin.from("payments").select("order_id, amount, status, approved_at")
        .eq("status", "paid").eq("amount", 4_900)
        .gte("approved_at", period.startAt).lt("approved_at", period.endAt)
        .order("approved_at", { ascending: false }).limit(RECENT_LIMIT),
    ]);
    if (!hasCount(periodResult) || !hasCount(lifetimeResult) || recentResult.error) {
      throw new Error("PAYMENTS_QUERY");
    }
    const recent = (recentResult.data ?? []).map((row) => ({
      orderIdMasked: maskOrderId(row.order_id),
      amount: Number(row.amount),
      status: String(row.status),
      approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
    }));
    return {
      status: periodResult.count === 0 ? "empty" : "success",
      periodPaid: periodResult.count,
      lifetimePaid: lifetimeResult.count,
      recent,
      paymentMode: "review_pending",
      purchaseAvailable: false,
    };
  } catch {
    return {
      status: "error",
      periodPaid: null,
      lifetimePaid: null,
      recent: [],
      paymentMode: "review_pending",
      purchaseAvailable: false,
    };
  }
}

async function loadDoIt(admin: Db, period: PeriodWindow): Promise<DoItSection> {
  try {
    const [recordsResult, insightsResult, handoffsResult, requestErrorsResult, purposesResult, spacesResult] =
      await Promise.all([
        admin.from("doit_records").select("id", { count: "exact", head: true })
          .gte("created_at", period.startAt).lt("created_at", period.endAt),
        admin.from("doit_insights").select("id", { count: "exact", head: true })
          .gte("created_at", period.startAt).lt("created_at", period.endAt),
        admin.from("doit_handoffs").select("id", { count: "exact", head: true })
          .gte("created_at", period.startAt).lt("created_at", period.endAt),
        admin.from("doit_request_events").select("id", { count: "exact", head: true })
          .eq("status", "failed").gte("created_at", period.startAt).lt("created_at", period.endAt),
        // Purposes and spaces are current inventory, not route visits and not period events.
        admin.from("purposes").select("id", { count: "exact", head: true }),
        admin.from("spaces").select("id", { count: "exact", head: true }),
      ]);
    const results = [recordsResult, insightsResult, handoffsResult, requestErrorsResult, purposesResult, spacesResult];
    if (results.some((result) => !hasCount(result))) throw new Error("DOIT_QUERY");
    const [records, insights, handoffs, requestErrors, purposes, spaces] = results.map((result) => result.count as number);
    return {
      status: results.every((result) => result.count === 0) ? "empty" : "success",
      records,
      insights,
      handoffs,
      requestErrors,
      purposes,
      spaces,
      routeTelemetry: "not_collected",
    };
  } catch {
    return {
      status: "error",
      records: null,
      insights: null,
      handoffs: null,
      requestErrors: null,
      purposes: null,
      spaces: null,
      routeTelemetry: "not_collected",
    };
  }
}

async function loadOperations(admin: Db, period: PeriodWindow): Promise<OperationsSection> {
  try {
    const [openReportsResult, blocksResult, auditCountResult, auditRecentResult, reportRecentResult] = await Promise.all([
      // Open reports and blocks are current operational backlogs/inventory (lifetime).
      admin.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      admin.from("blocks").select("id", { count: "exact", head: true }),
      // Audit logs are normal activity records. They are never counted as application errors.
      admin.from("audit_logs").select("id", { count: "exact", head: true })
        .gte("created_at", period.startAt).lt("created_at", period.endAt),
      admin.from("audit_logs").select("action, created_at")
        .gte("created_at", period.startAt).lt("created_at", period.endAt)
        .order("created_at", { ascending: false }).limit(RECENT_LIMIT),
      // Report reason/detail and reporter/target identifiers are intentionally not selected.
      admin.from("user_reports").select("status, created_at")
        .gte("created_at", period.startAt).lt("created_at", period.endAt)
        .order("created_at", { ascending: false }).limit(RECENT_LIMIT),
    ]);
    if (!hasCount(openReportsResult) || !hasCount(blocksResult) || !hasCount(auditCountResult) ||
      auditRecentResult.error || reportRecentResult.error) {
      throw new Error("OPERATIONS_QUERY");
    }

    const auditRecent = (auditRecentResult.data ?? []).map((row) => ({
      action: safeAuditAction(row.action),
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
    }));
    const reportRecent = (reportRecentResult.data ?? []).map((row) => ({
      status: typeof row.status === "string" && row.status.trim() ? row.status : "unknown",
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
    }));
    const empty = openReportsResult.count === 0 && blocksResult.count === 0 && auditCountResult.count === 0 &&
      auditRecent.length === 0 && reportRecent.length === 0;
    return {
      status: empty ? "empty" : "success",
      reportsOpen: openReportsResult.count,
      blocks: blocksResult.count,
      auditRecords: auditCountResult.count,
      auditRecent,
      reportRecent,
      // No dedicated general Edge/OpenAI/weather diagnostic event source exists.
      diagnosticsStatus: "unavailable",
    };
  } catch {
    return {
      status: "error",
      reportsOpen: null,
      blocks: null,
      auditRecords: null,
      auditRecent: [],
      reportRecent: [],
      diagnosticsStatus: "unavailable",
    };
  }
}

async function loadMessageEvidence(admin: Db, period: PeriodWindow): Promise<MessageEvidence> {
  try {
    const result = await admin.from("messages")
      .select("created_at", { count: "exact" })
      .eq("role", "ai")
      .gte("created_at", period.startAt)
      .lt("created_at", period.endAt)
      .order("created_at", { ascending: false })
      .limit(1);
    if (result.error || typeof result.count !== "number") throw new Error("MESSAGE_EVIDENCE_QUERY");
    const latestAt = typeof result.data?.[0]?.created_at === "string" ? result.data[0].created_at : null;
    return { status: result.count === 0 ? "empty" : "success", count: result.count, latestAt };
  } catch {
    return { status: "error", count: null, latestAt: null };
  }
}

function requesterProviders(user: User): Set<string> {
  const providers = new Set<string>();
  const provider = user.app_metadata?.provider;
  if (typeof provider === "string") providers.add(provider.toLowerCase());
  const listed = user.app_metadata?.providers;
  if (Array.isArray(listed)) {
    for (const item of listed) if (typeof item === "string") providers.add(item.toLowerCase());
  }
  for (const identity of user.identities ?? []) {
    if (typeof identity.provider === "string") providers.add(identity.provider.toLowerCase());
  }
  return providers;
}

function features(
  asOf: string,
  user: User,
  sections: {
    users: UsersSection;
    echo: EchoSection;
    payments: PaymentsSection;
    doIt: DoItSection;
    operations: OperationsSection;
    messageEvidence: MessageEvidence;
  },
): Array<{ id: string; label: string; status: FeatureStatus; detail: string; evidenceAt?: string }> {
  const { users, echo, payments, doIt, operations, messageEvidence } = sections;
  const databaseError = [users.status, echo.status, payments.status, doIt.status, operations.status]
    .some((status) => status === "error");
  const googleVerified = requesterProviders(user).has("google");

  return [
    {
      id: "adminAuth",
      label: "관리자 인증",
      status: "ok",
      detail: "요청 JWT와 현재 profiles.role=admin을 서버에서 확인했습니다.",
      evidenceAt: asOf,
    },
    {
      id: "database",
      label: "운영 데이터베이스",
      status: databaseError ? "error" : "ok",
      detail: databaseError
        ? "일부 독립 데이터 구역 조회가 실패했습니다. 실패 구역은 0이 아닌 오류로 표시됩니다."
        : "대시보드에 필요한 데이터 구역 조회가 완료됐습니다.",
      evidenceAt: asOf,
    },
    {
      id: "conversations",
      label: "ECHO 대화 데이터",
      status: echo.status === "error" ? "error" : "ok",
      detail: echo.status === "error"
        ? "대화 집계를 확인하지 못했습니다."
        : `기간 시작 ${echo.started ?? 0}건, 저장된 STEP 7 유효 완료 ${echo.step7Completed ?? 0}건입니다. White Door 값은 페이지 방문이 아닌 완료 후 안내 가능 프록시입니다.`,
      evidenceAt: asOf,
    },
    {
      id: "conversationEngine",
      label: "대화 엔진 응답 기록",
      status: messageEvidence.status === "error" ? "error" : messageEvidence.status === "empty" ? "not_run" : "ok",
      detail: messageEvidence.status === "error"
        ? "저장된 AI 역할 응답 메타데이터를 확인하지 못했습니다."
        : messageEvidence.status === "empty"
        ? "선택 기간에 저장된 AI 역할 응답이 없습니다. 공급자 동작 여부는 추정하지 않습니다."
        : `선택 기간에 저장된 AI 역할 응답 ${messageEvidence.count}건을 확인했습니다. 이는 특정 AI 공급자 호출 성공의 증명은 아닙니다.`,
      ...(messageEvidence.latestAt ? { evidenceAt: messageEvidence.latestAt } : {}),
    },
    {
      id: "googleAuth",
      label: "Google 로그인",
      status: googleVerified ? "ok" : "needs_check",
      detail: googleVerified
        ? "현재 관리자 요청의 검증된 인증 공급자 정보에 Google이 포함돼 있습니다."
        : "현재 관리자 요청에서는 Google 공급자 증거가 없어 전체 Google 로그인을 정상으로 단정하지 않습니다.",
      evidenceAt: asOf,
    },
    {
      id: "payments",
      label: "결제 데이터",
      status: payments.status === "error" ? "error" : "ok",
      detail: payments.status === "error"
        ? "유효 결제 집계를 확인하지 못했습니다."
        : "4,900원 paid 기록 조회는 완료됐지만 상품 결제 모드는 review_pending이며 구매는 비활성입니다.",
      evidenceAt: asOf,
    },
    {
      id: "tossReview",
      label: "토스 결제 서비스",
      status: "review_pending",
      detail: "심사 대기 중이며 신규 주문/결제창/승인 요청은 열리지 않습니다.",
      evidenceAt: asOf,
    },
  ];
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") ?? "";
  if (origin && !isAllowedOrigin(origin)) {
    return fail(req, "FORBIDDEN_ORIGIN", "허용되지 않은 접속입니다.", 403);
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return fail(req, "METHOD_NOT_ALLOWED", "POST 요청만 허용됩니다.", 405);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => null)) as Json | null;
    if (!body || Array.isArray(body) || body.action !== "snapshot") {
      return fail(req, "BAD_REQUEST", "action은 snapshot이어야 합니다.", 400);
    }
    if (typeof body.period !== "string" || !PERIODS.has(body.period as PeriodKey)) {
      return fail(req, "BAD_REQUEST", "period는 today, 7d, 30d 중 하나여야 합니다.", 400);
    }

    const now = new Date();
    const period = periodWindow(body.period as PeriodKey, now);
    const [users, echo, payments, doIt, operations, messageEvidence] = await Promise.all([
      loadUsers(auth.admin, period),
      loadEcho(auth.admin, period),
      loadPayments(auth.admin, period),
      loadDoIt(auth.admin, period),
      loadOperations(auth.admin, period),
      loadMessageEvidence(auth.admin, period),
    ]);
    const asOf = period.endAt;

    return json(req, {
      ok: true,
      asOf,
      period,
      users,
      echo,
      payments,
      doIt,
      operations,
      features: features(asOf, auth.user, { users, echo, payments, doIt, operations, messageEvidence }),
    });
  } catch {
    return fail(req, "INTERNAL_ERROR", "서버 오류가 발생했습니다.", 500);
  }
});
