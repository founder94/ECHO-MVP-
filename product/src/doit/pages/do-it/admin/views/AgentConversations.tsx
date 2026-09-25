// ECHO 대화 에이전트 — 관리자 관측(2026-09-25 대표 FINAL). 서버(doit-agent)가 관리자 역할을 다시 확인하고 실제 저장된 세션·턴 기록만 준다.
// 가짜 사용자·가짜 매칭·가짜 비용 0. 사용자 원문은 기본 가림(「원문 보기」를 눌러야 보임). 이 화면은 읽기만 한다(쓰기 호출 0).
import { useCallback, useEffect, useMemo, useState } from "react";
import { UnderstandingError } from "@/doit/lib/understandingApi";
import { PIPELINE_STAGES, PURPOSE_IDS, candidates, dashboard, fetchAgentAdmin, observability, pipeline, pipelineSummary, type Session, type StageState } from "@/doit/lib/agentAdmin";
import { AGENT_PURPOSE_LABELS } from "@/doit/lib/agentApi";
import { PanelTitle, StatCard, Pill, EmptyRow, fmtDate } from "../components/ui";

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; sessions: Session[] };
type Tab = "pipeline" | "dashboard" | "sessions" | "profile" | "candidates" | "ai";
const TABS: { key: Tab; label: string }[] = [
  { key: "pipeline", label: "어디서 막혔나(파이프라인)" }, { key: "dashboard", label: "대시보드" }, { key: "sessions", label: "대화 보기" }, { key: "profile", label: "매칭 프로필" },
  { key: "candidates", label: "실패·성공 후보" }, { key: "ai", label: "AI 관측" },
];
const TONE: Record<string, string> = { formal: "정중한 존댓말", polite: "편한 존댓말", casual: "편한 반말" };
const FLAG: Record<string, string> = { correction: "정정", rejection: "거절", complaint: "항의", skip: "넘기기", fatigue: "지침", unsure: "모르겠음", ask: "AI에게 질문", help: "질문 뜻 되물음", blocked: "저장 금지 입력" };
// 파이프라인 단계 판정: 색만으로 뜻을 전하지 않는다 — 글자를 늘 함께 쓴다(초록 = 됨 · 노랑 = 부분·대기 · 회색 = 모름·막힘(외부 연결) · 빨강 = 실패).
const STAGE_TEXT: Record<StageState, string> = { PASS: "됨", PARTIAL: "부분", WAIT: "기다림", FAIL: "실패", BLOCKED: "막힘", UNKNOWN: "모름" };
const STAGE_CLASS: Record<StageState, string> = { PASS: "border-[#2f8a57] bg-[#eaf6ef] text-[#1f6b41]", PARTIAL: "border-[#c98a12] bg-[#fdf3dc] text-[#7a5200]", WAIT: "border-[#c98a12] bg-[#fdf3dc] text-[#7a5200]", FAIL: "border-[#b3261e] bg-[#fdecea] text-[#8c1d18]", BLOCKED: "border-background-300 text-foreground-600", UNKNOWN: "border-background-300 text-foreground-600" };
const INTRO_STATUS: Record<string, string> = { ready: "만듦", failed: "못 만듦", none: "재료 없음" };
const INTRO_USED: Record<string, string> = { as_is: "그대로 사용", edited: "고쳐서 사용", own: "직접 씀" };

function message(e: unknown): string {
  if (e instanceof UnderstandingError) return e.code === "FORBIDDEN" ? "관리자 계정으로 로그인해야 볼 수 있어요." : e.message;
  return "불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.";
}
const hide = (t: string | null, show: boolean) => (t == null ? "기록 없음" : show ? t : "•".repeat(Math.min(Math.max(t.length, 3), 12)));

export default function AgentConversations() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("pipeline");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const refresh = useCallback(async () => {
    setLoad({ kind: "loading" });
    try { setLoad({ kind: "ready", sessions: await fetchAgentAdmin() }); } catch (e) { setLoad({ kind: "error", message: message(e) }); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const sessions = useMemo(() => (load.kind === "ready" ? load.sessions : []), [load]);
  const d = useMemo(() => dashboard(sessions), [sessions]);
  const obs = useMemo(() => observability(sessions), [sessions]);
  const cands = useMemo(() => sessions.map((s) => ({ s, c: candidates(s) })), [sessions]);
  const open = sessions.find((s) => s.id === openId) ?? null;
  const pipe = useMemo(() => pipelineSummary(sessions), [sessions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>대화 에이전트</PanelTitle>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowRaw((v) => !v)} className="rounded-md border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700">{showRaw ? "원문 가리기" : "원문 보기"}</button>
          <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1.5 rounded-md border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700"><i className="ri-refresh-line" /> 새로 보기</button>
        </div>
      </div>
      <p className="rounded-lg border border-background-200 bg-background-100 px-4 py-3 text-xs leading-relaxed text-foreground-600">
        운영 서버(doit-agent)에 실제로 저장된 최근 대화 50개와 그 턴 기록만 보여 줍니다. 사용자 원문은 개인 정보라 기본으로 가립니다. 실패·성공 후보는 기록에서 자동으로 뽑은 <b>후보</b>이며 확정이 아닙니다.
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="보기">
        {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === t.key ? "bg-primary-500 text-background-50" : "border border-background-200 text-foreground-700"}`}>{t.label}</button>)}
      </nav>

      {load.kind === "loading" && <p className="text-sm text-foreground-600">불러오고 있어요.</p>}
      {load.kind === "error" && <p role="alert" className="text-sm text-secondary-900">{load.message}</p>}
      {load.kind === "ready" && sessions.length === 0 && <EmptyRow>아직 에이전트 대화가 없어요. 사용자가 새 대화를 시작하면 여기에 보여요.</EmptyRow>}

      {load.kind === "ready" && sessions.length > 0 && tab === "pipeline" && <section className="flex flex-col gap-4" aria-label="파이프라인">
        <p className="text-xs leading-relaxed text-foreground-600">사용자 말 → 대화 → AI OS(서버가 AI 후보를 확인) → 확정 정보 → AI 소개·사용자 확인 → 사진 → 전화 인증 → 연결 준비 → 후보·연결. 서버 기록만으로 판정하고, 기록이 없으면 「모름」이에요. 이름을 누르면 그 대화로 갑니다.</p>
        <div className="rounded-lg border border-background-200 px-4 py-3 text-sm">
          <p className="font-semibold">지금 가장 많이 멈춘 곳 TOP 3</p>
          {pipe.top.length ? <ol className="mt-2 flex flex-col gap-1 text-xs">{pipe.top.map((x, k) => <li key={x.key}>{k + 1}. {x.label} — {x.n}명</li>)}</ol> : <p className="mt-2 text-xs text-foreground-500">멈춘 사람이 없어요.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {PIPELINE_STAGES.map((x) => <StatCard key={x.key} label={x.label} value={`${pipe.reached[x.key]} / ${pipe.total}`} sub="이 단계까지 된 사람" status="success" />)}
        </div>
        <div className="overflow-x-auto rounded-lg border border-background-200">
          <table className="min-w-[860px] text-left text-xs">
            <thead><tr className="bg-background-100">{["사용자", ...PIPELINE_STAGES.map((x) => x.label)].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{sessions.map((s) => { const p = pipeline(s); return <tr key={s.id} className="border-t border-background-200 align-top">
              <td className="px-2 py-2"><button type="button" className="font-semibold underline" onClick={() => { setOpenId(s.id); setTab("sessions"); }}>{s.nickname ?? s.user}</button><div className="text-foreground-500">{p.stuck ? `멈춘 곳: ${p.stuck.label}` : "모두 됨"}</div></td>
              {p.stages.map((x) => <td key={x.key} className="px-2 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${STAGE_CLASS[x.state]}`}>{STAGE_TEXT[x.state]}</span><div className="mt-1 text-foreground-500">{x.note}</div></td>)}
            </tr>; })}</tbody>
          </table>
        </div>
      </section>}

      {load.kind === "ready" && sessions.length > 0 && tab === "dashboard" && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="대화" value={d.sessions} sub={`진행 ${d.in_progress} · 끝남 ${d.done}`} status="success" accent />
        <StatCard label="글 / 말" value={`${d.text} / ${d.voice}`} status="success" />
        <StatCard label="말투(정중·편한 존댓말·반말)" value={`${d.tones.formal} · ${d.tones.polite} · ${d.tones.casual}`} status="success" />
        <StatCard label="핵심 질문 수별 대화" value={[0, 1, 2, 3, 4, 5].map((n) => `${n}:${d.progress[n]}`).join(" ")} status="success" />
        <StatCard label="정정 · 거절 · 넘기기 · 지침" value={`${d.flags.correction} · ${d.flags.rejection} · ${d.flags.skip} · ${d.flags.fatigue}`} sub={`AI에게 질문 ${d.flags.ask} · 질문 뜻 되물음 ${d.flags.help ?? 0}`} status="success" />
        <StatCard label="매칭 프로필 만든 대화" value={d.matching_ready} sub={d.matching_status.join(", ") || "상태 없음"} status="success" />
        <StatCard label="실패 후보 · 성공 후보" value={`${d.failure_candidates} · ${d.success_candidates}`} status="success" />
        <StatCard label="AI 호출(오류)" value={`${d.ai_calls} (${d.ai_errors})`} sub={`지연 p50 ${d.latency_p50 ?? "-"}ms · p95 ${d.latency_p95 ?? "-"}ms`} status="success" />
        <StatCard label="토큰 입력 · 출력" value={`${d.input_tokens.toLocaleString()} · ${d.output_tokens.toLocaleString()}`} sub="OpenAI 응답의 usage 합계" status="success" />
        <StatCard label="비용" value="확인 불가" sub={d.cost} status="success" />
        <StatCard label="진행 중 하루 넘게 멈춤" value={d.stalled} sub="중도 이탈 후보" status="success" />
        <StatCard label="사진 올린 사람 · 대표 사진" value={`${d.with_photos} · ${d.with_primary}`} sub="최근 2개월 확인 상태는 저장 칸이 없어 기록 없음" status="success" />
        <StatCard label="AI 소개 초안(만듦 · 못 만듦 · 재료 없음)" value={`${d.intro.ready} · ${d.intro.failed} · ${d.intro.none}`} sub={`예전 대화(기록 없음) ${d.intro.no_record}`} status="success" />
        <StatCard label="최종 소개 출처(그대로 · 고침 · 직접)" value={`${d.intro.as_is} · ${d.intro.edited} · ${d.intro.own}`} sub="사용자가 고른 것만 셈" status="success" />
        <StatCard label="연결 준비 · 전화 인증 · 소개 저장" value={`${d.phone_verified} · ${d.intro_saved}`} sub={`서버가 참·거짓만 보냄(번호·글 0) · 기록 없음 ${d.readiness_unknown}`} status="success" />
      </div>}

      {load.kind === "ready" && tab === "sessions" && <section className="flex flex-col gap-3">
        {sessions.map((s) => <article key={s.id} className="rounded-lg border border-background-200 px-4 py-3 text-sm">
          <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
            <b>{s.nickname ?? s.user}</b><Pill tone={s.phase === "done" ? "accent" : "primary"}>{s.phase === "done" ? "끝남" : "진행 중"}</Pill>
            <span className="text-xs text-foreground-500">핵심 질문 {s.core}/5 · {s.mode} · {TONE[s.tone] ?? s.tone} · 턴 {s.turns.length} · {fmtDate(s.updated_at)}</span>
          </button>
          {open?.id === s.id && <ol className="mt-3 flex flex-col gap-3 text-xs">
            {s.turns.map((t) => <li key={t.i} className="rounded-md bg-background-100 px-3 py-2">
              <p className="font-semibold">턴 {t.i} · {t.action}{t.rec ? ` · 질문 ${t.rec.question_index}/5 · ${t.rec.decision}` : ""} {Object.entries(t.flags).filter(([, v]) => v).map(([k]) => <Pill key={k} tone="secondary">{FLAG[k] ?? k}</Pill>)}{t.rec?.guard ? <Pill tone="neutral">서버가 바로잡음: {t.rec.guard.from}→{t.rec.guard.to} ({t.rec.guard.rule})</Pill> : null}{t.rec?.superseded ? <Pill tone="neutral">정정으로 옛 뜻 {t.rec.superseded}개 거둠</Pill> : null}</p>
              <p className="mt-1">사용자: {hide(t.user, showRaw)}</p>
              <p className="mt-1 whitespace-pre-wrap">ECHO: {t.assistant || "(말 없음)"}</p>
              {t.rec && <p className="mt-1 text-foreground-500">{t.rec.provider} · {t.rec.calls.map((c) => `${c.kind} ${c.model ?? "?"} ${c.ms}ms 입력 ${c.input_tokens ?? "?"} 출력 ${c.output_tokens ?? "?"}${c.error ? ` 오류 ${c.error}` : ""}`).join(" / ")} · 다시 청함 {t.rec.retry.join(",") || "0"}{t.rec.tone_mismatch_observed ? " · 말투 어긋남(추정)" : ""}{t.rec.record_error ? ` · 기록 저장 실패` : ""}</p>}
            </li>)}
          </ol>}
        </article>)}
      </section>}

      {load.kind === "ready" && tab === "profile" && <section className="flex flex-col gap-3">
        {sessions.filter((s) => s.profile).length === 0 && <EmptyRow>아직 끝난 대화가 없어 매칭 프로필이 없어요.</EmptyRow>}
        {sessions.filter((s) => s.profile).map((s) => { const p = s.profile as Record<string, { status?: string; items?: { note: string; quote: string }[]; value?: string | null }> & { inferred_candidates?: { trait: string }[]; user_corrections?: string[]; rejected_meanings?: string[] };
          return <article key={s.id} className="rounded-lg border border-background-200 px-4 py-3 text-xs">
            <p className="text-sm font-semibold">{s.nickname ?? s.user} <Pill tone="neutral">{s.handoff?.status ?? "상태 없음"}</Pill></p>
            <ul className="mt-2 flex flex-col gap-1">{PURPOSE_IDS.map((id) => <li key={id}><b>{AGENT_PURPOSE_LABELS[id]}</b> · {p[id]?.status ?? "기록 없음"}{p[id]?.items?.length ? ` — ${p[id].items!.map((i) => `${i.note}(「${hide(i.quote, showRaw)}」)`).join(", ")}` : ""}</li>)}</ul>
            <p className="mt-2">MBTI {p.mbti?.value ?? "UNKNOWN"} · 혈액형 {p.blood_type?.value ?? "UNKNOWN"} (직접 말했을 때만 CONFIRMED)</p>
            <p className="mt-1">추측(INFERRED · 매칭에 안 씀): {(p.inferred_candidates ?? []).map((i) => i.trait).join(", ") || "없음"}</p>
            <p className="mt-1">사진 {s.photos ? `${s.photos.count}장 · 대표 사진 ${s.photos.primary ? "있음" : "없음"} · 마지막으로 올린 날 ${fmtDate(s.photos.last_updated_at)}` : "기록 없음"} · 최근 2개월 확인 상태 = 기록 없음(저장 칸 없음)</p>
            <p className="mt-1">AI 소개 초안: {s.intro ? `${INTRO_STATUS[s.intro.status]} · ${s.intro.lines.length}문장 · 사용자 선택 ${s.intro.used ? INTRO_USED[s.intro.used] : "아직"}${Object.keys(s.intro.dropped).length ? ` · 버린 문장 ${Object.entries(s.intro.dropped).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}${s.intro.error ? ` · 실패 이유 ${s.intro.error}` : ""}` : "기록 없음(예전 대화)"}</p>
            {s.intro?.lines.length ? <p className="mt-1">초안: {hide(s.intro.lines.map((l) => l.text).join(" "), showRaw)}</p> : null}
            <p className="mt-1">연결 준비: 전화 인증 {s.readiness ? (s.readiness.phone_verified ? "했음" : "아직") : "기록 없음"} · 소개 저장 {s.readiness ? (s.readiness.intro_saved ? "있음" : "없음") : "기록 없음"} · 필수 사진 = 사진 장수로 판단</p>
            <p className="mt-1">정정 {(p.user_corrections ?? []).length}건 · 문제 삼은 질문·거둔 뜻 {(p.rejected_meanings ?? []).length}건 · 후보 0(연결 서버가 아직 이 프로필을 읽지 않음)</p>
          </article>; })}
      </section>}

      {load.kind === "ready" && tab === "candidates" && <section className="flex flex-col gap-3">
        {cands.every(({ c }) => !c.failure.length && !c.success.length) && <EmptyRow>아직 후보가 없어요.</EmptyRow>}
        {cands.flatMap(({ s, c }) => [...c.failure.map((x) => ({ x, s, ok: false })), ...c.success.map((x) => ({ x, s, ok: true }))]).map(({ x, s, ok }, k) => <article key={k} className="rounded-lg border border-background-200 px-4 py-3 text-xs">
          <p className="font-semibold"><Pill tone={ok ? "accent" : "danger"}>{ok ? "성공 후보" : "실패 후보"}</Pill> {x.type} · {x.evidence} · {x.status}</p>
          <p className="mt-1">{s.nickname ?? s.user}{x.turn ? ` · 턴 ${x.turn}` : ""} — {x.note}</p>
          <p className="mt-1 text-foreground-500">판: {x.version}</p>
          {x.user && <p className="mt-1">사용자: {hide(x.user, showRaw)}</p>}
          {x.agent && <p className="mt-1 whitespace-pre-wrap">ECHO: {x.agent}</p>}
        </article>)}
      </section>}

      {load.kind === "ready" && tab === "ai" && <section className="flex flex-col gap-3 text-xs">
        <p>다시 청함 {obs.retries}번 · 대체 모델(fallback) {obs.fallback}번 · 비용 = 확인 불가(공식 단가 미확인)</p>
        {obs.rows.length === 0 && <EmptyRow>아직 AI 호출 기록이 없어요.</EmptyRow>}
        {obs.rows.map((r) => <article key={r.key} className="rounded-lg border border-background-200 px-4 py-3">
          <p className="font-semibold">{r.key}</p>
          <p className="mt-1">호출 {r.calls} · 오류 {r.errors} · 지연 p50 {r.p50 ?? "-"}ms · p95 {r.p95 ?? "-"}ms · 토큰 입력 {r.input_tokens.toLocaleString()} · 출력 {r.output_tokens.toLocaleString()} · 비용 {r.cost}</p>
        </article>)}
      </section>}
    </div>
  );
}
