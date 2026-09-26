// A구조 전용 OpenAI 호출 Edge Function (익명/가입자 공용)
// OPENAI_API_KEY 는 Supabase Secrets 에만 저장되어 있으며,
// 이 함수 서버 내부에서만 읽힙니다. 프론트·브라우저·Git 에 노출되지 않습니다.
// 브라우저는 OpenAI를 직접 호출하지 않고 반드시 이 함수를 경유합니다.
// 호출 제한(3초 쿨다운 / 하루 15회)은 메모리가 아닌 Supabase DB(openai_rate_limits)에
// 원자적으로 기록되어 인스턴스 재시작·수평 확장에도 유지됩니다.

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

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return makeBadRequestResponse(corsHeaders);
  }

  // CORS 도메인 화이트리스트 검사
  if (!isOriginAllowed(req)) {
    return makeForbiddenResponse(corsHeaders);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") ?? "";
  if (!apiKey || !model) {
    return makeServerErrorResponse(corsHeaders);
  }

  // 익명 세션 검증 (잘못된 UUID → 400)
  const anonSession = req.headers.get("x-anon-session");
  if (!anonSession || !isValidAnonSession(anonSession)) {
    return makeBadRequestResponse(corsHeaders);
  }

  // 본문 파싱 (실패 → 400)
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return makeBadRequestResponse(corsHeaders);
  }

  // 요청 타입/필드 검증 (잘못된 type·과도한 입력 → 400)
  const validation = validateRequest(body);
  if (!validation.ok) {
    return makeBadRequestResponse(corsHeaders);
  }

  // DB 기반 호출 제한 (3초 쿨다운 / 하루 15회) → 초과 시 429
  const ip = getClientIP(req);
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  let rateAllowed = false;
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("openai_rate_limit_allow", {
        p_session_id: anonSession,
        p_ip: ip,
        p_day: day,
        p_daily_limit: DAILY_LIMIT,
        p_cooldown_ms: COOLDOWN_MS,
      });
      if (error) {
        return makeServerErrorResponse(corsHeaders);
      }
      rateAllowed = data === true;
    } catch {
      return makeServerErrorResponse(corsHeaders);
    }
  } else {
    return makeServerErrorResponse(corsHeaders);
  }

  if (!rateAllowed) {
    return makeRateLimitResponse(corsHeaders);
  }

  const type = body.type as string;

  let messages: Array<{ role: string; content: string }> = [];

  if (type === "tarot_reading") {
    const cardName = String(body.cardName);
    const purpose = String(body.purpose);
    messages = [
      {
        role: "system",
        content:
          `너는 타로 카드 리더야. 선택된 카드와 관계 목적을 바탕으로 오늘의 흐름을 부드럽게 해석해줘. 각 응답은 다음 JSON 형식만 정확히 출력해. 다른 설명은 절대 붙이지 마.\n\n{\n  "summary": "오늘의 흐름을 부드럽게 해석한 2~3문장. 미래를 단정하지 않는 톤.",\n  "tags": ["핵심 키워드 3개"],\n  "cards": [\n    { "label": "현재의 에너지", "value": "카드 의미 한 문장" },\n    { "label": "흐름의 방향", "value": "관계 관점 해석 한 문장" },\n    { "label": "놓치지 말 것", "value": "기억하면 좋을 점 한 문장" }\n  ]\n}\n\n규칙:\n- 한국어로 답해.\n- 미래·결혼·건강을 단정하지 마.\n- 참고로 봐달라는 따뜻한 톤을 유지해.`,
      },
      {
        role: "user",
        content: `선택한 카드: ${cardName}\n관계 목적: ${purpose}\n\n이 카드와 목적을 바탕으로 오늘의 흐름을 해석해줘.`,
      },
    ];
  } else {
    const history = Array.isArray(body.history) ? body.history : [];
    let userPrompt = "첫 번째 짐작과 질문을 만들어줘. 사용자가 어떤 사람과 어떤 관계를 원하는지 알아가기 시작하는 단계야.";
    if (history.length > 0) {
      const statusLabel: Record<string, string> = {
        confirmed: "확정(사용자가 맞다고 함)",
        rejected: "거절(사용자가 아니라고 함)",
        changed: "수정(사용자가 직접 설명)",
        partial: "조금 달라요(일부만 맞음)",
        uncertain: "모르겠어요(미확인)",
      };
      const lines = history.map((item: Record<string, unknown>, idx: number) => {
        const status = typeof item.status === "string" ? item.status : String(item.reaction ?? "");
        const semanticKey = typeof item.semanticKey === "string" && item.semanticKey ? item.semanticKey : "";
        const parts = [
          `${idx + 1}번째 짐각: ${item.reading}`,
          semanticKey ? `의미 키: ${semanticKey}` : "",
          `사용자 반응: ${statusLabel[status] ?? status}`,
        ].filter(Boolean);
        if (item.note) parts.push(`사용자 직접 설명(최우선): ${item.note}`);
        return parts.join("\n");
      }).join("\n\n");
      userPrompt = `지금까지의 대화 맥락은 아래와 같아. 이를 반영해 다음 짐각과 질문을 만들어줘.\n\n${lines}\n\n중요:\n- "거절(rejected)"로 표시된 짐각의 의미 키는 절대 재사용하지 마. 같은 의미를 다른 말로 바꿔 다시 묻는 것도 금지야. 완전히 다른 방향으로 전환해.\n- "수정(changed)"의 직접 설명은 가장 최신의 확정 정보로, 어떤 AI 짐각보다 우선해.\n- "확정(confirmed)"된 내용은 이어서 자연스럽게 활용해도 좋아.`;
    }
    messages = [
      {
        role: "system",
        content:
          `너는 'DO IT' 서비스의 관계 탐색 AI 도우미야.\n사용자가 어떤 사람과 어떤 관계를 원하는지 부드럽게 알아가는 대화를 이끌어줘.\n각 응답은 다음 JSON 형식만 정확히 출력해. 다른 설명은 절대 붙이지 마.\n\n{\n  "reading": "사용자에 대해 '이렇게 느껴졌어요 (확정 아니에요)' 같은 부드러운 짐각 한 문장. 확정하거나 단정하지 마.",\n  "question": "사용자를 더 이해하기 위한 열린 질문 한 문장.",\n  "semanticKey": "이 짐각의 핵심 의미를 나타내는 짧은 주제(예: '혼자만의 시간 선호', '성장 지향', '외향적 교류'). 10자 이내."\n}\n\n규칙:\n- 한국어로 답해.\n- 상대를 판단하거나 미래를 단정하지 마.\n- 짐각은 부드럽고 존중하는 톤으로.\n- 이미 물어본 내용과 겹치지 않게 새로운 각도로 질문해.\n- 사용자가 거절한 짐각의 의미(semanticKey)는 절대 재사용하지 마. 같은 의미를 다른 표현으로 다시 묻는 것도 실패야. 완전히 다른 방향으로 전환해.\n- 사용자가 직접 설명한 내용은 최신 확정 정보로 항상 우선해.\n- '조금 달라요' 반응에는 그 방향을 일부만 유지하고 미묘하게 조정해.`,
      },
      { role: "user", content: userPrompt },
    ];
  }

  // OpenAI 호출 (타임아웃 포함)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        max_tokens: MAX_TOKENS,
      }),
      signal: controller.signal,
    });

    if (!openaiRes.ok) {
      return makeServerErrorResponse(corsHeaders);
    }

    const data = await openaiRes.json();
    const rawContent = data?.choices?.[0]?.message?.content ?? "";

    if (!rawContent) {
      return makeServerErrorResponse(corsHeaders);
    }

    const responseValidation = validateOpenAIResponse(type, rawContent);
    if (!responseValidation.ok) {
      return makeServerErrorResponse(corsHeaders);
    }

    return json(200, { content: rawContent, parsed: responseValidation.parsed }, corsHeaders);
  } catch {
    return makeServerErrorResponse(corsHeaders);
  } finally {
    clearTimeout(timeoutId);
  }
});