import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import InstallAppCard from "@/doit/components/feature/InstallAppCard";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import { useAuth } from "@/doit/hooks/useAuth";
import FaceLoginSettings from "./FaceLoginSettings";
import { PASSKEY_LOGIN_ENABLED } from "@/lib/auth/passkey";
import AccountDeletion from "./AccountDeletion";
import "./settings.css";

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
  const { hash } = useLocation();
  // 앱 홈의 「홈 화면에 ECHO 추가」 링크(#install)로 들어오면 그 항목으로 바로 내려 준다.
  useEffect(() => { if (hash === "#install") document.getElementById("install")?.scrollIntoView({ block: "start" }); }, [hash]);

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
          <h2 className="doit-product-title">설정</h2>
          <p className="doit-product-description">소개·사진·계정을 여기서 바꿔요.</p>
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

        {/* 2026-09-26 대표 실기기 「앱은 어디서 받아?」: 설치를 강요하지 않고, 필요할 때 언제든 찾을 수 있는 자리. */}
        <section id="install" className="doit-settings-section" aria-labelledby="settings-install-heading">
          <h3 id="settings-install-heading" className="doit-settings-heading">앱으로 쓰기</h3>
          <InstallAppCard variant="menu" />
        </section>

        {/* 2026-09-24 얼굴·지문 로그인(패스키) 등록·관리. 로그인한 사람만. */}
        {!loading && user && PASSKEY_LOGIN_ENABLED && <FaceLoginSettings />}

        {/* 2026-09-26 MVP: 「알림·KEY·미션 · 안전 모드 — 아직 제공하지 않아요」 준비 중 칸은 뺐다(없는 기능을 보여 주지 않음). */}

        <section className="doit-settings-section" aria-labelledby="settings-data-heading">
          <h3 id="settings-data-heading" className="doit-settings-heading">내 정보 관리</h3>
          {/* 2026-09-24 출시 1.0: 앱 안 회원 탈퇴. 앱에서 안 되면 같은 자리의 메일 문의가 빠져나갈 문이다. */}
          <AccountDeletion userId={user?.id ?? null} authLoading={loading} />
        </section>

        <section className="doit-settings-section" aria-labelledby="settings-policy-heading">
          <h3 id="settings-policy-heading" className="doit-settings-heading">서비스 안내</h3>
          {/* 문서 본문은 src/lib/legal/documents.ts 하나에서 온다(/legal/terms, /legal/privacy). */}
          <div className="doit-settings-panel">
            <SettingsLink
              to="/legal/terms"
              icon="ri-file-text-line"
              title="이용약관"
              description="서비스를 쓰는 규칙이에요."
            />
            <SettingsLink
              to="/legal/privacy"
              icon="ri-shield-check-line"
              title="개인정보 처리방침"
              description="내 정보를 어떻게 다루는지 적혀 있어요."
            />
          </div>
        </section>

        <p className="doit-settings-signature">DO IT COMPANY · JUST TRY</p>
      </div>
    </MobileLayout>
  );
}
