// 서버 응답을 그대로 사용한다. 이 파일은 질문이나 성향을 만들어 내지 않는다.
export interface CoreRecord { id: string; text: string; original_text: string; status: string; revision: number; created_at: string }
export interface CoreInsight { id: string; text: string; ai_text?: string; category: string; status: string; origin: string; source_record_id: string; revision: number; created_at: string }
// v13.5 strategy: 서버가 정한 다음 질문 전략 이름(화면은 표시하지 않고 보관만 한다. 없으면 예전 서버).
export interface CoreQuestion { text: string; sourceRecordId: string; topic?: string | null; strategy?: string | null }
// v14.4: 질문 본문(받아 주는 첫 줄 제외). 서버 questionBody 와 같은 규칙 — 저장 형식 "ack\n질문".
export function questionBodyOf(text: string): string {
  const parts = text.trim().split('\n');
  return (parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? '').trim();
}
// v15·v16 말의 종류. answer·unsure·설명 붙은 correction 만 답으로 저장된다(서버가 분류를 끝낸 뒤).
export type TurnKind = 'answer' | 'ask' | 'meta' | 'complaint' | 'fatigue' | 'unsure' | 'correction';
// v16 한 턴(서버 action "turn") 결과. 서버가 저장 여부·다음 질문을 정한다. 이 파일은 질문을 만들지 않는다.
//   saved = 답으로 저장됨(record) · question = 다음 질문(없으면 null) · reply = 짧은 안내(AI 에게 한 질문의 답·정정 안내·쉬어 가기)
//   pause = 지친 말 · finished = 이번 회차 다섯 칸이 찼다 · questionError = 답은 저장됐지만 다음 질문을 못 만들었다(「다음 질문 받기」로 다시)
export interface CoreTurnResult { kind: TurnKind; saved: boolean; record: CoreRecord | null; question: CoreQuestion | null; reply?: string; pause?: boolean; finished?: boolean; again?: boolean; rejected?: boolean; questionError?: string }
// text = 사용자가 적은 말 · recordId = 지금 이어 가는 기록(「다음 질문 받기」·「다른 질문 받기」의 기준) · asAnswer = 「이 말은 답으로 남길게요」(사용자 선택)
// correction = 지금 떠 있는 AI 문장("그게 아니에요"면 서버가 거절로 저장) · pendingCorrection = 앞에서 아니라고 한 AI 문장(다음 답의 정정 전 문장)
// recent(v1.1) = 이번 대화의 최근 말(저장 안 한 되묻기·문제제기 포함). 서버는 사실로 쓰지 않고 다음 말을 만들 맥락으로만 쓴다(DB 저장 0).
export interface CoreRecentTurn { question: string | null; text: string; saved: boolean; kind: TurnKind | null }
export interface CoreTurnInput { text?: string; answeredQuestion?: string | null; recordId?: string | null; skip?: boolean; asAnswer?: boolean; correction?: string | null; pendingCorrection?: string | null; recent?: CoreRecentTurn[] }
const TURN_KINDS: TurnKind[] = ['answer', 'ask', 'meta', 'complaint', 'fatigue', 'unsure', 'correction'];
// v15: 다섯 답 뒤 통합 이해 카드. items = 확인을 기다리는 AI 항목(서버가 저장한 후보). done = 이번 회차 카드를 이미 다 정함.
export interface CoreSynthesis { items: CoreInsight[]; done: boolean; empty: boolean }
// v13: 확인한 말로만 만든 소개 초안. 서버가 저장하지 않으며 화면에서 '이 초안 쓰기'로 프로필에 넣는다.
export interface CoreDraftLine { text: string; basis: string }
export interface CorePort {
  read: <T>(body: Record<string, unknown>) => Promise<T>;
  write: <T>(body: Record<string, unknown>) => Promise<T>;
}
function validInsight(item: CoreInsight): boolean {
  return !!item && typeof item.id === 'string' && !!item.id && typeof item.text === 'string' && !!item.text.trim()
    && typeof item.source_record_id === 'string' && Number.isInteger(item.revision) && item.revision > 0
    && ['candidate', 'confirmed', 'corrected', 'rejected'].includes(item.status)
    && ['value', 'pattern', 'memory'].includes(item.category) && ['ai', 'self'].includes(item.origin);
}
function validQuestion(question: CoreQuestion | null | undefined, recordId: string): question is CoreQuestion {
  return !!question && typeof question.text === 'string' && !!question.text.trim() && question.sourceRecordId === recordId;
}
export function createCoreConversation(port: CorePort) {
  // v16 한 턴. 새 앱은 말하기·다음 질문 받기·다른 질문 받기를 모두 이것으로 한다(서버가 분류·저장·질문을 한 번에).
  const turn = async (input: CoreTurnInput): Promise<CoreTurnResult> => {
    const raw = input.text ?? '';
    const text = raw.trim();
    if ((!text && !input.recordId) || raw.length > 2000) throw new Error('INVALID_INPUT');
    const result = await port.write<{ kind?: string; saved?: boolean; record?: CoreRecord | null; question?: CoreQuestion | null; reply?: string; pause?: boolean; finished?: boolean; again?: boolean; rejected?: boolean; questionError?: string }>({
      action: 'turn', ...(text ? { text, originalText: raw } : {}), ...(input.answeredQuestion ? { answeredQuestion: questionBodyOf(input.answeredQuestion) } : {}),
      ...(input.recordId ? { recordId: input.recordId } : {}), ...(input.skip ? { skip: true } : {}), ...(input.asAnswer ? { asAnswer: true } : {}),
      ...(input.correction ? { correction: input.correction } : {}), ...(input.pendingCorrection ? { pendingCorrection: input.pendingCorrection } : {}),
      ...(input.recent?.length ? { recent: input.recent } : {}),
    });
    if (typeof result.kind !== 'string' || !TURN_KINDS.includes(result.kind as TurnKind) || typeof result.saved !== 'boolean') throw new Error('INVALID_RESPONSE');
    const record = result.saved ? result.record ?? null : null;
    if (result.saved && !(record && typeof record.id === 'string' && !!record.id && typeof record.text === 'string' && Number.isInteger(record.revision))) throw new Error('INVALID_RESPONSE');
    const question = result.question ?? null;
    if (question && (typeof question.text !== 'string' || !question.text.trim() || typeof question.sourceRecordId !== 'string')) throw new Error('INVALID_RESPONSE');
    if (question && record && question.sourceRecordId !== record.id) throw new Error('INVALID_RESPONSE');
    return { kind: result.kind as TurnKind, saved: result.saved, record, question,
      ...(typeof result.reply === 'string' ? { reply: result.reply.trim() } : {}), ...(result.pause === true ? { pause: true } : {}), ...(result.finished === true ? { finished: true } : {}),
      ...(result.again === true ? { again: true } : {}), ...(result.rejected === true ? { rejected: true } : {}), ...(typeof result.questionError === 'string' ? { questionError: result.questionError } : {}) };
  };
  return {
    turn,
    async load() {
      const [r, i] = await Promise.all([
        port.read<{ records: CoreRecord[] }>({ action: 'record_list' }),
        port.read<{ insights: CoreInsight[] }>({ action: 'insight_list' }),
      ]);
      if (!Array.isArray(r.records) || !Array.isArray(i.insights) || !i.insights.every(validInsight) || !r.records.every(record => typeof record.id === 'string' && !!record.id && typeof record.text === 'string' && Number.isInteger(record.revision) && record.revision > 0)) throw new Error('INVALID_RESPONSE');
      return { records: r.records, insights: i.insights };
    },
    async record(text: string) {
      const trimmed = text.trim();
      if (!trimmed || text.length > 2000) throw new Error('INVALID_INPUT');
      const result = await port.write<{ record: CoreRecord }>({ action: 'record_create', text: trimmed, originalText: text, emotion: '', status: 'confirmed' });
      if (!result.record?.id) throw new Error('INVALID_RESPONSE');
      return result.record;
    },
    // limit: 첫 이야기는 후보 1개(장면 1 = 내 말 카드 하나), 그 뒤는 서버 기본(최대 3개). 서버(v12+)가 자른다.
    // v14.4 answeredQuestion: 사용자가 이 답을 적을 때 화면에 떠 있던 질문(서버가 직전 질문으로 쓴다 — 맥락 참고용).
    async generate(recordId: string, limit?: 1 | 3, answeredQuestion?: string | null) {
      // v13.1 서버는 구제 질문에도 다음 주제(topic)를 붙인다. 예전 서버는 없다(있을 때만 쓴다).
      // v13.5 서버는 구제에 kind 를 내려보내지 않는다(내부 종류). 예전 서버가 보내도 쓰지 않는다.
      const result = await port.write<{ insights: CoreInsight[]; rescue?: { text: string; topic?: string | null; strategy?: string | null } }>({ action: 'insight_generate', recordId, ...(limit ? { limit } : {}), ...(answeredQuestion ? { answeredQuestion: questionBodyOf(answeredQuestion) } : {}) });
      if (!Array.isArray(result.insights) || !result.insights.every(item => validInsight(item) && item.source_record_id === recordId)
        || (result.rescue && (typeof result.rescue.text !== 'string' || !result.rescue.text.trim()))) throw new Error('INVALID_RESPONSE');
      return result;
    },
    async react(insight: CoreInsight, decision: 'confirm' | 'correct' | 'reject', text?: string) {
      if (decision === 'correct' && (!text?.trim() || text.trim().length > 200)) throw new Error('INVALID_INPUT');
      const result = await port.write<{ insight: CoreInsight }>({ action: `insight_${decision}`, id: insight.id, expectedRevision: insight.revision, ...(decision === 'correct' ? { text: text!.trim() } : {}) });
      if (!validInsight(result.insight) || result.insight.id !== insight.id) throw new Error('INVALID_RESPONSE');
      return result.insight;
    },
    async explain(recordId: string, category: string, text: string) {
      if (!text.trim() || text.trim().length > 200) throw new Error('INVALID_INPUT');
      const result = await port.write<{ insight: CoreInsight }>({ action: 'insight_self', recordId, category, text: text.trim() });
      if (!validInsight(result.insight) || result.insight.source_record_id !== recordId || result.insight.origin !== 'self') throw new Error('INVALID_RESPONSE');
      return result.insight;
    },
    // v16 「다음 질문 받기」(skip 없음 · 저장된 질문이 있으면 서버가 그것을 돌려준다) · 「다른 질문 받기」(skip). 둘 다 한 턴(turn)으로 보낸다.
    async nextQuestion(recordId: string, answeredQuestion?: string | null, opts: { skip?: boolean } = {}) {
      const result = await turn({ recordId, answeredQuestion, skip: opts.skip });
      if (!validQuestion(result.question, recordId)) throw new Error('INVALID_RESPONSE');
      return result.question;
    },
    async savedQuestion(recordId: string) {
      const result = await port.read<{ question: CoreQuestion | null }>({ action: 'followup_get', recordId });
      if (result.question === null) return null;
      if (!validQuestion(result.question, recordId)) throw new Error('INVALID_RESPONSE');
      return result.question;
    },
    // v15 통합 이해 카드. 확인을 기다리는 카드가 있으면 서버는 그것을 돌려주고 다시 만들지 않는다.
    async synthesize(): Promise<CoreSynthesis> {
      const result = await port.write<{ items?: CoreInsight[]; done?: boolean; empty?: boolean }>({ action: 'synthesis_generate' });
      if (!Array.isArray(result.items) || !result.items.every(validInsight)) throw new Error('INVALID_RESPONSE');
      return { items: result.items, done: result.done === true, empty: result.empty === true };
    },
    async decideSynthesis(decision: 'confirm' | 'reject', ids: string[]): Promise<CoreInsight[]> {
      if (!ids.length) throw new Error('INVALID_INPUT');
      const result = await port.write<{ insights?: CoreInsight[] }>({ action: 'synthesis_decide', decision, ids });
      if (!Array.isArray(result.insights) || !result.insights.every(validInsight)) throw new Error('INVALID_RESPONSE');
      return result.insights;
    },
    async reviseSynthesis(text: string): Promise<{ self: CoreInsight | null; items: CoreInsight[] }> {
      if (!text.trim() || text.trim().length > 200) throw new Error('INVALID_INPUT');
      const result = await port.write<{ self?: CoreInsight | null; items?: CoreInsight[] }>({ action: 'synthesis_revise', text: text.trim() });
      if (!Array.isArray(result.items) || !result.items.every(validInsight) || (result.self && !validInsight(result.self))) throw new Error('INVALID_RESPONSE');
      return { self: result.self ?? null, items: result.items };
    },
    // v13: 소개 초안. 서버가 확인한 말에서 인용한 근거가 있는 줄만 돌려준다. 여기서 문장을 만들거나 고치지 않는다.
    async profileDraft(): Promise<CoreDraftLine[]> {
      const result = await port.write<{ lines: CoreDraftLine[] }>({ action: 'profile_draft' });
      if (!Array.isArray(result.lines) || !result.lines.length || !result.lines.every(line => line && typeof line.text === 'string' && !!line.text.trim() && typeof line.basis === 'string')) throw new Error('INVALID_RESPONSE');
      return result.lines.map(line => ({ text: line.text.trim(), basis: line.basis }));
    },
  };
}
