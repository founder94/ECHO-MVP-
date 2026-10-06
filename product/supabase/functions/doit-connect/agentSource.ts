// Matching Integration(2026-09-27 대표 「FINAL IMPLEMENTATION MASTER」 §26 · PHASE 10).
// 연결(doit-connect)은 ECHO Agent 가 서버에서 확정한 상태(agent_session profile · CONFIRMED)만 읽는다(DB 변경 0 · 대화 원문 turns 는 읽지 않음).
// 2026-10-01 FI-018(대표 「AGENT ↔ MATCHING CONTRACT」): 대화 준비(conversation_ready) 판단은 Agent 와 같은 함수 하나(doit-agent/agent.ts conversationReadiness)만 쓴다.
//   여기서 따로 세지 않는다(예전: 이 파일이 자기 규칙으로 칸을 셌고 Agent 는 답 수로 끝내 「대화는 끝났는데 자격 0」이 났다).
// 매칭에 쓰지 않는 것: AI 정리 단독(AI_EXTRACTED) · 추정(INFERRED) · 미확정 · 거절·교체(history) · 최신 정정보다 앞선 값 · 밀린 출처의 복제 · 사주·타로 결과.
import { conversationReadiness, CONVERSATION_READY_MIN_AREAS, READY_SOURCE_TYPES, READY_CONFIRMED_MAX, type ConversationReadiness } from "../doit-agent/agent.ts";

export interface AgentSessionRow { user_id: string; created_at: string | null; updated_at: string | null; profile: unknown; phase: unknown }
export interface AgentMatchSource { confirmed: string[]; corrected: string[]; confirmedAreas: number; finished: boolean; ready: boolean; sessionAt: string | null; readiness: ConversationReadiness }

export const AGENT_READY_MIN_CONFIRMED_AREAS = CONVERSATION_READY_MIN_AREAS;
export const AGENT_CONFIRMED_MAX = READY_CONFIRMED_MAX;
export const MATCH_SOURCE_TYPES = READY_SOURCE_TYPES;

/** agent_session 한 줄의 profile 에서 매칭 재료만 뽑는다(공통 계약 그대로). 틀린 모양이면 빈 재료(매칭에 쓰지 않음). */
export function sourceFromProfile(profile: unknown, phase: unknown, sessionAt: string | null): AgentMatchSource {
  const r = conversationReadiness(profile, phase);
  return { confirmed: r.confirmed, corrected: r.corrected, confirmedAreas: r.confirmed_areas, finished: r.finished, ready: r.conversation_ready, sessionAt, readiness: r };
}

/** 사용자마다 이번 회차(since 이후) 가장 최근 agent_session 하나로 매칭 재료를 만든다. */
export function agentSources(rows: AgentSessionRow[], sinceOf: (userId: string) => string | null): Map<string, AgentMatchSource> {
  const latest = new Map<string, AgentSessionRow>();
  for (const r of rows) {
    const at = r.updated_at ?? r.created_at; const since = sinceOf(r.user_id);
    if (since && at && Date.parse(at) < Date.parse(since)) continue;
    const prev = latest.get(r.user_id);
    if (!prev || Date.parse(at ?? "") > Date.parse(prev.updated_at ?? prev.created_at ?? "")) latest.set(r.user_id, r);
  }
  const out = new Map<string, AgentMatchSource>();
  for (const [uid, r] of latest) out.set(uid, sourceFromProfile(r.profile, r.phase, r.updated_at ?? r.created_at));
  return out;
}
