// 소개글 AI 초안(2026-09-23 대표 "소개글 적을 때 5가지 질문 대답으로 AI가 대신 작성하기 버튼").
// 서버(doit-understanding profile_draft v14.1)가 이번 회차의 내 답 + 맞다고 한 말 + 고른 목적으로만 문장을 만든다.
// 여기서는 문장을 만들거나 고치지 않고, 줄을 이어 소개란 한 칸으로 만든다. 저장은 사용자가 「소개 저장」을 눌러야 된다.
import { createCoreConversation, type CoreDraftLine } from '@/doit/lib/coreConversation';
import { understandingRequest } from '@/doit/lib/understandingApi';
import { withTimeout } from '@/doit/lib/withTimeout';

export const INTRO_MAX = 200; // 소개란 글자 상한(ProfileBuild maxLength · 서버 LIMITS.INTRO_MAX 와 같다)
// AI 가 쓰는 데 걸리는 시간 상한. 서버 생성 상한(20초)보다 조금 길게 기다린다. 넘으면 「다시 눌러 주세요」.
export const INTRO_DRAFT_WAIT_MS = 30_000;

export function draftToIntro(lines: readonly CoreDraftLine[]): string {
  return lines.map((line) => line.text.trim()).filter(Boolean).join(' ').slice(0, INTRO_MAX);
}

export async function requestIntroDraft(userId: string): Promise<string> {
  // profile_draft 는 아무것도 저장하지 않으므로 재시도용 요청 번호 없이 보낸다(읽기와 같은 길).
  const send = <T,>(body: Record<string, unknown>) => understandingRequest<T>(body, userId);
  const api = createCoreConversation({ read: send, write: send });
  const lines = await withTimeout(api.profileDraft(), INTRO_DRAFT_WAIT_MS, 'profile_draft');
  return draftToIntro(lines);
}
