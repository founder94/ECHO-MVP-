// 기억 영수증 · 「ECHO가 아는 나」(2026-10-06 대표 승인 「기억하는 AI」 A).
// - 영수증: 서버가 정정을 저장한 뒤에만 고정 문장 한 줄(AI 호출 0). 저장 실패면 응답 자체가 오류라 영수증이 나가지 않는다.
// - 「ECHO가 아는 나」: 지금 상태를 네 묶음으로(내가 확인한 것 · AI 짐작 · 내가 고친 것 · 아니라고 한 것). 줄마다 지우기(아니라고 한 것은 다시 단정하지 않으려고 남긴다).
// - 민감 주제(건강·성·돈)는 문장을 되풀이하지 않는다(영수증은 일반 문장 · 화면은 가린 줄).
import type { AgentState, Item } from "./agent.ts";

const PURPOSES = ["relationship_intent", "attraction_comfort", "values_character", "relationship_style", "boundaries"] as const;

// 되풀이하지 않을 주제(건강·성·돈) — 문장을 보여 주지 않을 뿐, 지우기는 그대로 된다.
export const SENSITIVE = /(건강|병원|질병|진단|약을?\s*먹|복용|우울|공황|불안장애|정신과|상담\s*치료|임신|성관계|섹스|성적|성생활|야한|돈|빚|대출|연봉|월급|재산|수입|파산|신용)/;
export const isSensitive = (t: unknown) => SENSITIVE.test(String(t ?? ""));

// 받침 여부로 조사 고르기(한글이 아니면 받침 없음으로 본다).
const lastHangul = (w: string) => { const c = w.trim().replace(/[.!?~…」』"')\s]+$/, "").slice(-1); const code = c.charCodeAt(0) - 0xac00; return code >= 0 && code < 11172 ? code % 28 : -1; };
export const ga = (w: string) => (lastHangul(w) > 0 ? "이" : "가");
export const ro = (w: string) => { const j = lastHangul(w); return j > 0 && j !== 8 ? "으로" : "로"; }; // 받침 ㄹ(8)은 「로」

export const RECEIPT_MAX = 30; // 영수증에 넣는 한 값의 글자 상한(길면 줄인다 · 줄인 표시 「…」)
const cut = (t: string) => { const s = t.trim().replace(/\s+/g, " "); return s.length > RECEIPT_MAX ? `${s.slice(0, RECEIPT_MAX - 1)}…` : s; };

export interface Receipt { before: string | null; after: string; line: string }

/** 이번 턴(turnN)에 사용자가 고쳐서 새로 남은 값(USER_CORRECTED · 지금 사실)으로 영수증 한 줄. 없으면 null. */
export function correctionReceipt(st: AgentState, turnN: number | undefined | null): Receipt | null {
  if (typeof turnN !== "number") return null;
  const fresh: Item[] = PURPOSES.flatMap((id) => (st.slots[id]?.items ?? []).filter((i) => i.turn === turnN && i.status === "CONFIRMED" && i.source_type === "USER_CORRECTED"));
  if (!fresh.length) return null;
  const pick = fresh.find((i) => (i.corrected_from ?? []).length) ?? fresh[0];
  const after = cut(pick.note);
  const before = pick.corrected_from?.length ? cut(pick.corrected_from[0]) : null;
  if (!after) return null;
  if (isSensitive(after) || (before && isSensitive(before))) return { before: null, after: "", line: "알겠어요. 고친 내용으로 기억할게요." };
  const line = before ? `알겠어요. 「${before}」${ga(before)} 아니라 「${after}」${ro(after)} 기억할게요.` : `알겠어요. 「${after}」${ro(after)} 기억할게요.`;
  return { before, after, line };
}

/** 정정 뒤 다음 질문이 고친 말을 짚었는지(관측만 · 질문을 바꾸지 않는다). */
export function fixCited(receipt: Receipt | null, question: string | null): boolean | null {
  if (!receipt || !receipt.after || !question) return null;
  const words = receipt.after.split(/[\s,.!?~…·]+/).map((w) => w.replace(/[^가-힣A-Za-z0-9]/g, "")).filter((w) => w.length >= 2);
  return words.some((w) => question.includes(w.slice(0, 2)));
}

const FORGOTTEN_MAX = 30; // 지운 짐작을 기억해 두는 개수 상한(상태 크기 보호)

export type MemoryBucket = "confirmed" | "guessed" | "corrected" | "rejected";
export interface MemoryLine { id: string; text: string; hidden: boolean; can_forget: boolean }
export interface MemoryView { confirmed: MemoryLine[]; guessed: MemoryLine[]; corrected: MemoryLine[]; rejected: MemoryLine[] }

const itemId = (purpose: string, k: number, i: Item) => `i:${purpose}:${i.turn}:${k}`;
const line = (id: string, text: string, canForget: boolean): MemoryLine => isSensitive(text) ? { id, text: "", hidden: true, can_forget: canForget } : { id, text, hidden: false, can_forget: canForget };

/** 지금 상태를 네 묶음으로. 내가 지운 줄(user_forget)은 어디에도 보이지 않는다. */
export function memoryView(st: AgentState): MemoryView {
  const v: MemoryView = { confirmed: [], guessed: [], corrected: [], rejected: [] };
  const seenRejected = new Set<string>();
  const addRejected = (id: string, text: string) => { const k = text.replace(/\s+/g, ""); if (!k || seenRejected.has(k)) return; seenRejected.add(k); v.rejected.push(line(id, text, false)); };
  for (const p of PURPOSES) {
    (st.slots[p]?.items ?? []).forEach((i, k) => {
      const id = itemId(p, k, i);
      if (i.source === "user_forget") return;
      if (i.status === "CONFIRMED") {
        const t = i.source_type ?? (i.source === "answer_raw" ? "USER_DIRECT" : "AI_EXTRACTED");
        if (t === "USER_CORRECTED") v.corrected.push(line(id, i.note, true));
        else if (t === "AI_EXTRACTED" || t === "AI_INFERRED" || t === "PHOTO_INFERRED") v.guessed.push(line(id, i.note, true));
        else v.confirmed.push(line(id, i.note, true));
      } else if (i.status === "RETRACTED" || i.status === "DISPUTED" || i.status === "SUPERSEDED") addRejected(id, i.note);
    });
  }
  (st.inferred ?? []).forEach((t, k) => v.guessed.push(line(`t:${k}`, t.trait, true)));
  (st.disputed ?? []).forEach((d, k) => addRejected(`d:${k}`, d));
  return v;
}

/** 줄 하나 지우기. 지운 값은 지금 사실·매칭·소개 재료에서 빠지고, AI 가 같은 뜻으로 다시 정리해도 올리지 않는다. 지울 수 없는 줄이면 false. */
export function forgetMemory(st: AgentState, id: string): boolean {
  const m = /^i:([a-z_]+):(\d+):(\d+)$/.exec(id);
  if (m) {
    const [, p, turn, k] = m;
    if (!(PURPOSES as readonly string[]).includes(p)) return false;
    const i = st.slots[p]?.items[Number(k)];
    if (!i || i.turn !== Number(turn) || i.status !== "CONFIRMED" || i.source === "user_forget") return false;
    i.status = "RETRACTED"; i.rejected_at = new Date().toISOString(); i.source = "user_forget";
    if (!st.slots[p].items.some((x) => x.status === "CONFIRMED") && st.slots[p].status === "CONFIRMED") st.slots[p].status = "UNKNOWN";
    return true;
  }
  const t = /^t:(\d+)$/.exec(id);
  if (t) {
    const k = Number(t[1]); const gone = st.inferred?.[k]; if (!gone) return false;
    st.inferred.splice(k, 1);
    st.forgotten_traits = [...(st.forgotten_traits ?? []), gone.trait].slice(-FORGOTTEN_MAX); // AI 가 같은 짐작을 다시 내도 올리지 않게 남긴다(글 그대로 · 화면에는 보이지 않음)
    return true;
  }
  return false;
}
