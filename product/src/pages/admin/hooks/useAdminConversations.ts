import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Period } from '../meta';

export type ConversationLoadState = 'loading' | 'success' | 'empty' | 'forbidden' | 'unauthorized' | 'error';

export interface AdminConversationItem {
  conversationId: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  nickname: string | null;
  status: string;
  currentStep: number | null;
  messageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  attentionSignals: string[];
}

export interface AdminConversationMessage {
  id: string;
  role: string;
  step: number | null;
  message_kind: string | null;
  content: string;
  created_at: string | null;
}

export interface AdminConversationDetail {
  conversation: {
    id: string;
    user_id: string;
    status: string;
    current_step: number | null;
    created_at: string | null;
    updated_at: string | null;
  };
  profile: { id: string; email: string | null; display_name: string | null; nickname: string | null } | null;
  emotions: Array<{ mind_text: string; created_at: string | null }>;
  messages: AdminConversationMessage[];
  understandings: Array<{
    step: number | null;
    choice: string;
    rejected_interpretation: string | null;
    correction_text: string | null;
    self_explanation: string | null;
    created_at: string | null;
  }>;
}

interface FunctionErrorBody {
  code?: string;
  error?: string;
}

async function readFunctionError(error: unknown): Promise<FunctionErrorBody> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      return (await context.clone().json()) as FunctionErrorBody;
    } catch {
      if (context.status === 401) return { code: 'UNAUTHORIZED' };
      if (context.status === 403) return { code: 'FORBIDDEN' };
    }
  }
  return { error: (error as { message?: string })?.message };
}

function stateForCode(code?: string): ConversationLoadState {
  if (code === 'UNAUTHORIZED') return 'unauthorized';
  if (code === 'FORBIDDEN') return 'forbidden';
  return 'error';
}

export function useAdminConversations(period: Period) {
  const [state, setState] = useState<ConversationLoadState>('loading');
  const [items, setItems] = useState<AdminConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<AdminConversationDetail | null>(null);
  const [detailState, setDetailState] = useState<ConversationLoadState>('empty');
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');

  const loadList = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    const { data, error } = await supabase.functions.invoke('admin-conversations', {
      body: { action: 'list', period, limit: 50 },
    });
    if (error) {
      const body = await readFunctionError(error);
      setItems([]);
      setState(stateForCode(body.code));
      setErrorMessage(body.error ?? '대화 목록을 불러오지 못했습니다.');
      return;
    }
    if (!data?.ok) {
      setItems([]);
      setState(stateForCode(data?.code));
      setErrorMessage(data?.error ?? '대화 목록을 불러오지 못했습니다.');
      return;
    }
    const next = (data.items ?? []) as AdminConversationItem[];
    setItems(next);
    setState(next.length ? 'success' : 'empty');
  }, [period]);

  const loadDetail = useCallback(async (conversationId: string) => {
    setSelectedId(conversationId);
    setDetail(null);
    setDetailState('loading');
    setErrorMessage('');
    const { data, error } = await supabase.functions.invoke('admin-conversations', {
      body: { action: 'detail', conversationId },
    });
    if (error) {
      const body = await readFunctionError(error);
      setDetailState(stateForCode(body.code));
      setErrorMessage(body.error ?? '대화 내용을 불러오지 못했습니다.');
      return;
    }
    if (!data?.ok) {
      setDetailState(stateForCode(data?.code));
      setErrorMessage(data?.error ?? '대화 내용을 불러오지 못했습니다.');
      return;
    }
    setDetail(data as AdminConversationDetail);
    setDetailState('success');
  }, []);

  const clearDetail = useCallback(() => {
    setSelectedId('');
    setDetail(null);
    setDetailState('empty');
  }, []);

  useEffect(() => {
    clearDetail();
    void loadList();
  }, [clearDetail, loadList]);

  useEffect(() => () => {
    setDetail(null);
  }, []);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [item.email, item.displayName, item.nickname, item.conversationId, item.status]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [items, search]);

  return {
    state,
    items: filteredItems,
    selectedId,
    detail,
    detailState,
    errorMessage,
    search,
    setSearch,
    refresh: loadList,
    loadDetail,
    clearDetail,
  };
}
