// 사용자 · 프로필 — 가입일 · 최근 활동 · 목적 · 프로필 · 사진 · 인증 · 연결 준비 · 신고/차단 · 계정 상태.
// 계정 삭제 버튼은 두지 않는다(대표 §10: 실수로 바로 삭제 금지 — 삭제는 별도 확인 절차).
import { useMemo, useState } from 'react';
import { adminCall, type ConnectMember, type UsersOut } from '../api';
import { useLoad } from '../useLoad';
import { Loading, Notice, Section, Stat, Tag } from '../ui';
import { when } from '../format';

const MISSING_KO: Record<string, string> = { purpose: '목적', answers: '대화 답', photos: '사진 3장', intro: '소개' };

async function loadUsers(q: string): Promise<{ users: UsersOut; members: Map<string, ConnectMember> | null; membersError: string | null }> {
  const users = await adminCall<UsersOut>('admin-web', { action: 'users', q });
  try {
    const out = await adminCall<{ members: ConnectMember[] }>('doit-connect', { action: 'admin_members' });
    return { users, members: new Map((out.members ?? []).map((m) => [m.id, m])), membersError: null };
  } catch (e) {
    return { users, members: null, membersError: e instanceof Error ? e.message : '연결 준비를 읽지 못했습니다.' };
  }
}

export default function Users({ mode }: { mode: 'users' | 'profiles' }) {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [st, reload] = useLoad(() => loadUsers(applied), [applied]);
  const people = useMemo(() => (st.kind === 'ready' ? st.data.users.users.filter((u) => u.role !== 'admin') : []), [st]);

  return (
    <div className="aw-page">
      <form className="aw-toolbar" onSubmit={(e) => { e.preventDefault(); setApplied(q); }}>
        <input className="aw-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임 · 메일 · 사용자 번호" aria-label="사용자 검색" />
        <button type="submit" className="aw-btn">찾기</button>
        <button type="button" className="aw-btn" onClick={reload}>새로 고침</button>
      </form>
      {st.kind === 'loading' ? <Loading /> : null}
      {st.kind === 'error' ? <Notice kind="오류">{st.message} ({st.code})</Notice> : null}
      {st.kind === 'ready' ? (
        <>
          {st.data.membersError ? <Notice kind="확인 필요">연결 준비: {st.data.membersError}</Notice> : null}
          {st.data.users.photos_error ? <Notice kind="확인 필요">사진 수를 읽지 못했습니다.</Notice> : null}
          {mode === 'profiles' ? (
            <Section title="프로필 완성도" sub="사용자(관리자 제외) 전체 기준">
              <div className="aw-grid">
                <Stat label="사용자" value={people.length} />
                <Stat label="목적 정함" value={people.filter((u) => u.purpose).length} />
                <Stat label="소개 저장" value={people.filter((u) => u.intro_saved).length} />
                <Stat label="사진 3장 이상" value={st.data.users.photos_error ? null : people.filter((u) => (u.photos ?? 0) >= 3).length} />
                <Stat label="전화 인증" value={people.filter((u) => u.verification === 'verified').length} />
                <Stat label="연결 준비" value={st.data.members ? people.filter((u) => st.data.members?.get(u.id)?.eligible).length : null} />
              </div>
            </Section>
          ) : null}
          <Section title={mode === 'profiles' ? '프로필이 덜 된 사용자' : '사용자'} sub={`${people.length.toLocaleString('ko-KR')}명 · 최근 활동은 ${st.data.users.activity_window_days}일 안의 기록 · 계정 삭제는 이 화면에서 하지 않습니다(별도 확인 절차)`}>
            <div className="aw-table-wrap">
              <table className="aw-table">
                <thead><tr><th>사용자</th><th>가입</th><th>최근 활동</th><th>목적</th><th>소개</th><th>사진</th><th>전화 인증</th><th>연결 준비</th><th>신고·차단</th></tr></thead>
                <tbody>
                  {people.filter((u) => mode === 'users' || !(u.intro_saved && (u.photos ?? 0) >= 3 && u.purpose)).slice(0, 200).map((u) => {
                    const m = st.data.members?.get(u.id);
                    return (
                      <tr key={u.id}>
                        <td><strong>{u.nickname ?? '이름 없음'}</strong><div className="aw-sub">{u.short} · {u.email ?? '메일 없음'}</div></td>
                        <td>{when(u.created_at)}</td>
                        <td>{u.last_active_at ? when(u.last_active_at) : <span className="aw-muted">30일 안 없음</span>}</td>
                        <td>{u.purpose ?? <span className="aw-muted">없음</span>}</td>
                        <td>{u.intro_saved ? <Tag tone="ok">있음</Tag> : <Tag tone="muted">없음</Tag>}</td>
                        <td>{u.photos === null ? <span className="aw-missing">확인 필요</span> : `${u.photos}장`}</td>
                        <td>{u.verification === 'verified' ? <Tag tone="ok">인증</Tag> : <Tag tone="muted">안 함</Tag>}</td>
                        <td>{!st.data.members ? <span className="aw-missing">확인 필요</span> : m?.eligible ? <Tag tone="ok">준비됨</Tag> : <span className="aw-sub">{m ? `부족: ${m.missing.map((x) => MISSING_KO[x] ?? x).join(' · ')}` : '목적 없음'}</span>}</td>
                        <td>{u.reported || u.blocked_by ? <Tag tone="warn">신고 {u.reported} · 차단 {u.blocked_by}</Tag> : <span className="aw-muted">없음</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!people.length ? <p className="aw-empty">데이터 없음</p> : null}
            </div>
          </Section>
        </>
      ) : null}
    </div>
  );
}
