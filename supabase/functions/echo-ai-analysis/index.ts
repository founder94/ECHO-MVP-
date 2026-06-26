import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Safety keyword detection ───
const SAFETY_KEYWORDS = [
  "죽고 싶다", "자살", "극단적 선택", "자해",
  "폭력", "협박", "스토킹", "성폭력", "불법촬영",
  "감금", "강요", "범죄 피해", "보복", "위협",
  "kill myself", "suicide", "self-harm", "end my life",
];

function detectSafetyRisk(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFETY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function buildAnalysisPrompt(answers: string[], contactInfo: { name?: string; email?: string }): string {
  const userName = contactInfo.name || "사용자";
  
  return `당신은 ECHO라는 Human Relationship OS의 AI 분석가입니다. ECHO는 누구나 호기심에서 시작할 수 있는 자기이해 플랫폼입니다.

당신의 역할은 상대를 분석하거나 판단하는 것이 아닙니다. 사용자가 자신의 관계 패턴과 감정을 더 깊이 이해하도록 돕는 것입니다.

사용자 "${userName}"님이 온보딩 과정에서 다음 답변을 선택했습니다:

질문 1: "지금 ECHO를 시작한 이유는 무엇인가요?"
→ ${answers[0] || "응답 없음"}

질문 2: "어떤 관계를 떠올리고 있나요?"
→ ${answers[1] || "응답 없음"}

질문 3: "지금 가장 궁금한 것은 무엇인가요?"
→ ${answers[2] || "응답 없음"}

이 답변을 바탕으로 아래 구조에 맞춰 관계 리포트를 생성해주세요. 모든 응답은 한국어로 작성합니다.

--- 리포트 구조 ---

1. [현재 상태] (State)
당신이 지금 어디에 서 있는지, 당신의 답변에서 드러나는 현재 감정 상태와 관계 위치를 3-4문장으로 서술합니다. 따뜻하고 공감적인 톤으로 작성합니다.

2. [반복 패턴] (Pattern)
당신의 답변에서 추론할 수 있는 관계 속 반복 패턴을 3-4문장으로 설명합니다. "당신은 ~하는 경향이 있습니다" 형식으로, 비판하지 않고 관찰자의 시선으로 작성합니다.

3. [사실과 해석의 분리] (Fact vs Interpretation)
관계에서 일어난 '사실'과 당신이 그 사실에 대해 가졌던 '해석'을 구분하여 보여줍니다. 2-3개의 구체적인 예시를 들어 설명합니다.

4. [감정 지도] (Emotion Map)
당신의 답변에서 감지되는 주요 감정들을 나열하고, 각 감정이 어떤 관계 경험에서 비롯되었을지 2-3문장으로 연결합니다.

5. [다음 행동 제안] (Next Action)
앞으로 당신이 시도해볼 수 있는 구체적인 작은 행동 3가지를 제안합니다. 각 제안은 현실적이고 실행 가능해야 합니다.

6. [ECHO의 한마디] (ECHO Note)
ECHO의 철학을 담은 짧은 메시지로 리포트를 마무리합니다. "호기심에서 시작되어 진짜 나를 더 선명하게 이해하는 것"이라는 ECHO의 핵심 가치를 전달합니다.

--- 중요 규칙 ---
- 의료, 심리치료, 상담, 법률 자문을 제공하지 않습니다.
- "진단"이나 "장애"와 같은 의학적 용어를 사용하지 않습니다.
- 위급 상황이 감지되면 분석 대신 안전 안내를 우선 제공합니다.
- 따뜻하지만 과하지 않은 톤을 유지합니다.
- 각 섹션은 "## 섹션명" 형식의 마크다운으로 구분합니다.
- 총 800-1200자 내외로 작성합니다.`;
}

const SAFETY_RESPONSE = `## ⚠️ 안전 안내

지금은 자기이해보다 안전이 우선입니다.

현재 상황이 위급하거나 위험하다고 느껴진다면 즉시 112, 119 또는 전문기관에 도움을 요청해 주세요.

- 자살예방상담전화: 1393 (24시간)
- 정신건강 위기상담: 1577-0199 (24시간)
- 여성긴급전화: 1366 (24시간)

혼자 판단하지 말고 가까운 사람, 전문기관, 공공기관에 도움을 요청해 주세요.
ECHO는 위급 상황을 직접 해결하는 서비스가 아닙니다.`;

// ─── AI Log recording (service role — bypasses RLS) ───
async function recordAiLog(supabaseAdmin: ReturnType<typeof createClient> | null, log: {
  user_id?: string;
  model: string;
  status: string;
  total_tokens: number;
  response_time_ms: number;
  total_time_ms: number;
  estimated_cost: number;
  error_message?: string;
  safety_triggered: boolean;
}) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('ai_logs').insert({
      user_id: log.user_id || null,
      model: log.model,
      status: log.status,
      total_tokens: log.total_tokens,
      response_time_ms: log.response_time_ms,
      total_time_ms: log.total_time_ms,
      estimated_cost: log.estimated_cost,
      error_message: log.error_message || null,
      safety_triggered: log.safety_triggered,
    });
  } catch {
    // silently fail — logging should never break the main flow
  }
}

function estimateCost(model: string, totalTokens: number): number {
  // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output — rough avg $0.30/1M
  if (model.includes('gpt-4o-mini')) {
    return (totalTokens / 1_000_000) * 0.30;
  }
  if (model.includes('gpt-4o')) {
    return (totalTokens / 1_000_000) * 5.00; // avg gpt-4o
  }
  return (totalTokens / 1_000_000) * 0.30;
}

// ─── OpenAI API call with timeout ───
async function callOpenAI(prompt: string): Promise<{
  report: string;
  model_used: string;
  tokens_used: number;
  response_time_ms: number;
}> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY_NOT_CONFIGURED: Supabase Secret에 OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "당신은 ECHO Human Relationship OS의 AI 분석가입니다. 사용자의 관계 데이터를 바탕으로 자기이해를 돕는 리포트를 생성합니다. 모든 응답은 한국어로 작성하며, 마크다운 형식을 사용합니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    const responseTime = Math.round(performance.now() - startTime);

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      let errDetail = errText;
      try {
        const errJson = JSON.parse(errText);
        errDetail = errJson.error?.message || errText;
      } catch { /* raw text is fine */ }

      clearTimeout(timeoutId);

      if (openaiRes.status === 401) {
        throw new Error(`OPENAI_AUTH_ERROR: API Key가 유효하지 않거나 만료되었습니다. (${errDetail})`);
      } else if (openaiRes.status === 429) {
        throw new Error(`OPENAI_RATE_LIMIT: API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요. (${errDetail})`);
      } else if (openaiRes.status >= 500) {
        throw new Error(`OPENAI_SERVER_ERROR: OpenAI 서버 오류 (${openaiRes.status}). 잠시 후 다시 시도해 주세요.`);
      } else {
        throw new Error(`OPENAI_API_ERROR: HTTP ${openaiRes.status} — ${errDetail}`);
      }
    }

    const openaiData = await openaiRes.json();
    clearTimeout(timeoutId);
    const report = openaiData.choices?.[0]?.message?.content || "";

    if (!report || report.trim().length === 0) {
      throw new Error("OPENAI_EMPTY_RESPONSE: AI가 빈 응답을 반환했습니다.");
    }

    return {
      report,
      model_used: openaiData.model || "gpt-4o-mini",
      tokens_used: openaiData.usage?.total_tokens || 0,
      response_time_ms: responseTime,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("OPENAI_TIMEOUT: AI 응답 시간이 30초를 초과했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.");
    }
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  const reqStartTime = performance.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Init Supabase admin client for logging (service role)
  const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

  try {
    // ─── JWT Verification ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        error: "인증이 필요합니다. 로그인 후 다시 시도해 주세요.",
        error_code: "AUTH_MISSING",
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: "인증이 필요합니다. 로그인 후 다시 시도해 주세요.",
        error_code: "AUTH_INVALID",
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifiedUserId = user.id;

    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("payment_status")
      .eq("id", verifiedUserId)
      .maybeSingle();

    if (profileError || profile?.payment_status !== "paid") {
      return new Response(JSON.stringify({
        error: "결제가 필요합니다. Premium Report 결제 후 이용해 주세요.",
        error_code: "PAYMENT_REQUIRED",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Parse request body ───
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "요청 형식이 올바르지 않습니다.", error_code: "INVALID_JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { answers, contactInfo } = body;

    if (!answers || !Array.isArray(answers) || answers.length < 3) {
      return new Response(
        JSON.stringify({
          error: "온보딩 응답 데이터가 필요합니다. 3개의 질문에 모두 답변해 주세요.",
          error_code: "MISSING_ANSWERS",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Safety check ───
    const combinedText = answers.join(" ") + (contactInfo?.name || "") + (contactInfo?.email || "");
    if (detectSafetyRisk(combinedText)) {
      // Log safety trigger
      recordAiLog(supabaseAdmin, {
        user_id: verifiedUserId,
        model: 'gpt-4o-mini',
        status: 'safety_triggered',
        total_tokens: 0,
        response_time_ms: 0,
        total_time_ms: Math.round(performance.now() - reqStartTime),
        estimated_cost: 0,
        safety_triggered: true,
      });

      return new Response(
        JSON.stringify({
          report: SAFETY_RESPONSE,
          safety_triggered: true,
          generated_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Build prompt & call OpenAI ───
    const prompt = buildAnalysisPrompt(answers, contactInfo || {});

    let openaiResult;
    try {
      openaiResult = await callOpenAI(prompt);
    } catch (openaiErr: any) {
      const errorMessage = openaiErr.message || "알 수 없는 오류";
      console.error("OpenAI call failed:", errorMessage);

      let errorCode = "OPENAI_ERROR";
      let userMessage = "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

      if (errorMessage.includes("OPENAI_API_KEY_NOT_CONFIGURED")) {
        errorCode = "API_KEY_MISSING";
        userMessage = "OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.";
      } else if (errorMessage.includes("OPENAI_AUTH_ERROR")) {
        errorCode = "API_KEY_INVALID";
        userMessage = "API 인증에 실패했습니다. 관리자에게 문의해 주세요.";
      } else if (errorMessage.includes("OPENAI_RATE_LIMIT")) {
        errorCode = "RATE_LIMIT";
        userMessage = "일시적으로 요청이 많아 처리할 수 없습니다. 1분 후 다시 시도해 주세요.";
      } else if (errorMessage.includes("OPENAI_TIMEOUT")) {
        errorCode = "TIMEOUT";
        userMessage = "AI 응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.";
      } else if (errorMessage.includes("OPENAI_EMPTY_RESPONSE")) {
        errorCode = "EMPTY_RESPONSE";
        userMessage = "AI가 응답을 생성하지 못했습니다. 다른 답변으로 다시 시도해 주세요.";
      }

      // Log error
      recordAiLog(supabaseAdmin, {
        user_id: verifiedUserId,
        model: 'gpt-4o-mini',
        status: 'error',
        total_tokens: 0,
        response_time_ms: 0,
        total_time_ms: Math.round(performance.now() - reqStartTime),
        estimated_cost: 0,
        error_message: errorCode + ': ' + errorMessage,
        safety_triggered: false,
      });

      return new Response(
        JSON.stringify({
          error: userMessage,
          error_code: errorCode,
          detail: errorMessage,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Validate response structure ───
    const reportText = openaiResult.report;
    const hasSections = /##\s+\[.*?\]/.test(reportText);
    if (!hasSections) {
      console.warn("AI response missing expected section headers, but content exists");
    }

    const totalTime = Math.round(performance.now() - reqStartTime);
    const cost = estimateCost(openaiResult.model_used, openaiResult.tokens_used);

    // ─── Record success log ───
    recordAiLog(supabaseAdmin, {
      user_id: verifiedUserId,
      model: openaiResult.model_used,
      status: 'success',
      total_tokens: openaiResult.tokens_used,
      response_time_ms: openaiResult.response_time_ms,
      total_time_ms: totalTime,
      estimated_cost: cost,
      safety_triggered: false,
    });

    return new Response(
      JSON.stringify({
        report: reportText,
        model_used: openaiResult.model_used,
        tokens_used: openaiResult.tokens_used,
        response_time_ms: openaiResult.response_time_ms,
        total_time_ms: totalTime,
        safety_triggered: false,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unhandled edge function error:", err.message, err.stack);
    return new Response(
      JSON.stringify({
        error: "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        error_code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});