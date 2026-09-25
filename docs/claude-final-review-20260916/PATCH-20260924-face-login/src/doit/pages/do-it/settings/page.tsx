import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import { useAuth } from "@/doit/hooks/useAuth";
import FaceLoginSettings from "./FaceLoginSettings";
import "./settings.css";

// 기존 홈페이지 Footer에 공개된 고객 문의 주소를 재사용한다.
// 메일 앱만 연다. 이 화면에서 문의·삭제·탈퇴 요청을 전송하거나 접수하지 않는다.
const SUPPORT_MAILTO = "mailto:0423doit@gmail.com";

interface SettingsLinkProps {
  to: string;
  icon: string;
  title: string;
  description: string;
}

function SettingsLink({ to, icon, title, description }: SettingsLinkProps) {
  return (
    <Link className="doit-settings-link" to={to}>
      <span className="doit-settings-icon" aria-hidden="true"><i className={icon} /></span>
      <span className="doit-settings-link-copy">
        <span className="doit-settings-link-title">{title}</span>
        <span className="doit-settings-link-description">{description}</span>
      </span>
      <span className="doit-settings-chevron" aria-hidden="true">↗</span>
    </Link>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);

  async function handleSignOut() {
    if (signOutInFlight.current || loading || !user) return;
    signOutInFlight.current = true;
    setSigningOut(true);
    setSignOutError(null);
    try {
      // AuthProvider는 실패를 throw한다. 실패했을 때 홈으로 이동하지 않는다.
      await signOut();
      navigate("/", { replace: true });
    } catch {
      setSignOutError("로그아웃하지 못했어요. 연결을 확인하고 다시 눌러주세요.");
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  }

  return (
    <MobileLayout title="설정" back>
      <div className="doit-settings">
        <header className="doit-settings-intro">
          <p className="doit-product-kicker">MY ACCOUNT</p>
          <h2 className="doit-product-title">내 정보,<br />내 방식으로.</h2>
          <p className="doit-product-description">소개와 사진을 다듬고,<br />내 계정을 관리해요.</p>
        </header>

        <section className="doit-settings-section" aria-labelledby="settings-account-heading">
          <h3 id="settings-account-heading" className="doit-settings-heading">프로필과 계정</h3>
          <div className="doit-settings-panel">
            <SettingsLink
              to="/doit/start-journey?edit=profile"
              icon="ri-user-3-line"
              title="소개 수정하기"
              description="닉네임, 소개와 생활 리듬을 바꿔요."
            />
            <SettingsLink
              to="/doit/start-journey?edit=photos"
              icon="ri-camera-line"
              title="사진 관리하기"
              description="지금 촬영하거나 최근 사진을 골라요."
            />
            {!loading && !user ? (
              <Link className="doit-settings-session" to="/login" state={{ from: "/doit/settings" }}>
                <span>로그인하기</span><span aria-hidden="true">↗</span>
              </Link>
            ) : (
              <button
                type="button"
                className="doit-settings-session"
                onClick={() => { void handleSignOut(); }}
                disabled={loading || signingOut}
                aria-busy={signingOut}
              >
                <span>{loading ? "로그인 상태 확인 중" : signingOut ? "로그아웃 중" : "로그아웃"}</span>
                <i className="ri-logout-box-r-line" aria-hidden="true" />
              </button>
            )}
          </div>
          {signOutError && <p className="doit-product-error" role="alert">{signOutError}</p>}
        </section>

        {/* 2026-09-24 얼굴·지문 로그인(패스키) 등록·관리. 로그인한 사람만. */}
        {!loading && user && <FaceLoginSettings />}

        <section className="doit-settings-section" aria-labelledby="settings-availability-heading">
          <h3 id="settings-availability-heading" className="doit-settings-heading">알림과 안전 설정</h3>
          <dl className="doit-settings-status-list">
            <div>
              <dt>활동 · KEY · 미션 알림</dt>
              <dd>알림을 받는 설정은 아직 제공하지 않아요.</dd>
            </div>
            <div>
              <dt>안전 모드</dt>
              <dd>안전 모드를 켜고 끄는 설정은 아직 제공하지 않아요.</dd>
            </div>
          </dl>
        </section>

        <section className="doit-settings-section" aria-labelledby="settings-data-heading">
          <h3 id="settings-data-heading" className="doit-settings-heading">내 정보 관리</h3>
          <div className="doit-settings-note">
            <h4>데이터 삭제 · 회원 탈퇴</h4>
            <p>아직 이 화면에서 처리할 수 없어요. 관련 문의는 아래 메일로 보내주세요.</p>
            <a className="doit-settings-mail" href={SUPPORT_MAILTO}>
              문의 메일 쓰기<span aria-hidden="true">↗</span>
            </a>
            <p className="doit-settings-mail-address">0423doit@gmail.com</p>
          </div>
        </section>

        <section className="doit-settings-section" aria-labelledby="settings-policy-heading">
          <h3 id="settings-policy-heading" className="doit-settings-heading">서비스 안내</h3>
          {/* 문서 본문은 src/lib/legal/documents.ts 하나에서 온다(/legal/terms, /legal/privacy). */}
          <div className="doit-settings-panel">
            <SettingsLink
              to="/legal/terms"
              icon="ri-file-text-line"
              title="이용약관"
              description="서비스 이용 조건과 결제·환불 기준을 확인해요."
            />
            <SettingsLink
              to="/legal/privacy"
              icon="ri-shield-check-line"
              title="개인정보 처리방침"
              description="어떤 정보를 왜 모으고 어떻게 지키는지 확인해요."
            />
          </div>
        </section>

        <p className="doit-settings-signature">DO IT COMPANY · JUST TRY</p>
      </div>
    </MobileLayout>
  );
}
