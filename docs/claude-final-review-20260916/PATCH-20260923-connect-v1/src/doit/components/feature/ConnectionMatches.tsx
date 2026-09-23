import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { ANSWER_MAX, MESSAGE_MAX, fetchMyMatches, leaveMatch, sendMatchAnswer, sendMatchMessage, type MyMatch } from '@/doit/lib/connectApi';
import './connect.css';

// 내 연결 — 대표가 승인한 연결만 여기 온다(연결 원칙 2026-09-21).
// 순서: 같은 첫 질문 → 둘 다 답하면 이름·사진·소개·서로의 답이 열림(blind-first) → 이야기.
// 상대 정보는 서버가 조건을 확인한 뒤에만 내려 준다. 화면은 받은 것만 그린다.
const REFRESH_MS = 30_000;

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; matches: MyMatch[] };

function errorText(e: unknown, fallback: string): string {
  return e instanceof UnderstandingError && e.message ? e.message : fallback;
}

export default function ConnectionMatches({ userId }: { userId: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const matches = await fetchMyMatches(userId);
      if (mine === seq.current) setLoad({ kind: 'ready', matches });
    } catch (e) {
      if (mine !== seq.current) return;
      const missing = e instanceof UnderstandingError && (e.code === 'NETWORK_ERROR' || e.code === 'BAD_REQUEST');
      setLoad(prev => prev.kind === 'ready' ? prev : { kind: 'error', message: missing ? '연결 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' : errorText(e, '연결 목록을 불러오지 못했어요.') });
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const hasOpen = load.kind === 'ready' && load.matches.some(m => m.status === 'open');
  useEffect(() => {
    if (!hasOpen) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasOpen, refresh]);

  if (load.kind === 'loading') return <p className="doit-connect-note" role="status">내 연결을 확인하고 있어요.</p>;
  if (load.kind === 'error') return <div className="doit-connect doit-matches"><p className="doit-product-error" role="alert">{load.message}</p><button type="button" className="doit-connect-link" onClick={() => void refresh()}>다시 불러오기</button></div>;
  if (!load.matches.length) return null;

  return <section className="doit-connect doit-matches" aria-label="내 연결">
    <div className="doit-matches-head">
      <p className="doit-asleep-label">내 연결 {load.matches.filter(m => m.status === 'open').length}</p>
      <button type="button" className="doit-connect-link" onClick={() => void refresh()}>새로 보기</button>
    </div>
    {load.matches.map(m => <MatchCard key={m.id} match={m} userId={userId} onChanged={refresh} />)}
  </section>;
}

function MatchCard({ match, userId, onChanged }: { match: MyMatch; userId: string; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (match.status === 'closed') {
    return <article className="doit-match" data-state="closed"><p className="doit-connect-note">이 연결은 끝났어요. 서로의 이야기는 더 보이지 않아요.</p></article>;
  }

  const submit = async (event: FormEvent, kind: 'answer' | 'message') => {
    event.preventDefault();
    const text = draft.trim();
    if (busy || !text) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'answer') await sendMatchAnswer(userId, match.id, text);
      else await sendMatchMessage(userId, match.id, text);
      setDraft('');
      await onChanged();
    } catch (e) {
      setError(errorText(e, '보내지 못했어요. 적은 내용은 그대로 있어요. 다시 눌러 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const leave = async (report: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await leaveMatch(userId, match.id, { block: report, report });
      setLeaving(false);
      await onChanged();
    } catch (e) {
      setError(errorText(e, '지금은 끝내지 못했어요. 다시 눌러 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const max = match.my_answer ? MESSAGE_MAX : ANSWER_MAX;
  const stage = !match.my_answer ? 'ask' : !match.revealed ? 'wait' : 'talk';

  return <article className="doit-match" data-state={stage}>
    {match.revealed && match.partner && <header className="doit-match-partner">
      {match.partner.photo_url
        ? <img src={match.partner.photo_url} alt={`${match.partner.nickname}의 대표 사진`} loading="lazy" referrerPolicy="no-referrer" />
        : <span className="doit-match-photo-empty" aria-hidden="true" />}
      <div>
        <strong>{match.partner.nickname}</strong>
        {match.partner.purpose && <span>{match.partner.purpose}</span>}
        {match.partner.bio && <p>{match.partner.bio}</p>}
      </div>
    </header>}

    <p className="doit-match-kicker">두 사람에게 같은 질문</p>
    <p className="doit-match-question">{match.first_question}</p>

    {stage === 'ask' && <>
      <p className="doit-connect-note">내가 답하고 상대도 답하면, 그때 서로의 이름과 사진이 열려요.</p>
      <form className="doit-connect-form" onSubmit={e => void submit(e, 'answer')}>
        <label className="doit-connect-label" htmlFor={`answer-${match.id}`}>내 답</label>
        <textarea id={`answer-${match.id}`} className="doit-connect-input" rows={3} maxLength={max} value={draft} onChange={e => { setDraft(e.target.value); if (error) setError(null); }} />
        <button className="doit-product-action" type="submit" disabled={busy || !draft.trim()}>{busy ? '보내는 중' : '내 답 보내기'}<span aria-hidden="true">↗</span></button>
      </form>
    </>}

    {stage !== 'ask' && <div className="doit-match-answers">
      <p><span>내 답</span>{match.my_answer}</p>
      {match.revealed && match.partner
        ? <p><span>{match.partner.nickname}의 답</span>{match.partner.answer}</p>
        : <p className="doit-connect-note">상대의 답을 기다리고 있어요. 답이 오면 이름과 사진이 함께 열려요.</p>}
    </div>}

    {stage === 'talk' && <>
      <ol className="doit-match-messages" aria-label="이야기">
        {(match.messages ?? []).map(msg => <li key={msg.id} data-mine={msg.mine ? 'true' : 'false'}>{msg.body}</li>)}
      </ol>
      <form className="doit-connect-form doit-match-send" onSubmit={e => void submit(e, 'message')}>
        <label className="doit-connect-label" htmlFor={`message-${match.id}`}>이어서 이야기하기</label>
        <textarea id={`message-${match.id}`} className="doit-connect-input" rows={2} maxLength={max} value={draft} onChange={e => { setDraft(e.target.value); if (error) setError(null); }} />
        <button className="doit-product-action" type="submit" disabled={busy || !draft.trim()}>{busy ? '보내는 중' : '보내기'}<span aria-hidden="true">↗</span></button>
      </form>
      <p className="doit-connect-note">연락처·링크는 보낼 수 없어요. 새 이야기는 잠시 뒤 저절로 보이고, 바로 보려면 「새로 보기」를 눌러 주세요.</p>
    </>}

    {error && <p className="doit-product-error" role="alert">{error}</p>}

    {!leaving
      ? <button type="button" className="doit-connect-link" onClick={() => setLeaving(true)} disabled={busy}>이 연결 그만하기</button>
      : <div className="doit-match-leave" role="group" aria-label="그만하기 확인">
          <p>그만하면 서로의 이야기가 더 보이지 않고, 다시 이어지지 않아요.</p>
          <button type="button" className="doit-connect-link" onClick={() => void leave(false)} disabled={busy}>그만할게요</button>
          <button type="button" className="doit-connect-link" onClick={() => void leave(true)} disabled={busy}>차단하고 신고할게요</button>
          <button type="button" className="doit-connect-link" onClick={() => setLeaving(false)} disabled={busy}>계속할게요</button>
        </div>}
  </article>;
}
