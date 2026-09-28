// 신고·차단 — 읽기만. 제재는 사람이 판단한다(AI 자동 영구정지 없음). 처리자·결과를 적는 칸은 아직 표에 없다(새 칸 = DB 변경 승인 필요).
import { useState } from 'react';
import { adminCall, type SafetyOut } from '../api';
import { useLoad } from '../useLoad';
import { Loading, Notice, Section, Stat, Tag } from '../ui';
import { when } from '../format';

const who = (p: { short: string; nickname: string | null }) => `${p.nickname ?? '이름 없음'} (${p.short})`;

export default function Safety() {
  const [st, reload] = useLoad(() => adminCall<SafetyOut>('admin-web', { action: 'safety' }), []);
  const [raw, setRaw] = useState(false);
  if (st.kind === 'loading') return <Loading />;
  if (st.kind === 'error') return <Notice kind="오류">{st.message} ({st.code})</Notice>;
  const d = st.data;
  const open = d.reports.filter((r) => r.status !== 'resolved' && r.status !== 'closed');
  return (
    <div className="aw-page">
      <div className="aw-toolbar"><button type="button" className="aw-btn" onClick={reload}>새로 고침</button><button type="button" className="aw-btn" onClick={() => setRaw(!raw)}>{raw ? '신고 내용 가리기' : '신고 내용 보기'}</button></div>
      <div className="aw-grid">
        <Stat label="신고" value={d.reports_error ? null : d.reports.length} />
        <Stat label="검토 필요" value={d.reports_error ? null : open.length} tone="warn" />
        <Stat label="중대 의심" value={d.reports_error ? null : open.filter((r) => r.severe).length} tone="bad" hint="사유 글자 기준 · 판단은 사람" />
        <Stat label="차단" value={d.blocks_error ? null : d.blocks.length} />
      </div>
      {!d.handler_columns ? <Notice kind="연결 필요">처리자·처리 결과를 기록하는 칸이 아직 없습니다. 만들려면 DB 변경 승인이 필요합니다. 제재는 사람이 최종 판단합니다(AI 자동 정지 없음).</Notice> : null}
      <Section title="신고">
        {!d.reports.length ? <p className="aw-empty">데이터 없음</p> : (
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>날짜</th><th>신고한 사람</th><th>대상</th><th>이유</th><th>상태</th><th>처리자</th><th>결과</th></tr></thead>
            <tbody>{d.reports.map((r) => (
              <tr key={r.id}><td>{when(r.created_at)}</td><td>{who(r.reporter)}</td><td>{who(r.target)}</td>
                <td>{r.severe ? <Tag tone="bad">중대 의심</Tag> : null} {raw ? `${r.reason ?? ''}${r.detail ? ` · ${r.detail}` : ''}` : '●●●'}</td>
                <td><Tag tone={r.status === 'open' ? 'warn' : 'muted'}>{r.status === 'open' ? '검토 필요' : r.status}</Tag></td>
                <td className="aw-muted">기록 칸 없음</td><td className="aw-muted">기록 칸 없음</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Section>
      <Section title="차단">
        {!d.blocks.length ? <p className="aw-empty">데이터 없음</p> : (
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>날짜</th><th>차단한 사람</th><th>차단된 사람</th><th>이유</th></tr></thead>
            <tbody>{d.blocks.map((b) => <tr key={b.id}><td>{when(b.created_at)}</td><td>{who(b.blocker)}</td><td>{who(b.blocked)}</td><td>{b.reason === 'connection' ? '연결에서 나감' : b.reason ?? '—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </Section>
    </div>
  );
}
