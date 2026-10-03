import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import MobileLayout from './MobileLayout';
import { useAuth } from '@/doit/hooks/useAuth';
import { A_STRUCTURE_SERVER_ENABLED, UnderstandingError, understandingRequest } from '@/doit/lib/understandingApi';
import { ECHO_AGENT_ENABLED, agentGet, agentRun, createAgentRunTrigger, type AgentRun } from '@/doit/lib/agentApi';
import ConnectionMatches from './ConnectionMatches';
import ConnectionCandidates from './ConnectionCandidates';
import type { MyCandidates } from '@/doit/lib/connectApi';
import './asleep-connections.css';
import { useRestartConversation } from '@/doit/hooks/useRestartConversation';
import { PHONE_VERIFY_READY } from '@/doit/lib/phoneVerify'; // 문자 발송 업체 연결 전 false(전화 인증 화면과 같은 값)

// "당신이 잠든 사이" (대표 확정 2026-09-21 연결 원칙 · 2026-09-22 지시 "저장한 걸로 사람을 매칭").
// 서버(doit-understanding v13.4 connection_preview)가 돌려주는 건 숫자와 내 말뿐이다. 다른 사람의 이름·사진·글은 첫 질문 뒤에야 열린다(blind-first).
// 숫자는 '겹침 수'일 뿐 추천이 아니다(대표 지시 2026-09-22: 후보 수 표시와 실제 추천을 구분한다). 대화 횟수로 추천이 열리지 않는다.
// v1 연결(2026-09-23): 대표가 승인한 연결만 「내 연결」(ConnectionMatches, 서버 doit-connect)에 나온다. 상대 이름·사진은 둘 다 첫 질문에 답한 뒤에만.
interface Preview {
  purpose: string | null;
  // v14.2(대표 2026-09-24): 자격 칸은 「다섯 가지 질문에 모두 답함」(answers). confirmed 는 맞다고 한 말 수(겹친 말 찾기용)로만 남는다.
  // v15.1: answers = 연결 자격에 세는 "내용 있는 답" 수. turns = 이번 회차에 적은 답 수(대화 진행), uninformative = 그중 「모르겠어요」처럼 세지 않은 답 수.
  //   예전 서버(v24 이하)는 turns·uninformative 를 보내지 않는다 → 없으면 answers 와 같다고 본다.
  readiness: { answers: number; answers_needed: number; turns?: number; uninformative?: number; confirmed: number; photos: number; photos_needed: number; intro: boolean; phone_verified: boolean };
  eligible: boolean; waiting: number; candidates: number; common: string[]; note: string;
}
type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; preview: Preview };

// 2026-09-26 대표 「FINAL HUMAN UX」 §23·§41: 연결 0건인 지금 「AI가 먼저 만나봅니다」는 앞서가는 말 → 제품 훅(나는 말한다 · 찾는 건 ECHO가)으로. 히어로 문구는 그대로.
const HEADLINE = <>나는 말하고,<br />찾는 건 ECHO가.</>;
// 2026-09-30: 후보·서로 골랐어요 화면 위에 「지금은 준비 중」이 같이 서 있어 어긋났다 → 어느 상태에서나 맞는 한 줄.
const SUBLINE = '내가 한 말을 바탕으로, 이어질 만한 사람을 ECHO가 먼저 살펴봐요.';

// FI-018: 연결 서버가 준 대화 준비(Agent 공통 계약) 칸 이름 — 답 개수가 아니라 ECHO 가 확인한 이야기로 본다.
const CONVERSATION_LABEL = 'ECHO와 대화';
// 「다섯 가지 질문」 칸이 가리키는 곳이 「처음부터 다시」일 때의 표시(주소가 아니라 공통 동작을 부른다).
const RESTART = 'restart:conversation';

export default function AsleepConnections() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [opened, setOpened] = useState(0); // v2.0 상호선택으로 연결이 열리면 「내 연결」을 다시 읽는다
  const [focusMatch, setFocusMatch] = useState<string | null>(null); // 2026-09-30: 「이야기 시작하기」 → 서버가 준 그 연결로
  const [server, setServer] = useState<MyCandidates | null>(null); // FI-018: 연결 서버(doit-connect)가 계산한 자격 · 준비 칸
  const [candidatesKey, setCandidatesKey] = useState(0); // 실행 단계가 「후보 열기」라고 하면 기존 후보 화면(doit-connect)을 다시 읽는다
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
      {user && A_STRUCTURE_SERVER_ENABLED && <ConnectionCandidates key={candidatesKey} userId={user.id} onServerState={setServer} onOpened={matchId => { setFocusMatch(matchId); setOpened(n => n + 1); }} />}
      {user && A_STRUCTURE_SERVER_ENABLED && <ConnectionMatches key={opened} userId={user.id} focusId={focusMatch} />}
      {state.kind === 'ready' && <Ready preview={state.preview} server={server} userId={userId} onOpenCandidates={() => setCandidatesKey(n => n + 1)} />}
    </section>
  </MobileLayout>;
}

function Ready({ preview, server, userId, onOpenCandidates }: { preview: Preview; server: MyCandidates | null; userId: string | null; onOpenCandidates: () => void }) {
  // 「처음부터 다시 답하기」는 앱 공통 동작 하나(useRestartConversation) — 누르면 새 회차를 열고 곧바로 ECHO 첫 대화 화면.
  const { restart, busy: restarting, error: restartError } = useRestartConversation(userId);

  // FI-018(2026-10-01): 연결 서버가 readiness 를 주면 그 값만 그린다(대화 = Agent 와 같은 공통 계약 · 화면 계산 0).
  //   예전 서버(readiness 없음)일 때만 아래 옛 「다섯 가지 질문」 숫자(doit-understanding connection_preview)를 쓴다.
  const sr = server?.readiness ?? null;
  const r = preview.readiness;
  const turns = sr ? sr.conversation.have : r.turns ?? r.answers;
  const skipped = sr ? 0 : r.uninformative ?? 0;
  // v15.1 다섯 칸을 다 썼는데 내용 있는 답이 모자라면(「모르겠어요」 등) 이어서 답할 곳이 없다 → 「처음부터 다시 답하기」가 빠져나갈 문이다.
  const turnsUsedUp = sr ? false : turns >= r.answers_needed && r.answers < r.answers_needed;
  const conversationRow = sr
    ? { label: CONVERSATION_LABEL, done: sr.conversation.ready, detail: sr.conversation.ready ? '마침' : sr.conversation.have > 0 ? '조금 더' : '아직', to: '/doit/conversation' }
    : { label: '다섯 가지 질문', done: r.answers >= r.answers_needed, detail: `${Math.min(r.answers, r.answers_needed)} / ${r.answers_needed}`, to: turnsUsedUp ? RESTART : '/doit/conversation' };
  const intro = sr ? sr.intro : r.intro;
  const photos = sr ? sr.photos : r.photos, photosNeeded = sr ? sr.photos_needed : r.photos_needed;
  const phoneVerified = sr ? sr.phone_verified : r.phone_verified;
  const eligible = server && sr ? server.eligible : preview.eligible;
  const rows: { label: string; done: boolean; detail: string; to: string }[] = [
    conversationRow,
    // 2026-09-25 대표 MASTER §10 순서: 대화 → AI 소개 확인 → 사진 → 전화 인증 → 연결 준비. 대화 에이전트가 켜진 앱은 대화 끝 화면에서 AI 초안을 확인한다.
    { label: '내 소개', done: intro, detail: intro ? '있음' : '아직', to: ECHO_AGENT_ENABLED ? '/doit/conversation' : '/doit/start-journey?edit=profile' },
    { label: '필수 사진(전신·패션·취미)', done: photos >= photosNeeded, detail: `${Math.min(photos, photosNeeded)} / ${photosNeeded}`, to: '/doit/start-journey?edit=photos' },
    // 2026-09-27 대표 「P0-1」: 전화 인증은 연결 자격이 아니다(선택 · 참고로만 보임).
    { label: '전화 인증', done: phoneVerified, detail: phoneVerified ? '했음' : PHONE_VERIFY_READY ? '선택' : '선택 · 준비 중', to: '/doit/verify?next=/doit/connections' },
  ];
  const answersDone = rows[0].done;
  // 대표 2026-09-25 「연결 준비 화면 = 다음 할 일을 크게, 사진·소개·전화는 작은 진행으로(요건은 그대로)」.
  const ACTIONS: Record<string, { title: string; action: string }> = {
    '다섯 가지 질문': turns > 0 ? { title: '다섯 가지 대화를 마저 해요', action: '대화 이어가기' } : { title: '다섯 가지 대화부터 시작해요', action: '대화 시작하기' },
    [CONVERSATION_LABEL]: turns > 0 ? { title: 'ECHO와 대화를 조금 더 해요', action: '대화 이어가기' } : { title: 'ECHO와 대화부터 시작해요', action: '대화 시작하기' },
    '필수 사진(전신·패션·취미)': { title: '필수 사진 세 장을 채워요', action: '사진 채우기' }, '내 소개': ECHO_AGENT_ENABLED ? { title: '내 소개를 확인해요', action: '소개 확인하기' } : { title: '내 소개를 적어요', action: '소개 쓰기' }, '전화 인증': { title: '전화 인증을 해요', action: '전화 인증하기' },
  };
  // 전화 인증이 아직 준비 중이면 「다음 할 일」로 내밀지 않는다(누를 수 있는 버튼처럼 보이지 않게).
  const firstLeft = rows.find(row => !row.done && row.label !== '전화 인증'); // 전화 인증(선택)은 「다음 할 일」로 내밀지 않는다
  // 2026-10-01 UI/UX FINAL CLOSE: 원하는 만남(목적)도 서버 readiness 값으로 본다. 화면 칸이 다 찼어도 서버가 자격 없음이면 「모두 마쳤어요」라고 하지 않는다.
  const purposeLeft = sr ? !sr.purpose : false;
  const next = purposeLeft
    ? { to: '/doit/start-journey', title: '원하는 만남을 골라요', action: '만남 고르기' }
    : firstLeft ? { to: firstLeft.to, ...(firstLeft === rows[0] && turnsUsedUp ? { title: '다섯 가지를 처음부터 다시 답해요', action: '처음부터 다시 답하기' } : ACTIONS[firstLeft.label] ?? { title: firstLeft.label, action: firstLeft.label }) } : null;
  return <>
    {ECHO_AGENT_ENABLED && userId && eligible && !next && <AgentRunButton userId={userId} onOpenCandidates={onOpenCandidates} />}
    <div className="doit-asleep-card doit-asleep-next">
      <p className="doit-asleep-label">다음 할 일</p>
      <p className="doit-asleep-next-title">{next ? next.title : eligible ? '연결 준비를 모두 마쳤어요' : 'ECHO가 연결 준비를 확인하고 있어요'}</p>
      {next && (next.to === RESTART
        ? <button type="button" className="doit-product-action" disabled={restarting} onClick={() => void restart()}>{next.action}<span aria-hidden="true">↗</span></button>
        : <Link className="doit-product-action" to={next.to}>{next.action}<span aria-hidden="true">↗</span></Link>)}
      {restartError && <p className="doit-product-error" role="alert">{restartError}</p>}
      {skipped > 0 && <p className="doit-asleep-status">「모르겠어요」처럼 넘긴 답 {skipped}개는 연결 자격에 세지 않아요. 적은 말은 그대로 남아 있어요.{turnsUsedUp ? ' 처음부터 다시 답하면 채울 수 있어요.' : ''}</p>}
    </div>
    <div className="doit-asleep-card">
      <p className="doit-asleep-label">{preview.purpose ? `연결까지 남은 것 · ${preview.purpose}` : '연결까지 남은 것 · 원하는 만남을 아직 고르지 않았어요'}</p>
      <ul className="doit-asleep-check doit-asleep-check--small">{rows.map(row => <li key={row.label} data-done={row.done ? 'true' : 'false'}><span aria-hidden="true">{row.done ? '●' : '○'}</span>{!PHONE_VERIFY_READY && row.label === '전화 인증' && !row.done ? <span>{row.label}</span> : row.to === RESTART ? <button type="button" className="doit-asleep-link-button" disabled={restarting} onClick={() => void restart()}>{row.label}</button> : <Link to={row.to}>{row.label}</Link>}<strong>{row.detail}</strong></li>)}</ul>
      <p className="doit-asleep-status">{eligible ? '연결 자격을 갖췄어요. ECHO가 같은 만남을 원하는 사람 중 후보를 준비하면 위에 보여 드려요. 두 사람이 모두 고르면 연결이 열려요.' : (sr ? 'ECHO와 대화·소개·사진 세 가지를 채우면' : '질문·소개·사진 세 가지를 채우면') + ' 연결을 받을 수 있어요(전화 인증은 선택이에요). 그 전까지 내 이야기는 아무에게도 보이지 않아요.'}</p>
    </div>
    <div className="doit-asleep-card">
      <p className="doit-asleep-label">지금 같은 만남을 기다리는 사람</p>
      <p className="doit-asleep-number"><strong>{preview.waiting}</strong>명 <span>· 그중 내가 확인한 말과 겹치는 사람 <strong>{preview.candidates}</strong>명</span></p>
      {preview.common.length > 0 && <ul className="doit-asleep-common">{preview.common.map(text => <li key={text}>"{text}"</li>)}</ul>}
      {preview.waiting === 0 && <p className="doit-asleep-status">아직 같은 만남을 고른 다른 사람이 없어요. 내 이야기는 그대로 쌓여요.</p>}
      <p className="doit-asleep-status">이 숫자는 추천이 아니라 겹친 사람 수예요. 상대의 이름·사진은 열리지 않아요. 대화를 몇 번 했는지로 추천이 열리지도 않아요.</p>
      <p className="doit-product-footnote">{preview.note}</p>
    </div>
    {/* 2026-09-24 대표 실기기: 다섯 가지를 다 답했는데도 「질문에 이어서 답하기」가 떠서, 누르면 "다 들었어요"만 나왔다.
        남은 것 중 첫 번째는 맨 위 「다음 할 일」 큰 버튼으로(2026-09-25), 다 답했으면 「처음부터 다시 답하기」를 작은 버튼으로 둔다. */}
    {answersDone && <button type="button" className="doit-product-action doit-product-action--secondary" disabled={restarting} onClick={() => void restart()}>처음부터 다시 답하기<span aria-hidden="true">↗</span></button>}
  </>;
}

// 2026-10-03 실행 단계(서버 agent_run · 모델 호출 0) — 연결 준비를 마친 사용자가 직접 누를 때만. 화면 진입·자동 재시도·자동 재개·후보 자동 선택 0.
// 다음 할 일은 서버의 next 그대로: 「후보 열기」면 기존 후보 화면(doit-connect)을 다시 읽을 뿐 · 후보 상세는 실행 결과에서 만들지 않는다.
// 버튼 이름과 상태 문구는 임시(대표 확인 필요 · Codex 명세 20261003-1 §4-1) — 빌드 스위치(VITE_ECHO_AGENT_ENABLED)가 켜진 앱에서만 보인다.
function AgentRunButton({ userId, onOpenCandidates }: { userId: string; onOpenCandidates: () => void }) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<AgentRun | null>(null); // 마지막으로 성공한 실행 결과(실패해도 지우지 않음)
  const [error, setError] = useState<string | null>(null);
  const trigger = useMemo(() => createAgentRunTrigger({
    getSession: () => agentGet(userId),
    run: (sessionId) => agentRun(userId, sessionId),
    onResult: (run) => { setError(null); setLast(run); if (run.next === 'open_candidates') onOpenCandidates(); },
    onError: (e) => setError(e instanceof UnderstandingError && e.message ? e.message : '불러오지 못했어요. 다시 확인해 볼게요.'),
    onBusy: setBusy,
  }), [userId, onOpenCandidates]);
  return <div className="doit-asleep-card">
    <button type="button" className="doit-product-action" disabled={busy} aria-busy={busy} onClick={() => void trigger()}>후보 확인하기<span aria-hidden="true">↗</span></button>
    {last && last.next === 'wait' && <p className="doit-asleep-status" role="status">ECHO가 같은 만남을 원하는 사람 중 후보를 준비하면 위에 보여 드려요.</p>}
    {error && <p className="doit-product-error" role="alert">{error}</p>}
  </div>;
}
