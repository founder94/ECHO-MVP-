// echo-payment — 최종 자기이해 리포트 Toss 4,900원 단건결제 서버 검증
//
// 원칙
// - 금액은 서버 상수(4,900원)로만 판정한다. 브라우저가 보낸 금액·Toss 응답 금액·주문 금액이 모두 같아야 승인한다.
// - 결제 성공은 Toss 승인 API 응답(status DONE)으로만 인정한다. 프론트는 결제 성공을 만들 수 없다.
// - 멱등: 주문 1건당 승인 1회. 같은 주문의 재요청은 저장된 결과를 돌려준다. 승인 처리 중 중복 요청은 IN_PROGRESS.
// - 이번 릴리스는 Toss 테스트 키(test_)만 허용한다. 운영 키가 들어오면 거절한다(운영 결제 금지).
// - payments 표 쓰기는 서비스 역할만(RLS: 사용자는 본인 행 읽기만). 인증은 사용자 토큰 getUser 실검증.
// - 카드 정보·비밀키·원문을 로그에 남기지 않는다.
//
// 비밀값(Supabase 대시보드 > Edge Functions > Secrets): TOSS_SECRET_KEY (test_sk_ 로 시작)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 는 Edge Runtime 이 자동 주입한다.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const PRICE_KRW = 4900;
const ORDER_NAME = "자기이해 리포트 · 1회";
const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";
const TOSS_TIMEOUT_MS = 20_000;
const TEST_KEY_PREFIX = "test_";
const PAYABLE_STATUS = "report_ready";
const PAYMENT_MODE = "review_pending" as "review_pending" | "enabled";
const ORDER_ID_PATTERN = /^echo-[a-f0-9]{24}$/;
const PAYMENT_KEY_PATTERN = /^[A-Za-z0-9_-]{6,200}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, unknown>;
type Db = SupabaseClient;

interface PaymentRow {
  id: string;
  user_id: string;
  conversation_id: string;
  order_id: string;
  amount: number;
  status: string;
  payment_key: string | null;
}
interface ConversationRow {
  id: string;
  user_id: string;
  status: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const fail = (code: string, error: string, status = 200) => json({ ok: false, code, error }, status);

function newOrderId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `echo-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function loadConversation(admin: Db, userId: string, conversationId: string): Promise<ConversationRow | null> {
  const { data, error } = await admin.from("conversations").select("id, user_id, status").eq("id", conversationId).eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return data as ConversationRow;
}

async function loadPaymentByOrder(admin: Db, userId: string, orderId: string): Promise<PaymentRow | null> {
  const { data, error } = await admin
    .from("payments")
    .select("id, user_id, conversation_id, order_id, amount, status, payment_key")
    .eq("order_id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PaymentRow;
}

async function loadPaidByConversation(admin: Db, userId: string, conversationId: string): Promise<PaymentRow | null> {
  const { data, error } = await admin
    .from("payments")
    .select("id, user_id, conversation_id, order_id, amount, status, payment_key")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .eq("status", "paid")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as PaymentRow;
}

interface TossResult {
  ok: boolean;
  code: string;
  message: string;
  method: string | null;
  approvedAt: string | null;
  receiptUrl: string | null;
  totalAmount: number;
  orderId: string;
  status: string;
}

async function confirmWithToss(secretKey: string, paymentKey: string, orderId: string, amount: number): Promise<TossResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TOSS_TIMEOUT_MS);
  try {
    const res = await fetch(TOSS_CONFIRM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${secretKey}:`)}` },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: ctrl.signal,
    });
    let body: Json = {};
    try {
      body = (await res.json()) as Json;
    } catch {
      body = {};
    }
    if (!res.ok) {
      return {
        ok: false,
        code: typeof body.code === "string" ? body.code : "TOSS_HTTP",
        message: typeof body.message === "string" ? body.message : "결제 승인에 실패했어요.",
        method: null,
        approvedAt: null,
        receiptUrl: null,
        totalAmount: 0,
        orderId: "",
        status: "",
      };
    }
    const receipt = body.receipt as Json | undefined;
    return {
      ok: true,
      code: "",
      message: "",
      method: typeof body.method === "string" ? body.method : null,
      approvedAt: typeof body.approvedAt === "string" ? body.approvedAt : null,
      receiptUrl: receipt && typeof receipt.url === "string" ? receipt.url : null,
      totalAmount: Number(body.totalAmount ?? 0),
      orderId: typeof body.orderId === "string" ? body.orderId : "",
      status: typeof body.status === "string" ? body.status : "",
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const tossSecret = Deno.env.get("TOSS_SECRET_KEY") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);

    const userSb: Db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);

    if (!serviceKey) return fail("PAYMENT_NOT_CONFIGURED", "결제 서버 설정이 필요해요.");

    const admin: Db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = (await req.json().catch(() => null)) as Json | null;
    const action = typeof body?.action === "string" ? body.action : "";

    // ── create: 주문 생성(대화 1건 · 미결제 주문 1건 재사용) ──
    if (action === "create") {
      const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
      if (!conversationId) return fail("BAD_REQUEST", "대화 식별값이 없어요.");
      const conv = await loadConversation(admin, user.id, conversationId);
      if (!conv) return fail("FORBIDDEN", "대화를 찾지 못했어요.", 403);
      const paid = await loadPaidByConversation(admin, user.id, conversationId);
      if (paid) {
        return json({ ok: true, status: conv.status, conversationId, alreadyPaid: true, paid: true, reportEntitled: true });
      }
      if (conv.status !== PAYABLE_STATUS) return fail("INVALID_STATE", "STEP 7 대화를 마친 뒤 리포트를 선택할 수 있어요.");
      if (PAYMENT_MODE !== "enabled") return fail("PAYMENT_NOT_CONFIGURED", "현재 결제 서비스를 준비하고 있어요. 결제는 아직 진행되지 않습니다.");
      if (!tossSecret || !tossSecret.startsWith(TEST_KEY_PREFIX)) return fail("PAYMENT_NOT_CONFIGURED", "결제 서버 설정이 필요해요.");

      const { data: existing } = await admin
        .from("payments")
        .select("order_id, amount")
        .eq("user_id", user.id)
        .eq("conversation_id", conversationId)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing && Number(existing.amount) === PRICE_KRW) {
        return json({ ok: true, status: conv.status, conversationId, orderId: existing.order_id, amount: PRICE_KRW, orderName: ORDER_NAME, customerKey: user.id });
      }

      const orderId = newOrderId();
      const { error: insErr } = await admin.from("payments").insert({ user_id: user.id, conversation_id: conversationId, order_id: orderId, amount: PRICE_KRW, status: "ready" });
      if (insErr) return fail("ERROR", "주문을 만들지 못했어요.");
      return json({ ok: true, status: conv.status, conversationId, orderId, amount: PRICE_KRW, orderName: ORDER_NAME, customerKey: user.id });
    }

    // ── confirm: Toss 승인 확인(서버 금액검증 · 멱등) ──
    if (action === "confirm") {
      const paymentKey = typeof body?.paymentKey === "string" ? body.paymentKey.trim() : "";
      const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
      const amount = Number(body?.amount);
      if (!PAYMENT_KEY_PATTERN.test(paymentKey) || !ORDER_ID_PATTERN.test(orderId)) return fail("BAD_REQUEST", "결제 정보가 올바르지 않아요.");

      const payment = await loadPaymentByOrder(admin, user.id, orderId);
      if (!payment) return fail("FORBIDDEN", "주문을 찾지 못했어요.", 403);
      const conv = await loadConversation(admin, user.id, payment.conversation_id);
      if (!conv) return fail("FORBIDDEN", "대화를 찾지 못했어요.", 403);

      // 이미 승인된 주문: 저장된 결과를 그대로 돌려준다
      if (payment.status === "paid") {
        return json({ ok: true, status: conv.status, conversationId: conv.id, paid: true, reportEntitled: true });
      }
      if (conv.status !== PAYABLE_STATUS) return fail("INVALID_STATE", "STEP 7 대화를 마친 뒤 결제를 확인할 수 있어요.");
      if (PAYMENT_MODE !== "enabled") return fail("PAYMENT_NOT_CONFIGURED", "현재 결제 서비스를 준비하고 있어요. 결제는 아직 진행되지 않습니다.");
      if (!tossSecret || !tossSecret.startsWith(TEST_KEY_PREFIX)) return fail("PAYMENT_NOT_CONFIGURED", "결제 서버 설정이 필요해요.");
      if (payment.status !== "ready") return fail("PAYMENT_FAILED", "이미 실패한 주문이에요. 다시 시도해 주세요.");
      if (!Number.isInteger(amount) || amount !== PRICE_KRW || payment.amount !== PRICE_KRW) {
        return fail("AMOUNT_MISMATCH", "결제 금액이 맞지 않아요.");
      }

      // 선점: 같은 주문의 동시 승인 요청은 하나만 처리
      const { data: claimed } = await admin
        .from("payments")
        .update({ payment_key: paymentKey, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("status", "ready")
        .is("payment_key", null)
        .select("id");
      if (!claimed || claimed.length !== 1) {
        const fresh = await loadPaymentByOrder(admin, user.id, orderId);
        if (fresh?.status === "paid") {
          return json({ ok: true, status: conv.status, conversationId: conv.id, paid: true, reportEntitled: true });
        }
        return fail("IN_PROGRESS", "결제를 확인하고 있어요. 잠시만 기다려 주세요.", 409);
      }

      const toss = await confirmWithToss(tossSecret, paymentKey, orderId, PRICE_KRW).catch(() => null);
      if (!toss) {
        await admin.from("payments").update({ payment_key: null, updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "ready");
        return fail("PAYMENT_ERROR", "결제 서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
      const verified = toss.ok && toss.status === "DONE" && toss.orderId === orderId && toss.totalAmount === PRICE_KRW;
      if (!verified) {
        await admin
          .from("payments")
          .update({ status: "failed", fail_code: toss.ok ? "VERIFY_MISMATCH" : toss.code, updated_at: new Date().toISOString() })
          .eq("id", payment.id)
          .eq("status", "ready");
        return fail("PAYMENT_FAILED", toss.ok ? "결제 내용이 주문과 달라요." : toss.message);
      }

      const { error: paidErr } = await admin
        .from("payments")
        .update({ status: "paid", method: toss.method, approved_at: toss.approvedAt, receipt_url: toss.receiptUrl, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .eq("status", "ready");
      if (paidErr) return fail("ERROR", "결제 결과 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");

      return json({ ok: true, status: conv.status, conversationId: conv.id, paid: true, reportEntitled: true, receiptUrl: toss.receiptUrl });
    }

    // ── status: 대화의 결제 상태 조회(성공 화면 새로고침·보관함용) ──
    if (action === "status") {
      const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
      if (!conversationId) return fail("BAD_REQUEST", "대화 식별값이 없어요.");
      const conv = await loadConversation(admin, user.id, conversationId);
      if (!conv) return fail("FORBIDDEN", "대화를 찾지 못했어요.", 403);
      const { data: paid } = await admin.from("payments").select("order_id, approved_at").eq("user_id", user.id).eq("conversation_id", conversationId).eq("status", "paid").limit(1).maybeSingle();
      return json({ ok: true, status: conv.status, conversationId, paid: !!paid, reportEntitled: !!paid });
    }

    return fail("BAD_REQUEST", "알 수 없는 요청이에요.");
  } catch {
    return fail("ERROR", "서버 오류가 발생했어요.", 500);
  }
});

