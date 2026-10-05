import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import MobileLayout from "@/doit/components/feature/MobileLayout";
import DoItSymbol from "@/components/DoItSymbol";
import ProfilePhotoGallery from "@/doit/components/feature/ProfilePhotoGallery";
import { useAuth } from "@/doit/hooks/useAuth";
import { loadProfile, saveNickname, type LoadedProfile } from "@/doit/lib/profileSave";

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
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;

  useEffect(() => {
    setEditingNickname(false);
    setNicknameDraft("");
    setNicknameSaving(false);
    setNicknameError(null);
  }, [user?.id]);

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

  async function submitNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || visible.status !== "ok" || visible.userId !== user.id || nicknameSaving) return;
    const nickname = nicknameDraft.trim();
    if (!nickname || nickname.length > 20) {
      setNicknameError("닉네임은 1~20자로 적어 주세요.");
      return;
    }
    if (nickname === visible.profile.nickname?.trim()) {
      setEditingNickname(false);
      return;
    }
    const userId = user.id;
    setNicknameSaving(true);
    setNicknameError(null);
    const error = await saveNickname(userId, nickname);
    if (accountRef.current !== userId) return;
    setNicknameSaving(false);
    if (error) {
      setNicknameError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setReal((current) => current.status === "ok" && current.userId === userId
      ? { ...current, profile: { ...current.profile, nickname } } : current);
    setEditingNickname(false);
  }

  return (
    <MobileLayout title="프로필" showNav activeTab="profile">
      <section className="doit-product-story">
        {/* 2026-10-05 대표 실기기 「승인 시안과 다름」: 시안 「나를 소개하는 작은 시작」처럼 가운데 제목(글은 그대로) */}
        <div className="doit-product-head">
          <p className="doit-product-kicker">MY OWN WORDS</p>
          <h2 className="doit-product-title">내 프로필</h2>
          <p className="doit-product-description">연결되면 상대에게 보이는 나예요.</p>
        </div>
        <ProfilePhotoGallery userId={!authLoading ? user?.id ?? null : null} onManage={() => navigate("/doit/start-journey?edit=photos")} />
        <div className="doit-profile-card" aria-live="polite">
          <div className="doit-profile-card-head"><span className="doit-product-kicker">DO IT · PROFILE</span><DoItSymbol decorative /></div>
          <h3 className="doit-profile-name">
            {visible.status === "loading" && "프로필을 불러오고 있어요"}
            {visible.status === "signed_out" && "나의 이야기를 남겨주세요"}
            {visible.status === "error" && "프로필을 읽지 못했어요"}
            {(visible.status === "ok" || visible.status === "none") && displayName}
          </h3>
          {visible.status === "ok" && (editingNickname ?
            <form className="doit-nickname-form" onSubmit={(event) => void submitNickname(event)}>
              <label htmlFor="doit-nickname-input">닉네임</label>
              <input id="doit-nickname-input" value={nicknameDraft} maxLength={20} autoComplete="nickname"
                onChange={(event) => { setNicknameDraft(event.target.value); setNicknameError(null); }} disabled={nicknameSaving} />
              <div className="doit-nickname-actions">
                <button type="submit" disabled={nicknameSaving}>{nicknameSaving ? "저장 중…" : "저장"}</button>
                <button type="button" disabled={nicknameSaving} onClick={() => { setEditingNickname(false); setNicknameError(null); }}>취소</button>
              </div>
              {nicknameError && <p className="doit-product-error" role="alert">{nicknameError}</p>}
            </form>
            : <button type="button" className="doit-nickname-edit" onClick={() => {
              setNicknameDraft(profile?.nickname ?? "");
              setNicknameError(null);
              setEditingNickname(true);
            }}>닉네임 바꾸기</button>)}
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
