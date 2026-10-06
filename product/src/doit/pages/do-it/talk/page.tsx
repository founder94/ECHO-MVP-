import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { ECHO_AGENT_ENABLED, agentFreeTalk, agentHome, type FreeTalkStatus, type RefLine } from '@/doit/lib/agentApi';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import '@/doit/app/plan-a/screens/ref-talk.css';

// 「나를 기억하는 ECHO와 무엇이든 대화」(2026-10-06 대표 승인 C): 유료 자유 대화 화면.
// - 서버 스위치(FREE_TALK_ENABLED)가 꺼져 있으면 「아직 열리지 않았어요」만 보인다(화면이 켜지 않음 · 기본 꺼짐 · QA 포함).
// - 무료 = 정해진 흐름만. 여기서는 유료 권한 또는 맛보기(계정당 평생 3회)일 때만 답을 받는다. 횟수·권한은 서버가 센다(화면 셈 0).
// - 답 글은 서버에 남지 않는다(앞 줄 8개만 함께 보냄). AI 가 만든 답임을 화면에 표시한다. 모델 이름은 적지 않는다.
// - 결제 안내는 가격 숫자 0 · 재촉 0. 토스 심사 중이라 결제 버튼은 없다(권한 없음 = 안내 문장만).
type Line = RefLine & { ai?: boolean; guard?: boolean };
const AI_LABEL = 'ECHO의 답은 AI가 만들어요. 내가 확인하거나 고친 이야기만 기억하고, 다른 사람 정보는 모릅니다.';
const FAIL: Record<string, string> = {
  FREE_TALK_OFF: '자유 대화는 아직 열리지 않았어요.',
  TRIAL_USED: '맛보기를 다 썼어요. 이어서 이야기하려면 이용권이 필요해요. 지금은 준비 중이에요.',
  FREE_TALK_DAILY: '오늘 쓸 수 있는 자유 대화를 다 썼어요. 내일 다시 이어서 해요.',
  FREE_TALK_MONTH: '이번 달은 여기까지예요. 다음 달에 다시 이야기해요.',
  FREE_TALK_PROVIDER: '자유 대화는 아직 준비 중이에요.',
  PRIVATE_DATA: '연락처·번호·링크는 여기에 적지 않아요. 그 부분만 빼고 다시 적어 주세요.',
  AI_DAILY_LIMIT: '오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이어서 해 주세요.',
  AI_COMPANY_BUDGET: '지금은 이야기 기능을 잠시 멈췄어요. 적은 말은 그대로 있어요.',
  RATE_LIMITED: '요청이 몰렸어요. 조금 뒤에 다시 보내 주세요.',
};
const failText = (code?: string) => (code && FAIL[code]) || '답을 만들지 못했어요. 적은 말은 그대로 있어요.';

export default function TalkPage() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<FreeTalkStatus | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [lines, busy]);
  useEffect(() => {
    if (!userId || !ECHO_AGENT_ENABLED) return;
    let live = true;
    agentHome(userId).then((r) => { if (live) setStatus(r.free_talk); }).catch(() => { if (live) setStatus({ enabled: false }); });
    return () => { live = false; };
  }, [userId]);

  const send = async () => {
    const t = draft.trim();
    if (!t || busy || !userId) return;
    setBusy(true); setFail(null);
    try {
      const r = await agentFreeTalk(userId, lines.map(({ role, text }) => ({ role, text })), t);
      if (!alive.current) return;
      setLines((prev) => [...prev, { role: 'user', text: t }, { role: 'echo', text: r.reply, ai: r.ai, guard: !!r.guard }]);
      setDraft('');
      if (r.notice) setNotice(r.notice);
      if (r.trial_left !== null || r.entitled) setStatus((s) => ({ ...(s ?? { enabled: true }), enabled: true, entitled: r.entitled, trial_left: r.trial_left ?? s?.trial_left }));
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof UnderstandingError ? e.code : undefined;
      setFail(failText(code));
      if (code === 'TRIAL_USED') setStatus((s) => ({ ...(s ?? { enabled: true }), enabled: true, entitled: false, trial_left: 0 }));
    } finally { if (alive.current) setBusy(false); }
  };

  const off = !ECHO_AGENT_ENABLED || (status !== null && !status.enabled);
  const blocked = !!status && status.enabled && !status.entitled && (status.trial_left ?? 0) <= 0;
  return (
    <MobileLayout title="무엇이든 대화" back>
      <section className="echo-dialogue echo-dialogue--pastel echo-ref" aria-labelledby="echo-talk-title">
        <header className="echo-ref-head">
          <p className="echo-eyebrow">나를 기억하는 ECHO</p>
          <h1 id="echo-talk-title" className="echo-ref-title">나를 기억하는 ECHO와 무엇이든 대화</h1>
          <p className="echo-ref-note">{AI_LABEL}</p>
        </header>
        {loading ? <p className="echo-ref-line echo-ref-line--echo" role="status">불러오는 중이에요.</p>
          : !user ? <p className="echo-ref-line echo-ref-line--echo">로그인하면 이어서 이야기할 수 있어요. <Link to="/login" state={{ from: '/doit/talk' }}>로그인하기</Link></p>
          : off ? <p className="echo-ref-line echo-ref-line--echo" role="status">자유 대화는 아직 열리지 않았어요. 정해진 이야기는 <Link to="/doit/conversation">ECHO와 이야기</Link>에서 그대로 할 수 있어요.</p>
          : <>
            {status && !status.entitled && typeof status.trial_left === 'number' && lines.length === 0 && <p className="echo-ref-line echo-ref-line--echo" role="status">{status.trial_left > 0 ? `여기부터는 ECHO가 당신을 기억한 채로, 무엇이든 이야기해요. 맛보기 ${status.trial_left}번 남았어요.` : FAIL.TRIAL_USED}</p>}
            <div className="echo-ref-lines" aria-live="polite">
              {lines.map((l, i) => <p key={i} className={`echo-ref-line echo-ref-line--${l.role}${l.guard ? ' echo-ref-line--receipt' : ''}`}>{l.text}{l.role === 'echo' && l.ai && <small className="echo-talk-ai"> · AI</small>}</p>)}
              {busy && <p className="echo-ref-line echo-ref-line--echo echo-ref-typing" aria-label="ECHO가 답을 쓰고 있어요"><span /><span /><span /></p>}
              <div ref={endRef} />
            </div>
            {notice && lines.length > 0 && <p className="echo-ref-line echo-ref-line--echo echo-talk-notice" role="status">{notice}</p>}
            {fail && <div className="echo-ref-fail" role="alert"><p>{fail}</p></div>}
            <form className="echo-ref-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <label htmlFor="echo-talk-text" className="echo-ref-sr">ECHO에게 할 말</label>
              <textarea id="echo-talk-text" value={draft} maxLength={500} rows={2} placeholder={blocked ? '맛보기를 다 썼어요' : '무엇이든 편하게 적어 주세요'} disabled={busy || blocked} onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="echo-ref-send" disabled={busy || blocked || !draft.trim()}>보내기</button>
            </form>
            <div className="echo-ref-actions">
              <Link className="echo-ref-chip" to="/doit/understanding">ECHO가 아는 나</Link>
              <Link className="echo-ref-chip echo-ref-chip--quiet" to="/doit/home">오늘은 여기까지</Link>
            </div>
          </>}
      </section>
    </MobileLayout>
  );
}
