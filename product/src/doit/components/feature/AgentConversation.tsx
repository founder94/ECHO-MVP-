import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronRight, RotateCcw, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import SymbolLoader from '@/components/SymbolLoader';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { AGENT_PURPOSE_LABELS, AGENT_TONES, DEFAULT_AGENT_TONE, agentGet, agentStart, agentTurn, type AgentMode, type AgentSession, type AgentTone } from '@/doit/lib/agentApi';
import './core-conversation.css';
import './agent-conversation.css';

interface Props {
  userId: string;
  // 첫 질문(목적 타일 화면)의 답: 고른 만남 + 한 줄. 이번 회차에 대화가 이미 있으면 쓰지 않는다.
  firstAnswer: string | null;
  onRestart: () => Promise<string | null>;
  onContinue: () => void;
  // 앱 홈 「처음부터 다시 시작하기」(?restart=1)로 들어오면 확인 창을 연 채로 연다.
  restartPrompt?: boolean;
}

const TEXT_MAX = 1000;
const SEND_ERROR = '보내지 못했어요. 적은 말은 그대로 있으니 다시 보내 주세요.';
const LOAD_ERROR = '대화를 불러오지 못했어요. 인터넷이 잘 되는지 보고 다시 시도해 주세요.';
const PURPOSE_ORDER = Object.keys(AGENT_PURPOSE_LABELS);
// 빠져나갈 문: 사용자가 누르면 그 말을 그대로 보낸다(서버·AI 가 넘기기·그만하기로 읽는다). 고정 질문이 아니다.
const SKIP_TEXT = '이 질문은 넘어갈게요';
const STOP_TEXT = '오늘은 여기까지 할게요';

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
function speak(text: string) {
  if (!canSpeak() || !text.trim()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    window.speechSynthesis.speak(u);
  } catch { /* 읽기 실패는 글로 이어 간다 */ }
}

// ECHO Conversation Agent 화면. 질문·진행·저장은 서버(doit-agent)가 정한다. 이 화면은 보이고 보내기만 한다.
export default function AgentConversation({ userId, firstAnswer, onRestart, onContinue, restartPrompt = false }: Props) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tone, setTone] = useState<AgentTone>(DEFAULT_AGENT_TONE);
  const [mode, setMode] = useState<AgentMode>('TEXT');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartArmed, setRestartArmed] = useState(restartPrompt);
  const alive = useRef(true);
  const inFlight = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (canSpeak()) window.speechSynthesis.cancel(); }; }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await agentGet(userId);
      if (!alive.current) return;
      setSession(s); setLoaded(true);
    } catch {
      if (alive.current) setLoadError(LOAD_ERROR);
    }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }); }, [session?.messages.length]);

  const run = async (label: string, job: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(label); setError(null);
    try { await job(); } catch (e) {
      if (!alive.current) return;
      if (e instanceof UnderstandingError && (e.code === 'REQUEST_CONFLICT' || e.code === 'ROUND_CHANGED' || e.code === 'NOT_FOUND')) { await load(); setError('화면을 새로 불러왔어요. 이어서 적어 주세요.'); }
      else setError(e instanceof UnderstandingError && e.code === 'RATE_LIMITED' ? e.message : SEND_ERROR);
    } finally { inFlight.current = false; if (alive.current) setBusy(null); }
  };

  // 새 AI 말만 읽어 준다(말로 대화하기). 사용자가 보낸 뒤 받은 말만 — 불러온 지난 대화는 읽지 않는다.
  const speakNew = (before: AgentSession | null, after: AgentSession) => {
    if (after.mode !== 'VOICE') return;
    const fresh = after.messages.slice(before?.messages.length ?? 0).filter(m => m.role === 'ai').map(m => m.text).join(' ');
    speak(fresh);
  };

  const start = () => void run('첫 이야기를 듣고 있어요', async () => {
    if (mode === 'VOICE') speak(' '); // 아이폰은 첫 소리를 누름 안에서 시작해야 한다
    const s = await agentStart(userId, { tone, mode, ...(firstAnswer ? { firstAnswer } : {}) });
    if (!alive.current) return;
    speakNew(null, s); setSession(s);
  });

  const send = (text: string) => {
    const t = text.trim();
    if (!session || !t) return;
    void run('듣고 있어요', async () => {
      const r = await agentTurn(userId, session.id, t.slice(0, TEXT_MAX));
      if (!alive.current) return;
      speakNew(session, r.session); setSession(r.session);
      setDraft(prev => (prev.trim() === t ? '' : prev));
    });
  };

  const restart = () => void run('처음부터 준비하고 있어요', async () => {
    const failure = await onRestart();
    if (failure && alive.current) setError(failure);
  });

  const header = <header className="echo-dialogue-header"><DoItSymbol decorative /><span>DO IT / ECHO</span><Link to="/doit/home">홈</Link></header>;
  const restartConfirm = <div className="echo-restart" role="group" aria-label="처음부터 시작하기"><p className="echo-context">지금 대화를 여기서 끝내고 처음부터 다시 시작할까요? 지난 이야기는 지우지 않아요.</p><div className="echo-reactions"><button disabled={!!busy} onClick={() => setRestartArmed(false)}>계속할게요</button><button disabled={!!busy} onClick={restart}>처음부터 시작할게요</button></div></div>;
  const restartButton = restartArmed ? restartConfirm : <div className="echo-restart-top"><button className="echo-restart-pill" disabled={!!busy} onClick={() => setRestartArmed(true)}><RotateCcw size={14} aria-hidden="true" />처음부터 시작하기</button></div>;

  if (!loaded) return <section className="echo-dialogue echo-dialogue--pastel echo-agent" aria-busy={!loadError}>
    {header}
    {loadError ? <div className="echo-error" role="alert"><p>{loadError}</p><button onClick={() => void load()}>다시 불러오기</button></div> : <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>대화를 불러오고 있어요</p></div>}
  </section>;

  // ── 시작 전: 말투·방식 고르기(기본 = 편한 존댓말 · 글로).
  if (!session) return <section className="echo-dialogue echo-dialogue--pastel echo-agent" aria-busy={!!busy}>
    {header}
    <p className="echo-eyebrow">시작하기 전에</p>
    <h1>어떤 말투로<br />이야기할까요?</h1>
    <p className="echo-lead">핵심 질문은 다섯 개까지만 해요. 대화가 끝날 때까지 이 말투를 지킬게요.</p>
    <div className="echo-opening-tiles echo-agent-choices" role="radiogroup" aria-label="말투">
      {AGENT_TONES.map(t => <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} className={tone === t.id ? 'echo-opening-tile is-selected' : 'echo-opening-tile'} disabled={!!busy} onClick={() => setTone(t.id)}>
        <span className="echo-opening-tile-label">{t.label}</span><span className="echo-opening-tile-desc">{t.hint}</span>
      </button>)}
    </div>
    <p className="echo-eyebrow echo-agent-subhead">어떻게 이야기할까요?</p>
    <div className="echo-opening-tiles echo-agent-choices echo-agent-choices--two" role="radiogroup" aria-label="이야기 방식">
      <button type="button" role="radio" aria-checked={mode === 'TEXT'} className={mode === 'TEXT' ? 'echo-opening-tile is-selected' : 'echo-opening-tile'} disabled={!!busy} onClick={() => setMode('TEXT')}><span className="echo-opening-tile-label">글로</span><span className="echo-opening-tile-desc">적어서 이야기해요</span></button>
      <button type="button" role="radio" aria-checked={mode === 'VOICE'} className={mode === 'VOICE' ? 'echo-opening-tile is-selected' : 'echo-opening-tile'} disabled={!!busy} onClick={() => setMode('VOICE')}><span className="echo-opening-tile-label">말로</span><span className="echo-opening-tile-desc">ECHO 대답을 소리로 들어요</span></button>
    </div>
    {mode === 'VOICE' && <p className="echo-fine">{canSpeak() ? '말할 때는 휴대폰 키보드의 마이크 버튼을 눌러 주세요. 말한 내용은 글자로 적혀 보내져요. 목소리는 저장하지 않아요.' : '이 기기에서는 소리로 읽을 수 없어요. 글로 이어 갈게요.'}</p>}
    {error && <div className="echo-error" role="alert"><p>{error}</p></div>}
    {busy ? <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>{busy}</p></div>
      : <button className="echo-primary" onClick={start}>이렇게 시작하기 <ChevronRight size={18} /></button>}
    <footer className="echo-dialogue-footer">{restartButton}</footer>
  </section>;

  const done = session.phase === 'done';
  const lastAi = [...session.messages].reverse().find(m => m.role === 'ai')?.text ?? '';
  const profile = session.profile;
  const composer = <form className="echo-composer" onSubmit={event => { event.preventDefault(); if (!busy && draft.trim()) send(draft); }}>
    <label htmlFor="echo-agent-message">{done ? '고칠 게 있으면 적어 주세요' : session.mode === 'VOICE' ? '키보드의 마이크를 눌러 말해 주세요' : '짧아도 괜찮아요'}</label>
    <textarea id="echo-agent-message" value={draft} onChange={event => setDraft(event.target.value.slice(0, TEXT_MAX))} placeholder="생각나는 대로 한 줄" maxLength={TEXT_MAX} rows={3} disabled={!!busy} />
    <div className="echo-composer-footer"><span>적은 말은 나만 봐요. 프로필에 저절로 올라가지 않아요.</span><button type="submit" aria-label="보내기" disabled={!!busy || !draft.trim()}><ArrowUp size={20} /></button></div>
  </form>;

  return <section className="echo-dialogue echo-dialogue--pastel echo-agent" aria-busy={!!busy}>
    {header}
    {!done && <div className="echo-steps" role="status" aria-label={`핵심 질문 ${session.progress.of}개 중 ${session.progress.asked}번째`}>
      <span className="echo-steps-count">{session.progress.asked} <em>/ {session.progress.of}</em></span>
      <span className="echo-steps-bar" aria-hidden="true"><i style={{ width: `${(Math.max(session.progress.asked - 1, 0) / session.progress.of) * 100}%` }} /></span>
    </div>}
    {!done && restartButton}
    <p className="echo-eyebrow">{done ? '다 들었어요' : '대화 중'}</p>
    <ol className="echo-agent-log" aria-live="polite">
      {session.messages.map((m, k) => <li key={k} className={m.role === 'user' ? 'echo-agent-msg is-user' : k === session.messages.length - 1 && !done ? 'echo-agent-msg is-ai is-current' : 'echo-agent-msg is-ai'}>
        {m.role === 'ai' && k === session.messages.length - 1 && !done ? <p className="echo-question">{m.text}</p> : <p>{m.text}</p>}
      </li>)}
    </ol>
    <div ref={endRef} />
    {session.mode === 'VOICE' && canSpeak() && lastAi && <button type="button" className="echo-text-button echo-agent-listen" disabled={!!busy} onClick={() => speak(lastAi)}><Volume2 size={14} aria-hidden="true" /> 다시 듣기</button>}
    {error && <div className="echo-error" role="alert"><p>{error}</p></div>}
    {busy && <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>{busy}</p></div>}
    {!done && composer}
    {!done && <div className="echo-agent-exits"><button type="button" className="echo-text-button" disabled={!!busy} onClick={() => send(SKIP_TEXT)}>이 질문 넘어가기</button><button type="button" className="echo-text-button" disabled={!!busy} onClick={() => send(STOP_TEXT)}>여기까지 할게요</button></div>}
    {done && <section className="echo-done">
      <p className="echo-done-mark"><Check size={18} /> 이번 대화를 정리했어요.</p>
      {profile && <ul className="echo-agent-profile" aria-label="내가 말한 것">
        {PURPOSE_ORDER.map(id => { const slot = profile[id as keyof typeof profile] as { status: string; items: { note: string }[] } | undefined; if (!slot) return null;
          return <li key={id}><span>{AGENT_PURPOSE_LABELS[id]}</span><p>{slot.status === 'CONFIRMED' ? slot.items.map(i => i.note).join(' · ') : slot.status === 'SKIPPED' ? '넘겼어요' : '아직 몰라요'}</p></li>; })}
      </ul>}
      <p className="echo-context">내가 직접 말한 것만 적었어요. AI 추측은 넣지 않았어요. 지금은 이 정리로 바로 누군가와 연결되지는 않아요.</p>
      <div className="echo-done-actions">
        <button className="echo-primary" disabled={!!busy} onClick={onContinue}>사진과 소개 채우기 <ChevronRight size={18} /></button>
        <Link className="echo-secondary" to="/doit/connections">연결까지 남은 것 보기 <ChevronRight size={18} /></Link>
        {restartArmed ? restartConfirm : <button className="echo-secondary" disabled={!!busy} onClick={() => setRestartArmed(true)}>처음부터 시작하기</button>}
      </div>
    </section>}
    {done && composer}
  </section>;
}
