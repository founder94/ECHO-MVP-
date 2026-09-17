// get-step-question — 단일 파일 배포판 (Supabase 대시보드/CLI 단일 파일 업로드용)
// 원본은 logic.ts / ai.ts / db.ts / index.ts 4개 모듈이며, 이 파일은 그것을 기계적으로 이어 붙인 것이다(로직 동일).
// 단위 테스트(logic_test.ts)는 원본 모듈 기준으로 실행한다. 이 파일을 수정할 때는 원본 모듈을 먼저 고친 뒤 다시 생성한다.
// Supabase Edge Runtime: 내장 Deno.serve + npm: 지정자 (deno.json 불필요)
// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";


// ═══════════════════════════ logic.ts (순수 로직) ═══════════════════════════
// get-step-question 순수 로직 (Deno·브라우저 API 의존 없음 → 단위 테스트 대상)
//
// 원칙
// - LLM은 후보(question·meaning·keys)만 만든다. 최종 선택·상태 전환·차단·완료 판정은 여기서(서버) 한다.
// - 글자 겹침(bigram)은 보조 장치다. 1차 판정은 구조화된 의미 키(keys)의 교집합이다.
// - 하드코딩 질문 없음. 후보가 모두 차단되면 NO_CANDIDATE로 돌려보내고 상태를 보존한다.

const STATUSES = ["step1", "step2", "understanding", "followup", "white_door_ready"] as const;
type Status = (typeof STATUSES)[number];

const CHOICES = ["agree", "alittle", "no", "explain"] as const;
type Choice = (typeof CHOICES)[number];

const LIMITS = {
  MIND_TEXT_MAX: 500,
  ANSWER_MAX: 500,
  QUESTION_MAX: 200,
  UNDERSTANDING_MAX: 400,
  MEANING_MAX: 120,
  KEY_MAX: 24,
  KEYS_MAX: 6,
  CANDIDATES_MAX: 3,
  GENERATION_ATTEMPTS: 3,
  // 2026-09-17 실측(운영 로그): 질문 생성 성공 2.9~3.5초, 2회 전부 차단 시 5.7~6.2초. 3회로 늘린 만큼 전체 상한을 둔다.
  DEADLINE_MS: 11_000,
  REPLY_MAX: 160,
  SUMMARY_MAX: 300,
  MEMORY_MAX: 5,
  MEMORY_TEXT_MAX: 160,
  TOKEN_PATTERN: /^[A-Za-z0-9-]{8,64}$/,
  // 겹침 임계값(보조): 한국어 짧은 문장은 자카드(Jaccard)가 낮게 나오므로 포함률(overlap)을 함께 본다
  REPEAT_SIM: 0.6,
  REPEAT_OVERLAP: 0.7,
  REJECT_SIM: 0.5,
  REJECT_OVERLAP: 0.6,
} as const;

function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

function isChoice(v: unknown): v is Choice {
  return typeof v === "string" && (CHOICES as readonly string[]).includes(v);
}

function isValidToken(v: unknown): v is string {
  return typeof v === "string" && LIMITS.TOKEN_PATTERN.test(v);
}

// ── 상태머신 전이표 ──
// answer: step1 → step2, step2 → understanding, followup → understanding
// choose: understanding → (agree) step3 | (그 외) followup
const ANSWER_TRANSITIONS: Readonly<Record<string, Status>> = {
  step1: "step2",
  step2: "understanding",
  followup: "understanding",
};

function canAnswer(status: string): boolean {
  return status in ANSWER_TRANSITIONS;
}

function nextStatusAfterAnswer(status: string): Status | null {
  return ANSWER_TRANSITIONS[status] ?? null;
}

// messages.step 값: 사용자 답변이 어느 단계의 답인지
const USER_STEP: Readonly<Record<string, number>> = { step1: 1, step2: 2, followup: 4 };
// messages.step 값: AI 메시지 종류
const AI_STEP = { step1: 1, step2: 2, understanding: 3, followup: 4 } as const;
type MessageKind =
  | "step_question"
  | "step_answer"
  | "understanding_summary"
  | "understanding_choice"
  | "followup_question"
  | "followup_answer";
// 화면 표시용 단계 번호
const DISPLAY_STEP: Readonly<Record<Status, number>> = {
  step1: 1,
  step2: 2,
  understanding: 3,
  followup: 3,
  white_door_ready: 3,
};

// 무료 단계 완료 조건(서버가 판정): STEP1·STEP2 사용자 답변 + 이해 내용이 모두 실제 저장되어 있어야 한다.
interface CompletionInput {
  status: string;
  hasStep1Answer: boolean;
  hasStep2Answer: boolean;
  hasUnderstanding: boolean;
}
function canCompleteFreeStage(i: CompletionInput): boolean {
  return i.status === "understanding" && i.hasStep1Answer && i.hasStep2Answer && i.hasUnderstanding;
}

// ── 텍스트 정규화·겹침(보조) ──
function normalizeKey(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function bigrams(s: string): Set<string> {
  const clean = normalizeKey(s);
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function intersectionSize(A: Set<string>, B: Set<string>): number {
  let inter = 0;
  A.forEach((x) => {
    if (B.has(x)) inter++;
  });
  return inter;
}

// 자카드 유사도: 교집합 / 합집합
function bigramSimilarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  const inter = intersectionSize(A, B);
  return inter / (A.size + B.size - inter);
}

// 포함률(overlap coefficient): 교집합 / 작은 쪽 크기 — 한 문장이 다른 문장을 거의 포함하면 높다
function bigramOverlap(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  return intersectionSize(A, B) / Math.min(A.size, B.size);
}

function looksSame(a: string, b: string, sim: number, overlap: number): boolean {
  return bigramSimilarity(a, b) > sim || bigramOverlap(a, b) > overlap;
}

// ── 금지 표현(의료·법률·점술·성격검사식 단정) ──
const FORBIDDEN_TERMS = [
  "진단",
  "치료",
  "처방",
  "증상",
  "우울증",
  "공황",
  "불안장애",
  "사주",
  "타로",
  "운세",
  "궁합",
  "점술",
  "법적",
  "소송",
  "변호사",
  "성격검사",
  "성격 유형",
  "mbti",
] as const;

function containsForbiddenTerm(text: string): string | null {
  const t = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) if (t.includes(term)) return term;
  return null;
}

// ── 2026-09-16 행동 분기(Action Router)·되받아치기 방지 (echo-journey 와 같은 규칙) ──
// 사용자가 ECHO 에게 물은 문장("어떻게 하는 게 좋을까?", "답을 못 해?")은 질문 재료가 아니라 먼저 짧게 답해야 할 말이다.
const USER_QUESTION = /\?\s*$|(?:어떻게|어떡|뭘|무엇을|어느|왜|언제).{0,16}(?:좋을까|할까|하지|해야|일까|되나|될까|돼)|(?:답|대답)(?:을|은)?\s*(?:못|안)\s*(?:해|햐|하)/u;
// "아까 내 질문에는 답하지 않았어" 처럼 앞 물음에 답하지 않았다는 지적도 '답해야 할 말'로 본다.
const UNANSWERED_COMPLAINT = /(?:질문|물어봤|물었)\S{0,10}\s*(?:답|대답)\S{0,4}\s*(?:않|안|못)|(?:답|대답)\S{0,4}\s*(?:않았|않아|않네|않고|안\s*했|못\s*했)/u;
function isUnansweredComplaint(text: string): boolean {
  return UNANSWERED_COMPLAINT.test(text.trim());
}
function isUserQuestion(text: string): boolean {
  const t = text.trim();
  return !!t && (USER_QUESTION.test(t) || UNANSWERED_COMPLAINT.test(t));
}
// 앞 물음에 답하지 않았다는 지적이면 그 앞의 물음을 찾아 답한다.
function pendingUserQuestion(ctx: Context, exclude: string): string {
  const skipped = exclude.trim();
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const message = ctx.messages[i];
    if (message.role !== "user") continue;
    const value = message.content.trim();
    if (!value || value === skipped || isUnansweredComplaint(value)) continue;
    if (isUserQuestion(value)) return value;
  }
  return "";
}
// reply 원문 정리: 공백만 정돈한다. 길이를 잘라서 통과시키지 않는다(잘린 문장 = 실패).
function cleanReply(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// ── 2026-09-17 답변(reply) 품질 판정 (echo-journey 와 같은 규칙) ──
// 고정 회피 문장을 답변 성공으로 처리하지 않는다. 잘려서 끊긴 문장도 통과시키지 않는다.
type ReplyBlockReason = "reply_missing" | "reply_question_mark" | "reply_too_long" | "reply_incomplete" | "reply_evasive" | "reply_irrelevant";
const REPLY_COMPLETE = /(?:[.!…]|요|죠|다|네|까|군|데|어|아|지|음|함|예|오)\s*$/u;
const EVASIVE_REPLY = [/대신\s*정답을?\s*정해/, /^(?:같이|함께)\s*찾아(?:볼게요|봐요)[.!]?$/, /^(?:음|글쎄요?|잘\s*모르겠어요)[.!]?$/] as const;
const RELEVANCE_STOP = /^(?:은|는|이|가|을|를|에|의|도|와|과|로|요|죠|다|네|까|어|해|하|것|수|저|제|내|나)$/;
function sharesContent(reply: string, question: string): boolean {
  const q = normalizeKey(question);
  const r = normalizeKey(reply);
  if (!q || !r) return false;
  for (let i = 0; i < q.length - 1; i++) {
    const pair = q.slice(i, i + 2);
    if (RELEVANCE_STOP.test(pair)) continue;
    if (r.includes(pair)) return true;
  }
  return false;
}
// 질문의 낱말을 그대로 쓰지 않아도, 무엇을 알고 모르는지 밝히는 답은 '응답한 것'으로 본다.
const RESPONSIVE_REPLY = /(?:제가|저는|저도|제)\s*[^.!]{0,20}(?:답|정답|모르|알|말씀|물음|질문)/u;
function replyQualityReason(reply: string, userQuestion: string): ReplyBlockReason | null {
  const text = reply.trim();
  if (!text) return "reply_missing";
  if (text.includes("?")) return "reply_question_mark";
  if (text.length > LIMITS.REPLY_MAX) return "reply_too_long";
  if (!REPLY_COMPLETE.test(text)) return "reply_incomplete";
  if (EVASIVE_REPLY.some((pattern) => pattern.test(text))) return "reply_evasive";
  if (userQuestion.trim() && !sharesContent(text, userQuestion) && !RESPONSIVE_REPLY.test(text)) return "reply_irrelevant";
  return null;
}

// ECHO(제품·AI) 자체에 대한 물음이면 답만 하고 새 질문을 강제로 붙이지 않는다.
const SELF_DIRECTED = [
  /\bai\b|에이아이|인공지능|에코|echo/i,
  UNANSWERED_COMPLAINT,
  /(너|당신|넌|니가|네가)\s*(는|가|도)?\s*(왜|뭐|무슨|어떻게|답|기억|오타|말)/,
  /오타|오류|버그|고장|틀리|잘못\s*(말|답|이해)/,
  /(답|대답)(을|은)?\s*(못|안)\s*(해|햐|하|했)/,
  /기억(해|하니|하나|나니|나|못)/,
] as const;
function isSelfDirectedQuestion(text: string): boolean {
  const value = text.trim();
  return isUserQuestion(value) && SELF_DIRECTED.some((pattern) => pattern.test(value));
}
// 공감 문장이 사용자 말을 그대로 베끼면(되받아치기) 버린다. 짧은 표현 인용은 허용한다.
function isParrot(acknowledgement: string, latestUser: string): boolean {
  const a = normalizeKey(acknowledgement);
  const u = normalizeKey(latestUser);
  if (!a || u.length < 12) return false;
  if (a.includes(u)) return true;
  return bigramOverlap(acknowledgement, latestUser) > 0.8;
}

// ── LLM 응답 스키마 검증 ──
interface Candidate {
  acknowledgement?: string;
  question: string;
  meaning: string;
  keys: string[]; // 정규화된 의미 키
  anchor: string; // 사용자 원문에서 그대로 가져온 표현
  assumptions: string[]; // 새로 가정한 내용. 반드시 빈 배열이어야 통과
  reply?: string; // 사용자가 ECHO 에게 물었을 때만: 1~2문장 답(물음표 없음)
}

type ParseResult = { ok: true; candidates: Candidate[] } | { ok: false; error: "SCHEMA" };

function cleanKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== "string") continue;
    const n = normalizeKey(k).slice(0, LIMITS.KEY_MAX);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= LIMITS.KEYS_MAX) break;
  }
  return out;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const obj = trimmed.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]);
    } catch {
      /* fall through */
    }
  }
  const arr = trimmed.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      return JSON.parse(arr[0]);
    } catch {
      /* fall through */
    }
  }
  return null;
}

// {"candidates":[{question,meaning,keys}]} 또는 [{...}] 만 허용. 그 외는 SCHEMA 오류(원문을 질문으로 쓰지 않음).
function parseCandidates(raw: string): ParseResult {
  const parsed = extractJson(raw);
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { candidates?: unknown }).candidates)
      ? (parsed as { candidates: unknown[] }).candidates
      : null;
  if (!list) return { ok: false, error: "SCHEMA" };

  const candidates: Candidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    // 후보 질문의 끝 장식(이모지·기호)은 서버가 잘라낸다(tidyQuestionText). 글자는 바꾸지 않는다.
    const question = typeof o.question === "string" ? tidyQuestionText(o.question) : "";
    if (!question || question.length > LIMITS.QUESTION_MAX) continue;
    const meaning = typeof o.meaning === "string" ? o.meaning.trim().slice(0, LIMITS.MEANING_MAX) : "";
    const anchor = typeof o.anchor === "string" ? o.anchor.trim().slice(0, LIMITS.MEANING_MAX) : "";
    const assumptions = Array.isArray(o.assumptions)
      ? o.assumptions.filter((value): value is string => typeof value === "string" && !!value.trim()).slice(0, LIMITS.KEYS_MAX)
      : ["schema_missing"];
    candidates.push({ acknowledgement: politeOrSame(typeof o.acknowledgement === "string" ? o.acknowledgement.trim().slice(0, 100) : ""), question: politeOrSame(question), meaning, keys: cleanKeys(o.keys), anchor, assumptions, reply: politeOrSame(typeof o.reply === "string" ? cleanReply(o.reply) : "") });
    if (candidates.length >= LIMITS.CANDIDATES_MAX) break;
  }
  if (!candidates.length) return { ok: false, error: "SCHEMA" };
  return { ok: true, candidates };
}

// 단일 질문(STEP1·STEP2) 응답 검증: 비어 있지 않고 길이 제한·금지어 통과
// ═══════════════ 말투: 해요체 강제 (2026-09-17 실기기 결함 #2) ═══════════════
// 운영에서 STEP 1 질문이 "…궁금해?" 라는 반말로 나갔다. 프롬프트에 존댓말 규칙이 없었고
// 서버에도 검사가 없었다. LLM 은 후보만 만들고 최종 문장은 서버가 정한다는 원칙대로,
// 여기서 (1) 반말인지 판정하고 (2) 뜻을 바꾸지 않는 어미 교체만으로 해요체로 바꾼다.
// 바꿀 수 없는 문장은 고치지 않고 차단한다(억지로 만들지 않는다).

const HANGUL = /[가-힣]/u;
const TRAILING_MARKS = /[\s"'”’」』)\]]*[.?!…]*[\s"'”’」』)\]]*$/u;
// 해요체·합쇼체 종결. 여기에 걸리면 이미 존댓말이다.
const POLITE_TAIL = /(요|죠|쇼|니다|니까)$/u;

// 반말 종결 → 해요체. 긴 어미부터 검사한다(짧은 규칙이 먼저 먹는 것을 막는다).
const POLITE_MAP: ReadonlyArray<readonly [string, string]> = [
  ["는구나", "는군요"],
  ["구나", "군요"],
  ["잖아", "잖아요"],
  ["거야", "거예요"],
  ["이야", "이에요"],
  ["어때", "어때요"],
  ["을래", "을래요"],
  ["ㄹ래", "ㄹ래요"],
  ["는데", "는데요"],
  ["일까", "일까요"],
  ["할까", "할까요"],
  ["았어", "았어요"],
  ["었어", "었어요"],
  ["겠어", "겠어요"],
  ["겠다", "겠어요"],
  ["았다", "았어요"],
  ["었다", "었어요"],
  ["야", "예요"],
  ["까", "까요"],
  ["래", "래요"],
  ["데", "데요"],
  ["니", "나요"],
  ["냐", "나요"],
  ["나", "나요"],
  ["지", "죠"],
  ["줘", "줘요"],
  ["네", "네요"],
  ["대", "대요"],
  ["해", "해요"],
  ["워", "워요"],
  ["봐", "봐요"],
  ["돼", "돼요"],
  ["와", "와요"],
  ["가", "가요"],
  ["어", "어요"],
  ["아", "아요"],
  ["여", "여요"],
];

interface SentencePiece {
  body: string; // 종결 부호를 뗀 본문
  tail: string; // 종결 부호와 따옴표
}

// 문장 부호를 살린 채로 문장 단위로 나눈다.
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buffer = "";
  for (const ch of text) {
    buffer += ch;
    if (ch === "." || ch === "?" || ch === "!" || ch === "…") {
      out.push(buffer);
      buffer = "";
    }
  }
  if (buffer.trim()) out.push(buffer);
  return out.filter((piece) => piece.trim().length > 0);
}

function cutTail(sentence: string): SentencePiece {
  const match = sentence.match(TRAILING_MARKS);
  const tail = match ? match[0] : "";
  return { body: tail ? sentence.slice(0, sentence.length - tail.length) : sentence, tail };
}

// 판정 대상 문장인지: 한글이 있고 너무 짧지 않은 문장만 본다.
function checkable(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length >= 3 && HANGUL.test(trimmed);
}

function isPoliteSentence(sentence: string): boolean {
  const { body } = cutTail(sentence);
  const trimmed = body.trim();
  if (!checkable(trimmed)) return true;
  return POLITE_TAIL.test(trimmed);
}

/** 화면에 나갈 문장에 반말이 섞여 있는가. 한 문장이라도 반말이면 true. */
function hasBanmal(text: string): boolean {
  return splitSentences(text).some((sentence) => !isPoliteSentence(sentence));
}

function politeBody(body: string): string | null {
  const trimmed = body.replace(/\s+$/u, "");
  if (!checkable(trimmed)) return trimmed;
  if (POLITE_TAIL.test(trimmed)) return trimmed;
  for (const [from, to] of POLITE_MAP) {
    if (trimmed.endsWith(from)) return `${trimmed.slice(0, trimmed.length - from.length)}${to}`;
  }
  return null;
}

/**
 * 뜻을 바꾸지 않고 종결 어미만 해요체로 바꾼다.
 * 규칙에 없는 끝맺음은 억지로 고치지 않고 null 을 돌려준다(그 후보는 차단된다).
 */
function toPoliteKorean(text: string): string | null {
  const source = text.trim();
  if (!source) return source;
  const pieces = splitSentences(source);
  let changed = false;
  const rebuilt: string[] = [];
  for (const piece of pieces) {
    const leading = piece.match(/^\s*/u)?.[0] ?? "";
    const { body, tail } = cutTail(piece.slice(leading.length));
    const fixed = politeBody(body);
    if (fixed === null) return null;
    if (fixed !== body.replace(/\s+$/u, "")) changed = true;
    rebuilt.push(`${leading}${fixed}${tail}`);
  }
  const result = rebuilt.join("");
  return changed ? result : source;
}


/** 고칠 수 있으면 해요체로 바꾸고, 규칙에 없는 끝맺음이면 원문을 그대로 둔다(뒤의 검사가 차단한다). */
function politeOrSame(text: string): string {
  if (!text) return text;
  return toPoliteKorean(text) ?? text;
}

type SingleResult = { ok: true; text: string } | { ok: false; error: "EMPTY" | "TOO_LONG" | "FORBIDDEN" | "NOT_QUESTION" | "MULTIPLE_QUESTIONS" | "NOT_GROUNDED" | "BANMAL" };
function hasUnsupportedPremise(question: string, evidence: string): boolean {
  if (/미래.{0,30}(기억에\s*남|기억나)|(?:앞으로|훗날|몇\s*년\s*뒤).{0,30}(기억에\s*남|기억나)/.test(question)) return true;
  const q = normalizeKey(question);
  const e = normalizeKey(evidence);
  const groups = [
    { candidate: ["피하고", "회피", "참고있는", "억누르고"], evidence: ["피하", "회피", "참", "억누르"] },
    { candidate: ["부정적인사람", "나쁜사람", "해로운사람"], evidence: ["부정적인사람", "나쁜사람", "해로운사람"] },
    { candidate: ["관계에서", "그사람", "상대방"], evidence: ["관계", "사람", "상대", "친구", "가족", "동료", "연인"] },
    { candidate: ["상처", "트라우마"], evidence: ["상처", "트라우마"] },
  ];
  return groups.some((group) => group.candidate.some((word) => q.includes(word)) && !group.evidence.some((word) => e.includes(word)));
}
// 2026-09-16 운영 로그 근거: [gsq] validate_fail reason=NOT_QUESTION·MULTIPLE_QUESTIONS 가 2회 연속(attempt=1,2) → NO_CANDIDATE 로
// 사용자가 같은 화면에서 6회 연속 막힘(2026-09-16 08:09~08:10 UTC). 모델 출력의 끝 장식(이모지·기호·닫는 따옴표·마침표)과
// 짧은 공감 되묻기("힘들었죠? …?")는 프롬프트가 아니라 서버 규칙으로 정리한다. 글자를 새로 만들지 않는다: 잘라내거나 물음표 하나를 마침표로 바꿀 뿐이다.
const LEAD_ACK_MAX = 30;
function tidyQuestionText(raw: string): string {
  const text = raw.trim().replace(/^["'「『]+|["'」』]+$/g, "").trim();
  if (text.endsWith("?")) return text;
  const last = text.lastIndexOf("?");
  if (last < 0) return text;
  // 마지막 물음표 뒤에 글자·숫자가 없으면(이모지·기호·공백·닫는 따옴표만) 장식으로 보고 잘라낸다. 글자가 있으면 손대지 않는다.
  if (/[\p{L}\p{N}]/u.test(text.slice(last + 1))) return text;
  return text.slice(0, last + 1).trim();
}
function softenLeadingQuestion(text: string): string {
  const marks = text.match(/\?/g)?.length ?? 0;
  if (marks !== 2 || !text.endsWith("?")) return text;
  const first = text.indexOf("?");
  const head = text.slice(0, first);
  // 앞의 짧은 공감 되묻기만 마침표로 바꾼다. 길면 진짜 두 질문일 수 있으므로 그대로 두어 MULTIPLE_QUESTIONS 로 거른다.
  if (!head.trim() || head.length > LEAD_ACK_MAX || !/\p{L}/u.test(head)) return text;
  return `${head.trimEnd()}.${text.slice(first + 1)}`;
}
// 진단용 형태 정보(원문 없음): 물음표 개수와 끝 모양만.
function questionShape(raw: string): string {
  const text = raw.trim();
  const qmarks = text.match(/\?/g)?.length ?? 0;
  const last = text.lastIndexOf("?");
  const tail = last < 0 ? "none" : last === text.length - 1 ? "q" : /[\p{L}\p{N}]/u.test(text.slice(last + 1)) ? "text" : "deco";
  return `qmarks=${qmarks} tail=${tail}`;
}
function validateSingleQuestion(raw: string, maxLength: number = LIMITS.QUESTION_MAX, mustBeQuestion = true, evidence = ""): SingleResult {
  let text = mustBeQuestion ? softenLeadingQuestion(tidyQuestionText(raw)) : raw.trim().replace(/^["'「]+|["'」]+$/g, "").trim();
  if (!text) return { ok: false, error: "EMPTY" };
  if (text.length > maxLength) return { ok: false, error: "TOO_LONG" };
  // 2026-09-17 실기기 결함: STEP 1 질문이 "…궁금해?" 라는 반말로 나갔다.
  // 뜻을 바꾸지 않는 어미 교체로 해요체를 만들고, 바꿀 수 없으면 차단한다.
  const polite = toPoliteKorean(text);
  if (polite === null) return { ok: false, error: "BANMAL" };
  text = polite;
  if (containsForbiddenTerm(text)) return { ok: false, error: "FORBIDDEN" };
  if (mustBeQuestion) {
    const marks = text.match(/\?/g)?.length ?? 0;
    if (!text.endsWith("?") || marks === 0) return { ok: false, error: "NOT_QUESTION" };
    if (marks !== 1) return { ok: false, error: "MULTIPLE_QUESTIONS" };
    if (evidence) {
      const q = bigrams(text);
      const e = bigrams(evidence);
      if (intersectionSize(q, e) === 0) return { ok: false, error: "NOT_GROUNDED" };
      if (hasUnsupportedPremise(text, evidence)) return { ok: false, error: "NOT_GROUNDED" };
      const qn = normalizeKey(text);
      const en = normalizeKey(evidence);
      const shorter = Math.min(qn.length, en.length);
      const longer = Math.max(qn.length, en.length);
      if (shorter >= 5 && shorter / longer >= 0.72 && (qn.includes(en) || en.includes(qn))) return { ok: false, error: "NOT_GROUNDED" };
      if (!/(어떤|어떻게|무엇|뭐가|언제|어디|누구|왜|얼마나|어느|들려줄|말해줄|알려줄)/.test(text)) return { ok: false, error: "NOT_GROUNDED" };
    }
  }
  return { ok: true, text };
}

// ── 후보 차단(서버 상태머신) ──
interface BlockContext {
  askedTexts: string[]; // 이미 나온 AI 질문
  rejectedKeys: string[]; // 구조화된 거절 의미 키(정규화)
  rejectedTexts: string[]; // 거절한 해석 원문(보조 겹침 검사용)
  evidenceTexts: string[]; // 사용자가 직접 쓴 말만
}

const QUESTION_INTENTS = [
  { tag: "problem", pattern: /(고민|문제|걱정|마음에\s*걸리|해결|막막|힘든|어려운\s*(?:점|부분|것)|부담)/ },
  { tag: "priority", pattern: /(먼저|우선|가장|하나만|급한)/ },
  { tag: "emotion", pattern: /(감정|기분|느낌|마음은\s*어땠|몸에서\s*느껴)/ },
  { tag: "reason", pattern: /(왜|이유|때문|계기)/ },
  { tag: "context", pattern: /(언제|어느\s*때|상황|장면|어디|무슨\s*일|어떤\s*때)/ },
  { tag: "meaning", pattern: /(의미|뜻|한마디|다른\s*말|표현)/ },
  { tag: "preference", pattern: /(원하|바라|좋겠|편하|마음이\s*가|선호)/ },
  { tag: "action", pattern: /(해\s*볼|선택|바꾸|시작|실천)/ },
  { tag: "detail", pattern: /(더\s*(?:이야기|말|들려|설명)|구체|어떤\s*부분|무엇인지|조금만\s*말)/ },
] as const;

function questionIntent(question: string): string {
  return QUESTION_INTENTS.find(({ pattern }) => pattern.test(question))?.tag ?? "";
}

function repeatsQuestionIntent(question: string, asked: string[]): boolean {
  const intent = questionIntent(question);
  return !!intent && asked.some((previous) => questionIntent(previous) === intent);
}

type BlockReason = "forbidden" | "banmal" | "repeat" | "rejected_meaning" | "rejected_text" | "not_question" | "not_grounded" | "assumption" | "reply_quality";

interface FilterResult {
  survivors: Candidate[];
  blocked: { candidate: Candidate; reason: BlockReason }[];
}

// relaxed(마지막 시도): 의도 반복 같은 '다양성' 규칙만 풀고, 안전·근거·거절·글자 반복 규칙은 유지한다.
// 의도 반복은 최근 질문 2개와만 비교한다(전체와 비교하면 의도 12종이 금방 소진되어 NO_CANDIDATE — 2026-09-16 운영 로그).
const INTENT_HISTORY = 2;
interface BlockOptions {
  relaxed?: boolean;
  userQuestion?: string;
  requireQuestion?: boolean;
}
// ④ 거절한 해석이 답변·요약으로 되살아나는지: 문장 유사도로 본다.
// 낱말 포함(예: '중요하게')만으로 막으면 정상 문장까지 죽는다 — 의미 키 대조는 질문 후보에만 쓴다.
function replyRevivesRejected(reply: string, ctx: BlockContext): boolean {
  const text = reply.trim();
  if (!text) return false;
  return ctx.rejectedTexts.some((rejected) => looksSame(text, rejected, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP));
}
function blockReasonFor(c: Candidate, ctx: BlockContext, options: BlockOptions = {}): BlockReason | null {
  const { relaxed = false, userQuestion = "", requireQuestion = true } = options;
  if (containsForbiddenTerm(`${c.acknowledgement ?? ""}\n${c.question}\n${c.reply ?? ""}`)) return "forbidden";
  // 말투: 해요체로 바꿀 수 없는 후보는 화면에 내지 않는다(2026-09-17 반말 결함).
  if (hasBanmal(`${c.acknowledgement ?? ""} ${c.question} ${c.reply ?? ""}`.trim())) return "banmal";
  // ③④ 사용자가 물었으면 '답'이 실제 답이어야 하고, 거절한 뜻을 되살려서도 안 된다.
  if (userQuestion) {
    if (replyQualityReason(c.reply ?? "", userQuestion)) return "reply_quality";
    if (replyRevivesRejected(c.reply ?? "", ctx)) return "rejected_text";
  }
  if (!requireQuestion) return null;
  if (c.acknowledgement && !normalizeKey(c.acknowledgement).includes(normalizeKey(c.anchor))) return "not_grounded";
  const marks = c.question.match(/\?/g)?.length ?? 0;
  if (!c.question.endsWith("?") || marks !== 1) return "not_question";
  if (c.assumptions.length) return "assumption";
  const anchor = normalizeKey(c.anchor);
  if (anchor.length < 2) return "not_grounded";
  if (!ctx.evidenceTexts.some((text) => normalizeKey(text).includes(anchor))) return "not_grounded";
  const qn = normalizeKey(c.question);
  if (ctx.evidenceTexts.some((text) => {
    const en = normalizeKey(text);
    const shorter = Math.min(qn.length, en.length);
    const longer = Math.max(qn.length, en.length);
    return shorter >= 5 && shorter / longer >= 0.72 && (qn.includes(en) || en.includes(qn));
  })) return "repeat";
  if (!/(어떤|어떻게|무엇|뭐가|언제|어디|누구|왜|얼마나|어느|들려줄|말해줄|알려줄)/.test(c.question)) return "not_question";
  if (hasUnsupportedPremise(c.question, ctx.evidenceTexts.join("\n"))) return "assumption";

  for (const a of ctx.askedTexts) {
    if (looksSame(c.question, a, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP)) return "repeat";
  }
  if (!relaxed && repeatsQuestionIntent(c.question, ctx.askedTexts.slice(-INTENT_HISTORY))) return "repeat";
  if (replyRevivesRejected(c.reply ?? "", ctx)) return "rejected_text";

  // 1차: 의미 키 교집합 (표현이 달라도 같은 뜻이면 차단)
  if (c.keys.length && ctx.rejectedKeys.length) {
    const rejected = new Set(ctx.rejectedKeys);
    for (const k of c.keys) if (rejected.has(k)) return "rejected_meaning";
    // 부분 포함(예: "인정" ⊂ "인정받지못함")도 같은 뜻으로 본다
    for (const k of c.keys) {
      for (const r of rejected) {
        if (k.length >= 2 && r.length >= 2 && (k.includes(r) || r.includes(k))) return "rejected_meaning";
      }
    }
  }

  // 2차(보조): 글자 겹침
  for (const r of ctx.rejectedTexts) {
    if (looksSame(c.question, r, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP)) return "rejected_text";
    if (c.meaning && looksSame(c.meaning, r, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP)) return "rejected_text";
  }
  return null;
}

function filterCandidates(cands: Candidate[], ctx: BlockContext, options: BlockOptions = {}): FilterResult {
  const survivors: Candidate[] = [];
  const blocked: FilterResult["blocked"] = [];
  for (const c of cands) {
    const reason = blockReasonFor(c, ctx, options);
    if (reason) blocked.push({ candidate: c, reason });
    else survivors.push(c);
  }
  return { survivors, blocked };
}

// 서버 최종 선택: 생존 후보 중 첫 번째(LLM 순서는 참고일 뿐, 선택 권한은 서버)
function pickCandidate(r: FilterResult): Candidate | null {
  return r.survivors[0] ?? null;
}

// ═══════════════════════════ ai.ts (OpenAI 호출·후보 생성) ═══════════════════════════
// get-step-question — OpenAI 호출·프롬프트·후보 생성 (index.ts 에서 사용)
// LLM은 후보(질문·의미)만 만든다. 차단·선택·상태 전환은 logic.ts(순수 규칙) + index.ts(상태머신)가 한다.
// 원문(마음 기록·답변·정정)은 로그에 남기지 않는다.


const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 6_000;
const CONVERSATION_MAX_TOKENS = 500;
// 후보 3개에 reply 까지 담으면 500토큰에서 잘린다. 답변이 필요한 모드만 예산을 늘린다.
const ASKED_MAX_TOKENS = 900;
const TEMPERATURE = 0.2;
const TOP_P = 0.9;

// 모델 이름 해석: 대표가 지정한 OPENAI_MODEL 시크릿을 우선 쓰되, 값이 비어 있거나
// 2026-09-14 운영 장애로 확인된 오타("gpt-40-mini" — 숫자 40, OpenAI 404 model_not_found)이면
// 올바른 기본 모델로 보정한다. 서버에서 Edge 시크릿 값을 직접 편집할 수단이 없어 코드에서 방어한다.
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
function resolveModel(raw: string | undefined): string {
  const m = (raw ?? "").trim();
  if (!m || m === "gpt-40-mini") return DEFAULT_OPENAI_MODEL;
  return m;
}

type ChatMsg = { role: "system" | "user"; content: string };

interface MessageRow {
  role: string;
  step: number | null;
  content: string;
  message_kind: string | null;
}
interface UnderstandingRow {
  choice: string;
  rejected_interpretation: string | null;
  correction_text: string | null;
  self_explanation: string | null;
}
// ⑤ 기억: '지난 리포트 요약(참고)'과 '사용자가 확인한 기억(확정)'을 구분한다. 조회 실패는 숨기지 않는다.
interface Memory { summary: string; confirmed: string[]; lookupFailed: boolean }
interface Context {
  mindText: string;
  messages: MessageRow[];
  understandings: UnderstandingRow[];
  memory?: Memory;
}
interface Ai {
  apiKey: string;
  model: string;
}

// ── OpenAI ──
async function callOpenAI(ai: Ai, messages: ChatMsg[], jsonMode: boolean, maxTokens = CONVERSATION_MAX_TOKENS): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model: ai.model,
          temperature: TEMPERATURE,
          top_p: TOP_P,
          max_tokens: maxTokens,
          messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      // 진단 로그(운영 원인 추적용): 오류 종류만. 키·원문 없음.
      console.error(`[gsq] openai_fetch_error name=${(err as Error)?.name ?? "?"} model=${ai.model}`);
      throw err;
    }
    if (!res.ok) {
      let code = "";
      try {
        const j = await res.json();
        code = String(j?.error?.code ?? j?.error?.type ?? "");
      } catch {
        /* 본문 없음 */
      }
      // 진단 로그: HTTP 상태·오류 코드·모델명만. 키·원문 없음.
      console.error(`[gsq] openai_http status=${res.status} code=${code} model=${ai.model}`);
      throw new Error("OPENAI_HTTP");
    }
    const data = await res.json();
    const finish = String(data?.choices?.[0]?.finish_reason ?? "");
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      console.error(`[gsq] openai_empty finish=${finish} model=${ai.model}`);
      throw new Error("OPENAI_EMPTY");
    }
    if (finish === "length") console.error(`[gsq] openai_truncated max_tokens=${maxTokens} len=${text.length} model=${ai.model}`);
    // 실제 비용 측정용(원문 없음): 요청·응답 토큰 수만 남긴다.
    console.error(`[gsq] openai_usage prompt=${Number(data?.usage?.prompt_tokens ?? 0)} completion=${Number(data?.usage?.completion_tokens ?? 0)} max_tokens=${maxTokens} model=${ai.model}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const PERSONA =
  "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'다. 사용자가 실제로 말한 내용만 근거로 하고 추측·판단·진단·평가를 하지 않는다. 의료·법률·점술·성격검사식 단정을 하지 않는다. 데이팅·궁합 같은 표현을 쓰지 않는다. 화면에 나가는 모든 문장은 한국어 해요체 존댓말로 쓴다. 반말(해·했어·야·니·구나·줘·어때·궁금해)로 끝내지 마라.";

const CONTROL_REPLIES = new Set(["맞아요", "조금 달라요", "그게 아니에요", "직접 설명할게요"]);
const LOW_INFORMATION_REPLIES = /^(응|어|네|예|그래|맞아|맞아요|그렇지|그렇죠|글쎄|음|모르겠어|모르겠어요|잘 모르겠어요)[.!?\s]*$/;
const META_FEEDBACK = [
  /질문.{0,18}(없|이상|어렵|안\s*맞|뜬금|똑같|같|반복|또)/,
  /(같|똑같)은?\s*질문|질문을?\s*(또|반복)/,
  /(어떻게|뭘|무엇을)\s*(말|이야기|대답|답)하/,
  /이게\s*(질문|무슨|뭔)/,
  /맥락.{0,8}(안\s*맞|이상|없)/,
  /내가.{0,8}어떻게\s*알/,
  /무슨\s*말|뭔\s*말|말이\s*안\s*되/,
  /(이해|납득).{0,8}(안|못)/,
  /왜.{0,8}(묻|물어|질문|되묻)/,
  /(?:이야기|말)(?:했|해\s*줬|했었).{0,8}잖/,
  /(?:이미|아까|방금).{0,12}(?:이야기|말)(?:했|해\s*줬|했었)/,
] as const;
function isMetaFeedback(text: string): boolean {
  const value = text.trim();
  return (value !== "맞아요" && CONTROL_REPLIES.has(value)) || META_FEEDBACK.some((pattern) => pattern.test(value));
}
function isLowInformationReply(text: string): boolean {
  return LOW_INFORMATION_REPLIES.test(text.trim());
}
function userEvidenceParts(ctx: Context): string[] {
  const parts: string[] = [];
  if (ctx.mindText.trim()) parts.push(ctx.mindText.trim());
  for (const message of ctx.messages) {
    if (message.role !== "user" || isMetaFeedback(message.content) || isLowInformationReply(message.content)) continue;
    parts.push(message.content.trim());
  }
  for (const understanding of ctx.understandings) {
    if (understanding.correction_text?.trim()) parts.push(understanding.correction_text.trim());
    if (understanding.self_explanation?.trim()) parts.push(understanding.self_explanation.trim());
  }
  return [...new Set(parts.filter(Boolean))];
}
function historyText(ctx: Context): string {
  return userEvidenceParts(ctx).map((part, index) => `${index + 1}. ${part}`).join("\n");
}
function feedbackText(ctx: Context): string {
  return ctx.messages.filter((message) => message.role === "user" && isMetaFeedback(message.content)).map((message, index) => `${index + 1}. ${message.content}`).join("\n");
}

// 사용자가 정정·직접 설명한 내용(최우선 반영)과 거절한 해석(재사용 금지)을 분리한다
function correctionBlock(ctx: Context): { affirmed: string[]; rejected: string[] } {
  const affirmed: string[] = [];
  const rejected: string[] = [];
  for (const u of ctx.understandings) {
    if (u.choice === "agree") continue;
    if (u.self_explanation) affirmed.push(u.self_explanation);
    if (u.correction_text) affirmed.push(u.correction_text);
    if (u.rejected_interpretation) rejected.push(u.rejected_interpretation);
  }
  return { affirmed, rejected };
}

function priorityNote(ctx: Context): string {
  const { affirmed, rejected } = correctionBlock(ctx);
  const a = affirmed.length ? `\n[사용자가 직접 설명·정정한 내용 — 가장 먼저, 가장 우선으로 반영]\n${affirmed.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "";
  const r = rejected.length ? `\n[사용자가 거절한 해석 — 같은 뜻을 표현만 바꿔서도 다시 쓰지 말 것]\n${rejected.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "";
  return a + r;
}

// 확인된 기억과 참고용 리포트 요약을 분리해 넣는다. 둘 다 없으면 아무 말도 만들지 않는다(가짜 기억 금지).
function priorNote(ctx?: Context): string {
  const memory = ctx?.memory;
  if (!memory) return "";
  const blocks: string[] = [];
  if (memory.confirmed.length) {
    blocks.push(`[내가 확인한 기억 — 사용자가 직접 확인하거나 바로잡은 내용이다. 새 사실을 만들지 말고, 같은 주제가 나오면 이어서 반영]\n${memory.confirmed.map((item, index) => `${index + 1}. ${item}`).join("\n")}`);
  }
  if (memory.summary) {
    blocks.push(`[지난 여정 리포트 요약 — 참고용이며 확인된 사실이 아니다. 단정하지 말 것]\n${memory.summary}`);
  }
  return blocks.length ? `\n\n${blocks.join("\n\n")}` : "";
}
// 바로 앞의 사용자가 직접 쓴 말(버튼 문구 "맞아요" 등은 제외). 정정·직접 설명(understanding_choice 의 본문)도 포함한다.
// 사용자가 ECHO 에게 물었는지(asked) 판정할 때 쓴다.
function latestUserFreeText(ctx: Context): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const message = ctx.messages[i];
    if (message.role !== "user" || CONTROL_REPLIES.has(message.content.trim())) continue;
    return message.content.trim();
  }
  return "";
}

// 2026-09-17 실기기 결함 #3: STEP 1 답변이 짧을 때("돈때문에") STEP 2 질문이 3회 모두 막혀
// "질문을 만들지 못했어요" 로 끝났다. 원인은 (a) 의도 반복 검사를 이전 질문 '전체'와 하고
// (b) 후속 질문 경로와 달리 마지막 시도 완화도, 구제도 없었던 것이다.
// 이제: 의도 비교는 최근 INTENT_HISTORY 개까지만, 마지막 시도는 완화, 그래도 없으면
// '안전·근거 검사는 모두 통과했고 의도만 겹친' 질문을 구제한다. 하드코딩 질문은 쓰지 않는다.
async function genSingleQuestion(ai: Ai, instruction: string, userContent: string, ctx?: Context): Promise<string> {
  const feedback = ctx ? feedbackText(ctx) : "";
  const asked = ctx ? ctx.messages.filter((message) => message.role === "ai" && /\?\s*$/.test(message.content)).map((message) => message.content) : [];
  const startedAt = Date.now();
  let salvage = "";
  let rejected: string[] = [];
  let attempts = 0;
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - startedAt;
    if (attempt > 0 && elapsed + OPENAI_TIMEOUT_MS > LIMITS.DEADLINE_MS) {
      console.error(`[gsq] single_deadline elapsed_ms=${elapsed} attempts=${attempts}`);
      break;
    }
    attempts = attempt + 1;
    const relaxed = attempt === LIMITS.GENERATION_ATTEMPTS - 1;
    const prompt = `[사용자 근거]\n${userContent}${feedback ? `\n\n[질문 피드백 — 사실 근거로 사용하지 말 것]\n${feedback}` : ""}${asked.length ? `\n\n[이미 물은 질문 — 같은 뜻 반복 금지]\n${asked.join("\n")}` : ""}${rejected.length ? `\n\n[방금 서버에서 막힌 질문 — 다른 뜻으로 다시 써라]\n${rejected.join("\n")}` : ""}`;
    const raw = await callOpenAI(ai, [{ role: "system", content: `${PERSONA} ${instruction}${priorNote(ctx)} 친구처럼 편안하되 반드시 해요체 존댓말로, 바로 앞 말을 짧게 받아준 뒤, 아직 답하지 않은 새로운 정보를 부탁하는 열린 질문 하나를 써라. 사용자의 말을 거의 그대로 옮기고 물음표만 붙이는 되묻기와 예/아니오 확인 질문은 금지한다. 질문 피드백이 있으면 잘못을 짧게 인정하고 더 쉽고 다른 방향으로 묻되 그 피드백을 사용자 마음의 근거로 해석하지 마라. 사용자가 말하지 않은 사람·관계·미래 장면·감정·원인·회피·상처를 만들지 마라. 전체 문장에는 물음표가 하나만 있어야 한다.` }, { role: "user", content: prompt }], false);
    const v = validateSingleQuestion(raw, LIMITS.QUESTION_MAX, true, userContent);
    if (v.ok) {
      const repeatsText = asked.some((question) => looksSame(v.text, question, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP));
      if (!repeatsText) {
        // 의도 반복은 '다양성' 규칙이다. 최근 질문과만 비교하고, 마지막 시도에서는 풀어준다.
        if (relaxed || !repeatsQuestionIntent(v.text, asked.slice(-INTENT_HISTORY))) return v.text;
        // 안전·근거 검사는 모두 통과했다. 다른 후보가 없으면 이 질문을 쓴다.
        if (!salvage) salvage = v.text;
      }
      rejected = rejected.concat(v.text).slice(-3);
    }
    // 진단 로그: 검증 실패 사유·길이·물음표 개수·끝 모양만. 원문 없음.
    const reason = v.ok ? "REPEAT_OR_SAME_INTENT" : v.error;
    console.error(`[gsq] validate_fail reason=${reason} len=${raw.length} ${questionShape(raw)} attempt=${attempts} relaxed=${relaxed}`);
  }
  if (salvage) {
    console.error(`[gsq] single_salvage attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
    return salvage;
  }
  console.error(`[gsq] no_candidate mode=single attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
  throw new Error("NO_CANDIDATE");
}

const genStep1Question = (ai: Ai, mindText: string, ctx?: Context) =>
  genSingleQuestion(ai, "사용자가 쓴 마음의 기록을 읽고, 그 마음을 공감하며 짚어주는 짧은 한국어 질문을 하나만 만들어라. 질문은 그 마음을 더 알아가기 위한 것이어야 한다.", mindText, ctx);

const genStep2Question = (ai: Ai, ctx: Context) =>
  genSingleQuestion(ai, "[사용자 근거]만 읽고, 방금 사용자가 직접 쓴 표현 하나의 뜻이나 맥락을 더 알아가는 짧은 한국어 질문을 하나만 만들어라. 이전 ECHO 문장은 사실 근거가 아니다.", historyText(ctx), ctx);

async function genUnderstanding(ai: Ai, ctx: Context): Promise<string> {
  const latest = latestUserFreeText(ctx);
  const askedNote = isUserQuestion(latest) && !isLowInformationReply(latest)
    ? ` 사용자가 방금 ECHO에게 물었다("${latest}"). 그 물음을 사용자 마음의 사실로 요약하지 말고, 먼저 친구처럼 편안한 해요체로 1문장 솔직하게 답한 뒤(정답을 대신 정하지 않고, 의료·법률·재무 조언 없이, 물음표 없이) 요약을 이어라.`
    : "";
  const system =
    `${PERSONA} 사용자의 마음 기록과 대화를 바탕으로, 사용자가 지금 어떤 마음인지 한두 문장으로 공감하며 요약해라. 확실하지 않은 부분은 '~인 것 같아요'처럼 후보로만 말한다.${askedNote}${priorNote(ctx)}${priorityNote(ctx)}\n요약 텍스트만 출력해라.`;
  const block = buildBlockContext(ctx);
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: historyText(ctx) }], false);
    const v = validateSingleQuestion(raw, LIMITS.UNDERSTANDING_MAX, false);
    // ④ 거절한 해석은 요약에서도 같은 뜻으로 되살아나면 안 된다.
    if (v.ok && !replyRevivesRejected(v.text, block)) return v.text;
    console.error(`[gsq] understanding_reject reason=${v.ok ? "rejected_meaning" : v.error} attempt=${attempt + 1}`);
  }
  throw new Error("NO_CANDIDATE");
}

// 거절한 해석의 "핵심 의미"를 구조화(키 목록)한다. 저장 열이 아직 없으므로 요청 시 계산한다.
// (PENDING SQL의 understanding_results.rejected_meaning 적용 후 저장으로 전환)
function extractRejectedKeys(rejectedInterpretation: string): string[] {
  return [...new Set(rejectedInterpretation.split(/[\s,./!?"'“”‘’()[\]{}]+/).map(normalizeKey).filter((part) => part.length >= 2))].slice(0, LIMITS.KEYS_MAX);
}

function buildBlockContext(ctx: Context): BlockContext {
  const askedTexts = ctx.messages.filter((m) => m.role === "ai" && /\?\s*$/.test(m.content)).map((m) => m.content);
  const rejectedTexts: string[] = [];
  const rejectedKeys: string[] = [];
  for (const u of ctx.understandings) {
    if (u.choice !== "no" || !u.rejected_interpretation) continue;
    rejectedTexts.push(u.rejected_interpretation);
    const keys = extractRejectedKeys(u.rejected_interpretation);
    for (const k of keys) if (!rejectedKeys.includes(k)) rejectedKeys.push(k);
  }
  return { askedTexts, rejectedKeys, rejectedTexts, evidenceTexts: userEvidenceParts(ctx) };
}

// 후속 질문: LLM은 후보만, 차단·선택은 서버. 모두 차단되면 재요청, 한도 초과 시 NO_CANDIDATE.
type FollowupMode = "normal" | "asked" | "feedback";
// 우선순위: 사용자가 방금 물었으면 asked(먼저 답한다) → 질문 피드백이 있으면 feedback → normal
function followupMode(ctx: Context): FollowupMode {
  const latest = latestUserFreeText(ctx);
  if (isUserQuestion(latest) && !isLowInformationReply(latest)) return "asked";
  return feedbackText(ctx) ? "feedback" : "normal";
}
// 서버가 최종 문장을 조립한다: asked → 검증된 답(+필요할 때만 질문) / feedback → 고정 인정 문장 + 질문 / normal → 공감(되받아치기면 제거) + 질문
// 2026-09-17: 고정 회피 문장을 답변으로 쓰지 않는다. asked 모드는 검증을 통과한 reply 가 있을 때만 만들어진다.
function renderFollowup(candidate: Candidate, mode: FollowupMode, latestUser: string, withQuestion = true): string {
  return politeOrSame(renderFollowupRaw(candidate, mode, latestUser, withQuestion));
}
function renderFollowupRaw(candidate: Candidate, mode: FollowupMode, latestUser: string, withQuestion = true): string {
  if (mode === "asked") {
    const reply = (candidate.reply ?? "").trim();
    return withQuestion && candidate.question ? `${reply}\n\n${candidate.question}` : reply;
  }
  if (mode === "feedback") return `맞아요. 같은 내용을 되묻지 않고 질문을 바꿔볼게요.\n\n${candidate.question}`;
  const acknowledgement = (candidate.acknowledgement ?? "").replace(/\?+/g, "").trim();
  if (!acknowledgement || isParrot(acknowledgement, latestUser)) return candidate.question;
  return `${acknowledgement}\n\n${candidate.question}`;
}

async function genFollowupQuestion(ai: Ai, ctx: Context): Promise<Candidate> {
  const block = buildBlockContext(ctx);
  const mode = followupMode(ctx);
  const latest = latestUserFreeText(ctx);
  const pending = isUnansweredComplaint(latest) ? pendingUserQuestion(ctx, latest) : "";
  const questionToAnswer = pending || latest;
  const withQuestion = !(mode === "asked" && isSelfDirectedQuestion(latest) && !pending);
  const userQuestionNote = mode === "asked"
    ? `\n\n[사용자가 ECHO에게 물었다 — 먼저 답할 것]\n"${questionToAnswer}"${pending ? `\n(사용자가 "${latest}" 라고 지적했다. 앞의 물음에 답하지 못한 것을 먼저 인정하고 그 물음에 답한다.)` : ""}\n각 후보에 "reply" 필드를 넣어라: 이 물음에 1~2문장(${LIMITS.REPLY_MAX}자 이내)으로 끝까지 완성된 문장으로 답한다. 물음 속 표현을 실제로 다루고, 모르면 무엇을 모르는지 밝힌 뒤 필요한 정보를 말한다. "대신 정답을 정해 줄 수 없다" 같은 회피 문장만 쓰면 실패로 처리된다. 정답을 대신 정하지 않고, 의료·법률·재무 조언을 하지 않으며, 물음표를 쓰지 않는다. 사용자가 ECHO 자체(오타·답을 못 함 등)를 물었으면 사실대로 인정한다.${withQuestion ? " 그 다음 question 으로 사용자 이야기를 이어간다." : " 이번에는 답만 화면에 나가므로 question 은 참고용이다."}`
    : "";
  const system =
    `${PERSONA} 아래 [사용자 근거]만 사실로 사용해서 아직 더 알아가야 할 부분을 묻는 후보 3개를 만들어라. 각 후보는 {"acknowledgement":"anchor를 글자 그대로 포함해 바로 앞 사용자 말을 짧게 받아주는 1문장","question":"새로운 정보를 부탁하는 열린 질문 1개","anchor":"사용자 근거에서 글자 그대로 가져온 2~12자 핵심 표현(문장 전체 복사 금지)","assumptions":[],"meaning":"이전 질문과 다른 새 질문 의도","keys":["핵심 의미 명사구 2~5개"],"reply":"사용자가 질문했을 때만 1~2문장 답, 아니면 빈 문자열"} 형태이고, 전체를 {"candidates":[...]} JSON 객체로만 출력한다. 반드시 지켜라: 1) acknowledgement에는 anchor를 그대로 넣되 사용자 문장을 통째로 베끼지 말고, question에는 그대로 복사하지 않아도 된다. 2) 사용자의 말을 거의 그대로 옮기고 물음표만 붙이는 되묻기, 예/아니오 확인 질문, 이미 답한 내용을 다시 묻는 질문은 금지한다. 3) 사용자가 말하지 않은 사람·관계·미래 장면·감정·원인·회피·상처·행동을 만들지 않는다. 4) 사용자가 거절한 해석과 같은 뜻은 표현을 바꿔도 만들지 않는다. 5) 사용자가 직접 설명·정정한 내용을 가장 먼저 반영한다. 6) 한 번에 한 가지만 묻는다. 7) acknowledgement·question·reply 는 모두 해요체 존댓말로 끝낸다(반말 금지).${userQuestionNote}${priorNote(ctx)}${priorityNote(ctx)}`;
  const feedback = mode === "feedback" ? feedbackText(ctx) : "";
  const user = `[사용자 근거]\n${historyText(ctx)}${feedback ? `\n\n[질문 피드백 — 사실 근거로 사용하지 말 것]\n${feedback}` : ""}`;

  let blockedAll: string[] = [];
  const startedAt = Date.now();
  const maxTokens = mode === "asked" ? ASKED_MAX_TOKENS : CONVERSATION_MAX_TOKENS;
  let attempts = 0;
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - startedAt;
    if (attempt > 0 && elapsed + OPENAI_TIMEOUT_MS > LIMITS.DEADLINE_MS) {
      console.error(`[gsq] attempts_deadline mode=${mode} elapsed_ms=${elapsed} attempts=${attempts}`);
      break;
    }
    const relaxed = attempt === LIMITS.GENERATION_ATTEMPTS - 1;
    const extra = blockedAll.length ? `\n\n다음 후보는 서버에서 차단되었다. 다른 뜻의 질문을 만들어라:\n${blockedAll.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "";
    attempts = attempt + 1;
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: user + extra }], true, maxTokens);
    const parsed = parseCandidates(raw);
    if (!parsed.ok) {
      console.error(`[gsq] candidates_schema_fail mode=${mode} attempt=${attempts}`);
      continue;
    }
    // normal 외 모드(asked·feedback)는 화면에 공감 문장을 쓰지 않으므로 비워서 검사한다.
    const candidates = mode !== "normal" ? parsed.candidates.map((candidate) => ({ ...candidate, acknowledgement: "" })) : parsed.candidates;
    const result = filterCandidates(candidates, block, { relaxed, userQuestion: mode === "asked" ? questionToAnswer : "", requireQuestion: withQuestion });
    const chosen = pickCandidate(result);
    if (chosen) {
      console.error(`[gsq] question_ready mode=${mode} attempts=${attempts} ai_ms=${Date.now() - startedAt} with_question=${withQuestion}`);
      return chosen;
    }
    blockedAll = blockedAll.concat(result.blocked.map((b) => b.candidate.question));
    // 진단 로그: 모드·후보 수·차단 사유 수만. 원문 없음.
    const reasons: Record<string, number> = {};
    for (const b of result.blocked) reasons[b.reason] = (reasons[b.reason] ?? 0) + 1;
    console.error(`[gsq] candidates_blocked mode=${mode} parsed=${candidates.length} attempt=${attempts} relaxed=${relaxed} reasons=${Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(",")}`);
  }
  console.error(`[gsq] no_candidate mode=${mode} blocked_total=${blockedAll.length} attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
  throw new Error("NO_CANDIDATE");
}

// 화면에 낼 문장으로 조립한다(서버가 최종 결정). 답만 하는 턴이면 질문을 붙이지 않는다.
function renderFollowupTurn(candidate: Candidate, ctx: Context): string {
  const mode = followupMode(ctx);
  const latest = latestUserFreeText(ctx);
  const pending = isUnansweredComplaint(latest) ? pendingUserQuestion(ctx, latest) : "";
  return renderFollowup(candidate, mode, latest, !(mode === "asked" && isSelfDirectedQuestion(latest) && !pending));
}

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
  const [emotionRes, msgRes, undRes] = await Promise.all([
    sb.from("emotions").select("mind_text").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    sb.from("messages").select("role, step, content, message_kind").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    sb.from("understanding_results").select("choice, rejected_interpretation, correction_text, self_explanation").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
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
  return validateSingleQuestion(open, LIMITS.QUESTION_MAX, true, historyText(ctx)).ok ? { content: open, kind: "question" } : { content: "", kind: "" };
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
    const { data: { user }, error: authError } = await userSb.auth.getUser();
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
