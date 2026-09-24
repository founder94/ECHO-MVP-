// doit-connect — 연결 서버 (v1.2 · 2026-09-24)
//
// v1.2(대표 2026-09-24 "최종완성하라고"): 막힌 곳 세 군데를 푼다.
//  (a) 겹친 말이 없는 같은 목적 쌍도 후보 목록 맨 뒤에 "겹친 말 없음"으로 보여 준다(빠져나갈 문). 추천 순서는 그대로 겹친 말 우선이고,
//      겹친 말 없는 쌍은 관리자가 noCommonOk 로 한 번 더 확인해야 승인된다. 첫 질문은 목적만 보고 만든다.
//  (b) 연결 동의: 첫 답을 보내면 둘 다 답한 순간 상대에게 내 닉네임·대표 사진·소개·첫 답이 보인다. 그래서 첫 답 전에
//      동의(user_metadata.doit_connect_consent_version = CONNECT_CONSENT_VERSION)를 서버가 확인한다. 동의 전에는 아무것도 공개되지 않는다.
//  (c) my_turns: 앱 홈이 가볍게 "내 차례"(답할 첫 질문·상대가 보낸 이야기·새로 열린 연결)만 센다. 내용·이름은 내려 주지 않는다.
//
// v1.1(대표 2026-09-24 "그렇게 바꿔"): 연결 자격의 「맞다고 한 말 5개」를 「이번 회차 다섯 가지 질문에 모두 답함」으로 바꾼다
// (doit-understanding connection_preview 와 같은 기준 = 화면의 n / 5). 맞다고 한 말은 두 사람의 겹친 말을 찾는 데만 쓴다.
//
// 근거: 대표 확정 연결 원칙(2026-09-21) "전화 인증 필수 → 확인한 이해 5개 + 필수 사진 3장 + 소개 = 연결 자격 →
// 목적 호환 + 확인한 말 공통점으로 서버가 후보 결정 → AI 첫 질문 동시 공개(blind-first) → 첫 100명 대표 수동 승인",
// 대표 2026-09-23 "어디까지 구현을 해야 되는 단계까지는 승인하니까 허용하고 끝까지 진행시켜".
//
// 하는 일
// ① phone_sync: 로그인 정보에 문자 인증이 끝난 번호가 있으면 profiles.verification_status 를 verified 로 맞춘다.
//    화면이 "인증됐다"고 말해도 믿지 않는다 — Auth 서버가 돌려준 phone_confirmed_at 만 본다. 번호는 돌려주지도 기록하지도 않는다.
// ② admin_candidates(관리자): 연결 자격을 갖춘 사람 중 같은 목적 쌍을 서버가 고른다. 맞다고 한 말이 겹치는 쌍이 앞,
//    겹친 말 없는 쌍은 뒤(no_common, v1.2). 차단한 사이·이미 결정한 쌍은 뺀다.
// ③ admin_decide(관리자): 대표가 승인하면 AI 가 두 사람에게 같은 첫 질문을 만든다(검사에 걸리면 고정 문장). 넘기기도 기록한다.
//    결정 순간에 자격·목적·차단·겹침을 서버가 다시 확인한다(화면이 보낸 값을 믿지 않는다).
// ④ my_matches: 내 연결. 두 사람이 모두 첫 질문에 답하기 전에는 상대의 이름·사진·소개·답을 절대 내려 주지 않는다(blind-first).
// ⑤ answer / message: 첫 답, 그 뒤 이야기. 저장 금지 입력(연락처·식별번호·링크·성적 표현)은 막고 안내한다.
// ⑥ leave: 그만하기(차단·신고 선택). 끝난 연결은 상대 정보를 다시 내려 주지 않는다.
// ⑦ admin_matches(관리자): 연결 목록과 진행(답 수·이야기 수). 이야기 내용은 내려 주지 않는다.
//
// 원칙
// - 모든 요청은 getUser() 실검증. 관리자 요청은 profiles.role = 'admin' 을 서버가 다시 확인한다.
// - 저장 표(doit_matches·doit_match_answers·doit_match_messages)는 RLS 정책 0개 + 화면 권한 없음 → 이 함수만 읽고 쓴다.
// - 로그에 사용자 원문·번호·토큰을 남기지 않는다(코드와 개수만).

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

type Json = Record<string, unknown>;
type Db = SupabaseClient;

const ACTIONS = new Set([
  "phone_sync",
  "my_matches", "my_turns", "answer", "message", "leave",
  "admin_candidates", "admin_matches", "admin_decide",
]);

const LIMITS = {
  BODY_MAX_BYTES: 32 * 1024,
  RATE_WINDOW_MS: 60_000,
  RATE_MAX_PER_WINDOW: 60,
  REPEAT_SIM: 0.6,              // doit-understanding 과 같은 값(겹친 말 판정)
  REPEAT_OVERLAP: 0.7,
  CONNECT_ANSWERS_NEEDED: 5,    // 연결 자격: 이번 회차 다섯 가지 질문에 모두 답함(대표 2026-09-24, doit-understanding 과 같다)
  CONNECT_PHOTOS_NEEDED: 3,     // 연결 자격: 필수 사진 3장(전신·패션·취미)
  COMMON_MAX: 3,                // 쌍마다 보여 줄 겹친 말 최대 개수(한쪽 기준)
  POOL_MAX: 500,                // 한 번에 살펴볼 사람 상한
  CONFIRMED_PER_USER: 24,       // 한 사람의 맞다고 한 말 상한
  CANDIDATES_MAX: 50,           // 관리자에게 보여 줄 후보 쌍 상한
  MATCHES_MAX: 100,
  ANSWER_MAX: 300,
  MESSAGE_MAX: 500,
  MESSAGES_SHOWN: 80,
  QUESTION_MIN: 5,
  QUESTION_MAX: 60,
  AI_TIMEOUT_MS: 12_000,
  SIGNED_URL_SECONDS: 600,
} as const;

const CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  INVALID_STATE: "INVALID_STATE",
  NOT_ELIGIBLE: "NOT_ELIGIBLE",
  CONSENT_REQUIRED: "CONSENT_REQUIRED",
  BLOCKED_CONTENT: "BLOCKED_CONTENT",
  RATE_LIMITED: "RATE_LIMITED",
  TOO_LARGE: "TOO_LARGE",
  ERROR: "ERROR",
} as const;

const PHOTO_BUCKET = "profile-photos";
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// 호출 주소는 환경변수로 바꿀 수 없다(비공식 게이트웨이 경유 금지).
function resolveModel(raw: string | undefined): string {
  const model = (raw ?? "").trim();
  return !model || model === "gpt-40-mini" ? "gpt-4o-mini" : model;
}

// 화면에 쓰지 않는 단어(기준 문서 §1).
const BANNED_WORDS = /데이팅|소개팅|궁합|점술|심리치료|성격검사/;
// 첫 질문에서 묻지 않는 것: 연락처·사는 곳·직장·나이·몸·외모. 처음 만나는 사이에 부담이 되거나 개인정보다.
const PRIVATE_ASK = /연락처|번호|주소|사는\s*곳|어디\s*살|직장|회사|학교|나이|몇\s*살|키가|몸무게|외모|사진|인스타|카톡|아이디/;
// 연결 동의 판(화면 src/doit/lib/connectApi.ts 의 같은 이름 값과 같아야 한다 — 검사가 확인한다).
const CONNECT_CONSENT_VERSION = "connect-v1";
const FIRST_QUESTION_FALLBACK = "처음 만난 사람에게 가장 먼저 들려주고 싶은 내 이야기는 뭐예요?";

const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const corsHeaders = (origin: string | null): Record<string, string> => {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin
    : ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};
const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
const fail = (code: string, error: string, status = 200, origin: string | null = null) =>
  json({ ok: false, code, error }, status, origin);

// ── 텍스트 유사도 (doit-understanding 과 같은 식 — qa/connect-server.test.mjs 가 두 복사본이 같은지 검사한다) ──
const normalizeKey = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
function bigrams(s: string): Set<string> {
  const c = normalizeKey(s);
  const set = new Set<string>();
  for (let i = 0; i < c.length - 1; i++) set.add(c.slice(i, i + 2));
  return set;
}
function overlapStats(a: string, b: string): { sim: number; overlap: number } {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return { sim: 0, overlap: 0 };
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return { sim: inter / (A.size + B.size - inter), overlap: inter / Math.min(A.size, B.size) };
}
function looksSame(a: string, b: string, sim: number, overlap: number): boolean {
  const s = overlapStats(a, b);
  return s.sim > sim || s.overlap > overlap;
}
// ── /텍스트 유사도 ──

// v15.1 저장 금지 입력 + 연결 자격의 "유효한 답" 판정: doit-understanding·화면과 같은 RULES 블록 전체를 그대로 옮겨 둔다(qa/conversation-rules.test.mjs 가 세 곳이 같은지 검사).
// ── RULES (shared with supabase/functions/doit-understanding/index.ts v13) ──
// 대화 규칙의 순수 판정 함수. 질문 문장을 만들지 않는다(문장은 서버의 AI가 만든다).
// 서버 파일에 같은 블록이 있고, qa/conversation-rules.test.mjs 가 두 복사본이 같은지 검사한다.
// - TOPICS: 서버가 "아직 안 나온 주제"를 고를 때 쓰는 나침반. 순서는 우선순위일 뿐 고정 질문이 아니다.
// - isMetaReply: 답이 아니라 "질문이 무슨 뜻이냐"는 되묻기인지. 짧고 질문 자체를 가리킬 때만 true.
// - blockedContentReason: 저장하면 안 되는 입력(연락처·식별번호·링크·성적 표현). 규칙 판정이라 AI를 거치지 않는다.
// v14(대표 2026-09-22): 주제는 "자기이해 심화"가 아니라 "상대를 골라 주려면 알아야 하는 것"이다.
// 두 사람을 겹쳐 볼 수 있는 칸만 남긴다. 마음·감정을 파고드는 주제(mood)는 뺐다.
export const TOPICS = [
  { id: "purpose", label: "원하는 만남" },
  { id: "partner_style", label: "끌리는 사람" },
  { id: "together", label: "같이 하고 싶은 것" },
  { id: "self", label: "상대가 알면 좋을 나" },
  { id: "pace", label: "만나는 방식" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];
export function isTopicId(value: unknown): value is TopicId {
  return typeof value === "string" && TOPICS.some((t) => t.id === value);
}
export function pickNextTopic(covered: Iterable<string>): TopicId | null {
  const done = new Set(covered);
  return TOPICS.find((t) => !done.has(t.id))?.id ?? null;
}
const META_MAX_LENGTH = 60;
// v14.3(대표 실기기 2026-09-24): "질문이 머이래"·"딥하네"·"무슨 말이야 글자 오타 아니야?"를 답으로 저장했다 → 구어체(머·먼)·불평·오타 지적을 더한다.
// "모르겠어요"는 되묻기가 아니라 정상 답이다(기준 문서 §2) — 질문을 가리키는 말 없이 "모르겠어요"만 오면 답으로 저장한다.
// "말이 이상한 사람은 싫어" 같은 진짜 답을 되묻기로 오인하지 않게, "말"은 무슨·뭔·이해 와만 묶는다.
const META_PATTERNS: readonly RegExp[] = [
  /(질문|뜻|문장|글자|글씨)\s*(이|은|가)?\s*(무슨|뭔|머|뭐|이해|어렵|어려|이상|모르|헷갈|애매)/,
  /말\s*(이|은)?\s*(무슨|뭔|머|뭐|이해)/,
  /(무슨|뭔|먼|머)\s*(뜻|말|질문|소리|얘기)/,
  /(뭐|머)라(는|고|냐|구)/,
  /이게\s*(뭐|머|무슨)/,
  /다시\s*(말|설명|물어|얘기)/,
  /예를?\s*들/,
  /어떻게\s*(답|대답|적|써|말)/,
  /오타/,
  /^(너무|좀|넘|질문이?|말이)?\s*(딥|깊|무겁|어렵|어려|헷갈|이상)(하네|해|하다|네|다|워|운데|네요|해요|어요|하네요|하다고|려|려요|리네|리네요)?[\s.!?~ㅋㅎ]*$/,
  /^[^\s?]{1,6}\?+$/,
  /^\?+$/,
];
export function isMetaReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > META_MAX_LENGTH) return false;
  return META_PATTERNS.some((p) => p.test(t));
}
// v14.4 AI 에게 하는 질문(답이 아님): "왜 이런 걸 물어봐?", "이거 어디에 써요?", "누가 봐요?", "몇 개 남았어요?", "넌 누구야?".
// 답으로 저장하지 않고 먼저 답한 뒤 같은 질문을 다시 건넨다. "왜"가 들어간 진짜 답("왜냐면 편해서요")을 막지 않게 묻는 대상과 묶는다.
const ASK_AI_PATTERNS: readonly RegExp[] = [
  /왜\s*(이런|그런|이|그|저런)?\s*(걸|거|것|질문|얘기)?\s*(을|를)?\s*(자꾸|계속)?\s*(물어|묻|알아야|알려고|궁금|필요)/,
  /(이거|이건|이걸|여기|이\s*앱|이\s*서비스|두잇|DO\s*IT)\s*(는|은|가|이)?\s*(뭐|머|뭔|무슨|왜)\s*(야|예요|에요|하는|해|하|지|죠|인데|냐|니|데|\?)/i,
  /(너|넌|니가|네가|너는|AI|에이아이)\s*(는|가|은)?\s*(누구|뭐|머|뭔|진짜)/i,
  /(너|넌|너는)\s*(AI|에이아이|로봇|사람|기계)\s*(야|이야|예요|이에요|인가요|니|냐)?\s*[?？]/i,
  /(어디에|어디|어따|누가|누구한테|누구에게)\s*(써|쓰|쓰여|쓰이|쓸|봐|보|보여|보이|공개|저장|넘어)/,
  /(저장|공개|기록)\s*(돼요|되나요|될까요|되는\s*거(야|예요|에요|죠)?|돼|되나|될까)\s*[?？]/,
  /(저장|공개|기록)\s*(되나요|될까요|되는\s*건가요)/,
  /(몇\s*(개|번|가지)\s*(더|남|까지|물어|해야)|언제\s*(끝|까지)|얼마나\s*(더|남))/,
];
export function isAskingAi(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > META_MAX_LENGTH) return false;
  return ASK_AI_PATTERNS.some((p) => p.test(t));
}
// v15(대표 실기기 2026-09-24 "뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야?" / "할말이없다 휴"):
// 관계에 대한 답이 아닌 말을 규칙으로 먼저 가른다. 규칙이 못 잡은 짧은 말은 서버의 AI 분류가 한 번 더 본다(turn_classify).
// - complaint: 질문이 겉돈다·같은 걸 또 묻는다·내 말을 반영하라는 불만. 기록하지 않고, 앞 답에서 이어지는 새 질문을 받는다.
// - fatigue: 지친 말·할 말이 없다·그만하고 싶다. 기록하지 않고 사용자의 성향으로 해석하지 않는다(다른 질문 받기·쉬어 가기).
// - unsure: "모르겠어요"는 정상 답이다(기록하고 다섯 칸에 센다). 다만 나에 대한 사실로 만들지 않고 다음 질문을 더 쉽게 한다.
// - correction: "그 뜻 아니야"·"잘못 이해했어"처럼 AI 가 잘못 들었다고 고치는 말. 뒤에 붙은 설명이 있으면 그 설명이 답이다.
//   "아니요, 대화가 많은 게 좋아요"처럼 질문에 대한 부정 답은 정정이 아니다(질문이 아니라 AI 의 이해를 가리킬 때만).
export type TurnKind = "answer" | "ask" | "meta" | "complaint" | "fatigue" | "unsure" | "correction";
const COMPLAINT_MAX_LENGTH = 120;
// v15.1(2026-09-24, LEVEL 2 연습 실행에서 발견): 규칙이 답 안의 낱말 하나("같은 거"·"지쳐서"·"다 말했어요"·"네")만 보고
// 진짜 답을 불만·지친 말로 판정해 저장하지 않았다(실사용 말투 16개 중 14개 오판). 규칙은 판정을 끝내는 층이므로
// 대화 자체를 가리키는 게 분명한 말만 잡는다. 애매한 말은 규칙이 비워 두고(null) 서버의 AI 분류가 뜻으로 가른다(실패하면 답으로 둔다 — 원문을 잃지 않는다).
const COMPLAINT_PATTERNS: readonly RegExp[] = [
  /(뭘|뭐를|무엇을|뭐|머)\s*(더|또)\s*(얘기|얘길|애기|애길|이야기|이야길|말|적|써|답)/,
  /(너|니|AI|에이아이)\s*(가|는|이)?\s*(알아서|내\s*(말|얘기|애기|이야기|내용|답)|반영)/i,
  /내\s*(말|얘기|애기|이야기|내용|답)\s*(을|를|은|좀)?\s*(반영|안\s*듣|안\s*들|못\s*알아|무시)/,
  /반영\s*(해\s*(줘|야|주)|을\s*안|이\s*안|안\s*(해|돼|되)|좀)/,
  /(같은|똑같은|비슷한)\s*질문/,
  /(같은|똑같은|비슷한)\s*(말|얘기|애기|이야기|걸|거)\s*(을|를|만)?\s*(또|계속|자꾸|다시|반복|물어|묻)/,
  /(또|계속|자꾸)\s*(같은|똑같은|그)?\s*(질문|물어|묻)/,
  /(질문|물어|묻)\S*\s*(이|가|은)?\s*(이상|엉뚱|뜬금|겉돌|왜\s*이래)/,
  /(아까|이미|벌써)\s*(말했|얘기했|애기했|이야기했|적었|답했)\S*\s*(잖|는데|다니까|다고|거든)/,
  /^(아까|이미|벌써|다)\s*(말했|얘기했|애기했|이야기했|적었|답했)\S*[\s.!?~ㅠㅜ]*$/,
];
const FATIGUE_PATTERNS: readonly RegExp[] = [
  /^(음+|아+|그냥|진짜|정말|더|이제|딱히)?\s*할\s*말\s*(이|은|도)?\s*(없|더\s*없)\S*[\s.!~ㅠㅜ휴하]*$/,
  /^(이제|그냥|오늘은|나|저)?\s*그만\s*(할|하|둘|두|해)\S*[\s.!~ㅠㅜ]*$/,
  /^(아+|아휴|에휴|하+|너무|진짜|정말|좀|이제|벌써|나|저)?[\s,.]*(너무|진짜|좀)?\s*(지쳤|지친다|지쳐|피곤해|피곤하|귀찮)\S*[\s.!~ㅠㅜ]*$/,
  /(대답|답|답장|쓰기|적기|말하기|이거|질문에)\s*(하기)?\s*싫/,
  /^(휴+|하+|에휴|아휴|후+|하아+)[\s.!~ㅠㅜ]*$/,
  /^(그냥|이제|오늘은)?\s*(패스|넘어갈래|넘길래|건너뛸래|다음에\s*할래|나중에\s*할래|여기까지)\S*[\s.!~ㅠㅜ]*$/,
];
const UNSURE_MAX_LENGTH = 24;
const UNSURE_PATTERN = /^(음+|글쎄(요)?|잘|흠+)?[\s,.]*(모르겠|몰라|모름|글쎄|딱히\s*(없|생각)|생각\s*(이\s*)?안\s*나|아직\s*(모르|생각)|없어요?$|없음$|없는\s*것\s*같)/;
const CORRECTION_PATTERNS: readonly RegExp[] = [
  /^(아니|아뇨|아니야|아니요)?[\s,.]*(그게|그건|그런|그|이건|이게)\s*(뜻|말|의미)?\s*(이|은|은요)?\s*아니\S*/,
  /잘못\s*(이해|알아|들|짚|알았|받아)\S*/,
  /(내|제)\s*(말|뜻)\s*(은|는)\s*(그게|그런|그런\s*뜻이)?\s*아니\S*/,
  /^아니[야요]?[\s,.!~]*$/,
];
export function correctionRest(text: string): string {
  const t = text.trim();
  for (const p of CORRECTION_PATTERNS) {
    const m = t.match(p);
    if (m) return t.slice((m.index ?? 0) + m[0].length).replace(/^[\s,.!~]*/, "").trim();
  }
  return "";
}
export function ruleKind(text: string): TurnKind | null {
  const t = text.trim();
  if (!t) return null;
  if (isAskingAi(t)) return "ask";
  if (t.length <= COMPLAINT_MAX_LENGTH && COMPLAINT_PATTERNS.some((p) => p.test(t))) return "complaint";
  if (isMetaReply(t)) return "meta";
  if (t.length <= COMPLAINT_MAX_LENGTH && FATIGUE_PATTERNS.some((p) => p.test(t))) return "fatigue";
  if (t.length <= COMPLAINT_MAX_LENGTH && CORRECTION_PATTERNS.some((p) => p.test(t))) return "correction";
  if (t.length <= UNSURE_MAX_LENGTH && UNSURE_PATTERN.test(t)) return "unsure";
  return null;
}
// v15.1(대표 결정 2026-09-24 「모르겠어요 ×5 연결 자격 금지」): 대화 진행(다섯 칸)과 연결 자격은 다르다.
// 다섯 칸은 적은 답을 모두 세지만, 연결 자격의 "다섯 답"은 관계에 대한 정보가 담긴 답만 센다.
// "모르겠어요"·지친 말·불만·AI 에게 한 질문·되묻기·설명 없는 "그게 아니에요"는 원문은 남아도 자격에 세지 않는다.
export function informativeAnswer(text: string): boolean {
  const kind = ruleKind(text);
  if (!kind) return text.trim().length > 0;
  return kind === "correction" && correctionRest(text).length > 0;
}
export type BlockedReason = "phone" | "email" | "id_number" | "link" | "card" | "sexual";
const BLOCKED_PATTERNS: readonly { reason: BlockedReason; pattern: RegExp }[] = [
  { reason: "phone", pattern: /(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/ },
  { reason: "phone", pattern: /(?:^|\D)0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}(?:\D|$)/ },
  { reason: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { reason: "id_number", pattern: /(?:^|\D)\d{6}[-\s]?[1-4]\d{6}(?:\D|$)/ },
  { reason: "card", pattern: /(?:^|\D)\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}(?:\D|$)/ },
  { reason: "link", pattern: /https?:\/\/|www\.|[A-Za-z0-9-]+\.(?:com|net|kr|io|me|link)(?:\/|\s|$)/i },
  { reason: "sexual", pattern: /섹스|성관계|원나잇|조건\s*만남|성매매|야한\s*사진|몸\s*사진|노콘/ },
];
export function blockedContentReason(text: string): BlockedReason | null {
  const t = text.normalize("NFKC");
  for (const { reason, pattern } of BLOCKED_PATTERNS) if (pattern.test(t)) return reason;
  return null;
}
export function blockedContentMessage(reason: BlockedReason): string {
  const what = reason === "sexual" ? "성적인 표현" : reason === "link" ? "링크" : reason === "email" ? "이메일 주소" : reason === "card" ? "카드번호" : reason === "id_number" ? "주민번호" : "전화번호";
  return `${what}은(는) 저장하지 않아요. 그 부분을 빼고 다시 적어 주세요. 적은 내용은 그대로 남아 있어요.`;
}
// ── /RULES ──
function blockedMessage(reason: BlockedReason): string {
  const what = reason === "sexual" ? "성적인 표현" : reason === "link" ? "링크" : reason === "email" ? "이메일 주소" : reason === "card" ? "카드번호" : reason === "id_number" ? "주민번호" : "전화번호";
  return `${what}은(는) 보낼 수 없어요. 그 부분을 빼고 다시 적어 주세요. 적은 내용은 그대로 남아 있어요.`;
}

function roundStartOf(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const v = user.user_metadata?.doit_round_started_at;
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
}
const inRound = (createdAt: string | undefined, since: string | null): boolean => !since || !createdAt || createdAt >= since;
// 연결 동의 — 화면이 로그인 정보(user_metadata)에 남긴 판과 시각. 판이 다르면(문구가 바뀌면) 다시 묻는다.
function consentedToConnect(user: { user_metadata?: Record<string, unknown> | null }): boolean {
  const m = user.user_metadata ?? {};
  return m.doit_connect_consent_version === CONNECT_CONSENT_VERSION && typeof m.doit_connect_consent_at === "string" && !Number.isNaN(Date.parse(m.doit_connect_consent_at));
}

const rateBuckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < LIMITS.RATE_WINDOW_MS);
  if (arr.length >= LIMITS.RATE_MAX_PER_WINDOW) { rateBuckets.set(userId, arr); return true; }
  arr.push(now);
  rateBuckets.set(userId, arr);
  return false;
}

// 진단 로그 — 사용자 원문·번호·토큰은 넣지 않는다.
function logDiag(fields: Record<string, unknown>): void {
  try { console.log(JSON.stringify({ evt: "doit_connect", ...fields })); } catch { /* 로그 실패는 무시 */ }
}

const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
const pairKey = (x: string, y: string): string => pairOf(x, y).join("|");
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const cleanText = (v: unknown): string => str(v).normalize("NFKC").replace(/\s+/g, " ").trim();

interface Member {
  id: string;
  nickname: string;
  purposeId: string | null;
  purposeLabel: string | null;
  bio: string;
  phoneVerified: boolean;
  confirmed: string[];
  answers: number;
  requiredPhotos: number;
  eligible: boolean;
  missing: string[];
}

interface AuthInfo { phoneConfirmed: boolean; since: string | null }

// 로그인 정보(문자 인증 여부·회차 시작 시각)를 한 번에 읽는다. 사람이 많아지면 여러 쪽으로 나눠 읽는다.
async function authInfoOf(admin: Db, ids: Set<string>): Promise<Map<string, AuthInfo>> {
  const out = new Map<string, AuthInfo>();
  for (let page = 1; page <= 20 && out.size < ids.size; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("auth_list_failed");
    const users = data?.users ?? [];
    for (const u of users) {
      if (!ids.has(u.id)) continue;
      out.set(u.id, { phoneConfirmed: !!u.phone && !!u.phone_confirmed_at, since: roundStartOf(u) });
    }
    if (users.length < 1000) break;
  }
  return out;
}

// 연결 자격을 서버가 계산한다. 화면의 "준비 상태"(doit-understanding connection_preview)와 같은 기준이다.
async function loadMembers(admin: Db, onlyIds?: string[]): Promise<Member[]> {
  let q = admin.from("profiles").select("id, nickname, display_name, purpose_id, purpose_label, bio, verification_status");
  q = onlyIds ? q.in("id", onlyIds) : q.not("purpose_id", "is", null);
  const { data: profiles, error } = await q.limit(LIMITS.POOL_MAX);
  if (error) throw new Error("profiles_failed");
  const rows = profiles ?? [];
  if (!rows.length) return [];
  const ids = rows.map((p) => String(p.id));
  const [{ data: photos }, { data: insights }, { data: records }, auth] = await Promise.all([
    admin.from("profile_photos").select("user_id, slot").in("user_id", ids),
    admin.from("doit_insights").select("user_id, text, created_at").in("user_id", ids).in("status", ["confirmed", "corrected"]).order("updated_at", { ascending: false }).limit(ids.length * LIMITS.CONFIRMED_PER_USER),
    admin.from("doit_records").select("user_id, text, status, created_at").in("user_id", ids).order("created_at", { ascending: false }).limit(ids.length * LIMITS.CONFIRMED_PER_USER),
    authInfoOf(admin, new Set(ids)),
  ]);
  // 이번 회차에 남긴 내 답 가운데 관계에 대한 정보가 담긴 답 수(아니라고 한 기록 제외).
  // v15.1 "모르겠어요"·지친 말·불만 등은 원문이 남아도 세지 않는다(대화 진행 칸과 다르다 · doit-understanding connection_preview 와 같은 기준).
  const answers = new Map<string, number>();
  for (const row of records ?? []) {
    const uid = String(row.user_id);
    if (row.status === "rejected" || !inRound(str(row.created_at) || undefined, auth.get(uid)?.since ?? null)) continue;
    if (!informativeAnswer(String(row.text ?? ""))) continue;
    answers.set(uid, (answers.get(uid) ?? 0) + 1);
  }
  const slots = new Map<string, Set<number>>();
  for (const p of photos ?? []) {
    const s = Number(p.slot);
    if (s >= 1 && s <= LIMITS.CONNECT_PHOTOS_NEEDED) slots.set(String(p.user_id), (slots.get(String(p.user_id)) ?? new Set()).add(s));
  }
  const confirmed = new Map<string, string[]>();
  for (const row of insights ?? []) {
    const uid = String(row.user_id);
    const t = cleanText(row.text);
    if (!t || !inRound(str(row.created_at) || undefined, auth.get(uid)?.since ?? null)) continue;
    const list = confirmed.get(uid) ?? [];
    if (list.length < LIMITS.CONFIRMED_PER_USER && !list.includes(t)) list.push(t);
    confirmed.set(uid, list);
  }
  return rows.map((p) => {
    const id = String(p.id);
    const phoneVerified = str(p.verification_status) === "verified" || !!auth.get(id)?.phoneConfirmed;
    const mine = confirmed.get(id) ?? [];
    const requiredPhotos = slots.get(id)?.size ?? 0;
    const bio = cleanText(p.bio);
    const missing: string[] = [];
    if (!p.purpose_id) missing.push("purpose");
    if (!phoneVerified) missing.push("phone");
    const answered = answers.get(id) ?? 0;
    if (answered < LIMITS.CONNECT_ANSWERS_NEEDED) missing.push("answers");
    if (requiredPhotos < LIMITS.CONNECT_PHOTOS_NEEDED) missing.push("photos");
    if (!bio) missing.push("intro");
    return {
      id, nickname: cleanText(p.nickname) || cleanText(p.display_name) || "이름 없음",
      purposeId: p.purpose_id ? String(p.purpose_id) : null, purposeLabel: p.purpose_label ? String(p.purpose_label) : null,
      bio, phoneVerified, confirmed: mine, answers: answered, requiredPhotos, eligible: missing.length === 0, missing,
    };
  });
}

function commonOf(a: Member, b: Member): { a: string[]; b: string[] } {
  const pick = (from: string[], other: string[]) => from.filter((m) => other.some((t) => looksSame(m, t, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP))).slice(0, LIMITS.COMMON_MAX);
  return { a: pick(a.confirmed, b.confirmed), b: pick(b.confirmed, a.confirmed) };
}

// 차단은 어느 한쪽만 해도 둘은 다시 이어지지 않는다.
async function blockedPairs(admin: Db, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const [{ data: byMe }, { data: byOther }] = await Promise.all([
    admin.from("blocks").select("blocker_id, blocked_user_id").in("blocker_id", ids),
    admin.from("blocks").select("blocker_id, blocked_user_id").in("blocked_user_id", ids),
  ]);
  for (const r of [...(byMe ?? []), ...(byOther ?? [])]) out.add(pairKey(String(r.blocker_id), String(r.blocked_user_id)));
  return out;
}

async function isAdmin(admin: Db, userId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return !!data && String(data.role) === "admin";
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.4, max_tokens: 300, response_format: { type: "json_object" } }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`openai_${res.status}`);
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

const FIRST_QUESTION_SYSTEM =
  "너는 'DO IT'이다. 같은 만남을 원하는 두 사람이 처음으로 서로에게 답할 질문 하나를 만든다. " +
  "아래 자료는 두 사람이 각자 '맞아요'라고 한 말 중 서로 겹치는 부분이다(비어 있으면 원하는 만남만 보고 만든다). 두 사람 모두 편하게 답할 수 있고, 답을 읽으면 서로를 조금 알게 되는 질문을 만든다. " +
  "규칙: 한 문장, 물음표 하나, 공백 포함 45자 이내. 자료의 문장을 그대로 옮기지 않는다. 연락처·사는 곳·직장·학교·나이·몸·외모·사진을 묻지 않는다. " +
  "마음속을 파고들거나 진단하지 않는다. 데이팅·소개팅·궁합·점술·심리치료·성격검사 같은 단어를 쓰지 않는다. " +
  "JSON {\"question\":\"...\"} 로만 답한다.";

// AI 가 만든 첫 질문을 서버가 검사한다. 하나라도 걸리면 쓰지 않는다.
function acceptableQuestion(q: string, sources: string[]): boolean {
  if (q.length < LIMITS.QUESTION_MIN || q.length > LIMITS.QUESTION_MAX) return false;
  if ((q.match(/\?/g) ?? []).length !== 1 || !q.endsWith("?")) return false;
  if (q.includes("\n")) return false;
  if (BANNED_WORDS.test(q) || PRIVATE_ASK.test(q) || blockedContentReason(q)) return false;
  const nq = normalizeKey(q);
  return !sources.some((s) => { const ns = normalizeKey(s); return ns.length >= 6 && nq.includes(ns); });
}

async function firstQuestionFor(purpose: string | null, common: { a: string[]; b: string[] }): Promise<{ question: string; source: "ai" | "fixed"; reason?: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const model = resolveModel(Deno.env.get("OPENAI_MODEL"));
  if (!apiKey) return { question: FIRST_QUESTION_FALLBACK, source: "fixed", reason: "no_key" };
  try {
    const raw = await callOpenAI(apiKey, model, FIRST_QUESTION_SYSTEM, JSON.stringify({ purpose, first_person: common.a, second_person: common.b }), LIMITS.AI_TIMEOUT_MS);
    const parsed = JSON.parse(raw) as { question?: unknown };
    const q = cleanText(parsed?.question);
    if (acceptableQuestion(q, [...common.a, ...common.b])) return { question: q, source: "ai" };
    return { question: FIRST_QUESTION_FALLBACK, source: "fixed", reason: "rejected" };
  } catch {
    return { question: FIRST_QUESTION_FALLBACK, source: "fixed", reason: "ai_error" };
  }
}

interface MatchRow { id: string; user_a: string; user_b: string; purpose_id: string | null; common: string[] | null; first_question: string | null; status: string; created_at: string }

async function loadMatch(admin: Db, matchId: string, userId: string): Promise<{ match: MatchRow; partnerId: string } | null> {
  const { data } = await admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").eq("id", matchId).maybeSingle();
  if (!data) return null;
  const m = data as MatchRow;
  if (m.user_a !== userId && m.user_b !== userId) return null; // 남의 연결은 "없음"으로 답한다(있는지조차 알리지 않는다)
  return { match: m, partnerId: m.user_a === userId ? m.user_b : m.user_a };
}

async function answersOf(admin: Db, matchIds: string[]): Promise<Map<string, Map<string, { answer: string; created_at: string }>>> {
  const out = new Map<string, Map<string, { answer: string; created_at: string }>>();
  if (!matchIds.length) return out;
  const { data } = await admin.from("doit_match_answers").select("match_id, user_id, answer, created_at").in("match_id", matchIds);
  for (const r of data ?? []) {
    const m = out.get(String(r.match_id)) ?? new Map();
    m.set(String(r.user_id), { answer: str(r.answer), created_at: str(r.created_at) });
    out.set(String(r.match_id), m);
  }
  return out;
}

async function primaryPhotoUrl(admin: Db, userId: string): Promise<string | null> {
  const { data } = await admin.from("profile_photos").select("slot, storage_path, is_primary").eq("user_id", userId);
  const rows = (data ?? []).filter((r) => typeof r.storage_path === "string" && r.storage_path.startsWith(`${userId}/`));
  if (!rows.length) return null;
  const pick = rows.find((r) => r.is_primary === true) ?? rows.slice().sort((x, y) => Number(x.slot) - Number(y.slot))[0];
  const { data: signed } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(String(pick.storage_path), LIMITS.SIGNED_URL_SECONDS);
  return signed?.signedUrl ?? null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail(CODES.BAD_REQUEST, "잘못된 요청이에요.", 405, origin);

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > LIMITS.BODY_MAX_BYTES) return fail(CODES.TOO_LARGE, "요청이 너무 커요.", 413, origin);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail(CODES.UNAUTHORIZED, "로그인이 필요해요.", 401, origin);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) return fail(CODES.ERROR, "서버 저장 설정이 필요해요.", 500, origin);

    const sb: Db = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return fail(CODES.UNAUTHORIZED, "로그인이 필요해요.", 401, origin);
    const admin: Db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userId = user.id;

    if (rateLimited(userId)) return fail(CODES.RATE_LIMITED, "요청이 너무 잦아요. 잠시 뒤 다시 해 주세요.", 429, origin);

    const body = (await req.json().catch(() => null)) as Json | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
    const action = typeof body.action === "string" ? body.action : "";
    if (!ACTIONS.has(action)) return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);

    // ① 문자 인증 결과를 프로필에 맞춘다. Auth 서버가 확인한 값만 믿는다. 이미 verified 면 되돌리지 않는다.
    if (action === "phone_sync") {
      const verified = !!user.phone && !!user.phone_confirmed_at;
      if (verified) {
        const { error } = await admin.from("profiles").update({ verification_status: "verified" }).eq("id", userId);
        if (error) return fail(CODES.ERROR, "인증 결과를 저장하지 못했어요. 잠시 뒤 다시 열어 주세요.", 500, origin);
      }
      logDiag({ action, verified });
      return json({ ok: true, verified }, 200, origin);
    }

    if (action === "my_matches") {
      const [{ data: asA }, { data: asB }] = await Promise.all([
        admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").eq("user_a", userId).in("status", ["approved", "closed"]).limit(LIMITS.MATCHES_MAX),
        admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").eq("user_b", userId).in("status", ["approved", "closed"]).limit(LIMITS.MATCHES_MAX),
      ]);
      const rows = [...(asA ?? []), ...(asB ?? [])] as MatchRow[];
      rows.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
      const blocked = await blockedPairs(admin, [userId]);
      const answers = await answersOf(admin, rows.map((r) => r.id));
      const out = [];
      for (const m of rows) {
        const partnerId = m.user_a === userId ? m.user_b : m.user_a;
        const open = m.status === "approved" && !blocked.has(pairKey(userId, partnerId));
        const got = answers.get(m.id) ?? new Map();
        const mine = got.get(userId) ?? null;
        const theirs = got.get(partnerId) ?? null;
        const revealed = open && !!mine && !!theirs;
        const item: Json = {
          id: m.id, status: open ? "open" : "closed", created_at: m.created_at,
          first_question: open ? m.first_question : null,
          my_answer: open ? mine?.answer ?? null : null,
          partner_answered: open ? !!theirs : false,
          revealed,
        };
        if (revealed) {
          const [{ data: p }, photo, { data: msgs }] = await Promise.all([
            admin.from("profiles").select("nickname, display_name, bio, purpose_label").eq("id", partnerId).maybeSingle(),
            primaryPhotoUrl(admin, partnerId),
            admin.from("doit_match_messages").select("id, sender_id, body, created_at").eq("match_id", m.id).order("created_at", { ascending: false }).limit(LIMITS.MESSAGES_SHOWN),
          ]);
          item.partner = {
            nickname: cleanText(p?.nickname) || cleanText(p?.display_name) || "이름 없음",
            bio: cleanText(p?.bio), purpose: p?.purpose_label ?? null, answer: theirs?.answer ?? "", photo_url: photo,
          };
          item.messages = (msgs ?? []).slice().reverse().map((x) => ({ id: String(x.id), mine: String(x.sender_id) === userId, body: str(x.body), created_at: str(x.created_at) }));
        }
        out.push(item);
      }
      logDiag({ action, matches: out.length });
      return json({ ok: true, matches: out, consented: consentedToConnect(user) }, 200, origin);
    }

    // (c) 내 차례만 센다. 앱 홈 카드용 — 이름·질문·이야기 내용은 내려 주지 않는다.
    if (action === "my_turns") {
      const [{ data: asA }, { data: asB }] = await Promise.all([
        admin.from("doit_matches").select("id, user_a, user_b, status").eq("user_a", userId).eq("status", "approved").limit(LIMITS.MATCHES_MAX),
        admin.from("doit_matches").select("id, user_a, user_b, status").eq("user_b", userId).eq("status", "approved").limit(LIMITS.MATCHES_MAX),
      ]);
      const blocked = await blockedPairs(admin, [userId]);
      const rows = [...(asA ?? []), ...(asB ?? [])].map((m) => ({ id: String(m.id), partnerId: String(m.user_a) === userId ? String(m.user_b) : String(m.user_a) }))
        .filter((m) => !blocked.has(pairKey(userId, m.partnerId)));
      const answers = await answersOf(admin, rows.map((r) => r.id));
      const turns = { answer: 0, reply: 0, opened: 0 };
      const revealedIds: string[] = [];
      for (const m of rows) {
        const got = answers.get(m.id) ?? new Map();
        if (!got.has(userId)) turns.answer++;
        else if (got.has(m.partnerId)) revealedIds.push(m.id);
      }
      if (revealedIds.length) {
        const { data: msgs } = await admin.from("doit_match_messages").select("match_id, sender_id, created_at").in("match_id", revealedIds).order("created_at", { ascending: false }).limit(revealedIds.length * LIMITS.MESSAGES_SHOWN);
        const last = new Map<string, string>();
        for (const r of msgs ?? []) if (!last.has(String(r.match_id))) last.set(String(r.match_id), String(r.sender_id));
        for (const id of revealedIds) {
          const sender = last.get(id);
          if (!sender) turns.opened++;          // 둘 다 답해 서로 열렸고 아직 아무도 말하지 않음
          else if (sender !== userId) turns.reply++; // 마지막 말이 상대 것
        }
      }
      logDiag({ action, open: rows.length, ...turns });
      return json({ ok: true, open: rows.length, turns }, 200, origin);
    }

    if (action === "answer" || action === "message") {
      const matchId = str(body.matchId);
      const text = cleanText(body.text);
      const max = action === "answer" ? LIMITS.ANSWER_MAX : LIMITS.MESSAGE_MAX;
      if (!UUID_RE.test(matchId)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
      if (!text) return fail(CODES.BAD_REQUEST, "한 글자 이상 적어 주세요.", 400, origin);
      if (text.length > max) return fail(CODES.BAD_REQUEST, `${max}자까지 보낼 수 있어요.`, 400, origin);
      const reason = blockedContentReason(text);
      if (reason) { logDiag({ action, blocked: reason }); return fail(CODES.BLOCKED_CONTENT, blockedMessage(reason), 200, origin); }
      const found = await loadMatch(admin, matchId, userId);
      if (!found) return fail(CODES.NOT_FOUND, "이 연결을 찾지 못했어요.", 404, origin);
      const blocked = await blockedPairs(admin, [userId]);
      if (found.match.status !== "approved" || blocked.has(pairKey(userId, found.partnerId))) return fail(CODES.INVALID_STATE, "끝난 연결이에요.", 409, origin);
      if (action === "answer") {
        // (b) 첫 답은 공개의 방아쇠다 — 동의가 없으면 저장하지 않는다(적은 글은 화면에 그대로 남는다).
        if (!consentedToConnect(user)) { logDiag({ action, consent: false }); return fail(CODES.CONSENT_REQUIRED, "첫 답을 보내기 전에 무엇이 상대에게 보이는지 확인해 주세요.", 409, origin); }
        const { error } = await admin.from("doit_match_answers").insert({ match_id: matchId, user_id: userId, answer: text });
        if (error) {
          if ((error as { code?: string }).code === "23505") return fail(CODES.INVALID_STATE, "이미 답을 보냈어요.", 409, origin);
          return fail(CODES.ERROR, "답을 보내지 못했어요. 적은 내용은 그대로 있어요. 다시 눌러 주세요.", 500, origin);
        }
        logDiag({ action });
        return json({ ok: true }, 200, origin);
      }
      const answers = (await answersOf(admin, [matchId])).get(matchId) ?? new Map();
      if (!answers.has(userId) || !answers.has(found.partnerId)) return fail(CODES.INVALID_STATE, "두 사람이 모두 첫 질문에 답한 뒤에 이야기할 수 있어요.", 409, origin);
      const { error } = await admin.from("doit_match_messages").insert({ match_id: matchId, sender_id: userId, body: text });
      if (error) return fail(CODES.ERROR, "보내지 못했어요. 적은 내용은 그대로 있어요. 다시 눌러 주세요.", 500, origin);
      logDiag({ action });
      return json({ ok: true }, 200, origin);
    }

    if (action === "leave") {
      const matchId = str(body.matchId);
      if (!UUID_RE.test(matchId)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
      const found = await loadMatch(admin, matchId, userId);
      if (!found) return fail(CODES.NOT_FOUND, "이 연결을 찾지 못했어요.", 404, origin);
      const block = body.block === true;
      const report = body.report === true;
      if (found.match.status === "approved") {
        const { error } = await admin.from("doit_matches").update({ status: "closed", closed_by: userId, updated_at: new Date().toISOString() }).eq("id", matchId);
        if (error) return fail(CODES.ERROR, "지금은 끝내지 못했어요. 다시 눌러 주세요.", 500, origin);
      }
      if (block) await admin.from("blocks").upsert({ blocker_id: userId, blocked_user_id: found.partnerId, reason: "connection" }, { onConflict: "blocker_id,blocked_user_id", ignoreDuplicates: true });
      if (report) await admin.from("user_reports").insert({ reporter_id: userId, target_user_id: found.partnerId, reason: "connection", detail: null });
      logDiag({ action, block, report });
      return json({ ok: true }, 200, origin);
    }

    // ── 여기부터 관리자 전용 ──
    if (!(await isAdmin(admin, userId))) return fail(CODES.FORBIDDEN, "관리자 권한이 없어요.", 403, origin);

    if (action === "admin_candidates") {
      const members = await loadMembers(admin);
      const eligible = members.filter((m) => m.eligible);
      const blocked = await blockedPairs(admin, eligible.map((m) => m.id));
      const { data: decided } = await admin.from("doit_matches").select("user_a, user_b");
      const done = new Set((decided ?? []).map((r) => pairKey(String(r.user_a), String(r.user_b))));
      const candidates: Json[] = [];
      for (let i = 0; i < eligible.length; i++) {
        for (let j = i + 1; j < eligible.length; j++) {
          const x = eligible[i], y = eligible[j];
          if (!x.purposeId || x.purposeId !== y.purposeId) continue;
          const key = pairKey(x.id, y.id);
          if (blocked.has(key) || done.has(key)) continue;
          const [a, b] = x.id < y.id ? [x, y] : [y, x];
          const common = commonOf(a, b);
          // (a) 겹친 말이 없어도 같은 목적이면 목록 맨 뒤에 남긴다(no_common). 점수 0 이라 겹친 쌍보다 앞에 오지 않는다.
          candidates.push({
            user_a: a.id, user_b: b.id, purpose: a.purposeLabel,
            a: { nickname: a.nickname, confirmed: a.confirmed.length }, b: { nickname: b.nickname, confirmed: b.confirmed.length },
            common_a: common.a, common_b: common.b, score: common.a.length + common.b.length, no_common: common.a.length === 0,
          });
        }
      }
      candidates.sort((p, q) => Number(q.score) - Number(p.score));
      const missing: Record<string, number> = { purpose: 0, phone: 0, answers: 0, photos: 0, intro: 0 };
      for (const m of members) for (const k of m.missing) missing[k] = (missing[k] ?? 0) + 1;
      logDiag({ action, pool: members.length, eligible: eligible.length, candidates: candidates.length, no_common: candidates.filter((c) => c.no_common === true).length });
      return json({ ok: true, pool: members.length, eligible: eligible.length, missing, candidates: candidates.slice(0, LIMITS.CANDIDATES_MAX) }, 200, origin);
    }

    if (action === "admin_matches") {
      const { data: rows } = await admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").order("created_at", { ascending: false }).limit(LIMITS.MATCHES_MAX);
      const list = (rows ?? []) as MatchRow[];
      const ids = [...new Set(list.flatMap((m) => [m.user_a, m.user_b]))];
      const matchIds = list.map((m) => m.id);
      const [{ data: people }, answers, { data: msgs }] = await Promise.all([
        ids.length ? admin.from("profiles").select("id, nickname, display_name").in("id", ids) : Promise.resolve({ data: [] as Json[] }),
        answersOf(admin, matchIds),
        matchIds.length ? admin.from("doit_match_messages").select("match_id").in("match_id", matchIds) : Promise.resolve({ data: [] as Json[] }),
      ]);
      const nameOf = new Map((people ?? []).map((p) => [String(p.id), cleanText(p.nickname) || cleanText(p.display_name) || "이름 없음"]));
      const msgCount = new Map<string, number>();
      for (const r of msgs ?? []) msgCount.set(String(r.match_id), (msgCount.get(String(r.match_id)) ?? 0) + 1);
      return json({
        ok: true,
        matches: list.map((m) => ({
          id: m.id, status: m.status, created_at: m.created_at, first_question: m.first_question, common: m.common ?? [],
          a: nameOf.get(m.user_a) ?? "이름 없음", b: nameOf.get(m.user_b) ?? "이름 없음",
          answered: (answers.get(m.id)?.size ?? 0), messages: msgCount.get(m.id) ?? 0,
        })),
      }, 200, origin);
    }

    if (action === "admin_decide") {
      const x = str(body.userA), y = str(body.userB);
      const decision = str(body.decision);
      if (!UUID_RE.test(x) || !UUID_RE.test(y) || x === y || (decision !== "approve" && decision !== "reject")) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
      const [ua, ub] = pairOf(x, y);
      const { data: existing } = await admin.from("doit_matches").select("id").eq("user_a", ua).eq("user_b", ub).maybeSingle();
      if (existing) return fail(CODES.INVALID_STATE, "이미 결정한 쌍이에요.", 409, origin);
      if (decision === "reject") {
        const { error } = await admin.from("doit_matches").insert({ user_a: ua, user_b: ub, status: "rejected", decided_by: userId });
        if (error) return fail(CODES.ERROR, "저장하지 못했어요.", 500, origin);
        logDiag({ action, decision });
        return json({ ok: true, status: "rejected" }, 200, origin);
      }
      // 승인 순간에 다시 확인한다: 두 사람 모두 자격, 같은 목적, 차단 없음, 겹친 말 있음(없으면 관리자 확인 noCommonOk).
      const members = await loadMembers(admin, [ua, ub]);
      const a = members.find((m) => m.id === ua), b = members.find((m) => m.id === ub);
      if (!a || !b || !a.eligible || !b.eligible) return fail(CODES.NOT_ELIGIBLE, "두 사람 중 연결 자격이 없는 사람이 있어요.", 409, origin);
      if (!a.purposeId || a.purposeId !== b.purposeId) return fail(CODES.NOT_ELIGIBLE, "원하는 만남이 서로 달라요.", 409, origin);
      if ((await blockedPairs(admin, [ua])).has(pairKey(ua, ub))) return fail(CODES.NOT_ELIGIBLE, "둘 중 한 사람이 상대를 차단했어요.", 409, origin);
      const common = commonOf(a, b);
      // (a) 겹친 말 없는 쌍은 관리자가 그 사실을 보고 한 번 더 누른 경우(noCommonOk)만 승인한다.
      if (!common.a.length && body.noCommonOk !== true) return fail(CODES.NOT_ELIGIBLE, "겹친 말이 없는 쌍이에요. 그래도 이으려면 「겹친 말 없이 승인」을 눌러 주세요.", 409, origin);
      const first = await firstQuestionFor(a.purposeLabel, common);
      const { error } = await admin.from("doit_matches").insert({
        user_a: ua, user_b: ub, purpose_id: a.purposeId, common: common.a, first_question: first.question, status: "approved", decided_by: userId,
      });
      if (error) {
        if ((error as { code?: string }).code === "23505") return fail(CODES.INVALID_STATE, "이미 결정한 쌍이에요.", 409, origin);
        return fail(CODES.ERROR, "저장하지 못했어요.", 500, origin);
      }
      logDiag({ action, decision, question: first.source, reason: first.reason ?? null, no_common: common.a.length === 0 });
      return json({ ok: true, status: "approved", first_question: first.question, question_source: first.source }, 200, origin);
    }

    return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);
  } catch {
    return fail(CODES.ERROR, "서버 오류가 발생했어요.", 500, origin);
  }
});
