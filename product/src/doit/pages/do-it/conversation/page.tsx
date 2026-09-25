import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/doit/hooks/useAuth';
import CoreConversation from '@/doit/components/feature/CoreConversation';
import SymbolLoader from '@/components/SymbolLoader';
import ConversationOpening from '@/doit/components/feature/ConversationOpening';
import AgentConversation from '@/doit/components/feature/AgentConversation';
import { ECHO_AGENT_ENABLED } from '@/doit/lib/agentApi';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import { loadProfile, saveProfileText } from '@/doit/lib/profileSave';
import { roundStartOf, startNewRound } from '@/doit/lib/conversationRound';

type Purpose = { id: string; label: string };
type PurposeState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; purpose: Purpose | null };

// v13 흐름: 로그인 → (목적이 없으면) ECHO의 첫 질문 "어떤 만남을 원하세요?" → 대화.
// 목적 조회에 실패해도 대화를 막지 않는다(목적 없이 진행, 서버가 방향 없이 이어 묻는다).
export default function ConversationPage() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useSearchParams();
  // v14.3 앱 홈의 「처음부터 다시 시작하기」(?restart=1): 한 번만 읽고 주소에서 지운다.
  // 남겨 두면 다시 시작한 뒤 화면이 바뀔 때마다 확인 창이 또 뜬다.
  const [restartPrompt, setRestartPrompt] = useState(() => search.get('restart') === '1');
  const navigate = useNavigate();
  const [purposeState, setPurposeState] = useState<PurposeState>({ kind: 'loading' });
  const [openingLine, setOpeningLine] = useState('');
  const userId = user?.id ?? null;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
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

  const onContinue = () => navigate('/doit/start-journey?edit=profile');
  if (!A_STRUCTURE_SERVER_ENABLED) return <CoreConversation key={user.id} userId={user.id} onContinue={onContinue} />;
  if (purposeState.kind === 'loading') return <div className="echo-dialogue echo-dialogue--pastel echo-dialogue--waiting"><SymbolLoader size={132} label="지난번에 고른 만남을 가져오고 있어요." /></div>;
  if (purposeState.kind === 'ready' && purposeState.purpose === null) {
    return <ConversationOpening key={user.id} userId={user.id} onDone={(purpose, line) => { setRestartPrompt(false); setOpeningLine(line); setPurposeState({ kind: 'ready', purpose }); }} />;
  }
  const purposeLabel = purposeState.kind === 'ready' ? purposeState.purpose?.label ?? null : null;

  // 소개 초안을 프로필 소개란(bio)에 넣는다. 다른 칸(닉네임·지역·생활 리듬)은 읽어 온 값을 그대로 둔다. 읽기 실패면 저장하지 않는다.
  const useDraft = async (text: string): Promise<string | null> => {
    const loaded = await loadProfile(user.id);
    if (loaded.status === 'error') return '프로필을 읽지 못해 초안을 넣지 않았어요. 잠시 뒤 다시 시도해 주세요.';
    const profile = loaded.profile;
    return saveProfileText(user.id, { nickname: profile?.nickname ?? '', intro: text, region: profile?.region ?? '', lifeRhythm: profile?.lifeRhythm ?? '' });
  };

  // v13.4 "처음부터 다시": 새 회차 시각을 남기고 목적을 비운다 → 첫 질문(목적 타일)부터 다시. 지난 기록은 화면 아래 "이전 회차"에서 다시 볼 수 있다.
  const restart = async (): Promise<string | null> => {
    const failure = await startNewRound(user.id);
    if (failure) return failure;
    if (alive.current) { setRestartPrompt(false); setOpeningLine(''); setPurposeState({ kind: 'ready', purpose: null }); }
    return null;
  };

  // ECHO Conversation Agent(2026-09-25 대표 FINAL): 고른 만남과 한 줄이 첫 질문의 답이다. 그 뒤는 서버(doit-agent)가 다섯 목적 안에서 묻는다.
  if (ECHO_AGENT_ENABLED) {
    const firstAnswer = purposeLabel ? (openingLine.trim() ? `${purposeLabel}. ${openingLine.trim()}` : purposeLabel) : null;
    return <AgentConversation key={`${user.id}:${roundStartOf(user) ?? ''}`} userId={user.id} firstAnswer={firstAnswer} onRestart={restart} onContinue={onContinue} restartPrompt={restartPrompt} />;
  }

  return <CoreConversation key={user.id} userId={user.id} onContinue={onContinue} autoQuestion purposeLabel={purposeLabel} initialMessage={openingLine || undefined} onUseDraft={useDraft} roundStartedAt={roundStartOf(user)} onRestart={restart} restartPrompt={restartPrompt} />;
}
