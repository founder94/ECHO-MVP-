import { useEffect, useRef, useState } from "react";
import { agentRef, refSeedBody, type RefLine } from "@/doit/lib/agentApi";
import { clearContentSeed, type ContentSeed } from "@/doit/lib/contentSeed";
import { UnderstandingError } from "@/doit/lib/understandingApi";
import "./ref-talk.css";

// 2026-10-05 Codex echo-spec 20261005 B · 대표 「사주·타로 최종 완성」: 결과 뒤 「ECHO와 이야기」 — 질문 기본 0.
// - 화면은 말을 만들지 않는다: 여는 한 줄·받아주기·(청했을 때만) 질문 하나는 모두 서버(agent_ref)가 준다.
// - 서버는 이 이야기를 저장하지 않는다(사실·프로필·매칭 0). 앞 줄 8개만 함께 보낸다.
// - 이야기 거리(결과 종류)는 서버가 여는 한 줄을 돌려준 뒤에 지운다(로그인 복귀·늦은 응답에도 유지).
// - 실패하면 적은 말은 입력칸에 그대로 · 다시 보내기는 누를 때만(같은 말 = 같은 요청 → 서버가 한 번만 부름).

type Line = RefLine & { question?: boolean };
type Fail = { kind: "limit" | "busy" | "not_ready" | "failed"; message: string } | null;
const FAIL_MESSAGE: Record<NonNullable<Fail>["kind"], string> = {
  limit: "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이어서 해 주세요.",
  busy: "요청이 몰렸어요. 조금 뒤에 다시 보내 주세요.",
  not_ready: "이야기 기능을 준비하고 있어요. 결과는 그대로 볼 수 있어요.",
  failed: "답을 만들지 못했어요. 적은 말은 그대로 있어요.",
};
const refFailKind = (code: string | undefined): NonNullable<Fail>["kind"] =>
  code === "AI_DAILY_LIMIT" ? "limit" : code === "BUSY" || code === "RATE_LIMITED" ? "busy" : code === "AI_NOT_CONFIGURED" || code === "NOT_FOUND" ? "not_ready" : "failed";
const ASK_TEXT = "질문 하나 해줘";

export function RefTalk({ userId, seed, onLeave }: { userId: string; seed: ContentSeed; onLeave: (to: "home" | "plan") => void }) {
  const ref = refSeedBody(seed);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [fail, setFail] = useState<Fail>(null);
  const [opened, setOpened] = useState(false);
  const busy = pending !== null;
  const endRef = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [lines, pending]);

  const ask = async (text: string, history: Line[]) => {
    setPending(text); setFail(null);
    try {
      const r = await agentRef(userId, ref, history.map(({ role, text: t }) => ({ role, text: t })), text);
      if (!alive.current) return;
      const next: Line[] = [...history, ...(text ? [{ role: "user" as const, text }] : []), { role: "echo", text: r.reply }];
      if (r.question) next.push({ role: "echo", text: r.question, question: true });
      setLines(next);
      if (!text) { setOpened(true); clearContentSeed(); } // 서버가 받은 뒤에 이야기 거리를 지운다
      else setDraft("");
    } catch (e) {
      if (!alive.current) return;
      const kind = refFailKind(e instanceof UnderstandingError ? e.code : undefined);
      setFail({ kind, message: FAIL_MESSAGE[kind] });
      if (text) setDraft(text); // 적은 말 보존
    } finally { if (alive.current) setPending(null); }
  };
  // 여는 한 줄(모델 호출 0 · 질문 0) — 한 번만
  useEffect(() => { void ask("", []); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 처음 한 번만

  const send = (text: string) => { const t = text.trim(); if (!t || busy || !opened) return; void ask(t, lines); };
  const leave = (to: "home" | "plan") => { clearContentSeed(); onLeave(to); };

  return (
    <section className="echo-dialogue echo-dialogue--pastel echo-ref" aria-labelledby="echo-ref-title">
      <header className="echo-ref-head">
        <p className="echo-eyebrow">{seed.source === "TAROT" ? "타로 카드" : "사주"} 참고 이야기</p>
        <h1 id="echo-ref-title" className="echo-ref-title">ECHO와 이야기</h1>
        <p className="echo-ref-note">ECHO는 먼저 묻지 않아요. 결과는 참고일 뿐이고, 여기서 한 말은 프로필이나 연결에 쓰이지 않아요.</p>
      </header>

      <div className="echo-ref-lines" aria-live="polite">
        {lines.map((l, i) => (
          <p key={i} className={`echo-ref-line echo-ref-line--${l.role}${l.question ? " echo-ref-line--question" : ""}`}>{l.text}</p>
        ))}
        {busy && <p className="echo-ref-line echo-ref-line--echo echo-ref-typing" aria-label="ECHO가 답을 쓰고 있어요"><span /><span /><span /></p>}
        <div ref={endRef} />
      </div>

      {fail && (
        <div className="echo-ref-fail" role="alert">
          <p>{fail.message}</p>
          {(fail.kind === "failed" || fail.kind === "busy") && (
            <button type="button" className="echo-ref-chip" disabled={busy} onClick={() => (opened ? send(draft) : void ask("", []))}>다시 보내기</button>
          )}
        </div>
      )}

      <form className="echo-ref-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <label htmlFor="echo-ref-text" className="echo-ref-sr">ECHO에게 할 말</label>
        <textarea id="echo-ref-text" value={draft} maxLength={500} rows={2} placeholder="떠오르는 걸 편하게 적어 주세요" disabled={!opened}
          onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="echo-ref-send" disabled={busy || !opened || !draft.trim()}>보내기</button>
      </form>

      <div className="echo-ref-actions">
        <button type="button" className="echo-ref-chip" disabled={busy || !opened} onClick={() => send(ASK_TEXT)}>질문 하나 받아 보기</button>
        <button type="button" className="echo-ref-chip" onClick={() => leave("plan")}>원하는 만남 알아보기</button>
        <button type="button" className="echo-ref-chip echo-ref-chip--quiet" onClick={() => leave("home")}>오늘은 여기까지</button>
      </div>
    </section>
  );
}
