import GuideHint from '@/components/guide/GuideHint';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { REPORT_REASONS, chooseCandidate, fetchMyCandidates, reportCandidate, reportSubmission, type CandidateChoice, type MyCandidate, type MyCandidates, type ReportReason } from '@/doit/lib/connectApi';
import { claimZzarit } from '@/doit/lib/zzarit';
import ZzaritMoment, { WaitingMark } from './ZzaritMoment';
import './connect.css';
import './connect-ref.css';

// 당신이 잠든 사이 — 서버(doit-connect v2.0)가 준비한 소수 후보(2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§17).
// 후보 단계에서는 서버가 상대의 이름·사진·소개·말을 보내지 않는다. 화면은 받은 이유(내가 직접 한 말 · 직접 고른 목적)만 그린다.
// 두 사람이 모두 「이어지고 싶어요」를 눌러야 연결이 열린다. 한쪽만 고르면 열리지 않는다. 점수·퍼센트는 보여 주지 않는다.
// 2026-09-30 대표 「CLAUDE CODE FINAL MASTER」 §3·§4: 후보를 한 번에 펼치지 않고 한 사람 → 이유가 있다는 것 → 이유 → 선택 순서로 연다.
//   여는 것은 화면 순서뿐이다(서버가 준 것만 · 상대를 알아볼 정보는 서버가 보내지 않는다). 거리(Nearby Signal)는 서버가 거리 구간을 줄 때까지 그리지 않는다.
//   「서로 골랐어요」 보상 화면은 서버가 이번 선택으로 mutual 이라고 답했을 때만 연다.
// 2026-10-01 대표 「COMPLETE PRODUCT FLOW」: 그 화면 = ZZARIT(서버 mutual + match_id 확인 뒤 · 그 연결에서 한 번만 · 새로고침해도 다시 안 뜸).
//   「SAFETY LAYER」: 숨기기 1번 · 차단 2번 · 신고(사유 고르기) 3번 안에. 「접수했어요」는 서버가 저장했다고 답할 때만.

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; eligible: boolean; candidates: MyCandidate[] };
type Mutual = { matchId: string };
type Safety = { id: string; step: 'menu' | 'report' };

const CHOICE_LABEL: Record<CandidateChoice, string> = { yes: '이어지고 싶어요', no: '이번에는 넘길게요', hide: '숨기기' };

export default function ConnectionCandidates({ userId, onOpened, onServerState, reload = 0 }: { userId: string; onOpened: (matchId: string | null) => void; onServerState?: (state: MyCandidates) => void; reload?: number }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({}); // 「왜 이 사람인지 보기」를 누른 후보(화면 순서만 · 저장하지 않는다)
  const [mutual, setMutual] = useState<Mutual | null>(null);
  const [safety, setSafety] = useState<Safety | null>(null);
  const [stale, setStale] = useState(false); // 「후보 열기」 뒤 다시 읽기가 실패해 지난 목록을 보여 주는 중
  const seq = useRef(0);
  const shown = useRef(false); // 목록을 한 번이라도 보여 줬는지(실패해도 지난 목록은 지우지 않는다)

  // explicit = 실행 단계 「후보 열기」 뒤 다시 읽기. 실패하면 지난 목록을 지우지 않고 실패를 알린다(Codex PR #122 2026-10-04).
  const refresh = useCallback(async (explicit = false) => {
    const mine = ++seq.current;
    try {
      const out = await fetchMyCandidates(userId);
      if (mine === seq.current) { shown.current = true; setStale(false); setLoad({ kind: 'ready', eligible: out.eligible, candidates: out.candidates }); onServerState?.(out); } // FI-018 연결 준비 칸도 같은 서버 응답으로
    } catch {
      if (mine !== seq.current) return;
      // 불러오기 실패에는 저장 실패 문구(서버 창구의 기본 문구 「저장 결과를 확인하지 못했어요…」)를 쓰지 않는다(QA 브라우저 검사 20).
      if (!shown.current) setLoad({ kind: 'error', message: '불러오지 못했어요. 다시 확인해 볼게요.' });
      else if (explicit) setStale(true);
    }
  }, [userId, onServerState]);

  useEffect(() => { void refresh(reload > 0); }, [refresh, reload]); // reload = 실행 단계 「후보 열기」 뒤 다시 읽기(같은 화면 · 다시 만들지 않음)

  const choose = async (candidate: MyCandidate, choice: CandidateChoice) => {
    if (busy) return;
    setBusy(candidate.id);
    setError(null);
    setNotice(null);
    try {
      const out = await chooseCandidate(userId, candidate.id, choice);
      if (out.status === 'mutual') {
        // 서버가 연결(match_id)까지 확인했을 때만 ZZARIT. 이미 본 연결이면 바로 그 연결로.
        if (typeof out.match_id === 'string') { if (claimZzarit(out.match_id)) setMutual({ matchId: out.match_id }); else onOpened(out.match_id); }
        else setNotice('서로 같은 선택을 했어요. 아래 내 연결에서 이어 볼게요.');
      }
      else if (out.status === 'waiting') setNotice('선택을 보냈어요. 상대도 선택하면 알려드릴게요. 상대가 고르기 전에는 내가 고른 사실이 상대에게 보이지 않아요.');
      else setNotice(choice === 'hide' ? '숨겼어요. 이 후보는 다시 보이지 않아요.' : '넘겼어요. 이 후보는 다시 보이지 않아요.');
      await refresh();
    } catch (e) {
      setError(e instanceof UnderstandingError && e.message ? e.message : '저장하지 못했어요. 다시 눌러 주세요.');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const submission = useRef(reportSubmission()); // 신고 한 번의 제출 = 요청 id 하나(실패 뒤 같은 내용 재시도는 같은 id)
  // 차단·신고(숨김과 함께). 서버가 저장했다고 답한 것만 말한다.
  const protect = async (candidate: MyCandidate, block: boolean, reason?: ReportReason) => {
    if (busy) return;
    setBusy(candidate.id);
    setError(null);
    setNotice(null);
    try {
      const out = await reportCandidate(userId, candidate.id, { block, reason, requestId: submission.current.idFor(`${candidate.id}:${block}:${reason ?? ''}`) });
      submission.current.done();
      setSafety(null);
      setNotice(out.reported ? '접수했어요. 이 후보는 다시 보이지 않고, 다시 추천되지 않아요.'
        : out.blocked ? '차단했어요. 이 후보는 다시 보이지 않고, 다시 추천되지 않아요.'
        : '숨겼어요. 이 후보는 다시 보이지 않아요.');
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

  // 서버가 이번 선택으로 두 사람 모두 골랐다고(mutual + match_id) 답했을 때만 · 상대 정보 0 · 차분하게.
  if (mutual) return <ZzaritMoment onStart={() => { onOpened(mutual.matchId); setMutual(null); }} />;

  const fresh = load.candidates.filter(c => !c.waiting).length;
  const title = fresh === 1 ? <>당신이 잠든 사이,<br />ECHO가 한 사람을 발견했어요.</>
    : fresh > 1 ? <>당신이 잠든 사이,<br />ECHO가 {fresh}명을 발견했어요.</>
    : load.candidates.length ? <>선택을 보냈어요.</> : null;

  return <section className="doit-connect doit-candidates" aria-label="ECHO가 준비한 후보">
    {title
      ? <p className="doit-candidates-title">{title}</p>
      : <p className="doit-candidates-title doit-candidates-title--wait">아직 보여 드릴 사람은 없어요.</p>}
    {load.candidates.length > 0 && <GuideHint id="choice" />}
    {load.candidates.length === 0 && <p className="doit-connect-note">조건에 맞는 연결이 생기면 여기에서 먼저 보여 드릴게요. 내 이야기는 그 전까지 아무에게도 보이지 않아요.</p>}
    {load.candidates.map((c, i) => {
      const open = c.waiting || !!opened[c.id];
      return <article key={c.id} className="doit-candidate" data-state={c.waiting ? 'waiting' : open ? 'choose' : 'closed'}>
        <p className="doit-match-kicker">후보 {i + 1}{c.purpose ? ` · ${c.purpose}` : ''}</p>
        <p className="doit-candidate-found">한 사람을 발견했어요.</p>
        {/* 2026-10-04 모바일 기준 디자인 5번(후보 추천): 카드 가운데 큰 따옴표 한 줄 = 서버가 준 이 후보의 만남 목적 그대로(상대 이름·사진 0 · 화면이 문장을 만들지 않음). */}
        {c.purpose && <p className="doit-candidate-quote"><span><span aria-hidden="true">“</span>{c.purpose}<span aria-hidden="true">”</span></span></p>}
        {!open && <>
          <p className="doit-candidate-teaser">이분의 이야기를 들어볼까요? ECHO가 이어 본 이유부터 보여 드릴게요.</p>
          <button type="button" className="doit-product-action" onClick={() => setOpened(prev => ({ ...prev, [c.id]: true }))} aria-expanded="false">더 알아보기<span aria-hidden="true">↗</span></button>
        </>}
        {open && <>
          <p className="doit-candidate-why">이렇게 이어 봤어요</p>
          <ul className="doit-candidate-reasons">{c.reasons.map(r => <li key={r}>{r}</li>)}</ul>
          {c.waiting
            ? <><WaitingMark /><p className="doit-connect-note echo-waiting"><span className="echo-signal-pulse" aria-hidden="true" />선택을 보냈어요. 상대도 선택하면 알려드릴게요.</p></>
            : <div className="doit-candidate-actions" role="group" aria-label={`후보 ${i + 1} 고르기`}>
                <button type="button" className="doit-product-action" disabled={!!busy} onClick={() => void choose(c, 'yes')}>{busy === c.id ? '저장하는 중' : CHOICE_LABEL.yes}<span aria-hidden="true">↗</span></button>
                <button type="button" className="doit-connect-link" disabled={!!busy} onClick={() => void choose(c, 'no')}>{CHOICE_LABEL.no}</button>
                <button type="button" className="doit-connect-link" disabled={!!busy} onClick={() => void choose(c, 'hide')}>{CHOICE_LABEL.hide}</button>
              </div>}
          <SafetyRow candidate={c} index={i} busy={!!busy} safety={safety} setSafety={setSafety} protect={protect} />
        </>}
      </article>;
    })}
    {notice && <p className="doit-connect-note" role="status">{notice}</p>}
    {stale && <div className="doit-connect-stale"><p className="doit-product-error" role="alert">새 후보를 불러오지 못했어요. 지금 보이는 목록은 지난 내용이에요.</p><button type="button" className="doit-connect-link" onClick={() => void refresh(true)}>다시 확인하기</button></div>}
    {error && <p className="doit-product-error" role="alert">{error}</p>}
    {load.candidates.length > 0 && <p className="doit-connect-note">두 사람이 모두 「이어지고 싶어요」를 누를 때만 연결이 열려요. 그 전에는 서로의 이름·사진이 보이지 않아요. 최종 선택은 언제나 내가 해요.</p>}
  </section>;
}

// 후보 안전 줄 — 「불편해요」 → 차단 / 신고(사유). 경찰 앱처럼 크게 만들지 않고 조용한 글자 버튼으로.
function SafetyRow({ candidate, index, busy, safety, setSafety, protect }: {
  candidate: MyCandidate; index: number; busy: boolean; safety: Safety | null;
  setSafety: (s: Safety | null) => void; protect: (c: MyCandidate, block: boolean, reason?: ReportReason) => Promise<void>;
}) {
  // 2026-10-02 대표 「QA 마감 v1.1」 §7: 차단과 신고는 별도 행동 — 신고할 때 차단은 고를 수 있게(기본은 함께). 차단은 사유 없이 바로.
  const [alsoBlock, setAlsoBlock] = useState(true);
  const mine = safety?.id === candidate.id ? safety : null;
  if (!mine) return <button type="button" className="doit-connect-link doit-safety-open" disabled={busy} onClick={() => setSafety({ id: candidate.id, step: 'menu' })}>불편해요 · 차단 · 신고</button>;
  return <div className="doit-safety" role="group" aria-label={`후보 ${index + 1} 차단·신고`}>
    {mine.step === 'menu' ? <>
      <p className="doit-connect-note">차단하면 다시 추천되지 않아요. 상대에게 알림은 가지 않아요.</p>
      <button type="button" className="doit-connect-link" disabled={busy} onClick={() => void protect(candidate, true)}>차단할게요</button>
      <button type="button" className="doit-connect-link" disabled={busy} onClick={() => setSafety({ id: candidate.id, step: 'report' })}>신고할게요</button>
    </> : <>
      <p className="doit-connect-note">어떤 점이 불편했나요?</p>
      <label className="doit-safety-also"><input type="checkbox" checked={alsoBlock} onChange={e => setAlsoBlock(e.target.checked)} disabled={busy} /> 차단도 함께 하기</label>
      <div className="doit-safety-reasons">{REPORT_REASONS.map(([code, label]) => <button key={code} type="button" className="doit-connect-link" disabled={busy} onClick={() => void protect(candidate, alsoBlock, code)}>{label}</button>)}</div>
    </>}
    <button type="button" className="doit-connect-link" disabled={busy} onClick={() => setSafety(null)}>닫기</button>
  </div>;
}
