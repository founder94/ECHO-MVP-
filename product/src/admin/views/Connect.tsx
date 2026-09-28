// 연결/매칭 — 후보 계산·승인은 연결 서버(doit-connect)가 한다(관리자 역할을 서버가 다시 확인). 이 화면은 결과를 보이고, 사람이 승인·넘기기를 누른다.
import { useState } from 'react';
import { adminCall, type ConnectCandidates, type ConnectMatch } from '../api';
import { useLoad } from '../useLoad';
import { Loading, Notice, Section, Stat, Tag } from '../ui';
import { when } from '../format';

const STATUS_KO: Record<ConnectMatch['status'], string> = { approved: '연결됨', rejected: '넘김', closed: '끝남' };

export default function Connect() {
  const [cands, reloadC] = useLoad(() => adminCall<ConnectCandidates>('doit-connect', { action: 'admin_candidates' }), []);
  const [matches, reloadM] = useLoad(() => adminCall<{ matches: ConnectMatch[] }>('doit-connect', { action: 'admin_matches' }), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const decide = async (a: string, b: string, decision: 'approve' | 'reject', noCommon: boolean) => {
    const word = decision === 'approve' ? '연결을 승인' : '이 쌍을 넘기기';
    if (!window.confirm(`${word}할까요? 되돌릴 수 없습니다.${noCommon && decision === 'approve' ? '\n(겹친 답이 없는 쌍입니다)' : ''}`)) return;
    setBusy(`${a}:${b}`); setMsg('');
    try {
      await adminCall('doit-connect', { action: 'admin_decide', userA: a, userB: b, decision, ...(noCommon ? { noCommonOk: true } : {}) });
      setMsg(decision === 'approve' ? '승인했습니다.' : '넘겼습니다.');
      reloadC(); reloadM();
    } catch (e) { setMsg(e instanceof Error ? e.message : '처리하지 못했습니다.'); }
    setBusy(null);
  };

  return (
    <div className="aw-page">
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
          <Section title="후보(승인 대기)" sub="같은 목적 · 서로 차단 없음 · 겹친 답이 많은 쌍부터">
            {!cands.data.candidates.length ? <p className="aw-empty">데이터 없음</p> : (
              <div className="aw-table-wrap"><table className="aw-table">
                <thead><tr><th>두 사람</th><th>목적</th><th>겹친 답</th><th>판단</th></tr></thead>
                <tbody>{cands.data.candidates.map((c) => (
                  <tr key={`${c.user_a}:${c.user_b}`}>
                    <td>{c.a.nickname} · {c.b.nickname}</td><td>{c.purpose ?? '—'}</td>
                    <td>{c.no_common ? <Tag tone="warn">겹친 답 없음</Tag> : `${c.common_a.length}개`}</td>
                    <td className="aw-actions">
                      <button type="button" className="aw-btn" disabled={!!busy} onClick={() => decide(c.user_a, c.user_b, 'approve', !!c.no_common)}>승인</button>
                      <button type="button" className="aw-btn aw-btn--ghost" disabled={!!busy} onClick={() => decide(c.user_a, c.user_b, 'reject', false)}>넘기기</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Section>
        </>
      ) : null}
      <Section title="연결 기록" sub="실제 만남은 기록하는 칸이 없습니다(데이터 없음)">
        {matches.kind === 'loading' ? <Loading /> : null}
        {matches.kind === 'error' ? <Notice kind="오류">{matches.message}</Notice> : null}
        {matches.kind === 'ready' ? (!matches.data.matches.length ? <p className="aw-empty">데이터 없음</p> : (
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>날짜</th><th>두 사람</th><th>상태</th><th>첫 답</th><th>이야기</th></tr></thead>
            <tbody>{matches.data.matches.map((m) => (
              <tr key={m.id}><td>{when(m.created_at)}</td><td>{m.a} · {m.b}</td><td><Tag tone={m.status === 'approved' ? 'ok' : 'muted'}>{STATUS_KO[m.status] ?? m.status}</Tag></td><td>{m.answered}/2</td><td>{m.messages}개</td></tr>
            ))}</tbody>
          </table></div>
        )) : null}
      </Section>
    </div>
  );
}
