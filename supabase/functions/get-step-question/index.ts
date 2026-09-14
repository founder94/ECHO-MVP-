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
  CANDIDATES_MAX: 5,
  GENERATION_ATTEMPTS: 3,
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
// choose: understanding → (agree) white_door_ready | (그 외) followup
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

// ── LLM 응답 스키마 검증 ──
interface Candidate {
  question: string;
  meaning: string;
  keys: string[]; // 정규화된 의미 키
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
    const question = typeof o.question === "string" ? o.question.trim() : "";
    if (!question || question.length > LIMITS.QUESTION_MAX) continue;
    const meaning = typeof o.meaning === "string" ? o.meaning.trim().slice(0, LIMITS.MEANING_MAX) : "";
    candidates.push({ question, meaning, keys: cleanKeys(o.keys) });
    if (candidates.length >= LIMITS.CANDIDATES_MAX) break;
  }
  if (!candidates.length) return { ok: false, error: "SCHEMA" };
  return { ok: true, candidates };
}

// 거절 의미 추출 응답: {"rejected_keys":[...]} 만 허용
function parseRejectedKeys(raw: string): string[] | null {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const keys = cleanKeys((parsed as { rejected_keys?: unknown }).rejected_keys);
  return keys.length ? keys : null;
}

// 단일 질문(STEP1·STEP2) 응답 검증: 비어 있지 않고 길이 제한·금지어 통과
type SingleResult = { ok: true; text: string } | { ok: false; error: "EMPTY" | "TOO_LONG" | "FORBIDDEN" };
function validateSingleQuestion(raw: string, maxLength: number = LIMITS.QUESTION_MAX): SingleResult {
  const text = raw.trim().replace(/^["'「]+|["'」]+$/g, "").trim();
  if (!text) return { ok: false, error: "EMPTY" };
  if (text.length > maxLength) return { ok: false, error: "TOO_LONG" };
  if (containsForbiddenTerm(text)) return { ok: false, error: "FORBIDDEN" };
  return { ok: true, text };
}

// ── 후보 차단(서버 상태머신) ──
interface BlockContext {
  askedTexts: string[]; // 이미 나온 AI 질문
  rejectedKeys: string[]; // 구조화된 거절 의미 키(정규화)
  rejectedTexts: string[]; // 거절한 해석 원문(보조 겹침 검사용)
}

type BlockReason = "forbidden" | "repeat" | "rejected_meaning" | "rejected_text";

interface FilterResult {
  survivors: Candidate[];
  blocked: { candidate: Candidate; reason: BlockReason }[];
}

function blockReasonFor(c: Candidate, ctx: BlockContext): BlockReason | null {
  if (containsForbiddenTerm(c.question)) return "forbidden";

  for (const a of ctx.askedTexts) {
    if (looksSame(c.question, a, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP)) return "repeat";
  }

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

function filterCandidates(cands: Candidate[], ctx: BlockContext): FilterResult {
  const survivors: Candidate[] = [];
  const blocked: FilterResult["blocked"] = [];
  for (const c of cands) {
    const reason = blockReasonFor(c, ctx);
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
const OPENAI_TIMEOUT_MS = 25_000;
const CONVERSATION_MAX_TOKENS = 4096;
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
}
interface UnderstandingRow {
  choice: string;
  rejected_interpretation: string | null;
  correction_text: string | null;
  self_explanation: string | null;
}
interface Context {
  mindText: string;
  messages: MessageRow[];
  understandings: UnderstandingRow[];
}
interface Ai {
  apiKey: string;
  model: string;
}

// ── OpenAI ──
async function callOpenAI(ai: Ai, messages: ChatMsg[], jsonMode: boolean): Promise<string> {
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
          max_tokens: CONVERSATION_MAX_TOKENS,
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
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      console.error(`[gsq] openai_empty finish=${String(data?.choices?.[0]?.finish_reason ?? "")} model=${ai.model}`);
      throw new Error("OPENAI_EMPTY");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const PERSONA =
  "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'다. 사용자가 실제로 말한 내용만 근거로 하고 추측·판단·진단·평가를 하지 않는다. 의료·법률·점술·성격검사식 단정을 하지 않는다. 데이팅·궁합 같은 표현을 쓰지 않는다.";

function historyText(ctx: Context): string {
  const parts = ctx.messages.map((m) => `${m.role === "ai" ? "ECHO" : "사용자"}: ${m.content}`);
  if (ctx.mindText) parts.unshift(`마음 기록: ${ctx.mindText}`);
  return parts.join("\n");
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

async function genSingleQuestion(ai: Ai, instruction: string, userContent: string): Promise<string> {
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const raw = await callOpenAI(ai, [{ role: "system", content: `${PERSONA} ${instruction} 질문 텍스트만 출력하고 부가 설명은 붙이지 마라.` }, { role: "user", content: userContent }], false);
    const v = validateSingleQuestion(raw);
    if (v.ok) return v.text;
    // 진단 로그: 검증 실패 사유·길이만. 원문 없음.
    console.error(`[gsq] validate_fail reason=${v.error} len=${raw.length} attempt=${attempt + 1}`);
  }
  throw new Error("NO_CANDIDATE");
}

const genStep1Question = (ai: Ai, mindText: string) =>
  genSingleQuestion(ai, "사용자가 쓴 마음의 기록을 읽고, 그 마음을 공감하며 짚어주는 짧은 한국어 질문을 하나만 만들어라. 질문은 그 마음을 더 알아가기 위한 것이어야 한다.", mindText);

const genStep2Question = (ai: Ai, ctx: Context) =>
  genSingleQuestion(ai, "사용자의 마음 기록과 지금까지의 대화를 읽고, 그 감정의 원인이나 맥락을 더 깊이 알아가는 짧은 한국어 질문을 하나만 만들어라.", historyText(ctx));

async function genUnderstanding(ai: Ai, ctx: Context): Promise<string> {
  const system =
    `${PERSONA} 사용자의 마음 기록과 대화를 바탕으로, 사용자가 지금 어떤 마음인지 한두 문장으로 공감하며 요약해라. 확실하지 않은 부분은 '~인 것 같아요'처럼 후보로만 말한다.${priorityNote(ctx)}\n요약 텍스트만 출력해라.`;
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: historyText(ctx) }], false);
    const v = validateSingleQuestion(raw, LIMITS.UNDERSTANDING_MAX);
    if (v.ok) return v.text;
  }
  throw new Error("NO_CANDIDATE");
}

// 거절한 해석의 "핵심 의미"를 구조화(키 목록)한다. 저장 열이 아직 없으므로 요청 시 계산한다.
// (PENDING SQL의 understanding_results.rejected_meaning 적용 후 저장으로 전환)
async function extractRejectedKeys(ai: Ai, rejectedInterpretation: string, correction: string | null): Promise<string[]> {
  const system =
    "다음은 ECHO가 제시한 해석과, 사용자가 '그게 아니에요'라며 남긴 정정이다. 사용자가 부정한 핵심 의미를 2~6개의 짧은 한국어 명사구로 뽑아 JSON으로만 출력해라. 형식: {\"rejected_keys\":[\"...\"]}. 사용자가 정정에서 새로 말한 내용은 넣지 말고, 부정된 뜻만 넣어라.";
  const user = `해석: ${rejectedInterpretation}\n정정: ${correction ?? "(없음)"}`;
  try {
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: user }], true);
    return parseRejectedKeys(raw) ?? [];
  } catch {
    return [];
  }
}

async function buildBlockContext(ai: Ai, ctx: Context): Promise<BlockContext> {
  const askedTexts = ctx.messages.filter((m) => m.role === "ai").map((m) => m.content);
  const rejectedTexts: string[] = [];
  const rejectedKeys: string[] = [];
  for (const u of ctx.understandings) {
    if (u.choice !== "no" || !u.rejected_interpretation) continue;
    rejectedTexts.push(u.rejected_interpretation);
    const keys = await extractRejectedKeys(ai, u.rejected_interpretation, u.correction_text);
    for (const k of keys) if (!rejectedKeys.includes(k)) rejectedKeys.push(k);
  }
  return { askedTexts, rejectedKeys, rejectedTexts };
}

// 후속 질문: LLM은 후보만, 차단·선택은 서버. 모두 차단되면 재요청, 한도 초과 시 NO_CANDIDATE.
async function genFollowupQuestion(ai: Ai, ctx: Context): Promise<Candidate> {
  const block = await buildBlockContext(ai, ctx);
  const system =
    `${PERSONA} 사용자의 이전 대화를 바탕으로, 아직 더 알아가야 할 부분을 묻는 짧은 한국어 질문 후보 3개를 만들어라. 각 후보는 {"question":"...","meaning":"질문의 핵심 의도 한 문장","keys":["핵심 의미 명사구 2~5개"]} 형태이고, 전체를 {"candidates":[...]} JSON 객체로만 출력한다. 반드시 지켜라: 1) 사용자가 거절한 해석과 같은 뜻의 질문은 표현을 바꿔도 만들지 않는다. 2) 사용자가 직접 설명·정정한 내용을 가장 먼저 반영하고 그것과 충돌하는 후보는 만들지 않는다. 3) 이미 나온 질문과 같은 뜻의 질문을 반복하지 않는다.${priorityNote(ctx)}`;
  const user = `이전 대화:\n${historyText(ctx)}`;

  let blockedAll: string[] = [];
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const extra = blockedAll.length ? `\n\n다음 후보는 서버에서 차단되었다. 다른 뜻의 질문을 만들어라:\n${blockedAll.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "";
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: user + extra }], true);
    const parsed = parseCandidates(raw);
    if (!parsed.ok) continue;
    const result = filterCandidates(parsed.candidates, block);
    const chosen = pickCandidate(result);
    if (chosen) return chosen;
    blockedAll = blockedAll.concat(result.blocked.map((b) => b.candidate.question));
  }
  throw new Error("NO_CANDIDATE");
}

// ═══════════════════════════ db.ts (DB·중복 요청 선점) ═══════════════════════════
// get-step-question — DB 접근·중복 요청 선점·상태 응답 (index.ts 에서 사용)
// 사용자 범위 클라이언트(anon + 사용자 토큰)로만 접근 → 행 단위 보안(RLS)이 소유권을 이중으로 보장.
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
    sb.from("messages").select("role, step, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    sb.from("understanding_results").select("choice, rejected_interpretation, correction_text, self_explanation").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
  return {
    mindText: String(emotionRes?.data?.mind_text ?? ""),
    messages: (msgRes?.data ?? []) as MessageRow[],
    understandings: (undRes?.data ?? []) as UnderstandingRow[],
  };
}

function latestAi(ctx: Context, step: number): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const m = ctx.messages[i];
    if (m.role === "ai" && m.step === step) return m.content;
  }
  return "";
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
    return json({ ok: true, status, step, conversationId: conv.id, understanding: latestAi(ctx, AI_STEP.understanding) });
  }
  return json({ ok: true, status, step, conversationId: conv.id, question: latestAi(ctx, AI_STEP[status]) });
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

async function commitState(sb: Db, conversationId: string, token: string, action: string, status: Status): Promise<boolean> {
  const { data, error } = await sb
    .from("conversations")
    .update({ status, current_step: DISPLAY_STEP[status], request_action: action, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("request_token", token)
    .select("id");
  return !error && !!data && data.length === 1;
}

async function insertMessage(sb: Db, conversationId: string, userId: string, role: "ai" | "user", step: number, content: string): Promise<string | null> {
  const { data, error } = await sb.from("messages").insert({ conversation_id: conversationId, user_id: userId, role, step, content }).select("id").single();
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
// get-step-question — ECHO 대화 서버 상태머신 (STEP 1 → STEP 2 → 이해 확인 → 후속 → White Door 준비)
//
// 보안·안정 원칙
// - 모든 요청은 토큰 getUser 실검증. Origin은 인증이 아니다.
// - 사용자 범위 클라이언트(anon + 사용자 토큰) 사용 → 행 단위 보안(RLS)이 소유권을 이중으로 보장.
// - 중복 요청: conversations.request_token/request_action 두 열로 "선점(pending) → 완료(action)" 2단계 표시.
//   조건부 UPDATE 1회로 선점하므로 같은 토큰의 동시 요청은 하나만 처리된다.
// - 부분 저장 최소화: LLM 호출은 DB 쓰기보다 먼저. 쓰기 실패 시 이번 요청이 만든 행을 되돌린다(보상 삭제).
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
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);

    const sb: Db = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);

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
      if (!aiReady) return fail("AI_NOT_CONFIGURED", "AI 서버 설정 필요");

      // 같은 토큰으로 이미 만든 대화가 있으면 그 상태를 돌려준다(재전송·연속 클릭)
      const { data: dup } = await sb.from("conversations").select(CONV_COLUMNS).eq("user_id", user.id).eq("request_token", token).maybeSingle();
      if (dup) return stateResponse(sb, dup as ConversationRow);

      // 요청 횟수 제한(Rate Limit): 최근 10분 내 시작 횟수
      const since = new Date(Date.now() - START_RATE_WINDOW_MS).toISOString();
      const { count } = await sb.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
      if ((count ?? 0) >= START_RATE_MAX) return fail("RATE_LIMITED", "잠시 후 다시 시도해 주세요.", 429);

      // LLM 먼저, DB 쓰기는 그 다음 (실패 시 남는 행이 없도록)
      let question: string;
      try {
        question = await genStep1Question(ai, mindText);
      } catch (e) {
        return fail((e as Error).message === "NO_CANDIDATE" ? "NO_CANDIDATE" : "AI_ERROR", "AI 응답을 받지 못했어요.");
      }

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
      const msgId = await insertMessage(sb, convId, user.id, "ai", AI_STEP.step1, question);
      if (!msgId) {
        await sb.from("emotions").delete().eq("conversation_id", convId);
        await rollbackRows(sb, "conversations", [convId]);
        return fail("ERROR", "질문 저장에 실패했어요.");
      }
      return json({ ok: true, status: "step1", step: 1, conversationId: convId, question });
    }

    if (!conversationId) return fail("BAD_REQUEST", "대화 식별값이 없어요.");
    const conv = await loadConversation(sb, user.id, conversationId);
    if (!conv) return fail("FORBIDDEN", "대화를 찾지 못했어요.", 403);

    // ── resume ──
    if (action === "resume") return stateResponse(sb, conv);

    if (!token) return fail("BAD_REQUEST", "요청 식별값이 없어요.");
    if (!isStatus(conv.status)) return fail("UNKNOWN_STATE", "알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.");

    // ── answer ──
    if (action === "answer") {
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!answer) return fail("BAD_REQUEST", "답변을 입력해 주세요.");
      if (answer.length > LIMITS.ANSWER_MAX) return fail("BAD_REQUEST", `답변은 ${LIMITS.ANSWER_MAX}자까지 적을 수 있어요.`);
      if (!canAnswer(conv.status)) return fail("INVALID_STATE", "현재 단계에서는 답변할 수 없어요.");
      if (!aiReady) return fail("AI_NOT_CONFIGURED", "AI 서버 설정 필요");

      const claim = await claimRequest(sb, conv, conv.status, token);
      if (claim === "duplicate_done") return stateResponse(sb, conv);
      if (claim !== "claimed") return claimError(claim);

      const status = conv.status;
      const next = nextStatusAfterAnswer(status);
      const userStep = USER_STEP[status];
      const created: string[] = [];
      try {
        // 답변을 문맥에 넣어 LLM 먼저 호출 (DB 쓰기 전)
        const ctx = await loadContext(sb, conversationId);
        ctx.messages.push({ role: "user", step: userStep, content: answer });

        let aiText: string;
        let aiStep: number;
        if (next === "step2") {
          aiText = await genStep2Question(ai, ctx);
          aiStep = AI_STEP.step2;
        } else {
          aiText = await genUnderstanding(ai, ctx);
          aiStep = AI_STEP.understanding;
        }

        const userMsgId = await insertMessage(sb, conversationId, user.id, "user", userStep, answer);
        if (!userMsgId) throw new Error("DB_USER_MSG");
        created.push(userMsgId);
        const aiMsgId = await insertMessage(sb, conversationId, user.id, "ai", aiStep, aiText);
        if (!aiMsgId) throw new Error("DB_AI_MSG");
        created.push(aiMsgId);

        if (!next || !(await commitState(sb, conversationId, token, "answer", next))) throw new Error("DB_STATE");

        return next === "step2"
          ? json({ ok: true, status: next, step: DISPLAY_STEP[next], conversationId, question: aiText })
          : json({ ok: true, status: next, step: DISPLAY_STEP[next], conversationId, understanding: aiText });
      } catch (e) {
        await rollbackRows(sb, "messages", created);
        await releaseClaim(sb, conversationId, token, conv);
        const msg = (e as Error).message;
        if (msg === "NO_CANDIDATE") return fail("NO_CANDIDATE", "질문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        if (msg.startsWith("DB_")) return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
        return fail("AI_ERROR", "AI 응답을 받지 못했어요.");
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
      if (choice !== "agree" && !aiReady) return fail("AI_NOT_CONFIGURED", "AI 서버 설정 필요");

      const claim = await claimRequest(sb, conv, "understanding", token);
      if (claim === "duplicate_done") return stateResponse(sb, conv);
      if (claim !== "claimed") return claimError(claim);

      const createdMsgs: string[] = [];
      const createdUnds: string[] = [];
      try {
        const ctx = await loadContext(sb, conversationId);
        const currentUnderstanding = latestAi(ctx, AI_STEP.understanding);
        if (!currentUnderstanding) throw new Error("DB_NO_UNDERSTANDING");

        // 맞아요: 서버가 무료 단계 완료 조건을 확인한 뒤에만 white_door_ready
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
          const m = await insertMessage(sb, conversationId, user.id, "user", AI_STEP.understanding, "맞아요");
          if (!m) throw new Error("DB_USER_MSG");
          createdMsgs.push(m);
          if (!(await commitState(sb, conversationId, token, "choose", "white_door_ready"))) throw new Error("DB_STATE");
          return json({ ok: true, status: "white_door_ready", step: DISPLAY_STEP.white_door_ready, conversationId });
        }

        // 조금 달라요 / 그게 아니에요 / 직접 설명할게요 → 정정·거절·직접 설명을 반영한 새 질문(LLM 먼저)
        const record: UnderstandingRow = {
          choice,
          rejected_interpretation: choice === "no" ? currentUnderstanding : null,
          correction_text: choice === "alittle" || choice === "no" ? text : null,
          self_explanation: choice === "explain" ? text : null,
        };
        ctx.understandings.push(record);
        ctx.messages.push({ role: "user", step: AI_STEP.understanding, content: text });
        const candidate = await genFollowupQuestion(ai, ctx);

        const { data: und, error: undErr } = await sb
          .from("understanding_results")
          .insert({ conversation_id: conversationId, user_id: user.id, step: AI_STEP.understanding, ...record })
          .select("id")
          .single();
        if (undErr || !und) throw new Error("DB_UND");
        createdUnds.push(String(und.id));
        const userMsgId = await insertMessage(sb, conversationId, user.id, "user", AI_STEP.understanding, text);
        if (!userMsgId) throw new Error("DB_USER_MSG");
        createdMsgs.push(userMsgId);
        const aiMsgId = await insertMessage(sb, conversationId, user.id, "ai", AI_STEP.followup, candidate.question);
        if (!aiMsgId) throw new Error("DB_AI_MSG");
        createdMsgs.push(aiMsgId);
        if (!(await commitState(sb, conversationId, token, "choose", "followup"))) throw new Error("DB_STATE");

        return json({ ok: true, status: "followup", step: DISPLAY_STEP.followup, conversationId, question: candidate.question });
      } catch (e) {
        await rollbackRows(sb, "messages", createdMsgs);
        await rollbackRows(sb, "understanding_results", createdUnds);
        await releaseClaim(sb, conversationId, token, conv);
        const msg = (e as Error).message;
        if (msg === "INCOMPLETE") return fail("INVALID_STATE", "아직 이야기가 충분히 쌓이지 않았어요.");
        if (msg === "NO_CANDIDATE") return fail("NO_CANDIDATE", "새 질문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        if (msg.startsWith("DB_")) return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
        return fail("AI_ERROR", "AI 응답을 받지 못했어요.");
      }
    }

    return fail("BAD_REQUEST", "알 수 없는 요청이에요.");
  } catch {
    return fail("ERROR", "서버 오류가 발생했어요.", 500);
  }
});
