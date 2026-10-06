import { useEffect, useRef, useState } from "react";
import { agentHome, agentRef, agentSelfNote, refSeedBody, type FreeTalkStatus, type RefLine } from "@/doit/lib/agentApi";
import { Link } from "react-router-dom";
import { clearContentSeed, type ContentSeed } from "@/doit/lib/contentSeed";
import { UnderstandingError } from "@/doit/lib/understandingApi";
import "./ref-talk.css";

// 2026-10-05 Codex echo-spec 20261005 B · 대표 「사주·타로 최종 완성」: 결과 뒤 「ECHO와 이야기」 — 질문 기본 0.
// - 화면은 말을 만들지 않는다: 여는 한 줄·받아주기·(청했을 때만) 질문 하나는 모두 서버(agent_ref)가 준다.
// - 서버는 이 이야기를 저장하지 않는다(사실·프로필·매칭 0). 앞 줄 8개만 함께 보낸다.
// - 이야기 거리(결과 종류)는 서버가 여는 한 줄을 돌려준 뒤에 지운다(로그인 복귀·늦은 응답에도 유지).
// - 실패하면 적은 말은 입력칸에 그대로 · 다시 보내기는 누를 때만(같은 말 = 같은 요청 → 서버가 한 번만 부름).
// - 2026-10-06 대표 「사주·타로 정정 → 매칭 사용」: 해석을 부정하고 자기 말로 고치면 서버가 고정 영수증(「사주보다 당신 말이 맞아요…」)과 고친 문장(correction)을 준다.
//   화면은 「이 말, 내 프로필에도 반영할까요?」를 한 번만 묻고, [반영할게요]일 때만 서버(agent_self_note)에 남긴다. 해석 원문은 어디에도 남지 않는다(매칭 사용 0 유지).

type Line = RefLine & { question?: boolean; receipt?: boolean };
type Offer = { text: string; state: "ask" | "saving" | "saved" | "declined" | "failed" } | null;
type Fail = { kind: "limit" | "busy" | "not_ready" | "paused" | "private" | "failed"; message: string } | null;
const FAIL_MESSAGE: Record<NonNullable<Fail>["kind"], string> = {
  limit: "오늘 쓸 수 있는 대화량을 다 썼어요. 내일 다시 이어서 해 주세요.",
  busy: "요청이 몰렸어요. 조금 뒤에 다시 보내 주세요.",
  not_ready: "이야기 기능을 준비하고 있어요. 결과는 그대로 볼 수 있어요.",
  paused: "지금은 이야기 기능을 잠시 멈췄어요. 적은 말은 그대로 있어요.", // 회사 AI 예산으로 멈춤 — 바로 다시 보내도 같아서 「다시 보내기」 0
  private: "연락처·번호·링크는 여기에 적지 않아요. 그 부분만 빼고 다시 적어 주세요.", // 서버가 모델에 보내지 않음 — 고쳐 보내면 새 요청
  failed: "답을 만들지 못했어요. 적은 말은 그대로 있어요.",
};
const refFailKind = (code: string | undefined): NonNullable<Fail>["kind"] =>
  code === "AI_COMPANY_BUDGET" ? "paused" : code === "PRIVATE_DATA" ? "private" : code === "AI_DAILY_LIMIT" ? "limit" : code === "BUSY" || code === "RATE_LIMITED" ? "busy" : code === "AI_NOT_CONFIGURED" || code === "NOT_FOUND" ? "not_ready" : "failed";
const ASK_TEXT = "질문 하나 해줘";

export function RefTalk({ userId, seed, onLeave }: { userId: string; seed: ContentSeed; onLeave: (to: "home" | "plan") => void }) {
  const ref = refSeedBody(seed);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [fail, setFail] = useState<Fail>(null);
  const [opened, setOpened] = useState(false);
  const [lastFail, setLastFail] = useState<{ text: string; fromDraft: boolean } | null>(null); // 실패한 그 요청을 「다시 보내기」로 그대로
  const [offer, setOffer] = useState<Offer>(null); // 고친 문장을 프로필에도 반영할지 한 번 묻기(서버 correction 이 왔을 때만)
  const [free, setFree] = useState<FreeTalkStatus | null>(null); // 2026-10-06 자유 대화 스위치(서버) — 켜져 있을 때만 「무엇이든 이야기하기」 안내
  useEffect(() => { let live = true; agentHome(userId).then((r) => { if (live) setFree(r.free_talk); }).catch(() => undefined); return () => { live = false; }; }, [userId]);
  const busy = pending !== null;
  const endRef = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [lines, pending]);

  // 검수(P2): 입력칸은 「입력칸 글을 보낸 때」만 건드린다 — 「질문 하나 받아 보기」 버튼은 적어 둔 글을 지우거나 바꾸지 않는다.
  const ask = async (text: string, history: Line[], fromDraft = false) => {
    setPending(text); setFail(null); setLastFail(null);
    try {
      const r = await agentRef(userId, ref, history.map(({ role, text: t }) => ({ role, text: t })), text);
      if (!alive.current) return;
      const next: Line[] = [...history, ...(text ? [{ role: "user" as const, text }] : []), { role: "echo", text: r.reply, receipt: !!r.correction }];
      if (r.question) next.push({ role: "echo", text: r.question, question: true });
      setLines(next);
      if (r.correction) setOffer({ text: r.correction.text, state: "ask" }); // 서버가 정정으로 받은 뒤에만 묻는다(화면이 먼저 정하지 않음)
      if (!text) { setOpened(true); clearContentSeed(); } // 서버가 받은 뒤에 이야기 거리를 지운다
      else if (fromDraft) setDraft("");
    } catch (e) {
      if (!alive.current) return;
      const kind = refFailKind(e instanceof UnderstandingError ? e.code : undefined);
      setFail({ kind, message: FAIL_MESSAGE[kind] });
      if (text && fromDraft) setDraft(text); // 적은 말 보존
      if (text) setLastFail({ text, fromDraft });
    } finally { if (alive.current) setPending(null); }
  };
  // 여는 한 줄(모델 호출 0 · 질문 0) — 한 번만
  useEffect(() => { void ask("", []); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 처음 한 번만

  const send = (text: string, fromDraft = true) => { const t = text.trim(); if (!t || busy || !opened) return; void ask(t, lines, fromDraft); };
  // [반영할게요] = 사용자가 직접 누른 그 한 번만 서버에 남긴다(고친 자기 문장만 · 해석 원문 0). 실패하면 적은 말은 그대로, 다시 누르면 새 요청.
  const keep = async () => {
    if (!offer || offer.state === "saving" || offer.state === "saved") return;
    setOffer({ ...offer, state: "saving" });
    try { await agentSelfNote(userId, offer.text, "ref_correction"); if (alive.current) setOffer({ ...offer, state: "saved" }); }
    catch { if (alive.current) setOffer({ ...offer, state: "failed" }); }
  };
  const leave = (to: "home" | "plan") => { clearContentSeed(); onLeave(to); };

  return (
    <section className="echo-dialogue echo-dialogue--pastel echo-ref" aria-labelledby="echo-ref-title">
      <header className="echo-ref-head">
        <p className="echo-eyebrow">{seed.source === "TAROT" ? "타로 카드" : "사주"} 참고 이야기</p>
        <h1 id="echo-ref-title" className="echo-ref-title">ECHO와 이야기</h1>
        <p className="echo-ref-note">ECHO는 먼저 묻지 않아요. 결과는 참고일 뿐이고, 여기서 한 말은 프로필이나 연결에 쓰이지 않아요. 내가 직접 「반영할게요」를 누른 내 문장만 남아요.</p>
      </header>

      <div className="echo-ref-lines" aria-live="polite">
        {lines.map((l, i) => (
          <p key={i} className={`echo-ref-line echo-ref-line--${l.role}${l.question ? " echo-ref-line--question" : ""}${l.receipt ? " echo-ref-line--receipt" : ""}`}>{l.text}</p>
        ))}
        {offer && (
          <div className="echo-ref-offer" role="group" aria-label="프로필 반영 확인">
            {offer.state === "saved" ? <p>반영했어요. 「ECHO가 아는 나」에서 볼 수 있고, 거기서 지울 수도 있어요.</p>
              : offer.state === "declined" ? <p>알겠어요. 여기서만 기억하고 프로필에는 넣지 않을게요.</p>
              : <>
                <p>이 말, 내 프로필에도 반영할까요? <b>「{offer.text}」</b></p>
                {offer.state === "failed" && <p className="echo-ref-offer-fail">반영하지 못했어요. 다시 눌러 주세요.</p>}
                <div className="echo-ref-offer-actions">
                  <button type="button" className="echo-ref-chip" disabled={offer.state === "saving"} onClick={() => void keep()}>{offer.state === "saving" ? "반영하는 중" : "반영할게요"}</button>
                  <button type="button" className="echo-ref-chip echo-ref-chip--quiet" disabled={offer.state === "saving"} onClick={() => setOffer({ ...offer, state: "declined" })}>여기서만 기억</button>
                </div>
              </>}
          </div>
        )}
        {busy && <p className="echo-ref-line echo-ref-line--echo echo-ref-typing" aria-label="ECHO가 답을 쓰고 있어요"><span /><span /><span /></p>}
        <div ref={endRef} />
      </div>

      {fail && (
        <div className="echo-ref-fail" role="alert">
          <p>{fail.message}</p>
          {(fail.kind === "failed" || fail.kind === "busy") && (
            <button type="button" className="echo-ref-chip" disabled={busy} onClick={() => (opened ? (lastFail && !lastFail.fromDraft ? send(lastFail.text, false) : send(draft)) : void ask("", []))}>다시 보내기</button>
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
        <button type="button" className="echo-ref-chip" disabled={busy || !opened} onClick={() => send(ASK_TEXT, false)}>질문 하나 받아 보기</button>
        <button type="button" className="echo-ref-chip" onClick={() => leave("plan")}>원하는 만남 알아보기</button>
        <button type="button" className="echo-ref-chip echo-ref-chip--quiet" onClick={() => leave("home")}>오늘은 여기까지</button>
      </div>
      {/* C.9 결제 안내 노출 시점 = 정해진 흐름 끝(여기)에서 범위 밖 이야기로 넘어갈 때 · 서버 스위치가 켜져 있고 맛보기나 권한이 있을 때만 · 가격 숫자 0 */}
      {free?.enabled && (free.entitled || (free.trial_left ?? 0) > 0) && (
        <p className="echo-ref-note echo-talk-notice">여기부터는 ECHO가 당신을 기억한 채로, 무엇이든 이야기해요.{!free.entitled && ` 맛보기 ${free.trial_left}번 남았어요.`} <Link to="/doit/talk" className="echo-ref-chip">무엇이든 이야기하기</Link></p>
      )}
    </section>
  );
}
