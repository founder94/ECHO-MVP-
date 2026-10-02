import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { ANSWER_MAX, MESSAGE_MAX, REPORT_REASONS, fetchMyMatches, giveConnectConsent, leaveMatch, reportSubmission, sendMatchAnswer, sendMatchMessage, sendOutcome, type MatchOutcome, type MyMatch, type OutcomeField, type ReportReason } from '@/doit/lib/connectApi';
import { claimZzarit } from '@/doit/lib/zzarit';
import ZzaritMoment from './ZzaritMoment';
import './connect.css';
import PartnerFrame from './PartnerFrame';

// 내 연결 — 대표가 승인한 연결만 여기 온다(연결 원칙 2026-09-21).
// 순서: 같은 첫 질문 → 둘 다 답하면 이름·사진·소개·서로의 답이 열림(blind-first) → 이야기.
// 상대 정보는 서버가 조건을 확인한 뒤에만 내려 준다. 화면은 받은 것만 그린다.
// v1.2: 첫 답이 공개의 방아쇠라, 처음 답하기 전에 무엇이 상대에게 보이는지 보여 주고 동의를 받는다(서버도 다시 확인).
const REFRESH_MS = 30_000;

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; matches: MyMatch[]; consented: boolean };

function errorText(e: unknown, fallback: string): string {
  return e instanceof UnderstandingError && e.message ? e.message : fallback;
}

// 2026-09-30 대표 「CLAUDE CODE FINAL MASTER」 §12: 서로 골라 연결이 열리면 그 연결(서버가 준 match_id)로 바로 데려간다. 화면이 연결을 만들지 않는다.
export default function ConnectionMatches({ userId, focusId = null }: { userId: string; focusId?: string | null }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [safetyNote, setSafetyNote] = useState<string | null>(null); // 서버가 저장했다고 답한 차단·신고만
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const { matches, consented } = await fetchMyMatches(userId);
      if (mine === seq.current) setLoad({ kind: 'ready', matches, consented });
    } catch {
      if (mine !== seq.current) return;
      // 불러오기 실패에 저장 실패 문구를 쓰지 않는다(2026-09-30 QA 브라우저 검사 20)
      setLoad(prev => prev.kind === 'ready' ? prev : { kind: 'error', message: '연결 목록을 불러오지 못했어요. 다시 확인해 볼게요.' });
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const focusReady = load.kind === 'ready' && !!focusId && load.matches.some(m => m.id === focusId);
  useEffect(() => {
    if (!focusReady || !focusId) return;
    const el = document.getElementById(`match-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }, [focusReady, focusId]);

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
    {safetyNote && <p className="doit-connect-note doit-safety-done" role="status">{safetyNote}</p>}
    {load.matches.map(m => <MatchCard key={m.id} focused={m.id === focusId} match={m} userId={userId} consented={load.consented} onConsented={() => setLoad(prev => prev.kind === 'ready' ? { ...prev, consented: true } : prev)} onConsentLost={() => setLoad(prev => prev.kind === 'ready' ? { ...prev, consented: false } : prev)} onChanged={refresh} onSafety={setSafetyNote} />)}
  </section>;
}

interface MatchCardProps {
  focused: boolean;
  match: MyMatch;
  userId: string;
  consented: boolean;
  onConsented: () => void;
  onConsentLost: () => void;
  onChanged: () => Promise<void>;
  onSafety: (note: string) => void;
}

function MatchCard({ focused, match, userId, consented, onConsented, onConsentLost, onChanged, onSafety }: MatchCardProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<false | 'menu' | 'report'>(false);
  const [alsoBlock, setAlsoBlock] = useState(true); // 신고와 차단은 별도 — 신고할 때 차단은 고를 수 있다(기본은 함께)
  // ZZARIT: 먼저 고르고 기다리던 사람도, 서버가 서로 골라 열린 연결(via_mutual)이라고 줄 때 이 연결에서 한 번만.
  const [zzarit, setZzarit] = useState(() => match.status === 'open' && match.via_mutual === true && !match.my_answer && claimZzarit(match.id));
  const submission = useRef(reportSubmission()); // 신고 한 번의 제출 = 요청 id 하나(실패 뒤 같은 내용 재시도는 같은 id)

  if (match.status === 'closed') {
    return <article id={`match-${match.id}`} tabIndex={-1} className="doit-match" data-state="closed"><p className="doit-connect-note">이 연결은 끝났어요. 서로의 이야기는 더 보이지 않아요.</p><OutcomeForm userId={userId} matchId={match.id} initial={match.outcome ?? null} /></article>;
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
      // 동의 판이 바뀌었거나 저장이 안 됐으면 동의 칸으로 돌아간다. 적은 답은 그대로 둔다.
      if (e instanceof UnderstandingError && e.code === 'CONSENT_REQUIRED') onConsentLost();
      setError(errorText(e, '보내지 못했어요. 적은 내용은 그대로 있어요. 다시 눌러 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const consent = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await giveConnectConsent();
    setBusy(false);
    if (failed) setError(failed);
    else onConsented();
  };

  const leave = async (block: boolean, report: boolean, reason?: ReportReason) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await leaveMatch(userId, match.id, { block, report, reason, requestId: submission.current.idFor(`${match.id}:${block}:${report}:${reason ?? ''}`) });
      submission.current.done();
      setLeaving(false);
      onSafety(out.reported ? '접수했어요. 그 연결은 끝났고, 다시 추천되지 않아요.' : out.blocked ? '차단했어요. 그 연결은 끝났고, 다시 추천되지 않아요.' : '그 연결을 끝냈어요. 서로의 이야기는 더 보이지 않아요.');
      await onChanged();
    } catch (e) {
      setError(errorText(e, '지금은 끝내지 못했어요. 다시 눌러 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const max = match.my_answer ? MESSAGE_MAX : ANSWER_MAX;
  const stage = !match.my_answer ? 'ask' : !match.revealed ? 'wait' : 'talk';

  // 휴대폰 글자판이 입력칸을 가리지 않게: 입력칸을 누르면 화면 가운데로 올린다(글자판이 뜬 뒤 한 번 더).
  const keepVisible = (el: HTMLElement) => { el.scrollIntoView({ block: 'center' }); window.visualViewport?.addEventListener('resize', () => el.scrollIntoView({ block: 'center' }), { once: true }); };

  if (zzarit) return <article id={`match-${match.id}`} tabIndex={-1} className="doit-match" data-state="zzarit">
    <ZzaritMoment onStart={() => setZzarit(false)} />
  </article>;

  return <article id={`match-${match.id}`} tabIndex={-1} className="doit-match" data-state={stage} data-focus={focused ? 'true' : undefined}>
    {/* 2026-10-01 ECHO FRAME: 서버가 공개(revealed)라고 보낸 상대만 — 한 문장 → 실제 사진 장면 → 이름·관계 단서. 공개 전에는 상대 정보가 오지 않는다. */}
    {match.revealed && match.partner && <PartnerFrame matchId={match.id} partner={match.partner} onRetry={() => void onChanged()} />}

    {stage === 'ask' && match.via_mutual === true && <p className="doit-mutual-title">상대도 당신이 궁금했대요.</p>}
    {stage === 'ask' && <p className="doit-match-intro">두 분 모두 편하게 시작할 수 있게<br />ECHO가 하나만 물어볼게요.</p>}
    <p className="doit-match-kicker">두 사람에게 같은 질문</p>
    <p className="doit-match-question">{match.first_question}</p>

    {stage === 'ask' && !consented && <div className="doit-match-consent" role="group" aria-label="답하기 전에 확인">
      <p className="doit-match-kicker">답하기 전에 확인해 주세요</p>
      <ul>
        <li>두 사람이 모두 답하면, 상대에게 내 <b>닉네임 · 대표 사진 · 소개 · 고른 만남 · 이 질문에 쓴 답</b>이 보여요.</li>
        <li>둘 다 답하기 전에는 아무것도 보이지 않아요.</li>
        <li>전화번호와 이메일은 보이지 않아요. 연락처와 링크는 보낼 수도 없어요.</li>
        <li>정확한 위치는 상대에게 보이지 않아요.</li>
        <li>「이 연결 그만하기」를 누르면 언제든 끝나고, 더 보이지 않아요.</li>
      </ul>
      <button className="doit-product-action" type="button" onClick={() => void consent()} disabled={busy}>{busy ? '저장하는 중' : '확인했어요, 답할게요'}<span aria-hidden="true">↗</span></button>
      <p className="doit-connect-note">아직 답하고 싶지 않으면 그대로 두셔도 돼요. 답하기 전에는 아무것도 보이지 않아요.</p>
    </div>}

    {stage === 'ask' && consented && <>
      <p className="doit-connect-note">내가 답하고 상대도 답하면, 그때 서로의 이름과 사진이 열려요.</p>
      <form className="doit-connect-form" onSubmit={e => void submit(e, 'answer')}>
        <label className="doit-connect-label" htmlFor={`answer-${match.id}`}>내 답</label>
        <textarea id={`answer-${match.id}`} className="doit-connect-input" rows={3} onFocus={e => keepVisible(e.currentTarget)} maxLength={max} value={draft} onChange={e => { setDraft(e.target.value); if (error) setError(null); }} />
        <button className="doit-product-action" type="submit" disabled={busy || !draft.trim()}>{busy ? '보내는 중' : '내 답 보내기'}<span aria-hidden="true">↗</span></button>
      </form>
    </>}

    {stage !== 'ask' && <div className="doit-match-answers">
      <p><span>내 답</span>{match.my_answer}</p>
      {match.revealed && match.partner
        ? <p><span>{match.partner.nickname}의 답</span>{match.partner.answer}</p>
        : <p className="doit-connect-note echo-waiting"><span className="echo-signal-pulse" aria-hidden="true" />상대의 답을 기다리고 있어요. 답이 오면 이름과 사진이 함께 열려요.</p>}
    </div>}

    {stage === 'talk' && <>
      <ol className="doit-match-messages" aria-label="이야기">
        {(match.messages ?? []).map(msg => <li key={msg.id} data-mine={msg.mine ? 'true' : 'false'}>{msg.body}</li>)}
      </ol>
      <form className="doit-connect-form doit-match-send" onSubmit={e => void submit(e, 'message')}>
        <label className="doit-connect-label" htmlFor={`message-${match.id}`}>이어서 이야기하기</label>
        <textarea id={`message-${match.id}`} className="doit-connect-input" rows={2} onFocus={e => keepVisible(e.currentTarget)} maxLength={max} value={draft} onChange={e => { setDraft(e.target.value); if (error) setError(null); }} />
        <button className="doit-product-action" type="submit" disabled={busy || !draft.trim()}>{busy ? '보내는 중' : '보내기'}<span aria-hidden="true">↗</span></button>
      </form>
      <p className="doit-connect-note">연락처·링크는 보낼 수 없어요. 새 이야기는 잠시 뒤 저절로 보이고, 바로 보려면 「새로 보기」를 눌러 주세요.</p>
      <p className="doit-connect-note">불편하면 언제든 나갈 수 있어요. 아래 「이 연결 그만하기」에서 차단·신고도 할 수 있어요.</p>
      <details className="doit-meet-safety doit-meet-safety--peek"><summary>만나기 전 안전 안내</summary><MeetSafetyList /></details>
      <OutcomeForm userId={userId} matchId={match.id} initial={match.outcome ?? null} />
    </>}

    {error && <p className="doit-product-error" role="alert">{error}</p>}

    {!leaving
      ? <button type="button" className="doit-connect-link" onClick={() => setLeaving('menu')} disabled={busy}>이 연결 그만하기</button>
      : leaving === 'menu'
        ? <div className="doit-match-leave" role="group" aria-label="그만하기 확인">
            <p>그만하면 서로의 이야기가 더 보이지 않고, 다시 이어지지 않아요. 차단하면 다시 추천되지 않아요.</p>
            <button type="button" className="doit-connect-link" onClick={() => void leave(false, false)} disabled={busy}>그만할게요</button>
            <button type="button" className="doit-connect-link" onClick={() => void leave(true, false)} disabled={busy}>차단할게요</button>
            <button type="button" className="doit-connect-link" onClick={() => setLeaving('report')} disabled={busy}>신고할게요</button>
            <button type="button" className="doit-connect-link" onClick={() => setLeaving(false)} disabled={busy}>계속할게요</button>
          </div>
        : <div className="doit-match-leave" role="group" aria-label="신고 사유">
            <p>어떤 점이 불편했나요? 고르면 이 연결은 끝나요.</p>
            <label className="doit-safety-also"><input type="checkbox" checked={alsoBlock} onChange={e => setAlsoBlock(e.target.checked)} disabled={busy} /> 차단도 함께 하기</label>
            <div className="doit-safety-reasons">{REPORT_REASONS.map(([code, label]) => <button key={code} type="button" className="doit-connect-link" onClick={() => void leave(alsoBlock, true, code)} disabled={busy}>{label}</button>)}</div>
            <button type="button" className="doit-connect-link" onClick={() => setLeaving('menu')} disabled={busy}>뒤로</button>
          </div>}
  </article>;
}

// v2.0 결과 기록(대표 「FINAL MVP IMPLEMENTATION MASTER」 §19) — 본인 것만 · 누를 때마다 그 칸만 저장. 상대에게 보이지 않고, 내 프로필·확정한 말로 올리지 않는다.
const OUTCOME_QUESTIONS: { field: OutcomeField; legend: string; options: [string, string][] }[] = [
  { field: 'talked', legend: '이야기를 나눠 봤어요?', options: [['yes', '나눴어요'], ['no', '아직이요']] },
  { field: 'met', legend: '실제로 만났어요?', options: [['yes', '만났어요'], ['planned', '약속했어요'], ['no', '아니요']] },
  { field: 'again', legend: '다시 만나고 싶어요?', options: [['yes', '네'], ['unsure', '잘 모르겠어요'], ['no', '아니요']] },
  { field: 'helpful', legend: '이 연결이 도움이 됐어요?', options: [['yes', '네'], ['unsure', '보통이에요'], ['no', '아니요']] },
];

function OutcomeForm({ userId, matchId, initial }: { userId: string; matchId: string; initial: MatchOutcome | null }) {
  const [value, setValue] = useState<Partial<Record<OutcomeField, string | null>>>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (field: OutcomeField, option: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendOutcome(userId, matchId, { [field]: option });
      setValue(prev => ({ ...prev, [field]: option }));
    } catch (e) {
      setError(errorText(e, '저장하지 못했어요. 다시 눌러 주세요.'));
    } finally {
      setBusy(false);
    }
  };
  return <div className="doit-outcome" role="group" aria-label="이 연결은 어땠어요">
    <p className="doit-match-kicker">이 연결은 어땠어요? (나만 보여요)</p>
    {OUTCOME_QUESTIONS.map(q => <fieldset key={q.field}>
      <legend>{q.legend}</legend>
      <div className="doit-outcome-chips">{q.options.map(([opt, label]) => <button key={opt} type="button" aria-pressed={value[q.field] === opt} disabled={busy} onClick={() => void pick(q.field, opt)}>{label}</button>)}</div>
    </fieldset>)}
    {value.met === 'planned' && <div className="doit-meet-safety" role="note" aria-label="만나기 전에">
      <p className="doit-match-kicker">만나기 전에, 짧게</p>
      <MeetSafetyList />
    </div>}
    {error && <p className="doit-product-error" role="alert">{error}</p>}
    <p className="doit-connect-note">다음 후보를 더 잘 준비하는 데만 써요. 상대에게 보이지 않고, 내 소개나 확정한 이야기로 바뀌지 않아요.</p>
  </div>;
}

// 만나기 전 안전 안내 — 「약속했어요」 뒤에도, 이야기 화면에서 만남을 검토할 때도 같은 문장(2026-10-02 §10).
// 「약속했어요」는 사용자가 남기는 기록일 뿐이다. 앱이 만남·상대를 확인하거나 보증한다는 뜻이 아니다.
const MEET_SAFETY = [
  '처음엔 사람이 많은 곳에서 낮에 만나요.',
  '오가는 길은 내가 정하고, 믿는 사람에게 약속 장소를 알려 두세요.',
  '돈·계좌·개인정보를 달라고 하면 만나지 말고 신고해 주세요.',
  '불편하면 언제든 자리를 떠나도 괜찮아요.',
];
function MeetSafetyList() {
  return <ul>{MEET_SAFETY.map(t => <li key={t}>{t}</li>)}</ul>;
}
