// 2026-10-02 대표 「QA 마감 v1.1」 §13 — 첫 화면 맨 위 「오늘」: 환경 · 자료 기준 시각 · 지금 상태 · 먼저 할 일 1건 · 연결 구간 · 안전 · 수익.
// 판정은 ../brief.ts(검사 대상). 숫자는 서버가 센 값만 — 못 읽으면 「확인 필요」, 기능이 없으면 「기능 없음」(0 이 아님).
import type { Connect } from '../decide';
import type { Overview, SafetyOut } from '../api';
import { envOf, firstTask, oldestOpenHours, stateOf } from '../brief';
import { when } from '../format';
import { Num } from '../ui';

const MENU_KO: Record<string, string> = { safety: '안전 → 신고·차단', status: '관리 → 서비스 상태', failures: '관리 → 오류·실패', conversations: '연결 → AI 대화', connect: '연결 → 연결/매칭', dashboard: '오늘' };

export default function Today({ ov, connect, safety, go }: { ov: Overview | null; connect: Connect | null; safety: SafetyOut | null | 'error'; go: (m: string) => void }) {
  const env = envOf(import.meta.env.VITE_PUBLIC_SUPABASE_URL as string | undefined);
  const safetyOk = !!safety && safety !== 'error' && !safety.reports_error;
  const connectOk = !!connect && !connect.error;
  const { state, reasons } = stateOf({ overviewOk: !!ov, health: ov?.health.level ?? null, safetyOk, connectOk });
  const task = ov ? firstTask(ov.decisions, safetyOk, connectOk) : null;
  const reports = safetyOk ? (safety as SafetyOut).reports : null;
  const open = reports ? reports.filter((r) => r.status !== 'resolved' && r.status !== 'closed').length : null;
  const oldest = reports ? oldestOpenHours(reports) : null;
  const matches = connect?.matches ?? null;
  const talking = matches ? matches.filter((m) => m.messages > 0).length : null;
  // 「약속했어요」·「만났어요」는 사용자가 남긴 자기 기록이다(앱이 확인한 만남이 아님).
  const planned = matches && connect?.proposals ? matches.filter((m) => (m.outcomes ?? []).some((o) => o.met === 'planned' || o.met === 'yes')).length : null;
  return (
    <section className="aw-today" aria-label="오늘">
      <div className={`aw-env aw-env--${env === '실제 운영' ? 'prod' : env === '시험용 QA' ? 'qa' : 'unknown'}`}>{env}</div>
      <div className="aw-today-row">
        <div className="aw-today-cell">
          <div className="aw-hero-label">지금 상태</div>
          <div className={`aw-state aw-state--${state === '정상' ? 'ok' : state === '확인 필요' ? 'warn' : 'bad'}`}>{state}</div>
          <div className="aw-today-sub">자료 기준 {ov ? when(ov.asOf) : '—'}</div>
          {reasons.length ? <ul className="aw-reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
        </div>
        <div className="aw-today-cell aw-today-task">
          <div className="aw-hero-label">먼저 할 일</div>
          {task ? <>
            <p className="aw-task-what">{task.what}</p>
            <dl className="aw-task-dl"><dt>이유</dt><dd>{task.why}</dd><dt>영향</dt><dd>{task.impact}</dd><dt>담당</dt><dd>{task.owner}</dd></dl>
            <button type="button" className="aw-btn" onClick={() => go(task.menu)}>내용 확인 · {MENU_KO[task.menu] ?? task.menu}</button>
          </> : <p className="aw-muted">{ov ? '지금 먼저 할 일 없음' : '자료를 읽지 못해 판단할 수 없어요.'}</p>}
        </div>
      </div>
      <div className="aw-today-row aw-today-row--3">
        <div className="aw-today-cell">
          <div className="aw-hero-label">연결(연결 쌍 수)</div>
          <ol className="aw-funnel">
            <li><span>대화 시작</span><strong><Num value={talking} /></strong></li>
            <li><span>영상으로 서로 확인</span><strong className="aw-missing">기능 없음</strong></li>
            <li><span>약속(사용자 자기 기록)</span><strong><Num value={planned} missing="데이터 없음" /></strong></li>
          </ol>
        </div>
        <div className="aw-today-cell">
          <div className="aw-hero-label">안전(건수)</div>
          <ol className="aw-funnel">
            <li><span>접수(전체)</span><strong><Num value={reports ? reports.length : null} /></strong></li>
            <li><span>검토 대기</span><strong><Num value={open} /></strong></li>
            <li><span>가장 오래 기다린 건</span><strong>{!safetyOk ? <span className="aw-missing">확인 필요</span> : oldest === null ? '없음' : `${oldest}시간째`}</strong></li>
          </ol>
        </div>
        <div className="aw-today-cell">
          <div className="aw-hero-label">수익</div>
          <ol className="aw-funnel">
            <li><span>결제</span><strong className="aw-missing">연결 필요</strong></li>
            <li><span>환불</span><strong className="aw-missing">연결 필요</strong></li>
            <li><span>확인된 직접 비용</span><strong className="aw-missing">연결 필요</strong></li>
          </ol>
          <button type="button" className="aw-link" onClick={() => go('revenue')}>수익 →</button>
        </div>
      </div>
      <p className="aw-today-sub">후보를 불러오지 못한 요청: <span className="aw-missing">확인 필요</span> — 서버 집계가 아직 없어요(연결 서버 오류 기록에만 남음).</p>
    </section>
  );
}
