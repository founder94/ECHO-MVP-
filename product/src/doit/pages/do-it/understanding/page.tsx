import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import { ECHO_AGENT_ENABLED, agentGet, type AgentSession, type AgentSlot } from '@/doit/lib/agentApi';
import { AREA_LABEL, areaOf, groupByArea, splitCurrent, type AreaId, type ViewItem } from '@/doit/lib/understandingView';
import '@/doit/components/feature/understanding-pages.css';

// 나의 이해 = 「기억한다」(2026-09-26 대표 「FINAL HUMAN UX」 §11~§14 · §30~§33 · §39).
// 내가 맞다고 한 말만 모은 곳. 지금의 나(같은 뜻은 가장 최근 것 하나)를 먼저, 겹친 옛 말은 「지난 기록 보기」 안에.
// 다섯 칸으로 나눈다. ECHO 대화 정리는 서버가 정한 칸, 예전 기록은 낱말 규칙(understandingView.ts) · 애매하면 「아직 나누지 않은 말」.
// 저장된 기록은 지우거나 바꾸지 않는다(보이는 방식만).

const ORIGIN_TEXT: Record<ViewItem['origin'], string> = { conversation: '대화에서 말한 것', confirmed: '맞다고 한 말', corrected: '내가 고친 말', self: '내가 직접 쓴 말' };

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
}

function Entry({ item }: { item: ViewItem }) {
  return <li>
    <p className="doit-understanding-entry-text">{item.text}</p>
    <div className="doit-understanding-entry-meta"><span>{ORIGIN_TEXT[item.origin]}</span>{item.at && <time dateTime={item.at}>{formatDate(item.at)}</time>}</div>
    {item.source && item.source.trim() !== item.text.trim() && <details className="doit-understanding-source"><summary>처음 남긴 이야기 보기 <span aria-hidden="true">›</span></summary><blockquote>{item.source}</blockquote></details>}
  </li>;
}

export default function Understanding() {
  const { user, loading: authLoading } = useAuth();
  const { records, insights, loading, error, reload } = useUnderstanding();
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId || !ECHO_AGENT_ENABLED) return;
    let live = true;
    agentGet(userId).then((s) => { if (live) setAgent(s); }).catch(() => undefined); // 못 불러와도 예전 기록은 그대로 보인다
    return () => { live = false; };
  }, [userId]);

  const ready = A_STRUCTURE_SERVER_ENABLED && !!user && !authLoading && !loading && !error;
  const items: ViewItem[] = [];
  if (ready) {
    // ECHO 대화 정리(가장 최근 대화 · 서버가 정한 칸 · 지금 뜻만)
    const profile = agent?.phase === 'done' ? agent.profile : null;
    if (profile) for (const area of Object.keys(AREA_LABEL) as AreaId[]) {
      const slot = profile[area as keyof typeof profile] as AgentSlot | undefined;
      if (!slot || slot.status !== 'CONFIRMED') continue;
      slot.items.forEach((i, k) => items.push({ key: `agent-${area}-${k}`, text: i.note, area, origin: 'conversation', source: i.quote, at: null, order: Number.MAX_SAFE_INTEGER - k }));
    }
    // 예전 기록: 맞다고 한 말·고친 말·직접 쓴 말
    for (const it of insights) {
      if (it.status !== 'confirmed' && it.status !== 'corrected') continue;
      const record = records.find((r) => r.id === it.sourceRecordId && r.status !== 'rejected');
      items.push({ key: it.id, text: it.text, area: areaOf(it.text), origin: it.origin === 'self' ? 'self' : it.status === 'corrected' ? 'corrected' : 'confirmed', source: record?.originalText || it.source || null, at: it.createdAt, order: Date.parse(it.createdAt) || 0 });
    }
  }
  const { current, past } = splitCurrent(items);
  const groups = groupByArea(current);
  const pendingCount = ready ? insights.filter((item) => item.status === 'candidate').length : 0;

  return (
    <MobileLayout title="나의 이해" back>
      <div className="doit-understanding-page">
        <section className="doit-understanding-intro doit-understanding-intro--compact">
          <h2 className="doit-product-title">ECHO가 기억하고 있는 나</h2>
          <p className="doit-product-description">내가 맞다고 한 것만 모았어요.</p>
        </section>
        {!A_STRUCTURE_SERVER_ENABLED ? (
          <section className="doit-understanding-notice">
            <h3>지금은 기록을 열 수 없어요</h3>
            <Link className="doit-understanding-text-link" to="/doit/conversation">ECHO와 이야기하기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : authLoading || loading ? (
          <p className="doit-understanding-loading" role="status">불러오는 중이에요.</p>
        ) : !user ? (
          <section className="doit-understanding-notice">
            <h3>로그인하면 보여요</h3>
            <Link className="doit-understanding-text-link" to="/login" state={{ from: '/doit/understanding' }}>로그인하기 <span aria-hidden="true">→</span></Link>
          </section>
        ) : error ? (
          <section className="doit-understanding-notice" role="alert">
            <h3>기록을 불러오지 못했어요</h3>
            <button className="doit-understanding-text-link" type="button" onClick={() => void reload()}>다시 불러오기 <span aria-hidden="true">↻</span></button>
          </section>
        ) : (
          <>
            <div className="doit-understanding-section-heading">
              <h2>지금의 나</h2>
              <button className="doit-understanding-refresh" type="button" onClick={() => void reload()} aria-label="다시 불러오기">↻</button>
            </div>
            {groups.length === 0 ? (
              <div className="doit-understanding-empty-state">
                <p>아직 모인 말이 없어요.</p>
                <span>ECHO와 이야기하고 맞다고 하면 여기에 남아요.</span>
              </div>
            ) : groups.map((g) => (
              <section key={g.area} className="doit-understanding-area" aria-label={AREA_LABEL[g.area]}>
                <h3 className="doit-understanding-area-title">{AREA_LABEL[g.area]}</h3>
                <ol className="doit-understanding-list">{g.items.map((it) => <Entry key={it.key} item={it} />)}</ol>
              </section>
            ))}
            {past.length > 0 && <details className="doit-understanding-past">
              <summary>지난 기록 보기 <span aria-hidden="true">›</span></summary>
              <p className="doit-understanding-past-note">같은 뜻으로 전에 한 말이에요. 지우지 않고 남겨 뒀어요.</p>
              <ol className="doit-understanding-list">{past.map((it) => <Entry key={it.key} item={it} />)}</ol>
            </details>}
            {pendingCount > 0 && <section className="doit-understanding-pending">
              <h3>아직 확인 안 한 말 {pendingCount}개</h3>
              <Link className="doit-understanding-text-link" to="/doit/conversation">확인하러 가기 <span aria-hidden="true">→</span></Link>
            </section>}
          </>
        )}
        <Link className="doit-product-action" to="/doit/conversation">ECHO와 이야기하기 <span aria-hidden="true">↗</span></Link>
        <p className="doit-product-footnote">나만 보는 곳이에요. 다른 사람에게 보이는 프로필과는 따로예요.</p>
      </div>
    </MobileLayout>
  );
}
