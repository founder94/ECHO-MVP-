// 서버 응답을 그대로 사용한다. 이 파일은 질문이나 성향을 만들어 내지 않는다.
export interface CoreRecord { id: string; text: string; original_text: string; status: string; revision: number; created_at: string }
export interface CoreInsight { id: string; text: string; ai_text?: string; category: string; status: string; origin: string; source_record_id: string; revision: number; created_at: string }
// v13.5 strategy: 서버가 정한 다음 질문 전략 이름(화면은 표시하지 않고 보관만 한다. 없으면 예전 서버).
export interface CoreQuestion { text: string; sourceRecordId: string; topic?: string | null; strategy?: string | null }
// v13: 되묻기 응답. meta=false 면 되묻기가 아니므로 화면은 보통 이야기로 저장한다.
// v14.4: kind "ask" = 사용자가 AI 에게 한 질문. 서버가 먼저 답(reply)하고 같은 질문(question)을 다시 건넨다. 기록을 만들지 않는다.
export type CoreRephrase = { meta: false } | { meta: true; kind: 'rephrase' | 'ask'; question: string; reply?: string; fallback: boolean };
// v14.4: 질문 본문(받아 주는 첫 줄 제외). 서버 questionBody 와 같은 규칙 — 저장 형식 "ack\n질문".
export function questionBodyOf(text: string): string {
  const parts = text.trim().split('\n');
  return (parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? '').trim();
}
// v15: 한 턴 분류(서버 turn_classify). 관계에 대한 답인지(answer·unsure·설명 붙은 correction), 대화 방식에 대한 말인지.
//   ask = reply(먼저 답) + question(같은 질문) · meta = question(더 쉬운 말) · complaint·fatigue·설명 없는 correction = reply(상태 안내).
export type TurnKind = 'answer' | 'ask' | 'meta' | 'complaint' | 'fatigue' | 'unsure' | 'correction';
// v15.1 again = 정정 안내를 이미 보였는데 또 설명 없는 "아니에요"(되풀이하지 않고 넘어간다) · rejected = 거절한 AI 문장이 서버에 저장됐는지.
export interface CoreTurn { kind: TurnKind; reply?: string; question?: string | null; rest?: string; fallback?: boolean; again?: boolean; rejected?: boolean }
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
    // v15 opts.skip = 「다른 질문 받기」·불만 뒤 같은 답에서 새 질문 · opts.correction = 사용자가 "그 뜻 아니야"라고 한 AI 문장(정정 전 문장으로 쓰지 않게).
    async nextQuestion(recordId: string, answeredQuestion?: string | null, opts: { skip?: boolean; correction?: string | null } = {}) {
      const result = await port.write<{ question: CoreQuestion; topic?: string | null; strategy?: string | null }>({ action: 'followup_generate', recordId, ...(answeredQuestion ? { answeredQuestion: questionBodyOf(answeredQuestion) } : {}), ...(opts.skip ? { skip: true } : {}), ...(opts.correction ? { correction: opts.correction } : {}) });
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
    // v14.3 지금 묻던 주제(topic)를 함께 보낸다. v14.4 서버는 AI 가 못 하면 앞 질문을 그대로 돌려준다(주제를 바꾸지 않는다).
    // v14.4 AI 에게 한 질문이면 kind "ask" + reply(먼저 답) + question(같은 질문).
    async rephrase(question: string, text: string, topic?: string | null): Promise<CoreRephrase> {
      if (!question.trim() || !text.trim()) throw new Error('INVALID_INPUT');
      const result = await port.write<{ meta: boolean; kind?: string; question?: string; reply?: string; fallback?: boolean }>({ action: 'rephrase', question: question.trim(), text: text.trim(), ...(topic ? { topic } : {}) });
      if (typeof result.meta !== 'boolean') throw new Error('INVALID_RESPONSE');
      if (!result.meta) return { meta: false };
      if (typeof result.question !== 'string' || !result.question.trim()) throw new Error('INVALID_RESPONSE');
      if (result.kind === 'ask') {
        if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('INVALID_RESPONSE');
        return { meta: true, kind: 'ask', question: result.question.trim(), reply: result.reply.trim(), fallback: result.fallback === true };
      }
      return { meta: true, kind: 'rephrase', question: result.question.trim(), fallback: result.fallback === true };
    },
    // v15 한 턴 분류. 서버가 저장하지 않는다. 화면은 이 결과로 기록할지(answer·unsure·설명 붙은 correction) 정한다.
    // v15.1 correction = 지금 떠 있는 AI 문장(받아 주는 첫 줄 또는 질문). "그게 아니에요"면 서버가 설명을 묻기 전에 이 문장을 거절로 저장한다.
    async classify(text: string, question: string | null, opts: { correction?: string | null; recordId?: string | null } = {}): Promise<CoreTurn> {
      if (!text.trim()) throw new Error('INVALID_INPUT');
      const result = await port.write<{ kind?: string; reply?: string; question?: string | null; rest?: string; fallback?: boolean; again?: boolean; rejected?: boolean }>({ action: 'turn_classify', text: text.trim(), ...(question ? { question } : {}),
        ...(opts.correction ? { correction: opts.correction } : {}), ...(opts.recordId ? { recordId: opts.recordId } : {}) });
      const kinds: TurnKind[] = ['answer', 'ask', 'meta', 'complaint', 'fatigue', 'unsure', 'correction'];
      if (typeof result.kind !== 'string' || !kinds.includes(result.kind as TurnKind)) throw new Error('INVALID_RESPONSE');
      const kind = result.kind as TurnKind;
      if (kind === 'ask' && (typeof result.reply !== 'string' || !result.reply.trim())) throw new Error('INVALID_RESPONSE');
      if (kind === 'meta' && (typeof result.question !== 'string' || !result.question.trim())) throw new Error('INVALID_RESPONSE');
      return { kind, ...(typeof result.reply === 'string' ? { reply: result.reply.trim() } : {}), ...(typeof result.question === 'string' ? { question: result.question.trim() } : {}),
        ...(typeof result.rest === 'string' ? { rest: result.rest.trim() } : {}), ...(result.fallback === true ? { fallback: true } : {}),
        ...(result.again === true ? { again: true } : {}), ...(result.rejected === true ? { rejected: true } : {}) };
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
