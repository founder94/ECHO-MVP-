// AI 대화 기록 화면 — 대표가 SQL 없이 "무슨 답이 쌓였고 AI 이해가 어떻게 판정됐는지" 직접 보는 곳.
// 사용자 원문은 기본으로 가린다. 보려면 눌러야 하고, 어디에도 기록(로그)하지 않는다.
import { useState } from "react";
import type { Period } from "../hooks/useAdminData";
import { useConversationLogs } from "../hooks/useConversationLogs";
import { PanelTitle, StateNotice, StatCard, Pill, EmptyRow, fmtDate } from "../components/ui";

const RECORD_STATUS_LABEL: Record<string, string> = {
  active: "살아 있음",
  superseded: "고쳐 씀",
  deleted: "지움",
};

const INSIGHT_STATUS: Record<string, { label: string; tone: "accent" | "primary" | "secondary" | "neutral" }> = {
  confirmed: { label: "맞아요", tone: "accent" },
  corrected: { label: "조금 달라요", tone: "primary" },
  rejected: { label: "그게 아니에요", tone: "secondary" },
  candidate: { label: "아직 안 고름", tone: "neutral" },
};

function maskText(text: string | null): string {
  if (!text) return "—";
  const head = text.slice(0, 6);
  return `${head}… (${text.length}자)`;
}

export default function ConversationLogs({ period }: { period: Period }) {
  const { data } = useConversationLogs(period);
  const [showRaw, setShowRaw] = useState(false);
  const { records, insights, requestEvents, ownRowsOnly } = data;
  const counts = insights.counts;
  const answered = counts.confirmed + counts.corrected + counts.rejected;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>AI 대화 기록</PanelTitle>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700 transition hover:bg-background-100"
        >
          <i className={showRaw ? "ri-eye-off-line" : "ri-eye-line"} />
          {showRaw ? "원문 가리기" : "원문 보기"}
        </button>
      </div>

      {/* 보이는 범위를 먼저 밝힌다. 전체가 보이는 것처럼 오해하면 판단이 틀어진다. */}
      <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-3 text-xs leading-relaxed text-foreground-600">
        <p className="font-semibold text-foreground-800">지금 보이는 범위</p>
        <p className="mt-1">
          조회 규칙(RLS)이 아직 “본인 줄만”이라, 지금은 <b>로그인한 계정의 기록만</b> 보입니다.
          {ownRowsOnly ? "" : " (여러 계정의 줄이 보이고 있습니다 — 관리자 정책이 이미 적용된 상태입니다.)"}
        </p>
        <p className="mt-1">
          전체 사용자를 보려면 관리자 조회 정책을 추가해야 합니다. 초안은{" "}
          <code className="rounded bg-background-50 px-1">supabase/drafts/PENDING_20260922_admin_read_doit_conversation.sql</code>{" "}
          에 있고, <b>대표 승인 전에는 실행하지 않습니다.</b>
        </p>
      </div>

      {/* 요약 숫자 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="적은 답" value={records.total} sub="doit_records" status={records.status} />
        <StatCard label="AI 가 만든 이해" value={insights.total} sub="doit_insights" status={insights.status} />
        <StatCard label="맞아요" value={insights.status === "success" ? counts.confirmed : null} sub={`대답한 것 ${answered}건 중`} status={insights.status} />
        <StatCard label="그게 아니에요" value={insights.status === "success" ? counts.rejected : null} sub={`조금 달라요 ${counts.corrected}건`} status={insights.status} />
      </div>

      {/* 사용자가 적은 답 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground-900">사용자가 적은 답</h3>
          <span className="text-xs text-foreground-500">최근 {records.rows.length}건</span>
        </div>
        {records.status === "loading" ? (
          <StateNotice status="loading" />
        ) : records.status === "blocked" || records.status === "missing" || records.status === "error" ? (
          <StateNotice status={records.status} note={records.note ?? "doit_records 를 읽지 못했습니다."} />
        ) : records.rows.length === 0 ? (
          <StateNotice status="empty" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-background-200 bg-background-100 text-xs text-foreground-500">
                <tr>
                  <th className="px-4 py-3 font-medium">적은 시각</th>
                  <th className="px-4 py-3 font-medium">내용</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">고쳐 쓴 횟수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-100">
                {records.rows.map((row) => (
                  <tr key={row.id} className="align-top text-foreground-800">
                    <td className="whitespace-nowrap px-4 py-3 text-foreground-500">{fmtDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[420px] whitespace-pre-wrap break-words">
                        {showRaw ? (row.original_text ?? row.text ?? "—") : maskText(row.original_text ?? row.text)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Pill tone={row.status === "active" ? "accent" : "neutral"}>
                        {RECORD_STATUS_LABEL[row.status ?? ""] ?? row.status ?? "—"}
                      </Pill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground-600">{row.revision ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.rows.length === 0 && <EmptyRow>데이터 없음</EmptyRow>}
          </div>
        )}
      </div>

      {/* AI 가 만든 이해 + 4버튼 결과 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground-900">AI 가 만든 이해 · 4버튼 결과</h3>
          <span className="text-xs text-foreground-500">최근 {insights.rows.length}건</span>
        </div>
        {insights.status === "loading" ? (
          <StateNotice status="loading" />
        ) : insights.status === "blocked" || insights.status === "missing" || insights.status === "error" ? (
          <StateNotice status={insights.status} note={insights.note ?? "doit_insights 를 읽지 못했습니다."} />
        ) : insights.rows.length === 0 ? (
          <StateNotice status="empty" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-background-200 bg-background-100 text-xs text-foreground-500">
                <tr>
                  <th className="px-4 py-3 font-medium">시각</th>
                  <th className="px-4 py-3 font-medium">주제</th>
                  <th className="px-4 py-3 font-medium">이해 문장</th>
                  <th className="px-4 py-3 font-medium">사용자 판정</th>
                  <th className="px-4 py-3 font-medium">만든 쪽</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-100">
                {insights.rows.map((row) => {
                  const badge = INSIGHT_STATUS[row.status ?? ""] ?? { label: row.status ?? "—", tone: "neutral" as const };
                  return (
                    <tr key={row.id} className="align-top text-foreground-800">
                      <td className="whitespace-nowrap px-4 py-3 text-foreground-500">{fmtDate(row.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground-600">{row.category ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[380px] whitespace-pre-wrap break-words">
                          {showRaw ? (row.text ?? row.ai_text ?? "—") : maskText(row.text ?? row.ai_text)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Pill tone={badge.tone}>{badge.label}</Pill>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground-600">
                        {row.origin === "self" ? "직접 설명" : row.origin === "ai" ? "AI" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 질문 생성 기록 */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground-900">질문 생성·실패 기록</h3>
        {requestEvents.status === "loading" ? (
          <StateNotice status="loading" />
        ) : requestEvents.status === "success" || requestEvents.status === "empty" ? (
          <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-4 text-sm text-foreground-700">
            총 {requestEvents.total ?? 0}건
          </div>
        ) : (
          <StateNotice
            status={requestEvents.status}
            note="doit_request_events 는 서버 함수 전용이라 화면에서 읽을 권한이 없습니다. 막히는 것이 정상입니다. 질문이 왜 실패했는지 보려면 관리자 조회 정책을 따로 추가해야 하며, 그 초안도 위 PENDING 파일에 함께 있습니다."
          />
        )}
      </div>
    </div>
  );
}
