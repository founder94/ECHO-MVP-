import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { accountFailure, clearLocalTraces, deleteMyAccount, fetchDeletePreview, type AccountFailure, type DeletePreview } from "@/doit/lib/accountApi";

// 설정 → 회원 탈퇴 (대표 2026-09-24 "출시 1.0 진행해").
// 순서: 지워지는 것 보기 → "되돌릴 수 없다" 확인 → 탈퇴. 두 번 확인해야 지운다.
// 빠져나갈 문: 앱에서 못 지우는 경우(서버 없음·관리자·결제 기록)는 언제나 아래 메일로 요청할 수 있다.
// 이 화면은 사용자 번호를 서버에 보내지 않는다 — 서버가 로그인 토큰의 주인만 지운다.
export const SUPPORT_EMAIL = "0423doit@gmail.com";

type Step =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "preview"; preview: DeletePreview }
  | { kind: "deleting"; preview: DeletePreview }
  | { kind: "failed"; failure: AccountFailure; preview: DeletePreview | null }
  | { kind: "done" };

interface Props {
  userId: string | null;
  authLoading: boolean;
}

export default function AccountDeletion({ userId, authLoading }: Props) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [agreed, setAgreed] = useState(false);
  const inFlight = useRef(false);

  async function openPreview() {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    setStep({ kind: "loading" });
    setAgreed(false);
    try {
      setStep({ kind: "preview", preview: await fetchDeletePreview(userId) });
    } catch (e) {
      setStep({ kind: "failed", failure: accountFailure(e), preview: null });
    } finally {
      inFlight.current = false;
    }
  }

  async function confirmDelete(preview: DeletePreview) {
    if (!userId || !agreed || !preview.canDelete || inFlight.current) return;
    inFlight.current = true;
    setStep({ kind: "deleting", preview });
    try {
      await deleteMyAccount(userId);
    } catch (e) {
      inFlight.current = false;
      setStep({ kind: "failed", failure: accountFailure(e), preview });
      return;
    }
    // 계정은 서버에서 이미 지워졌다. 이 기기의 로그인 상태와 흔적만 정리한다(local = 이 기기만).
    // 로그인 서버가 "없는 계정"이라고 답해도 supabase-js 는 이 기기의 로그인을 지운다.
    clearLocalTraces(userId);
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* 이미 지워진 계정 — 화면만 정리하면 된다 */ }
    inFlight.current = false;
    setStep({ kind: "done" });
  }

  function close() {
    if (inFlight.current) return;
    setAgreed(false);
    setStep({ kind: "idle" });
  }

  const mail = (
    <>
      <a className="doit-settings-mail" href={`mailto:${SUPPORT_EMAIL}`}>
        메일로 요청하기<span aria-hidden="true">↗</span>
      </a>
      <p className="doit-settings-mail-address">{SUPPORT_EMAIL}</p>
    </>
  );

  if (step.kind === "done") {
    return (
      <div className="doit-settings-note doit-leave" role="status">
        <h4>탈퇴했어요</h4>
        <p>내 계정과 기록, 사진을 모두 지웠어요. 그동안 함께해 줘서 고마워요.</p>
        <Link className="doit-settings-mail" to="/" replace>처음 화면으로<span aria-hidden="true">↗</span></Link>
      </div>
    );
  }

  const preview = step.kind === "preview" || step.kind === "deleting" ? step.preview : step.kind === "failed" ? step.preview : null;
  const deleting = step.kind === "deleting";

  return (
    <div className="doit-settings-note doit-leave">
      <h4>회원 탈퇴</h4>
      <p>탈퇴하면 내 계정과 기록이 모두 지워지고, 되돌릴 수 없어요.</p>

      {!authLoading && !userId && <p>로그인한 뒤에 탈퇴할 수 있어요. 로그인이 안 되면 메일로 요청해 주세요.</p>}

      {userId && step.kind === "idle" && (
        <button type="button" className="doit-settings-mail doit-leave-open" onClick={() => { void openPreview(); }}>
          탈퇴 전에 지워지는 것 보기<span aria-hidden="true">›</span>
        </button>
      )}

      {step.kind === "loading" && <p role="status">지워질 기록을 세는 중이에요.</p>}

      {preview && (
        <div className="doit-leave-preview">
          <p className="doit-leave-label">지워지는 것</p>
          <ul>
            <li>내가 적은 답 {preview.counts.answers}개</li>
            <li>AI가 정리한 내 이야기 {preview.counts.insights}개</li>
            <li>사진 {preview.counts.photos}장</li>
            <li>연결 {preview.counts.matches}개 <span>상대 화면에서도 사라져요</span></li>
            <li>로그인 정보 <span>이메일·전화번호·얼굴 로그인 등록</span></li>
          </ul>

          {!preview.canDelete && <p className="doit-product-error" role="alert">{preview.blockedReason ?? "지금은 앱에서 바로 탈퇴할 수 없어요. 메일로 요청해 주세요."}</p>}

          {preview.canDelete && step.kind !== "failed" && (
            <>
              <label className="doit-leave-check">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={deleting} />
                <span>되돌릴 수 없다는 걸 알고 있어요</span>
              </label>
              <div className="doit-leave-actions">
                <button type="button" className="doit-leave-confirm" onClick={() => { void confirmDelete(preview); }} disabled={!agreed || deleting} aria-busy={deleting}>
                  {deleting ? "지우는 중이에요" : "탈퇴하고 모두 지우기"}
                </button>
                <button type="button" className="doit-leave-cancel" onClick={close} disabled={deleting}>그대로 둘게요</button>
              </div>
            </>
          )}
        </div>
      )}

      {step.kind === "failed" && (
        <>
          <p className="doit-product-error" role="alert">{step.failure.message}</p>
          <div className="doit-leave-actions">
            {step.failure.kind === "retry" && step.preview?.canDelete && (
              <button type="button" className="doit-leave-confirm" onClick={() => { setStep({ kind: "preview", preview: step.preview as DeletePreview }); setAgreed(false); }}>다시 해 보기</button>
            )}
            {step.failure.kind === "signin" && <Link className="doit-leave-cancel" to="/login" state={{ from: "/doit/settings" }}>다시 로그인하기</Link>}
            <button type="button" className="doit-leave-cancel" onClick={close}>닫기</button>
          </div>
        </>
      )}

      <p className="doit-leave-mail-note">앱에서 탈퇴가 안 되면 메일로 요청해 주세요.</p>
      {mail}
    </div>
  );
}
