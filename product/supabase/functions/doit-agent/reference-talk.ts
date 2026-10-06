// 참고 이야기(사주·타로 결과 뒤 ECHO 대화) — Codex echo-spec 20261005 B · 대표 「사주·타로 최종 완성」.
// 대화 상태·프로필·매칭과 분리된 모듈. 대화 서버(agent.ts)·매칭 계약(matching.ts)은 이 모듈을 모른다(core-preservation 검사).
// - 받는 것 = 결과 종류 하나(카드 이름 · 사주 세 갈래 키) + 이번 이야기의 앞 줄(최대 8) + 지금 말. 생년월일·시간·성별·명식·해설 글 0.
// - 저장 0: 세션 줄·사실·프로필·매칭 쓰기 없음. 카드·사주 의미는 사용자 사실이 아니다.
// - 질문 기본 0: 이번 말이 직접 질문을 청할 때만 한 개(다음 말로 이어지지 않음). 질문을 끈 동안 응답의 물음 문장은 서버가 뺀다.
import { call, parseJson, type Llm, type Obs } from "./agent.ts";

export type RefSeed = { kind: "card"; label: string } | { kind: "pattern"; key: PatternKey };
export type PatternKey = "peer_many" | "peer_none" | "peer_some";
export interface RefLine { role: "user" | "echo"; text: string }
export interface RefReply { reply: string; question: string | null }

const CARD = /^[가-힣A-Za-z0-9 ·()]{1,20}$/; // 앱 contentSeed 와 같은 모양
// 사주 세 갈래(앱 saju/explain.ts topics 「관계」와 같은 문장) — 결과 「종류」만 · 사용자 사실 아님
const PATTERN_LINE: Record<PatternKey, string> = {
  peer_many: "주변 사람과 부대끼며 힘을 얻는 쪽",
  peer_none: "혼자 정리하는 시간이 필요한 쪽",
  peer_some: "사람과의 거리를 스스로 조절하는 쪽",
};
export const REF_TEXT_MAX = 500, REF_HISTORY_MAX = 8, REF_LINE_MAX = 500;

export function refSeed(v: unknown): RefSeed | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "card" && typeof o.label === "string" && CARD.test(o.label.trim())) return { kind: "card", label: o.label.trim() };
  if (o.kind === "pattern" && typeof o.key === "string" && o.key in PATTERN_LINE) return { kind: "pattern", key: o.key as PatternKey };
  return null;
}
// 앞 줄: 모양이 틀리면 요청 전체를 받지 않는다(조용히 고쳐 쓰지 않음).
export function refHistory(v: unknown): RefLine[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > REF_HISTORY_MAX) return null;
  const out: RefLine[] = [];
  for (const x of v) {
    const o = x as Record<string, unknown> | null;
    if (!o || (o.role !== "user" && o.role !== "echo") || typeof o.text !== "string") return null;
    const t = o.text.trim();
    if (!t || t.length > REF_LINE_MAX) return null;
    out.push({ role: o.role, text: t });
  }
  return out;
}
const seedText = (s: RefSeed) => s.kind === "card" ? `고른 카드: ${s.label}` : `사주 결과에서 나온 관계 이야기: ${PATTERN_LINE[s.key]}`;

// 여는 말(모델 호출 0 · 질문 0): 결과 종류만 짚고, 적고 싶을 때 적으면 된다고 알린다.
export function refOpener(s: RefSeed): string {
  const head = s.kind === "card" ? `「${s.label}」 카드를 골랐네요.` : `사주에서는 ${PATTERN_LINE[s.key]}으로 나왔어요.`;
  return `${head} 떠오르는 게 있으면 편하게 적어 주세요. 읽기만 하고 끝내도 괜찮아요.`;
}

// 질문을 직접 청한 말(이번 요청 한 번만 허용) · 그만/질문 싫음(모델 호출 0)
// Codex P2(4187055577): 질문을 「청하는」 말끝일 때만(말 전체의 끝) — 「친구가 질문을 하나 해줘서 고마웠어」「그 사람이 물어봐서 당황했어」 같은 이야기는 청한 것이 아니다.
// Codex P2(4187134611): 서술 꼴(「질문을 해」「질문을 해요」「늘 물어봐」)은 빼고, 청하는 꼴만(해 줘·해 주세요·해 줄래·해 봐·던져 줘·부탁해·물어봐 줘·물어 줘).
const ASK = /(질문\s*(을|좀|을\s*좀)?\s*(하나|한\s*개|한\s*가지)?\s*(해\s*줘|해\s*주세요|해\s*줄래|해\s*봐|던져\s*줘|던져\s*봐|던져\s*주세요|부탁(해|해요|합니다|드려요))|(뭐\s*(라도)?\s*)?물어\s*(봐\s*줘|봐\s*주세요|봐\s*줄래|줘|주세요|줄래))\s*(요)?[\s.!?~…ㅎ]*$/;
// Codex P2(4186700786): 「그만」을 아무 데서나 잡으면 「친구가 그만 만나자고 해서 속상해」「일을 그만두고 싶어」 같은 이야기를 멈춤으로 읽는다 →
//   (1) 질문을 멈춰 달라는 말(질문 하지 마·질문 그만·묻지 마 …)은 어디에 있어도 · (2) 「그만」「여기까지」는 말 전체가 멈춤일 때만(짧은 한마디).
// Codex P2(4187134621): 질문을 멈춰 달라는 말도 말 전체의 끝일 때만 — 「친구가 "질문하지 마"라고 해서 당황했어」처럼 따온 말은 이야기다.
const STOP_ASK = /(질문\s*(은|좀|을)?\s*(하지\s*마(요|세요|줘)?|그만(\s*(해|해요|하세요|해\s*줘|해\s*주세요|할래|하자))?|싫어(요)?|말아\s*(줘|주세요)|없이\s*(해\s*줘|가자|할래))|묻지\s*마(요|세요)?|안\s*물어\s*봐도\s*(돼|돼요|괜찮아(요)?))[\s.!~…ㅎ"”』」]*$/;
const STOP_ALL = /^(이제\s*|오늘은\s*|그럼\s*|아니\s*)?(그만|여기까지)(\s*(할래|하자|할게|해|요|할게요|할래요|하고\s*싶어|할\s*래|만))?(\s*(요|할래|하자))?[\s.!~…ㅎㅠ]*$/;
const stopText = (t: string) => t.trim().replace(/\s+/g, " ");
// 서버 검수(P2): 공백을 먼저 한 칸으로 줄여서 정규식 되짚기(긴 공백 입력)를 막는다.
export const wantsStop = (t: string) => { const c = stopText(t); return STOP_ASK.test(c) || STOP_ALL.test(c); };
export const asksQuestion = (t: string) => ASK.test(stopText(t)) && !wantsStop(t);
// 위기 신호(제품 기준 「위기 신호면 분석·질문을 멈추고 안전 안내」) — 흔한 과장 말(「배고파 죽겠어」)은 잡지 않는다.
const CRISIS = /(죽고\s*싶|자살|목숨을?\s*끊|사라지고\s*싶|살기\s*싫|살고\s*싶지\s*않|자해|극단적\s*(선택|생각)|죽어\s*버리고\s*싶)/;
export const crisisSignal = (t: string) => CRISIS.test(t.replace(/\s+/g, " "));
export const CRISIS_LINE = "적어 준 말이 마음에 걸려요. 혼자 견디지 않아도 돼요. 자살예방상담전화 109(24시간)나 정신건강위기상담 1577-0199에서 지금 바로 이야기를 들어 줄 수 있어요. 위급하면 112나 119에 연락해 주세요.";
export const STOP_LINE = "알겠어요. 더 묻지 않을게요. 적고 싶은 게 생기면 그때 적어 주세요.";

export const REF_SYSTEM = `너는 ECHO 야. 사용자가 사주나 타로 결과를 본 뒤 편하게 이야기하는 자리야. 다음 JSON 하나만 출력해. 다른 설명은 붙이지 마.
{"reply": "1~3문장 · 사용자가 방금 한 말에 짧게 공감하거나 요약하거나 생각거리를 하나 건넨다", "question": "allow_question 이 true 일 때만 지금 이야기에 맞는 짧은 질문 한 문장 · 아니면 빈 문자열"}

규칙:
- 한국어로, 부드럽게 답해.
- allow_question 이 false 이면 질문하지 마. reply 에도 물음표·「~해요?」 같은 질문 문장을 넣지 마.
- allow_question 이 true 이면 사용자가 「ECHO 에게서 질문을 하나 받고 싶다」고 청한 것이다. 사용자에게 「물어봐 주세요」처럼 되돌리지 말고, question 에 지금 이야기(ref·history·latest)에 맞는 짧은 질문 한 문장을 반드시 쓴다. reply 는 짧은 한마디(물음표 없이).
- 사용자가 직접 한 말에만 응답해. 카드·사주(ref)만 보고 성격·감정·관계를 단정하지 마(ref 는 참고일 뿐이야).
- 미래·결혼·건강·투자를 단정하지 마. 상담·진단처럼 말하지 마.
- 사용자에게 무엇을 하라고 시키거나 다음 단계를 재촉하지 마.`;

// Codex P2(4187208770): 「~해 주실래요.」 「~줄래요.」 「~주시겠어요.」처럼 청하는 말끝도 물음이다 — 「래요」 전체(「좋대요·간대요」 같은 서술)는 빼지 않는다.
// Codex P2(4187504452): 높임 권유 말끝(「~해 보시겠어요.」 「~보실래요.」)도 물음 — 「시겠어요·실래요」는 서술로 거의 쓰지 않는다.
// Codex P2(4187324620): 「~해 볼래요.」 「~할래요.」 같은 권하는 말끝도 물음 — 「갈래요·래요·대요」 전체는 그대로 둔다.
const QUESTION_END = /(까요|나요|어때요|어떤가요|주실래요|줄래요|주시겠어요|주겠어요|볼래요|할래요|시겠어요|실래요|실까요)\s*[.!]?\s*$/; // 물음표 없이 끝낸 물음 꼴(「~할까요.」) — 「가요」「래요」 같은 서술 끝은 빼지 않는다
// Codex P2(4186700779): 물음표 없는 의문사 물음(「무슨 일이 있었어요.」 「뭐가 제일 힘들었어요」)도 질문이다 —
//   의문사가 있고, 그것이 안긴 말(「~는지 · ~은지 · ~인지 · ~을지」 = 「무슨 일이 있었는지 적어도 돼요」)이 아니면 물음으로 본다.
//   「어떤」은 「어떤 날도 있어요」처럼 서술에 흔해 빼고, 「언제든 · 뭐든 · 누구나 · 왜냐하면」 같은 꼴도 의문사가 아니다.
const WH = /(?<![가-힣])(무슨|뭐(?!든|라도|니\s*뭐니)|뭘|무엇(?!이든)|누구(?!든|나)|누가|언제(?!든|나)|어디(?!든|서든|에서든)|어떻게|왜(?!냐|냐하면)|얼마나)/;
// 안긴 말 = 받침이 ㄴ·ㄹ 인 글자 바로 뒤의 「지」(는지·은지·인지·그런지·을지·할지·던지 …). 「같지·먹지」(받침 ㅌ·ㄱ)는 아님.
const embedded = (t: string) => [...t.matchAll(/([가-힣])지/g)].some((m) => { const jong = (m[1].charCodeAt(0) - 0xac00) % 28; return jong === 4 || jong === 8; });
// Codex P2(4186974033): 안긴 말 예외는 그 의문사에만 — 의문사마다 「그 의문사부터 다음 의문사 앞까지」에 안긴 말이 있는지 따로 본다.
//   「무슨 일이 있었는지 모르겠지만 지금 뭐가 힘들어요.」 = 「무슨 … 있었는지」는 안긴 말 · 「뭐가 힘들어요」는 물음 → 문장 전체가 물음.
const WH_ALL = new RegExp(WH.source, "g");
const whQuestion = (t: string) => {
  const hits = [...t.matchAll(WH_ALL)].map((m) => m.index ?? 0);
  return hits.some((at, i) => !embedded(t.slice(at, hits[i + 1] ?? t.length)));
};
const sentences = (t: string) => t.split(/(?<=[.!?？。…])\s+/).map((s) => s.trim()).filter(Boolean);

// 모델 답 → 화면 모양. 질문을 끈 동안 물음 문장은 뺀다 · 남는 게 없으면 null(가짜 성공 0).
export function parseRef(raw: string, allowQuestion: boolean): RefReply | null {
  const o = parseJson(raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const reply = (typeof o.reply === "string" ? o.reply : "").trim();
  const kept = sentences(reply).filter((s) => !/[?？]/.test(s) && !QUESTION_END.test(s) && !whQuestion(s));
  const body = kept.join(" ").trim();
  if (!body || body.length > 400) return null;
  let question: string | null = null;
  if (allowQuestion) {
    const q = (typeof o.question === "string" ? o.question : "").trim();
    // 한 문장 · 물음표 하나로 끝남 · 짧게
    if (q && q.length <= 80 && /[?？]\s*$/.test(q) && (q.match(/[?？]/g) ?? []).length === 1 && sentences(q).length === 1) question = q;
    // QA 실서버(v106): 「질문 하나 해줘」에 질문 없이 「편하게 물어봐 주세요」만 옴 → 청한 질문이 없으면 성공으로 넘기지 않는다(가짜 성공 0 · 앱은 다시 보내기)
    if (!question) return null;
  }
  return { reply: body, question };
}

export async function refTalk(seed: RefSeed, history: RefLine[], text: string, allowQuestion: boolean, llm: Llm, obs: Obs): Promise<RefReply | null> {
  const raw = await call(llm, obs, "ref_talk", REF_SYSTEM, { ref: seedText(seed), history, latest: text, allow_question: allowQuestion });
  return parseRef(raw, allowQuestion);
}

// ── 2026-10-06 대표 승인 「사주·타로 정정 → 매칭 사용」(B): 결과 해석을 부정하고 「자기 말」로 고친 문장만 뽑는다(AI 호출 0 · 해석 글은 재료 0).
//   - 머리말(아닌데 · 그건 아니고 · 실제로는 · 사주(카드)는 그렇다는데 …)을 떼고 남은 사용자 글자 그대로 · 한글 6자 이상 · 물음 아님 · 120자 이하.
//   - 위기 신호·연락처·성적 표현·민감 주제(건강·성·돈)는 후보로 내지 않는다(되풀이 금지 · 프로필에 올리지 않음).
//   - 이 단계에서는 저장 0. 화면이 「이 말, 내 프로필에도 반영할까요?」를 한 번 묻고 [반영할게요]를 누를 때만 agent_ref_fix 가 저장한다.
const REF_FIX_LEAD = /^\s*(음+|흠+|아+|어+)?[\s,.]*(사주(는|에선|에서는|로는)?|카드(는|에선|에서는|로는)?|그\s*(해석|풀이|결과)(은|는)?)?\s*(그렇다(는데|지만|고\s*해도)|그렇게\s*(나왔|말하)(는데|지만)|그렇게\s*보일\s*수\s*있(는데|지만))?[\s,.]*(아니(요|야|에요|거든요?)?|아냐|아닌데(요)?|그게\s*아니(라|고|야|에요)?|그건\s*아니(라|고|야|에요)?|전혀\s*아니(야|에요|고|라)?|안\s*맞(아|아요|는데|는\s*것\s*같아)|틀렸(어|어요|네|네요)?|실제로는|사실은|저는\s*오히려|나는\s*오히려|오히려)[\s,.!~…]*/;
const REF_FIX_SEXUAL = /섹스|성관계|원나잇|조건\s*만남|성매매|야한\s*사진|몸\s*사진|노콘/; // doit-connect·doit-understanding 의 저장 금지 성적 표현과 같은 목록
const REF_FIX_SENSITIVE = /(건강|병원|질병|진단|우울|공황|정신과|임신|성생활|돈|빚|대출|연봉|월급|재산|파산|신용)/;
export const REF_FIX_MAX = 120;
export function refFixCandidate(text: string, privateData: RegExp): string | null {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  const m = t.match(REF_FIX_LEAD);
  if (!m || !m[0] || !/(아니|아냐|아닌데|안\s*맞|틀렸|실제로는|사실은|오히려)/.test(m[0])) return null;
  const rest = t.slice(m[0].length).trim().replace(/^[,.\s]+/, "");
  if ((rest.match(/[가-힣]/g) ?? []).length < 6 || rest.length > REF_FIX_MAX) return null;
  if (/[?？]/.test(rest) || QUESTION_END.test(rest) || whQuestion(rest)) return null;
  if (crisisSignal(rest) || privateData.test(rest) || REF_FIX_SEXUAL.test(rest) || REF_FIX_SENSITIVE.test(rest)) return null;
  return rest;
}
export const refFixReceipt = (seed: RefSeed, fix: string) => `${seed.kind === "card" ? "카드" : "사주"}보다 당신 말이 맞아요. 「${fix}」, 이렇게 기억할게요.`;
export const REF_FIX_ASK = "이 말, 내 프로필에도 반영할까요?";
