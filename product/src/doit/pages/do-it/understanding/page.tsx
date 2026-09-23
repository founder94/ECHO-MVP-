import { useState } from 'react';
import { Link } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { useUnderstanding, type Category } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import '@/doit/components/feature/understanding-pages.css';

type Tab = 'all' | Category;
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' }, { key: 'value', label: '중요한 가치' },
  { key: 'pattern', label: '반복 경향' }, { key: 'memory', label: '기억할 선택' },
];
const CATEGORY_LABEL: Record<Category, string> = {
  value: '중요한 가치', pattern: '반복 경향', memory: '기억할 선택',
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
  });
}

export default function Understanding() {
  const [tab, setTab] = useState<Tab>('all');
  const { user, loading: authLoading } = useAuth();
  const { records, insights, loading, error, reload } = useUnderstanding();
  const ready = A_STRUCTURE_SERVER_ENABLED && !!user && !authLoading && !loading && !error;
  const confirmed = ready ? insights.filter((item) => item.status === 'confirmed' || item.status === 'corrected') : [];
  const pendingCount = ready ? insights.filter((item) => item.status === 'candidate').length : 0;
  const items = confirmed.filter((item) => tab === 'all' || item.category === tab)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <MobileLayout title="나의 이해" back>
      <div className="doit-understanding-page">
        <section className="doit-understanding-intro doit-understanding-intro--compact">
          <p className="doit-product-kicker">내가 맞다고 한 말</p>
          <h2 className="doit-product-title">나를 설명하는 말은,<br />내가 고를 수 있도록.</h2>
          <p className="doit-product-description">맞다고 확인하거나 직접 고친 내용만 모았어요.<br />지금의 나와 달라졌다면 다시 이야기해 주세요.</p>
        </section>
        {!A_STRUCTURE_SERVER_ENABLED ? (
          <section className="doit-understanding-notice">
            <h3>기록을 준비하고 있어요</h3>
            <p>지금은 계정에 저장된 대화 기록을 이용할 수 없어요. 프로필은 계속 준비할 수 있어요.</p>
            <Link className="doit-understanding-text-link" to="/doit/start-journey">내 프로필 준비하기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : authLoading || loading ? (
          <p className="doit-understanding-loading" role="status">내가 확인한 내용을 불러오고 있어요.</p>
        ) : !user ? (
          <section className="doit-understanding-notice">
            <h3>로그인하고 이어가세요</h3>
            <p>내 계정에 남긴 이야기와 확인한 내용을 불러올게요.</p>
            <Link className="doit-understanding-text-link" to="/login" state={{ from: '/doit/understanding' }}>로그인하기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : error ? (
          <section className="doit-understanding-notice" role="alert">
            <h3>기록을 불러오지 못했어요</h3>
            <p>지금은 저장된 내용을 확인할 수 없어요. 잠시 후 다시 불러와 주세요.</p>
            <button className="doit-understanding-text-link" type="button" onClick={() => void reload()}>다시 불러오기 <span aria-hidden="true">↻</span></button>
          </section>
        ) : (
          <>
            <div className="doit-understanding-section-heading">
              <p>맞다고 한 말 <strong>{confirmed.length}개</strong></p>
              <button className="doit-understanding-refresh" type="button" onClick={() => void reload()} aria-label="나의 이해 다시 불러오기">↻</button>
            </div>
            <div className="doit-understanding-filters" role="group" aria-label="이해 분류">
              {TABS.map((item) => <button type="button" key={item.key} onClick={() => setTab(item.key)} aria-pressed={tab === item.key}>{item.label}</button>)}
            </div>
            {items.length === 0 ? (
              <div className="doit-understanding-empty-state">
                <p>{confirmed.length === 0 ? '아직 맞다고 한 말이 없어요.' : '이 분류에는 아직 확인한 내용이 없어요.'}</p>
                <span>대화에서 제안한 내용을 확인하면 이곳에 남아요.</span>
              </div>
            ) : (
              <ol className="doit-understanding-list">
                {items.map((item) => {
                  const sourceRecord = records.find((record) => record.id === item.sourceRecordId && record.status !== 'rejected');
                  const source = sourceRecord?.originalText || item.source;
                  return <li key={item.id}>
                    <div className="doit-understanding-entry-meta"><span>{CATEGORY_LABEL[item.category]}</span><span>{item.origin === 'self' ? '직접 설명' : item.status === 'corrected' ? '내가 수정한 내용' : '내가 확인한 내용'}</span></div>
                    <p className="doit-understanding-entry-text">{item.text}</p>
                    {source && <details className="doit-understanding-source"><summary>처음 남긴 이야기 보기</summary><blockquote>{source}</blockquote></details>}
                    <time className="doit-understanding-entry-date" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </li>;
                })}
              </ol>
            )}
            {pendingCount > 0 && <section className="doit-understanding-pending">
              <p className="doit-product-kicker">아직 확인 전이에요</p>
              <h3>AI가 제안한 내용 {pendingCount}개</h3>
              <p>내 생각과 맞는지 확인하기 전에는 위 목록에 넣지 않아요.</p>
              <Link className="doit-understanding-text-link" to="/doit/conversation">대화에서 확인하기 <span aria-hidden="true">→</span></Link>
            </section>}
          </>
        )}
        <Link className="doit-product-action" to="/doit/conversation">ECHO와 이야기하기 <span aria-hidden="true">↗</span></Link>
        <p className="doit-product-footnote">이곳은 내가 살펴보는 개인 기록이에요.<br />다른 사람에게 보여주는 프로필과는 구분해요.</p>
      </div>
    </MobileLayout>
  );
}
