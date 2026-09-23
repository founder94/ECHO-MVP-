// 연결 승인 — 대표가 직접 보는 곳(연결 원칙 2026-09-21 "첫 100명 대표 수동 승인").
// 후보는 서버(doit-connect)가 고른다: 연결 자격(전화 인증·맞다고 한 말 5개·필수 사진 3장·소개) + 같은 목적 + 겹친 말.
// 승인하면 서버가 두 사람에게 같은 첫 질문을 만든다. 넘기면 그 쌍은 다시 후보로 나오지 않는다.
// 이 화면은 이야기 내용을 보여 주지 않는다(서버가 개수만 준다).
import { useCallback, useEffect, useState } from "react";
import { UnderstandingError } from "@/doit/lib/understandingApi";
import { decideMatch, fetchAdminCandidates, fetchAdminMatches, type AdminCandidate, type AdminCandidates, type AdminMatch } from "@/doit/lib/connectApi";
import { PanelTitle, StatCard, Pill, EmptyRow, fmtDate } from "../components/ui";

type Load<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: T };

const MISSING_LABEL: Record<keyof AdminCandidates["missing"], string> = {
  purpose: "목적 없음",
  phone: "전화 인증 안 함",
  confirmed: "맞다고 한 말 5개 미만",
  photos: "필수 사진 3장 미만",
  intro: "소개 없음",
};

const STATUS: Record<AdminMatch["status"], { label: string; tone: "accent" | "primary" | "secondary" | "neutral" }> = {
  approved: { label: "이어짐", tone: "accent" },
  closed: { label: "끝남", tone: "neutral" },
  rejected: { label: "넘김", tone: "secondary" },
};

function message(e: unknown): string {
  if (e instanceof UnderstandingError) {
    if (e.code === "FORBIDDEN") return "관리자 계정으로 로그인해야 볼 수 있어요.";
    return e.message;
  }
  return "불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.";
}

export default function ConnectionApprovals() {
  const [candidates, setCandidates] = useState<Load<AdminCandidates>>({ kind: "loading" });
  const [matches, setMatches] = useState<Load<AdminMatch[]>>({ kind: "loading" });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCandidates({ kind: "loading" });
    setMatches({ kind: "loading" });
    const [c, m] = await Promise.allSettled([fetchAdminCandidates(), fetchAdminMatches()]);
    setCandidates(c.status === "fulfilled" ? { kind: "ready", data: c.value } : { kind: "error", message: message(c.reason) });
    setMatches(m.status === "fulfilled" ? { kind: "ready", data: m.value } : { kind: "error", message: message(m.reason) });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (c: AdminCandidate, decision: "approve" | "reject") => {
    const key = `${c.user_a}|${c.user_b}`;
    if (busyKey) return;
    setBusyKey(key);
    setNotice(null);
    try {
      const out = await decideMatch(c.user_a, c.user_b, decision);
      setNotice(decision === "approve"
        ? `${c.a.nickname} · ${c.b.nickname} 연결을 열었어요. 첫 질문: "${out.first_question ?? ""}"${out.question_source === "fixed" ? " (AI 질문이 검사에 걸려 기본 질문을 썼어요)" : ""}`
        : `${c.a.nickname} · ${c.b.nickname} 쌍을 넘겼어요. 다시 후보로 나오지 않아요.`);
      await load();
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>연결 승인</PanelTitle>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700 transition hover:bg-background-100">
          <i className="ri-refresh-line" /> 새로 보기
        </button>
      </div>

      <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-3 text-xs leading-relaxed text-foreground-600">
        <p className="font-semibold text-foreground-800">어떻게 고르나요</p>
        <p className="mt-1">서버가 연결 자격을 갖춘 사람 중 <b>같은 만남을 고르고 맞다고 한 말이 겹치는</b> 두 사람을 후보로 보여 줍니다. 차단한 사이와 이미 결정한 쌍은 나오지 않습니다.</p>
        <p className="mt-1"><b>승인</b>하면 두 사람에게 같은 첫 질문이 가고, 둘 다 답해야 서로의 이름과 사진이 열립니다. <b>넘기기</b>는 되돌릴 수 없습니다.</p>
      </div>

      {notice && <p role="status" className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">{notice}</p>}

      {candidates.kind === "loading" && <p className="text-sm text-foreground-600">후보를 계산하고 있어요.</p>}
      {candidates.kind === "error" && <p role="alert" className="text-sm text-secondary-900">{candidates.message}</p>}
      {candidates.kind === "ready" && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="목적을 고른 사람" value={candidates.data.pool} status="success" />
          <StatCard label="연결 자격" value={candidates.data.eligible} status="success" accent />
          <StatCard label="지금 후보 쌍" value={candidates.data.candidates.length} status="success" />
        </div>
        <div className="rounded-lg border border-background-200 px-4 py-3 text-xs text-foreground-600">
          <p className="font-semibold text-foreground-800">자격이 안 되는 이유 (한 사람이 여러 개일 수 있어요)</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {(Object.keys(MISSING_LABEL) as (keyof AdminCandidates["missing"])[]).map((k) => <li key={k}>{MISSING_LABEL[k]} <b>{candidates.data.missing[k] ?? 0}</b>명</li>)}
          </ul>
        </div>
        <section className="flex flex-col gap-3">
          {candidates.data.candidates.length === 0 && <EmptyRow>지금은 후보 쌍이 없어요. 자격을 갖춘 사람이 같은 목적으로 두 명 이상 모이고, 맞다고 한 말이 겹쳐야 나와요.</EmptyRow>}
          {candidates.data.candidates.map((c) => {
            const key = `${c.user_a}|${c.user_b}`;
            return (
              <article key={key} className="rounded-lg border border-background-200 bg-background-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm text-foreground-950">{c.a.nickname}</b><span className="text-foreground-400">·</span><b className="text-sm text-foreground-950">{c.b.nickname}</b>
                  {c.purpose && <Pill tone="primary">{c.purpose}</Pill>}
                  <span className="text-xs text-foreground-500">겹친 말 {c.score}</span>
                </div>
                <div className="mt-3 grid gap-3 text-xs text-foreground-700 md:grid-cols-2">
                  <div><p className="font-semibold">{c.a.nickname} 님이 맞다고 한 말</p><ul className="mt-1 list-disc pl-4">{c.common_a.map((t) => <li key={t}>{t}</li>)}</ul></div>
                  <div><p className="font-semibold">{c.b.nickname} 님이 맞다고 한 말</p><ul className="mt-1 list-disc pl-4">{c.common_b.map((t) => <li key={t}>{t}</li>)}</ul></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={!!busyKey} onClick={() => void decide(c, "approve")} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 disabled:opacity-50">
                    {busyKey === key ? "첫 질문을 만드는 중" : "승인하고 첫 질문 보내기"}
                  </button>
                  <button type="button" disabled={!!busyKey} onClick={() => void decide(c, "reject")} className="rounded-md border border-background-200 px-4 py-2 text-sm text-foreground-700 disabled:opacity-50">
                    이 쌍은 넘기기
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </>}

      <section className="flex flex-col gap-3">
        <PanelTitle>지금까지의 연결</PanelTitle>
        {matches.kind === "loading" && <p className="text-sm text-foreground-600">불러오는 중이에요.</p>}
        {matches.kind === "error" && <p role="alert" className="text-sm text-secondary-900">{matches.message}</p>}
        {matches.kind === "ready" && matches.data.length === 0 && <EmptyRow>아직 결정한 연결이 없어요.</EmptyRow>}
        {matches.kind === "ready" && matches.data.map((m) => (
          <article key={m.id} className="rounded-lg border border-background-200 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <b>{m.a}</b><span className="text-foreground-400">·</span><b>{m.b}</b>
              <Pill tone={STATUS[m.status]?.tone ?? "neutral"}>{STATUS[m.status]?.label ?? m.status}</Pill>
              <span className="text-xs text-foreground-500">{fmtDate(m.created_at)}</span>
            </div>
            {m.status !== "rejected" && <p className="mt-2 text-xs text-foreground-600">첫 질문 "{m.first_question}" · 답 {m.answered}/2 · 이야기 {m.messages}개</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
