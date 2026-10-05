import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/doit/hooks/useAuth';
import CoreConversation from '@/doit/components/feature/CoreConversation';
import SymbolLoader from '@/components/SymbolLoader';
import ConversationOpening from '@/doit/components/feature/ConversationOpening';
import AgentConversation from '@/doit/components/feature/AgentConversation';
import { ECHO_AGENT_ENABLED } from '@/doit/lib/agentApi';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import { loadProfile, saveProfileText } from '@/doit/lib/profileSave';
import { roundStartOf } from '@/doit/lib/conversationRound';
import { FRESH_ROUND_STATE, useRestartConversation, type FreshRoundState } from '@/doit/hooks/useRestartConversation';
import { peekContentSeed } from '@/doit/lib/contentSeed';
import { RefTalk } from '@/doit/app/plan-a/screens/RefTalk';

type Purpose = { id: string; label: string };
type PurposeState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; purpose: Purpose | null };

// v13 흐름: 로그인 → (목적이 없으면) ECHO의 첫 질문 "어떤 만남을 원하세요?" → 대화.
// 목적 조회에 실패해도 대화를 막지 않는다(목적 없이 진행, 서버가 방향 없이 이어 묻는다).
export default function ConversationPage() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  // 2026-09-28 대표 「처음부터 다시 시작하기 UX」: 모든 「처음부터 다시」 버튼은 useRestartConversation 하나를 쓴다.
  // 새 회차를 연 뒤 이 화면으로 오면서 표시(freshRound)를 남긴다 → 목적을 지우지 않고도 ECHO 첫 질문(어떤 만남을 원하세요?)부터 보인다.
  const location = useLocation();
  const freshRound = (location.state as FreshRoundState | null)?.[FRESH_ROUND_STATE] ?? null;
  const [openedRound, setOpenedRound] = useState<number | null>(null);
  const showOpening = freshRound !== null && openedRound !== freshRound;
  const [purposeState, setPurposeState] = useState<PurposeState>({ kind: 'loading' });
  const [openingLine, setOpeningLine] = useState('');
  const userId = user?.id ?? null;
  const { restart } = useRestartConversation(userId);
  // 2026-10-05 Codex echo-spec B: 사주·타로 결과에서 「ECHO랑 이야기」로 왔으면(이 탭의 이야기 거리 · 이 계정) 질문 없는 참고 이야기부터.
  //   목적 고르기·Plan A 대화로 끌고 가지 않는다 · 「원하는 만남 알아보기」를 누르면 그때 보통 흐름으로.
  const [refDone, setRefDone] = useState(false);
  const refSeed = useMemo(() => (userId && ECHO_AGENT_ENABLED && !refDone ? peekContentSeed(userId) : null), [userId, refDone]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // 예전 주소(?restart=1)는 더 이상 쓰지 않는다 — 남아 있으면 조용히 지운다(주소만으로는 아무것도 초기화하지 않음).
  useEffect(() => {
    if (!search.has('restart')) return;
    const next = new URLSearchParams(search);
    next.delete('restart');
    setSearch(next, { replace: true });
  }, [search, setSearch]);

  useEffect(() => {
    if (!userId || !A_STRUCTURE_SERVER_ENABLED) return;
    let current = true;
    setPurposeState({ kind: 'loading' });
    void loadProfile(userId).then(result => {
      if (!current || !alive.current) return;
      if (result.status === 'error') { setPurposeState({ kind: 'error' }); return; }
      const purpose = result.profile?.purposeId && result.profile.purposeLabel ? { id: result.profile.purposeId, label: result.profile.purposeLabel } : null;
      setPurposeState({ kind: 'ready', purpose });
    }).catch(() => { if (current && alive.current) setPurposeState({ kind: 'error' }); });
    return () => { current = false; };
  }, [userId]);

  if (loading) return <div className="echo-dialogue echo-dialogue--pastel echo-dialogue--waiting"><SymbolLoader size={132} label="로그인했는지 확인하고 있어요." /></div>;
  if (!user) return <section className="echo-dialogue echo-dialogue--pastel"><p className="echo-eyebrow">내 이야기</p><h1>다음에 와도,<br />이야기가 이어지도록.</h1><p className="echo-lead">로그인하면 적은 이야기가 내 계정에 남아요. 다음에 와서 이어서 하면 돼요.</p><Link className="echo-primary" to="/login" state={{ from: `/doit/conversation${search.get('from') === 'journey' ? '?from=journey' : ''}` }}>로그인하고 이야기하기</Link><Link className="echo-secondary" to="/doit/start-journey">내 프로필 준비하기</Link></section>;

  if (refSeed) return <RefTalk key={user.id} userId={user.id} seed={refSeed} onLeave={(to) => { setRefDone(true); if (to === 'home') navigate('/doit/home'); }} />;

  const onContinue = () => navigate('/doit/start-journey?edit=profile');
  if (!A_STRUCTURE_SERVER_ENABLED) return <CoreConversation key={user.id} userId={user.id} onContinue={onContinue} />;
  // 처음부터 다시(새 회차) 직후: 저장된 목적은 그대로 두고 ECHO 첫 질문부터 보인다. 고르면 그 목적이 이번 회차의 첫 답이 된다.
  if (showOpening) {
    return <ConversationOpening key={`${user.id}:fresh:${freshRound}`} userId={user.id} onDone={(purpose, line) => { setOpenedRound(freshRound); setOpeningLine(line); setPurposeState({ kind: 'ready', purpose }); navigate('/doit/conversation', { replace: true, state: null }); }} />;
  }
  if (purposeState.kind === 'loading') return <div className="echo-dialogue echo-dialogue--pastel echo-dialogue--waiting"><SymbolLoader size={132} label="지난번에 고른 만남을 가져오고 있어요." /></div>;
  if (purposeState.kind === 'ready' && purposeState.purpose === null) {
    return <ConversationOpening key={user.id} userId={user.id} onDone={(purpose, line) => { setOpeningLine(line); setPurposeState({ kind: 'ready', purpose }); }} />;
  }
  const purposeLabel = purposeState.kind === 'ready' ? purposeState.purpose?.label ?? null : null;

  // 소개 초안을 프로필 소개란(bio)에 넣는다. 다른 칸(닉네임·지역·생활 리듬)은 읽어 온 값을 그대로 둔다. 읽기 실패면 저장하지 않는다.
  const useDraft = async (text: string): Promise<string | null> => {
    const loaded = await loadProfile(user.id);
    if (loaded.status === 'error') return '프로필을 읽지 못해 초안을 넣지 않았어요. 잠시 뒤 다시 시도해 주세요.';
    const profile = loaded.profile;
    return saveProfileText(user.id, { nickname: profile?.nickname ?? '', intro: text, region: profile?.region ?? '', lifeRhythm: profile?.lifeRhythm ?? '' });
  };

  // ECHO Conversation Agent(2026-09-25 대표 FINAL): 고른 만남과 한 줄이 첫 질문의 답이다. 그 뒤는 서버(doit-agent)가 다섯 목적 안에서 묻는다.
  if (ECHO_AGENT_ENABLED) {
    const firstAnswer = purposeLabel ? (openingLine.trim() ? `${purposeLabel}. ${openingLine.trim()}` : purposeLabel) : null;
    const goal = purposeState.kind === 'ready' ? purposeState.purpose : null;
    return <AgentConversation key={`${user.id}:${roundStartOf(user) ?? ''}`} userId={user.id} firstAnswer={firstAnswer} purposeLabel={purposeLabel} goal={goal} onRestart={restart} onContinue={onContinue} />;
  }

  return <CoreConversation key={user.id} userId={user.id} onContinue={onContinue} autoQuestion purposeLabel={purposeLabel} initialMessage={openingLine || undefined} onUseDraft={useDraft} roundStartedAt={roundStartOf(user)} onRestart={restart} />;
}
