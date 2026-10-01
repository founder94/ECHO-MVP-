import { useCallback, useEffect, useRef, useState } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { chooseCandidate, fetchMyCandidates, type CandidateChoice, type MyCandidate } from '@/doit/lib/connectApi';
import './connect.css';

// 당신이 잠든 사이 — 서버(doit-connect v2.0)가 준비한 소수 후보(2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§17).
// 후보 단계에서는 서버가 상대의 이름·사진·소개·말을 보내지 않는다. 화면은 받은 이유(내가 직접 한 말 · 직접 고른 목적)만 그린다.
// 두 사람이 모두 「이어지고 싶어요」를 눌러야 연결이 열린다. 한쪽만 고르면 열리지 않는다. 점수·퍼센트는 보여 주지 않는다.
// 2026-09-30 대표 「CLAUDE CODE FINAL MASTER」 §3·§4: 후보를 한 번에 펼치지 않고 한 사람 → 이유가 있다는 것 → 이유 → 선택 순서로 연다.
//   여는 것은 화면 순서뿐이다(서버가 준 것만 · 상대를 알아볼 정보는 서버가 보내지 않는다). 거리(Nearby Signal)는 서버가 거리 구간을 줄 때까지 그리지 않는다.
//   「서로 골랐어요」 보상 화면은 서버가 이번 선택으로 mutual 이라고 답했을 때만 연다.

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; eligible: boolean; candidates: MyCandidate[] };
type Mutual = { matchId: string | null };

const CHOICE_LABEL: Record<CandidateChoice, string> = { yes: '이어지고 싶어요', no: '이번에는 넘길게요', hide: '숨기기' };

export default function ConnectionCandidates({ userId, onOpened }: { userId: string; onOpened: (matchId: string | null) => void }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({}); // 「왜 이 사람인지 보기」를 누른 후보(화면 순서만 · 저장하지 않는다)
  const [mutual, setMutual] = useState<Mutual | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const out = await fetchMyCandidates(userId);
      if (mine === seq.current) setLoad({ kind: 'ready', eligible: out.eligible, candidates: out.candidates });
    } catch {
      if (mine !== seq.current) return;
      // 불러오기 실패에는 저장 실패 문구(서버 창구의 기본 문구 「저장 결과를 확인하지 못했어요…」)를 쓰지 않는다(QA 브라우저 검사 20).
      setLoad(prev => prev.kind === 'ready' ? prev : { kind: 'error', message: '불러오지 못했어요. 다시 확인해 볼게요.' });
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
      if (out.status === 'mutual') setMutual({ matchId: typeof out.match_id === 'string' ? out.match_id : null });
      else if (out.status === 'waiting') setNotice('내 선택은 전해졌어요. 상대가 고르기 전에는 내가 고른 사실이 상대에게 보이지 않아요.');
      else setNotice(choice === 'hide' ? '숨겼어요. 이 후보는 다시 보이지 않아요.' : '넘겼어요. 이 후보는 다시 보이지 않아요.');
      await refresh();
    } catch (e) {
      setError(e instanceof UnderstandingError && e.message ? e.message : '저장하지 못했어요. 다시 눌러 주세요.');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (load.kind === 'loading') return <p className="doit-connect-note" role="status">ECHO가 천천히 살펴보고 있어요.</p>;
  if (load.kind === 'error') return <div className="doit-connect doit-candidates"><p className="doit-product-error" role="alert">{load.message}</p><button type="button" className="doit-connect-link" onClick={() => void refresh()}>다시 확인하기</button></div>;
  if (!load.eligible) return null; // 연결 준비가 끝나지 않았으면 아래 「연결까지 남은 것」이 다음 할 일을 보여 준다

  // 서버가 이번 선택으로 두 사람 모두 골랐다고 답했을 때만(상대 정보 0 · 차분하게).
  if (mutual) return <section className="doit-connect doit-mutual" aria-label="서로 골랐어요" role="status">
    <p className="doit-match-kicker">서로 골랐어요</p>
    <p className="doit-mutual-title">상대도 당신이 궁금했대요.</p>
    <p className="doit-mutual-body">두 사람 모두 조금 더 이야기해 보고 싶다고 했어요.</p>
    <button type="button" className="doit-product-action" onClick={() => { onOpened(mutual.matchId); setMutual(null); }}>이야기 시작하기<span aria-hidden="true">↗</span></button>
    <p className="doit-connect-note">먼저 ECHO가 두 분께 같은 질문 하나를 드려요. 둘 다 답하면 서로의 이름과 사진이 열려요.</p>
  </section>;

  const fresh = load.candidates.filter(c => !c.waiting).length;
  const title = fresh === 1 ? <>당신이 잠든 사이,<br />ECHO가 한 사람을 발견했어요.</>
    : fresh > 1 ? <>당신이 잠든 사이,<br />ECHO가 {fresh}명을 발견했어요.</>
    : load.candidates.length ? <>내 선택은 전해졌어요.</> : null;

  return <section className="doit-connect doit-candidates" aria-label="ECHO가 준비한 후보">
    {title
      ? <p className="doit-candidates-title">{title}</p>
      : <p className="doit-candidates-title doit-candidates-title--wait">아직 보여 드릴 사람은 없어요.</p>}
    {load.candidates.length === 0 && <p className="doit-connect-note">조건에 맞는 연결이 생기면 여기에서 먼저 보여 드릴게요. 내 이야기는 그 전까지 아무에게도 보이지 않아요.</p>}
    {load.candidates.map((c, i) => {
      const open = c.waiting || !!opened[c.id];
      return <article key={c.id} className="doit-candidate" data-state={c.waiting ? 'waiting' : open ? 'choose' : 'closed'}>
        <p className="doit-match-kicker">후보 {i + 1}{c.purpose ? ` · ${c.purpose}` : ''}</p>
        <p className="doit-candidate-found">한 사람을 발견했어요.</p>
        {!open && <>
          <p className="doit-candidate-teaser">왜 이 사람인지, ECHO가 본 이유가 있어요.</p>
          <button type="button" className="doit-product-action" onClick={() => setOpened(prev => ({ ...prev, [c.id]: true }))} aria-expanded="false">왜 이 사람인지 보기<span aria-hidden="true">↗</span></button>
        </>}
        {open && <>
          <p className="doit-candidate-why">이렇게 이어 봤어요</p>
          <ul className="doit-candidate-reasons">{c.reasons.map(r => <li key={r}>{r}</li>)}</ul>
          {c.waiting
            ? <p className="doit-connect-note">내 선택은 전해졌어요. 상대도 고르면 연결이 열려요.</p>
            : <div className="doit-candidate-actions" role="group" aria-label={`후보 ${i + 1} 고르기`}>
                <button type="button" className="doit-product-action" disabled={!!busy} onClick={() => void choose(c, 'yes')}>{busy === c.id ? '저장하는 중' : CHOICE_LABEL.yes}<span aria-hidden="true">↗</span></button>
                <button type="button" className="doit-connect-link" disabled={!!busy} onClick={() => void choose(c, 'no')}>{CHOICE_LABEL.no}</button>
                <button type="button" className="doit-connect-link" disabled={!!busy} onClick={() => void choose(c, 'hide')}>{CHOICE_LABEL.hide}</button>
              </div>}
        </>}
      </article>;
    })}
    {notice && <p className="doit-connect-note" role="status">{notice}</p>}
    {error && <p className="doit-product-error" role="alert">{error}</p>}
    {load.candidates.length > 0 && <p className="doit-connect-note">두 사람이 모두 「이어지고 싶어요」를 누를 때만 연결이 열려요. 그 전에는 서로의 이름·사진이 보이지 않아요. 최종 선택은 언제나 내가 해요.</p>}
  </section>;
}
