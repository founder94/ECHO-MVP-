// get-step-question — 순수 규칙 (Deno·브라우저 API 의존 없음)
// 2026-09-17: 단일 파일이 88KB 라 배포 전송이 잘렸다. 실제 모듈 구분대로 rules / ai / index 로 나눈다.
// 로직은 그대로다. 나눈 기준은 원본 주석의 구역(logic.ts / ai.ts / db.ts+index.ts)이다.
// ═══════════════════════════ logic.ts (순수 로직) ═══════════════════════════
// get-step-question 순수 로직 (Deno·브라우저 API 의존 없음 → 단위 테스트 대상)
//
// 원칙
// - LLM은 후보(question·meaning·keys)만 만든다. 최종 선택·상태 전환·차단·완료 판정은 여기서(서버) 한다.
// - 글자 겹침(bigram)은 보조 장치다. 1차 판정은 구조화된 의미 키(keys)의 교집합이다.
// - 하드코딩 질문 없음. 후보가 모두 차단되면 NO_CANDIDATE로 돌려보내고 상태를 보존한다.

// 대화 문맥 타입(원본 ai.ts 에 있던 선언을 규칙이 함께 쓰므로 이쪽으로 옮김)
export interface MessageRow {
  role: string;
  step: number | null;
  content: string;
  message_kind: string | null;
}
export interface UnderstandingRow {
  choice: string;
  rejected_interpretation: string | null;
  correction_text: string | null;
  self_explanation: string | null;
}
// ⑤ 기억: '지난 리포트 요약(참고)'과 '사용자가 확인한 기억(확정)'을 구분한다. 조회 실패는 숨기지 않는다.
export interface Memory { summary: string; confirmed: string[]; lookupFailed: boolean }
export interface Context {
  mindText: string;
  messages: MessageRow[];
  understandings: UnderstandingRow[];
  memory?: Memory;
}

export const STATUSES = ["step1", "step2", "understanding", "followup", "white_door_ready"] as const;
export type Status = (typeof STATUSES)[number];

export const CHOICES = ["agree", "alittle", "no", "explain"] as const;
export type Choice = (typeof CHOICES)[number];

export const LIMITS = {
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

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export function isChoice(v: unknown): v is Choice {
  return typeof v === "string" && (CHOICES as readonly string[]).includes(v);
}

export function isValidToken(v: unknown): v is string {
  return typeof v === "string" && LIMITS.TOKEN_PATTERN.test(v);
}

// ── 상태머신 전이표 ──
// answer: step1 → step2, step2 → understanding, followup → understanding
// choose: understanding → (agree) step3 | (그 외) followup
export const ANSWER_TRANSITIONS: Readonly<Record<string, Status>> = {
  step1: "step2",
  step2: "understanding",
  followup: "understanding",
};

export function canAnswer(status: string): boolean {
  return status in ANSWER_TRANSITIONS;
}

export function nextStatusAfterAnswer(status: string): Status | null {
  return ANSWER_TRANSITIONS[status] ?? null;
}

// messages.step 값: 사용자 답변이 어느 단계의 답인지
export const USER_STEP: Readonly<Record<string, number>> = { step1: 1, step2: 2, followup: 4 };
// messages.step 값: AI 메시지 종류
export const AI_STEP = { step1: 1, step2: 2, understanding: 3, followup: 4 } as const;
export type MessageKind =
  | "step_question"
  | "step_answer"
  | "understanding_summary"
  | "understanding_choice"
  | "followup_question"
  | "followup_answer";
// 화면 표시용 단계 번호
export const DISPLAY_STEP: Readonly<Record<Status, number>> = {
  step1: 1,
  step2: 2,
  understanding: 3,
  followup: 3,
  white_door_ready: 3,
};

// 무료 단계 완료 조건(서버가 판정): STEP1·STEP2 사용자 답변 + 이해 내용이 모두 실제 저장되어 있어야 한다.
export interface CompletionInput {
  status: string;
  hasStep1Answer: boolean;
  hasStep2Answer: boolean;
  hasUnderstanding: boolean;
}
export function canCompleteFreeStage(i: CompletionInput): boolean {
  return i.status === "understanding" && i.hasStep1Answer && i.hasStep2Answer && i.hasUnderstanding;
}

// ── 텍스트 정규화·겹침(보조) ──
export function normalizeKey(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

export function bigrams(s: string): Set<string> {
  const clean = normalizeKey(s);
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

export function intersectionSize(A: Set<string>, B: Set<string>): number {
  let inter = 0;
  A.forEach((x) => {
    if (B.has(x)) inter++;
  });
  return inter;
}

// 자카드 유사도: 교집합 / 합집합
export function bigramSimilarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  const inter = intersectionSize(A, B);
  return inter / (A.size + B.size - inter);
}

// 포함률(overlap coefficient): 교집합 / 작은 쪽 크기 — 한 문장이 다른 문장을 거의 포함하면 높다
export function bigramOverlap(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  return intersectionSize(A, B) / Math.min(A.size, B.size);
}

export function looksSame(a: string, b: string, sim: number, overlap: number): boolean {
  return bigramSimilarity(a, b) > sim || bigramOverlap(a, b) > overlap;
}

// ── 금지 표현(의료·법률·점술·성격검사식 단정) ──
export const FORBIDDEN_TERMS = [
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

export function containsForbiddenTerm(text: string): string | null {
  const t = text.toLowerCase();
  for (const term of FORBIDDEN_TERMS) if (t.includes(term)) return term;
  return null;
}

// ── 2026-09-16 행동 분기(Action Router)·되받아치기 방지 (echo-journey 와 같은 규칙) ──
// 사용자가 ECHO 에게 물은 문장("어떻게 하는 게 좋을까?", "답을 못 해?")은 질문 재료가 아니라 먼저 짧게 답해야 할 말이다.
export const USER_QUESTION = /\?\s*$|(?:어떻게|어떡|뭘|무엇을|어느|왜|언제).{0,16}(?:좋을까|할까|하지|해야|일까|되나|될까|돼)|(?:답|대답)(?:을|은)?\s*(?:못|안)\s*(?:해|햐|하)/u;
// "아까 내 질문에는 답하지 않았어" 처럼 앞 물음에 답하지 않았다는 지적도 '답해야 할 말'로 본다.
export const UNANSWERED_COMPLAINT = /(?:질문|물어봤|물었)\S{0,10}\s*(?:답|대답)\S{0,4}\s*(?:않|안|못)|(?:답|대답)\S{0,4}\s*(?:않았|않아|않네|않고|안\s*했|못\s*했)/u;
export function isUnansweredComplaint(text: string): boolean {
  return UNANSWERED_COMPLAINT.test(text.trim());
}
export function isUserQuestion(text: string): boolean {
  const t = text.trim();
  return !!t && (USER_QUESTION.test(t) || UNANSWERED_COMPLAINT.test(t));
}
// 앞 물음에 답하지 않았다는 지적이면 그 앞의 물음을 찾아 답한다.
export function pendingUserQuestion(ctx: Context, exclude: string): string {
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
export function cleanReply(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// ── 2026-09-17 답변(reply) 품질 판정 (echo-journey 와 같은 규칙) ──
// 고정 회피 문장을 답변 성공으로 처리하지 않는다. 잘려서 끊긴 문장도 통과시키지 않는다.
export type ReplyBlockReason = "reply_missing" | "reply_question_mark" | "reply_too_long" | "reply_incomplete" | "reply_evasive" | "reply_irrelevant";
export const REPLY_COMPLETE = /(?:[.!…]|요|죠|다|네|까|군|데|어|아|지|음|함|예|오)\s*$/u;
export const EVASIVE_REPLY = [/대신\s*정답을?\s*정해/, /^(?:같이|함께)\s*찾아(?:볼게요|봐요)[.!]?$/, /^(?:음|글쎄요?|잘\s*모르겠어요)[.!]?$/] as const;
export function contentTokens(text: string): string[] {
  return normalizeKey(text).match(/[가-힣]{2,}|[a-z0-9]{2,}/gu) ?? [];
}
export const RELEVANCE_STOP = /^(?:은|는|이|가|을|를|에|의|도|와|과|로|요|죠|다|네|까|어|해|하|것|수|저|제|내|나)$/;
// 되물음에서 의문사·지시어를 뺀 '내용 낱말'. 이것이 없으면 답이 겹칠 것 자체가 없다.
export const QUESTION_FILLER = /^(?:어떻게|어떡해|어떤|어느|무슨|무엇|뭐야|뭔데|뭘|왜|언제|어디|누구|얼마나|그래서|그럼|그렇게|그거|그게|이게|저게|지금|내가|나는|저는|제가|해야|하면|할까|할지|좋을까|좋아|있는|있을까|건가|건데|거야|건지|인가|이야|말이야|뜻이야|생각해|생각했어|판단은|나온|했어|하는|하지)$/u;
export function questionContentWords(question: string): string[] {
  return (question.split(/[\s,./!?"'“”‘’()\[\]{}]+/u).map((w) => w.trim()).filter(Boolean))
    .map((w) => normalizeKey(w))
    .filter((w) => w.length >= 2 && !QUESTION_FILLER.test(w));
}
export function sharesContent(reply: string, question: string): boolean {
  const q = normalizeKey(question);
  const r = normalizeKey(reply);
  if (!q || !r) return false;
  for (let i = 0; i < q.length - 1; i++) {
    const pair = q.slice(i, i + 2);
    if (RELEVANCE_STOP.test(pair)) continue;
    if (r.includes(pair)) return true;
  }
  // echo-journey 와 같은 보조 규칙: 낱말 단위로도 겹치는지 본다(한 곳만 고치지 않는다).
  return contentTokens(question).some((token) => r.includes(token));
}
// 2026-09-18 운영 진단: asked 모드 차단의 절대다수가 reply_irrelevant 였다.
// "무슨 뜻이야?" "어떻게 해야 좋을까?" 처럼 되물음이 의문사·지시어만으로 되어 있으면
// 답이 겹칠 낱말 자체가 없어 어떤 답도 통과하지 못한다 → 사용자의 물음이 영영 답을 못 받는다.
// 겹칠 것이 없으면 관련성을 묻지 않는다(빠져나갈 문 없는 차단 규칙은 두지 않는다).
export function questionHasContent(question: string): boolean {
  return questionContentWords(question).length > 0;
}
// 질문의 낱말을 그대로 쓰지 않아도, 무엇을 알고 모르는지 밝히는 답은 '응답한 것'으로 본다.
export const RESPONSIVE_REPLY = /(?:제가|저는|저도|제)\s*[^.!]{0,20}(?:답|정답|모르|알|말씀|물음|질문)/u;
export function replyQualityReason(reply: string, userQuestion: string): ReplyBlockReason | null {
  const text = reply.trim();
  if (!text) return "reply_missing";
  if (text.includes("?")) return "reply_question_mark";
  if (text.length > LIMITS.REPLY_MAX) return "reply_too_long";
  if (!REPLY_COMPLETE.test(text)) return "reply_incomplete";
  if (EVASIVE_REPLY.some((pattern) => pattern.test(text))) return "reply_evasive";
  if (userQuestion.trim() && questionHasContent(userQuestion) && !sharesContent(text, userQuestion) && !RESPONSIVE_REPLY.test(text)) return "reply_irrelevant";
  return null;
}

// ECHO(제품·AI) 자체에 대한 물음이면 답만 하고 새 질문을 강제로 붙이지 않는다.
export const SELF_DIRECTED = [
  /\bai\b|에이아이|인공지능|에코|echo/i,
  UNANSWERED_COMPLAINT,
  /(너|당신|넌|니가|네가)\s*(는|가|도)?\s*(왜|뭐|무슨|어떻게|답|기억|오타|말)/,
  /오타|오류|버그|고장|틀리|잘못\s*(말|답|이해)/,
  /(답|대답)(을|은)?\s*(못|안)\s*(해|햐|하|했)/,
  /기억(해|하니|하나|나니|나|못)/,
] as const;
export function isSelfDirectedQuestion(text: string): boolean {
  const value = text.trim();
  return isUserQuestion(value) && SELF_DIRECTED.some((pattern) => pattern.test(value));
}
// 공감 문장이 사용자 말을 그대로 베끼면(되받아치기) 버린다. 짧은 표현 인용은 허용한다.
export function isParrot(acknowledgement: string, latestUser: string): boolean {
  const a = normalizeKey(acknowledgement);
  const u = normalizeKey(latestUser);
  if (!a || u.length < 12) return false;
  if (a.includes(u)) return true;
  return bigramOverlap(acknowledgement, latestUser) > 0.8;
}

// ── LLM 응답 스키마 검증 ──
export interface Candidate {
  acknowledgement?: string;
  question: string;
  meaning: string;
  keys: string[]; // 정규화된 의미 키
  anchor: string; // 사용자 원문에서 그대로 가져온 표현
  assumptions: string[]; // 새로 가정한 내용. 반드시 빈 배열이어야 통과
  reply?: string; // 사용자가 ECHO 에게 물었을 때만: 1~2문장 답(물음표 없음)
}

export type ParseResult = { ok: true; candidates: Candidate[] } | { ok: false; error: "SCHEMA" };

export function cleanKeys(raw: unknown): string[] {
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

export function extractJson(text: string): unknown {
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
export function parseCandidates(raw: string): ParseResult {
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
    candidates.push({ acknowledgement: ackOrDrop(politeOrSame(typeof o.acknowledgement === "string" ? o.acknowledgement.trim().slice(0, 100) : ""), anchor), question: politeOrSame(question), meaning, keys: cleanKeys(o.keys), anchor, assumptions, reply: politeOrSame(typeof o.reply === "string" ? cleanReply(o.reply) : "") });
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

export const HANGUL = /[가-힣]/u;
export const TRAILING_MARKS = /[\s"'”’」』)\]]*[.?!…]*[\s"'”’」』)\]]*$/u;
// 해요체·합쇼체 종결. 여기에 걸리면 이미 존댓말이다.
export const POLITE_TAIL = /(요|죠|쇼|니다|니까)$/u;

// 반말 종결 → 해요체. 긴 어미부터 검사한다(짧은 규칙이 먼저 먹는 것을 막는다).
export const POLITE_MAP: ReadonlyArray<readonly [string, string]> = [
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

export interface SentencePiece {
  body: string; // 종결 부호를 뗀 본문
  tail: string; // 종결 부호와 따옴표
}

// 문장 부호를 살린 채로 문장 단위로 나눈다.
export function splitSentences(text: string): string[] {
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

export function cutTail(sentence: string): SentencePiece {
  const match = sentence.match(TRAILING_MARKS);
  const tail = match ? match[0] : "";
  return { body: tail ? sentence.slice(0, sentence.length - tail.length) : sentence, tail };
}

// 판정 대상 문장인지: 한글이 있고 너무 짧지 않은 문장만 본다.
export function checkable(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length >= 3 && HANGUL.test(trimmed);
}

export function isPoliteSentence(sentence: string): boolean {
  const { body } = cutTail(sentence);
  const trimmed = body.trim();
  if (!checkable(trimmed)) return true;
  return POLITE_TAIL.test(trimmed);
}

/** 화면에 나갈 문장에 반말이 섞여 있는가. 한 문장이라도 반말이면 true. */
export function hasBanmal(text: string): boolean {
  return splitSentences(text).some((sentence) => !isPoliteSentence(sentence));
}

export function politeBody(body: string): string | null {
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
export function toPoliteKorean(text: string): string | null {
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


/** 공감 문장이 근거 표현을 담지 못하면 문장을 버린다(후보 자체는 살린다). 2026-09-17 실AI 근거. */
export function ackOrDrop(acknowledgement: string, anchor: string): string {
  if (!acknowledgement) return "";
  return normalizeKey(acknowledgement).includes(normalizeKey(anchor)) ? acknowledgement : "";
}

/** 고칠 수 있으면 해요체로 바꾸고, 규칙에 없는 끝맺음이면 원문을 그대로 둔다(뒤의 검사가 차단한다). */
export function politeOrSame(text: string): string {
  if (!text) return text;
  return toPoliteKorean(text) ?? text;
}

export type SingleResult = { ok: true; text: string } | { ok: false; error: "EMPTY" | "TOO_LONG" | "FORBIDDEN" | "NOT_QUESTION" | "MULTIPLE_QUESTIONS" | "NOT_GROUNDED" | "BANMAL" };
export function hasUnsupportedPremise(question: string, evidence: string): boolean {
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
export const LEAD_ACK_MAX = 30;
export function tidyQuestionText(raw: string): string {
  const text = raw.trim().replace(/^["'「『]+|["'」』]+$/g, "").trim();
  if (text.endsWith("?")) return text;
  const last = text.lastIndexOf("?");
  if (last < 0) return text;
  // 마지막 물음표 뒤에 글자·숫자가 없으면(이모지·기호·공백·닫는 따옴표만) 장식으로 보고 잘라낸다. 글자가 있으면 손대지 않는다.
  if (/[\p{L}\p{N}]/u.test(text.slice(last + 1))) return text;
  return text.slice(0, last + 1).trim();
}
export function softenLeadingQuestion(text: string): string {
  const marks = text.match(/\?/g)?.length ?? 0;
  if (marks !== 2 || !text.endsWith("?")) return text;
  const first = text.indexOf("?");
  const head = text.slice(0, first);
  // 앞의 짧은 공감 되묻기만 마침표로 바꾼다. 길면 진짜 두 질문일 수 있으므로 그대로 두어 MULTIPLE_QUESTIONS 로 거른다.
  if (!head.trim() || head.length > LEAD_ACK_MAX || !/\p{L}/u.test(head)) return text;
  return `${head.trimEnd()}.${text.slice(first + 1)}`;
}
// 진단용 형태 정보(원문 없음): 물음표 개수와 끝 모양만.
export function questionShape(raw: string): string {
  const text = raw.trim();
  const qmarks = text.match(/\?/g)?.length ?? 0;
  const last = text.lastIndexOf("?");
  const tail = last < 0 ? "none" : last === text.length - 1 ? "q" : /[\p{L}\p{N}]/u.test(text.slice(last + 1)) ? "text" : "deco";
  return `qmarks=${qmarks} tail=${tail}`;
}
export function validateSingleQuestion(raw: string, maxLength: number = LIMITS.QUESTION_MAX, mustBeQuestion = true, evidence = "", relaxGrounding = false): SingleResult {
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
      // 글자 겹침은 '표현을 물고 가라'는 다양성·자연스러움 규칙이다. 마지막 시도에서는 푼다.
      // 없는 사실을 지어내는 것(hasUnsupportedPremise)은 어떤 경우에도 막는다.
      if (!relaxGrounding && intersectionSize(q, e) === 0) return { ok: false, error: "NOT_GROUNDED" };
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

// ── 정정 우선(Correction Engine) 판정 ──
// 2026-09-18 운영 캐너리 근거: 서로 다른 정정 2건("사람이 더 힘들어요" / "시간이 없는 게 더 힘들어요")에
// 서버가 똑같이 "일이 많아지면서 어떤 부분이 가장 힘드신가요?" 를 냈다. 정정 우선은 프롬프트 문장으로만
// 지시되어 있었고 서버 규칙이 없었다. ECHO 원칙대로(LLM 은 후보만, 결정은 서버) 서버가 판정한다.
// 상투어("조금 달라요" 등)는 내용이 아니므로 빼고, 남은 내용어가 하나라도 다뤄지면 반영된 것으로 본다.
const CORRECTION_LEAD = /(?:제가\s*직접\s*설명할게요|직접\s*설명할게요|반은\s*맞고\s*반은\s*아닌\s*것\s*같아요|조금\s*달라요|그게\s*아니에요|아니에요|아니요|사실은)/gu;
const CORRECTION_PARTICLE_TAIL = /(?:이|가|은|는|을|를|에|의|도|보다|부터|까지|으로|로|와|과)$/u;
export function correctionContentWords(correction: string): string[] {
  return [...new Set((correction.replace(CORRECTION_LEAD, " ").match(/[가-힣]{2,}/gu) ?? [])
    .map((word) => word.replace(CORRECTION_PARTICLE_TAIL, ""))
    .filter((word) => word.length >= 2))];
}
// 비교할 내용어가 아예 없으면 막지 않는다(빠져나갈 문 없는 차단 규칙은 두지 않는다).
export function reflectsCorrection(text: string, correction: string): boolean {
  const words = correctionContentWords(correction);
  if (!words.length) return true;
  const target = normalizeKey(text);
  return words.some((word) => target.includes(normalizeKey(word)));
}

// ── 후보 차단(서버 상태머신) ──
export interface BlockContext {
  askedTexts: string[]; // 이미 나온 AI 질문
  rejectedKeys: string[]; // 구조화된 거절 의미 키(정규화)
  rejectedTexts: string[]; // 거절한 해석 원문(보조 겹침 검사용)
  evidenceTexts: string[]; // 사용자가 직접 쓴 말만
  pendingCorrection: string; // 아직 어떤 질문도 다루지 않은 정정·직접 설명(있으면 이번 질문이 먼저 다뤄야 한다)
}

export const QUESTION_INTENTS = [
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

export function questionIntent(question: string): string {
  return QUESTION_INTENTS.find(({ pattern }) => pattern.test(question))?.tag ?? "";
}

export function repeatsQuestionIntent(question: string, asked: string[]): boolean {
  const intent = questionIntent(question);
  return !!intent && asked.some((previous) => questionIntent(previous) === intent);
}

export type BlockReason = "forbidden" | "banmal" | "repeat" | "rejected_meaning" | "rejected_text" | "not_question" | "not_grounded" | "assumption" | "reply_quality" | "correction_ignored";

export interface FilterResult {
  survivors: Candidate[];
  blocked: { candidate: Candidate; reason: BlockReason }[];
}

// relaxed(마지막 시도): 의도 반복 같은 '다양성' 규칙만 풀고, 안전·근거·거절·글자 반복 규칙은 유지한다.
// 의도 반복은 최근 질문 2개와만 비교한다(전체와 비교하면 의도 12종이 금방 소진되어 NO_CANDIDATE — 2026-09-16 운영 로그).
export const INTENT_HISTORY = 2;
export interface BlockOptions {
  relaxed?: boolean;
  userQuestion?: string;
  requireQuestion?: boolean;
}
// ④ 거절한 해석이 답변·요약으로 되살아나는지: 문장 유사도로 본다.
// 낱말 포함(예: '중요하게')만으로 막으면 정상 문장까지 죽는다 — 의미 키 대조는 질문 후보에만 쓴다.
export function replyRevivesRejected(reply: string, ctx: BlockContext): boolean {
  const text = reply.trim();
  if (!text) return false;
  return ctx.rejectedTexts.some((rejected) => looksSame(text, rejected, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP));
}
export function blockReasonFor(c: Candidate, ctx: BlockContext, options: BlockOptions = {}): BlockReason | null {
  const { relaxed = false, userQuestion = "", requireQuestion = true } = options;
  if (containsForbiddenTerm(`${c.acknowledgement ?? ""}\n${c.question}\n${c.reply ?? ""}`)) return "forbidden";
  // 말투: 해요체로 바꿀 수 없는 후보는 화면에 내지 않는다(2026-09-17 반말 결함).
  // 답(reply)만 반말이면 '답 품질 실패'로 다룬다. 그래야 질문까지 같이 죽지 않고 대화가 이어진다.
  if (hasBanmal(`${c.acknowledgement ?? ""} ${c.question}`.trim())) return "banmal";
  // ③④ 사용자가 물었으면 '답'이 실제 답이어야 하고, 거절한 뜻을 되살려서도 안 된다.
  if (userQuestion) {
    if (hasBanmal((c.reply ?? "").trim())) return "reply_quality";
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
  // 정정 직후 첫 질문은 정정 내용을 실제로 다뤄야 한다. 완화 시도에서도 풀지 않는다 —
  // 대신 여기까지 온 후보는 다른 모든 규칙을 통과했으므로, 끝까지 못 찾으면 이 후보를 구제한다
  // (genFollowupQuestion 의 correctionOnly). 그래서 이 검사는 반드시 맨 마지막에 있어야 한다.
  if (ctx.pendingCorrection && !reflectsCorrection(c.question, ctx.pendingCorrection)) return "correction_ignored";
  return null;
}

export function filterCandidates(cands: Candidate[], ctx: BlockContext, options: BlockOptions = {}): FilterResult {
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
export function pickCandidate(r: FilterResult): Candidate | null {
  return r.survivors[0] ?? null;
}

