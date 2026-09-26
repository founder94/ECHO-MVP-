import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import DoItSymbol from "@/components/DoItSymbol";
import ProfilePhotoGallery from "@/doit/components/feature/ProfilePhotoGallery";
import { useAuth } from "@/doit/hooks/useAuth";
import { loadProfile, type LoadedProfile } from "@/doit/lib/profileSave";

// 실제 저장한 프로필만 표시한다. 등급·참여 수·연결 수를 예시로 채우지 않는다.
type RealProfileState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "none" }
  | { status: "ok"; userId: string; profile: LoadedProfile }
  | { status: "error" };

function formatJoined(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [real, setReal] = useState<RealProfileState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!user) {
      setReal({ status: "signed_out" });
      return;
    }
    setReal({ status: "loading" });
    void loadProfile(user.id).then((result) => {
      if (!alive) return;
      if (result.status === "error") setReal({ status: "error" });
      else if (!result.profile) setReal({ status: "none" });
      else setReal({ status: "ok", userId: user.id, profile: result.profile });
    }).catch(() => { if (alive) setReal({ status: "error" }); });
    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  // 인증 변경 직후에도 이전 계정의 정보를 화면에 남기지 않는다.
  const visible: RealProfileState = authLoading ? { status: "loading" } : !user ? { status: "signed_out" }
    : real.status === "ok" && real.userId !== user.id ? { status: "loading" } : real;
  const profile = visible.status === "ok" ? visible.profile : null;
  const displayName = profile?.nickname?.trim() || (real.status === "ok" || real.status === "none" ? "닉네임을 아직 정하지 않았어요" : "");
  const intro = profile?.intro?.trim() || (real.status === "ok" || real.status === "none" ? "소개를 아직 적지 않았어요" : "");
  const facts = [
    { label: "연결 목적", value: profile?.purposeLabel },
    { label: "활동 지역", value: profile?.region },
    { label: "생활 리듬", value: profile?.lifeRhythm },
  ];
  const joined = formatJoined(user?.created_at);

  return (
    <MobileLayout title="프로필" showNav activeTab="profile">
      <section className="doit-product-story">
        <p className="doit-product-kicker">MY OWN WORDS</p>
        <h2 className="doit-product-title">내 프로필</h2>
        <p className="doit-product-description">연결되면 상대에게 보이는 나예요.</p>
        <ProfilePhotoGallery userId={!authLoading ? user?.id ?? null : null} onManage={() => navigate("/doit/start-journey?edit=photos")} />
        <div className="doit-profile-card" aria-live="polite">
          <div className="doit-profile-card-head"><span className="doit-product-kicker">DO IT · PROFILE</span><DoItSymbol decorative /></div>
          <h3 className="doit-profile-name">
            {visible.status === "loading" && "프로필을 불러오고 있어요"}
            {visible.status === "signed_out" && "나의 이야기를 남겨주세요"}
            {visible.status === "error" && "프로필을 읽지 못했어요"}
            {(visible.status === "ok" || visible.status === "none") && displayName}
          </h3>
          <p className="doit-profile-intro">
            {visible.status === "error" ? "저장된 건 그대로예요. 조금 뒤 다시 열어 주세요." : visible.status === "signed_out" ? "로그인하면 내 소개와 연결 목적이 보여요." : intro}
          </p>
          {visible.status === "ok" && <dl className="doit-profile-facts">{facts.map(({label,value}) => <div key={label}><dt>{label}</dt><dd>{value?.trim() || "아직 작성하지 않았어요"}</dd></div>)}</dl>}
          {joined && <p className="doit-product-footnote">가입일 {joined}</p>}
        </div>
        {visible.status === "signed_out" ? <Link className="doit-product-action" to="/login" state={{from:"/doit/profile"}}>로그인하고 프로필 보기 <span aria-hidden="true">↗</span></Link> :
          (visible.status === "ok" || visible.status === "none") && <Link className="doit-product-action" to="/doit/start-journey?edit=profile">{visible.status === "none" ? "프로필 준비하기" : "내 소개 수정하기"}<span aria-hidden="true">↗</span></Link>}
        <div className="doit-product-note"><span className="doit-product-status">연결 준비</span><p>남은 게 뭔지는 아래 「연결」 탭에서 봐요.</p></div>
      </section>
    </MobileLayout>
  );
}
