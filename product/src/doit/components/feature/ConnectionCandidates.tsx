import { useCallback, useEffect, useRef, useState } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { chooseCandidate, fetchMyCandidates, type CandidateChoice, type MyCandidate } from '@/doit/lib/connectApi';
import './connect.css';

// 당신이 잠든 사이 — 서버(doit-connect v2.0)가 준비한 소수 후보(2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§17).
// 후보 단계에서는 서버가 상대의 이름·사진·소개·말을 보내지 않는다. 화면은 받은 이유(내가 직접 한 말 · 직접 고른 목적)만 그린다.
// 두 사람이 모두 「이어지고 싶어요」를 눌러야 연결이 열린다. 한쪽만 고르면 열리지 않는다. 점수·퍼센트는 보여 주지 않는다.

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; eligible: boolean; candidates: MyCandidate[] };

const CHOICE_LABEL: Record<CandidateChoice, string> = { yes: '이어지고 싶어요', no: '이번엔 넘길게요', hide: '숨기기' };

export default function ConnectionCandidates({ userId, onOpened }: { userId: string; onOpened: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const out = await fetchMyCandidates(userId);
      if (mine === seq.current) setLoad({ kind: 'ready', eligible: out.eligible, candidates: out.candidates });
    } catch (e) {
      if (mine !== seq.current) return;
      setLoad(prev => prev.kind === 'ready' ? prev : { kind: 'error', message: e instanceof UnderstandingError && e.code !== 'NETWORK_ERROR' && e.message ? e.message : '후보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' });
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const choose = async (candidate: MyCandidate, choice: CandidateChoice) => {
    if (busy) return;
    setBusy(candidate.id);
    setError(null);
    setNotice(null);
    try {
      const out = await chooseCandidate(userId, candidate.id, choice);
      if (out.status === 'mutual') { setNotice('두 사람이 모두 골랐어요. 아래 「내 연결」에서 같은 첫 질문에 답해 보세요.'); onOpened(); }
      else if (out.status === 'waiting') setNotice('골랐어요. 상대도 고르면 연결이 열려요. 상대에게는 내가 먼저 골랐다는 사실이 보이지 않아요.');
      else setNotice(choice === 'hide' ? '숨겼어요. 이 후보는 다시 보이지 않아요.' : '넘겼어요. 이 후보는 다시 보이지 않아요.');
      await refresh();
    } catch (e) {
      setError(e instanceof UnderstandingError && e.message ? e.message : '저장하지 못했어요. 다시 눌러 주세요.');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (load.kind === 'loading') return <p className="doit-connect-note" role="status">ECHO가 준비한 후보를 확인하고 있어요.</p>;
  if (load.kind === 'error') return <div className="doit-connect doit-candidates"><p className="doit-product-error" role="alert">{load.message}</p><button type="button" className="doit-connect-link" onClick={() => void refresh()}>다시 불러오기</button></div>;
  if (!load.eligible) return null; // 연결 준비가 끝나지 않았으면 아래 「연결까지 남은 것」이 다음 할 일을 보여 준다

  return <section className="doit-connect doit-candidates" aria-label="ECHO가 준비한 후보">
    {load.candidates.length > 0
      ? <p className="doit-candidates-title">당신이 잠든 사이,<br />ECHO가 먼저 살펴봤어요.</p>
      : <p className="doit-candidates-title doit-candidates-title--wait">ECHO가 연결을 준비하고 있어요.</p>}
    {load.candidates.length === 0 && <p className="doit-connect-note">같은 만남을 원하는 사람이 준비되면 여기에 보여 드려요. 내 이야기는 그 전까지 아무에게도 보이지 않아요.</p>}
    {load.candidates.map((c, i) => <article key={c.id} className="doit-candidate" data-state={c.waiting ? 'waiting' : 'choose'}>
      <p className="doit-match-kicker">후보 {i + 1}{c.purpose ? ` · ${c.purpose}` : ''}</p>
      <p className="doit-candidate-why">이렇게 이어 봤어요</p>
      <ul className="doit-candidate-reasons">{c.reasons.map(r => <li key={r}>{r}</li>)}</ul>
      {c.waiting
        ? <p className="doit-connect-note">골랐어요. 상대도 고르면 연결이 열려요.</p>
        : <div className="doit-candidate-actions" role="group" aria-label={`후보 ${i + 1} 고르기`}>
            <button type="button" className="doit-product-action" disabled={!!busy} onClick={() => void choose(c, 'yes')}>{busy === c.id ? '저장하는 중' : CHOICE_LABEL.yes}<span aria-hidden="true">↗</span></button>
            <button type="button" className="doit-connect-link" disabled={!!busy} onClick={() => void choose(c, 'no')}>{CHOICE_LABEL.no}</button>
            <button type="button" className="doit-connect-link" disabled={!!busy} onClick={() => void choose(c, 'hide')}>{CHOICE_LABEL.hide}</button>
          </div>}
    </article>)}
    {notice && <p className="doit-connect-note" role="status">{notice}</p>}
    {error && <p className="doit-product-error" role="alert">{error}</p>}
    {load.candidates.length > 0 && <p className="doit-connect-note">두 사람이 모두 「이어지고 싶어요」를 누를 때만 연결이 열려요. 그 전에는 서로의 이름·사진이 보이지 않아요. 최종 선택은 언제나 내가 해요.</p>}
  </section>;
}
