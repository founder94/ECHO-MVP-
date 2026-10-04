import GuideHint from '@/components/guide/GuideHint';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Mic, Plus, RotateCcw, Send, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import SymbolLoader from '@/components/SymbolLoader';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { DEFAULT_AGENT_TONE, agentGet, agentRescue, agentStart, agentTurn, type AgentMode, type AgentSession, type AgentTone } from '@/doit/lib/agentApi';
import './core-conversation.css';
import './chat-ref.css';
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
  goal?: { id: string; label: string } | null; // v2.4 세션의 관계 목적(기기마다 다를 수 있음)
  onRestart: () => Promise<string | null>;
  onContinue: () => void;
}

const TEXT_MAX = 1000;
const SEND_ERROR = '보내지 못했어요. 적은 말은 그대로 있으니 다시 보내 주세요.';
const LOAD_ERROR = '대화를 불러오지 못했어요. 인터넷이 잘 되는지 보고 다시 시도해 주세요.';
// 빠져나갈 문: 사용자가 누르면 그 말을 그대로 보낸다(서버·AI 가 넘기기·그만하기로 읽는다). 고정 질문이 아니다.
const SKIP_TEXT = '이 질문은 넘어갈게요';
const STOP_TEXT = '오늘은 여기까지 할게요';
// 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE」 주관식 본체 + 객관식 구조대.
// 「잘 모르겠어요」 = 구조 요청(답 아님 · 서버가 지금 질문의 보기를 정해 준다). 보기를 못 만들었을 때(fallback)만 그 말을 서버에 보내 다음으로 간다.
const UNSURE_TEXT = '잘 모르겠어요';
const RESCUE_LEAD = '이런 느낌 중에 가까운 게 있어요?';

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
export default function AgentConversation({ userId, firstAnswer, purposeLabel = null, goal = null, onRestart, onContinue }: Props) {
  const [toolsOpen, setToolsOpen] = useState(false); // 「+」 더 보기(2026-10-04 모바일 기준 디자인)
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tone, setTone] = useState<AgentTone>(DEFAULT_AGENT_TONE);
  const [mode, setMode] = useState<AgentMode>('TEXT');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingPrevious, setEditingPrevious] = useState(false);
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
  // 구조대: 보기를 펼친 질문 · 고른 보기(질문이 바뀌면 저절로 닫힘). 보기를 눌러도 바로 넘어가지 않는다 — 「답변 보내기」로 보낸다.
  // rescueFor = 이 질문에서 내가 펼치거나(잘 모르겠어요) 접은(직접 설명할게요) 상태. 없으면 서버가 정한 펼침(show)을 따른다.
  const [rescueFor, setRescueFor] = useState<{ q: string; open: boolean } | null>(null);
  const [pick, setPick] = useState<{ q: string; choice: string } | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
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
    const s = await agentStart(userId, { tone: choice.tone, mode: VOICE_CONVERSATION_ENABLED ? choice.mode : 'TEXT', ...(firstAnswer ? { firstAnswer } : {}), seed: takeContentSeed(), goal });
    if (!alive.current) return;
    speakNew(null, s); setSession(s);
  });

  // spokenTurn = 말로 대화하기 마이크로 들은 말(글로 적은 말과 같은 서버·같은 기억·같은 정정/거절 규칙으로 간다).
  const send = (text: string, spokenTurn = false, correctionMode = false, choice: string | null = null) => {
    const t = text.trim();
    if (!session || !t) return;
    const rescueOpen = !!session.current_question && (rescueFor?.q === session.current_question ? rescueFor.open : !!session.current_rescue?.show);
    if (voice.listening) voice.stop();
    const spoke = spokenTurn || voiceTurn.current; voiceTurn.current = false;
    if (spoke && !spokenTurn) unlockSpeech(); // 보내기 누름 안에서 소리 길을 연다(마이크로 들은 말은 마이크 누름에서 이미 열었다)
    void run(VOICE_CONVERSATION_ENABLED && session.mode === 'VOICE' ? '이해하는 중이에요' : '다음 질문을 고르고 있어요', async () => {
      const r = await agentTurn(userId, session.id, t.slice(0, TEXT_MAX), correctionMode ? { purpose: null } : undefined, correctionMode ? undefined : { ...(choice ? { choice } : {}), rescueOpen });
      if (!alive.current) return;
      speakNew(session, r.session, spoke); setSession(r.session);
      setDraft(prev => (prev.trim() === t ? '' : prev));
      setPick(null);
      if (correctionMode) { setEditingPrevious(false); setNotice(r.turn.reply || '고친 말로 다시 이어갈게요.'); }
      else if (r.turn.after && r.turn.reply) setNotice(r.turn.reply);
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

  // 2026-09-30 대표 마감 지시 §7: 대화 중 휴대폰 뒤로(안드로이드 뒤로·아이폰 밀어서 뒤로)가 대화 화면을 떠나 처음 쪽으로 가던 문제.
  // 답이 하나라도 있으면 같은 주소의 기록 한 칸을 앞에 두고, 뒤로를 누르면 화면을 떠나지 않고 「직전 답 고치기」로 연다(고치면 서버가 뒤 질문을 다시 정한다).
  // 고치는 중에 한 번 더 뒤로 = 고치기 취소. 답이 없거나 대화가 끝났으면 원래 뒤로 그대로.
  const lastAnswer = session ? [...session.messages].reverse().find(m => m.role === 'user')?.text ?? '' : '';
  const guardBack = !!session && session.phase !== 'done' && !!lastAnswer;
  const editingRef = useRef(false);
  editingRef.current = editingPrevious;
  const lastAnswerRef = useRef('');
  lastAnswerRef.current = lastAnswer;
  useEffect(() => {
    if (!guardBack) return;
    const mark = () => window.history.pushState({ ...(window.history.state ?? {}), echoBackGuard: true }, '');
    if (!(window.history.state as { echoBackGuard?: boolean } | null)?.echoBackGuard) mark();
    const onPop = () => {
      // 아직 이 화면의 기록 칸 위라면, 그 위에 쌓인 것(이용 안내 창 등)이 닫힌 뒤로다 — 직전 답 고치기가 아니다(적던 글 그대로 · 2026-10-04).
      if ((window.history.state as { echoBackGuard?: boolean } | null)?.echoBackGuard) return;
      mark();
      if (editingRef.current) { setEditingPrevious(false); setDraft(''); return; }
      setEditingPrevious(true); setDraft(lastAnswerRef.current); setNotice(null); setHintFor(null); setPick(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [guardBack]);

  // (A)·(B) 「잘 모르겠어요」: 답이 아니라 구조 요청. 서버가 들고 있는 보기가 있으면 바로 펼치고, 없으면 서버에 보기를 청한다(저장 0 · 질문 수 0).
  const askRescue = () => {
    if (!session?.current_question) return;
    const q = session.current_question;
    setPick(null); setNotice(null);
    if ((session.current_rescue?.options.length ?? 0) >= 2) { setRescueFor({ q, open: true }); return; }
    void run('가까운 보기를 찾고 있어요', async () => {
      const s = await agentRescue(userId, session.id);
      if (!alive.current) return;
      setSession(s); if (s.current_question) setRescueFor({ q: s.current_question, open: true });
    });
  };
  // 「직접 설명할게요」: 보기를 접고 주관식으로(언제든 돌아갈 수 있다).
  const explainSelf = () => { if (session?.current_question) setRescueFor({ q: session.current_question, open: false }); setPick(null); requestAnimationFrame(() => draftRef.current?.focus()); };

  const restart = () => void run('처음부터 준비하고 있어요', async () => {
    const failure = await onRestart();
    if (failure && alive.current) setError(failure);
  });

  // 2026-10-04 모바일 기준 디자인: 머리 = 뒤로(홈) + 「ECHO와 이야기」 한 줄. 메뉴(사주·타로·나의 이해 등)는 모든 제품 화면 공통 오른쪽 위 하나(AppCornerMenu) — 대화는 서버에 남아 돌아오면 이어진다.
  const header = <header className="echo-chat-head"><Link to="/doit/home" className="echo-chat-back" aria-label="홈으로"><ChevronLeft size={24} aria-hidden="true" /></Link><p className="echo-chat-title">ECHO와 이야기</p></header>;
  // 2026-09-28 대표 「처음부터 다시 시작하기 UX」: 확인 창 없이 한 번 탭 → 새 회차 + ECHO 첫 대화 화면(앱 공통 동작 useRestartConversation · 지난 이야기는 지우지 않음).
  const restartPill = () => <button className="echo-restart-pill" disabled={!!busy} onClick={restart}><RotateCcw size={14} aria-hidden="true" />처음부터 다시 시작하기</button>;

  if (!loaded) return <section className="echo-dialogue echo-dialogue--pastel echo-chat" aria-busy={!loadError}>
    {header}
    {loadError ? <div className="echo-error" role="alert"><p>{loadError}</p><button onClick={() => void load()}>다시 불러오기</button></div> : <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>대화를 불러오고 있어요</p></div>}
  </section>;

  // ── 시작 전(대표 「UI FINAL LOCK · 시작하기 선택창」 2026-09-25): 기존 컬러 대화 화면은 그대로 두고, 그 위에 무채색 선택창 하나만 띄운다.
  //   대화 방식(글/말) + 말투(기본 = 편한 존댓말)를 고르면 창이 닫히고, 같은 화면에서 그 선택으로 대화를 시작한다. 새 페이지 이동 0.
  if (!session) return <section className="echo-dialogue echo-dialogue--pastel echo-chat" aria-busy={!!busy}>
    {header}
    <img className="echo-chat-art" src="/doit/art/ribbon-01.webp" alt="" aria-hidden="true" width="940" height="410" decoding="async" />
    <p className="echo-eyebrow">만나기 전에</p>
    {/* v2.4: 이 기기의 세션 목적을 먼저 보인다(계정에 마지막으로 저장된 목적이 다른 기기 것일 수 있다). */}
    {(session?.goal_label ?? purposeLabel) ? <h1>{session?.goal_label ?? purposeLabel}<br />편하게 몇 가지만 물어볼게요.</h1> : <h1>편하게 몇 가지만<br />물어볼게요.</h1>}
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
  const lastUserIndex = msgs.map(m => m.role).lastIndexOf('user');
  const previousQuestion = lastUserIndex > 0 && msgs[lastUserIndex - 1]?.role === 'ai' ? msgs[lastUserIndex - 1].text : '';
  const lastAi = [...msgs].reverse().find(m => m.role === 'ai')?.text ?? '';
  const answered = Math.max(session.progress.asked - 1, 0);
  const profile = session.profile;
  const introChosen = introSaved || !!session.intro?.used; // 소개를 이미 골랐다(이대로·고침·직접)
  // 말로 대화 화면은 VOICE_CONVERSATION_ENABLED 가 켜졌을 때만(MVP DEFERRED). 예전에 「말로」로 시작한 대화도 글 화면으로 이어 간다.
  const voiceUi = VOICE_CONVERSATION_ENABLED && session.mode === 'VOICE';
  // 구조대 상태(서버 계약 그대로): 펼침 = 내가 「잘 모르겠어요」를 눌렀거나 서버가 먼저 펼침. 보기·안전 안내는 서버가 준 것만.
  const rescue = question ? session.current_rescue ?? null : null;
  const rescueOptions = rescue?.options ?? [];
  const rescueOpen = !!question && !editingPrevious && (rescueFor?.q === question ? rescueFor.open : !!rescue?.show);
  const picked = pick && pick.q === question ? pick.choice : null;
  // 뒤로·직전 답 고치기: 직전 질문을 보기로 답했으면 그 보기와 고른 것을 되살린다(고친 말은 정정으로 서버가 다시 정한다).
  const prevChoice = editingPrevious && session.previous && session.previous.question === previousQuestion ? session.previous : null;

  // 2026-10-04 대표 「ECHO · 모바일 최종 디자인 기준」 3번(ECHO Agent 대화) · 「문구·서체 검수안」 3번 「ECHO와 이야기」:
  //   위 = 뒤로 + 제목 한 줄 · 가운데 = 말풍선(서버 받아주기 말 → 내 말 → ECHO 질문) · 아래 = 「+ · 입력칸 · 보내기」 한 줄.
  //   다른 도움 행동(직전 답 고치기 · 여기까지 · 처음부터 다시 · 사진·소개 · 연결 준비 · 한 말 기록)은 「+」 안으로 옮겼다(기능 삭제 0).
  //   글은 모두 서버가 준 그대로(화면이 질문·받아주기 말을 만들지 않음).
  return <section className="echo-dialogue echo-dialogue--pastel echo-chat" aria-busy={!!busy}>
    <header className="echo-chat-head">
      <Link to="/doit/home" className="echo-chat-back" aria-label="홈으로"><ChevronLeft size={24} aria-hidden="true" /></Link>
      <h1 className="echo-chat-title">{done ? '다 들었어요.' : 'ECHO와 이야기'}</h1>
      {/* 다 들은 뒤: 제목 옆 짧은 말(2026-09 승인 문구 「다 들었어요. 이제 나를 보여 줄 차례예요.」 그대로 · 확인 화면이 주인공) */}
      {done && <span className="echo-sr">이제 나를 보여 줄 차례예요.</span>}
      {/* 2026-09-26 통합 검수(P0-B): 「2 / 5」 같은 고정 개수 표시는 설문처럼 느껴진다(대표 실기기). 들은 개수만 보이고, 끝은 서버가 정한다. */}
      {!done && <span className="echo-steps" role="status" aria-label={`지금까지 ${answered}가지 들었어요`}><span className="echo-steps-count">{answered}가지 들었어요</span></span>}
    </header>
    {/* 2026-10-04 이용 안내: 첫 질문에서만 짧은 도움말(입력칸을 가리지 않는 제자리 한 줄) */}
    {!done && myAnswers.length === 0 && <GuideHint id="talk" />}
    <div className="echo-chat-log">
    {editingPrevious && !done && <div className="echo-notice" role="status"><ArrowLeft size={15} aria-hidden="true" /><span>직전 답으로 돌아왔어요. 고치면 그 뒤 질문도 고친 답 기준으로 다시 정해요.</span><button type="button" className="echo-text-button" disabled={!!busy} onClick={() => { setEditingPrevious(false); setDraft(''); }}>취소</button></div>}
    {editingPrevious && !done && previousQuestion && <div className="echo-question-card echo-bubble--echo"><p className="echo-question">{previousQuestion}</p>
      {prevChoice && prevChoice.options.length > 0 && <div className="echo-rescue" role="group" aria-label="고른 답 바꾸기">
        <div className="echo-choice-row">
          {prevChoice.options.map(choice => <button key={choice} type="button" className={draft.trim() === choice ? 'echo-choice is-selected' : 'echo-choice'} aria-pressed={draft.trim() === choice} disabled={!!busy} onClick={() => setDraft(choice)}>{choice}</button>)}
        </div>
      </div>}
    </div>}
      {/* 내 직전 말 = 오른쪽 말풍선 · 서버 받아주기 말(있을 때) = ECHO 말풍선 · 지금 질문 = ECHO 말풍선(심볼 하나). */}
      {question && !editingPrevious && myAnswers.length > 0 && <p className="echo-bubble echo-bubble--me"><span className="echo-sr">내가 한 말: </span>{myAnswers.at(-1)}</p>}
      {/* 2026-09-26 대표 실기기 FAIL USER_CONTEXT_NOT_ACKNOWLEDGED: 받아주기 말은 작은 회색 줄이 아니라 또렷한 ECHO 말풍선으로(문장은 서버가 준 그대로). */}
      {question && !editingPrevious && ack && <p className="echo-bubble echo-bubble--echo echo-ack-bubble"><span className="echo-sr">ECHO: </span>{ack}</p>}
      {question && !editingPrevious && <div className="echo-question-card echo-bubble--echo">
        <p className="echo-question">{question}</p>
        {/* 실제 사용자 피드백(2026-09-25 「예시같은게 있어도 좋을것 같구」): 예시는 늘 펼치지 않고, 누를 때만 한 줄로 보인다. 답을 대신 써 주지 않는다(범위만). */}
        {session.current_hint && (hintFor === question
          ? <p className="echo-fine" role="note">{session.current_hint}</p>
          : <button type="button" className="echo-text-button" disabled={!!busy} onClick={() => { setHintFor(question); if (voiceUi && canSpeak()) say(session.current_hint ?? ''); }}>예시 보기</button>)}
        {/* 2026-10-01 주관식 본체 + 객관식 구조대: 보기는 펼쳤을 때만(내가 「잘 모르겠어요」를 눌렀거나 서버가 먼저 펼침). 보기 = 서버가 승인한 것만.
            누르면 고른 표시만 하고(바로 넘어가지 않음) 「답변 보내기」로 보낸다 → 서버가 사용자 직접 답으로 저장. 「직접 설명할게요」로 언제든 주관식으로. */}
        {rescueOpen && <div className="echo-rescue" role="group" aria-label="가까운 답 고르기">
          {rescueOptions.length >= 2 ? <>
            {/* 2026-10-01 대표 「FINAL DESIGN」 §5·§12: 작은 ECHO 심볼(도움 신호) + 한 줄 · 보기 카드 = 서버가 고른 생활형 심볼 1개 + 생활말 */}
            <p className="echo-rescue-lead"><DoItSymbol decorative className="echo-rescue-anchor" />{RESCUE_LEAD}</p>
            <div className="echo-choice-row echo-option-list">
              {rescueOptions.map((choice, k) => <button key={choice} type="button" className={picked === choice ? 'echo-choice echo-option is-selected' : 'echo-choice echo-option'} aria-pressed={picked === choice} disabled={!!busy} onClick={() => { setPick(picked === choice ? null : { q: question, choice }); if (picked !== choice) setDraft(''); }}><span className="echo-option-mark" aria-hidden="true">{rescue?.symbols?.[k] || '·'}</span><span className="echo-option-text">{choice}</span></button>)}
            </div>
            <button type="button" className="echo-text-button echo-rescue-self" disabled={!!busy} onClick={explainSelf}>직접 설명할게요</button>
          </> : <>
            {/* 보기를 못 만들었을 때의 안전 안내(서버 fallback · 실패 코드로 기록됨 — 구조대가 작동한 것으로 세지 않는다) */}
            <p className="echo-rescue-lead">편하게 고를 수 있게 해 드릴게요.</p>
            <div className="echo-choice-row">
              <button type="button" className="echo-choice" disabled={!!busy} onClick={explainSelf}>직접 설명할게요</button>
              <button type="button" className="echo-choice" disabled={!!busy} onClick={() => send(UNSURE_TEXT)}>잘 모르겠어요</button>
              <button type="button" className="echo-choice" disabled={!!busy} onClick={() => send(SKIP_TEXT)}>이 질문은 넘어갈게요</button>
            </div>
          </>}
        </div>}
      </div>}
      {busy && <div className="echo-thinking echo-typing" role="status"><span className="echo-typing-dots" aria-hidden="true"><i /><i /><i /></span><p>{busy}</p></div>}
      {notice && <p className="echo-notice" role="status"><Check size={16} />{notice}</p>}
      {error && <div className="echo-error" role="alert"><p>{error}</p></div>}
    </div>
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
    {/* 2026-10-04 모바일 기준 디자인 4번(정정·확인): 다 들은 뒤 첫 화면은 「이렇게 이해했는데, 맞나요?」 하나. 정리·다음 행동은 확인한 뒤에. */}
    {done && profile && <AgentProfileCheck userId={userId} session={session} onSession={setSession} onConfirmed={setProfileOk} />}
    {done && (profileOk || !profile) && <img className="echo-chat-art" src="/doit/art/ribbon-03.webp" alt="" aria-hidden="true" width="970" height="410" decoding="async" />}
    {done && (profileOk || !profile) && <section className="echo-done">
      <p className="echo-done-mark"><Check size={18} /> 이번 대화를 정리했어요.</p>
      <p className="echo-done-lead">{session.closing ?? '말해 준 내용을 정리해 뒀어요.'}</p>
      <p className="echo-context">지금은 이 정리로 바로 누군가와 연결되지는 않아요.</p>
      <div className="echo-done-actions">
        {/* 한 번에 할 일 하나(대표 MASTER §10): 소개를 고르기 전에는 아래 소개 카드가 주요 행동이고, 고른 뒤에는 사진이 주요 행동이다. */}
        {introChosen && <button className="echo-primary" disabled={!!busy} onClick={onContinue}>사진 채우러 가기 <ChevronRight size={18} /></button>}
        <Link className="echo-secondary" to="/doit/connections">연결까지 남은 것 보기 <ChevronRight size={18} /></Link>
        <button className="echo-secondary" disabled={!!busy} onClick={restart}>처음부터 다시 시작하기</button>
      </div>
    </section>}
    {/* 2026-09-26 MVP FINAL PATCH: 다섯 문답 뒤 「ECHO가 이해한 나」(AI 초안) → [맞아요] / [조금 달라요] / [다시 말할게요]. 확인 뒤에 DO IT MUSIC 카드와 소개·사진 단계. */}
    {done && (profileOk || !profile) && <MusicMoment />}
    {done && (profileOk || !profile) && <AgentIntroCard userId={userId} session={session} onSession={setSession} onSaved={() => setIntroSaved(true)} />}
    {done && (profileOk || !profile) && !introChosen && <div className="echo-done-actions"><button className="echo-secondary" disabled={!!busy} onClick={onContinue}>소개는 나중에 · 사진 채우기 <ChevronRight size={18} /></button></div>}
    {/* 홈 화면에 두기 제안(2026-09-26): 소개를 고른 뒤 한 번만. 소개 카드와 겹쳐 권하지 않는다. 설치 안 해도 그대로 쓴다. */}
    {done && introChosen && (profileOk || !profile) && <InstallAppCard />}
    {/* 도움 행동(답이 아님 · 저장 0): 잘 모르겠어요(구조 요청) · 넘어가기(SKIP) · 여기까지(STOP, 보기가 펼쳐졌을 때). 입력줄 바로 위 작은 칩. */}
    {!done && !editingPrevious && <div className="echo-reactions echo-chat-chips">{!rescueOpen && <button type="button" disabled={!!busy || !question} onClick={askRescue}>{UNSURE_TEXT}</button>}<button type="button" disabled={!!busy} onClick={() => send(SKIP_TEXT)}>이 질문 넘어가기</button>{rescueOpen && <button type="button" disabled={!!busy} onClick={() => send(STOP_TEXT)}>여기까지 할게요</button>}</div>}
    {/* 「+」 안: 화면에서 덜 쓰는 행동을 한곳에. 열려 있는 동안만 보인다. */}
    {/* 다 들은 뒤에는 「맞나요?」 확인이 끝나기 전까지 다음 행동(사진·연결)을 열지 않는다 — 「+」를 열어 둔 채 끝나도 마찬가지(Codex 4179032624). */}
    {((toolsOpen && !done) || (done && (profileOk || !profile))) && <div className="echo-chat-tools" id="echo-chat-tools" role="group" aria-label="더 보기">
      {!done && myAnswers.length > 0 && !editingPrevious && <button type="button" className="echo-text-button" disabled={!!busy} onClick={() => { setEditingPrevious(true); setDraft(myAnswers.at(-1) ?? ''); setNotice(null); setHintFor(null); setToolsOpen(false); }}><ArrowLeft size={15} aria-hidden="true" /> 직전 답 고치기</button>}
      {!done && !editingPrevious && !rescueOpen && <button type="button" className="echo-text-button echo-stop-link" disabled={!!busy} onClick={() => { setToolsOpen(false); send(STOP_TEXT); }}>오늘은 여기까지 할게요</button>}
      {myAnswers.length > 0 && <details className="echo-history"><summary>이번에 한 말 {myAnswers.length}개</summary><ol>{myAnswers.map((text, k) => <li key={k}><button type="button" disabled={!!busy} onClick={() => { setDraft(text); setToolsOpen(false); }}>{text}</button></li>)}</ol></details>}
      <button className="echo-secondary" disabled={!!busy} onClick={onContinue}>사진과 소개 채우기 <ChevronRight size={18} /></button>
      <Link className="echo-secondary" to="/doit/connections">당신이 잠든 사이 · 연결 준비 보기 <ChevronRight size={18} /></Link>
      {restartPill()}
      <p className="echo-fine">적은 말은 나만 봐요. 프로필에 저절로 올라가지 않아요.</p>
      <p className="echo-fine">{done ? '이번 대화는 여기까지예요. 다시 하고 싶으면 「처음부터 다시 시작하기」를 눌러 주세요.' : '충분히 들으면 ECHO가 먼저 멈춰요. 중간에 멈춰도 괜찮아요.'}</p>
    </div>}
    {/* 끝난 뒤 고치기는 위 「ECHO가 이해한 나」 확인 카드 한 곳에서만(입력칸 두 개로 헷갈리지 않게). 끝난 뒤에도 「+」로 다른 행동은 연다. */}
    {!done && <form className="echo-composer echo-chat-bar" onSubmit={event => { event.preventDefault(); if (busy) return; if (draft.trim()) send(draft, false, editingPrevious); else if (picked && !editingPrevious) send(picked, false, false, picked); }}>
      <button type="button" className="echo-chat-plus" aria-label={toolsOpen ? '더 보기 닫기' : '더 보기'} aria-expanded={toolsOpen} aria-controls="echo-chat-tools" onClick={() => setToolsOpen(v => !v)}><Plus size={22} aria-hidden="true" /></button>
      <>
        <label htmlFor="echo-message" className="echo-sr">{editingPrevious ? '직전 답 고치기' : voiceUi ? '글로 적어도 돼요' : '이어서 적기'}</label>
        <textarea id="echo-message" ref={draftRef} value={draft} onChange={event => { setDraft(event.target.value.slice(0, TEXT_MAX)); if (event.target.value.trim()) setPick(null); }} placeholder={editingPrevious ? '고칠 내용을 편하게 적어 주세요' : voice.listening ? '듣고 있어요. 말하는 대로 적혀요' : picked ? `「${picked}」로 답할게요 · 더 적어도 돼요` : '편하게 적어주세요.'} maxLength={TEXT_MAX} rows={1} disabled={!!busy} aria-describedby={voice.error ? 'echo-voice-error' : undefined} />
        {VOICE_CONVERSATION_ENABLED && voice.supported && !voiceUi && <button type="button" className={voice.listening ? 'echo-voice-button is-listening' : 'echo-voice-button'} aria-label={voice.listening ? '말하기 멈추기' : '말로 적기'} aria-pressed={voice.listening} disabled={!!busy} onClick={() => { if (voice.listening) voice.stop(); else { stopSpeaking(); announceVoiceActive(); voice.start(draft); } }}>{voice.listening ? <Square size={18} /> : <Mic size={20} />}</button>}
        {/* 2026-10-01 대표 「FINAL DESIGN」 §9·§11: 한 화면 하나의 주 행동 = 보내기(흰 판) — 이제 입력줄 오른쪽 둥근 버튼(이름은 그대로 「답변 보내기」) */}
        <button type="submit" className="echo-send-cta" aria-label={editingPrevious ? '고친 답 보내기' : '답변 보내기'} disabled={!!busy || (!draft.trim() && !(picked && !editingPrevious))}><Send size={20} aria-hidden="true" /></button>
      </>
      {voice.error && <p id="echo-voice-error" className="echo-notice" role="alert">{VOICE_INPUT_ERROR_TEXT[voice.error]}</p>}
    </form>}
  </section>;
}
