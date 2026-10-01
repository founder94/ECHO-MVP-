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

// 서버(doit-connect)가 실제로 지키는 공개 순서와 같은 말(화면이 새 규칙을 만들지 않는다).
const VISIBILITY_RULES = [
  '후보일 때는 서로의 이름·사진·소개가 보이지 않아요. ECHO가 이어 본 이유만 보여요.',
  '두 사람이 모두 「이어지고 싶어요」를 고르면 연결이 열려요. 한 사람만 고르면 상대에게 알려지지 않아요.',
  '연결 뒤 같은 질문에 두 사람이 모두 답하면, 그때 닉네임·대표 사진·소개·고른 만남·그 답이 서로 보여요.',
  '그만하거나 차단하면 그 연결의 상대 정보는 다시 보이지 않아요.',
];
const HELP = [
  { q: '연결은 어떻게 열리나요?', a: 'ECHO가 내 이야기와 겹치는 사람을 후보로 보여 드려요. 두 사람이 모두 고를 때만 연결이 열리고, 첫 질문에 둘 다 답하면 서로를 볼 수 있어요.' },
  { q: '불편한 상대가 있어요.', a: '후보 카드의 「불편해요 · 차단 · 신고」나 연결 카드의 「이 연결 그만하기」에서 차단하거나 사유를 골라 신고할 수 있어요. 차단하면 다시 추천되지 않아요.' },
  { q: '내 기록을 지우고 싶어요.', a: '이 화면의 「내 정보 관리」에서 탈퇴하면 계정과 기록, 사진이 함께 지워져요.' },
];

// 2026-10-01 대표 「FINAL PRODUCT IMPLEMENTATION MASTER」 ECHO 사용법 — 지금 실제로 있는 기능만, 항목마다 3~5문장.
// 서버가 지원하지 않는 KEY·미션·72시간 방·보상·함께 나가기·쉬기는 쓰지 않는다(없는 기능을 약속하지 않음).
const GUIDE: readonly { q: string; a: string }[] = [
  { q: 'ECHO와 이야기하기', a: '생각나는 대로 편하게 답하면 돼요. 정답은 없고, 「잘 모르겠어요」도 괜찮아요. 답하기 어려우면 ECHO가 고를 수 있는 보기를 드려요. 이 질문을 넘어가거나 오늘은 그만해도 돼요.' },
  { q: '나의 이해', a: 'ECHO가 들은 것 중 내가 맞다고 확인한 것만 모여요. ECHO의 해석이 다르면 대화에서 바로 말해 주세요. 바로잡은 내용은 다음 질문에 반영되고, 틀린 해석은 다시 쓰지 않아요.' },
  { q: '당신이 잠든 사이 · 후보', a: '연결 준비가 끝나면 ECHO가 이어 볼 만한 사람을 조금만 찾아 둬요. 후보일 때는 이름·사진·소개가 보이지 않고, 이어 본 이유만 보여요. 「이어지고 싶어요」나 「이번에는 넘길게요」 중에서 골라요. 내가 고른 사실은 상대가 고르기 전에는 알려지지 않아요.' },
  { q: '서로 같은 선택', a: '두 사람이 모두 「이어지고 싶어요」를 골라야 연결이 열려요. 서버가 확인하면 「텔레파시가 통했어요」가 떠요(같은 기기에서는 한 번). 한 사람만 고르면 아무 일도 일어나지 않아요.' },
  { q: '첫 질문과 공개', a: '연결이 열리면 두 분께 같은 질문 하나가 가요. 두 사람이 모두 답해야 닉네임·대표 사진·소개·그 답이 서로 보여요. 그 전에는 아무것도 보이지 않아요. 전화번호·이메일·정확한 위치는 보이지 않아요.' },
  { q: '이야기와 결과 기록', a: '공개된 뒤에는 이야기를 이어 갈 수 있어요. 연락처와 링크는 보낼 수 없어요. 이야기를 나눴는지, 만났는지는 나만 보이게 기록할 수 있고, 다음 후보를 준비하는 데만 써요.' },
  { q: '안전하게 쓰기', a: '불편하면 언제든 나갈 수 있어요. 후보 카드의 「불편해요 · 차단 · 신고」, 연결 카드의 「이 연결 그만하기」에서 차단하거나, 사유를 골라 신고해요(차단은 따로 고를 수 있어요). 차단하면 다시 추천되지 않아요. 만나기로 했다면 사람 많은 곳에서 만나고, 믿는 사람에게 장소를 알려 두세요.' },
  { q: '사주 · 타로', a: '재미로 가볍게 보는 무료 콘텐츠예요. 입력한 생년월일은 저장하지 않아요. 결과로 나나 상대를 단정하지 않아요.' },
  { q: '그만두고 싶을 때', a: '연결은 카드의 「이 연결 그만하기」로 언제든 끝낼 수 있어요. 계정을 지우고 싶으면 이 화면의 「내 정보 관리」에서 언제든 탈퇴할 수 있어요. 탈퇴하면 계정·기록·사진이 함께 지워져요.' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);
  const { hash } = useLocation();
  // 메뉴의 「앱 설치」(#install)·「약관 · 개인정보」(#policy)로 들어오면 그 항목으로 바로 내려 준다.
  useEffect(() => { if (hash === "#install" || hash === "#policy" || hash === "#guide") document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }); }, [hash]);

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
          {/* 2026-10-01 대표 「POST-IMPLEMENTATION MASTER」 O: 로그아웃해도 무엇이 남는지 분명히(서버 기록은 계정에 그대로 · 이 기기의 로그인만 끝남). */}
          {user && <p className="doit-settings-hint">로그아웃해도 대화·연결·사진은 내 계정에 그대로 남아요. 다시 로그인하면 이어서 볼 수 있어요.</p>}
        </section>

        {/* 2026-10-01 같은 지시 N 「공개 범위」: 바꾸는 스위치가 아니라 서버가 지키는 규칙을 그대로 알려 준다(설정값을 지어내지 않음). */}
        <section className="doit-settings-section" aria-labelledby="settings-visibility-heading">
          <h3 id="settings-visibility-heading" className="doit-settings-heading">누가 무엇을 보나요</h3>
          <ul className="doit-settings-note doit-settings-rules">
            {VISIBILITY_RULES.map(rule => <li key={rule}>{rule}</li>)}
          </ul>
        </section>

        {/* 같은 지시 N 「사주 정보 · 타로 기록」: 이미 있는 화면(/doit/fortune)으로. 입력한 생년월일은 저장하지 않고, 타로 기록은 이 기기에만 있다. */}
        <section className="doit-settings-section" aria-labelledby="settings-fortune-heading">
          <h3 id="settings-fortune-heading" className="doit-settings-heading">사주 · 타로</h3>
          <div className="doit-settings-panel">
            <SettingsLink to="/doit/fortune" icon="ri-sun-line" title="사주 보기" description="입력한 생년월일은 저장하지 않아요." />
            <SettingsLink to="/doit/fortune" icon="ri-stack-line" title="타로와 지난 카드" description="지난 카드는 이 기기에만 남아요." />
          </div>
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

        <section id="policy" className="doit-settings-section" aria-labelledby="settings-policy-heading">
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

        {/* 2026-10-01 ECHO 사용법 — 메뉴의 「ECHO 사용법」(#guide)으로 바로 온다. */}
        <section id="guide" className="doit-settings-section" aria-labelledby="settings-guide-heading">
          <h3 id="settings-guide-heading" className="doit-settings-heading">ECHO 사용법</h3>
          <div className="doit-settings-panel doit-settings-help">
            {GUIDE.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
          </div>
        </section>

        {/* 같은 지시 N 「도움말」: 자주 묻는 것 몇 가지(서버 규칙과 같은 말) + 문의 메일(탈퇴 안내와 같은 주소). */}
        <section className="doit-settings-section" aria-labelledby="settings-help-heading">
          <h3 id="settings-help-heading" className="doit-settings-heading">도움말</h3>
          <div className="doit-settings-panel doit-settings-help">
            {HELP.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
            <a className="doit-settings-mail" href="mailto:0423doit@gmail.com">다른 문의 · 0423doit@gmail.com</a>
          </div>
        </section>

        <p className="doit-settings-signature">DO IT COMPANY · JUST TRY</p>
      </div>
    </MobileLayout>
  );
}
