import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/doit/hooks/useAuth';
import {
  A_STRUCTURE_SERVER_ENABLED,
  UnderstandingError,
  prepareUnderstandingRequest,
  understandingRequest,
} from '@/doit/lib/understandingApi';
import type {
  Category,
  EntryStatus,
  FirstRecord,
  Insight,
  RecordDecision,
  RecordDraft,
} from '@/doit/hooks/useUnderstanding';

// 서버(엣지 함수 doit-understanding → DB 함수 doit_apply_*)가 돌려주는 행은 snake_case.
// 화면용 camelCase 타입으로 변환한다. 원문·수정본·상태·revision(낙관 잠금 기준)을 보존한다.
type Row = Record<string, unknown>;

function mapRecord(row: Row): FirstRecord {
  const status: RecordDecision =
    row.status === 'corrected' || row.status === 'rejected' || row.status === 'confirmed'
      ? row.status
      : 'confirmed';
  const text = typeof row.text === 'string' ? row.text : '';
  return {
    id: String(row.id ?? ''),
    text,
    originalText: typeof row.original_text === 'string' ? row.original_text : text,
    emotion: typeof row.emotion === 'string' ? row.emotion : '',
    status,
    revision: typeof row.revision === 'number' ? row.revision : 1,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function mapInsight(row: Row): Insight {
  const category: Category =
    row.category === 'value' || row.category === 'pattern' || row.category === 'memory'
      ? row.category
      : 'value';
  const status: EntryStatus =
    row.status === 'confirmed' || row.status === 'corrected' || row.status === 'rejected'
      ? row.status
      : 'candidate';
  return {
    id: String(row.id ?? ''),
    category,
    text: typeof row.text === 'string' ? row.text : '',
    aiText: typeof row.ai_text === 'string' && row.ai_text ? row.ai_text : undefined,
    source: typeof row.source_text === 'string' && row.source_text ? row.source_text : undefined,
    sourceRecordId:
      typeof row.source_record_id === 'string' && row.source_record_id ? row.source_record_id : undefined,
    status,
    origin: row.origin === 'self' ? 'self' : 'ai',
    revision: typeof row.revision === 'number' ? row.revision : 1,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

export interface AddInsightInput {
  category: Category;
  text: string;
  sourceRecordId?: string;
}

export interface ServerUnderstandingState {
  records: FirstRecord[];
  insights: Insight[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  submitRecord: (draft: RecordDraft, decision: RecordDecision, correctedText?: string) => Promise<void>;
  updateRecord: (id: string, patch: Partial<Pick<FirstRecord, 'text' | 'emotion'>>) => Promise<void>;
  addInsight: (input: AddInsightInput) => Promise<void>;
  updateInsight: (id: string, patch: Partial<Pick<Insight, 'status' | 'text'>>) => Promise<void>;
}

// 실제 저장 계층. 서버 스위치가 꺼져 있으면(프리뷰) 아무것도 불러오지 않는다.
// 로그인 사용자 변경 시 자동으로 다시 불러오고, 계정이 바뀌면 이전 기록을 비운다.
export function useServerUnderstandingState(): ServerUnderstandingState {
  const { user } = useAuth();
  const [records, setRecords] = useState<FirstRecord[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!A_STRUCTURE_SERVER_ENABLED || !user) {
      setRecords([]);
      setInsights([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [r, i] = await Promise.all([
        understandingRequest<{ records?: Row[] }>({ action: 'record_list' }, user.id),
        understandingRequest<{ insights?: Row[] }>({ action: 'insight_list' }, user.id),
      ]);
      setRecords((r.records ?? []).map(mapRecord));
      setInsights((i.insights ?? []).map(mapInsight));
    } catch (e) {
      setError(
        e instanceof UnderstandingError ? e.message : '기록을 불러오지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submitRecord = useCallback(
    async (draft: RecordDraft, decision: RecordDecision, correctedText?: string) => {
      if (!user) throw new UnderstandingError('UNAUTHORIZED', '로그인한 뒤 이어서 저장해 주세요.');
      if (!draft) throw new UnderstandingError('BAD_REQUEST', '저장할 기록이 없어요.');
      const text =
        decision === 'corrected' && correctedText && correctedText.trim()
          ? correctedText.trim()
          : draft.text;
      // 같은 내용은 같은 requestId 로 재전송 → 서버가 중복 저장을 막는다.
      const req = await prepareUnderstandingRequest(user.id, {
        action: 'record_create',
        text,
        originalText: draft.text,
        emotion: draft.emotion,
        status: decision,
      });
      const res = await understandingRequest<{ record?: Row }>(req.body, user.id);
      const record = mapRecord(res.record ?? {});
      setRecords((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
      req.complete();
    },
    [user],
  );

  const updateRecord = useCallback(
    async (id: string, patch: Partial<Pick<FirstRecord, 'text' | 'emotion'>>) => {
      if (!user) throw new UnderstandingError('UNAUTHORIZED', '로그인한 뒤 이어서 저장해 주세요.');
      const rec = records.find((r) => r.id === id);
      if (!rec) throw new UnderstandingError('FORBIDDEN', '기록을 찾지 못했어요.');
      const text = patch.text ?? rec.text;
      const emotion = patch.emotion ?? rec.emotion;
      const req = await prepareUnderstandingRequest(user.id, {
        action: 'record_update',
        id,
        expectedRevision: rec.revision,
        text,
        emotion,
      });
      const res = await understandingRequest<{ record?: Row }>(req.body, user.id);
      const record = mapRecord(res.record ?? {});
      setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
      req.complete();
    },
    [user, records],
  );

  const addInsight = useCallback(
    async (input: AddInsightInput) => {
      if (!user) throw new UnderstandingError('UNAUTHORIZED', '로그인한 뒤 이어서 저장해 주세요.');
      // 직접 설명은 확인한 기록을 근거로 한다. 따로 고르지 않으면 가장 최근 확정 기록을 사용.
      const recordId =
        input.sourceRecordId ?? records.find((r) => r.status !== 'rejected')?.id;
      if (!recordId) {
        throw new UnderstandingError('FORBIDDEN', '먼저 확인한 기록이 있어야 해요. 첫 기록을 남겨주세요.');
      }
      const req = await prepareUnderstandingRequest(user.id, {
        action: 'insight_self',
        category: input.category,
        text: input.text,
        recordId,
      });
      const res = await understandingRequest<{ insight?: Row }>(req.body, user.id);
      const insight = mapInsight(res.insight ?? {});
      setInsights((prev) => [insight, ...prev.filter((i) => i.id !== insight.id)]);
      req.complete();
    },
    [user, records],
  );

  const updateInsight = useCallback(
    async (id: string, patch: Partial<Pick<Insight, 'status' | 'text'>>) => {
      if (!user) throw new UnderstandingError('UNAUTHORIZED', '로그인한 뒤 이어서 저장해 주세요.');
      const ins = insights.find((i) => i.id === id);
      if (!ins) throw new UnderstandingError('FORBIDDEN', '항목을 찾지 못했어요.');
      const status = patch.status ?? ins.status;
      const body: Record<string, unknown> = { id, expectedRevision: ins.revision };
      if (status === 'confirmed') body.action = 'insight_confirm';
      else if (status === 'rejected') body.action = 'insight_reject';
      else if (status === 'corrected') {
        body.action = 'insight_correct';
        body.text = patch.text ?? ins.text;
      } else {
        throw new UnderstandingError('BAD_REQUEST', '처리할 수 없는 상태예요.');
      }
      const req = await prepareUnderstandingRequest(user.id, body);
      const res = await understandingRequest<{ insight?: Row }>(req.body, user.id);
      const insight = mapInsight(res.insight ?? {});
      setInsights((prev) => prev.map((i) => (i.id === insight.id ? insight : i)));
      req.complete();
    },
    [user, insights],
  );

  return {
    records,
    insights,
    loading,
    error,
    reload,
    submitRecord,
    updateRecord,
    addInsight,
    updateInsight,
  };
}