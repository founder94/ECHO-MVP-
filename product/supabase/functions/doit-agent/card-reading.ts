// 카드 읽기(타로 해석) — 대화 상태·프로필·매칭과 분리된 모듈. 대화 서버(agent.ts)·매칭 계약(matching.ts)은 이 모듈을 모른다(core-preservation 검사).
import { call, parseJson, PRIVATE_DATA, type Llm, type Obs } from "./agent.ts";
type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
// ── 2026-10-05 대표 「타로 해석 실패 이유를 알아내서 최종 완성」 · Codex echo-spec 20261005 카드 해석 A:
//   QA 에는 예전 openai-chat 함수가 없어 해석이 늘 실패했다 → 해석을 ECHO 서버(로그인 · 하루 한도 · 자리 잡기 · 사용 기록)로 옮긴다.
//   받는 것 = 카드 이름 + 관계 목적 글(선택) 뿐. 대화 상태·프로필·매칭에는 아무것도 넣지 않는다(카드 의미 = 사용자 사실 0).
//   지시문은 예전 openai-chat 의 타로 지시와 같은 형식(summary · tags 3 · cards 3)이다 — 화면은 그대로 쓴다.
export const TAROT_SYSTEM = `너는 타로 카드 리더야. 선택된 카드와 관계 목적을 바탕으로 오늘의 흐름을 부드럽게 해석해줘. 각 응답은 다음 JSON 형식만 정확히 출력해. 다른 설명은 절대 붙이지 마.

{
  "summary": "오늘의 흐름을 부드럽게 해석한 2~3문장. 미래를 단정하지 않는 톤.",
  "tags": ["핵심 키워드 3개"],
  "cards": [
    { "label": "현재의 에너지", "value": "카드 의미 한 문장" },
    { "label": "흐름의 방향", "value": "관계 관점 해석 한 문장" },
    { "label": "놓치지 말 것", "value": "기억하면 좋을 점 한 문장" }
  ]
}

규칙:
- 한국어로 답해.
- 미래·결혼·건강·투자를 단정하지 마.
- 사용자의 성격이나 감정을 단정하지 마(카드는 참고일 뿐이야).
- 참고로 봐달라는 따뜻한 톤을 유지해.`;
export interface CardReading { summary: string; tags: string[]; cards: { label: string; value: string }[] }
export const TAROT_CARD_MAX = 50, TAROT_PURPOSE_MAX = 200;
export function cardInput(card: unknown, purpose: unknown): { card: string; purpose: string } | null {
  const c = typeof card === "string" ? card.trim() : "", p = typeof purpose === "string" ? purpose.trim() : "";
  if (!c || c.length > TAROT_CARD_MAX || p.length > TAROT_PURPOSE_MAX || PRIVATE_DATA.test(p)) return null;
  return { card: c, purpose: p };
}
// 모델 답 → 화면 모양. 형식이 다르면 null(가짜 성공 0).
export function parseCard(raw: string): CardReading | null {
  const o = parseJson(raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const summary = str(o.summary);
  if (!summary || summary.length > 500) return null;
  const tags = Array.isArray(o.tags) ? o.tags.map(str).filter((t) => t && t.length <= 20).slice(0, 3) : [];
  const cards = Array.isArray(o.cards) ? o.cards.map((c) => (c && typeof c === "object" ? { label: str((c as Json).label), value: str((c as Json).value) } : null))
    .filter((c): c is { label: string; value: string } => !!c && !!c.label && !!c.value && c.label.length <= 50 && c.value.length <= 300).slice(0, 3) : [];
  // Codex P2(4186782787): 화면 모양 = 키워드 3개 · 카드 줄 3개 — 덜 오면 성공으로 보관하지 않는다(가짜 성공·덜 찬 해석 보관 0)
  if (tags.length !== 3 || cards.length !== 3) return null;
  return { summary, tags, cards };
}
export async function readCard(card: string, purpose: string, llm: Llm, obs: Obs): Promise<CardReading | null> {
  const raw = await call(llm, obs, "card_reading", TAROT_SYSTEM, { card, purpose: purpose || "정하지 않음" });
  return parseCard(raw);
}
