// 서비스 상태 · 배포 관리 · 알림 · 운영 설정 · 감사 기록 · 데이터 확인.
// 읽을 수 없는 곳(배포 서버 사용량·비용·운영 판 번호)은 「연결 필요」로 보인다. 비밀값·키 값은 어디에도 보이지 않는다.
import { adminCall, type Overview, type SourcesOut } from '../api';
import { useLoad } from '../useLoad';
import { LevelBadge, Loading, Notice, Section, Tag } from '../ui';
import { when } from '../format';
import { ADMIN_BUILD, RELEASE_RECORD, type Gate } from '../releaseStatus';

const TABLE_KO: Record<string, string> = {
  profiles: '사용자 기본 정보', profile_photos: '사진', purposes: '연결 목적', doit_request_events: '대화 서버 기록(세션·턴)', doit_records: '사용자 답 기록',
  doit_insights: '확정 이해(옛 흐름)', doit_matches: '연결', doit_match_messages: '연결 대화', user_reports: '신고', blocks: '차단', audit_logs: '감사 기록',
};
const gateTone = (g: Gate) => (g === 'PASS' ? 'ok' : g === 'HOLD' ? 'warn' : 'muted');

function useSources() { return useLoad(() => adminCall<SourcesOut>('admin-web', { action: 'sources' }), []); }

export function ServiceStatus() {
  const [src] = useSources();
  const [ov] = useLoad(() => adminCall<Overview>('admin-web', { action: 'overview', period: 'today' }), []);
  return (
    <div className="aw-page">
      <Section title="서비스 상태" sub="오늘 기준">
        {ov.kind === 'ready' ? <div className="aw-hero-state"><LevelBadge level={ov.data.health.level} big /><ul className="aw-reasons">{ov.data.health.reasons.length ? ov.data.health.reasons.map((r) => <li key={r}>{r}</li>) : <li>확인된 문제 없음</li>}</ul></div> : ov.kind === 'error' ? <Notice kind="오류">{ov.message}</Notice> : <Loading />}
      </Section>
      <Section title="구성 요소">
        {src.kind === 'loading' ? <Loading /> : src.kind === 'error' ? <Notice kind="오류">{src.message}</Notice> : (
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>구성 요소</th><th>상태</th><th>내용</th></tr></thead>
            <tbody>
              <tr><td>관리자 서버</td><td><Tag tone="ok">정상</Tag></td><td>{src.data.server} · 응답 {when(new Date().toISOString())}</td></tr>
              <tr><td>데이터베이스(Supabase)</td><td>{src.data.tables.some((t) => t.table === 'profiles' && !t.error) ? <Tag tone="ok">정상</Tag> : <Tag tone="bad">오류</Tag>}</td><td>사용자 표 읽기 {src.data.tables.find((t) => t.table === 'profiles')?.error ? '실패' : '성공'}</td></tr>
              <tr><td>AI 호출</td><td>{!src.data.last_turn ? <Tag tone="muted">데이터 없음</Tag> : src.data.last_turn.failed ? <Tag tone="bad">최근 실패</Tag> : <Tag tone="ok">정상</Tag>}</td><td>마지막 대화 {src.data.last_turn ? `${when(src.data.last_turn.at)} · ${src.data.last_turn.model ?? '모델 기록 없음'}` : '—'}</td></tr>
              <tr><td>Google 로그인</td><td>{src.data.google === null ? <Tag tone="muted">확인 필요</Tag> : src.data.google ? <Tag tone="ok">켜짐</Tag> : <Tag tone="bad">꺼짐</Tag>}</td><td>로그인 서버 설정에서 읽음</td></tr>
              <tr><td>배포 서버(Netlify) 상태·사용량</td><td><Tag tone="muted">연결 필요</Tag></td><td>사용량·크레딧 경고를 읽는 연결이 없습니다(키를 관리자 화면에 넣지 않음). 사용량 알림은 후속 자동화 후보.</td></tr>
              <tr><td>AI 비용</td><td><Tag tone="muted">연결 필요</Tag></td><td>비용 임계치 알림은 후속 자동화 후보</td></tr>
            </tbody>
          </table></div>
        )}
      </Section>
    </div>
  );
}

export function Release() {
  const [src] = useSources();
  return (
    <div className="aw-page">
      <Section title="배포 상태" sub={`기록 기준 ${RELEASE_RECORD.recordedAt} · ${RELEASE_RECORD.source} (자동 측정 아님)`}>
        <div className="aw-table-wrap"><table className="aw-table">
          <thead><tr><th>무엇</th><th>어디</th><th>판</th><th>상태</th></tr></thead>
          <tbody>{RELEASE_RECORD.lines.map((l) => <tr key={`${l.name}${l.where}`}><td>{l.name}</td><td className="aw-sub">{l.where}</td><td>{l.version === '확인 필요' ? <span className="aw-missing">확인 필요</span> : l.version}</td><td>{l.state}</td></tr>)}</tbody>
        </table></div>
      </Section>
      <Section title="검사 관문">
        <div className="aw-legend">{RELEASE_RECORD.gates.map((g) => <div key={g.name}><Tag tone={gateTone(g.gate)}>{g.gate}</Tag> {g.name} · <span className="aw-sub">{g.note}</span></div>)}</div>
      </Section>
      <Section title="지금 연결된 서버에서 읽은 값">
        {src.kind === 'ready' ? (
          <div className="aw-grid aw-grid--3">
            <div className="aw-kv"><span>대화 서버 판(이 관리자 서버와 같이 배포된 판)</span><strong>{src.data.agent_server}</strong></div>
            <div className="aw-kv"><span>마지막 대화 기록의 판</span><strong>{src.data.last_turn?.agent ?? '데이터 없음'}</strong></div>
            <div className="aw-kv"><span>관리자 화면 판</span><strong>{ADMIN_BUILD}</strong></div>
          </div>
        ) : src.kind === 'error' ? <Notice kind="오류">{src.message}</Notice> : <Loading />}
      </Section>
    </div>
  );
}

export function Alerts() {
  const [ov] = useLoad(() => adminCall<Overview>('admin-web', { action: 'overview', period: '7d' }), []);
  if (ov.kind === 'loading') return <Loading />;
  if (ov.kind === 'error') return <Notice kind="오류">{ov.message}</Notice>;
  const items = [...ov.data.decisions, ...ov.data.health.reasons.filter((r) => !ov.data.decisions.some((d) => d.includes(r)))];
  return (
    <div className="aw-page">
      <Section title="알림" sub="최근 7일 · 실제 기록에서 나온 것만">
        {items.length ? <ol className="aw-alerts">{items.map((x) => <li key={x}>{x}</li>)}</ol> : <p className="aw-empty">알림 없음</p>}
      </Section>
      <Notice kind="연결 필요">문자·메일로 알림을 보내는 연결은 아직 없습니다(후속 자동화 후보).</Notice>
    </div>
  );
}

export function Settings() {
  const [src] = useSources();
  return (
    <div className="aw-page">
      <Section title="연결 목적" sub="읽기 전용 · 바꾸려면 운영 데이터 변경 승인이 필요합니다">
        {src.kind === 'ready' ? (!src.data.purposes.length ? <p className="aw-empty">데이터 없음</p> : (
          <div className="aw-table-wrap"><table className="aw-table"><thead><tr><th>순서</th><th>이름</th><th>사용</th></tr></thead>
            <tbody>{src.data.purposes.map((p) => <tr key={p.id}><td>{p.sort_order ?? '—'}</td><td>{p.label}</td><td>{p.is_active === false ? <Tag tone="muted">숨김</Tag> : <Tag tone="ok">사용</Tag>}</td></tr>)}</tbody></table></div>
        )) : src.kind === 'error' ? <Notice kind="오류">{src.message}</Notice> : <Loading />}
      </Section>
      <Notice kind="연결 필요">가격·결제·모델 등 운영 설정 변경은 이 화면에서 하지 않습니다(대표 승인 대상).</Notice>
    </div>
  );
}

export function Audit() {
  const [src] = useSources();
  if (src.kind === 'loading') return <Loading />;
  if (src.kind === 'error') return <Notice kind="오류">{src.message}</Notice>;
  const t = src.data.tables.find((x) => x.table === 'audit_logs');
  return (
    <div className="aw-page">
      <Section title="감사 기록" sub="관리자가 무엇을 봤고 바꿨는지">
        {!t || t.error ? <Notice kind="연결 필요">감사 기록을 저장하는 곳이 이 서버에 없습니다(표 없음). 만들려면 DB 변경 승인이 필요합니다.</Notice>
          : <p>저장된 감사 기록 {t.rows?.toLocaleString('ko-KR') ?? '—'}줄 · 목록 화면은 다음 단계</p>}
      </Section>
    </div>
  );
}

export function DataCheck() {
  const [src, reload] = useSources();
  return (
    <div className="aw-page">
      <div className="aw-toolbar"><button type="button" className="aw-btn" onClick={reload}>새로 고침</button></div>
      <Section title="데이터 확인" sub="관리자 서버가 실제로 읽을 수 있는 자료와 줄 수">
        {src.kind === 'loading' ? <Loading /> : src.kind === 'error' ? <Notice kind="오류">{src.message}</Notice> : (
          <div className="aw-table-wrap"><table className="aw-table"><thead><tr><th>자료</th><th>상태</th><th>줄 수</th></tr></thead>
            <tbody>{src.data.tables.map((t) => <tr key={t.table}><td>{TABLE_KO[t.table] ?? t.table}</td><td>{t.error ? <Tag tone="muted">연결 필요</Tag> : t.rows ? <Tag tone="ok">연결됨</Tag> : <Tag tone="muted">데이터 없음</Tag>}</td><td>{t.rows?.toLocaleString('ko-KR') ?? '—'}</td></tr>)}</tbody></table></div>
        )}
      </Section>
    </div>
  );
}
