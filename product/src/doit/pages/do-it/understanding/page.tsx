import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileLayout from '@/doit/components/feature/MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED } from '@/doit/lib/understandingApi';
import { ECHO_AGENT_ENABLED, agentForget, agentHome, type AgentKnown, type AgentSession, type AgentSlot, type KnownLine } from '@/doit/lib/agentApi';
import { UnderstandingError } from '@/doit/lib/understandingApi';
import { AREA_LABEL, areaOf, groupByArea, splitCurrent, type AreaId, type ViewItem } from '@/doit/lib/understandingView';
import RestartConversationButton from '@/doit/components/feature/RestartConversationButton';
import '@/doit/components/feature/understanding-pages.css';

// 나의 이해 = 「기억한다」(2026-09-26 대표 「FINAL HUMAN UX」 §11~§14 · §30~§33 · §39).
// 내가 맞다고 한 말만 모은 곳. 지금의 나(같은 뜻은 가장 최근 것 하나)를 먼저, 겹친 옛 말은 「지난 기록 보기」 안에.
// 다섯 칸으로 나눈다. ECHO 대화 정리는 서버가 정한 칸, 예전 기록은 낱말 규칙(understandingView.ts) · 애매하면 「아직 나누지 않은 말」.
// 저장된 기록은 지우거나 바꾸지 않는다(보이는 방식만).
// 2026-10-06 대표 「기억 영수증 · ECHO가 아는 나」: 맨 위에 네 칸(내가 확인한 것 / AI 짐작(확정 아님) / 내가 고친 것 / 아니라고 한 것) — 서버(doit-agent) knownView 그대로.
//   줄마다 「지우기」 = 서버 agent_forget(지운 글자는 AI 가 다시 만들지 않음). 거절된 AI 해석 원문은 보여 주되 사실로 쓰지 않는다. 민감 주제(건강·성·금전 등)는 글자를 다시 적지 않는다.

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

const KNOWN_COLUMNS: { id: keyof Pick<AgentKnown, 'confirmed' | 'guesses' | 'corrected' | 'rejected'>; title: string; note: string }[] = [
  { id: 'confirmed', title: '내가 확인한 것', note: '내가 직접 말했거나 맞다고 한 것이에요.' },
  { id: 'guesses', title: 'AI 짐작 · 확정 아님', note: 'ECHO가 정리하거나 짐작한 것이에요. 사실로 쓰지 않아요.' },
  { id: 'corrected', title: '내가 고친 것', note: '고친 말이 가장 먼저예요. 옛 뜻은 다시 쓰지 않아요.' },
  { id: 'rejected', title: '아니라고 한 것', note: '다시 단정하지 않아요. 원문은 참고로만 남겨요.' },
];
const SENSITIVE_TEXT = '민감한 내용이라 여기 다시 적지 않아요.';
function KnownSection({ known, busyKey, onForget }: { known: AgentKnown; busyKey: string | null; onForget: (line: KnownLine) => void }) {
  const total = KNOWN_COLUMNS.reduce((n, c) => n + known[c.id].length, 0);
  return <section className="doit-known" aria-label="ECHO가 아는 나">
    <div className="doit-understanding-section-heading"><h2>ECHO가 아는 나</h2>{known.confirmed_at && <time dateTime={known.confirmed_at}>확인 {formatDate(known.confirmed_at)}</time>}</div>
    {total === 0 ? <p className="doit-known-empty">아직 ECHO가 아는 게 없어요. 이야기하면 여기에 네 칸으로 나뉘어 보여요.</p>
      : KNOWN_COLUMNS.map((c) => <div key={c.id} className={`doit-known-col doit-known-col--${c.id}`}>
        <h3>{c.title} <small>{known[c.id].length}</small></h3>
        <p className="doit-known-note">{c.note}</p>
        {known[c.id].length > 0 && <ul className="doit-known-list">{known[c.id].map((l) => <li key={l.key} className={l.sensitive ? 'is-sensitive' : undefined}>
          <div className="doit-known-line">
            <span className="doit-known-text">{l.sensitive ? SENSITIVE_TEXT : l.text}</span>
            <button type="button" className="doit-known-forget" disabled={busyKey !== null} aria-label={`지우기: ${l.sensitive ? '민감한 내용' : l.text}`} onClick={() => onForget(l)}>{busyKey === l.key ? '지우는 중' : '지우기'}</button>
          </div>
          {!l.sensitive && c.id === 'corrected' && l.from.length > 0 && <small className="doit-known-from">전에는 「{l.from.join(' · ')}」</small>}
          {!l.sensitive && l.quote && l.quote.trim() !== l.text.trim() && c.id !== 'guesses' && <small className="doit-known-quote">내 말 「{l.quote}」</small>}
          {!l.sensitive && c.id === 'guesses' && l.quote && <small className="doit-known-quote">근거 「{l.quote}」</small>}
        </li>)}</ul>}
      </div>)}
    {known.forgotten > 0 && <p className="doit-known-footnote">지운 줄 {known.forgotten}개는 ECHO가 다시 만들지 않아요.</p>}
  </section>;
}

export default function Understanding() {
  const { user, loading: authLoading } = useAuth();
  const { records, insights, loading, error, reload } = useUnderstanding();
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [known, setKnown] = useState<AgentKnown | null>(null); // 세션이 없어도 자기 문장은 보인다(검수 P2-6)
  const [forgetKey, setForgetKey] = useState<string | null>(null);
  const [forgetError, setForgetError] = useState<string | null>(null);
  const userId = user?.id ?? null;
  const forget = async (line: KnownLine) => {
    if (!userId || forgetKey) return;
    setForgetKey(line.key); setForgetError(null);
    try { const r = await agentForget(userId, line.key, agent?.id ?? null); setAgent(r.session); setKnown(r.known); } // 서버가 지운 뒤 돌려준 모습 그대로(화면이 먼저 지우지 않음)
    catch (e) { setForgetError(e instanceof UnderstandingError && e.code === 'NOT_FOUND' ? '이미 지워진 줄이에요. 새로 불러올게요.' : '지우지 못했어요. 잠시 뒤 다시 눌러 주세요.'); if (e instanceof UnderstandingError && e.code === 'NOT_FOUND') agentHome(userId).then((r) => { setAgent(r.session); setKnown(r.known); }).catch(() => undefined); }
    finally { setForgetKey(null); }
  };
  useEffect(() => {
    if (!userId || !ECHO_AGENT_ENABLED) return;
    let live = true;
    agentHome(userId).then((r) => { if (live) { setAgent(r.session); setKnown(r.known); } }).catch(() => undefined); // 못 불러와도 예전 기록은 그대로 보인다
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
          <h2 className="doit-product-title">ECHO가 아는 나</h2>
          {/* 2026-10-10 대표 「모바일웹 전부 최종 후킹」: 확인·수정 장면 확정 후킹(2026-10-09) */}
          <p className="echo-flora-hook-sub">내 뜻과 다르면, 바로 고칠 수 있어요. 당신이 직접 들려준 이야기가 이해와 추천의 기준이 됩니다.</p>
          <p className="doit-product-description">확인한 것 · 짐작 · 고친 것 · 아니라고 한 것을 나눠서 보여 드려요. 줄마다 지울 수 있어요.</p>
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
            {known && <KnownSection known={known} busyKey={forgetKey} onForget={(l) => void forget(l)} />}
            {forgetError && <p className="doit-known-error" role="alert">{forgetError}</p>}
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
        {/* 2026-09-28 대표 「처음부터 다시 시작하기 UX」: 나의 이해 → 한 번 탭 → ECHO 첫 대화 화면(홈·요약 화면 경유 0). 기록·확정한 말은 그대로 남는다. */}
        {A_STRUCTURE_SERVER_ENABLED && user && <RestartConversationButton userId={user.id} />}
        <p className="doit-product-footnote">나만 보는 곳이에요. 다른 사람에게 보이는 프로필과는 따로예요.</p>
      </div>
    </MobileLayout>
  );
}
