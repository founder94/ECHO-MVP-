// 서버 응답을 그대로 사용한다. 이 파일은 질문이나 성향을 만들어 내지 않는다.
export interface CoreRecord { id: string; text: string; original_text: string; status: string; revision: number; created_at: string }
export interface CoreInsight { id: string; text: string; ai_text?: string; category: string; status: string; origin: string; source_record_id: string; revision: number; created_at: string }
export interface CoreQuestion { text: string; sourceRecordId: string }
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
    // limit: 서버(v9b)가 생성→검사→자른 뒤 저장·반환·캐시를 같은 목록으로 한다. 서버가 v8 이면 무시된다. 화면에서 숨기지 않는다.
    async generate(recordId: string, limit?: number) {
      const result = await port.write<{ insights: CoreInsight[]; rescue?: { text: string; kind: string } }>({ action: 'insight_generate', recordId, ...(Number.isInteger(limit) && limit! >= 1 && limit! <= 3 ? { limit } : {}) });
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
      const result = await port.write<{ question: CoreQuestion }>({ action: 'followup_generate', recordId });
      if (!validQuestion(result.question, recordId)) throw new Error('INVALID_RESPONSE');
      return result.question;
    },
    async savedQuestion(recordId: string) {
      const result = await port.read<{ question: CoreQuestion | null }>({ action: 'followup_get', recordId });
      if (result.question === null) return null;
      if (!validQuestion(result.question, recordId)) throw new Error('INVALID_RESPONSE');
      return result.question;
    },
  };
}
