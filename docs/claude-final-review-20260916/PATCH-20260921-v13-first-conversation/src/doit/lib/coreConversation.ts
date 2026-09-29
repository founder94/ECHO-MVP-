// 서버 응답을 그대로 사용한다. 이 파일은 질문이나 성향을 만들어 내지 않는다.
export interface CoreRecord { id: string; text: string; original_text: string; status: string; revision: number; created_at: string }
export interface CoreInsight { id: string; text: string; ai_text?: string; category: string; status: string; origin: string; source_record_id: string; revision: number; created_at: string }
// v13.5 strategy: 서버가 정한 다음 질문 전략 이름(화면은 표시하지 않고 보관만 한다. 없으면 예전 서버).
export interface CoreQuestion { text: string; sourceRecordId: string; topic?: string | null; strategy?: string | null }
// v13: 되묻기 응답. meta=false 면 되묻기가 아니므로 화면은 보통 이야기로 저장한다.
export type CoreRephrase = { meta: false } | { meta: true; question: string; fallback: boolean };
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
  return {
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
    async generate(recordId: string, limit?: 1 | 3) {
      // v13.1 서버는 구제 질문에도 다음 주제(topic)를 붙인다. 예전 서버는 없다(있을 때만 쓴다).
      // v13.5 서버는 구제에 kind 를 내려보내지 않는다(내부 종류). 예전 서버가 보내도 쓰지 않는다.
      const result = await port.write<{ insights: CoreInsight[]; rescue?: { text: string; topic?: string | null; strategy?: string | null } }>({ action: 'insight_generate', recordId, ...(limit ? { limit } : {}) });
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
    async nextQuestion(recordId: string) {
      const result = await port.write<{ question: CoreQuestion; topic?: string | null; strategy?: string | null }>({ action: 'followup_generate', recordId });
      if (!validQuestion(result.question, recordId)) throw new Error('INVALID_RESPONSE');
      // 서버 질문 객체를 그대로 쓴다. v13 서버가 방향(topic)·전략(strategy)을 주면 그때만 덧붙인다.
      const extra = { ...(typeof result.topic === 'string' ? { topic: result.topic } : {}), ...(typeof result.strategy === 'string' ? { strategy: result.strategy } : {}) };
      return Object.keys(extra).length ? { ...result.question, ...extra } : result.question;
    },
    async savedQuestion(recordId: string) {
      const result = await port.read<{ question: CoreQuestion | null }>({ action: 'followup_get', recordId });
      if (result.question === null) return null;
      if (!validQuestion(result.question, recordId)) throw new Error('INVALID_RESPONSE');
      return result.question;
    },
    // v13: 되묻기. 서버가 규칙으로 다시 판정하므로 meta=false 가 올 수 있다(그때는 보통 이야기로 저장한다).
    async rephrase(question: string, text: string): Promise<CoreRephrase> {
      if (!question.trim() || !text.trim()) throw new Error('INVALID_INPUT');
      const result = await port.write<{ meta: boolean; question?: string; fallback?: boolean }>({ action: 'rephrase', question: question.trim(), text: text.trim() });
      if (typeof result.meta !== 'boolean') throw new Error('INVALID_RESPONSE');
      if (!result.meta) return { meta: false };
      if (typeof result.question !== 'string' || !result.question.trim()) throw new Error('INVALID_RESPONSE');
      return { meta: true, question: result.question.trim(), fallback: result.fallback === true };
    },
    // v13: 소개 초안. 서버가 확인한 말에서 인용한 근거가 있는 줄만 돌려준다. 여기서 문장을 만들거나 고치지 않는다.
    async profileDraft(): Promise<CoreDraftLine[]> {
      const result = await port.write<{ lines: CoreDraftLine[] }>({ action: 'profile_draft' });
      if (!Array.isArray(result.lines) || !result.lines.length || !result.lines.every(line => line && typeof line.text === 'string' && !!line.text.trim() && typeof line.basis === 'string')) throw new Error('INVALID_RESPONSE');
      return result.lines.map(line => ({ text: line.text.trim(), basis: line.basis }));
    },
  };
}
