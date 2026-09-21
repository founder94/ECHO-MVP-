import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import MobileLayout from './MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { A_STRUCTURE_SERVER_ENABLED, UnderstandingError, understandingRequest } from '@/doit/lib/understandingApi';
import './asleep-connections.css';

// "당신이 잠든 사이" (대표 확정 2026-09-21 연결 원칙 · 2026-09-22 지시 "저장한 걸로 사람을 매칭").
// 서버(doit-understanding v13.4 connection_preview)가 돌려주는 건 숫자와 내 말뿐이다. 다른 사람의 이름·사진·글은 첫 질문 뒤에야 열린다(blind-first).
// 이 화면은 실제 연결을 만들지 않는다. 자격이 갖춰지면 서버가 후보를 정하고, 첫 100명은 대표가 직접 승인한다.
interface Preview {
  purpose: string | null;
  readiness: { confirmed: number; confirmed_needed: number; photos: number; photos_needed: number; intro: boolean; phone_verified: boolean };
  eligible: boolean; waiting: number; candidates: number; common: string[]; note: string;
}
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; preview: Preview };

const HEADLINE = <>당신이 잠든 사이,<br />AI가 먼저 만나봅니다.</>;
const SUBLINE = '프로필보다, 함께한 행동을 봅니다.';

export default function AsleepConnections() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId || !A_STRUCTURE_SERVER_ENABLED) return;
    let current = true;
    setState({ kind: 'loading' });
    understandingRequest<Preview>({ action: 'connection_preview' }, userId)
      .then(preview => { if (current) setState({ kind: 'ready', preview }); })
      .catch(e => { if (current) setState({ kind: 'error', message: e instanceof UnderstandingError && (e.code === 'BAD_REQUEST' || e.code === 'SERVER_UPDATE_REQUIRED') ? '연결 준비 서버가 아직 새 판으로 바뀌지 않았어요.' : '연결 준비 상태를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' }); });
    return () => { current = false; };
  }, [userId]);

  return <MobileLayout title="연결" showNav activeTab="connections">
    <section className="doit-product-story doit-asleep">
      <p className="doit-product-kicker">WHILE YOU SLEEP</p>
      <h2 className="doit-product-title">{HEADLINE}</h2>
      <p className="doit-product-description">{SUBLINE}</p>
      {loading && <p className="doit-asleep-status" role="status">로그인 상태를 확인하고 있어요.</p>}
      {!loading && !user && <><p className="doit-asleep-status">로그인하면 내 연결 준비 상태를 볼 수 있어요.</p><Link className="doit-product-action" to="/login" state={{ from: '/doit/connections' }}>로그인하기<span aria-hidden="true">↗</span></Link></>}
      {user && !A_STRUCTURE_SERVER_ENABLED && <p className="doit-asleep-status">연결 준비 화면은 서버 연결 뒤에 열려요.</p>}
      {user && A_STRUCTURE_SERVER_ENABLED && state.kind === 'loading' && <div className="doit-asleep-wait" role="status"><span className="echo-thinking-orbit" aria-hidden="true"><DoItSymbol decorative /></span><p>내가 확인한 말로 준비 상태를 살피고 있어요.</p></div>}
      {state.kind === 'error' && <p className="doit-product-error" role="alert">{state.message}</p>}
      {state.kind === 'ready' && <Ready preview={state.preview} />}
    </section>
  </MobileLayout>;
}

function Ready({ preview }: { preview: Preview }) {
  const r = preview.readiness;
  const rows: { label: string; done: boolean; detail: string; to: string }[] = [
    { label: '확인한 이해', done: r.confirmed >= r.confirmed_needed, detail: `${Math.min(r.confirmed, r.confirmed_needed)} / ${r.confirmed_needed}`, to: '/doit/conversation' },
    { label: '필수 사진(전신·패션·취미)', done: r.photos >= r.photos_needed, detail: `${Math.min(r.photos, r.photos_needed)} / ${r.photos_needed}`, to: '/doit/start-journey?edit=photos' },
    { label: '내 소개', done: r.intro, detail: r.intro ? '있음' : '아직', to: '/doit/start-journey?edit=profile' },
    { label: '전화 인증', done: r.phone_verified, detail: r.phone_verified ? '완료' : '준비 중', to: '/doit/start-journey' },
  ];
  return <>
    <div className="doit-asleep-card">
      <p className="doit-asleep-label">{preview.purpose ? `원하는 만남 · ${preview.purpose}` : '원하는 만남을 아직 고르지 않았어요'}</p>
      <ul className="doit-asleep-check">{rows.map(row => <li key={row.label} data-done={row.done ? 'true' : 'false'}><span aria-hidden="true">{row.done ? '●' : '○'}</span><Link to={row.to}>{row.label}</Link><strong>{row.detail}</strong></li>)}</ul>
      <p className="doit-asleep-status">{preview.eligible ? '연결 자격이 갖춰졌어요. 서버가 후보를 고르고, 대표가 확인한 뒤 첫 질문이 열려요.' : '자격이 갖춰지면 서버가 후보를 고르기 시작해요. 그 전까지는 아무에게도 보이지 않아요.'}</p>
    </div>
    <div className="doit-asleep-card">
      <p className="doit-asleep-label">지금 같은 만남을 기다리는 사람</p>
      <p className="doit-asleep-number"><strong>{preview.waiting}</strong>명 <span>· 그중 내가 확인한 말과 겹치는 사람 <strong>{preview.candidates}</strong>명</span></p>
      {preview.common.length > 0 && <ul className="doit-asleep-common">{preview.common.map(text => <li key={text}>"{text}"</li>)}</ul>}
      {preview.waiting === 0 && <p className="doit-asleep-status">아직 같은 만남을 고른 다른 사람이 없어요. 내 이야기는 그대로 쌓여요.</p>}
      <p className="doit-product-footnote">{preview.note}</p>
    </div>
    <Link className="doit-product-action" to="/doit/conversation">대화 이어가기<span aria-hidden="true">↗</span></Link>
    <Link className="doit-product-action doit-product-action--secondary" to="/doit/start-journey?edit=profile">사진·소개 준비하기<span aria-hidden="true">↗</span></Link>
  </>;
}
