// 대시보드 — 대표가 20초 안에: 서비스 정상인가 · 사용자가 들어오나 · AI 대화 문제 · 연결이 막혔나 · 신고 · 내가 결정할 것.
// 숫자는 모두 서버(admin-web · doit-connect)가 실제 표에서 센 값이다. 못 읽은 칸은 「확인 필요」, 기록 칸이 없는 것은 「데이터 없음」.
import { useState } from 'react';
import { adminCall, PERIOD_LABEL, type ConnectCandidates, type ConnectMatch, type Overview, type Period } from '../api';
import { useLoad } from '../useLoad';
import { LevelBadge, Loading, Notice, Section, Stat } from '../ui';
import { when } from '../format';
import { ADMIN_BUILD, RELEASE_RECORD } from '../releaseStatus';
import { mergeDecisions, type Connect } from '../decide';


async function loadConnect(): Promise<Connect> {
  try {
    const [c, m] = await Promise.all([
      adminCall<ConnectCandidates & { ok: true }>('doit-connect', { action: 'admin_candidates' }),
      adminCall<{ matches: ConnectMatch[] }>('doit-connect', { action: 'admin_matches' }),
    ]);
    return { candidates: c, matches: Array.isArray(m.matches) ? m.matches : [], error: null };
  } catch (e) {
    return { candidates: null, matches: null, error: e instanceof Error ? e.message : '연결 자료를 읽지 못했습니다.' };
  }
}

export default function Dashboard({ go }: { go: (menu: string) => void }) {
  const [period, setPeriod] = useState<Period>('today');
  const [ov, reload] = useLoad(() => adminCall<Overview>('admin-web', { action: 'overview', period }), [period]);
  const [cn] = useLoad(loadConnect, []);
  const connect = cn.kind === 'ready' ? cn.data : null;

  return (
    <div className="aw-page">
      <div className="aw-toolbar">
        <div className="aw-seg" role="tablist" aria-label="기간">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={p === period} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>
          ))}
        </div>
        <button type="button" className="aw-btn" onClick={reload}>새로 고침</button>
      </div>

      {ov.kind === 'loading' ? <Loading /> : null}
      {ov.kind === 'error' ? <Notice kind="오류">{ov.message} ({ov.code})</Notice> : null}
      {ov.kind === 'ready' ? (() => {
        const d = ov.data;
        const decisions = connect ? mergeDecisions(d.decisions, connect) : d.decisions;
        const approved = connect?.matches ? connect.matches.filter((m) => m.status === 'approved').length : null;
        const talking = connect?.matches ? connect.matches.filter((m) => m.messages > 0).length : null;
        const bothAnswered = connect?.matches ? connect.matches.filter((m) => m.answered >= 2).length : null;
        const q = d.ai.quality;
        return (
          <>
            <Section title="오늘 상태" sub={`기준 ${when(d.asOf)} · 기간 ${PERIOD_LABEL[d.period]}`}>
              <div className="aw-hero">
                <div className="aw-hero-state">
                  <div className="aw-hero-label">서비스 상태</div>
                  <LevelBadge level={d.health.level} big />
                  <ul className="aw-reasons">{d.health.reasons.length ? d.health.reasons.map((r) => <li key={r}>{r}</li>) : <li>확인된 문제 없음</li>}</ul>
                </div>
                <div className="aw-decide">
                  <div className="aw-hero-label">대표가 확인할 것</div>
                  {decisions.length ? <ol>{decisions.map((x) => <li key={x}>{x}</li>)}</ol> : <p className="aw-muted">지금 결정할 일 없음</p>}
                </div>
              </div>
              {d.truncated ? <Notice kind="확인 필요">읽은 줄이 상한(2만 줄)을 넘어 일부 숫자가 작게 보일 수 있습니다.</Notice> : null}
            </Section>

            <Section title="현재 배포" sub={`기록 기준 ${RELEASE_RECORD.recordedAt} (자동 측정 아님)`} right={<button type="button" className="aw-link" onClick={() => go('release')}>배포 관리 →</button>}>
              <div className="aw-grid aw-grid--3">
                <div className="aw-kv"><span>대화 서버(실제 대화 기록에서 확인)</span><strong>{d.ai.agent_seen[0] ?? '데이터 없음'}</strong></div>
                <div className="aw-kv"><span>마지막 정상 AI 대화</span><strong>{d.ai.last_ok_at ? when(d.ai.last_ok_at) : '데이터 없음'}</strong></div>
                <div className="aw-kv"><span>관리자 화면 판</span><strong>{ADMIN_BUILD}</strong></div>
              </div>
            </Section>

            <Section title="사용자" right={<button type="button" className="aw-link" onClick={() => go('users')}>사용자 →</button>}>
              <div className="aw-grid">
                <Stat label="가입" value={d.users.signups} />
                <Stat label="활동한 사용자" value={d.users.active} />
                <Stat label="대화 시작" value={d.users.conversations_started} />
                <Stat label="대화 완료" value={d.users.conversations_done} />
                <Stat label="소개 저장(전체)" value={d.users.intro_saved} />
                <Stat label="연결 준비(전체)" value={connect?.candidates ? connect.candidates.eligible : null} />
              </div>
            </Section>

            <Section title="AI 대화" right={<button type="button" className="aw-link" onClick={() => go('failures')}>오류·실패 →</button>}>
              <div className="aw-grid">
                <Stat label="정상 완료 대화" value={d.ai.ok_sessions} />
                <Stat label="AI 가 답을 못 만든 대화" value={d.ai.failed} tone="bad" />
                <Stat label={d.ai.quality_label.repeat} value={q.repeat} tone="warn" />
                <Stat label={d.ai.quality_label.goal_mismatch} value={q.goal_mismatch} tone="warn" />
                <Stat label={d.ai.quality_label.counsel} value={q.counsel} tone="warn" />
                <Stat label={d.ai.quality_label.correction_ignored} value={q.correction_ignored} tone="warn" />
                <Stat label={d.ai.quality_label.unsure_repeat} value={q.unsure_repeat} tone="warn" />
                <Stat label={d.ai.quality_label.summary_mismatch} value={q.summary_mismatch} tone="warn" />
                <Stat label="목적 이름만 바꾼 질문" value={d.ai.label_only} tone="warn" />
                <Stat label="정정했는데 저장 안 됨" value={d.ai.correction_not_saved} tone="warn" />
                <Stat label="프로필 반영 실패" value={d.ai.profile_save_failed} tone="bad" />
                <Stat label="거절 의미 재등장" value={null} missing="데이터 없음" hint="턴 기록에 판정 칸 없음" />
              </div>
            </Section>

            <Section title="연결(매칭)" right={<button type="button" className="aw-link" onClick={() => go('connect')}>연결 →</button>}>
              {connect?.error ? <Notice kind="확인 필요">{connect.error}</Notice> : null}
              <div className="aw-grid">
                <Stat label="연결 준비 사용자" value={connect?.candidates?.eligible ?? null} />
                <Stat label="후보(승인 대기)" value={connect?.candidates ? connect.candidates.candidates.length : null} />
                <Stat label="둘 다 첫 답" value={bothAnswered} />
                <Stat label="연결됨" value={approved} />
                <Stat label="이야기 오감" value={talking} />
                <Stat label="실제 만남" value={null} missing="데이터 없음" hint="만남을 기록하는 칸 없음" />
              </div>
            </Section>

            <Section title="안전" right={<button type="button" className="aw-link" onClick={() => go('safety')}>신고·차단 →</button>}>
              <div className="aw-grid">
                <Stat label="신고(전체)" value={d.safety.reports} />
                <Stat label="검토 필요" value={d.safety.open} tone="warn" />
                <Stat label="중대 의심" value={d.safety.severe} tone="bad" hint="사유 글자 기준 · 판단은 사람" />
                <Stat label="차단(전체)" value={d.safety.blocks} />
              </div>
            </Section>
          </>
        );
      })() : null}
    </div>
  );
}
