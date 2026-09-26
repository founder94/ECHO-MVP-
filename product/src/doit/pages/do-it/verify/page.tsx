import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import { useAuth } from "@/doit/hooks/useAuth";
import { withTimeout } from "@/doit/lib/withTimeout";
import {
  PHONE_CODE_LENGTH, PHONE_ERROR_TEXT, PHONE_RESEND_SECONDS, PHONE_VERIFY_READY,
  confirmPhoneCode, maskPhone, normalizeKrPhone, onlyCodeDigits, phoneErrorKind, sendPhoneCode, syncPhoneVerification,
} from "@/doit/lib/phoneVerify";
import "@/doit/components/feature/connect.css";

// 전화 인증 — 연결 자격의 첫 칸. 예전 데모(1.5초 뒤 "완료" 표시)를 지우고 실제 문자 6자리 확인으로 바꿨다(2026-09-23).
// 인증됐는지는 화면이 정하지 않는다: Supabase Auth 가 확인 → 서버(doit-connect phone_sync)가 프로필에 반영.
// 빠져나갈 문: 언제든 「나중에 할게요」. 문자 서비스가 아직 준비 전이면 그렇게 알려 주고 막지 않는다.
type Step =
  | { kind: "loading" }
  | { kind: "enter" }
  | { kind: "code"; phone: string }
  | { kind: "done" };

const SEND_WAIT_MS = 20_000;
const SAFE_NEXT = /^\/doit\/[a-z0-9\-/?=&]*$/i;

export default function Verify() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextParam = params.get("next") ?? "";
  const next = SAFE_NEXT.test(nextParam) ? nextParam : "/doit/connections";
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const userId = user?.id ?? null;
  const alreadyConfirmed = !!user?.phone && !!user?.phone_confirmed_at;

  // 이미 인증한 계정이면(다른 기기에서 했거나 서버 반영만 늦은 경우) 서버에 맞추고 끝 화면으로.
  useEffect(() => {
    if (loading) return;
    if (!userId) { setStep({ kind: "enter" }); return; }
    if (!alreadyConfirmed) { setStep({ kind: "enter" }); return; }
    let current = true;
    syncPhoneVerification(userId)
      .then((verified) => { if (current) setStep(verified ? { kind: "done" } : { kind: "enter" }); })
      .catch(() => { if (current) { setStep({ kind: "done" }); setError("인증은 끝났어요. 연결 화면에 반영되기까지 조금 걸릴 수 있어요."); } });
    return () => { current = false; };
  }, [loading, userId, alreadyConfirmed]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => { if (step.kind === "code") codeRef.current?.focus(); }, [step.kind]);

  const send = async (phone: string) => {
    setBusy(true);
    setError(null);
    try {
      await withTimeout(sendPhoneCode(phone), SEND_WAIT_MS, "phone-send");
      setStep({ kind: "code", phone });
      setCode("");
      setCooldown(PHONE_RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error && e.name === "TimeoutError" ? "응답이 늦어요. 잠시 뒤 다시 눌러 주세요." : PHONE_ERROR_TEXT[phoneErrorKind(e)]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmitNumber = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const phone = normalizeKrPhone(number);
    if (!phone) { setError(PHONE_ERROR_TEXT.invalid_number); return; }
    void send(phone);
  };

  const onSubmitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || step.kind !== "code" || !userId) return;
    if (code.length !== PHONE_CODE_LENGTH) { setError(`문자로 받은 숫자 ${PHONE_CODE_LENGTH}자리를 적어 주세요.`); return; }
    setBusy(true);
    setError(null);
    try {
      await withTimeout(confirmPhoneCode(step.phone, code), SEND_WAIT_MS, "phone-verify");
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error && e.name === "TimeoutError" ? "응답이 늦어요. 잠시 뒤 다시 눌러 주세요." : PHONE_ERROR_TEXT[phoneErrorKind(e)]);
      return;
    }
    try {
      await syncPhoneVerification(userId);
    } catch {
      setError("인증은 끝났어요. 연결 화면에 반영되기까지 조금 걸릴 수 있어요.");
    }
    setBusy(false);
    setStep({ kind: "done" });
  };

  return (
    <MobileLayout title="전화 인증" back>
      <section className="doit-product-story doit-connect doit-verify">
        <p className="doit-product-kicker">PHONE</p>
        <h2 className="doit-product-title">한 사람이 한 계정만<br />쓰도록 확인해요.</h2>
        <p className="doit-product-description">연결은 인증한 사람끼리만 이어져요. 번호는 이 확인에만 쓰고, 상대에게 보이지 않아요.</p>

        {/* 2026-09-26 MVP FINAL PATCH: 문자 발송 업체가 연결되기 전(PHONE_VERIFY_READY=false)에는 번호 입력·문자 보내기 버튼을 보이지 않는다(작동하는 척 0). */}
        {!PHONE_VERIFY_READY ? <>
          <p className="doit-connect-note" role="status">전화 인증은 아직 준비 중이에요. 지금은 번호를 받거나 인증 문자를 보내지 않아요.</p>
          <Link className="doit-product-action" to={next}>돌아가기<span aria-hidden="true">↗</span></Link>
        </> : <>
        {(loading || step.kind === "loading") && <p className="doit-connect-note" role="status">로그인 상태를 확인하고 있어요.</p>}

        {!loading && !user && step.kind !== "loading" && (
          <>
            <p className="doit-connect-note">로그인한 뒤에 인증할 수 있어요.</p>
            <Link className="doit-product-action" to="/login" state={{ from: `/doit/verify?next=${encodeURIComponent(next)}` }}>로그인하기<span aria-hidden="true">↗</span></Link>
          </>
        )}

        {user && step.kind === "enter" && (
          <form className="doit-connect-form" onSubmit={onSubmitNumber} noValidate>
            <label className="doit-connect-label" htmlFor="doit-phone">휴대폰 번호</label>
            <input
              id="doit-phone" className="doit-connect-input" type="tel" inputMode="tel" autoComplete="tel-national"
              placeholder="010-1234-5678" value={number} maxLength={16}
              onChange={(e) => { setNumber(e.target.value); if (error) setError(null); }}
              aria-invalid={error ? true : undefined} aria-describedby={error ? "doit-verify-error" : undefined}
            />
            <button className="doit-product-action" type="submit" disabled={busy || !number.trim()}>
              {busy ? "문자를 보내는 중" : "인증 문자 받기"}<span aria-hidden="true">↗</span>
            </button>
          </form>
        )}

        {user && step.kind === "code" && (
          <form className="doit-connect-form" onSubmit={onSubmitCode} noValidate>
            <p className="doit-connect-note">{maskPhone(step.phone)} 으로 보낸 숫자 {PHONE_CODE_LENGTH}자리를 적어 주세요.</p>
            <label className="doit-connect-label" htmlFor="doit-code">인증 숫자</label>
            <input
              id="doit-code" ref={codeRef} className="doit-connect-input doit-connect-input--code" type="text" inputMode="numeric"
              autoComplete="one-time-code" pattern="[0-9]*" maxLength={PHONE_CODE_LENGTH} value={code}
              onChange={(e) => { setCode(onlyCodeDigits(e.target.value)); if (error) setError(null); }}
              aria-invalid={error ? true : undefined} aria-describedby={error ? "doit-verify-error" : undefined}
            />
            <button className="doit-product-action" type="submit" disabled={busy || code.length !== PHONE_CODE_LENGTH}>
              {busy ? "확인하는 중" : "확인하기"}<span aria-hidden="true">↗</span>
            </button>
            <div className="doit-connect-row">
              <button type="button" className="doit-connect-link" disabled={busy || cooldown > 0} onClick={() => void send(step.phone)}>
                {cooldown > 0 ? `문자 다시 받기 (${cooldown}초 뒤)` : "문자 다시 받기"}
              </button>
              <button type="button" className="doit-connect-link" disabled={busy} onClick={() => { setStep({ kind: "enter" }); setCode(""); setError(null); }}>
                번호 다시 적기
              </button>
            </div>
          </form>
        )}

        {step.kind === "done" && (
          <>
            <p className="doit-connect-done" role="status">전화 인증을 마쳤어요.</p>
            <button type="button" className="doit-product-action" onClick={() => navigate(next)}>연결 화면으로 가기<span aria-hidden="true">↗</span></button>
          </>
        )}

        {error && <p id="doit-verify-error" className="doit-product-error" role="alert">{error}</p>}

        {step.kind !== "done" && (
          <button type="button" className="doit-product-action doit-product-action--secondary" onClick={() => navigate(next)}>
            나중에 할게요<span aria-hidden="true">↗</span>
          </button>
        )}
        </>}
      </section>
    </MobileLayout>
  );
}
