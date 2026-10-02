// 연결/매칭 — 후보 계산·승인은 연결 서버(doit-connect)가 한다(관리자 역할을 서버가 다시 확인). 이 화면은 결과를 보이고, 사람이 승인·넘기기를 누른다.
// v2.0(2026-09-28 §15–§19): 승인 = 두 사람에게 후보로 보내기. 둘 다 고를 때만 연결이 열린다. 「지금 후보 준비」는 서버가 모두 몫의 후보를 만든다(당신이 잠든 사이).
import { Fragment, useState } from 'react';
import { AdminError, adminCall, type ConnectCandidates, type ConnectMatch, type ConnectOutcome, type ConnectProposal } from '../api';
import { useLoad } from '../useLoad';
import { Loading, Notice, Section, Stat, Tag } from '../ui';
import { when } from '../format';

const STATUS_KO: Record<ConnectMatch['status'], string> = { approved: '연결됨', rejected: '넘김', closed: '끝남' };
const PROPOSAL_KO: Record<ConnectProposal['status'], string> = { proposed: '선택 기다림', mutual: '서로 선택 → 연결', declined: '한쪽이 넘김', withdrawn: '닫힘(차단·자격 변경)' };
const CHOICE_KO: Record<string, string> = { yes: '이어지고 싶어요', no: '넘김', hide: '숨김' };
const choiceText = (v: string | null) => (v ? CHOICE_KO[v] ?? v : '아직');
const OUT_KO: Record<string, string> = { yes: '예', no: '아니요', planned: '약속', unsure: '모름' };
const outcomeText = (list: ConnectOutcome[] | undefined) => (!list ? '—' : !list.length ? '없음' : list.map((o) => `대화 ${OUT_KO[o.talked ?? ''] ?? '—'} · 만남 ${OUT_KO[o.met ?? ''] ?? '—'} · 다시 ${OUT_KO[o.again ?? ''] ?? '—'}`).join(' / '));

export default function Connect() {
  const [cands, reloadC] = useLoad(() => adminCall<ConnectCandidates>('doit-connect', { action: 'admin_candidates' }), []);
  const [matches, reloadM] = useLoad(() => adminCall<{ matches: ConnectMatch[]; proposals?: ConnectProposal[] }>('doit-connect', { action: 'admin_matches' }), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const decide = async (a: string, b: string, decision: 'approve' | 'reject', noCommon: boolean) => {
    const word = decision === 'approve' ? '두 사람에게 후보로 보내기' : '이 쌍을 넘기기';
    if (!window.confirm(`${word}할까요? 되돌릴 수 없습니다.${noCommon && decision === 'approve' ? '\n(겹친 답이 없는 쌍입니다)' : ''}`)) return;
    setBusy(`${a}:${b}`); setMsg('');
    try {
      await adminCall('doit-connect', { action: 'admin_decide', userA: a, userB: b, decision, ...(noCommon ? { noCommonOk: true } : {}) });
      setMsg(decision === 'approve' ? '두 사람에게 후보로 보냈습니다. 둘 다 고르면 연결이 열립니다.' : '넘겼습니다.');
      reloadC(); reloadM();
    } catch (e) { setMsg(e instanceof Error ? e.message : '처리하지 못했습니다.'); }
    setBusy(null);
  };

  const runMatching = async () => {
    if (!window.confirm('연결 준비가 된 모든 사람 몫의 후보를 지금 준비할까요? (한 사람에게 최대 3명)')) return;
    setBusy('run'); setMsg('');
    try {
      const out = await adminCall<{ made: number; eligible: number }>('doit-connect', { action: 'admin_run_matching' });
      setMsg(`후보 ${out.made}쌍을 새로 준비했습니다(연결 준비 ${out.eligible}명 기준).`);
      reloadC(); reloadM();
    } catch (e) { setMsg(e instanceof Error ? e.message : '처리하지 못했습니다.'); }
    setBusy(null);
  };

  return (
    <div className="aw-page">
      <div className="aw-toolbar"><button type="button" className="aw-btn" disabled={!!busy} onClick={runMatching}>지금 후보 준비</button></div>
      {msg ? <Notice kind="확인 필요">{msg}</Notice> : null}
      {cands.kind === 'loading' ? <Loading /> : null}
      {cands.kind === 'error' ? <Notice kind="오류">{cands.message} ({cands.code})</Notice> : null}
      {cands.kind === 'ready' ? (
        <>
          <Section title="연결 준비" sub="목적 · 대화 답 · 사진 3장 · 소개가 모두 있어야 연결 준비입니다(전화 인증은 조건 아님)">
            <div className="aw-grid">
              <Stat label="목적 있는 사용자" value={cands.data.pool} />
              <Stat label="연결 준비" value={cands.data.eligible} />
              <Stat label="부족: 목적" value={cands.data.missing.purpose} />
              <Stat label="부족: 대화 답" value={cands.data.missing.answers} />
              <Stat label="부족: 사진" value={cands.data.missing.photos} />
              <Stat label="부족: 소개" value={cands.data.missing.intro} />
            </div>
          </Section>
          <Section title="후보(아직 보내지 않음)" sub="같은 목적 · 서로 차단 없음 · 겹친 답이 많은 쌍부터 · 승인하면 두 사람에게 후보로 갑니다">
            {!cands.data.candidates.length ? <p className="aw-empty">데이터 없음</p> : (
              <div className="aw-table-wrap"><table className="aw-table">
                <thead><tr><th>두 사람</th><th>목적</th><th>겹친 답</th><th>판단</th></tr></thead>
                <tbody>{cands.data.candidates.map((c) => (
                  <tr key={`${c.user_a}:${c.user_b}`}>
                    <td>{c.a.nickname} · {c.b.nickname}</td><td>{c.purpose ?? '—'}</td>
                    <td>{c.no_common ? <Tag tone="warn">겹친 답 없음</Tag> : `${c.common_a.length}개`}</td>
                    <td className="aw-actions">
                      <button type="button" className="aw-btn" disabled={!!busy} onClick={() => decide(c.user_a, c.user_b, 'approve', !!c.no_common)}>후보로 보내기</button>
                      <button type="button" className="aw-btn aw-btn--ghost" disabled={!!busy} onClick={() => decide(c.user_a, c.user_b, 'reject', false)}>넘기기</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Section>
        </>
      ) : null}
      <Section title="보낸 후보(상호선택)" sub="두 사람이 모두 「이어지고 싶어요」를 눌러야 연결이 열립니다">
        {matches.kind === 'ready' ? (!matches.data.proposals ? <Notice kind="연결 필요">연결 서버가 아직 새 판(v2.0)이 아닙니다.</Notice> : !matches.data.proposals.length ? <p className="aw-empty">데이터 없음</p> : (
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>날짜</th><th>두 사람</th><th>만든 곳</th><th>선택</th><th>상태</th></tr></thead>
            <tbody>{matches.data.proposals.map((p) => (
              <tr key={p.id}><td>{when(p.created_at)}</td><td>{p.a} · {p.b}</td><td>{p.source === 'admin' ? '관리자' : '서버'}</td><td>{choiceText(p.a_choice)} / {choiceText(p.b_choice)}</td><td><Tag tone={p.status === 'mutual' ? 'ok' : p.status === 'proposed' ? 'warn' : 'muted'}>{PROPOSAL_KO[p.status] ?? p.status}</Tag></td></tr>
            ))}</tbody>
          </table></div>
        )) : null}
      </Section>
      {/* 2026-10-02 PR #99·#100: 마지막 구간 네 기록은 서로 다른 기록이다. 연결마다 「마지막 구간」을 누르면 서버(admin_meet_summary)가 그 연결 값만 준다.
          꺼짐 = 「연결 필요」 · 읽기 실패 = 「실패」 · 실제로 연결된 빈 값만 0 — 화면이 값을 만들지 않는다. */}
      <Section title="마지막 구간(만나기 전)" sub="영상 동의 · 영상 참여 · 양쪽 모습 확인 · 양쪽 만남 의사 · 약속 합의는 각각 따로입니다(하나가 다른 하나를 대신하지 않음). 아래 연결 기록에서 연결마다 확인합니다">
        <Notice kind="연결 필요">지금 만남 기능은 꺼져 있어요(저장 표·영상 서비스·영상 동의 판 결정 전). 켜지기 전에는 어느 연결이든 「연결 필요」로 보여요.</Notice>
      </Section>
      <Section title="연결 기록" sub="결과(대화·만남·다시 만나고 싶음)는 사용자가 직접 남긴 값입니다">
        {matches.kind === 'loading' ? <Loading /> : null}
        {matches.kind === 'error' ? <Notice kind="오류">{matches.message}</Notice> : null}
        {matches.kind === 'ready' ? (!matches.data.matches.length ? <p className="aw-empty">데이터 없음</p> : (
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>날짜</th><th>두 사람</th><th>상태</th><th>첫 답</th><th>이야기</th><th>결과</th></tr></thead>
            <tbody>{matches.data.matches.map((m) => (
              <Fragment key={m.id}>
                <tr><td>{when(m.created_at)}</td><td>{m.a} · {m.b}</td><td><Tag tone={m.status === 'approved' ? 'ok' : 'muted'}>{STATUS_KO[m.status] ?? m.status}</Tag></td><td>{m.answered}/2</td><td>{m.messages}개</td><td>{outcomeText(m.outcomes)}</td></tr>
                {/* 마지막 구간은 열이 아니라 아래 한 줄(휴대폰 390px 에서 표가 화면 밖으로 밀리지 않게 · 2026-10-02 렌더 검사로 찾은 넘침 수정) */}
                {m.status === 'approved' ? <tr><td colSpan={6}><span className="aw-muted">마지막 구간 </span><MeetCell matchId={m.id} /></td></tr> : null}
              </Fragment>
            ))}</tbody>
          </table></div>
        )) : null}
      </Section>
    </div>
  );
}

// 한 연결의 마지막 구간 — 누를 때만 서버에 묻는다(목록 전체를 한꺼번에 부르지 않음).
interface MeetSummary { finalSegment?: { state: string }; videoConsent?: { state: string; bothConsented?: boolean }; video?: { sessions: number; jointSessions: number }; appearance?: { bothConfirmed: boolean }; meetingIntent?: { bothYes: boolean }; permission?: { allowed: boolean }; planAgreement?: { state: string }; project?: string | null; observedAt?: string }
type MeetCellState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'off' } | { kind: 'failed'; code: string } | { kind: 'ready'; data: MeetSummary };
function MeetCell({ matchId }: { matchId: string }) {
  const [st, setSt] = useState<MeetCellState>({ kind: 'idle' });
  const load = async () => {
    setSt({ kind: 'loading' });
    try { setSt({ kind: 'ready', data: await adminCall<MeetSummary>('doit-connect', { action: 'admin_meet_summary', matchId }) }); }
    catch (e) { const code = e instanceof AdminError ? e.code : 'ERROR'; setSt(code === 'MEET_NOT_CONFIGURED' ? { kind: 'off' } : { kind: 'failed', code }); }
  };
  if (st.kind === 'idle') return <button type="button" className="aw-btn aw-btn--ghost" onClick={() => void load()}>마지막 구간</button>;
  if (st.kind === 'loading') return <span>확인 중</span>;
  if (st.kind === 'off') return <Tag tone="muted">연결 필요(꺼짐)</Tag>;
  if (st.kind === 'failed') return <Tag tone="warn">{`실패 · ${st.code}`}</Tag>;
  const d = st.data;
  const yn = (v: boolean | undefined) => (v === undefined ? '실패' : v ? '예' : '아직');
  return <span>
    마지막 구간 근거 {d.finalSegment?.state === 'connected' ? '연결됨' : d.finalSegment?.state === 'not_connected' ? '미연결' : '실패'} · 영상 동의 {d.videoConsent?.state === 'connected' ? (d.videoConsent.bothConsented ? '두 사람 모두' : '아직') : '실패'} · 영상 {d.video ? `${d.video.jointSessions}/${d.video.sessions}회(공동/전체)` : '실패'} · 양쪽 모습 확인 {yn(d.appearance?.bothConfirmed)} · 양쪽 만남 의사 {yn(d.meetingIntent?.bothYes)} · 약속 합의 {d.planAgreement?.state === 'not_connected' ? '연결 필요' : '실패'}
    {d.project ? ` · ${d.project}` : ''}
  </span>;
}
