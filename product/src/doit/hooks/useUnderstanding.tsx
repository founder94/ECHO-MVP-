/* eslint-disable react-refresh/only-export-components -- 컨텍스트+훅 같은 파일(A 구조 원본 스타일) */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { A_STRUCTURE_SERVER_ENABLED } from "@/doit/lib/understandingApi";
import {
  useServerUnderstandingState,
  type AddInsightInput,
} from "@/doit/hooks/ServerUnderstandingProvider";

// A구조 7화면(첫 기록 → 확인·수정 → 홈 → 타임라인 → 가치 → 패턴 → 선택 기억)의 상태 저장소.
//
// 서버 스위치(A_STRUCTURE_SERVER_ENABLED)가 켜져 있으면 실제 서버·DB에 저장한다.
// 꺼져 있으면(프리뷰) localStorage 임시 기록으로만 동작한다(영구 저장처럼 표시하지 않음).
//   - candidate: AI 후보(사용자 확인 전) — 사실로 쓰지 않음
//   - confirmed: 사용자가 맞다고 확인
//   - corrected: 사용자가 직접 수정
//   - rejected: 사용자가 아니라고 거절 — 재추천·질문 전제로 쓰지 않음

export type EntryStatus = "candidate" | "confirmed" | "corrected" | "rejected";
export type Category = "value" | "pattern" | "memory";
export type RecordDecision = "confirmed" | "corrected" | "rejected";

export interface FirstRecord {
  id: string;
  text: string; // 최종 텍스트(corrected면 수정본, confirmed면 원문)
  originalText: string; // 사용자가 처음 남긴 원문
  emotion: string; // 감정 태그(선택 안 하면 빈 문자열)
  status: RecordDecision;
  revision: number; // 낙관 잠금 기준(서버 반영 버전)
  createdAt: string;
}

export interface Insight {
  id: string;
  category: Category;
  text: string; // 표시 텍스트(corrected는 수정본, self는 직접 설명)
  aiText?: string; // AI 후보 원문(corrected·rejected일 때 보존)
  source?: string; // 근거가 된 확정 기록 원문
  sourceRecordId?: string; // 근거 기록 id(직접 설명 저장 시 사용)
  status: EntryStatus;
  origin: "ai" | "self"; // ai 후보 vs 사용자 직접 설명(직접 설명이 항상 우선)
  revision: number;
  createdAt: string;
}

export interface RecordDraft {
  text: string;
  emotion: string;
}

interface UnderstandingValue {
  draft: RecordDraft | null;
  records: FirstRecord[];
  insights: Insight[];
  loading: boolean;
  error: string | null;
  setDraft: (draft: RecordDraft | null) => void;
  submitRecord: (decision: RecordDecision, correctedText?: string) => Promise<void>;
  updateRecord: (id: string, patch: Partial<Pick<FirstRecord, "text" | "emotion">>) => Promise<void>;
  addInsight: (input: AddInsightInput) => Promise<void>;
  updateInsight: (id: string, patch: Partial<Pick<Insight, "status" | "text" | "source">>) => Promise<void>;
  reload: () => Promise<void>;
}

// ── 프리뷰용 localStorage 임시 기록(서버 연결 전) ──
const STORAGE_KEY = "doit:understanding:v1";

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadLocal(): { records: FirstRecord[]; insights: Insight[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], insights: [] };
    const parsed = JSON.parse(raw) as {
      records?: FirstRecord[];
      insights?: Insight[];
    };
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    };
  } catch {
    return { records: [], insights: [] };
  }
}

const UnderstandingContext = createContext<UnderstandingValue | null>(null);

export function UnderstandingProvider({ children }: { children: ReactNode }) {
  const server = useServerUnderstandingState();

  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [local, setLocal] = useState<{ records: FirstRecord[]; insights: Insight[] }>(() =>
    loadLocal(),
  );

  const useServer = A_STRUCTURE_SERVER_ENABLED;

  // 로컬(프리뷰) 경로에서만 임시 기록을 보관한다.
  const persistLocal = useCallback(
    (next: { records: FirstRecord[]; insights: Insight[] }) => {
      if (useServer) return;
      setLocal(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* 저장 불가해도 이번 세션은 진행 */
      }
    },
    [useServer],
  );

  const records = useServer ? server.records : local.records;
  const insights = useServer ? server.insights : local.insights;
  const loading = useServer ? server.loading : false;
  const error = useServer ? server.error : null;

  const submitRecord = useCallback(
    async (decision: RecordDecision, correctedText?: string) => {
      if (useServer) {
        if (!draft) return;
        await server.submitRecord(draft, decision, correctedText);
        setDraft(null);
        return;
      }
      if (!draft) return;
      const text =
        decision === "corrected" && correctedText && correctedText.trim()
          ? correctedText.trim()
          : draft.text;
      const record: FirstRecord = {
        id: genId(),
        text,
        originalText: draft.text,
        emotion: draft.emotion,
        status: decision,
        revision: 1,
        createdAt: new Date().toISOString(),
      };
      persistLocal({ records: [record, ...local.records], insights: local.insights });
      setDraft(null);
    },
    [useServer, draft, server, local, persistLocal],
  );

  const updateRecord = useCallback(
    async (id: string, patch: Partial<Pick<FirstRecord, "text" | "emotion">>) => {
      if (useServer) {
        await server.updateRecord(id, patch);
        return;
      }
      persistLocal({
        records: local.records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        insights: local.insights,
      });
    },
    [useServer, server, local, persistLocal],
  );

  const addInsight = useCallback(
    async (input: AddInsightInput) => {
      if (useServer) {
        await server.addInsight(input);
        return;
      }
      const recordId = input.sourceRecordId ?? local.records.find((r) => r.status !== "rejected")?.id;
      const source = local.records.find((r) => r.id === recordId)?.text;
      const insight: Insight = {
        id: genId(),
        category: input.category,
        text: input.text,
        source,
        sourceRecordId: recordId,
        status: "confirmed",
        origin: "self",
        revision: 1,
        createdAt: new Date().toISOString(),
      };
      persistLocal({ records: local.records, insights: [insight, ...local.insights] });
    },
    [useServer, server, local, persistLocal],
  );

  const updateInsight = useCallback(
    async (id: string, patch: Partial<Pick<Insight, "status" | "text" | "source">>) => {
      if (useServer) {
        await server.updateInsight(id, patch);
        return;
      }
      persistLocal({
        records: local.records,
        insights: local.insights.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      });
    },
    [useServer, server, local, persistLocal],
  );

  const reload = useCallback(async () => {
    if (useServer) {
      await server.reload();
    }
  }, [useServer, server]);

  const value = useMemo<UnderstandingValue>(
    () => ({
      draft,
      records,
      insights,
      loading,
      error,
      setDraft,
      submitRecord,
      updateRecord,
      addInsight,
      updateInsight,
      reload,
    }),
    [
      draft,
      records,
      insights,
      loading,
      error,
      setDraft,
      submitRecord,
      updateRecord,
      addInsight,
      updateInsight,
      reload,
    ],
  );

  return <UnderstandingContext.Provider value={value}>{children}</UnderstandingContext.Provider>;
}

export function useUnderstanding() {
  const ctx = useContext(UnderstandingContext);
  if (!ctx) {
    throw new Error("useUnderstanding must be used within UnderstandingProvider");
  }
  return ctx;
}