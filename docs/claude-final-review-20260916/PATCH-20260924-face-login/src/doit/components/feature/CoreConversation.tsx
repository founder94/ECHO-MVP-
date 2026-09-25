import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronRight, PencilLine, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import DoItSymbol from '@/components/DoItSymbol';
import SymbolLoader from '@/components/SymbolLoader';
import { useUnderstanding } from '@/doit/hooks/useUnderstanding';
import { A_STRUCTURE_SERVER_ENABLED, UnderstandingError, prepareUnderstandingRequest, understandingRequest } from '@/doit/lib/understandingApi';
import { createCoreConversation, type CoreDraftLine, type CoreInsight, type CoreQuestion, type CoreRecord } from '@/doit/lib/coreConversation';
import { draftToIntro } from '@/doit/lib/introDraft';
import { clearPendingSelf, loadPendingSelf, savePendingSelf } from '@/doit/lib/conversationRecovery';
import { TOPICS, blockedContentMessage, blockedContentReason, isMetaReply } from '@/doit/lib/conversationRules';
import './core-conversation.css';

interface Props {
  userId: string;
  onContinue?: () => void;
  // v13: 첫 화면(목적 선택)에서 덧붙인 한 줄. 불러오기가 끝나면 한 번만 보낸다(장면 1).
  initialMessage?: string;
  // v13: 후보 확인이 끝나면 "이어서 이야기하기"를 누르지 않아도 다음 질문을 서버에 요청한다(장면 5). 실패하면 버튼으로 돌아간다.
  autoQuestion?: boolean;
  // v13: 선택한 만남(목적). 이야기가 아직 없을 때 첫 문장에 인용한다.
  purposeLabel?: string | null;
  // v13: 소개 초안을 프로필 소개란에 넣는 저장 경로(페이지가 제공). 없으면 초안 기능을 숨긴다.
  onUseDraft?: (text: string) => Promise<string | null>;
  // v13.4 회차: 이 시각 이후 기록이 "이번 대화", 그 전은 "이전 회차"(다시 보기). 없으면 전체가 한 회차.
  roundStartedAt?: string | null;
  // v13.4 "처음부터 다시": 페이지가 새 회차를 시작한다(목적 비우기 포함). 없으면 버튼을 숨긴다.
  onRestart?: () => Promise<string | null>;
  // v14.3: 앱 홈의 「처음부터 다시 시작하기」로 들어오면 확인 창을 바로 열어 둔다(전에는 대화 화면만 열리고 다시 시작되지 않았다).
  restartPrompt?: boolean;
}
const DRAFT_MIN_CONFIRMED = 3;
type Editor = { insight: CoreInsight; kind: 'correct' | 'self'; text: string; rejected: boolean };
const FOLLOWUP_ENABLED = import.meta.env.VITE_ECHO_FOLLOWUP_ENABLED === 'true';
const categoryNames: Record<string, string> = { value: '소중한 기준', pattern: '반복되는 모습', memory: '기억해 둘 이야기' };

// v13.1: 서버가 저장한 질문은 "받아 주는 한 문장\n질문" 꼴일 수 있다. 첫 줄바꿈으로 나눈다. 줄바꿈이 없으면(예전 서버) 통째로 질문이다.
function splitQuestion(text: string): { ack: string; body: string } {
  const at = text.indexOf('\n');
  if (at < 0) return { ack: '', body: text };
  return { ack: text.slice(0, at).trim(), body: text.slice(at + 1).trim() || text };
}
// v14.1 서버가 준 주제(topic)의 사람이 읽는 이름. 주제가 없거나 예전 서버면 표시하지 않는다.
function topicLabel(topic: string | null | undefined): string | null {
  return TOPICS.find(t => t.id === topic)?.label ?? null;
}

// v14.1(대표 2026-09-22 "질문 다섯개면 상대방이 어떤 사람 원하는지 충분해 / 언제까지 내가 너랑 대화만 해야해?"):
// 대화에 끝을 만든다. 답을 다섯 개 남기면 이번 회차는 끝나고, 상대를 찾는 단계로 넘어간다.
// 이 숫자는 TOPICS(매칭에 쓰는 칸) 개수와 같다. 서버가 주제를 다 훑었는지와 무관하게 화면에서 확실히 끝낸다.
export const ASK_TOTAL = TOPICS.length;

// v13.5 첫 질문 기준 문장(대표 지시 2026-09-22 「당신이 잠든 사이」 §3). 감정·관계를 미리 단정하지 않는다. 그 뒤 질문은 전부 서버·AI 가 만든다.
export const FIRST_QUESTION = '당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요?';

function errorCopy(error: unknown): string {
  const code = error instanceof UnderstandingError ? error.code : '';
  if (code === 'STALE_REVISION' || code === 'STALE_CONTEXT') return '다른 화면에서 내용이 바뀌었어요. 최신 내용을 확인한 뒤 다시 선택해 주세요.';
  if (code === 'BAD_REQUEST' || code === 'SERVER_UPDATE_REQUIRED') return '지금은 이 기능을 쓸 수 없어요. 적어 둔 이야기는 그대로 있어요.';
  if (code === 'PENDING_INSIGHTS') return '위 문장이 맞는지 먼저 골라 주세요.';
  if (code === 'AI_NOT_CONFIGURED') return '지금은 AI와 이어지지 않아요. 적어 둔 이야기는 그대로 있어요.';
  if (code === 'RATE_LIMITED' || code === 'IN_FLIGHT') return '방금 보낸 걸 아직 처리하고 있어요. 잠깐 뒤에 다시 눌러 주세요.';
  if (code === 'UNAUTHORIZED') return '로그인 상태가 바뀌었어요. 다시 로그인한 뒤 이어가 주세요.';
  // v13: 저장 금지 입력(연락처·식별번호·링크·성적 표현)은 서버가 이유를 문장으로 준다. 적은 내용은 지우지 않는다.
  if (code === 'BLOCKED_CONTENT' && error instanceof UnderstandingError && error.message) return error.message;
  if (code === 'NOT_ENOUGH' && error instanceof UnderstandingError && error.message) return error.message;
  if (code === 'RESTART_FAILED' && error instanceof UnderstandingError && error.message) return error.message;
  return '아직 답을 받지 못했어요. 적은 건 그대로 있으니 한 번 더 눌러 주세요.';
}

// v13.1 질문 카드: 받아 주는 한 문장(작게) → 주제 이름 → 질문(크게). 질문 본문은 echo-question 하나로 남긴다(검사 계약).
// v14.1 진행 숫자(n / 5)는 화면 맨 위 한 곳에만 둔다. 두 군데서 다른 숫자가 나오면 오히려 헷갈린다.
// 컴포넌트가 아니라 그리기 함수다(qa 가짜 렌더러는 자식 컴포넌트를 호출하지 않는다).
function questionCard(question: CoreQuestion) {
  const { ack, body } = splitQuestion(question.text);
  const topic = topicLabel(question.topic);
  return <div className="echo-question-card">
    {ack && <p className="echo-ack">{ack}</p>}
    {topic && <p className="echo-topic">{topic}</p>}
    <p className="echo-question">{body}</p>
  </div>;
}

export default function CoreConversation({ userId, onContinue, initialMessage, autoQuestion = false, purposeLabel = null, onUseDraft, roundStartedAt = null, onRestart, restartPrompt = false }: Props) {
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
  const [draftLines, setDraftLines] = useState<CoreDraftLine[] | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [savedLookupFor, setSavedLookupFor] = useState<string | null>(null);
  // v14.3: 확인 창을 어디서 열었는지('top' = 화면 위, 'bottom' = 맨 아래). 누른 자리 바로 옆에 확인 창이 뜬다.
  const [restartArmed, setRestartArmed] = useState<false | 'top' | 'bottom' | 'done'>(restartPrompt ? 'top' : false);
  const lock = useRef(false);
  const alive = useRef(true);
  const questionVersion = useRef(0);
  const initialSent = useRef(false);
  const autoAsked = useRef<string | null>(null);
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
    // v13.4: 처음 열 때는 이번 회차의 최신 기록을 고른다(이전 회차 기록은 "다시 보기"로만).
    const firstOfRound = data.records.find(r => !roundStartedAt || !r.created_at || r.created_at >= roundStartedAt) ?? data.records[0];
    setActiveId(current => current && data.records.some(r => r.id === current) ? current : firstOfRound?.id ?? null);
    // 거절은 됐는데 저장하지 못한 직접 설명이 있으면 그 내용으로 입력 상자를 다시 연다(자동 저장은 하지 않는다).
    const pending = loadPendingSelf(userId);
    if (pending) {
      const found = data.insights.find(i => i.id === pending.insightId);
      const insight: CoreInsight = found ?? { id: pending.insightId, text: '', category: pending.category, status: 'rejected', origin: 'ai', source_record_id: pending.recordId, revision: 1, created_at: '' };
      setActiveId(pending.recordId);
      setEditor(previous => previous ?? { insight, kind: 'self', text: pending.text, rejected: insight.status === 'rejected' });
    }
  }, [api, userId, roundStartedAt]);
  useEffect(() => {
    if (!A_STRUCTURE_SERVER_ENABLED) return;
    setBusy('지난 이야기를 가져오고 있어요');
    void load().catch(e => { if (alive.current) setError(errorCopy(e)); }).finally(() => { if (alive.current) setBusy(null); });
  }, [load]);
  const questionContext = insights.map(i => `${i.id}:${i.revision}:${i.status}`).sort().join('|');
  useEffect(() => {
    if (!activeId || !A_STRUCTURE_SERVER_ENABLED || !FOLLOWUP_ENABLED) return;
    let current = true;
    const version = ++questionVersion.current;
    setFollowupQuestion(null);
    setSavedLookupFor(null);
    // followup_get restores only follow-up questions, not insight_generate rescue text.
    void api.savedQuestion(activeId).then(q => { if (current && alive.current && version === questionVersion.current) setFollowupQuestion(q); }).catch(() => { /* 이전 서버에는 질문 복원 계약이 없다. 질문을 만들거나 성공으로 표시하지 않는다. */ })
      .finally(() => { if (current && alive.current) setSavedLookupFor(`${activeId}|${questionContext}`); });
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
  // v13.4 회차 나누기: 이번 대화 / 이전 회차(다시 보기). 기록은 지우지 않는다.
  const roundRecords = roundStartedAt ? records.filter(r => !r.created_at || r.created_at >= roundStartedAt) : records;
  const pastRecords = roundStartedAt ? records.filter(r => !roundRecords.includes(r)) : [];
  const restart = () => onRestart && run('처음부터 다시 여는 중이에요', async () => {
    const failure = await onRestart();
    if (failure) throw new UnderstandingError('RESTART_FAILED', failure);
    if (alive.current) { setRestartArmed(false); setNotice('처음부터 다시 시작할게요. 지난 이야기는 지우지 않았어요.'); }
  });
  // v14(대표 2026-09-22 "맞아요 계속 눌러가면서 언제까지 해야 하냐"):
  // 확인 카드가 뜨면 입력이 아예 막혀서, 이야기를 이어가려면 매번 버튼을 눌러야 했다.
  // '나중에 고를게요' 로 이번 화면에서만 접어 둔다. 서버 상태(candidate)는 그대로라 나중에 다시 확인할 수 있다.
  const [deferred, setDeferred] = useState<string[]>([]);
  const candidates = insights.filter(i => i.status === 'candidate' && !deferred.includes(i.id));
  const current = candidates.find(i => i.source_record_id === activeId) ?? candidates[0];
  const remembered = insights.filter(i => i.status === 'confirmed' || i.status === 'corrected');
  const hasInsights = insights.some(i => i.source_record_id === activeId);
  const activeFollowup = followupQuestion?.sourceRecordId === activeId ? followupQuestion : null;
  const activeRescue = rescueQuestion?.sourceRecordId === activeId ? rescueQuestion : null;
  const question = hasInsights ? activeFollowup : activeRescue ?? activeFollowup;
  // v13.5(대표 지시 2026-09-22 §3): 이번 회차에 아직 아무 말도 없을 때 보이는 첫 질문 한 문장(유일한 고정 질문). 첫 화면에서 적은 한 줄이 곧 보내질 때는 숨긴다.
  // v14.1 이번 회차에 남긴 답의 개수 = 진행. 다섯 개를 채우면 질문을 멈춘다.
  const answered = Math.min(roundRecords.length, ASK_TOTAL);
  const finished = roundRecords.length >= ASK_TOTAL;
  const firstQuestion: CoreQuestion | null = loaded && !roundRecords.length && !question && !(initialMessage && !initialSent.current) ? { text: FIRST_QUESTION, sourceRecordId: '' } : null;
  // v13 자동 다음 질문(장면 5): 저장된 질문 조회가 끝났고 확인할 후보가 없으면 서버에 다음 질문을 한 번 요청한다. 같은 상태에서는 다시 요청하지 않는다.
  // v13.2(대표 지시 2026-09-22 "질문을 해야 내가 답을 하지"): 확인할 후보도 없고 보여 줄 질문도 없으면, 이해가 아직 없는 기록이라도 AI가 먼저 다음 질문을 한다. 빈 입력창만 두지 않는다.
  const autoKey = autoQuestion && FOLLOWUP_ENABLED && A_STRUCTURE_SERVER_ENABLED && active && !finished && !candidates.length && !editor && !question && loaded && !busy && savedLookupFor === `${activeId}|${questionContext}`
    ? savedLookupFor : null;
  useEffect(() => {
    if (!autoKey || autoAsked.current === autoKey || !active) return;
    autoAsked.current = autoKey;
    const recordId = active.id;
    void run('다음 질문을 고르고 있어요', async () => {
      const version = ++questionVersion.current;
      const next = await api.nextQuestion(recordId);
      if (alive.current && version === questionVersion.current) setFollowupQuestion(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);
  // v14.1: 서버가 내 답으로도 초안을 쓴다. 다섯 가지를 다 답했으면 맞다고 한 말이 적어도 보여 준다.
  const draftReady = !!onUseDraft && (remembered.length >= DRAFT_MIN_CONFIRMED || finished);
  const showDraft = () => run('내 답을 읽고 소개를 쓰고 있어요', async () => {
    const lines = await api.profileDraft();
    if (!alive.current) return;
    setDraftLines(lines); setDraftSaved(false);
  });
  const applyDraft = () => draftLines && onUseDraft && run('소개란에 넣는 중이에요', async () => {
    const failure = await onUseDraft(draftToIntro(draftLines));
    if (!alive.current) return;
    if (failure) { setError(failure); return; }
    setDraftSaved(true); setNotice('내 소개란에 넣었어요. 프로필에서 언제든 고칠 수 있어요.');
  });
  const latestEditing = editor ? insights.find(i => i.id === editor.insight.id) : undefined;
  const editorConflict = !!editor && !!latestEditing && latestEditing.revision !== editor.insight.revision && !(editor.kind === 'self' && latestEditing.status === 'rejected');
  // v13 저장 금지 입력: 서버(v13)가 막지만, 화면에서도 같은 규칙으로 먼저 알려 보내지 않는다(v12 서버에서도 동작). 적은 내용은 그대로 둔다.
  const assertStorable = (text: string) => {
    const reason = blockedContentReason(text);
    if (reason) throw new UnderstandingError('BLOCKED_CONTENT', blockedContentMessage(reason));
  };
  const sendText = async (text: string) => {
    assertStorable(text);
    // v13 되묻기: "무슨 뜻이에요?" 같은 말은 이야기가 아니라 앞 질문에 대한 되묻기다. 기록을 만들지 않고 앞 질문을 쉬운 말로 다시 받는다.
    // 서버가 규칙으로 다시 판정하므로 meta=false 가 오면 보통 이야기로 저장한다(사용자 말을 버리지 않는다).
    // v12 서버(되묻기 계약 없음)에서는 보통 이야기로 저장한다(막지 않는다).
    if (question && activeId && isMetaReply(text)) {
      let answer: Awaited<ReturnType<typeof api.rephrase>> = { meta: false };
      try { answer = await api.rephrase(question.text, text); }
      catch (e) { if (!(e instanceof UnderstandingError && (e.code === 'BAD_REQUEST' || e.code === 'SERVER_UPDATE_REQUIRED'))) throw e; }
      if (!alive.current) return;
      if (answer.meta) {
        const next = { text: answer.question, sourceRecordId: activeId };
        if (activeFollowup) setFollowupQuestion(next); else setRescueQuestion(next);
        setDraft('');
        setNotice(answer.fallback ? '같은 걸 묻는 거예요. 떠오르는 대로 짧게 적어도 돼요.' : '다른 말로 다시 물어볼게요.');
        return;
      }
    }
    const first = records.length === 0;
    const record = await api.record(text);
    if (!alive.current) return;
    setRecords(previous => [record, ...previous.filter(r => r.id !== record.id)]); setActiveId(record.id); setDraft(''); clearQuestions();
    setNotice('이야기를 저장했어요.');
    // 첫 이야기는 후보 1개만(장면 1: 내 말 카드 하나). 그 뒤는 서버 기본.
    const result = await api.generate(record.id, first ? 1 : undefined);
    if (!alive.current) return;
    setInsights(previous => [...result.insights, ...previous.filter(i => !result.insights.some(n => n.id === i.id))]);
    setRescueQuestion(result.rescue?.text ? { text: result.rescue.text, sourceRecordId: record.id, topic: typeof result.rescue.topic === 'string' ? result.rescue.topic : null } : null);
  };
  const send = () => run('방금 한 말을 읽고 있어요', () => sendText(draft));
  // v13: 첫 화면에서 덧붙인 한 줄을 불러오기 직후 한 번만 보낸다. 실패하면 입력 상자에 남겨 다시 보낼 수 있게 한다.
  useEffect(() => {
    if (!initialMessage || !loaded || initialSent.current || lock.current) return;
    initialSent.current = true;
    void run('방금 한 말을 읽고 있어요', () => sendText(initialMessage)).then(() => { if (alive.current && error) setDraft(initialMessage); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, loaded]);
  const retryGenerate = () => active && run('한 번 더 읽고 있어요', async () => {
    const result = await api.generate(active.id);
    if (!alive.current) return;
    await load();
    if (!alive.current) return;
    setRescueQuestion(result.rescue?.text ? { text: result.rescue.text, sourceRecordId: active.id, topic: typeof result.rescue.topic === 'string' ? result.rescue.topic : null } : null);
  });
  const react = (item: CoreInsight, decision: 'confirm' | 'reject') => run('내 답을 반영하고 있어요', async () => {
    const saved = await api.react(item, decision);
    if (!alive.current) return;
    merge(saved); clearQuestions();
    setNotice(decision === 'confirm' ? '맞다고 한 말로 저장했어요.' : '그 문장은 뺐어요. 처음 적은 이야기는 그대로 둘게요.');
  });
  const saveEditor = () => editor && !editorConflict && run('내 말로 바꾸고 있어요', async () => {
    assertStorable(editor.text);
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
    clearQuestions(); setEditor(null); setNotice('내 말로 바꿔 저장했어요.');
  });

  // 처음부터 다시: 확인 창은 한 가지 모양만 쓴다(위·아래 버튼 둘 다 이것을 연다).
  const restartConfirm = <div className="echo-restart" role="group" aria-label="처음부터 다시"><p className="echo-context">지금까지 이야기는 그대로 남고, 첫 질문부터 새로 시작해요. 다섯 가지를 다시 답할 때까지는 새 연결 후보에서 잠시 빠져요.</p><div className="echo-reactions"><button disabled={!!busy} onClick={() => void restart()}>처음부터 다시</button><button disabled={!!busy} onClick={() => setRestartArmed(false)}>계속 이어가기</button></div></div>;

  if (!A_STRUCTURE_SERVER_ENABLED) return <section className="echo-dialogue"><DoItSymbol decorative /><p className="echo-eyebrow">ECHO · 내 이야기</p><h1>나를 설명하는 말은,<br />내가 정할 수 있도록.</h1><p className="echo-lead">대화와 기억을 연결하는 마지막 확인을 하고 있어요. 지금은 내 소개와 사진을 준비할 수 있어요.</p>{onContinue ? <button className="echo-primary" onClick={onContinue}>내 프로필 준비하기 <ChevronRight size={18} /></button> : <Link className="echo-primary" to="/doit/start-journey">내 프로필 준비하기 <ChevronRight size={18} /></Link>}</section>;

  return <section className="echo-dialogue" aria-busy={!!busy}>
    {/* v14.2: 대화 안에서도 항상 홈으로 나갈 길을 둔다(대표 실기기: 들어오면 나갈 데가 없었다). */}
    <header className="echo-dialogue-header"><DoItSymbol decorative /><span>DO IT / ECHO</span><Link to="/doit/home">홈</Link><Link to="/doit/understanding">내가 맞다고 한 말</Link></header>
    {/* v14.1 진행은 항상 보인다. 몇 개 남았는지 모르는 게 지치는 원인이었다. */}
    {!finished && <div className="echo-steps" role="status" aria-label={`다섯 가지 중 ${answered}가지 답함`}>
      <span className="echo-steps-count">{Math.min(answered + 1, ASK_TOTAL)} <em>/ {ASK_TOTAL}</em></span>
      <span className="echo-steps-bar" aria-hidden="true"><i style={{ width: `${(answered / ASK_TOTAL) * 100}%` }} /></span>
    </div>}
    {/* v14.3(대표 실기기 "처음부터 다시 하기도 없어"): 맨 아래에만 있어서 화면 위에서는 보이지 않았다. 위에도 둔다. */}
    {/* 끝 화면에서는 아래 「처음부터 다시 답하기」 버튼이 같은 일을 하므로 위 버튼은 숨긴다(홈에서 ?restart=1 로 온 확인 창은 그대로 위에 뜬다). */}
    {onRestart && ((roundRecords.length > 0 && !finished) || restartArmed === 'top') && (restartArmed === 'top'
      ? restartConfirm
      : <div className="echo-restart-top"><button className="echo-restart-pill" disabled={!!busy || !!editor || !!restartArmed} onClick={() => setRestartArmed('top')}><RotateCcw size={14} aria-hidden="true" />처음부터 다시 하기</button></div>)}
    <p className="echo-eyebrow">{finished ? '다 들었어요' : roundRecords.length ? '대화 중' : '만나기 전에'}</p>
    {finished
      ? <h1>다섯 가지, 다 들었어요.<br />이제 나를 보여 줄 차례예요.</h1>
      : roundRecords.length
        ? <h1>{question ? <>잘 들었어요.<br />다음 질문이에요.</> : <>지난번 이야기에서<br />이어 갈게요.</>}</h1>
        : purposeLabel
          ? <h1>{purposeLabel}<br />다섯 가지만 물어볼게요.</h1>
          : <h1>다섯 가지만<br />물어볼게요.</h1>}
    {/* v14.1 시작 안내(대표 2026-09-22 "처음에 설명을 해 … 사용자가 이걸 해야 한다고 느끼게"). */}
    {!roundRecords.length && !finished && <div className="echo-brief">
      <p className="echo-brief-lead">여기에 답한 말로 <b>어떤 사람을 소개할지</b> 정해요.</p>
      <ul>
        <li><span>1</span>어떤 만남을 원하는지</li>
        <li><span>2</span>어떤 사람에게 끌리는지</li>
        <li><span>3</span>같이 뭘 하고 싶은지</li>
        <li><span>4</span>상대가 알면 좋을 내 모습</li>
        <li><span>5</span>어떻게 만나고 싶은지</li>
      </ul>
      <p className="echo-brief-fine">한 줄이면 충분해요. 딱 다섯 개만 묻고 끝낼게요.</p>
    </div>}
    {!finished && <p className="echo-lead">{question || firstQuestion ? '짧아도 괜찮아요. 떠오르는 대로 적어 주세요.' : '어떤 사람을 만나고 싶은지 편하게 적어 주세요. AI가 잘못 알아들으면 바로 고칠 수 있어요.'}</p>}
    {firstQuestion && !finished && questionCard(firstQuestion)}
    {roundRecords.length > 0 && <details className="echo-history"><summary>이번에 한 답 {roundRecords.length}개</summary><ol>{roundRecords.map(record => <li key={record.id}><button disabled={!!busy || !!editor} onClick={() => { setActiveId(record.id); setNotice(''); }}>{record.text}</button></li>)}</ol></details>}
    {pastRecords.length > 0 && <details className="echo-history echo-history--past"><summary>지난번 이야기 {pastRecords.length}개 보기</summary><ol>{pastRecords.map(record => <li key={record.id}><button disabled={!!busy || !!editor} onClick={() => { setActiveId(record.id); setNotice(''); }}>{record.text}</button></li>)}</ol></details>}
    {active && <div className="echo-original"><p className="echo-eyebrow">내가 남긴 말</p><p>{active.original_text || active.text}</p></div>}
    {current && !editor && <article className="echo-insight" key={current.id}>
      <span className="echo-insight-label">AI가 이렇게 들었어요</span>
      {current.source_record_id !== activeId && <p className="echo-context">지난 답에서 나온 문장이에요.</p>}
      <h2>{current.text}</h2><p className="echo-context">내 생각과 같나요?</p>
      <div className="echo-reactions">
        <button disabled={!!busy || !loaded} onClick={() => void react(current, 'confirm')}>맞아요</button>
        <button disabled={!!busy || !loaded} onClick={() => setEditor({ insight: current, kind: 'correct', text: '', rejected: false })}>조금 달라요</button>
        <button disabled={!!busy || !loaded} onClick={() => void react(current, 'reject')}>그게 아니에요</button>
        <button disabled={!!busy || !loaded} onClick={() => setEditor({ insight: current, kind: 'self', text: '', rejected: false })}>직접 설명할게요</button>
      </div>
      <button className="echo-defer" disabled={!!busy || !loaded} onClick={() => setDeferred(prev => prev.includes(current.id) ? prev : [...prev, current.id])}>나중에 고를게요</button>
      <p className="echo-fine">맞다고 하기 전까지는 나에 대한 사실로 쓰지 않아요.</p>
    </article>}
    {editor && <section className="echo-editor"><PencilLine size={20} /><h2>{editor.kind === 'correct' ? '어디가 다른지 알려 주세요.' : '내 말로 설명해 주세요.'}</h2><p className="echo-context">{editor.rejected ? 'AI가 들은 문장은 뺐어요. 이제 내 말로 적어 주세요.' : '저장하면 바로 바뀌어요.'}</p>{editorConflict && latestEditing && <div className="echo-error"><p>다른 화면에서 바뀐 설명: {latestEditing.text}</p><p>적어 둔 내용은 그대로 남겨뒀어요. 최신 설명을 확인한 뒤 다시 저장해 주세요.</p>{latestEditing.status !== 'rejected' && <button onClick={() => setEditor({ ...editor, insight: latestEditing })}>최신 설명을 확인했어요</button>}</div>}<label htmlFor="echo-correction" className="sr-only">내 설명</label><textarea id="echo-correction" maxLength={200} value={editor.text} disabled={!!busy} onChange={event => setEditor({ ...editor, text: event.target.value })} autoFocus rows={4} /><div className="echo-editor-footer"><span>{editor.text.length}/200</span><button disabled={!!busy} onClick={() => setEditor(null)}>닫기</button></div><button className="echo-primary" disabled={!!busy || !editor.text.trim() || editorConflict} onClick={() => void saveEditor()}>이렇게 저장할게요 <Check size={18} /></button></section>}
    {notice && <p className="echo-notice" role="status"><Check size={16} />{notice}</p>}
    {error && <div className="echo-error" role="alert"><p>{error}</p>{!loaded && <button disabled={!!busy} onClick={() => void run('다시 불러오고 있어요', load)}>다시 불러오기</button>}</div>}
    {busy && <div className="echo-thinking" role="status"><SymbolLoader size={64} /><p>{busy}</p></div>}
    {active && !finished && !hasInsights && !question && !busy && <button className="echo-secondary" disabled={!loaded} onClick={() => void retryGenerate()}>저장한 이야기 다시 살펴보기</button>}
    {/* v14.1 다섯 가지를 다 들었으면 여기서 끝낸다. 더 묻지 않는다. */}
    {finished && !editor && <section className="echo-done">
      <p className="echo-done-mark"><Check size={18} /> 다섯 가지 답을 모두 저장했어요.</p>
      <p className="echo-done-lead">다음은 나를 보여 줄 차례예요. 사진·소개·전화 인증까지 마치면 연결을 받을 수 있어요.</p>
      <ol className="echo-done-next">
        <li><b>사진 세 장</b>, <b>짧은 소개</b>, <b>전화 인증</b>이 남았어요. 연결 탭에서 무엇이 남았는지 볼 수 있어요.</li>
        <li>상대의 이름과 사진은 서로 첫 질문을 주고받은 뒤에 보여요.</li>
        <li>첫 100명은 대표가 직접 확인한 뒤 연결돼요.</li>
      </ol>
      <div className="echo-done-actions">
        {onContinue
          ? <button className="echo-primary" disabled={!!busy} onClick={onContinue}>사진과 소개 채우기 <ChevronRight size={18} /></button>
          : <Link className="echo-primary" to="/doit/start-journey?edit=profile">사진과 소개 채우기 <ChevronRight size={18} /></Link>}
        <Link className="echo-secondary" to="/doit/connections">연결까지 남은 것 보기 <ChevronRight size={18} /></Link>
        {/* 2026-09-24 대표 실기기 "처음부터 다시 하고 싶은 사람도 있어": 끝 화면에도 바로 보이는 버튼으로 둔다. */}
        {onRestart && (restartArmed === 'done'
          ? restartConfirm
          : <button className="echo-secondary" disabled={!!busy || !!restartArmed} onClick={() => setRestartArmed('done')}>처음부터 다시 답하기</button>)}
      </div>
      <p className="echo-fine">지금까지 답은 지우지 않아요. 「지난번 이야기」에서 다시 볼 수 있어요.</p>
    </section>}
    {FOLLOWUP_ENABLED && active && !finished && !candidates.length && !editor && <div className="echo-next">{question ? questionCard(question) : <button className="echo-secondary" disabled={!!busy || !loaded} onClick={() => void run('다음 질문을 고르고 있어요', async () => { const version = ++questionVersion.current; const next = await api.nextQuestion(active.id); if (alive.current && version === questionVersion.current) setFollowupQuestion(next); })}>이어서 이야기하기 <ChevronRight size={18} /></button>}</div>}
    {!FOLLOWUP_ENABLED && question && questionCard(question)}
    {!editor && !finished && <form className="echo-composer" onSubmit={event => { event.preventDefault(); if (loaded && draft.trim() && !busy && !candidates.length) void send(); }}><label htmlFor="echo-message">{active ? '이어서 적기' : '어떤 사람을 만나고 싶은지 편하게 적어 주세요.'}</label><textarea id="echo-message" value={draft} onChange={event => setDraft(event.target.value)} placeholder="생각나는 대로 한 줄" maxLength={2000} rows={4} disabled={!!busy || !loaded || !!candidates.length} /><div className="echo-composer-footer"><span>{candidates.length ? '위 문장이 맞는지 먼저 골라 주세요. 「나중에 고를게요」를 누르면 바로 이어서 적을 수 있어요.' : '적은 말은 나만 봐요. 프로필에 저절로 올라가지 않아요.'}</span><button type="submit" aria-label="이야기 보내기" disabled={!!busy || !loaded || !draft.trim() || !!candidates.length}><ArrowUp size={20} /></button></div></form>}
    {draftReady && !editor && !candidates.length && <section className="echo-draft">{draftLines
      ? <><p className="echo-eyebrow">내 답과 맞다고 한 말로 쓴 소개 초안</p><ul>{draftLines.map(line => <li key={line.text}><p>{line.text}</p><span>근거: {line.basis}</span></li>)}</ul><div className="echo-reactions">{!draftSaved && <button disabled={!!busy} onClick={() => void applyDraft()}>소개란에 넣기</button>}<button disabled={!!busy} onClick={() => void showDraft()}>다시 만들기</button><button disabled={!!busy} onClick={() => setDraftLines(null)}>닫기</button></div><p className="echo-fine">확인하지 않은 AI 추측과 아니라고 한 말은 넣지 않아요. 넣은 뒤에도 프로필에서 고칠 수 있어요.</p></>
      : <button className="echo-secondary" disabled={!!busy || !loaded} onClick={() => void showDraft()}>AI가 내 답으로 소개 써 보기 <ChevronRight size={18} /></button>}</section>}
    {remembered.length > 0 && <details className="echo-memory"><summary>내가 맞다고 한 말 {remembered.length}개</summary>{remembered.map(item => <div key={item.id}><span>{item.origin === 'self' ? '직접 설명' : item.status === 'corrected' ? '내가 고친 설명' : categoryNames[item.category] ?? '맞다고 한 말'}</span><p>{item.text}</p><button className="echo-text-button" disabled={!!busy || !!editor} onClick={() => setEditor({ insight: item, kind: 'correct', text: item.text, rejected: false })}>지금의 나에 맞게 고치기</button></div>)}</details>}
    <footer className="echo-dialogue-footer">{onContinue ? <button className="echo-secondary" disabled={!!busy || !!editor} onClick={onContinue}>사진과 소개 채우기 <ChevronRight size={18} /></button> : <Link className="echo-secondary" to="/doit/start-journey?edit=profile">사진과 소개 채우기 <ChevronRight size={18} /></Link>}<Link className="echo-secondary" to="/doit/connections">당신이 잠든 사이 · 연결 준비 보기 <ChevronRight size={18} /></Link>{onRestart && (restartArmed === 'bottom'
      ? restartConfirm
      : <button className="echo-restart-pill" disabled={!!busy || !!editor || !!restartArmed} onClick={() => setRestartArmed('bottom')}><RotateCcw size={14} aria-hidden="true" />처음부터 다시 시작하기</button>)}<p className="echo-fine">{finished ? '이번 대화는 여기까지예요. 다시 하고 싶으면 「처음부터 다시」를 눌러 주세요.' : `질문은 ${ASK_TOTAL}개뿐이에요.`}</p></footer>
  </section>;
}
