import { AGENT_TONES, type AgentMode, type AgentTone } from '@/doit/lib/agentApi';

// 「시작하기」 선택창에서 고른 대화 방식·말투(히어로 → 대화 화면으로 가져간다).
export interface AgentChoice { tone: AgentTone; mode: AgentMode }

// 기기 목소리(TTS) 도구는 voiceOutput.ts 한 곳에 둔다(선택창·히어로·대화 화면이 같은 것을 쓴다).
export { canSpeak, unlockSpeech } from './voiceOutput';

// 히어로에서 고른 것을 대화 화면까지 가져간다(로그인·목적 고르기를 거쳐도). 이 탭에서만(sessionStorage) · 한 번 쓰면 지운다.
const CHOICE_KEY = 'doit:agent-choice';
export function saveAgentChoice(choice: AgentChoice) { try { sessionStorage.setItem(CHOICE_KEY, JSON.stringify(choice)); } catch { /* 저장이 안 되면 대화 화면에서 한 번 더 고른다 */ } }
export function takeAgentChoice(): AgentChoice | null {
  try {
    const raw = sessionStorage.getItem(CHOICE_KEY);
    sessionStorage.removeItem(CHOICE_KEY);
    const o = raw ? JSON.parse(raw) as Partial<AgentChoice> : null;
    if (!o || !AGENT_TONES.some(t => t.id === o.tone) || (o.mode !== 'TEXT' && o.mode !== 'VOICE')) return null;
    return { tone: o.tone as AgentTone, mode: o.mode };
  } catch { return null; }
}
// 아이폰은 첫 소리를 사용자의 누름 안에서 시작해야 한다. 「말로」를 고른 그 누름에서 unlockSpeech() 로 소리 길을 열어 둔다(같은 문서 안 화면 이동이라 유지된다).
