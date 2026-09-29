import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { agentIntro, agentIntroMark, type AgentSession } from '@/doit/lib/agentApi';
import { loadProfile, saveIntroText } from '@/doit/lib/profileSave';
import { INTRO_MAX } from '@/doit/lib/introDraft';

// 대화 끝 화면의 「내 소개 초안」(2026-09-25 대표 MASTER §4·§5·§19).
// - 문장은 서버(doit-agent v1.6)가 대화를 마칠 때 같은 호출에서 쓴다. 이 화면은 문장을 만들거나 고치지 않는다.
// - 사용자가 고른다: 「이대로 사용할게요」 / 「조금 고칠게요」 / 직접 쓰기. 저장은 내 소개(profiles.bio) 한 칸뿐이고, 사용자가 누를 때만.
// - 출처를 나눠 보인다: AI가 대화에서 정리(확인 필요) → 내가 확인함 / 내가 고침 / 내가 직접 씀. 이미 적은 소개가 있으면 바뀐다고 먼저 알린다.
// - 막히면 빠져나갈 문: AI 가 못 쓰면 바로 직접 쓰기. 저장이 실패하면 적은 글은 그대로 남는다.

type How = 'as_is' | 'edited' | 'own';
type View = { kind: 'draft' } | { kind: 'edit'; text: string; from: 'ai' | 'own' } | { kind: 'saved'; how: How; text: string };

const SOURCE: Record<How, string> = { as_is: 'AI가 대화에서 정리 · 내가 확인함', edited: 'AI 초안을 내가 고침', own: '내가 직접 씀' };
const SAVE_ERROR = '소개를 저장하지 못했어요. 적은 글은 그대로 있으니 다시 눌러 주세요.';
const DRAFT_ERROR = 'AI가 지금은 소개를 쓰지 못했어요. 직접 써도 돼요.';

interface Props { userId: string; session: AgentSession; onSession: (s: AgentSession) => void; onSaved?: () => void }

export default function AgentIntroCard({ userId, session, onSession, onSaved }: Props) {
  const intro = session.intro ?? null;
  const [view, setView] = useState<View>(() => intro?.used ? { kind: 'saved', how: intro.used, text: '' } : { kind: 'draft' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null); // 이미 저장된 내 소개(덮어쓰기 전에 알린다)
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    void loadProfile(userId).then(r => { if (alive.current && r.status === 'ok') setExisting(r.profile?.intro?.trim() || null); }).catch(() => undefined);
  }, [userId]);

  const save = async (text: string, how: How) => {
    const clean = text.trim().slice(0, INTRO_MAX);
    if (!clean || busy) return;
    setBusy('소개에 넣고 있어요'); setError(null);
    const err = await saveIntroText(userId, clean);
    if (!alive.current) return;
    if (err) { setBusy(null); setError(SAVE_ERROR); return; }
    setExisting(clean);
    setView({ kind: 'saved', how, text: clean });
    setBusy(null);
    onSaved?.();
    // 출처 기록은 저장 뒤에 한 번. 실패해도 소개 저장은 이미 끝났으니 화면을 막지 않는다(관리자 관측만 빠진다).
    try { onSession(await agentIntroMark(userId, session.id, how)); } catch { /* 출처 기록 실패는 사용자에게 영향 없음 */ }
  };

  const redraft = async () => {
    if (busy) return;
    setBusy('AI가 다시 쓰고 있어요'); setError(null);
    try {
      const r = await agentIntro(userId, session.id);
      if (!alive.current) return;
      onSession(r.session);
      if (r.limited || r.session.intro?.status !== 'ready') setError(DRAFT_ERROR);
    } catch { if (alive.current) setError(DRAFT_ERROR); }
    finally { if (alive.current) setBusy(null); }
  };

  const ready = intro?.status === 'ready' && !!intro.text;
  const replaceNote = existing ? <p className="echo-fine">지금 있는 내 소개가 이 글로 바뀌어요.</p> : null;

  return <section className="echo-done" aria-label="내 소개 초안" aria-busy={!!busy}>
    <p className="echo-done-mark">내 소개</p>
    {view.kind === 'saved' ? <>
      <p className="echo-done-lead"><Check size={16} aria-hidden="true" /> 소개에 넣었어요.</p>
      {view.text && <p className="echo-done-lead">{view.text}</p>}
      <p className="echo-context">{SOURCE[view.how]} · 프로필에서 언제든 고칠 수 있어요.</p>
    </> : view.kind === 'edit' ? <>
      <label className="echo-context" htmlFor="echo-intro-edit">{view.from === 'ai' ? 'AI 초안을 고쳐 주세요. 내가 고친 글이 가장 먼저예요.' : '나를 두세 문장으로 소개해 주세요.'}</label>
      <textarea id="echo-intro-edit" value={view.text} maxLength={INTRO_MAX} rows={5} disabled={!!busy}
        onChange={e => setView({ ...view, text: e.target.value.slice(0, INTRO_MAX) })} />
      <p className="echo-fine">{view.text.length}/{INTRO_MAX}</p>
      {replaceNote}
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={!!busy || !view.text.trim()}
          onClick={() => void save(view.text, view.from === 'own' ? 'own' : view.text.trim() === intro?.text.trim() ? 'as_is' : 'edited')}>이렇게 저장할게요</button>
        <button type="button" className="echo-secondary" disabled={!!busy} onClick={() => { setError(null); setView({ kind: 'draft' }); }}>그만 고칠게요</button>
      </div>
    </> : ready ? <>
      <p className="echo-context">AI가 대화에서 정리 · 확인 필요 — 내가 한 말로만 썼어요.</p>
      <p className="echo-done-lead">{intro!.text}</p>
      {replaceNote}
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={!!busy} onClick={() => void save(intro!.text, 'as_is')}>이대로 사용할게요</button>
        <button type="button" className="echo-secondary" disabled={!!busy} onClick={() => setView({ kind: 'edit', text: intro!.text, from: 'ai' })}>조금 고칠게요</button>
        <button type="button" className="echo-text-button" disabled={!!busy} onClick={() => setView({ kind: 'edit', text: '', from: 'own' })}>직접 쓸게요</button>
      </div>
    </> : !intro ? <>
      {/* 소개 초안 기능 전에 끝난 대화: 들은 말로 한 번 써 볼 수 있다(AI 1번). */}
      <p className="echo-done-lead">대화에서 들은 말로 소개를 써 볼 수 있어요.</p>
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={!!busy} onClick={() => void redraft()}>AI로 소개 써 보기</button>
        <button type="button" className="echo-secondary" disabled={!!busy} onClick={() => setView({ kind: 'edit', text: '', from: 'own' })}>직접 쓰기</button>
      </div>
    </> : <>
      <p className="echo-done-lead">{intro.status === 'none' ? '소개를 쓸 만한 말이 아직 적어요. 직접 한 줄 써 볼까요?' : DRAFT_ERROR}</p>
      <div className="echo-done-actions">
        <button type="button" className="echo-primary" disabled={!!busy} onClick={() => setView({ kind: 'edit', text: '', from: 'own' })}>직접 쓰기</button>
        {intro.status === 'failed' && intro.tries_left > 0 && <button type="button" className="echo-secondary" disabled={!!busy} onClick={() => void redraft()}>AI로 한 번 더 써 보기</button>}
      </div>
    </>}
    {busy && <p className="echo-fine" role="status">{busy}…</p>}
    {error && <p className="echo-error" role="alert">{error}</p>}
  </section>;
}
