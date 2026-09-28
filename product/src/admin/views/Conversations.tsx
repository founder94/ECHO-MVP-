// AI 대화 · 사용자 확정 상태 · 오류·실패 — 같은 실제 기록(대화 서버가 저장한 세션·턴)을 세 가지 눈으로 본다.
// 원문(사용자 말·AI 응답)은 기본으로 가린다. 「원문 보기」를 눌러야 보인다(개인정보 최소 노출).
import { useState } from 'react';
import { adminCall, PERIOD_LABEL, type FactState, type Period, type SessionDetail, type SessionItem, type SessionsOut, type QualityKey } from '../api';
import { useLoad } from '../useLoad';
import { Loading, Notice, Section, Tag } from '../ui';
import { goalKo, GOAL_KO, when } from '../format';

const Q_LABEL: Record<QualityKey, string> = { repeat: '반복 질문', goal_mismatch: '목적 불일치', counsel: '상담사 말투', correction_ignored: '정정 후 방향 미변경', unsure_repeat: '「잘 모르겠어」 뒤 같은 질문', summary_mismatch: '정리 목적 불일치' };
const KIND_KO: Record<string, string> = { answer: '답', correction: '정정', repair: '거절·항의', unsure: '모르겠음', help: '도움 요청', ask: '되물음', skip: '넘김', stop: '그만', blocked: '막힘', error: 'AI 실패' };
const STATE_TONE: Record<FactState, 'ok' | 'warn' | 'bad' | 'muted'> = { 확정: 'ok', '사용자 정정': 'ok', 미확정: 'muted', 폐기: 'muted', 거절: 'bad', '분쟁 중': 'warn' };
const AREA_KO: Record<string, string> = { relationship_intent: '원하는 만남', attraction_comfort: '편하게 느끼는 것', values_character: '잘 맞는 모습', relationship_style: '만남 방식', boundaries: '피하고 싶은 것', 추측: 'AI 추측' };

export type ConvMode = 'ai' | 'facts' | 'failures';

export default function Conversations({ mode }: { mode: ConvMode }) {
  const [period, setPeriod] = useState<Period>('7d');
  const [user, setUser] = useState('');
  const [goal, setGoal] = useState('');
  const [onlyCorrection, setOnlyCorrection] = useState(false);
  const [filters, setFilters] = useState({ user: '', goal: '', correction: false });
  const [open, setOpen] = useState<string | null>(null);
  const [list, reload] = useLoad(() => adminCall<SessionsOut>('admin-web', { action: 'sessions', period, user: filters.user, goal: filters.goal, correction: filters.correction, failed: mode === 'failures' }), [period, filters, mode]);

  return (
    <div className="aw-page">
      {mode === 'facts' ? <FactLegend /> : null}
      <form className="aw-toolbar" onSubmit={(e) => { e.preventDefault(); setFilters({ user, goal, correction: onlyCorrection }); }}>
        <div className="aw-seg" role="tablist" aria-label="기간">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => <button key={p} type="button" role="tab" aria-selected={p === period} className={p === period ? 'on' : ''} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>)}
        </div>
        <input className="aw-input" value={user} onChange={(e) => setUser(e.target.value)} placeholder="사용자(닉네임·번호)" aria-label="사용자" />
        <select className="aw-input" value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="목적">
          <option value="">모든 목적</option>
          {Object.entries(GOAL_KO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="aw-check"><input type="checkbox" checked={onlyCorrection} onChange={(e) => setOnlyCorrection(e.target.checked)} /> 정정·거절 있는 대화만</label>
        <button type="submit" className="aw-btn">찾기</button>
        <button type="button" className="aw-btn" onClick={reload}>새로 고침</button>
      </form>
      {list.kind === 'loading' ? <Loading /> : null}
      {list.kind === 'error' ? <Notice kind="오류">{list.message} ({list.code})</Notice> : null}
      {list.kind === 'ready' ? (
        <Section title={mode === 'failures' ? '실패가 있는 대화' : mode === 'facts' ? '대화별 확정 상태' : 'AI 대화'} sub={`${list.data.total.toLocaleString('ko-KR')}개 · 한 계정에서 목적이 다른 대화를 한 사람 ${list.data.multi_session_users}명${list.data.truncated ? ' · 일부만 읽음' : ''}`}>
          {!list.data.sessions.length ? <p className="aw-empty">데이터 없음</p> : null}
          <ul className="aw-list">
            {list.data.sessions.map((s) => (
              <li key={s.id} className={open === s.id ? 'open' : ''}>
                <button type="button" className="aw-row" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <SessionLine s={s} />
                </button>
                {open === s.id ? <SessionView id={s.id} focus={mode} /> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function SessionLine({ s }: { s: SessionItem }) {
  const flags = s.quality ? (Object.keys(s.quality) as QualityKey[]).filter((k) => s.quality![k] > 0) : [];
  return (
    <>
      <span className="aw-row-main"><strong>{s.nickname ?? '이름 없음'}</strong> <span className="aw-sub">{s.user}</span></span>
      <span><Tag>{goalKo(s.goal)}</Tag></span>
      <span className="aw-sub">질문 {s.questions} · 턴 {s.turns}</span>
      <span>{s.done ? <Tag tone="ok">완료</Tag> : <Tag tone="muted">진행 중</Tag>}</span>
      <span>
        {s.failed_turns ? <Tag tone="bad">AI 실패 {s.failed_turns}</Tag> : null}
        {flags.map((k) => <Tag key={k} tone="warn">{Q_LABEL[k]}</Tag>)}
        {s.corrections ? <Tag>정정 {s.corrections}</Tag> : null}
        {s.rejections ? <Tag>거절 {s.rejections}</Tag> : null}
        {s.sessions_of_user.length > 1 ? <Tag tone="muted">이 계정 목적 {s.sessions_of_user.map(goalKo).join('·')}</Tag> : null}
      </span>
      <span className="aw-sub">{when(s.updated_at)}</span>
    </>
  );
}

function SessionView({ id, focus }: { id: string; focus: ConvMode }) {
  const [d] = useLoad(() => adminCall<SessionDetail>('admin-web', { action: 'session', id }), [id]);
  const [raw, setRaw] = useState(false);
  if (d.kind === 'loading') return <Loading />;
  if (d.kind === 'error') return <Notice kind="오류">{d.message}</Notice>;
  const { session: s, records, siblings } = d.data;
  const hide = (t: string | null | undefined) => (t ? (raw ? t : '●●●') : '—');
  return (
    <div className="aw-detail">
      <div className="aw-detail-head">
        <span>세션 {s.id.slice(0, 8)} · 목적 <strong>{goalKo(s.goal)}</strong>{s.goal_label ? ` (${s.goal_label})` : ''} · 대화 서버 {s.agent ?? '—'} · 시작 {when(s.created_at)} · 최근 {when(s.updated_at)}</span>
        <button type="button" className="aw-btn" onClick={() => setRaw(!raw)}>{raw ? '원문 가리기' : '원문 보기'}</button>
      </div>
      {siblings.length > 1 ? (
        <div className="aw-siblings">
          <strong>같은 계정의 대화</strong>
          <ul>{siblings.map((x) => <li key={x.id} className={x.id === s.id ? 'me' : ''}>{x.id.slice(0, 8)} · {goalKo(x.goal)} · {x.done ? '완료' : '진행 중'} · {when(x.updated_at)}{x.summary.length ? ` · 정리: ${raw ? x.summary.join(' / ') : '●●●'}` : ''}</li>)}</ul>
        </div>
      ) : null}
      {focus !== 'facts' ? (
        <ol className="aw-turns">
          {s.first_question ? <li className="aw-turn-q">첫 질문: {s.first_question}</li> : null}
          {s.turns.map((t) => (
            <li key={t.n} className="aw-turn">
              <div className="aw-turn-meta"><Tag tone={t.kind === 'correction' || t.kind === 'repair' ? 'warn' : undefined}>{KIND_KO[t.kind] ?? t.kind}</Tag>{t.guard ? <Tag tone="muted">서버 판정: {t.guard}</Tag> : null}{t.saved ? <Tag tone="ok">저장</Tag> : null}</div>
              <div><span className="aw-who">사용자</span> {hide(t.user)}</div>
              <div><span className="aw-who">ECHO</span> {hide(t.reply)}</div>
              {t.question ? <div><span className="aw-who">다음 질문</span> {t.question}</div> : null}
            </li>
          ))}
        </ol>
      ) : null}
      <h3 className="aw-h3">사용자 확정 상태</h3>
      {!s.facts.length ? <p className="aw-empty">데이터 없음</p> : (
        <div className="aw-table-wrap"><table className="aw-table">
          <thead><tr><th>영역</th><th>내용</th><th>상태</th><th>연결에 씀</th><th>턴</th></tr></thead>
          <tbody>{s.facts.map((f, i) => (
            <tr key={i}><td>{AREA_KO[f.area] ?? f.area}</td><td>{hide(f.text)}</td><td><Tag tone={STATE_TONE[f.state]}>{f.state}</Tag></td><td>{f.matching ? '씀' : '안 씀'}</td><td>{f.turn}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {s.summary.length || s.closing ? <p className="aw-sub">정리: {raw ? [...s.summary, s.closing ?? ''].filter(Boolean).join(' / ') : '●●●'}</p> : null}
      {focus !== 'facts' ? (
        <>
          <h3 className="aw-h3">서버 기록(턴마다)</h3>
          <div className="aw-table-wrap"><table className="aw-table">
            <thead><tr><th>시각</th><th>턴</th><th>결과</th><th>모델</th><th>대화 서버</th><th>다시 청함</th><th>오류</th></tr></thead>
            <tbody>{records.map((r, i) => (
              <tr key={i}><td>{when(r.at)}</td><td>{r.turn ?? '—'}</td><td>{r.failed ? <Tag tone="bad">실패</Tag> : KIND_KO[r.kind ?? ''] ?? r.kind ?? '—'}</td><td>{r.model ?? '—'}</td><td>{r.agent ?? '—'}</td><td className="aw-sub">{r.retry.length ? r.retry.join(', ') : '없음'}</td><td>{r.error ?? '—'}</td></tr>
            ))}</tbody>
          </table>{!records.length ? <p className="aw-empty">데이터 없음</p> : null}</div>
        </>
      ) : null}
    </div>
  );
}

function FactLegend() {
  const rows: [FactState, string, boolean][] = [
    ['확정', '사용자가 말했고 지금도 맞는 값', true], ['사용자 정정', '사용자가 고쳐 말한 새 값', true], ['미확정', 'AI 추측 — 사실이 아님', false],
    ['폐기', '정정으로 밀려난 옛 값', false], ['거절', '사용자가 「그게 아니에요」로 거둔 AI 해석', false], ['분쟁 중', '어느 해석을 거절했는지 확인 중', false],
  ];
  return (
    <Section title="상태 설명" sub="AI 추정은 사실이 아닙니다. 연결(매칭)에는 확정·사용자 정정만 씁니다.">
      <div className="aw-legend">{rows.map(([s, d, m]) => <div key={s}><Tag tone={STATE_TONE[s]}>{s}</Tag> {d} · 연결에 {m ? '씀' : '안 씀'}</div>)}</div>
    </Section>
  );
}
