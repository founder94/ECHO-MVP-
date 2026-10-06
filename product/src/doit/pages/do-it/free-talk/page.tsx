import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import { useAuth } from "@/doit/hooks/useAuth";
import { agentFree, agentFreeStatus, type FreeStatus, type RefLine } from "@/doit/lib/agentApi";
import { UnderstandingError } from "@/doit/lib/understandingApi";
import "./free-talk.css";

// 「나를 기억하는 ECHO와 무엇이든 대화」(2026-10-06 대표 승인 C). 서버 스위치 기본 끔 — 꺼져 있으면 「아직 열리지 않았어요」만.
// - 답은 서버가 준 그대로 · 화면에 「AI 응답」 표시 · 모델 이름 표시 0.
// - 이 대화 글은 서버에 저장하지 않는다(앞 줄 8개만 함께 보냄). 결제는 아직 연결하지 않았다(가격·결제 = 대표 승인 대상).
type Line = RefLine & { blocked?: boolean };
const FAIL: Record<string, string> = {
  FREE_CHAT_TRIAL_DONE: "맛보기를 다 썼어요. 계속 이야기하려면 이용권이 필요해요(준비 중).",
  FREE_CHAT_DAILY: "오늘은 여기까지예요. 내일 다시 이야기해요.",
  FREE_CHAT_MONTH: "이번 달은 여기까지예요. 다음 달에 다시 이야기해요.",
  FREE_CHAT_COMPANY: "지금은 자유 대화를 잠시 멈췄어요.",
  FREE_CHAT_OFF: "아직 열리지 않았어요.",
  AI_DAILY_LIMIT: "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이어서 해 주세요.",
};
const STOP_CODES = new Set(["FREE_CHAT_TRIAL_DONE", "FREE_CHAT_DAILY", "FREE_CHAT_MONTH", "FREE_CHAT_COMPANY", "FREE_CHAT_OFF", "AI_DAILY_LIMIT", "FREE_CHAT_PRICE_UNKNOWN", "FREE_CHAT_PROVIDER"]);

export default function FreeTalk() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<FreeStatus | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<{ message: string; stop: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (loading || !user) return; agentFreeStatus(user.id).then(setStatus).catch(() => setStatus({ enabled: false, entitled: false, trial_left: 0 })); }, [user, loading]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [lines, busy]);

  const send = async () => {
    const t = draft.trim();
    if (!user || !t || busy || fail?.stop) return;
    setBusy(true); setFail(null);
    try {
      const r = await agentFree(user.id, lines.filter((l) => !l.blocked).map(({ role, text }) => ({ role, text })), t);
      setLines((prev) => [...prev, { role: "user", text: t, blocked: !!r.blocked }, { role: "echo", text: r.reply, blocked: !!r.blocked }]);
      setDraft("");
      if (!r.blocked && status && !status.entitled && typeof status.trial_left === "number") setStatus({ ...status, trial_left: Math.max(0, status.trial_left - 1) });
    } catch (e) {
      const code = e instanceof UnderstandingError ? e.code : "";
      setFail({ message: FAIL[code] ?? "답을 만들지 못했어요. 적은 말은 그대로 있어요.", stop: STOP_CODES.has(code) });
    } finally { setBusy(false); }
  };

  const off = status !== null && !status.enabled;
  return (
    <MobileLayout title="무엇이든 이야기" back>
      <div className="doit-free">
        <h1 className="doit-free-title">나를 기억하는 ECHO와 무엇이든 대화</h1>
        <p className="doit-free-lead">ECHO는 내가 확인하고 고친 것만 기억한 채로 이야기해요. 아니라고 한 것은 다시 단정하지 않아요. 여기서 한 말은 저장하지 않아요.</p>
        {!user && !loading && <p className="doit-free-note">로그인하면 이야기할 수 있어요. <Link to="/login">로그인</Link></p>}
        {off && <p className="doit-free-note" role="status">아직 열리지 않았어요. 열리면 가장 먼저 알려 드릴게요.</p>}
        {status?.enabled && !status.entitled && <p className="doit-free-badge" role="status">맛보기 {status.trial_left ?? 0}번 남았어요</p>}
        <div className="doit-free-lines" aria-live="polite">
          {lines.map((l, i) => <div key={i} className={`doit-free-line doit-free-line--${l.role}`}>
            {l.role === "echo" && <span className="doit-free-ai">AI 응답</span>}
            <p>{l.text}</p>
          </div>)}
          {busy && <p className="doit-free-line doit-free-line--echo" role="status">답을 쓰고 있어요…</p>}
          <div ref={endRef} />
        </div>
        {fail && <p className="doit-free-fail" role="alert">{fail.message}</p>}
        {status?.enabled && <form className="doit-free-input" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label htmlFor="doit-free-text" className="doit-free-sr">ECHO에게 할 말</label>
          <textarea id="doit-free-text" value={draft} maxLength={500} rows={2} placeholder="무엇이든 편하게 적어 주세요" disabled={busy || !!fail?.stop} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" disabled={busy || !draft.trim() || !!fail?.stop}>보내기</button>
        </form>}
        <p className="doit-free-fine">ECHO는 사람이 아니라 AI예요. 건강·결혼·돈·앞날을 대신 정해 주지 않아요. 힘든 마음이 크면 109(자살예방상담전화)에서 바로 이야기를 들어 줄 수 있어요.</p>
      </div>
    </MobileLayout>
  );
}
