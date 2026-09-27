import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { AGENT_PURPOSE_LABELS, agentTurn, type AgentSession, type AgentSlot } from '@/doit/lib/agentApi';

// 「ECHO가 이해한 나」 확인·정정(2026-09-26 대표 「MVP FINAL PATCH」 §12~§18).
// - 보이는 뜻(note)은 서버(doit-agent)가 사용자 말에서 정리한 것이다. 이 화면은 뜻을 만들거나 고치지 않는다.
// - [조금 달라요] → 다섯 칸 중 하나 → 그 칸만 직접 고친 말을 서버에 보낸다(대화가 끝난 뒤의 정정 턴 · 서버 정정 엔진이 같은 칸의 옛 뜻을 SUPERSEDED 로 거둔다).
// - [다시 말할게요] → 짧게 다시 설명한 말을 그대로 보낸다(최신 사용자 원문으로 남는다).
// - 고친 뒤에는 바뀐 부분만 다시 보여 주고 [맞아요] / [다시 고칠게요]. 정정 때문에 다섯 질문을 다시 시작하지 않는다.
// - [맞아요] 는 지금 이 화면(이 기기)에만 기억한다: 운영 서버 v2.2 에는 「사용자 확인」 기록 동작이 없다(서버 변경은 대표 승인 뒤).

const ORDER = Object.keys(AGENT_PURPOSE_LABELS);
const SEND_ERROR = '보내지 못했어요. 적은 말은 그대로 있으니 다시 눌러 주세요.';
const NOT_CHANGED = 'ECHO가 이 부분을 아직 바꾸지 못했어요. 조금 다르게 한 번 더 적어 주세요.';
const TEXT_MAX = 300;

type View =
  | { kind: 'review' }
  | { kind: 'pick' }
  | { kind: 'edit'; purpose: string; text: string }
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

function SlotLine({ session, id }: { session: AgentSession; id: string }) {
  const slot = slotOf(session, id);
  const items = slot?.status === 'CONFIRMED' ? slot.items : [];
  return <li>
    <b>{AGENT_PURPOSE_LABELS[id]}</b>
    {items.length
      ? items.map((i, k) => <span key={k} className="echo-profile-item">{i.note}{i.quote && <small>내 말 「{i.quote}」</small>}</span>)
      : <span className="echo-profile-item is-empty">{slot?.status === 'SKIPPED' ? '넘겼어요' : '아직 말하지 않았어요'}</span>}
  </li>;
}

interface Props { userId: string; session: AgentSession; onSession: (s: AgentSession) => void; onConfirmed: (ok: boolean) => void }

export default function AgentProfileCheck({ userId, session, onSession, onConfirmed }: Props) {
  const [view, setView] = useState<View>({ kind: 'review' });
  const [ok, setOk] = useState(() => profileConfirmed(session));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onConfirmed(ok); }, [ok, onConfirmed]);

  const confirm = () => {
    try { localStorage.setItem(okKey(session.id), profileSignature(session)); } catch { /* 저장이 막혀도 이 화면에서는 확인한 것으로 */ }
    setOk(true); setView({ kind: 'review' }); setReply(null);
  };

  const sendFix = async (text: string, purpose: string | null) => {
    const t = text.trim().slice(0, TEXT_MAX);
    if (!t || busy) return;
    const before = purpose ? notesOf(session, purpose) : profileSignature(session);
    setBusy(true); setError(null); setReply(null);
    try {
      const r = await agentTurn(userId, session.id, t);
      if (!alive.current) return;
      onSession(r.session);
      if (r.turn.reply) setReply(r.turn.reply);
      const after = purpose ? notesOf(r.session, purpose) : profileSignature(r.session);
      setView({ kind: 'recheck', purpose, changed: after !== before });
    } catch (e) {
      if (alive.current) setError(e instanceof UnderstandingError && (e.code === 'RATE_LIMITED' || e.code === 'OFFLINE' || e.code === 'TIMEOUT') ? e.message : SEND_ERROR);
    } finally { if (alive.current) setBusy(false); }
  };

  const list = (ids: string[]) => <ol className="echo-done-next echo-profile-list" aria-label="ECHO가 이해한 나">{ids.map(id => <SlotLine key={id} session={session} id={id} />)}</ol>;

  return <section className="echo-done" aria-label="ECHO가 이해한 나" aria-busy={busy}>
    <p className="echo-done-mark">ECHO가 이해한 나</p>
    <p className="echo-context">ECHO가 대화를 바탕으로 작성한 초안이에요. 내가 말하지 않은 건 채우지 않았어요.</p>

    {ok && view.kind === 'review' ? <>
      {list(ORDER)}
      <p className="echo-done-lead"><Check size={16} aria-hidden="true" /> 맞다고 확인했어요.</p>
      <button type="button" className="echo-text-button" onClick={() => { setOk(false); setView({ kind: 'pick' }); }}>그래도 고칠 게 있어요</button>
    </> : view.kind === 'review' ? <>
      {list(ORDER)}
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={busy} onClick={confirm}>맞아요</button>
        <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView({ kind: 'pick' })}>조금 달라요</button>
        <button type="button" className="echo-secondary" disabled={busy} onClick={() => setView({ kind: 'retell', text: '' })}>다시 말할게요</button>
      </div>
    </> : view.kind === 'pick' ? <>
      <p className="echo-done-lead">어느 부분이 다른가요?</p>
      <div className="echo-done-actions">
        {ORDER.map(id => <button key={id} type="button" className="echo-secondary" onClick={() => setView({ kind: 'edit', purpose: id, text: '' })}>{AGENT_PURPOSE_LABELS[id]}</button>)}
        <button type="button" className="echo-text-button" onClick={() => setView({ kind: 'review' })}>돌아가기</button>
      </div>
    </> : view.kind === 'edit' ? <>
      {list([view.purpose])}
      <label className="echo-context" htmlFor="echo-profile-fix">「{AGENT_PURPOSE_LABELS[view.purpose]}」를 내 말로 고쳐 주세요. 내가 고친 말이 가장 먼저예요.</label>
      <textarea id="echo-profile-fix" value={view.text} maxLength={TEXT_MAX} rows={3} disabled={busy} onChange={e => setView({ ...view, text: e.target.value.slice(0, TEXT_MAX) })} />
      <div className="echo-done-actions">
        {/* 서버가 어느 칸인지 알도록 칸 이름을 앞에 붙여 보낸다(사용자가 고른 칸 · 문장은 사용자 것 그대로). */}
        <button type="button" className="echo-primary" disabled={busy || !view.text.trim()} onClick={() => void sendFix(`「${AGENT_PURPOSE_LABELS[view.purpose]}」 부분을 고칠게요. ${view.text.trim()}`, view.purpose)}>이렇게 고칠게요</button>
        <button type="button" className="echo-text-button" disabled={busy} onClick={() => setView({ kind: 'pick' })}>다른 부분 고르기</button>
      </div>
    </> : view.kind === 'retell' ? <>
      <label className="echo-context" htmlFor="echo-profile-retell">원하는 걸 짧게 다시 말해 주세요. 새로 말한 것이 가장 먼저예요.</label>
      <textarea id="echo-profile-retell" value={view.text} maxLength={TEXT_MAX} rows={4} disabled={busy} onChange={e => setView({ ...view, text: e.target.value.slice(0, TEXT_MAX) })} />
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={busy || !view.text.trim()} onClick={() => void sendFix(view.text, null)}>이렇게 말할게요</button>
        <button type="button" className="echo-text-button" disabled={busy} onClick={() => setView({ kind: 'review' })}>돌아가기</button>
      </div>
    </> : <>
      {reply && <p className="echo-done-lead">{reply}</p>}
      {view.changed ? <>
        {list(view.purpose ? [view.purpose] : ORDER)}
        <p className="echo-done-lead">이렇게 이해하면 맞을까요?</p>
        <div className="echo-done-actions">
          <button type="button" className="echo-primary" disabled={busy} onClick={confirm}>맞아요</button>
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
