import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import { useAuth } from "@/doit/hooks/useAuth";
import { agentMemory, agentMemoryForget, type MemoryLine, type MemoryView } from "@/doit/lib/agentApi";
import "./known.css";

// 「ECHO가 아는 나」(2026-10-06 대표 승인 「기억하는 AI」 A-4): 서버(doit-agent)가 지금 기억하는 것을 네 묶음으로 보여 주고, 줄마다 지울 수 있다.
// - 화면은 글을 만들지 않는다(서버가 준 줄 그대로). 민감 주제(건강·성·돈) 줄은 서버가 글을 비워 보내고, 여기서는 「가려 둔 줄」로만 보인다.
// - 「아니라고 한 것」은 다시 단정하지 않으려고 남겨 두는 줄이라 지우기가 없다.
type State = { kind: "loading" } | { kind: "signed_out" } | { kind: "empty" } | { kind: "ok"; memory: MemoryView } | { kind: "error" };
const GROUPS: { key: keyof MemoryView; title: string; note: string }[] = [
  { key: "confirmed", title: "내가 확인한 것", note: "내가 직접 말하거나 맞다고 한 것이에요." },
  { key: "corrected", title: "내가 고친 것", note: "고친 내용이 앞선 것보다 먼저예요." },
  { key: "guessed", title: "AI 짐작", note: "내 말을 AI가 정리했거나 짐작한 것이에요. 내가 확인한 건 아니에요. 틀리면 지워 주세요." },
  { key: "rejected", title: "아니라고 한 것", note: "다시 단정하지 않으려고 남겨 두어요." },
];

export default function Known() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async (uid: string) => {
    setState({ kind: "loading" });
    try { const m = await agentMemory(uid); setState(m ? { kind: "ok", memory: m } : { kind: "empty" }); } catch { setState({ kind: "error" }); }
  }, []);
  useEffect(() => { if (loading) return; if (!user) { setState({ kind: "signed_out" }); return; } void load(user.id); }, [user, loading, load]);

  const forget = async (line: MemoryLine) => {
    if (!user || busyId) return;
    setBusyId(line.id); setNote(null);
    try { const m = await agentMemoryForget(user.id, line.id); setState({ kind: "ok", memory: m }); setNote("지웠어요. 이 내용은 다시 쓰지 않아요."); }
    catch { setNote("지우지 못했어요. 잠시 뒤 다시 눌러 주세요."); }
    finally { setBusyId(null); }
  };

  return (
    <MobileLayout title="ECHO가 아는 나" back>
      <div className="doit-known">
        <h1 className="doit-known-title">ECHO가 지금 기억하는 나</h1>
        <p className="doit-known-lead">고친 내용은 끝까지 고친 대로 기억해요. 지우고 싶은 줄은 지울 수 있어요.</p>
        {state.kind === "loading" && <p className="doit-known-empty" role="status">불러오고 있어요.</p>}
        {state.kind === "signed_out" && <p className="doit-known-empty">로그인하면 볼 수 있어요. <Link to="/login">로그인</Link></p>}
        {state.kind === "error" && <p className="doit-known-empty" role="alert">불러오지 못했어요. <button type="button" onClick={() => user && void load(user.id)}>다시 불러오기</button></p>}
        {state.kind === "empty" && <p className="doit-known-empty">아직 기억한 것이 없어요. <Link to="/doit/conversation">ECHO와 이야기하기</Link></p>}
        {note && <p className="doit-known-note" role="status">{note}</p>}
        {state.kind === "ok" && GROUPS.map((g) => {
          const lines = state.memory[g.key];
          return <section key={g.key} className="doit-known-group" aria-label={g.title}>
            <h2>{g.title} <span>{lines.length}</span></h2>
            <p className="doit-known-group-note">{g.note}</p>
            {lines.length === 0 ? <p className="doit-known-none">없어요.</p> :
              <ul>{lines.map((l) => <li key={l.id}>
                <span className={l.hidden ? "doit-known-hidden" : undefined}>{l.hidden ? "민감한 내용이라 가려 두었어요" : l.text}</span>
                {l.can_forget && <button type="button" disabled={!!busyId} onClick={() => void forget(l)} aria-label={l.hidden ? "가려 둔 줄 지우기" : `「${l.text}」 지우기`}>{busyId === l.id ? "지우는 중" : "지우기"}</button>}
              </li>)}</ul>}
          </section>;
        })}
      </div>
    </MobileLayout>
  );
}
