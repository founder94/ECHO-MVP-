import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import { roundStartOf } from '@/doit/lib/conversationRound';
import { ASK_TOTAL } from '@/doit/components/feature/CoreConversation';
import { ECHO_AGENT_ENABLED, agentGet, type AgentSession } from '@/doit/lib/agentApi';
import InstallAppCard from '@/doit/components/feature/InstallAppCard';
import ConnectionTurnsCard from '@/doit/components/feature/ConnectionTurnsCard';
import '@/doit/components/feature/understanding-pages.css';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
  });
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { records, insights, loading, error, reload } = useUnderstanding();
  // 연결 전 임시 자료를 계정에 저장된 기록처럼 보여주지 않는다.
  const ready = A_STRUCTURE_SERVER_ENABLED && !!user && !authLoading && !loading && !error;
  // 이번 회차의 답만 센다(대화 화면의 n / 5·서버 연결 자격과 같은 기준). 예전엔 「처음부터 다시」 뒤에도 지난 답까지 세어 홈만 5 / 5 로 보였다.
  const since = roundStartOf(user);
  const savedRecords = ready ? records.filter((record) => record.status !== 'rejected' && (!since || !record.createdAt || record.createdAt >= since)) : [];
  const latest = [...savedRecords].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const confirmed = ready ? insights.filter((item) => item.status === 'confirmed' || item.status === 'corrected') : [];
  const pendingCount = ready ? insights.filter((item) => item.status === 'candidate').length : 0;
  // v14.2(대표 2026-09-22 "메인 페이지에서 시작을 해야 하는데"): 여기가 앱의 메인이다.
  // 지금 어디까지 왔는지와 다음에 무엇을 할지를 이 화면에서 정한다.
  // ECHO Conversation Agent(2026-09-25): 진행은 서버 대화 상태(핵심 질문 몇 번째인지·끝났는지)로 센다 — 대화 화면과 같은 기준.
  //   한 답이 여러 목적을 채우거나 넘기면 기록 수와 질문 수가 다르므로 기록 수로 세지 않는다. 못 읽으면 기록 수로 돌아간다.
  const userId = user?.id ?? null;
  const [agent, setAgent] = useState<{ status: 'idle' | 'ready' | 'error'; session: AgentSession | null }>({ status: 'idle', session: null });
  useEffect(() => {
    if (!ECHO_AGENT_ENABLED || !userId || !A_STRUCTURE_SERVER_ENABLED) return;
    let current = true;
    agentGet(userId).then(session => { if (current) setAgent({ status: 'ready', session }); }).catch(() => { if (current) setAgent({ status: 'error', session: null }); });
    return () => { current = false; };
  }, [userId]);
  const useAgent = ECHO_AGENT_ENABLED && agent.status === 'ready';
  const answered = useAgent ? Math.max((agent.session?.progress.asked ?? 1) - 1, 0) : Math.min(savedRecords.length, ASK_TOTAL);
  const done = useAgent ? agent.session?.phase === 'done' : savedRecords.length >= ASK_TOTAL;
  const started = useAgent ? !!agent.session : savedRecords.length > 0;

  return (
    <MobileLayout showNav activeTab="home">
      <div className="doit-understanding-page">
        <section className="doit-understanding-intro" aria-labelledby="echo-home-title">
          <p className="doit-product-kicker">DO IT · 만나기 전에</p>
          {done
            ? <>
                <h1 id="echo-home-title" className="doit-product-title">다섯 가지,<br />다 들었어요.</h1>
                <p className="doit-product-description">이제 사진 세 장과<br />나를 소개할 몇 줄이 남았어요.</p>
                <Link className="doit-product-action" to="/doit/start-journey?edit=photos">사진과 소개 채우기 <span aria-hidden="true">↗</span></Link>
              </>
            : started
              ? <>
                  <h1 id="echo-home-title" className="doit-product-title">{answered} / {ASK_TOTAL}<br />여기까지 왔어요.</h1>
                  <p className="doit-product-description">남은 질문은 {ASK_TOTAL - answered}개예요.<br />한 줄씩이면 금방 끝나요.</p>
                  <Link className="doit-product-action" to="/doit/conversation">이어서 답하기 <span aria-hidden="true">↗</span></Link>
                </>
              : <>
                  <h1 id="echo-home-title" className="doit-product-title">다섯 가지만<br />물어볼게요.</h1>
                  <p className="doit-product-description">여기에 답한 말로<br />어떤 사람을 소개할지 정해요.</p>
                  <Link className="doit-product-action" to="/doit/start-journey">시작하기 <span aria-hidden="true">↗</span></Link>
                </>}
          <p className="doit-product-footnote">AI가 잘못 알아들으면 바로 고쳐 주세요.<br />나를 설명하는 말은 내가 정해요.</p>
        </section>

        {/* 내 연결에서 내 차례가 있으면 먼저 알린다(알림이 아직 없어서, v1.2). 없으면 아무것도 안 보인다. */}
        {A_STRUCTURE_SERVER_ENABLED && user && <ConnectionTurnsCard userId={user.id} />}

        {/* 홈 화면에 두기 제안(2026-09-26): 다섯 가지를 마친 뒤에만, 세션당 한 번. 이미 앱으로 열려 있으면 보이지 않는다. */}
        {done && <InstallAppCard />}

        {!A_STRUCTURE_SERVER_ENABLED ? (
          <section className="doit-understanding-notice" aria-label="기록 이용 안내">
            <h2>대화와 기록을 준비하고 있어요</h2>
            <p>지금은 계정에 저장된 대화 기록을 이용할 수 없어요. 프로필은 계속 준비할 수 있어요.</p>
            <Link className="doit-understanding-text-link" to="/doit/start-journey">내 프로필 준비하기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : authLoading || loading ? (
          <p className="doit-understanding-loading" role="status">내 이야기를 불러오고 있어요.</p>
        ) : !user ? (
          <section className="doit-understanding-notice">
            <h2>로그인하면 이어서 할 수 있어요</h2>
            <p>남겨 둔 이야기부터 다시 보여 드릴게요.</p>
            <Link className="doit-understanding-text-link" to="/login" state={{ from: '/doit/home' }}>로그인하고 이어가기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : error ? (
          <section className="doit-understanding-notice" role="alert">
            <h2>잠깐 연결이 끊겼어요</h2>
            <p>적어 둔 이야기는 지워지지 않았어요. 조금 뒤에 다시 불러와 주세요.</p>
            <button className="doit-understanding-text-link" type="button" onClick={() => void reload()}>다시 불러오기 <span aria-hidden="true">↻</span></button>
          </section>
        ) : (
          <>
            <section className="doit-understanding-latest" aria-labelledby="latest-record-title">
              <div className="doit-understanding-section-heading">
                <h2 id="latest-record-title">내가 남긴 이야기</h2>
                {latest && <time dateTime={latest.createdAt}>{formatDate(latest.createdAt)}</time>}
              </div>
              {latest ? <blockquote>{latest.text}</blockquote> : <p className="doit-understanding-empty">아직 남긴 이야기가 없어요.<br />생각나는 한 줄부터 적어 보세요.</p>}
              {latest && <Link className="doit-understanding-text-link" to="/doit/conversation">이어서 적기 <span aria-hidden="true">→</span></Link>}
            </section>
            <Link className="doit-understanding-summary" to="/doit/understanding">
              <div><span>내가 맞다고 한 말</span><p>AI가 알아들은 것 중, 내가 맞다고 한 것만 모았어요.</p></div>
              <strong>{confirmed.length}<small>개</small></strong><span aria-hidden="true">↗</span>
            </Link>
            {pendingCount > 0 && <Link className="doit-understanding-pending-link" to="/doit/conversation">맞는지 봐 줄 문장 {pendingCount}개 <span aria-hidden="true">→</span></Link>}
          </>
        )}
        <div className="doit-understanding-footer">
          <Link className="doit-understanding-text-link" to="/doit/connections">연결까지 남은 것 보기 <span aria-hidden="true">↗</span></Link>
          <Link className="doit-understanding-text-link" to="/doit/profile">내 프로필 보기 <span aria-hidden="true">↗</span></Link>
          {/* v14.3: 전에는 대화 화면만 열고 다시 시작하지 않았다. 이제 대화 화면에서 "처음부터 다시" 확인 창이 바로 열린다. */}
          {started && <Link className="doit-restart-pill" to="/doit/conversation?restart=1"><span aria-hidden="true">↺</span>처음부터 다시 시작하기</Link>}
          <p>여기 적은 이야기는 나만 봐요.<br />다른 사람에게 그대로 보여 주지 않아요.</p>
        </div>
      </div>
    </MobileLayout>
  );
}
