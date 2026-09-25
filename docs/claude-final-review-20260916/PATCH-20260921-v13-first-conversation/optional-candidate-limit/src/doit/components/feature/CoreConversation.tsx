import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronRight, Loader2, PencilLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED, UnderstandingError, prepareUnderstandingRequest, understandingRequest } from '@/doit/lib/understandingApi';
import { createCoreConversation, type CoreInsight, type CoreQuestion, type CoreRecord } from '@/doit/lib/coreConversation';
import { clearPendingSelf, loadPendingSelf, savePendingSelf } from '@/doit/lib/conversationRecovery';
import './core-conversation.css';

interface Props { userId: string; onContinue?: () => void }
type Editor = { insight: CoreInsight; kind: 'correct' | 'self'; text: string; rejected: boolean };
const FOLLOWUP_ENABLED = import.meta.env.VITE_ECHO_FOLLOWUP_ENABLED === 'true';
// [후보 수 제한 · 별도 수정안] 첫 이야기는 후보 1개를 우선 제시, 그 다음은 최대 3개. 자르는 주체는 서버(v9b)다.
const CANDIDATE_LIMIT_FIRST = 1;
const CANDIDATE_LIMIT_NEXT = 3;
const categoryNames: Record<string, string> = { value: '소중한 기준', pattern: '반복되는 모습', memory: '기억해 둘 이야기' };

function errorCopy(error: unknown): string {
  const code = error instanceof UnderstandingError ? error.code : '';
  if (code === 'STALE_REVISION' || code === 'STALE_CONTEXT') return '다른 화면에서 내용이 바뀌었어요. 최신 내용을 확인한 뒤 다시 선택해 주세요.';
  if (code === 'BAD_REQUEST' || code === 'SERVER_UPDATE_REQUIRED') return '이 기능의 서버 연결을 준비하고 있어요. 저장된 이야기는 그대로 남아 있어요.';
  if (code === 'PENDING_INSIGHTS') return '아직 확인하지 않은 AI의 설명이 있어요. 먼저 내 생각과 맞는지 알려주세요.';
  if (code === 'AI_NOT_CONFIGURED') return '대화 연결을 준비하고 있어요. 저장된 이야기는 그대로 남아 있어요.';
  if (code === 'RATE_LIMITED' || code === 'IN_FLIGHT') return '앞선 요청을 처리하고 있어요. 잠시 뒤 다시 시도해 주세요.';
  if (code === 'UNAUTHORIZED') return '로그인 상태가 바뀌었어요. 다시 로그인한 뒤 이어가 주세요.';
  return '아직 결과를 확인하지 못했어요. 적은 내용은 그대로 있으니 다시 시도해 주세요.';
}

export default function CoreConversation({ userId, onContinue }: Props) {
  const { reload: reloadUnderstanding } = useUnderstanding();
  const [records, setRecords] = useState<CoreRecord[]>([]);
  const [insights, setInsights] = useState<CoreInsight[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [followupQuestion, setFollowupQuestion] = useState<CoreQuestion | null>(null);
  const [rescueQuestion, setRescueQuestion] = useState<CoreQuestion | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  const questionVersion = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const api = useMemo(() => createCoreConversation({
    read: <T,>(body: Record<string, unknown>) => understandingRequest<T>(body, userId),
    write: async <T,>(body: Record<string, unknown>) => {
      // STALE_CONTEXT = 같은 requestId 가 예전 맥락으로 이미 처리됐다(응답 유실 뒤 정정이 바뀜). 보관 id 를 버리고
      // 새 requestId 로 한 번만 다시 보낸다. 두 번째도 같으면 그대로 실패로 알린다(무한 반복 금지).
      const attempt = async (retried: boolean): Promise<T> => {
        const request = await prepareUnderstandingRequest(userId, body);
        try {
          const response = await understandingRequest<T>(request.body, userId);
          request.complete();
          return response;
        } catch (error) {
          if (error instanceof UnderstandingError && error.code === 'STALE_CONTEXT') {
            request.complete();
            if (!retried) return attempt(true);
          }
          throw error;
        }
      };
      return attempt(false);
    },
  }), [userId]);
  const load = useCallback(async () => {
    const data = await api.load();
    if (!alive.current) return;
    setRecords(data.records); setInsights(data.insights); setLoaded(true);
    setActiveId(current => current && data.records.some(r => r.id === current) ? current : data.records[0]?.id ?? null);
    // 거절은 됐는데 저장하지 못한 직접 설명이 있으면 그 내용으로 입력 상자를 다시 연다(자동 저장은 하지 않는다).
    const pending = loadPendingSelf(userId);
    if (pending) {
      const found = data.insights.find(i => i.id === pending.insightId);
      const insight: CoreInsight = found ?? { id: pending.insightId, text: '', category: pending.category, status: 'rejected', origin: 'ai', source_record_id: pending.recordId, revision: 1, created_at: '' };
      setActiveId(pending.recordId);
      setEditor(previous => previous ?? { insight, kind: 'self', text: pending.text, rejected: insight.status === 'rejected' });
    }
  }, [api, userId]);
  useEffect(() => {
    if (!A_STRUCTURE_SERVER_ENABLED) return;
    setBusy('이야기를 불러오고 있어요');
    void load().catch(e => { if (alive.current) setError(errorCopy(e)); }).finally(() => { if (alive.current) setBusy(null); });
  }, [load]);
  const questionContext = insights.map(i => `${i.id}:${i.revision}:${i.status}`).sort().join('|');
  useEffect(() => {
    if (!activeId || !A_STRUCTURE_SERVER_ENABLED || !FOLLOWUP_ENABLED) return;
    let current = true;
    const version = ++questionVersion.current;
    setFollowupQuestion(null);
    // followup_get restores only follow-up questions, not insight_generate rescue text.
    void api.savedQuestion(activeId).then(q => { if (current && alive.current && version === questionVersion.current) setFollowupQuestion(q); }).catch(() => { /* 이전 서버에는 질문 복원 계약이 없다. 질문을 만들거나 성공으로 표시하지 않는다. */ });
    return () => { current = false; };
  }, [api, activeId, questionContext]);
  const clearQuestions = () => {
    questionVersion.current += 1;
    setFollowupQuestion(null); setRescueQuestion(null);
  };
  const run = async (label: string, task: () => Promise<void>) => {
    if (lock.current || !A_STRUCTURE_SERVER_ENABLED) return;
    lock.current = true; setBusy(label); setError(''); setNotice('');
    try { await task(); }
    catch (e) {
      if (alive.current) { setError(errorCopy(e)); try { await load(); } catch { /* 원래 실패 문구와 입력 유지 */ } }
    } finally {
      // Keep the private home/understanding screens in sync even after a partial write.
      if (alive.current) await reloadUnderstanding();
      lock.current = false; if (alive.current) setBusy(null);
    }
  };
  const merge = (next: CoreInsight) => setInsights(previous => [next, ...previous.filter(i => i.id !== next.id)]);
  const active = records.find(r => r.id === activeId);
  const candidates = insights.filter(i => i.status === 'candidate');
  const current = candidates.find(i => i.source_record_id === activeId) ?? candidates[0];
  const remembered = insights.filter(i => i.status === 'confirmed' || i.status === 'corrected');
  const hasInsights = insights.some(i => i.source_record_id === activeId);
  const activeFollowup = followupQuestion?.sourceRecordId === activeId ? followupQuestion : null;
  const activeRescue = rescueQuestion?.sourceRecordId === activeId ? rescueQuestion : null;
  const question = hasInsights ? activeFollowup : activeRescue ?? activeFollowup;
  const latestEditing = editor ? insights.find(i => i.id === editor.insight.id) : undefined;
  const editorConflict = !!editor && !!latestEditing && latestEditing.revision !== editor.insight.revision && !(editor.kind === 'self' && latestEditing.status === 'rejected');
  const send = () => run('이야기를 정리하고 있어요', async () => {
    const isFirst = records.length === 0;
    const record = await api.record(draft);
    if (!alive.current) return;
    setRecords(previous => [record, ...previous.filter(r => r.id !== record.id)]); setActiveId(record.id); setDraft(''); clearQuestions();
    setNotice('이야기를 저장했어요.');
    const result = await api.generate(record.id, isFirst ? CANDIDATE_LIMIT_FIRST : CANDIDATE_LIMIT_NEXT);
    if (!alive.current) return;
    setInsights(previous => [...result.insights, ...previous.filter(i => !result.insights.some(n => n.id === i.id))]);
    setRescueQuestion(result.rescue?.text ? { text: result.rescue.text, sourceRecordId: record.id } : null);
  });
  const retryGenerate = () => active && run('다시 읽고 있어요', async () => {
    const result = await api.generate(active.id);
    if (!alive.current) return;
    await load();
    if (!alive.current) return;
    setRescueQuestion(result.rescue?.text ? { text: result.rescue.text, sourceRecordId: active.id } : null);
  });
  const react = (item: CoreInsight, decision: 'confirm' | 'reject') => run('내 생각을 반영하고 있어요', async () => {
    const saved = await api.react(item, decision);
    if (!alive.current) return;
    merge(saved); clearQuestions();
    setNotice(decision === 'confirm' ? '내가 확인한 이해로 저장했어요.' : '이 해석은 제외했어요. 처음 적어주신 이야기는 그대로 남겨둘게요.');
  });
  const saveEditor = () => editor && !editorConflict && run('직접 적은 말을 반영하고 있어요', async () => {
    if (editor.kind === 'correct') {
      const saved = await api.react(editor.insight, 'correct', editor.text);
      if (!alive.current) return;
      merge(saved);
    } else {
      const refreshed = insights.find(item => item.id === editor.insight.id);
      const category = editor.insight.category as 'value' | 'pattern' | 'memory';
      if (!editor.rejected && refreshed?.status !== 'rejected') {
        const rejected = await api.react(editor.insight, 'reject');
        if (!alive.current) return;
        merge(rejected); setEditor(previous => previous ? { ...previous, insight: rejected, rejected: true } : null);
      }
      // 거절은 끝났다. 설명 저장이 실패하거나 화면이 닫혀도 내용을 잃지 않도록 이 기기 세션에 예약한다.
      savePendingSelf(userId, { insightId: editor.insight.id, recordId: editor.insight.source_record_id, category, text: editor.text });
      const saved = await api.explain(editor.insight.source_record_id, editor.insight.category, editor.text);
      if (!alive.current) return;
      merge(saved);
      clearPendingSelf(userId);
    }
    clearQuestions(); setEditor(null); setNotice('직접 설명해 주신 내용으로 저장했어요.');
  });

  if (!A_STRUCTURE_SERVER_ENABLED) return <section className="echo-dialogue"><DoItSymbol decorative /><p className="echo-eyebrow">ECHO · 내 이야기</p><h1>나를 설명하는 말은,<br />내가 정할 수 있도록.</h1><p className="echo-lead">대화와 기억을 연결하는 마지막 확인을 하고 있어요. 지금은 내 소개와 사진을 준비할 수 있어요.</p>{onContinue ? <button className="echo-primary" onClick={onContinue}>내 프로필 준비하기 <ChevronRight size={18} /></button> : <Link className="echo-primary" to="/doit/start-journey">내 프로필 준비하기 <ChevronRight size={18} /></Link>}</section>;

  return <section className="echo-dialogue" aria-busy={!!busy}>
    <header className="echo-dialogue-header"><DoItSymbol decorative /><span>DO IT / ECHO</span><Link to="/doit/understanding">내가 확인한 이해</Link></header>
    <p className="echo-eyebrow">내 말로 시작하는 대화</p>
    <h1>{records.length ? <>지난 이야기를,<br />조금 더 이어볼까요.</> : <>잘 쓰려고 애쓰지<br />않아도 괜찮아요.</>}</h1>
    <p className="echo-lead">원하는 관계나 요즘 느낀 감정을 편하게 이야기해 주세요. AI의 이해가 다르면, 내 말로 고칠 수 있어요.</p>
    {records.length > 0 && <details className="echo-history"><summary>지난 이야기 {records.length}개</summary><ol>{records.map(record => <li key={record.id}><button disabled={!!busy || !!editor} onClick={() => { setActiveId(record.id); setNotice(''); }}>{record.text}</button></li>)}</ol></details>}
    {active && <div className="echo-original"><p className="echo-eyebrow">내가 남긴 말</p><p>{active.original_text || active.text}</p></div>}
    {current && !editor && <article className="echo-insight" key={current.id}>
      <span className="echo-insight-label">아직 확인하지 않은 AI의 이해</span>
      {current.source_record_id !== activeId && <p className="echo-context">이전 이야기에서 확인을 기다리고 있어요.</p>}
      <h2>{current.text}</h2><p className="echo-context">이 설명이 내 생각과 맞나요?</p>
      <div className="echo-reactions">
        <button disabled={!!busy || !loaded} onClick={() => void react(current, 'confirm')}>맞아요</button>
        <button disabled={!!busy || !loaded} onClick={() => setEditor({ insight: current, kind: 'correct', text: '', rejected: false })}>조금 달라요</button>
        <button disabled={!!busy || !loaded} onClick={() => void react(current, 'reject')}>그게 아니에요</button>
        <button disabled={!!busy || !loaded} onClick={() => setEditor({ insight: current, kind: 'self', text: '', rejected: false })}>직접 설명할게요</button>
      </div>
      <p className="echo-fine">확인 전에는 나에 대한 사실로 표시하지 않아요.</p>
    </article>}
    {editor && <section className="echo-editor"><PencilLine size={20} /><h2>{editor.kind === 'correct' ? '어떤 부분을 고치면 더 맞을까요?' : '내 말로 설명해 주세요.'}</h2><p className="echo-context">{editor.rejected ? '이전 AI 해석은 제외했어요. 이제 직접 적은 내용을 저장할게요.' : '아래 내용을 저장한 뒤에 반영돼요.'}</p>{editorConflict && latestEditing && <div className="echo-error"><p>다른 화면에서 바뀐 설명: {latestEditing.text}</p><p>적어 둔 내용은 그대로 남겨뒀어요. 최신 설명을 확인한 뒤 다시 저장해 주세요.</p>{latestEditing.status !== 'rejected' && <button onClick={() => setEditor({ ...editor, insight: latestEditing })}>최신 설명을 확인했어요</button>}</div>}<label htmlFor="echo-correction" className="sr-only">내 설명</label><textarea id="echo-correction" maxLength={200} value={editor.text} disabled={!!busy} onChange={event => setEditor({ ...editor, text: event.target.value })} autoFocus rows={4} /><div className="echo-editor-footer"><span>{editor.text.length}/200</span><button disabled={!!busy} onClick={() => setEditor(null)}>닫기</button></div><button className="echo-primary" disabled={!!busy || !editor.text.trim() || editorConflict} onClick={() => void saveEditor()}>이 설명으로 저장하기 <Check size={18} /></button></section>}
    {notice && <p className="echo-notice" role="status"><Check size={16} />{notice}</p>}
    {error && <div className="echo-error" role="alert"><p>{error}</p>{!loaded && <button disabled={!!busy} onClick={() => void run('다시 불러오고 있어요', load)}>다시 불러오기</button>}</div>}
    {busy && <p className="echo-busy" role="status"><Loader2 size={16} className="animate-spin" />{busy}</p>}
    {active && !hasInsights && !question && !busy && <button className="echo-secondary" disabled={!loaded} onClick={() => void retryGenerate()}>저장한 이야기 다시 살펴보기</button>}
    {FOLLOWUP_ENABLED && active && !candidates.length && !editor && hasInsights && <div className="echo-next">{question ? <p className="echo-question">{question.text}</p> : <button className="echo-secondary" disabled={!!busy || !loaded} onClick={() => void run('다음 이야기를 생각하고 있어요', async () => { const version = ++questionVersion.current; const next = await api.nextQuestion(active.id); if (alive.current && version === questionVersion.current) setFollowupQuestion(next); })}>이어서 이야기하기 <ChevronRight size={18} /></button>}</div>}
    {question && !hasInsights && <p className="echo-question">{question.text}</p>}
    {!editor && <form className="echo-composer" onSubmit={event => { event.preventDefault(); if (loaded && draft.trim() && !busy && !candidates.length) void send(); }}><label htmlFor="echo-message">{active ? '이어서 하고 싶은 이야기' : '오늘은 어떤 이야기를 해볼까요?'}</label><textarea id="echo-message" value={draft} onChange={event => setDraft(event.target.value)} placeholder="지금 떠오르는 말부터 적어주세요." maxLength={2000} rows={4} disabled={!!busy || !loaded || !!candidates.length} /><div className="echo-composer-footer"><span>{candidates.length ? '위에서 AI의 이해를 먼저 확인해 주세요.' : '대화는 내 계정에 저장돼요. 프로필에 자동 공개하지 않아요.'}</span><button type="submit" aria-label="이야기 보내기" disabled={!!busy || !loaded || !draft.trim() || !!candidates.length}><ArrowUp size={20} /></button></div></form>}
    {remembered.length > 0 && <details className="echo-memory"><summary>내가 확인한 이해 {remembered.length}개</summary>{remembered.map(item => <div key={item.id}><span>{item.origin === 'self' ? '직접 설명' : item.status === 'corrected' ? '내가 고친 설명' : categoryNames[item.category] ?? '확인한 이해'}</span><p>{item.text}</p><button className="echo-text-button" disabled={!!busy || !!editor} onClick={() => setEditor({ insight: item, kind: 'correct', text: item.text, rejected: false })}>지금의 나에 맞게 고치기</button></div>)}</details>}
    <footer className="echo-dialogue-footer">{onContinue ? <button className="echo-secondary" disabled={!!busy || !!editor} onClick={onContinue}>내 소개와 사진 준비하기 <ChevronRight size={18} /></button> : <Link className="echo-secondary" to="/doit/start-journey?edit=profile">내 소개와 사진 준비하기 <ChevronRight size={18} /></Link>}<p className="echo-fine">대화의 길이는 정해져 있지 않아요. 내 속도로 이어가세요.</p></footer>
  </section>;
}
