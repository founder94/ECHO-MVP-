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
// 로그인하지 않은 사람 전체가 하루에 함께 쓰는 상한(2026-10-06 Codex 4186732134): 접속 주소 머리글은 요청하는 쪽이 바꿀 수 있어서,
// 주소별 15회만으로는 주소를 바꿔 가며 끝없이 쓸 수 있다 → 로그인 안 한 요청은 모두 이 한 통을 함께 쓴다(비용 상한이 정해진다).
const ANON_DAILY_TOTAL = 150;
const ANON_BUCKET = "anon:all";
const COOLDOWN_MS = 3000;
const OPENAI_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// CORS — 배포 도메인 화이트리스트 (프로덕션 Origin)
// 허용 목록은 아래 ALLOWED_ORIGINS 한 곳(코드)에서만 관리합니다(2026-09-26 · 설정값으로 덮어쓰지 않음).
// Access-Control-Allow-Origin 에 * 를 사용하지 않습니다.
// ---------------------------------------------------------------------------
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "").toLowerCase();
}

// 2026-09-26 대표 승인(openai-chat CORS 복구): 앱(https://app.do-it.company)에서 타로 해석이 「해석을 불러오지 못했어요」.
// 원인: 이 함수는 설정이 없으면 https://echo.do-it.company 만 허용 → 브라우저 사전 확인(OPTIONS)에서 앱·브랜드 요청이 막혔다.
// 허용 목록은 여기 한 곳에서만 관리한다 — 우리 서비스 도메인 3개만 허용 · 그 밖의 Origin 은 거부 · 「*」 금지.
// (배포 전 운영 v4 실측: 허용되던 Origin 은 https://echo.do-it.company 하나뿐 → 이 목록이 그것을 포함한다.)
const ALLOWED_ORIGINS = ["https://app.do-it.company", "https://do-it.company", "https://echo.do-it.company"] as const;
function getAllowedOrigins(): readonly string[] {
  return ALLOWED_ORIGINS;
}

// 허용 목록 항목은 정확한 origin 또는 "https://*.example.com" 같은 하위 도메인 와일드카드(지금 목록에는 와일드카드 없음).
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

// ---------------------------------------------------------------------------
// 사주 「ECHO의 이야기」(2026-10-06 대표 「사람냄새나게 최종완성해」) — 화면이 계산한 값 중 정해진 몇 가지만 받는다.
// 생년월일·태어난 시간·성별·나이는 받지 않는다(서버로 보내지 않음). 받은 값은 모두 정해진 목록 안의 글자·작은 숫자라
// 사용자가 쓴 글이 AI 지시문에 섞이지 않는다. 저장 0 — 결과는 화면에만 보인다.
// ---------------------------------------------------------------------------
const SAJU_DAY_MASTERS = ["갑목", "을목", "병화", "정화", "무토", "기토", "경금", "신금", "임수", "계수"] as const;
const SAJU_ELEMENTS = ["목", "화", "토", "금", "수"] as const;
// 2026-10-06 Codex 4187020963: 시기(10년 흐름·올해) 값을 주면 AI 가 앞날을 말하게 된다 → 시기 값은 받지 않는다.
// 이야기는 「지금 이 사람의 결」(일간·오행)만 그린다 — 앞날을 말할 재료 자체를 주지 않는 것이 근본 대책.
interface SajuFacts { dayMaster: string; elements: Record<string, number> }

function validateSajuFacts(raw: unknown): { ok: boolean; detail?: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, detail: "invalid_facts" };
  const f = raw as Record<string, unknown>;
  const allowed = new Set(["dayMaster", "elements"]);
  if (Object.keys(f).some((k) => !allowed.has(k))) return { ok: false, detail: "invalid_facts_key" };
  if (typeof f.dayMaster !== "string" || !(SAJU_DAY_MASTERS as readonly string[]).includes(f.dayMaster)) return { ok: false, detail: "invalid_dayMaster" };
  const el = f.elements;
  if (typeof el !== "object" || el === null || Array.isArray(el)) return { ok: false, detail: "invalid_elements" };
  const ek = Object.keys(el as Record<string, unknown>);
  if (ek.length !== 5 || !SAJU_ELEMENTS.every((k) => ek.includes(k))) return { ok: false, detail: "invalid_elements_key" };
  let total = 0;
  for (const k of SAJU_ELEMENTS) {
    const n = (el as Record<string, unknown>)[k];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 8) return { ok: false, detail: "invalid_element_count" };
    total += n;
  }
  if (total !== 6 && total !== 8) return { ok: false, detail: "invalid_element_total" };
  return { ok: true };
}

// 단정·겁주기·민감 주제 금지: 이런 말이 나오면 쓰지 않고(실패) 화면의 규칙 해설만 남긴다.
// 주제는 낱말 줄기로 막는다(Codex 4186597176: 「건강이 나빠질…」·「돈이 많이 들어올…」·「큰 사고 위험…」이 빠져나갔다). 「사고방식·사고력」·「돈독」은 예외.
const SAJU_STORY_BANNED = /결혼|이혼|임신|출산|사망|죽음|죽을|죽는|건강|질병|병에|병이|병원|아프|아플|다치|다칠|부상|수술|사고(?!방식|력)|위험|돈(?!독)|금전|재물|재산|부자|가난|월급|연봉|대출|빚|투자|주식|코인|로또|복권|대박|반드시|무조건|확실히|틀림없|운명이에요|운명입니다|정해져 있|조심하지 않으면|불행|저주|액운|흉하|심장|폐가|폐에|위장|소화|숨이|숨쉬|호흡|혈압|혈액|당뇨|두통|통증|증상|면역|검사를|검진|진료|진단|치료|약을|약이|의사(?!소통|결정|표현|표시)|몸이|몸에|몸을|몸의|체력|체중|살이 찌|다이어트|불면|잠을 못|우울|불안|공황|스트레스|약해질|약해지|암에|암이|암을|암 |걸리|걸릴|걸려|지치|지칠|피곤|병들|쓰러/;

// 앞날 말 금지(Codex 4186732157 · 4186865703 · 4187020963): 이야기에는 시기 재료를 주지 않으므로 앞날을 말할 이유가 없다.
// 그래서 여지를 둔 말(「~수 있어요」)로 감싸도 앞날을 가리키는 말이 든 문장이 하나라도 있으면 내보내지 않는다(문장 안 다른 마디의 여지로 덮이지 않음).
// 받침 ㄹ + 「거예요/것입니다」, 「~게 됩니다/돼요」도 앞날 단정이다.
const SAJU_FUTURE_MARKER = /내년|올해|이번 해|새해|곧|앞으로|머지않아|조만간|언젠가|나중에|가까운 시일|다음 (?:달|해|주)|미래|운세|시기|때가 오|인연(?:이|을|도)?\s?(?:와|오|올|생|찾아|만나|다가)|(?:좋은|새로운|운명의) 사람(?:을|이|도)?\s?(?:만나|와|오|올|찾아|생)/;
function isDefinitiveFuture(text: string): boolean {
  if (SAJU_FUTURE_MARKER.test(text)) return true;
  if (/게\s?(됩니다|돼요|되어요|될\s?거)/.test(text)) return true;
  for (const m of text.matchAll(/([가-힣])\s?(?:거|것)(?:예요|이에요|입니다|이다)/g)) {
    const code = m[1].charCodeAt(0) - 0xac00;
    if (code % 28 === 8) return true; // 받침 ㄹ(될·올·날·할 …) + 거예요 = 미래를 못 박는 말
  }
  return false;
}

// 단정 금지는 낱말을 막는 것만으로는 끝나지 않는다(Codex 4187150496 「조용하고 신중한 사람입니다」).
// 그래서 끝맺음을 「허용 목록」으로 바꾼다: 이야기의 모든 문장은 여지를 두는 말로, 마지막 한 줄은 권유·안부로 끝나야 한다.
const SAJU_STORY_ENDINGS = /(?:수(?:도)? 있어요|지도 몰라요|것 같아요|거 같아요|편이에요|편일지도 몰라요|기도 해요|괜찮아요)[.!…~]*$/;
const SAJU_CLOSING_ENDINGS = /(?:봐요|보세요|봐도 좋아요|해도 좋아요|해도 괜찮아요|어때요\?|괜찮아요)[.!…~]*$/;
function sentencesOf(text: string): string[] {
  // 마침표 뒤에 빈칸이 없어도 나눈다(Codex 4187349199 「~입니다.혼자 …」). 연속 부호(「…」「?!」)는 한 번에.
  return text.split(/(?<=[.!?…])(?![.!?…])\s*|\n+/).map((x) => x.trim()).filter(Boolean);
}
// 문장 끝이 여지를 둬도, 문장 안에 「~입니다/합니다」 같은 격식 단정이나 「~한 사람이에요·사람이고」 같은 규정 마디가 있으면 거절(Codex 4187460249).
const SAJU_CLAUSE_ASSERTION = /[가-힣]니다|사람(?:이에요|이고|이며|이라서|이죠|이야)|성격(?:이에요|이고|이며|이죠)/;
// 문장 끝만 여지를 두고 앞 마디에서 사람을 못 박는 경우(Codex PR #141 b7a8bb4 「당신은 조용하지만 … 날 수 있어요」).
// 낱말 목록을 더 늘리지 않고 「마디를 잇는 끝(~지만·~고·~며·~해서 …)」을 모양으로 본다: 이어지는 마디는 그 자체로 끝맺지 않으므로
// 여지를 둔 말(「~수 있고」·「~지도 모르지만」·「~편이라」·「~것 같아서」)로 이을 때만 허용한다. 「~고 싶/있/나」 같은 보조 동사와 「그리고」 같은 접속어는 마디가 아니다.
// Codex b7a8bb4 → afe492a: 「~하나·~해도·~한 반면」도 같은 이음이다(양보·대조 이음과 이유 이음을 함께 넣음).
const SAJU_CLAUSE_LINK = /(?:지만|고|며|면서|면서도|는데|은데|인데|해서|어서|아서|워서|라서|니까|으니|해도|어도|아도|워도|여도|더라도|거나|든지|므로|기에|길래|던데|스러우나|로우나)$/;
const SAJU_LINK_TOKENS = new Set(["반면", "반면에", "대신", "대신에"]);
const SAJU_LINK_WORDS = new Set(["그리고", "그래서", "그런데", "그러니까", "하지만", "그렇지만", "그러면서", "그래도", "그러나", "그러므로"]);
const SAJU_AUX_AFTER_GO = /^(?:싶|있|나|보|말|계|들)/;
function hasDefinitiveClause(sentence: string): boolean {
  const words = sentence.replace(/[,.!?…~"'「」]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i], prev = words[i - 1] ?? "", next = words[i + 1];
    const nDe = w.length >= 2 && w.endsWith("데") && (w.charCodeAt(w.length - 2) - 0xac00) % 28 === 4; // 받침 ㄴ + 데(센데·큰데)
    const haNa = w.length >= 3 && w.endsWith("하나"); // 조용하나·신중하나(「하나」 = 숫자 하나는 제외)
    if (SAJU_LINK_TOKENS.has(w) && i > 0) return true; // 「~한 반면」·「~한 대신」
    if (!(SAJU_CLAUSE_LINK.test(w) || nDe || haNa) || SAJU_LINK_WORDS.has(w)) continue;
    if (w.endsWith("고") && SAJU_AUX_AFTER_GO.test(next)) continue;
    if (/도$/.test(w) && /^(?:괜찮|좋|돼|되)/.test(next)) continue; // 「서두르지 않아도 괜찮아요」 = 허락하는 말, 이음 아님
    if (/^(?:있|없)/.test(w) && /^수도?$/.test(prev)) continue;
    if (/^(?:모르|몰라)/.test(w) && /지도$/.test(prev)) continue;
    if (/^편(?:이|인)/.test(w)) continue;
    if (/^같/.test(w) && /(?:것|거)$/.test(prev)) continue;
    return true;
  }
  return false;
}
function isHedgedStory(story: string, closing: string): boolean {
  if (SAJU_CLAUSE_ASSERTION.test(story) || SAJU_CLAUSE_ASSERTION.test(closing)) return false;
  const lines = sentencesOf(story);
  if (lines.length < 2 || !lines.every((x) => SAJU_STORY_ENDINGS.test(x))) return false;
  if (lines.some(hasDefinitiveClause)) return false;
  const close = sentencesOf(closing);
  return close.length === 1 && SAJU_CLOSING_ENDINGS.test(close[0]);
}

function sajuMessages(f: SajuFacts): Array<{ role: string; content: string }> {
  const counts = SAJU_ELEMENTS.map((k) => `${k} ${f.elements[k]}개`).join(", ");
  return [
    {
      role: "system",
      content:
        `너는 ECHO야. 사주를 오래 공부한 다정한 친구처럼, 사용자 한 사람에게 말을 건네듯 이야기해 줘.\n` +
        `다음 JSON 형식만 정확히 출력해. 다른 설명은 붙이지 마.\n\n` +
        `{\n  "story": "3~4문장. 이 사람의 결을 장면처럼 그려 주는 따뜻한 이야기. 해요체.",\n  "closing": "1문장. 오늘 이 사람에게 건네는 짧은 말. 해요체."\n}\n\n` +
        `규칙:\n` +
        `- 한국어 해요체로, 사람에게 말하듯 쉽게. 한자·전문 용어(십신·오행 이름 나열)는 쓰지 말고 뜻으로 풀어 줘.\n` +
        `- 지금 이 사람의 결(성향·마음이 움직이는 순간)만 이야기해. 앞날·시기·올해·인연이 온다는 말은 하지 마. 「~할 거예요」·「~하게 될 거예요」도 쓰지 마.\n` +
        `- story 의 모든 문장은 「~수 있어요」·「~지도 몰라요」·「~것 같아요」·「~편이에요」 중 하나로 끝내. 「~입니다」·「~해요」로 단정하지 마.\n` +
        `- 문장 중간에서도 「당신은 조용하지만」·「다정하고」처럼 못 박고 이어 가지 마. 마디를 이을 때는 「~수 있고」·「~편이라」처럼 여지를 둔 말로 이어.\n` +
        `- closing 은 한 문장, 「~해 봐요」·「~해도 좋아요」·「~어때요?」 같은 권유로 끝내.\n` +
        `- 결혼·건강·몸·마음의 병·돈·투자·사고·죽음은 말하지 마. 겁주는 말, 「반드시·무조건·확실히」 같은 말도 쓰지 마.\n` +
        `- 칭찬만 늘어놓지 말고, 이 사람이 스스로 고개를 끄덕일 만한 작은 장면(예: 어떤 순간에 힘이 나는지)을 하나 넣어 줘.\n` +
        `- 이건 재미로 보는 참고 이야기야. 사람을 판단하거나 정의하지 마.`,
    },
    {
      role: "user",
      content:
        `일간(나를 뜻하는 글자): ${f.dayMaster}\n` +
        `오행 개수: ${counts}\n` +
        `\n` +
        `이 값으로 이 사람에게 들려줄 이야기를 만들어 줘.`,
    },
  ];
}

// 로그인한 사람이면 그 계정으로, 아니면 접속 주소로 하루 호출 수를 센다.
// 2026-10-06: 예전에는 브라우저가 만든 세션 번호로만 세서, 번호를 바꿔 가며 보내면 하루 제한 없이 AI 비용을 쓸 수 있었다.
// 개인정보(Codex 4187460244): 계정 번호·접속 주소를 표에 그대로 남기지 않는다 — 서버만 아는 열쇠로 날짜와 함께 섞은 값(HMAC)만 쓴다.
// 같은 날 같은 사람만 같은 값이 되고, 날짜가 바뀌면 이어 붙일 수 없으며, 표만 보고는 누구인지 알 수 없다. 접속 주소 칸(ip)에도 아무것도 넣지 않는다.
async function opaqueKey(kind: "u" | "a", value: string, day: string): Promise<string | null> {
  if (!serviceRoleKey) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(serviceRoleKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`openai-chat:${kind}:${day}:${value}`)));
  return `${kind}:${[...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function rateKeyFor(req: Request, day: string): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (token && supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user?.id) return await opaqueKey("u", data.user.id, day);
    } catch { /* 공개 키·만료 토큰 → 로그인 안 한 사람으로 */ }
  }
  const ip = getClientIP(req);
  return ip === "unknown" ? null : await opaqueKey("a", ip, day);
}

function validateRequest(
  body: Record<string, unknown>,
): { ok: boolean; detail?: string } {
  const type = body.type;
  if (type !== "tarot_reading" && type !== "conversation" && type !== "saju_reading") {
    return { ok: false, detail: "invalid_type" };
  }

  if (type === "saju_reading") {
    return validateSajuFacts(body.facts);
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

  if (type === "saju_reading") {
    if (typeof p.story !== "string" || p.story.trim().length < 20 || p.story.length > 400) {
      return { ok: false, detail: "invalid_story" };
    }
    if (typeof p.closing !== "string" || p.closing.trim().length === 0 || p.closing.length > 120) {
      return { ok: false, detail: "invalid_closing" };
    }
    if (SAJU_STORY_BANNED.test(p.story) || SAJU_STORY_BANNED.test(p.closing) || isDefinitiveFuture(p.story) || isDefinitiveFuture(p.closing) || !isHedgedStory(p.story, p.closing)) {
      return { ok: false, detail: "banned_phrase" };
    }
    return { ok: true, parsed: { story: p.story.trim(), closing: p.closing.trim() } };
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
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const rateKey = await rateKeyFor(req, day);
  if (!rateKey) {
    return makeRateLimitResponse(corsHeaders);
  }
  let rateAllowed = false;
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("openai_rate_limit_allow", {
        p_session_id: rateKey,
        p_ip: null, // 접속 주소를 표에 남기지 않는다(개인정보 · Codex 4187460244)
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

  // 로그인하지 않은 요청은 주소별 제한을 통과해도, 모두가 함께 쓰는 하루 상한을 한 번 더 통과해야 한다(같은 표·같은 함수 · 대기시간 0).
  if (rateKey.startsWith("a:")) {
    try {
      const { data, error } = await supabase.rpc("openai_rate_limit_allow", {
        p_session_id: ANON_BUCKET,
        p_ip: null,
        p_day: day,
        p_daily_limit: ANON_DAILY_TOTAL,
        p_cooldown_ms: 0,
      });
      if (error) return makeServerErrorResponse(corsHeaders);
      if (data !== true) return makeRateLimitResponse(corsHeaders);
    } catch {
      return makeServerErrorResponse(corsHeaders);
    }
  }

  const type = body.type as string;

  let messages: Array<{ role: string; content: string }> = [];

  if (type === "saju_reading") {
    messages = sajuMessages(body.facts as SajuFacts);
  } else if (type === "tarot_reading") {
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