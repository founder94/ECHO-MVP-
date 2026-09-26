import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronRight, Mic, RotateCcw, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import SymbolLoader from '@/components/SymbolLoader';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { DEFAULT_AGENT_TONE, agentGet, agentStart, agentTurn, type AgentMode, type AgentSession, type AgentTone } from '@/doit/lib/agentApi';
import './core-conversation.css';
import AgentChoiceLayer from './AgentChoiceLayer';
import AgentIntroCard from './AgentIntroCard';
import InstallAppCard from './InstallAppCard';
import AgentProfileCheck from './AgentProfileCheck';
import MusicMoment from './MusicMoment';
import { VOICE_CONVERSATION_ENABLED, takeAgentChoice, type AgentChoice } from '@/doit/lib/agentChoice';
import { VOICE_INPUT_ERROR_TEXT, useVoiceInput, useVoiceTurn } from '@/doit/lib/voiceInput';
import { announceVoiceActive, canSpeak, speakText, stopSpeaking, unlockSpeech } from '@/doit/lib/voiceOutput';
import { takeContentSeed } from '@/doit/lib/contentSeed';

interface Props {
  userId: string;
  // 첫 질문(목적 타일 화면)의 답: 고른 만남 + 한 줄. 이번 회차에 대화가 이미 있으면 쓰지 않는다.
  firstAnswer: string | null;
  // 고른 만남(기존 대화 화면 제목에 쓴다). 없으면 제목만 짧게.
  purposeLabel?: string | null;
  onRestart: () => Promise<string | null>;
  onContinue: () => void;
  // 앱 홈 「처음부터 다시 시작하기」(?restart=1)로 들어오면 확인 창을 연 채로 연다.
  restartPrompt?: boolean;
}

const TEXT_MAX = 1000;
const SEND_ERROR = '보내지 못했어요. 적은 말은 그대로 있으니 다시 보내 주세요.';
const LOAD_ERROR = '대화를 불러오지 못했어요. 인터넷이 잘 되는지 보고 다시 시도해 주세요.';
// 빠져나갈 문: 사용자가 누르면 그 말을 그대로 보낸다(서버·AI 가 넘기기·그만하기로 읽는다). 고정 질문이 아니다.
const SKIP_TEXT = '이 질문은 넘어갈게요';
const STOP_TEXT = '오늘은 여기까지 할게요';

const SPEAK_FAILED = '소리로 읽지 못했어요. 대답은 화면에 적어 두었어요.';
// 말로 대화하기 네 가지 상태(대표 2026-09-26 「대기 / 듣는 중 / 이해하는 중 / ECHO가 말하는 중」).
type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking';
const VOICE_STATE: Record<VoicePhase, [string, string]> = {
  idle: ['대기', '마이크를 누르고 말해 주세요'],
  listening: ['듣는 중', '말을 멈추면 ECHO가 알아서 들어요 · 다 말했으면 눌러도 돼요'],
  thinking: ['이해하는 중', '방금 한 말을 이해하고 있어요'],
  speaking: ['ECHO가 말하는 중', '누르면 바로 멈춰요'],
};

// ECHO Conversation Agent 화면. 질문·진행·저장은 서버(doit-agent)가 정한다. 이 화면은 보이고 보내기만 한다.
// 대표 지시(2026-09-25 「기존 UI/브랜딩/레이아웃 변경 금지」·「UI FINAL LOCK · 시작하기 선택창」): 기존 대화 화면(CoreConversation)의 배치·클래스를 그대로 쓴다.
// 새로 더한 것은 「시작하기」 직후 한 번 뜨는 무채색 선택창(agent-choice.css) 하나뿐이다.
export default function AgentConversation({ userId, firstAnswer, purposeLabel = null, onRestart, onContinue, restartPrompt = false }: Props) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tone, setTone] = useState<AgentTone>(DEFAULT_AGENT_TONE);
  const [mode, setMode] = useState<AgentMode>('TEXT');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false); // 말로 대화하기: ECHO 가 소리로 읽는 중
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  // 대표 2026-09-25 음성 버튼: 말하는 대로 칸에 글자가 흐른다. 이번 말을 음성으로 보냈으면 ECHO 대답도 소리로 읽는다.
  const voiceTurn = useRef(false);
  const onVoiceText = useCallback((text: string) => { voiceTurn.current = true; setDraft(text); }, []);
  const voice = useVoiceInput(onVoiceText, TEXT_MAX);
  const [introSaved, setIntroSaved] = useState(false); // 이 화면에서 소개를 저장했다
  const [profileOk, setProfileOk] = useState(false); // 「ECHO가 이해한 나」를 [맞아요]로 확인했다(이 기기)
  const [hintFor, setHintFor] = useState<string | null>(null); // 「예시 보기」를 연 질문(질문이 바뀌면 저절로 닫힌다)
  const [choosing, setChoosing] = useState(true);
  const [restartArmed, setRestartArmed] = useState<false | 'top' | 'bottom' | 'done'>(restartPrompt ? 'top' : false);
  const alive = useRef(true);
  const inFlight = useRef(false);
  const heroStarted = useRef(false);
  const [heroChoice, setHeroChoice] = useState<AgentChoice | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopSpeaking(); }; }, []);
  // ECHO 대답을 기기 목소리로 읽는다. 못 읽으면 숨기지 않고 그렇다고 알린다(글은 화면에 그대로 있다).
  const say = useCallback((text: string) => {
    setVoiceNote(null);
    speakText(text, () => { if (alive.current) setSpeaking(true); }, how => {
      if (!alive.current) return;
      setSpeaking(false);
      if (how === 'failed') setVoiceNote(SPEAK_FAILED);
    });
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await agentGet(userId);
      if (!alive.current) return;
      setSession(s); setLoaded(true);
      // 히어로 「ECHO 시작하기」에서 이미 고른 방식·말투가 있으면 선택창을 다시 띄우지 않고 그대로 시작한다(한 번 쓰면 지운다).
      const chosen = takeAgentChoice();
      if (!s && chosen) { setChoosing(false); setHeroChoice(chosen); }
    } catch {
      if (alive.current) setLoadError(LOAD_ERROR);
    }
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const run = async (label: string, job: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(label); setError(null); setNotice(null);
    try { await job(); } catch (e) {
      if (!alive.current) return;
      if (e instanceof UnderstandingError && (e.code === 'REQUEST_CONFLICT' || e.code === 'ROUND_CHANGED' || e.code === 'NOT_FOUND')) { await load(); setError('화면을 새로 불러왔어요. 이어서 적어 주세요.'); }
      else setError(e instanceof UnderstandingError && e.code === 'RATE_LIMITED' ? e.message : SEND_ERROR);
    } finally { inFlight.current = false; if (alive.current) setBusy(null); }
  };

  // 새 AI 말만 읽어 준다(말로 대화하기). 보낸 뒤 받은 말 중 마지막 사용자 말 뒤의 것(받아주기 + 다음 질문)만 — 지난 대화·앱의 첫 질문은 읽지 않는다.
  const speakNew = (before: AgentSession | null, after: AgentSession, force = false) => {
    if (!VOICE_CONVERSATION_ENABLED || (after.mode !== 'VOICE' && !force)) return; // MVP: 음성 대화 DEFERRED — 소리로 읽지 않는다
    const fresh = after.messages.slice(before?.messages.length ?? 0);
    const lastUser = fresh.map(m => m.role).lastIndexOf('user');
    const text = fresh.slice(lastUser + 1).filter(m => m.role === 'ai').map(m => m.text).join(' ');
    if (text.trim()) say(text);
  };

  const start = (choice: AgentChoice = { tone, mode }) => void run(choice.mode === 'VOICE' ? '이해하는 중이에요' : '첫 이야기를 듣고 있어요', async () => {
    // 소리 길은 누름 안에서만 연다: 선택창 「말로 시작하기」 누름(아래 onConfirm) 또는 히어로 선택창 누름. 여기는 누름 밖일 수 있어 부르지 않는다(한 번 열기 표시가 헛되이 켜지지 않게).
    const s = await agentStart(userId, { tone: choice.tone, mode: VOICE_CONVERSATION_ENABLED ? choice.mode : 'TEXT', ...(firstAnswer ? { firstAnswer } : {}), seed: takeContentSeed() });
    if (!alive.current) return;
    speakNew(null, s); setSession(s);
  });

  // spokenTurn = 말로 대화하기 마이크로 들은 말(글로 적은 말과 같은 서버·같은 기억·같은 정정/거절 규칙으로 간다).
  const send = (text: string, spokenTurn = false) => {
    const t = text.trim();
    if (!session || !t) return;
    if (voice.listening) voice.stop();
    const spoke = spokenTurn || voiceTurn.current; voiceTurn.current = false;
    if (spoke && !spokenTurn) unlockSpeech(); // 보내기 누름 안에서 소리 길을 연다(마이크로 들은 말은 마이크 누름에서 이미 열었다)
    void run(VOICE_CONVERSATION_ENABLED && session.mode === 'VOICE' ? '이해하는 중이에요' : '듣고 있어요', async () => {
      const r = await agentTurn(userId, session.id, t.slice(0, TEXT_MAX));
      if (!alive.current) return;
      speakNew(session, r.session, spoke); setSession(r.session);
      setDraft(prev => (prev.trim() === t ? '' : prev));
      if (r.turn.after && r.turn.reply) setNotice(r.turn.reply);
    });
  };

  // 말로 대화하기: 마이크 한 번 = 말 한 번. 말을 멈추면 들은 글자가 곧바로 같은 대화 서버로 간다(키보드 0).
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  const onHeard = useCallback((text: string) => sendRef.current(text.slice(0, TEXT_MAX), true), []);
  const talk = useVoiceTurn(onHeard);
  const voicePhase: VoicePhase = speaking ? 'speaking' : talk.listening ? 'listening' : busy ? 'thinking' : 'idle';
  const tapMic = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }   // ECHO 목소리 즉시 멈춤
    if (talk.listening) { talk.stop(); return; }                   // 거기까지 들은 말을 보낸다
    if (busy) return;
    unlockSpeech();                                                 // 아이폰: 대답을 읽을 소리 길을 이 누름 안에서 연다
    announceVoiceActive();                                          // 첫 화면 음악이 켜져 있으면 멈춘다(다시 틀지 않음)
    setVoiceNote(null);
    talk.start();
  };

  useEffect(() => {
    if (!loaded || session || !heroChoice || heroStarted.current) return;
    heroStarted.current = true; setTone(heroChoice.tone); setMode(heroChoice.mode); start(heroChoice);
    // start 는 매 렌더 새로 만들어지는 함수라 넣지 않는다(한 번만 시작 — heroStarted 로 막음).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, session, heroChoice]);

  const restart = () => void run('처음부터 준비하고 있어요', async () => {
    const failure = await onRestart();
    if (failure && alive.current) setError(failure);
  });

  const header = <header className="echo-dialogue-header"><DoItSymbol decorative /><span>DO IT / ECHO</span><Link to="/doit/home">홈</Link><Link to="/doit/understanding">나의 이해</Link></header>;
  const restartConfirm = <div className="echo-restart" role="group" aria-label="처음부터 시작하기"><p className="echo-context">지금 대화를 여기서 끝내고 처음부터 다시 시작할까요? 지난 이야기는 지우지 않아요.</p><div className="echo-reactions"><button disabled={!!busy} onClick={() => setRestartArmed(false)}>계속할게요</button><button disabled={!!busy} onClick={restart}>처음부터 시작할게요</button></div></div>;
  const restartPill = (where: 'top' | 'bottom') => <button className="echo-restart-pill" disabled={!!busy || !!restartArmed} onClick={() => setRestartArmed(where)}><RotateCcw size={14} aria-hidden="true" />처음부터 시작하기</button>;

  if (!loaded) return <section className="echo-dialogue echo-dialogue--pastel" aria-busy={!loadError}>
    {header}
    {loadError ? <div className="echo-error" role="alert"><p>{loadError}</p><button onClick={() => void load()}>다시 불러오기</button></div> : <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>대화를 불러오고 있어요</p></div>}
  </section>;

  // ── 시작 전(대표 「UI FINAL LOCK · 시작하기 선택창」 2026-09-25): 기존 컬러 대화 화면은 그대로 두고, 그 위에 무채색 선택창 하나만 띄운다.
  //   대화 방식(글/말) + 말투(기본 = 편한 존댓말)를 고르면 창이 닫히고, 같은 화면에서 그 선택으로 대화를 시작한다. 새 페이지 이동 0.
  if (!session) return <section className="echo-dialogue echo-dialogue--pastel" aria-busy={!!busy}>
    {header}
    <p className="echo-eyebrow">만나기 전에</p>
    {purposeLabel ? <h1>{purposeLabel}<br />다섯 가지만 물어볼게요.</h1> : <h1>다섯 가지만<br />물어볼게요.</h1>}
    <p className="echo-lead">짧아도 괜찮아요. 떠오르는 대로 적어 주세요.</p>
    {error && <div className="echo-error" role="alert"><p>{error}</p><button disabled={!!busy} onClick={() => start()}>다시 시작하기</button><button disabled={!!busy} onClick={() => { setError(null); setChoosing(true); }}>말투 다시 고르기</button></div>}
    {busy && <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>{busy}</p></div>}
    {choosing && !busy && <AgentChoiceLayer initial={{ tone, mode }} onConfirm={choice => { if (choice.mode === 'VOICE') unlockSpeech(); setTone(choice.tone); setMode(choice.mode); setChoosing(false); start(choice); }} />}
  </section>;

  const done = session.phase === 'done';
  const msgs = session.messages;
  // 지금 질문과 그 앞의 받아 주는 말(질문 카드의 작은 줄). 서버가 준 문장을 그대로 쓴다.
  const question = !done ? session.current_question : null;
  const qIndex = question ? msgs.map(m => m.text).lastIndexOf(question) : -1;
  const ack = qIndex > 0 && msgs[qIndex - 1].role === 'ai' ? msgs[qIndex - 1].text : '';
  const myAnswers = msgs.filter(m => m.role === 'user').map(m => m.text);
  const lastAi = [...msgs].reverse().find(m => m.role === 'ai')?.text ?? '';
  const answered = Math.max(session.progress.asked - 1, 0);
  const profile = session.profile;
  const introChosen = introSaved || !!session.intro?.used; // 소개를 이미 골랐다(이대로·고침·직접)
  // 말로 대화 화면은 VOICE_CONVERSATION_ENABLED 가 켜졌을 때만(MVP DEFERRED). 예전에 「말로」로 시작한 대화도 글 화면으로 이어 간다.
  const voiceUi = VOICE_CONVERSATION_ENABLED && session.mode === 'VOICE';

  return <section className="echo-dialogue echo-dialogue--pastel" aria-busy={!!busy}>
    {header}
    {!done && <div className="echo-steps" role="status" aria-label={`다섯 가지 중 ${answered}가지 답함`}>
      <span className="echo-steps-count">{session.progress.asked} <em>/ {session.progress.of}</em></span>
      <span className="echo-steps-bar" aria-hidden="true"><i style={{ width: `${(answered / session.progress.of) * 100}%` }} /></span>
    </div>}
    {!done && (restartArmed === 'top' ? restartConfirm : <div className="echo-restart-top">{restartPill('top')}</div>)}
    <p className="echo-eyebrow">{done ? '다 들었어요' : '대화 중'}{!done && voiceUi && <span className="echo-mode-pill">말로 대화 중</span>}</p>
    {/* 2026-09-26 대표 실기기 FAIL USER_CONTEXT_NOT_ACKNOWLEDGED: 서버(AI)가 만든 받아주기 말이 질문 카드 위 작은 회색 줄이라 보이지 않았고,
        그 위 고정 제목 「잘 들었어요. 다음 질문이에요.」가 대신 서 있었다. → 받아주기 말이 있으면 그 말이 제목 자리에 선다(문장은 서버가 준 그대로 · 화면이 만들지 않는다). */}
    {done ? <h1>다 들었어요.<br />이제 나를 보여 줄 차례예요.</h1> : ack ? <h1 className="echo-ack-heading">{ack}</h1> : <h1>{myAnswers.length ? <>잘 들었어요.<br />다음 질문이에요.</> : '첫 질문이에요.'}</h1>}
    {!done && <p className="echo-lead">{voiceUi ? '짧아도 괜찮아요. 떠오르는 대로 말해 주세요.' : '짧아도 괜찮아요. 떠오르는 대로 적어 주세요.'}</p>}
    {question && <div className="echo-question-card">
      <p className="echo-question">{question}</p>
      {/* 실제 사용자 피드백(2026-09-25 「예시같은게 있어도 좋을것 같구」): 예시는 늘 펼치지 않고, 누를 때만 한 줄로 보인다. 답을 대신 써 주지 않는다(범위만). */}
      {session.current_hint && (hintFor === question
        ? <p className="echo-fine" role="note">{session.current_hint}</p>
        : <button type="button" className="echo-text-button" disabled={!!busy} onClick={() => { setHintFor(question); if (voiceUi && canSpeak()) say(session.current_hint ?? ''); }}>예시 보기</button>)}
    </div>}
    {/* 말로 대화하기(Voice Lite): 주 행동은 이 마이크 하나. 누르면 듣고 → 말을 멈추면 같은 대화 서버로 → 대답을 화면에 적고 기기 목소리로 읽는다. */}
    {voiceUi && !done && (talk.supported
      ? <div className="echo-voice-stage" role="group" aria-label="말로 대화하기">
          <button type="button" className={`echo-voice-button echo-voice-main is-${voicePhase}`} aria-label={voicePhase === 'speaking' ? 'ECHO 목소리 멈추기' : voicePhase === 'listening' ? '말하기 끝내기' : '말하기 시작'} aria-pressed={voicePhase === 'listening'} disabled={voicePhase === 'thinking'} onClick={tapMic}>{voicePhase === 'listening' || voicePhase === 'speaking' ? <Square size={26} /> : <Mic size={34} />}</button>
          <p className="echo-voice-state" role="status" aria-live="polite"><b>{VOICE_STATE[voicePhase][0]}</b><span>{VOICE_STATE[voicePhase][1]}</span></p>
          {talk.heard && <p className="echo-voice-heard">{talk.heard}</p>}
          {talk.error && <p className="echo-notice" role="alert">{VOICE_INPUT_ERROR_TEXT[talk.error]}</p>}
          {voiceNote && <p className="echo-notice" role="status">{voiceNote}</p>}
        </div>
      : <p className="echo-notice" role="status">이 브라우저는 말 듣기를 지원하지 않아요. 아래 칸에 글로 적어 주세요.</p>)}
    {voiceUi && canSpeak() && lastAi && !speaking && <button type="button" className="echo-text-button" disabled={!!busy || talk.listening} onClick={() => { unlockSpeech(); say(lastAi); }}>다시 듣기</button>}
    {myAnswers.length > 0 && <details className="echo-history"><summary>이번에 한 말 {myAnswers.length}개</summary><ol>{myAnswers.map((text, k) => <li key={k}><button type="button" disabled={!!busy} onClick={() => setDraft(text)}>{text}</button></li>)}</ol></details>}
    {notice && <p className="echo-notice" role="status"><Check size={16} />{notice}</p>}
    {error && <div className="echo-error" role="alert"><p>{error}</p></div>}
    {busy && <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>{busy}</p></div>}
    {done && <section className="echo-done">
      <p className="echo-done-mark"><Check size={18} /> 이번 대화를 정리했어요.</p>
      <p className="echo-done-lead">{session.closing ?? '말해 준 내용을 정리해 뒀어요.'}</p>
      <p className="echo-context">지금은 이 정리로 바로 누군가와 연결되지는 않아요.</p>
      <div className="echo-done-actions">
        {/* 한 번에 할 일 하나(대표 MASTER §10): 소개를 고르기 전에는 아래 소개 카드가 주요 행동이고, 고른 뒤에는 사진이 주요 행동이다. */}
        {introChosen && <button className="echo-primary" disabled={!!busy} onClick={onContinue}>사진 채우러 가기 <ChevronRight size={18} /></button>}
        <Link className="echo-secondary" to="/doit/connections">연결까지 남은 것 보기 <ChevronRight size={18} /></Link>
        {restartArmed === 'done' ? restartConfirm : <button className="echo-secondary" disabled={!!busy || !!restartArmed} onClick={() => setRestartArmed('done')}>처음부터 시작하기</button>}
      </div>
    </section>}
    {/* 2026-09-26 MVP FINAL PATCH: 다섯 문답 뒤 「ECHO가 이해한 나」(AI 초안) → [맞아요] / [조금 달라요] / [다시 말할게요]. 확인 뒤에 DO IT MUSIC 카드와 소개·사진 단계. */}
    {done && profile && <AgentProfileCheck userId={userId} session={session} onSession={setSession} onConfirmed={setProfileOk} />}
    {done && (profileOk || !profile) && <MusicMoment />}
    {done && (profileOk || !profile) && <AgentIntroCard userId={userId} session={session} onSession={setSession} onSaved={() => setIntroSaved(true)} />}
    {done && (profileOk || !profile) && !introChosen && <div className="echo-done-actions"><button className="echo-secondary" disabled={!!busy} onClick={onContinue}>소개는 나중에 · 사진 채우기 <ChevronRight size={18} /></button></div>}
    {/* 홈 화면에 두기 제안(2026-09-26): 소개를 고른 뒤 한 번만. 소개 카드와 겹쳐 권하지 않는다. 설치 안 해도 그대로 쓴다. */}
    {done && introChosen && <InstallAppCard />}
    {/* 끝난 뒤 고치기는 위 「ECHO가 이해한 나」 확인 카드 한 곳에서만(입력칸 두 개로 헷갈리지 않게). */}
    {!done && <form className="echo-composer" onSubmit={event => { event.preventDefault(); if (!busy && draft.trim()) send(draft); }}>
      <label htmlFor="echo-message">{done ? '고칠 게 있으면 적어 주세요' : voiceUi ? '글로 적어도 돼요' : '이어서 적기'}</label>
      <textarea id="echo-message" value={draft} onChange={event => setDraft(event.target.value.slice(0, TEXT_MAX))} placeholder={voice.listening ? '듣고 있어요. 말하는 대로 적혀요' : '생각나는 대로 한 줄'} maxLength={TEXT_MAX} rows={4} disabled={!!busy} aria-describedby={voice.error ? 'echo-voice-error' : undefined} />
      {voice.error && <p id="echo-voice-error" className="echo-notice" role="alert">{VOICE_INPUT_ERROR_TEXT[voice.error]}</p>}
      <div className="echo-composer-footer"><span>적은 말은 나만 봐요. 프로필에 저절로 올라가지 않아요.</span><div className="echo-composer-actions">{VOICE_CONVERSATION_ENABLED && voice.supported && !(voiceUi && !done) && <button type="button" className={voice.listening ? 'echo-voice-button is-listening' : 'echo-voice-button'} aria-label={voice.listening ? '말하기 멈추기' : '말로 적기'} aria-pressed={voice.listening} disabled={!!busy} onClick={() => { if (voice.listening) voice.stop(); else { stopSpeaking(); announceVoiceActive(); voice.start(draft); } }}>{voice.listening ? <Square size={18} /> : <Mic size={20} />}</button>}<button type="submit" aria-label="이야기 보내기" disabled={!!busy || !draft.trim()}><ArrowUp size={20} /></button></div></div>
    </form>}
    {!done && <div className="echo-reactions"><button type="button" disabled={!!busy} onClick={() => send(SKIP_TEXT)}>이 질문 넘어가기</button><button type="button" disabled={!!busy} onClick={() => send(STOP_TEXT)}>여기까지 할게요</button></div>}
    <footer className="echo-dialogue-footer"><button className="echo-secondary" disabled={!!busy} onClick={onContinue}>사진과 소개 채우기 <ChevronRight size={18} /></button><Link className="echo-secondary" to="/doit/connections">당신이 잠든 사이 · 연결 준비 보기 <ChevronRight size={18} /></Link>{restartArmed === 'bottom' ? restartConfirm : restartPill('bottom')}<p className="echo-fine">{done ? '이번 대화는 여기까지예요. 다시 하고 싶으면 「처음부터 시작하기」를 눌러 주세요.' : `질문은 ${session.progress.of}개뿐이에요.`}</p></footer>
  </section>;
}
