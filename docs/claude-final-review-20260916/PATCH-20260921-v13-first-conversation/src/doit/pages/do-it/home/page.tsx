import { Link } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import { ASK_TOTAL } from '@/doit/components/feature/CoreConversation';
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
  const savedRecords = ready ? records.filter((record) => record.status !== 'rejected') : [];
  const latest = [...savedRecords].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const confirmed = ready ? insights.filter((item) => item.status === 'confirmed' || item.status === 'corrected') : [];
  const pendingCount = ready ? insights.filter((item) => item.status === 'candidate').length : 0;
  // v14.2(대표 2026-09-22 "메인 페이지에서 시작을 해야 하는데"): 여기가 앱의 메인이다.
  // 지금 어디까지 왔는지와 다음에 무엇을 할지를 이 화면에서 정한다.
  const answered = Math.min(savedRecords.length, ASK_TOTAL);
  const done = savedRecords.length >= ASK_TOTAL;
  const started = savedRecords.length > 0;

  return (
    <MobileLayout showNav activeTab="home">
      <div className="doit-understanding-page">
        <section className="doit-understanding-intro" aria-labelledby="echo-home-title">
          <p className="doit-product-kicker">DO IT · 상대를 찾기 전에</p>
          {done
            ? <>
                <h1 id="echo-home-title" className="doit-product-title">다섯 가지,<br />다 들었어요.</h1>
                <p className="doit-product-description">이제 사진과 소개를 준비하면<br />연결 자격이 갖춰져요.</p>
                <Link className="doit-product-action" to="/doit/start-journey?edit=photos">사진·소개 준비하기 <span aria-hidden="true">↗</span></Link>
              </>
            : started
              ? <>
                  <h1 id="echo-home-title" className="doit-product-title">{answered} / {ASK_TOTAL}<br />여기까지 왔어요.</h1>
                  <p className="doit-product-description">남은 건 {ASK_TOTAL - answered}가지예요.<br />짧게 한 줄이면 충분해요.</p>
                  <Link className="doit-product-action" to="/doit/conversation">대화 이어가기 <span aria-hidden="true">↗</span></Link>
                </>
              : <>
                  <h1 id="echo-home-title" className="doit-product-title">다섯 가지만<br />물어볼게요.</h1>
                  <p className="doit-product-description">이 다섯 가지 답이, 당신에게<br />누구를 소개할지 정하는 재료예요.</p>
                  <Link className="doit-product-action" to="/doit/start-journey">시작하기 <span aria-hidden="true">↗</span></Link>
                </>}
          <p className="doit-product-footnote">AI의 이해가 나와 다르면 고쳐주세요.<br />어떤 말이 나를 설명하는지는 내가 정해요.</p>
        </section>

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
            <h2>내 이야기를 이어갈 수 있도록</h2>
            <p>로그인하면 내가 남긴 이야기와 확인한 내용을 불러올 수 있어요.</p>
            <Link className="doit-understanding-text-link" to="/login" state={{ from: '/doit/home' }}>로그인하고 이어가기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : error ? (
          <section className="doit-understanding-notice" role="alert">
            <h2>기록을 불러오지 못했어요</h2>
            <p>지금은 저장된 내용을 확인할 수 없어요. 잠시 후 다시 불러와 주세요.</p>
            <button className="doit-understanding-text-link" type="button" onClick={() => void reload()}>다시 불러오기 <span aria-hidden="true">↻</span></button>
          </section>
        ) : (
          <>
            <section className="doit-understanding-latest" aria-labelledby="latest-record-title">
              <div className="doit-understanding-section-heading">
                <h2 id="latest-record-title">내가 남긴 이야기</h2>
                {latest && <time dateTime={latest.createdAt}>{formatDate(latest.createdAt)}</time>}
              </div>
              {latest ? <blockquote>{latest.text}</blockquote> : <p className="doit-understanding-empty">아직 남긴 이야기가 없어요.<br />지금 떠오르는 말부터 시작해도 좋아요.</p>}
              {latest && <Link className="doit-understanding-text-link" to="/doit/conversation">지난 이야기 이어보기 <span aria-hidden="true">→</span></Link>}
            </section>
            <Link className="doit-understanding-summary" to="/doit/understanding">
              <div><span>내가 확인한 이해</span><p>내 말에 가까워진 내용을 모아뒀어요.</p></div>
              <strong>{confirmed.length}<small>개</small></strong><span aria-hidden="true">↗</span>
            </Link>
            {pendingCount > 0 && <Link className="doit-understanding-pending-link" to="/doit/conversation">아직 확인하지 않은 AI 제안 {pendingCount}개 <span aria-hidden="true">→</span></Link>}
          </>
        )}
        <div className="doit-understanding-footer">
          <Link className="doit-understanding-text-link" to="/doit/connections">연결 준비 상태 보기 <span aria-hidden="true">↗</span></Link>
          <Link className="doit-understanding-text-link" to="/doit/profile">내 프로필 보기 <span aria-hidden="true">↗</span></Link>
          {started && <Link className="doit-understanding-text-link" to="/doit/conversation">처음부터 다시 시작하기 <span aria-hidden="true">↗</span></Link>}
          <p>대화 기록은 내가 살펴보는 개인 기록이에요.<br />이 화면에서 다른 사람에게 공개하지 않아요.</p>
        </div>
      </div>
    </MobileLayout>
  );
}
