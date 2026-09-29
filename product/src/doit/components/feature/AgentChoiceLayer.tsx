import { useState } from 'react';
import { AGENT_TONES, DEFAULT_AGENT_TONE, type AgentMode, type AgentTone } from '@/doit/lib/agentApi';
import { canSpeak, type AgentChoice } from '@/doit/lib/agentChoice';
import './agent-choice.css';

// 「시작하기」 직후 한 번 뜨는 무채색 선택창(대표 「UI FINAL LOCK」·「DESIGN / HERO / SYMBOL FINAL LOCK」·「POST-CLAUDE FINAL MASTER」 2026-09-25).
// 이 창 하나만 흑백이다. 뒤 화면(히어로 우주 배경·대화 화면 컬러)은 덮개 없이 그대로 보이고 움직인다. 스크롤도 잠그지 않는다.
// MASTER §4: 주요 버튼은 [말로 시작하기] [글로 시작하기] 두 개 — 누르면 바로 시작한다. 말투는 기본 「편한 존댓말」이고 필요할 때만 펼친다.
// 히어로와 대화 화면이 같은 부품을 쓴다(선택창이 두 모양이 되지 않게).
export default function AgentChoiceLayer({ onConfirm, onClose, initial }: { onConfirm: (choice: AgentChoice) => void; onClose?: () => void; initial?: Partial<AgentChoice> }) {
  const [tone, setTone] = useState<AgentTone>(initial?.tone ?? DEFAULT_AGENT_TONE);
  const [toneOpen, setToneOpen] = useState(false);
  const toneLabel = AGENT_TONES.find(t => t.id === tone)?.label ?? '';
  const go = (mode: AgentMode) => onConfirm({ tone, mode });
  return <div className="echo-choice-layer" role="dialog" aria-modal="true" aria-labelledby="echo-choice-title" onClick={event => { if (onClose && event.target === event.currentTarget) onClose(); }}>
    <div className="echo-choice-card">
      <p id="echo-choice-title" className="echo-choice-title">당신의 결을 알려주세요.<br />5번의 대화면 충분합니다.</p>
      <div className="echo-choice-starts">
        <button type="button" className="echo-choice-confirm" onClick={() => go('VOICE')}>말로 시작하기</button>
        <button type="button" className="echo-choice-confirm is-secondary" onClick={() => go('TEXT')}>글로 시작하기</button>
      </div>
      {!canSpeak() && <p className="echo-choice-note">이 기기에서는 ECHO 대답을 소리로 읽을 수 없어요. 말로 시작해도 글로 이어 갈게요.</p>}
      <p className="echo-choice-note">말할 때는 휴대폰 키보드의 마이크를 눌러 주세요. 목소리는 저장하지 않아요.</p>
      <button type="button" className="echo-choice-tone" aria-expanded={toneOpen} aria-controls="echo-choice-tones" onClick={() => setToneOpen(v => !v)}>말투 · {toneLabel} <span aria-hidden="true">{toneOpen ? '▴' : '▾'}</span></button>
      {toneOpen && <div id="echo-choice-tones" className="echo-choice-options" role="radiogroup" aria-label="말투">
        {AGENT_TONES.map(t => <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} className={tone === t.id ? 'echo-choice-option is-selected' : 'echo-choice-option'} onClick={() => setTone(t.id)}>{t.label}</button>)}
      </div>}
      {onClose && <button type="button" className="echo-choice-close" onClick={onClose}>닫기</button>}
    </div>
  </div>;
}
