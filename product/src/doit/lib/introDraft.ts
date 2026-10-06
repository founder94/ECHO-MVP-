// 소개글 AI 초안(2026-09-23 대표 "소개글 적을 때 5가지 질문 대답으로 AI가 대신 작성하기 버튼").
// 서버(doit-understanding profile_draft v14.1)가 이번 회차의 내 답 + 맞다고 한 말 + 고른 목적으로만 문장을 만든다.
// 여기서는 문장을 만들거나 고치지 않고, 줄을 이어 소개란 한 칸으로 만든다. 저장은 사용자가 「소개 저장」을 눌러야 된다.
import { createCoreConversation, type CoreDraftLine } from '@/doit/lib/coreConversation';
import { UnderstandingError, understandingRequest } from '@/doit/lib/understandingApi';
import { agentGet, agentIntro } from '@/doit/lib/agentApi';
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

// 2026-09-25 대표 MASTER §4 「AI가 대신 작성하기가 실제 소개를 만들지 못한다」: 운영 앱의 대화는 doit-agent 가 한다.
// 그 대화의 확인된 말로 쓴 초안(대화를 마칠 때 서버가 쓴 것)을 먼저 쓰고, 없으면 한 번 다시 쓴다(AI 1번). 결과: 문장 + 어느 대화에서 왔는지(출처 기록용).
export async function requestAgentIntroDraft(userId: string): Promise<{ text: string; sessionId: string }> {
  const session = await withTimeout(agentGet(userId), INTRO_DRAFT_WAIT_MS, 'agent_get');
  if (!session || session.phase !== 'done') throw new UnderstandingError('NOT_ENOUGH', '다섯 가지 이야기를 먼저 마쳐 주세요. 대화에서 들은 말로 소개를 써 드릴게요.');
  if (session.intro?.status === 'ready' && session.intro.text) return { text: session.intro.text.slice(0, INTRO_MAX), sessionId: session.id };
  if (session.intro?.status === 'none') throw new UnderstandingError('NOT_ENOUGH', '대화에서 소개를 쓸 만한 말이 아직 적어요. 직접 써도 되고, 대화를 이어가도 돼요.');
  const r = await withTimeout(agentIntro(userId, session.id), INTRO_DRAFT_WAIT_MS, 'agent_intro');
  if (r.session.intro?.status === 'ready' && r.session.intro.text) return { text: r.session.intro.text.slice(0, INTRO_MAX), sessionId: session.id };
  throw new UnderstandingError('AI_ERROR', 'AI가 지금은 소개를 쓰지 못했어요. 소개 칸에 직접 써도 돼요.');
}
