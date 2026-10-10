import GuideHint from '@/components/guide/GuideHint';
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { AGENT_PURPOSE_LABELS, agentConfirm, agentTurn, type AgentReceipt, type AgentSession, type AgentSlot } from '@/doit/lib/agentApi';

// 「ECHO가 이해한 나」 확인·정정(2026-09-26 대표 「MVP FINAL PATCH」 §12~§18).
// - 보이는 뜻(note)은 서버(doit-agent)가 사용자 말에서 정리한 것이다. 이 화면은 뜻을 만들거나 고치지 않는다.
// - [조금 달라요] → 다섯 칸 중 하나 → 그 칸만 직접 고친 말을 서버에 보낸다(대화가 끝난 뒤의 정정 턴 · 서버 정정 엔진이 같은 칸의 옛 뜻을 SUPERSEDED 로 거둔다).
// - [그게 아니에요](2026-10-04 대표 디자인 교체 · 네 버튼) → 아닌 칸 하나 → 맞는 내용을 내 말로 → [조금 달라요]와 같은 정정 턴(서버가 그 칸의 옛 뜻을 SUPERSEDED 로 거둬 다시 쓰지 않음 · 원문은 서버가 보존).
// - [직접 설명할게요](예전 「다시 말할게요」) → 짧게 다시 설명한 말을 그대로 보낸다(최신 사용자 원문으로 남는다).
// - 고친 뒤에는 바뀐 부분만 다시 보여 주고 [맞아요] / [다시 고칠게요]. 정정 때문에 다섯 질문을 다시 시작하지 않는다.
// - [맞아요] = 서버 agent_confirm(지금 보이는 AI 정리를 사용자 확인 USER_CONFIRMED 로) + 이 기기 표시. 서버가 없거나 실패하면 기기 표시만(2026-10-06 대표 「기억 영수증」).
// - 정정 뒤 영수증 한 줄(옛 뜻이 아니라 고친 내용으로 기억한다는 서버 고정 문장)은 서버가 저장을 마친 응답(turn.receipt)으로만 보인다 — 화면이 먼저 만들지 않는다(AI 0 · 문장을 화면에 두지 않음).

const ORDER = Object.keys(AGENT_PURPOSE_LABELS);
const SEND_ERROR = '보내지 못했어요. 적은 말은 그대로 있으니 다시 눌러 주세요.';
const NOT_CHANGED = 'ECHO가 이 부분을 아직 바꾸지 못했어요. 조금 다르게 한 번 더 적어 주세요.';
const TEXT_MAX = 300;
export const CHECK_TITLE = '이렇게 이해했는데, 맞나요?'; // 2026-10-04 대표 디자인 교체 문구

type View =
  | { kind: 'review' }
  | { kind: 'pick'; reject?: boolean }
  | { kind: 'edit'; purpose: string; text: string; reject?: boolean }
  | { kind: 'retell'; text: string }
  | { kind: 'recheck'; purpose: string | null; changed: boolean };

const slotOf = (session: AgentSession, id: string): AgentSlot | null => (session.profile?.[id as keyof NonNullable<AgentSession['profile']>] as AgentSlot | undefined) ?? null;
const notesOf = (session: AgentSession, id: string) => (slotOf(session, id)?.items ?? []).map(i => i.note).join('|');
// 지금 보이는 이해 전체의 표시(바뀌면 다시 확인받는다).
const profileSignature = (session: AgentSession) => ORDER.map(id => `${slotOf(session, id)?.status ?? ''}:${notesOf(session, id)}`).join('/');
const okKey = (id: string) => `echo:profile-ok:${id}`;
function profileConfirmed(session: AgentSession): boolean {
  try { return localStorage.getItem(okKey(session.id)) === profileSignature(session); } catch { return false; }
}

// 2026-10-05 대표 「승인 시안과 시각 일치」: 카드 한 장 안에 이해한 뜻만 보인다. 내가 한 말(인용)은 「내가 한 말 보기」를 누르면 보인다(지우지 않음).
const filled = (session: AgentSession, id: string) => slotOf(session, id)?.status === 'CONFIRMED' && (slotOf(session, id)?.items.length ?? 0) > 0;
function SlotLine({ session, id, quotes }: { session: AgentSession; id: string; quotes: boolean }) {
  const slot = slotOf(session, id);
  const items = slot?.status === 'CONFIRMED' ? slot.items : [];
  return <li>
    <b>{AGENT_PURPOSE_LABELS[id]}</b>
    {items.length
      ? items.map((i, k) => <span key={k} className="echo-profile-item">{i.note}{quotes && i.quote && <small>내 말 「{i.quote}」</small>}</span>)
      : <span className="echo-profile-item is-empty">{slot?.status === 'SKIPPED' ? '넘겼어요' : '아직 말하지 않았어요'}</span>}
  </li>;
}

// onCrisis = 고치는 말에 위기 신호가 있어 서버가 안전 안내만 준 경우(stale = 세션이 지난 회차·없음 → 부모가 지금 회차를 다시 불러온다).
interface Props { userId: string; session: AgentSession; onSession: (s: AgentSession) => void; onConfirmed: (ok: boolean) => void; onCrisis: (line: string, stale: boolean) => void }

export default function AgentProfileCheck({ userId, session, onSession, onConfirmed, onCrisis }: Props) {
  const [view, setView] = useState<View>({ kind: 'review' });
  const [ok, setOk] = useState(() => profileConfirmed(session));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<AgentReceipt | null>(null); // 서버 저장 성공 응답에서만
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onConfirmed(ok); }, [ok, onConfirmed]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    let s = session;
    try { s = await agentConfirm(userId, session.id); if (!alive.current) return; onSession(s); } // 서버에 「사용자 확인」으로 남긴다(실패해도 이 기기 표시는 한다)
    catch { /* 예전 서버·일시 오류: 기기 표시만 */ }
    try { localStorage.setItem(okKey(s.id), profileSignature(s)); } catch { /* 저장이 막혀도 이 화면에서는 확인한 것으로 */ }
    if (!alive.current) return;
    setBusy(false); setOk(true); setView({ kind: 'review' }); setReply(null); setReceipt(null);
  };

  const sendFix = async (text: string, purpose: string | null) => {
    const t = text.trim().slice(0, TEXT_MAX);
    if (!t || busy) return;
    const before = purpose ? notesOf(session, purpose) : profileSignature(session);
    setBusy(true); setError(null); setReply(null); setReceipt(null);
    try {
      const r = await agentTurn(userId, session.id, t, { purpose }); // 정정 버튼 = 정정(칸은 사용자가 고른 것 · 서버가 확정)
      if (!alive.current) return;
      // 위기 신호: 정정으로 다루지 않고 부모가 안전 안내를 보인다(세션이 없으면 지금 회차를 다시 불러옴) · Codex P1
      if (r.turn.kind === 'crisis') { if (r.session) onSession(r.session); onCrisis(r.turn.reply, !r.session); setView({ kind: 'review' }); return; }
      if (!r.session) throw new Error('INVALID_RESPONSE');
      onSession(r.session);
      if (r.turn.reply) setReply(r.turn.reply);
      if (r.turn.receipt?.line) setReceipt(r.turn.receipt); // 서버가 저장을 마쳤다는 응답 뒤에만
      const after = purpose ? notesOf(r.session, purpose) : profileSignature(r.session);
      setView({ kind: 'recheck', purpose, changed: after !== before });
    } catch (e) {
      if (alive.current) setError(e instanceof UnderstandingError && e.code === 'RATE_LIMITED' ? e.message : SEND_ERROR);
    } finally { if (alive.current) setBusy(false); }
  };

  const [quotes, setQuotes] = useState(false);
  // 말한 칸만 줄로 · 아직 말하지 않은(넘긴) 칸은 맨 아래 한 줄로 모은다(칸 이름은 그대로 보임 · 고치기에서 다섯 칸 모두 고를 수 있음).
  const list = (ids: string[]) => {
    const shown = ids.length === 1 ? ids : ids.filter(id => filled(session, id));
    const rest = ids.length === 1 ? [] : ids.filter(id => !filled(session, id));
    const hasQuote = shown.some(id => (slotOf(session, id)?.items ?? []).some(i => !!i.quote));
    return <div className="echo-profile-card">
      <ol className="echo-done-next echo-profile-list" aria-label="ECHO가 이해한 나">{shown.map(id => <SlotLine key={id} session={session} id={id} quotes={quotes} />)}</ol>
      {rest.length > 0 && <p className="echo-profile-rest">아직 말하지 않은 것 · {rest.map(id => AGENT_PURPOSE_LABELS[id]).join(' · ')}</p>}
      {hasQuote && <button type="button" className="echo-text-button echo-profile-quotes" aria-expanded={quotes} onClick={() => setQuotes(v => !v)}>{quotes ? '내가 한 말 접기' : '내가 한 말 보기'}</button>}
    </div>;
  };

  // 2026-10-04 모바일 기준 디자인 4번: 제목(맞나요?) → 이해한 내용 카드 → 네 버튼(맞아요 = 흰 판) 순으로 보인다(배치는 chat-ref.css 의 order).
  return <section className="echo-done echo-check" aria-label="ECHO가 이해한 나" aria-busy={busy}>
    <p className="echo-done-mark">ECHO가 이해한 나</p>
    {view.kind === 'review' && <p className="echo-context">ECHO가 대화를 바탕으로 작성한 초안이에요. 내가 말하지 않은 건 채우지 않았어요.</p>}

    {/* 2026-10-10 대표 「모바일웹 전부 최종 후킹」: 확인·수정 장면 확정 후킹(2026-10-09). 네 버튼·질문(CHECK_TITLE)은 그대로. */}
    {view.kind === 'review' && !ok && <p className="echo-flora-hook">내 뜻과 다르면,<br />바로 고칠 수 있어요.</p>}
    {view.kind === 'review' && !ok && <p className="echo-flora-hook-sub">당신이 직접 들려준 이야기가 이해와 추천의 기준이 됩니다.</p>}
    {view.kind === 'review' && !ok && <p className="echo-done-title">{CHECK_TITLE}</p>}
    {/* 2026-10-04 이용 안내: 처음 한 번 짧은 도움말 → 그 뒤 「이 기능이 궁금해요」 (확인 단계에서만) */}
    {view.kind === 'review' && !ok && <GuideHint id="check" />}
    {ok && view.kind === 'review' ? <>
      {list(ORDER)}
      <p className="echo-done-lead"><Check size={16} aria-hidden="true" /> 맞다고 확인했어요.</p>
      <button type="button" className="echo-text-button" onClick={() => { setOk(false); setView({ kind: 'pick' }); }}>그래도 고칠 게 있어요</button>
      <Link className="echo-text-button echo-known-link" to="/doit/understanding">ECHO가 아는 나 보기</Link>
    </> : view.kind === 'review' ? <>
      {list(ORDER)}
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={busy} onClick={() => void confirm()}>맞아요</button>
        <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView({ kind: 'pick' })}>조금 달라요</button>
        <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView({ kind: 'pick', reject: true })}>그게 아니에요</button>
        <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView({ kind: 'retell', text: '' })}>직접 설명할게요</button>
      </div>
    </> : view.kind === 'pick' ? <>
      <p className="echo-done-lead">{view.reject ? '어느 부분이 아닌가요?' : '어느 부분이 다른가요?'}</p>
      <div className="echo-done-actions">
        {ORDER.map(id => <button key={id} type="button" className="echo-secondary" onClick={() => setView({ kind: 'edit', purpose: id, text: '', reject: view.reject })}>{AGENT_PURPOSE_LABELS[id]}</button>)}
        <button type="button" className="echo-text-button" onClick={() => setView({ kind: 'review' })}>돌아가기</button>
      </div>
    </> : view.kind === 'edit' ? <>
      {list([view.purpose])}
      <label className="echo-check-label" htmlFor="echo-profile-fix">{view.reject
        ? <>「{AGENT_PURPOSE_LABELS[view.purpose]}」는 그렇게 이해하지 않을게요. 맞는 내용을 내 말로 적어 주세요.</>
        : <>「{AGENT_PURPOSE_LABELS[view.purpose]}」를 내 말로 고쳐 주세요. 내가 고친 말이 가장 먼저예요.</>}</label>
      <textarea id="echo-profile-fix" value={view.text} maxLength={TEXT_MAX} rows={3} disabled={busy} onChange={e => setView({ ...view, text: e.target.value.slice(0, TEXT_MAX) })} />
      <div className="echo-done-actions">
        {/* 사용자가 고른 칸은 정정 표시(correction.purpose)로 따로 보낸다 · 문장은 사용자 것 그대로(2026-09-27 P0-5). */}
        <button type="button" className="echo-primary" disabled={busy || !view.text.trim()} onClick={() => void sendFix(view.text.trim(), view.purpose)}>이렇게 고칠게요</button>
        <button type="button" className="echo-text-button" disabled={busy} onClick={() => setView({ kind: 'pick', reject: view.reject })}>다른 부분 고르기</button>
      </div>
    </> : view.kind === 'retell' ? <>
      <label className="echo-check-label" htmlFor="echo-profile-retell">원하는 걸 짧게 다시 말해 주세요. 새로 말한 것이 가장 먼저예요.</label>
      <textarea id="echo-profile-retell" value={view.text} maxLength={TEXT_MAX} rows={4} disabled={busy} onChange={e => setView({ ...view, text: e.target.value.slice(0, TEXT_MAX) })} />
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={busy || !view.text.trim()} onClick={() => void sendFix(view.text, null)}>이렇게 말할게요</button>
        <button type="button" className="echo-text-button" disabled={busy} onClick={() => setView({ kind: 'review' })}>돌아가기</button>
      </div>
    </> : <>
      {/* 기억 영수증: 서버 고정 문장(저장 성공 뒤에만 · AI 0) */}
      {receipt && <p className="echo-done-lead echo-receipt" role="status" data-testid="memory-receipt"><Check size={16} aria-hidden="true" /> {receipt.line}</p>}
      {reply && <p className="echo-done-lead">{reply}</p>}
      {view.changed ? <>
        {list(view.purpose ? [view.purpose] : ORDER)}
        <p className="echo-done-lead">{CHECK_TITLE}</p>
        <div className="echo-done-actions">
          <button type="button" className="echo-primary" disabled={busy} onClick={() => void confirm()}>맞아요</button>
          <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView(view.purpose ? { kind: 'edit', purpose: view.purpose, text: '' } : { kind: 'retell', text: '' })}>다시 고칠게요</button>
        </div>
      </> : <>
        <p className="echo-done-lead">{NOT_CHANGED}</p>
        <div className="echo-done-actions">
          <button type="button" className="echo-primary" disabled={busy} onClick={() => setView(view.purpose ? { kind: 'edit', purpose: view.purpose, text: '' } : { kind: 'retell', text: '' })}>다시 적을게요</button>
          <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView({ kind: 'review' })}>전체 다시 보기</button>
        </div>
      </>}
    </>}
    {busy && <p className="echo-fine" role="status">ECHO가 고친 말을 이해하고 있어요…</p>}
    {error && <p className="echo-error" role="alert">{error}</p>}
  </section>;
}
