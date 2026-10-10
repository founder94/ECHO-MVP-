// Legacy function is disabled: every non-OPTIONS request returns 410 without AI/DB calls.
// Active Plan A requests use the authenticated ECHO Agent server instead.
// Historical helpers below remain unreachable and do not authorize reactivation.

// deno-lint-ignore no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// 모델명은 Secrets(OPENAI_MODEL)에서만 읽는다 — 코드에 기본 모델명을 두지 않는다(B 규칙과 통일).
const MAX_TOKENS = 800;
const DAILY_LIMIT = 15;
const COOLDOWN_MS = 3000;
const OPENAI_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// CORS — 배포 도메인 화이트리스트 (프로덕션 Origin)
// ALLOWED_ORIGINS(콤마 구분)로 덮어쓸 수 있습니다.
// Access-Control-Allow-Origin 에 * 를 사용하지 않습니다.
// ---------------------------------------------------------------------------
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "").toLowerCase();
}

// 2026-09-26 대표 실기기: 앱(https://app.do-it.company)에서 타로 해석이 「해석을 불러오지 못했어요」 — 운영 로그에 사전 확인(OPTIONS)만 있고 본 요청(POST)이 없음
// (브라우저가 허용 도메인 불일치로 막은 모양). 다른 함수 6개는 CORS_ALLOWED_ORIGINS 를 읽는데 이 함수만 ALLOWED_ORIGINS 를 읽었다.
// → 두 이름을 모두 읽어 합친다(Secret 값·이름 변경 0 · 둘 다 없으면 예전 기본값).
function getAllowedOrigins(): string[] {
  const list = [Deno.env.get("ALLOWED_ORIGINS"), Deno.env.get("CORS_ALLOWED_ORIGINS")]
    .flatMap((raw) => (raw ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : ["https://echo.do-it.company"];
}

// 허용 목록 항목은 정확한 origin 또는 "https://*.readdy.co" 같은 하위 도메인 와일드카드.
// (A·B 통합 2026-09-05: 레디 미리보기·게시 주소가 바뀌어도 Secrets 한 줄로 관리)
function originMatches(origin: string, pattern: string): boolean {
  const o = normalizeOrigin(origin);
  const p = normalizeOrigin(pattern);
  if (o === p) return true;
  const wildcard = p.match(/^(https?):\/\/\*\.(.+)$/);
  if (!wildcard) return false;
  const [, scheme, suffix] = wildcard;
  return o.startsWith(`${scheme}://`) && (o.endsWith(`.${suffix}`) || o === `${scheme}://${suffix}`);
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = getAllowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anon-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowed.some((p) => originMatches(origin, p))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function isOriginAllowed(req: Request): boolean {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get("origin");
  if (!origin) return true; // 비브라우저 요청(Origin 없음)은 CORS 미적용, 아래 제한/세션으로 보호
  return allowed.some((p) => originMatches(origin, p));
}

// ---------------------------------------------------------------------------
// Supabase 클라이언트 (서비스 역할 키 — DB 호출 제한 기록용)
// ---------------------------------------------------------------------------
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

function getClientIP(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim().slice(0, 45);
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 45);
  return "unknown";
}

function isValidAnonSession(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function validateRequest(
  body: Record<string, unknown>,
): { ok: boolean; detail?: string } {
  const type = body.type;
  if (type !== "tarot_reading" && type !== "conversation") {
    return { ok: false, detail: "invalid_type" };
  }

  if (type === "tarot_reading") {
    const cardName = body.cardName;
    const purpose = body.purpose;
    if (typeof cardName !== "string" || cardName.length === 0 || cardName.length > 50) {
      return { ok: false, detail: "invalid_cardName" };
    }
    if (typeof purpose !== "string" || purpose.length > 200) {
      return { ok: false, detail: "invalid_purpose" };
    }
  }

  if (type === "conversation") {
    const history = body.history;
    if (!Array.isArray(history) || history.length > 10) {
      return { ok: false, detail: "invalid_history" };
    }
    for (const item of history) {
      if (typeof item !== "object" || item === null) {
        return { ok: false, detail: "invalid_history_item" };
      }
      const h = item as Record<string, unknown>;
      if (typeof h.reading !== "string" || h.reading.length > 500) {
        return { ok: false, detail: "invalid_reading" };
      }
      if (typeof h.reaction !== "string" || h.reaction.length > 100) {
        return { ok: false, detail: "invalid_reaction" };
      }
      if (h.status !== undefined && (typeof h.status !== "string" || h.status.length > 100)) {
        return { ok: false, detail: "invalid_status" };
      }
      if (h.semanticKey !== undefined && (typeof h.semanticKey !== "string" || h.semanticKey.length > 100)) {
        return { ok: false, detail: "invalid_semanticKey" };
      }
      if (h.note !== undefined && (typeof h.note !== "string" || h.note.length > 500)) {
        return { ok: false, detail: "invalid_note" };
      }
    }
  }

  return { ok: true };
}

function validateOpenAIResponse(
  type: string,
  content: string,
): { ok: boolean; parsed?: unknown; detail?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const codeMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      try {
        parsed = JSON.parse(codeMatch[1]);
      } catch {
        return { ok: false, detail: "json_parse_failed" };
      }
    } else {
      const braceMatch = content.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          parsed = JSON.parse(braceMatch[0]);
        } catch {
          return { ok: false, detail: "json_parse_failed" };
        }
      } else {
        return { ok: false, detail: "json_parse_failed" };
      }
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, detail: "not_an_object" };
  }

  const p = parsed as Record<string, unknown>;

  if (type === "tarot_reading") {
    if (typeof p.summary !== "string" || p.summary.length === 0 || p.summary.length > 500) {
      return { ok: false, detail: "invalid_summary" };
    }
    if (!Array.isArray(p.tags) || p.tags.length > 5) {
      return { ok: false, detail: "invalid_tags" };
    }
    if (!Array.isArray(p.cards) || p.cards.length > 5) {
      return { ok: false, detail: "invalid_cards" };
    }
    for (const c of p.cards) {
      if (typeof c !== "object" || c === null) {
        return { ok: false, detail: "invalid_card_item" };
      }
      const card = c as Record<string, unknown>;
      if (typeof card.label !== "string" || card.label.length > 50) {
        return { ok: false, detail: "invalid_card_label" };
      }
      if (typeof card.value !== "string" || card.value.length > 300) {
        return { ok: false, detail: "invalid_card_value" };
      }
    }
  }

  if (type === "conversation") {
    if (typeof p.reading !== "string" || p.reading.length === 0 || p.reading.length > 300) {
      return { ok: false, detail: "invalid_reading" };
    }
    if (typeof p.question !== "string" || p.question.length === 0 || p.question.length > 300) {
      return { ok: false, detail: "invalid_question" };
    }
    if (p.semanticKey !== undefined && (typeof p.semanticKey !== "string" || p.semanticKey.length > 100)) {
      return { ok: false, detail: "invalid_semanticKey" };
    }
  }

  return { ok: true, parsed };
}

function json(status: number, body: Record<string, unknown>, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function makeBadRequestResponse(headers: Record<string, string>): Response {
  return json(400, { error: "잘못된 요청입니다." }, headers);
}

function makeForbiddenResponse(headers: Record<string, string>): Response {
  return json(403, { error: "잠시 후 다시 시도해 주세요." }, headers);
}

function makeRateLimitResponse(headers: Record<string, string>): Response {
  return json(429, { error: "잠시 후 다시 시도해 주세요." }, headers);
}

function makeServerErrorResponse(headers: Record<string, string>): Response {
  return json(500, { error: "잠시 후 다시 시도해 주세요." }, headers);
}

Deno.serve((req: Request) => {
  const headers = { ...buildCorsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({ ok: false, code: 'LEGACY_DISABLED' }), { status: 410, headers });
});
