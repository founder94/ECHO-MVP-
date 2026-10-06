import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  UnderstandingError,
  prepareUnderstandingRequest,
  understandingRequest,
} from '@/doit/lib/understandingApi';

// QA 전용 검사 도구 — 제품 화면이 아니다.
// doit-understanding(v5)을 사람이 직접 한 번에 하나씩 눌러 실제 AI 경로를 확인하기 위한 화면.
//
// 지키는 것
// - 실제 서버 경계는 이 화면이 아니라 Edge Function 이다(verify_jwt → getUser() → 인증 uid → RPC/RLS).
//   여기서 하는 로그인 확인은 잘못 누르는 것을 막는 편의일 뿐, 보안 경계가 아니다.
// - 현재 로그인한 사용자의 데이터만 다룬다. user_id 를 입력하는 칸을 만들지 않는다.
// - admin_read / handoff 는 넣지 않는다.
// - 버튼 1회 = 요청 1회. 자동 반복 버튼을 만들지 않는다(비용 폭주 방지).
// - JWT·Authorization·Secret·API Key·다른 사용자 정보를 화면에 출력하지 않는다.
// - 호출 계층은 기존 understandingApi 를 그대로 쓴다. 별도 fetch 계층을 만들지 않는다.

const QA_PATH = '/qa/doit-understanding';

// v5 가 실제로 받는 action 중 이 화면에서 쓰는 것만. 없는 이름을 만들지 않는다.
type QaAction =
  | 'record_create'
  | 'record_list'
  | 'insight_generate'
  | 'insight_list'
  | 'insight_confirm'
  | 'insight_correct'
  | 'insight_reject'
  | 'insight_self';

type Category = 'value' | 'pattern' | 'memory';

interface Trace {
  attempts?: number;
  generated?: number;
  dropped_not_grounded?: number;
  dropped_rejected_lexical?: number;
  dropped_rejected_semantic?: number;
  survived?: number;
  reasons?: string[];
}

interface RecordRow {
  id: string;
  text: string;
  revision: number;
}
interface InsightRow {
  id: string;
  category: string;
  text: string;
  status: string;
  origin: string;
  revision: number;
}
interface Rescue {
  kind: string;
  text: string;
}

interface LogEntry {
  n: number;
  action: QaAction;
  ok: boolean;
  code: string;
  requestId: string;
  ms: number;
  rescued: boolean;
  rescueKind: string | null;
  trace: Trace | null;
  note: string;
}

// 서버 응답에서 화면에 쓸 부분만. 원문 외 다른 사용자 정보는 들어올 수 없는 구조다(서버가 본인 행만 돌려준다).
interface AnyResponse {
  ok?: boolean;
  record?: RecordRow;
  records?: RecordRow[];
  insight?: InsightRow;
  insights?: InsightRow[];
  duplicate?: boolean;
  rescued?: boolean;
  rescue?: Rescue;
  trace?: Trace;
}

const box: React.CSSProperties = {
  border: '1px solid #d8d4cc',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  background: '#ffffff',
};
const btn: React.CSSProperties = {
  border: '1px solid #1f1e1c',
  borderRadius: 8,
  padding: '10px 12px',
  background: '#1f1e1c',
  color: '#ffffff',
  fontSize: 13,
  cursor: 'pointer',
  marginRight: 6,
  marginBottom: 6,
};
const btnOff: React.CSSProperties = { ...btn, background: '#bdb9b1', borderColor: '#bdb9b1', cursor: 'not-allowed' };
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #d8d4cc',
  borderRadius: 8,
  padding: 10,
  fontSize: 14,
  fontFamily: 'inherit',
};
const label: React.CSSProperties = { fontSize: 12, color: '#6b6860', display: 'block', marginBottom: 4 };

export default function QaDoitUnderstanding() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [recordText, setRecordText] = useState(
    '오늘 팀에서 새 프로젝트를 맡아달라는 얘기를 들었다. 보수가 오른다는데 솔직히 크게 안 끌린다. 그보다 같이 일하는 사람들이 바뀌는 게 더 신경 쓰인다.',
  );
  const [record, setRecord] = useState<RecordRow | null>(null);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctText, setCorrectText] = useState('');
  const [selfText, setSelfText] = useState('');
  const [selfCategory, setSelfCategory] = useState<Category>('value');
  const [rescue, setRescue] = useState<Rescue | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<QaAction | null>(null);

  const callCount = log.length;
  const selected = useMemo(
    () => insights.find((i) => i.id === selectedId) ?? null,
    [insights, selectedId],
  );

  // 요청 1건 실행 + 결과 기록. 버튼 1회 = 이 함수 1회.
  const run = useCallback(
    async (action: QaAction, payload: Record<string, unknown>, withRequestId: boolean, note = '') => {
      if (!user || busy) return null;
      setBusy(action);
      const started = Date.now();
      let requestId = '(없음)';
      let prepared: { body: Record<string, unknown>; complete: () => void } | null = null;
      try {
        const base = { action, ...payload };
        let body: Record<string, unknown> = base;
        if (withRequestId) {
          prepared = await prepareUnderstandingRequest(user.id, base);
          body = prepared.body;
          requestId = String(prepared.body.requestId ?? '(없음)');
        }
        const res = await understandingRequest<AnyResponse>(body, user.id);
        prepared?.complete();
        setLog((prev) => [
          {
            n: prev.length + 1,
            action,
            ok: true,
            code: res.duplicate ? 'OK(중복 요청·서버가 기존 결과 반환)' : 'OK',
            requestId,
            ms: Date.now() - started,
            rescued: Boolean(res.rescued),
            rescueKind: res.rescue?.kind ?? null,
            trace: res.trace ?? null,
            note,
          },
          ...prev,
        ]);
        return res;
      } catch (e) {
        const code = e instanceof UnderstandingError ? e.code : 'UNKNOWN';
        setLog((prev) => [
          {
            n: prev.length + 1,
            action,
            ok: false,
            code,
            requestId,
            ms: Date.now() - started,
            rescued: false,
            rescueKind: null,
            trace: null,
            note,
          },
          ...prev,
        ]);
        return null;
      } finally {
        setBusy(null);
      }
    },
    [user, busy],
  );

  const onCreateRecord = async () => {
    const text = recordText.trim();
    if (!text) return;
    const res = await run('record_create', { text, originalText: text, emotion: '', status: 'confirmed' }, true);
    if (res?.record) {
      setRecord(res.record);
      setInsights([]);
      setSelectedId(null);
      setRescue(null);
    }
  };

  const onListRecords = async () => {
    const res = await run('record_list', {}, false);
    if (res?.records?.length) setRecord(res.records[0]);
  };

  const onGenerate = async () => {
    if (!record) return;
    setRescue(null);
    const res = await run('insight_generate', { recordId: record.id }, true);
    if (!res) return;
    if (res.rescued && res.rescue) {
      setRescue(res.rescue);
      setInsights([]);
      setSelectedId(null);
      return;
    }
    setInsights(res.insights ?? []);
    setSelectedId(res.insights?.[0]?.id ?? null);
  };

  const onListInsights = async () => {
    const res = await run('insight_list', {}, false);
    if (res?.insights) {
      setInsights(res.insights);
      setSelectedId(res.insights[0]?.id ?? null);
    }
  };

  const applyUpdated = (row?: InsightRow) => {
    if (!row) return;
    setInsights((prev) => prev.map((i) => (i.id === row.id ? row : i)));
  };

  const onConfirm = async () => {
    if (!selected) return;
    const res = await run('insight_confirm', { id: selected.id, expectedRevision: selected.revision }, true, '맞아요');
    applyUpdated(res?.insight);
  };

  const onCorrect = async () => {
    const text = correctText.trim();
    if (!selected || !text) return;
    const res = await run(
      'insight_correct',
      { id: selected.id, expectedRevision: selected.revision, text },
      true,
      '조금 달라요(정정)',
    );
    applyUpdated(res?.insight);
  };

  const onReject = async () => {
    if (!selected) return;
    const res = await run('insight_reject', { id: selected.id, expectedRevision: selected.revision }, true, '그게 아니에요');
    applyUpdated(res?.insight);
  };

  const onSelf = async () => {
    const text = selfText.trim();
    if (!record || !text) return;
    await run('insight_self', { recordId: record.id, category: selfCategory, text }, true, '직접 설명할게요');
  };

  if (loading) {
    return (
      <div className="qa-harness" style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ fontSize: 14, color: '#6b6860' }}>로그인 상태를 확인하는 중…</p>
      </div>
    );
  }

  const disabled = !user || busy !== null;

  return (
    <div
      className="qa-harness"
      style={{
        padding: 16,
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
        color: '#1f1e1c',
        background: '#fbfaf7',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>QA · doit-understanding 검사 도구</h1>
      <p style={{ fontSize: 12, color: '#6b6860', lineHeight: 1.6, marginBottom: 12 }}>
        제품 화면이 아닙니다. 실제 서버(doit-understanding)와 실제 AI를 한 번에 하나씩 눌러 확인하는 도구입니다.
        <br />
        버튼 한 번 = 서버 요청 한 번. <strong>후보 생성 1회는 AI를 최대 9번까지 부릅니다</strong>(생성 3회 × 근거·의미
        판정). 필요한 만큼만 눌러 주세요.
      </p>

      {/* A. 로그인 상태 */}
      <div style={box}>
        <span style={label}>A. 로그인 상태</span>
        {user ? (
          <p style={{ fontSize: 13 }}>
            로그인됨 · 이 화면은 <strong>지금 로그인한 계정의 데이터만</strong> 다룹니다.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, marginBottom: 8 }}>로그인하지 않았습니다. 아래 버튼은 모두 잠겨 있습니다.</p>
            <button type="button" style={btn} onClick={() => navigate('/login', { state: { from: QA_PATH } })}>
              로그인하러 가기
            </button>
          </>
        )}
        <p style={{ fontSize: 11, color: '#6b6860', marginTop: 8, lineHeight: 1.5 }}>
          이 확인은 잘못 누르는 것을 막기 위한 것이고, 실제 보안 경계는 서버(doit-understanding)의 토큰 검증입니다.
        </p>
      </div>

      {/* B~C. 기록 */}
      <div style={box}>
        <span style={label}>B. 테스트 기록 입력</span>
        <textarea style={{ ...input, minHeight: 90 }} value={recordText} onChange={(e) => setRecordText(e.target.value)} />
        <div style={{ marginTop: 8 }}>
          <button type="button" style={disabled ? btnOff : btn} disabled={disabled} onClick={onCreateRecord}>
            C. 기록 만들기 (record_create)
          </button>
          <button type="button" style={disabled ? btnOff : btn} disabled={disabled} onClick={onListRecords}>
            내 기록 불러오기 (record_list)
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#6b6860', marginTop: 6 }}>
          현재 기록: {record ? `있음 (revision ${record.revision})` : '없음'}
        </p>
      </div>

      {/* D~E. 후보 */}
      <div style={box}>
        <span style={label}>D. 후보 생성 · E. 목록</span>
        <button type="button" style={disabled || !record ? btnOff : btn} disabled={disabled || !record} onClick={onGenerate}>
          후보 생성 (insight_generate) — AI 호출
        </button>
        <button type="button" style={disabled ? btnOff : btn} disabled={disabled} onClick={onListInsights}>
          내 이해 항목 불러오기 (insight_list)
        </button>

        {rescue && (
          <div style={{ marginTop: 10, padding: 10, border: '1px dashed #b08968', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: '#6b6860', marginBottom: 4 }}>
              후보가 모두 막혀 구제(rescue)로 응답했습니다 · 종류: {rescue.kind}
            </p>
            <p style={{ fontSize: 13 }}>{rescue.text}</p>
          </div>
        )}

        {insights.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {insights.map((i) => (
              <label
                key={i.id}
                style={{
                  display: 'block',
                  fontSize: 13,
                  padding: '8px 0',
                  borderTop: '1px solid #eee8de',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="qa-insight"
                  checked={selectedId === i.id}
                  onChange={() => setSelectedId(i.id)}
                  style={{ marginRight: 8 }}
                />
                <span>{i.text}</span>
                <span style={{ color: '#6b6860', fontSize: 11 }}>
                  {' '}
                  · {i.category} · {i.status} · {i.origin} · rev {i.revision}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* F~H. 4버튼 */}
      <div style={box}>
        <span style={label}>F~H. 선택한 항목에 대한 사용자 응답</span>
        <p style={{ fontSize: 12, color: '#6b6860', marginBottom: 8 }}>
          {selected ? `선택됨 (rev ${selected.revision} · ${selected.status})` : '위에서 항목을 하나 고르세요.'}
        </p>
        <button type="button" style={disabled || !selected ? btnOff : btn} disabled={disabled || !selected} onClick={onConfirm}>
          F. 맞아요 (insight_confirm)
        </button>
        <button type="button" style={disabled || !selected ? btnOff : btn} disabled={disabled || !selected} onClick={onReject}>
          H. 그게 아니에요 (insight_reject)
        </button>
        <div style={{ marginTop: 8 }}>
          <span style={label}>G. 조금 달라요 — 고쳐 쓸 문장</span>
          <input style={input} value={correctText} onChange={(e) => setCorrectText(e.target.value)} />
          <button
            type="button"
            style={disabled || !selected || !correctText.trim() ? btnOff : btn}
            disabled={disabled || !selected || !correctText.trim()}
            onClick={onCorrect}
          >
            정정 저장 (insight_correct)
          </button>
        </div>
      </div>

      {/* I. 직접 설명 */}
      <div style={box}>
        <span style={label}>I. 직접 설명할게요 (insight_self)</span>
        <select
          style={{ ...input, marginBottom: 8 }}
          value={selfCategory}
          onChange={(e) => setSelfCategory(e.target.value as Category)}
        >
          <option value="value">value</option>
          <option value="pattern">pattern</option>
          <option value="memory">memory</option>
        </select>
        <input style={input} value={selfText} onChange={(e) => setSelfText(e.target.value)} />
        <button
          type="button"
          style={disabled || !record || !selfText.trim() ? btnOff : btn}
          disabled={disabled || !record || !selfText.trim()}
          onClick={onSelf}
        >
          직접 설명 저장
        </button>
      </div>

      {/* 결과 */}
      <div style={box}>
        <span style={label}>결과 · 이번 화면에서 보낸 요청 {callCount}회</span>
        {log.length === 0 && <p style={{ fontSize: 13, color: '#6b6860' }}>아직 없습니다.</p>}
        {log.map((e) => (
          <div key={e.n} style={{ borderTop: '1px solid #eee8de', padding: '8px 0', fontSize: 12, lineHeight: 1.6 }}>
            <div>
              <strong>
                #{e.n} {e.action}
              </strong>{' '}
              · {e.ok ? '성공' : '실패'} · code {e.code} · {e.ms}ms {e.note && `· ${e.note}`}
            </div>
            <div style={{ color: '#6b6860' }}>request_id {e.requestId}</div>
            {e.rescued && <div style={{ color: '#6b6860' }}>rescue: {e.rescueKind}</div>}
            {e.trace && (
              <div style={{ color: '#6b6860' }}>
                trace: 시도 {e.trace.attempts} · 생성 {e.trace.generated} · 근거없음 {e.trace.dropped_not_grounded} ·
                거절(글자) {e.trace.dropped_rejected_lexical} · 거절(의미) {e.trace.dropped_rejected_semantic} · 통과{' '}
                {e.trace.survived} · [{(e.trace.reasons ?? []).join(', ')}]
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#6b6860', lineHeight: 1.6 }}>
        이 화면은 토큰·비밀키·다른 사용자 정보를 표시하지 않습니다. 저장된 검사 데이터는 지금 로그인한 계정에만
        남으며, 자동으로 지우지 않습니다.
      </p>
    </div>
  );
}
