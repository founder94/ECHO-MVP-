import { useState } from 'react';
import { AGENT_TONES, DEFAULT_AGENT_TONE, type AgentMode, type AgentTone } from '@/doit/lib/agentApi';
import { canSpeak, type AgentChoice } from '@/doit/lib/agentChoice';
import './agent-choice.css';

// 「시작하기」 직후 한 번 뜨는 무채색 선택창(대표 「UI FINAL LOCK」·「DESIGN / HERO / SYMBOL FINAL LOCK」 2026-09-25).
// 이 창 하나만 흑백이다. 뒤 화면(히어로 우주 배경·대화 화면 컬러)은 덮개 없이 그대로 보이고 움직인다. 스크롤도 잠그지 않는다.
// 히어로와 대화 화면이 같은 부품을 쓴다(선택창이 두 모양이 되지 않게).

export default function AgentChoiceLayer({ onConfirm, onClose, initial }: { onConfirm: (choice: AgentChoice) => void; onClose?: () => void; initial?: Partial<AgentChoice> }) {
  const [mode, setMode] = useState<AgentMode>(initial?.mode ?? 'TEXT');
  const [tone, setTone] = useState<AgentTone>(initial?.tone ?? DEFAULT_AGENT_TONE);
  const option = (selected: boolean) => (selected ? 'echo-choice-option is-selected' : 'echo-choice-option');
  return <div className="echo-choice-layer" role="dialog" aria-modal="true" aria-labelledby="echo-choice-title" onClick={event => { if (onClose && event.target === event.currentTarget) onClose(); }}>
    <div className="echo-choice-card">
      <p id="echo-choice-title" className="echo-choice-title">어떻게 이야기할까요?</p>
      <p className="echo-choice-label">대화 방식</p>
      <div className="echo-choice-options" role="radiogroup" aria-label="대화 방식">
        <button type="button" role="radio" aria-checked={mode === 'TEXT'} className={option(mode === 'TEXT')} onClick={() => setMode('TEXT')}>글로 대화하기</button>
        <button type="button" role="radio" aria-checked={mode === 'VOICE'} className={option(mode === 'VOICE')} onClick={() => setMode('VOICE')}>말로 대화하기</button>
      </div>
      {mode === 'VOICE' && <p className="echo-choice-note">{canSpeak() ? '말할 때는 휴대폰 키보드의 마이크를 눌러 주세요. 말한 내용은 글자로 보내지고, ECHO 대답은 소리로 읽어 드려요. 목소리는 저장하지 않아요.' : '이 기기에서는 소리로 읽을 수 없어요. 글로 이어 갈게요.'}</p>}
      <p className="echo-choice-label">말투</p>
      <div className="echo-choice-options" role="radiogroup" aria-label="말투">
        {AGENT_TONES.map(t => <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} className={option(tone === t.id)} onClick={() => setTone(t.id)}>{t.label}</button>)}
      </div>
      <button type="button" className="echo-choice-confirm" onClick={() => onConfirm({ tone, mode })}>이렇게 시작하기</button>
      {onClose && <button type="button" className="echo-choice-close" onClick={onClose}>닫기</button>}
    </div>
  </div>;
}
