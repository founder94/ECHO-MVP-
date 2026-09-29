import { useCallback, useEffect, useRef, useState } from "react";
import { PASSKEY_ERROR_TEXT, currentPasskeySupport, listFaces, registerFace, removeFace, type FaceDevice, type PasskeyErrorKind } from "@/lib/auth/passkey";

// 설정 → 얼굴·지문 로그인 (대표 2026-09-24 "얼굴로그인 진행해").
// 로그인한 사람만 쓴다. 지금 쓰는 휴대폰을 등록하면, 다음부터 로그인 화면에서 얼굴·지문으로 들어온다.
// 얼굴·지문 자체는 휴대폰 밖으로 나가지 않는다(이 화면도 서버도 받지 않는다).
type ListState = { kind: "loading" } | { kind: "ready"; devices: FaceDevice[] } | { kind: "error"; error: PasskeyErrorKind };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default function FaceLoginSettings() {
  const [support] = useState(currentPasskeySupport);
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [busy, setBusy] = useState<null | "register" | string>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    const out = await listFaces();
    if (mine !== seq.current) return;
    setList(out.ok ? { kind: "ready", devices: out.devices } : { kind: "error", error: out.kind ?? "unknown" });
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function register() {
    if (busy) return;
    setBusy("register");
    setMessage(null);
    const out = await registerFace();
    setBusy(null);
    if (out.ok) {
      setMessage({ tone: "ok", text: "등록했어요. 다음부터 로그인 화면에서 「얼굴·지문으로 로그인」을 누르면 돼요." });
      await refresh();
    } else {
      setMessage({ tone: out.kind === "exists" ? "ok" : "error", text: PASSKEY_ERROR_TEXT[out.kind ?? "unknown"] });
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(id);
    setMessage(null);
    const out = await removeFace(id);
    setBusy(null);
    setConfirmId(null);
    if (out.ok) {
      setMessage({ tone: "ok", text: "지웠어요. 그 기기로는 더 이상 얼굴로 로그인하지 않아요." });
      await refresh();
    } else {
      setMessage({ tone: "error", text: PASSKEY_ERROR_TEXT[out.kind ?? "unknown"] });
    }
  }

  const serverOff = list.kind === "error" && list.error === "disabled";

  return (
    <section className="doit-settings-section doit-face" aria-labelledby="settings-face-heading">
      <h3 id="settings-face-heading" className="doit-settings-heading">얼굴·지문 로그인</h3>
      <div className="doit-settings-note">
        <h4>비밀번호 대신 얼굴·지문으로 들어와요</h4>
        <p>아이폰은 Face ID, 갤럭시는 지문이나 화면 잠금으로 확인해요. 얼굴·지문 정보는 휴대폰 밖으로 나가지 않고, DO IT 도 받지 않아요.</p>

        {support === "in-app" && <p className="doit-face-state">카카오톡 같은 앱 안에서는 등록할 수 없어요. 사파리나 크롬에서 https://app.do-it.company 를 열어 주세요.</p>}
        {support === "unsupported" && <p className="doit-face-state">이 브라우저는 얼굴·지문 로그인을 지원하지 않아요. 휴대폰의 사파리나 크롬에서 열어 주세요.</p>}

        {support === "ok" && serverOff && <p className="doit-face-state">얼굴 로그인은 아직 켜지지 않았어요. 켜지면 여기서 바로 등록할 수 있어요.</p>}

        {support === "ok" && !serverOff && (
          <button type="button" className="doit-settings-mail doit-face-register" onClick={() => { void register(); }} disabled={!!busy} aria-busy={busy === "register"}>
            {busy === "register" ? "얼굴을 확인하는 중" : "지금 이 휴대폰 등록하기"}<i className="ri-fingerprint-line" aria-hidden="true" />
          </button>
        )}

        {message && <p className={message.tone === "ok" ? "doit-face-ok" : "doit-product-error"} role={message.tone === "ok" ? "status" : "alert"}>{message.text}</p>}

        {list.kind === "ready" && list.devices.length > 0 && (
          <ul className="doit-face-list" aria-label="등록한 기기">
            {list.devices.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.name}</strong>
                  <span>{formatDate(d.createdAt)} 등록{d.lastUsedAt ? ` · 마지막 사용 ${formatDate(d.lastUsedAt)}` : ""}</span>
                </div>
                {confirmId === d.id ? (
                  <span className="doit-face-confirm">
                    <button type="button" onClick={() => { void remove(d.id); }} disabled={!!busy}>{busy === d.id ? "지우는 중" : "지울게요"}</button>
                    <button type="button" onClick={() => setConfirmId(null)} disabled={!!busy}>그대로 둘게요</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmId(d.id)} disabled={!!busy}>지우기</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {list.kind === "ready" && list.devices.length === 0 && support === "ok" && <p className="doit-settings-mail-address">아직 등록한 기기가 없어요.</p>}
        {list.kind === "error" && !serverOff && <p className="doit-settings-mail-address">등록한 기기 목록을 불러오지 못했어요. 등록은 그대로 할 수 있어요.</p>}
        <p className="doit-settings-mail-address">얼굴 로그인이 안 되는 날에도 이메일·Google 로그인은 그대로 쓸 수 있어요.</p>
      </div>
    </section>
  );
}
