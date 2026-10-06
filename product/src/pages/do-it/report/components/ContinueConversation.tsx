// 2026-09-17: 리포트를 본 뒤에도 같은 맥락으로 대화를 잇는 화면.
// 서버 규칙: 완료 상태(report_ready·report_done)는 그대로 두고 step 8 메시지로만 쌓는다(가짜 되돌림 없음).
// 답변은 먼저 저장하고(save-first), 다음 ECHO 턴은 별도 요청으로 받는다. 구매자만 사용할 수 있다(서버가 판정).
import { useRef, useState } from 'react';
import { GHOST_BUTTON, PRIMARY_BUTTON } from '@/pages/do-it/components/sceneStyles';
import { JourneySaveController } from '@/lib/echo/journeySave';
import {
  REQUEST_TIMEOUT_MESSAGE,
  askJourneyQuestion,
  newRequestToken,
  submitJourneyAnswer,
  type FlowState,
} from '@/lib/echo/api';

const ANSWER_MAX = 500;
const TURN_FAILED_MESSAGE = 'ECHO가 답을 만들지 못했어요. 잠시 후 다시 눌러 주세요.';

interface Props {
  conversationId: string;
  /** 서버가 알려준 열린 턴(질문이거나, 내 물음에 답만 한 턴). */
  initialTurn: string;
  /** 열린 턴이 없어 새로 받아야 하는 상태. */
  initialNeedsTurn: boolean;
  /** 로그인 만료 등 계속할 수 없는 응답은 상위 화면이 처리한다. */
  onUnavailable: (state: FlowState) => void;
}

type Entry = { role: 'echo' | 'me'; text: string };

export default function ContinueConversation({ conversationId, initialTurn, initialNeedsTurn, onUnavailable }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(initialTurn ? [{ role: 'echo', text: initialTurn }] : []);
  const [needsTurn, setNeedsTurn] = useState(initialNeedsTurn);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const saverRef = useRef(
    new JourneySaveController<FlowState>({
      submit: (text, token) => submitJourneyAnswer(conversationId, text, token),
      newToken: newRequestToken,
    }),
  );

  const failed = (state: FlowState) => {
    if (state.reason === 'unauthorized' || state.reason === 'payment_required' || state.reason === 'not_configured') {
      onUnavailable(state);
      return;
    }
    setMessage(state.error ?? TURN_FAILED_MESSAGE);
  };

  // ECHO 의 다음 턴을 받아온다. 서버에 열린 턴이 이미 있으면 그대로 돌아온다(중복 생성 없음).
  const loadTurn = async () => {
    setBusy(true);
    setMessage('');
    const state = await askJourneyQuestion(conversationId, newRequestToken());
    setBusy(false);
    if (!state.ok) {
      failed(state);
      return;
    }
    const turn = (state.question ?? '').trim();
    if (!turn) {
      setMessage(TURN_FAILED_MESSAGE);
      return;
    }
    setEntries((previous) => (previous.at(-1)?.text === turn ? previous : [...previous, { role: 'echo', text: turn }]));
    setNeedsTurn(false);
  };

  const start = async () => {
    setOpen(true);
    if (needsTurn || entries.length === 0) await loadTurn();
  };

  const send = async () => {
    const text = answer.trim();
    if (!text || busy) return;
    setBusy(true);
    setMessage('');
    const outcome = await saverRef.current.save(text);
    setBusy(false);
    if (outcome.kind === 'busy' || outcome.kind === 'stale') return;
    if (outcome.kind === 'timeout') {
      setMessage(REQUEST_TIMEOUT_MESSAGE);
      return;
    }
    if (outcome.kind === 'failure') {
      failed(outcome.result);
      return;
    }
    // 저장이 끝난 뒤에만 화면에 남기고, 입력칸을 비운다.
    setEntries((previous) => [...previous, { role: 'me', text }]);
    setAnswer('');
    setNeedsTurn(true);
    await loadTurn();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => void start()} className={GHOST_BUTTON}>
        리포트를 보고 더 이야기하기
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-white/[0.06] border border-white/12 px-5 py-4">
      <p className="text-[11px] tracking-[0.3em] text-white/50 font-medium mb-3">리포트 이후 대화</p>

      <div className="flex flex-col gap-3 mb-3">
        {entries.map((entry, index) => (
          <div key={`${index}-${entry.role}`} className={entry.role === 'echo' ? 'text-left' : 'text-right'}>
            <p
              className={
                entry.role === 'echo'
                  ? 'text-[13.5px] leading-relaxed text-white/80 whitespace-pre-wrap'
                  : 'inline-block rounded-2xl bg-white/[0.1] px-4 py-2 text-[13.5px] leading-relaxed text-white whitespace-pre-wrap'
              }
            >
              {entry.text}
            </p>
          </div>
        ))}
        {busy && <p className="text-[12.5px] text-white/45">ECHO가 읽고 있어요...</p>}
      </div>

      <textarea
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          setMessage('');
        }}
        maxLength={ANSWER_MAX}
        placeholder="이어서 하고 싶은 말을 적어보세요."
        className="w-full min-h-[96px] rounded-2xl bg-white/[0.06] border border-white/15 px-4 py-3 text-[14px] text-white placeholder:text-white/35 resize-none focus:outline-none focus:border-white/30 transition-colors mb-2"
      />

      {message && <p className="text-[12.5px] text-red-300 mb-2">{message}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => void send()} disabled={busy || !answer.trim()} className={PRIMARY_BUTTON}>
          {busy ? '보내는 중...' : '보내기'}
        </button>
        {needsTurn && !busy && (
          <button type="button" onClick={() => void loadTurn()} className={GHOST_BUTTON}>
            다시 불러오기
          </button>
        )}
      </div>
    </div>
  );
}
