import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DoItSymbol from "@/components/DoItSymbol";
import { A_STRUCTURE_SERVER_ENABLED } from "@/doit/lib/understandingApi";
import "@/doit/components/feature/core-conversation.css";
import { PurposeSelect } from "@/doit/app/plan-a/screens/PurposeSelect";
import type { PurposeListState } from "@/doit/app/plan-a/screens/PurposeSelect";
import { SignupConsent } from "@/doit/app/plan-a/screens/SignupConsent";
import { ProfileBuild } from "@/doit/app/plan-a/screens/ProfileBuild";
import type { ProfileDraft } from "@/doit/app/plan-a/screens/ProfileBuild";
import { ProfileReview } from "@/doit/app/plan-a/screens/ProfileReview";
import { PhotoCapture } from "@/doit/app/plan-a/screens/PhotoCapture";
import { photoSetComplete } from "@/doit/lib/photoPolicy";
import { usePurpose } from "@/doit/hooks/usePurpose";
import { useAuth } from "@/doit/hooks/useAuth";
import {
  savePurpose,
  saveProfileText,
  loadProfile,
  type LoadedProfile,
} from "@/doit/lib/profileSave";
import {
  restorePhotos,
  PHOTO_SLOT_COUNT,
  type RestoredPhoto,
} from "@/doit/lib/photoStorage";
import {
  saveJourneyDraft,
  loadFreshJourneyDraft,
  clearJourneyDraft,
} from "@/doit/lib/journeyDraft";
import {
  fetchActivePurposes,
  needsReselection,
} from "@/doit/lib/purposes";

// A구조(DO IT) 진입 흐름 오케스트레이터 — 사주·타로를 끼워 넣지 않는 본 과정.
// 목적 선택 → 로그인 → ECHO 대화(서버 스위치 ON이면 프로필 상태와 무관하게 먼저) → 프로필 입력 → 사진 6장 → 프로필 확인.
// 2026-09-21 대표 결정: 로그인하면 바로 AI 대화부터. 프로필·사진은 대화 화면의 '내 소개와 사진 준비하기'(?edit=profile)로 이어간다.
// 사주·타로는 햄버거 메뉴의 별도 무료 재미 기능이며 여기에 포함하지 않는다.
//
// 로그인한 사용자는 진입 시 기존 프로필·사진을 DB에서 읽어 목적·닉네임·소개·지역·생활 리듬·사진을
// 입력/확인 화면에 다시 채운다(저장 → 재로그인 → 읽기 경로의 완성).
// 읽기 중이거나 읽기에 실패했을 때는 빈값·기본값으로 기존 프로필을 덮어쓰지 않는다.
// "프로필 없음"과 "읽기 실패"는 상태로 구분한다.
//
// 목적(Purpose) 목록의 정본은 운영 DB public.purposes(is_active=true)다.
// 이 화면은 목록을 직접 갖지 않고 DB에서 읽어 PurposeSelect 에 넘긴다.
// 읽기에 실패하면 하드코딩 목록으로 대신 채우지 않는다(잘못된 목적으로 저장되는 것을 막는다).
// 로그인 전에도 목적을 고르므로 목적 읽기는 로그인 여부와 무관하게 실행한다.

type Step = "purpose" | "consent" | "conversation-choice" | "profile-build" | "photo" | "profile-review";

// 저장 실패 시 사용자에게 보여줄 고정 문구. 기술 오류 원문·Supabase 오류·테이블명은 노출하지 않는다.
const SAVE_ERROR_MESSAGE = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

// 로그인 게이트의 복귀 경로. consent 완료 후 미로그인 사용자는 여기로 돌아와야 step을 복원한다.
const START_JOURNEY_PATH = "/doit/start-journey";

interface PurposeSelection {
  id: string;
  label: string;
}

// 읽기 상태 — 로딩/성공/실패를 구분해, 실패 시에도 기존 데이터를 보존한다.
type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; profile: LoadedProfile | null }
  | { kind: "error"; message: string };

export default function StartJourney() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const edit = search.get("edit");
  const { setPurposeId } = usePurpose();
  const { user, loading: authLoading } = useAuth();
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [purposeState, setPurposeState] = useState<PurposeListState>({
    kind: "loading",
  });
  // 서버(또는 로그인 전 draft)에 저장돼 있던 목적 id. 재선택이 필요한지 판정할 때만 쓴다.
  // 이 값을 지우거나 다른 목적으로 바꾸지 않는다.
  const [savedPurposeId, setSavedPurposeId] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("purpose");
  // v13.7(대표 실기기 2026-09-22 "프로필로 넘어가다가 갑자기 화면이 바뀐다"): 대화로 갈 것이 확정되면
  // 목적·프로필 화면을 스치듯 보여 주지 않고 전환 화면 하나만 보여 준 뒤 이동한다.
  const [leaving, setLeaving] = useState(false);
  const [selectedPurpose, setSelectedPurpose] =
    useState<PurposeSelection | null>(null);
  const [profile, setProfile] =
    useState<ProfileDraft | null>(null);
  // 저장 진행 중(saving)과 실패 안내(saveError)를 화면에 전달해,
  // 저장을 기다리지 않고 넘어가는 "저장된 것처럼 보이는 상태"를 막는다.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 언마운트 후 setState 방지용 가드(복원 함수가 비동기이므로).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 같은 user.id에 대해 step 복원을 한 번만 실행한다.
  // onAuthStateChange(토큰 갱신 등)가 새 session 참조를 만들어 effect가 재실행돼도,
  // 진행 중인 단계를 되돌리지 않도록 가드한다. 로그아웃 시 null로 초기화된다.
  const restoredForRef = useRef<string | null>(null);

  // 읽기 결과를 로컬 상태에 반영한다(목적·프로필 채우기).
  // 결과가 null(프로필 없음)이면 아무것도 덮어쓰지 않는다.
  function applyLoaded(loaded: LoadedProfile | null) {
    if (!loaded) return;
    if (loaded.purposeId && loaded.purposeLabel) {
      setPurposeId(loaded.purposeId);
      setSelectedPurpose({
        id: loaded.purposeId,
        label: loaded.purposeLabel,
      });
    }
    if (loaded.nickname || loaded.intro || loaded.region || loaded.lifeRhythm) {
      setProfile({
        nickname: loaded.nickname ?? "",
        intro: loaded.intro ?? "",
        region: loaded.region ?? "",
        lifeRhythm: loaded.lifeRhythm ?? "",
      });
    }
  }

  // 로그인 사용자 기준: 프로필(DB) + 사진(DB) + 로그인 전 목적 draft(sessionStorage)를 읽어
  // 실제 데이터 상태로 다음 step을 결정한다. 하드코딩된 "항상 첫 단계" 복귀 금지.
  async function restoreFromServer(userId: string) {
    const profileResult = await loadProfile(userId);
    if (!mountedRef.current || accountRef.current !== userId) return;

    // 사진 읽기 실패는 치명적이지 않다(PhotoCapture가 자체 복원/재시도 처리).
    let photos: RestoredPhoto[] = [];
    try {
      photos = await restorePhotos(userId);
    } catch {
      photos = [];
    }
    if (!mountedRef.current || accountRef.current !== userId) return;

    if (profileResult.status === "error") {
      setLoadState({ kind: "error", message: profileResult.message });
      return;
    }

    const loaded = profileResult.profile;
    applyLoaded(loaded);

    // 실DB 확정값이 오래된(stale) draft보다 우선한다. applyLoaded가 이미 서버 목적을 채웠으므로,
    // fresh한 draft(이번 인증 직전의 명시적 선택)만 서버 값을 덮어쓴다. stale draft는 여기서 null로 걸러진다.
    const draft = loadFreshJourneyDraft();
    if (draft) {
      setPurposeId(draft.purposeId);
      setSelectedPurpose({
        id: draft.purposeId,
        label: draft.purposeLabel,
      });
    }

    setLoadState({ kind: "ready", profile: loaded });

    // ── step 복원 알고리즘 (실DB 상태 우선) ──
    const purposeId = draft?.purposeId ?? loaded?.purposeId ?? null;
    setSavedPurposeId(purposeId);
    const hasProfileText = Boolean(
      loaded?.nickname ||
        loaded?.intro ||
        loaded?.region ||
        loaded?.lifeRhythm,
    );
    // 2026-09-21: 사진 완료 = 필수 3칸(전신·패션·취미) + 대표 1장(photoPolicy). 6장 요구 폐기.
    const photoComplete = photoSetComplete(photos);

    let nextStep: Step;
    if (!purposeId) {
      nextStep = "purpose";
    } else if (!hasProfileText) {
      nextStep = A_STRUCTURE_SERVER_ENABLED ? "conversation-choice" : "profile-build";
    } else if (!photoComplete) {
      nextStep = "photo";
    } else {
      nextStep = "profile-review";
    }

    if (purposeId && edit === "profile") nextStep = "profile-build";
    if (purposeId && edit === "photos") nextStep = "photo";
    // ?edit 지정이 없으면 프로필 상태와 상관없이 ECHO 대화로 간다(스위치 ON일 때만).
    // v13: 목적이 없어도 대화로 간다 — 첫 질문("어떤 만남을 원하세요?")을 대화 화면이 AI 대사로 묻는다.
    const goConversation = A_STRUCTURE_SERVER_ENABLED && edit !== "profile" && edit !== "photos";
    if (goConversation) setLeaving(true); else setStep(nextStep);

    // 로그인 전 목적 draft를 이제 DB에 영속화한다. 성공한 경우에만 draft를 지운다.
    if (draft) {
      const error = await savePurpose(userId, {
        purposeId: draft.purposeId,
        purposeLabel: draft.purposeLabel,
      });
      if (!error) clearJourneyDraft();
    }
    if (goConversation && mountedRef.current && accountRef.current === userId) {
      navigate("/doit/conversation?from=journey", { replace: true });
    }
  }

  // 목적 정본 읽기. 성공/실패/0건을 구분해 그대로 화면에 넘긴다.
  async function loadPurposes() {
    setPurposeState({ kind: "loading" });
    const result = await fetchActivePurposes();
    if (!mountedRef.current) return;
    if (result.status === "error") {
      // 오류 원문은 화면에 내보내지 않는다(테이블명·Supabase 메시지 노출 방지).
      setPurposeState({ kind: "error" });
      return;
    }
    setPurposeState({ kind: "ready", purposes: result.purposes });
  }

  // 진입 시 1회만 읽는다. 재시도는 화면의 "다시 시도" 버튼이 담당한다.
  useEffect(() => {
    void loadPurposes();
  }, []);

  // 진입 시 복원. 로그인 전(로딩 중)에는 아무것도 하지 않고,
  // 로그인 사용자가 확정되면 DB에서 본인 프로필·사진을 불러와 step을 결정한다.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // 로그아웃 → 복원 대상 초기화. 읽을 프로필·사진 없음. 정상적으로 빈 상태로 시작한다.
      restoredForRef.current = null;
      setProfile(null);
      setSelectedPurpose(null);
      // v13: 스위치 ON이면 목적은 로그인 뒤 대화 화면이 AI 대사("어떤 만남을 원하세요?")로 묻는다. 여기서는 계정 안내로 바로 간다.
      setStep(A_STRUCTURE_SERVER_ENABLED ? "consent" : "purpose");
      // 단, 로그인 전 목적 draft가 남아 있으면 복원해 처음부터 다시 고르지 않게 한다.
      const draft = loadFreshJourneyDraft();
      if (draft) {
        setPurposeId(draft.purposeId);
        setSelectedPurpose({
          id: draft.purposeId,
          label: draft.purposeLabel,
        });
      }
      setSavedPurposeId(draft?.purposeId ?? null);
      setLoadState({ kind: "ready", profile: null });
      return;
    }

    // 이미 이 사용자에 대해 복원했으면 재복원하지 않는다(토큰 갱신 등으로 인한 단계 되돌림 방지).
    const restoreKey = `${user.id}:${edit === "profile" || edit === "photos" ? edit : ""}`;
    if (restoredForRef.current === restoreKey) return;
    restoredForRef.current = restoreKey;
    reselectAppliedRef.current = false;
    setLoadState({ kind: "loading" });
    setProfile(null);
    void restoreFromServer(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, setPurposeId, edit]);

  // 예전에 고른 목적이 현재 활성 목록에 없으면(legacy) 목적 화면으로 되돌려 재선택을 받는다.
  // 이 되돌림이 없으면 step 복원이 목적 화면을 건너뛰어 재선택 안내가 사용자에게 보이지 않는다.
  // 기존 저장값은 그대로 두고, 사용자가 직접 새 목적을 고를 때만 저장된다.
  // 목록 조회에 실패했을 때는 legacy 인지 알 수 없으므로 되돌리지 않는다.
  const reselectAppliedRef = useRef(false);
  useEffect(() => {
    if (purposeState.kind !== "ready") return;
    if (loadState.kind !== "ready") return;
    if (reselectAppliedRef.current) return;
    reselectAppliedRef.current = true;
    if (needsReselection(savedPurposeId, purposeState.purposes)) {
      setStep("purpose");
      return;
    }
    // id 는 유효한데 저장된 label 만 과거 문구인 경우 — 화면에는 DB 정본 label 을 보여준다.
    // 표시만 바꾼다. 이 때문에 사용자 데이터를 UPDATE 하지 않는다.
    const active = purposeState.purposes.find((p) => p.id === savedPurposeId);
    if (active) {
      setSelectedPurpose((previous) =>
        previous && previous.id === active.id && previous.label !== active.label
          ? { id: active.id, label: active.label }
          : previous,
      );
    }
  }, [purposeState, loadState, savedPurposeId]);

  // 사진 단계는 인증 후에만 진입 가능해야 한다(요구 #7).
  // 방어 가드: 어떤 경로로든 미로그인 상태로 photo step이 되면 로그인으로 보낸다.
  useEffect(() => {
    if (step === "photo" && !authLoading && !user) {
      if (selectedPurpose) {
        saveJourneyDraft({
          purposeId: selectedPurpose.id,
          purposeLabel: selectedPurpose.label,
        });
      }
      navigate("/login", { state: { from: `${START_JOURNEY_PATH}${edit === "profile" || edit === "photos" ? `?edit=${edit}` : ""}` } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, authLoading, user]);

  // 재시도: 실패 상태에서 다시 읽는다. user가 없으면(이론상 없음) 빈 상태로 둔다.
  function retryLoad() {
    reselectAppliedRef.current = false;
    if (!user) {
      setLoadState({ kind: "ready", profile: null });
      return;
    }
    setLoadState({ kind: "loading" });
    void restoreFromServer(user.id);
  }

  const handlePurposeNext = async (selection: PurposeSelection) => {
    if (saving) return;
    // 선택값을 컨텍스트와 로컬 상태 양쪽에 보관해,
    // 이후 화면에서도 기본값("create")으로 되돌아가지 않게 한다.
    setPurposeId(selection.id);
    setSelectedPurpose(selection);
    // 로그인돼 있으면 본인 프로필에 목적을 저장하고, 성공을 확인한 뒤에만 다음 단계로 이동한다.
    if (user) {
      setSaving(true);
      setSaveError(null);
      const error = await savePurpose(user.id, {
        purposeId: selection.id,
        purposeLabel: selection.label,
      });
      if (!mountedRef.current || accountRef.current !== user.id) return;
      setSaving(false);
      if (error) {
        // 저장 실패 — 현재 화면에 머물고, 선택값은 유지한 채 재시도를 유도한다.
        setSaveError(SAVE_ERROR_MESSAGE);
        return;
      }
    }
    setStep("consent");
  };

  const handleProfileNext = async (draft: ProfileDraft) => {
    if (saving) return;
    // 직접 입력한 프로필을 로컬 상태에 보관해,
    // 확인 화면에서 실제 입력값이 그대로 보이게 한다.
    setProfile(draft);
    // 로그인돼 있으면 본인 프로필에 텍스트를 저장하고, 성공을 확인한 뒤에만 다음 단계로 이동한다.
    if (user) {
      setSaving(true);
      setSaveError(null);
      const error = await saveProfileText(user.id, draft);
      if (!mountedRef.current || accountRef.current !== user.id) return;
      setSaving(false);
      if (error) {
        // 저장 실패 — ProfileBuild에 머물고, 입력값은 보존한 채 재시도를 유도한다.
        setSaveError(SAVE_ERROR_MESSAGE);
        return;
      }
    } else {
      // 방어: 동의 단계에서 로그인을 거치므로 정상적으로는 도달하지 않지만,
      // 혹시 모를 미로그인 진입은 사진 단계 전에 로그인으로 보낸다(사진에서 오류를 띄우지 않는다).
      if (selectedPurpose) {
        saveJourneyDraft({
          purposeId: selectedPurpose.id,
          purposeLabel: selectedPurpose.label,
        });
      }
      navigate("/login", { state: { from: `${START_JOURNEY_PATH}${edit === "profile" || edit === "photos" ? `?edit=${edit}` : ""}` } });
      return;
    }
    setStep("photo");
  };

  // 읽기 실패 시 — 빈 입력 화면으로 진행하지 않고 오류 화면을 보여 재시도를 유도한다.
  if (loadState.kind === "error") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
        style={{ backgroundColor: "#090a0c" }}
      >
        <p
          style={{ fontSize: 22, fontWeight: 600, color: "#f2f1ef" }}
        >
          프로필을 불러오지 못했어요
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "#b5bac3",
            marginTop: 8,
            maxWidth: 320,
          }}
        >
          기존 정보를 안전하게 보호하기 위해 빈 화면으로
          넘어가지 않았어요. 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="mt-6 rounded-full px-6 py-3 whitespace-nowrap"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#15191e",
            backgroundColor: "#d5dbe3",
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 로딩 중 — 프로필을 읽기 전에는 입력 화면을 그리지 않아 빈값으로 덮어쓰는 것을 막는다.
  if (loadState.kind === "loading") {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
        style={{ backgroundColor: "#090a0c" }}
      >
        <p style={{ fontSize: 14, color: "#b5bac3" }}>
          프로필을 불러오는 중…
        </p>
      </div>
    );
  }

  // 로그인 안 된 사용자(user 없음)는 기존처럼 빈 상태로 흐름을 진행한다.
  // 로그인 사용자(user 있음)는 읽어온 기존 프로필을 초기값으로 각 화면에 전달한다.
  const readyProfile = loadState.profile;
  const initialPurposeId = selectedPurpose?.id ?? readyProfile?.purposeId ?? null;
  const initialDraft: ProfileDraft | null =
    profile ??
    (readyProfile
      ? {
          nickname: readyProfile.nickname ?? "",
          intro: readyProfile.intro ?? "",
          region: readyProfile.region ?? "",
          lifeRhythm: readyProfile.lifeRhythm ?? "",
        }
      : null);

  // v13.7 대화로 이동이 확정된 동안에는 중간 화면을 그리지 않는다(화면이 튀어 보이던 원인).
  if (leaving) {
    return (
      <section className="echo-dialogue" aria-busy="true">
        <p className="echo-eyebrow">DO IT / ECHO</p>
        <h1>대화를 준비하고 있어요.</h1>
        <div className="echo-leaving" role="status">
          <span className="echo-thinking-orbit" aria-hidden="true"><DoItSymbol decorative /></span>
          <p>잠시만요. 지금까지 적어 주신 내용은 그대로 있어요.</p>
        </div>
      </section>
    );
  }

  if (step === "purpose") {
    // 저장된 목적이 현재 활성 목록에 없으면 재선택을 안내한다.
    // 기존 값을 지우거나 다른 목적으로 자동 매핑하지 않는다.
    const reselect =
      purposeState.kind === "ready" &&
      needsReselection(initialPurposeId, purposeState.purposes);

    return (
      <PurposeSelect
        purposeState={purposeState}
        onRetry={() => void loadPurposes()}
        onNext={handlePurposeNext}
        initialId={initialPurposeId}
        needsReselection={reselect}
        saving={saving}
        saveError={saveError}
      />
    );
  }

  if (step === "consent") {
    return (
      <SignupConsent
        onNext={() => {
          if (user) {
            // 이미 로그인 → 동의 완료 후 프로필 입력으로 바로 진행(재로그인 강제 안 함).
            if (A_STRUCTURE_SERVER_ENABLED) navigate("/doit/conversation?from=journey");
            else setStep("profile-build");
          } else {
            // 미로그인 → 목적 draft 보존 + 로그인으로 이동. 복귀 후 step은 DB/draft 기준 복원된다.
            if (selectedPurpose) {
              saveJourneyDraft({
                purposeId: selectedPurpose.id,
                purposeLabel: selectedPurpose.label,
              });
            }
            navigate("/login", {
              state: { from: `${START_JOURNEY_PATH}${edit === "profile" || edit === "photos" ? `?edit=${edit}` : ""}` },
            });
          }
        }}
      />
    );
  }

  if (step === "conversation-choice") {
    return <section className="echo-dialogue"><DoItSymbol decorative /><p className="echo-eyebrow">내 소개를 쓰기 전에</p><h1>몇 마디 나누며,<br />나를 알아가도 좋아요.</h1><p className="echo-lead">원하는 관계와 요즘의 감정을 이야기해 주세요. AI의 이해가 다르면 직접 고칠 수 있어요.</p><button className="echo-primary" onClick={() => navigate("/doit/conversation?from=journey")}>대화로 내 소개 정리하기</button><button className="echo-secondary" onClick={() => setStep("profile-build")}>먼저 프로필 만들기</button><p className="echo-fine">대화 내용이 다른 사람에게 자동 공개되지는 않아요.</p></section>;
  }

  if (step === "profile-build") {
    return (
      <>
        {A_STRUCTURE_SERVER_ENABLED && (
          <div style={{ padding: "16px 24px 0", backgroundColor: "#090a0c" }}>
            <button type="button" className="echo-text-button" onClick={() => navigate("/doit/conversation")}>
              ← ECHO 대화로 돌아가기
            </button>
          </div>
        )}
        <ProfileBuild
          onNext={handleProfileNext}
          initialDraft={initialDraft}
          saving={saving}
          saveError={saveError}
        />
      </>
    );
  }

  if (step === "photo") {
    return (
      <PhotoCapture
        userId={user?.id ?? null}
        onNext={() => setStep("profile-review")}
        onBack={() => setStep("profile-build")}
      />
    );
  }

  return (
    <ProfileReview
      userId={user?.id ?? null}
      onEditPhotos={() => setStep("photo")}
      purposeLabel={selectedPurpose?.label}
      profile={profile ?? initialDraft ?? undefined}
      onNext={() => navigate("/doit/spaces")}
      onEditProfile={() => setStep("profile-build")}
    />
  );
}
