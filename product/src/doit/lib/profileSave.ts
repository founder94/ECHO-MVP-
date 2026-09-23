import { READ_TIMEOUT_MS, withTimeout } from "@/doit/lib/withTimeout";
import { getSupabase } from "@/doit/lib/supabase";

// 본인 행의 허용된 소개·목적 필드만 변경한다. UPDATE 본문에는 id를 넣지 않는다.
// 운영 권한은 id INSERT만 허용하므로 id까지 갱신하는 upsert를 사용하지 않는다.
// 실제 반환 행을 확인한 뒤에만 성공으로 보고한다. 인증·권한 필드는 건드리지 않는다.

export interface PurposeDraft {
  purposeId: string;
  purposeLabel: string;
}

export interface ProfileTextDraft {
  nickname: string;
  intro: string;
  region: string;
  lifeRhythm: string;
}

type ProfilePatch =
  | { purpose_id: string; purpose_label: string }
  | { purpose_id: null; purpose_label: null }
  | { nickname: string; bio: string; region: string; life_rhythm: string };

async function saveOwnProfile(userId: string, patch: ProfilePatch): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "Supabase가 연결되지 않았습니다.";

  try {
    const { data: auth, error: authError } = await supabase.auth.getSession();
    if (authError || !userId || auth.session?.user.id !== userId) {
      return "로그인을 다시 확인해 주세요.";
    }

    const update = () => supabase.from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    const updated = await update();
    if (updated.error) return updated.error.message;
    if (updated.data?.id === userId) return null;

    // 0행은 성공이 아니다. 새 사용자만 INSERT로 만들고 기존 권한은 그대로 둔다.
    const inserted = await supabase.from("profiles")
      .insert({ id: userId, ...patch })
      .select("id")
      .maybeSingle();
    if (!inserted.error) {
      return inserted.data?.id === userId ? null : "저장 결과를 확인하지 못했어요.";
    }
    if (inserted.error.code !== "23505") return inserted.error.message;

    // 로그인 초기 프로필 생성과 겹친 경우에만 한 번 갱신한다. 권한 오류는 숨기지 않는다.
    const raced = await update();
    if (raced.error) return raced.error.message;
    return raced.data?.id === userId ? null : "프로필을 수정할 수 없어요. 로그인 상태를 확인해 주세요.";
  } catch {
    return "연결이 끊겨 저장 결과를 확인하지 못했어요. 입력한 내용은 그대로 두고 다시 시도해 주세요.";
  }
}

// 목적 저장 → profiles.purpose_id / purpose_label
export async function savePurpose(
  userId: string,
  draft: PurposeDraft,
): Promise<string | null> {
  return saveOwnProfile(userId, {
    purpose_id: draft.purposeId,
    purpose_label: draft.purposeLabel,
  });
}

// v13.4 "처음부터 다시": 목적을 비워 첫 질문("어떤 만남을 원하세요?")부터 다시 시작한다. 기록·이해는 지우지 않는다.
export async function clearPurpose(userId: string): Promise<string | null> {
  return saveOwnProfile(userId, { purpose_id: null, purpose_label: null });
}

// 프로필 텍스트 저장 → nickname/bio/region/life_rhythm
export async function saveProfileText(
  userId: string,
  draft: ProfileTextDraft,
): Promise<string | null> {
  return saveOwnProfile(userId, {
    nickname: draft.nickname,
    bio: draft.intro,
    region: draft.region,
    life_rhythm: draft.lifeRhythm,
  });
}

// ─────────────────────────────────────────────────────────────
// 프로필 읽기(load) — 재로그인 후 기존 프로필을 화면에 다시 채우는 경로.
// 저장(save)만 있고 읽기가 없으면 "완료"가 아니므로, 이 함수가 그 빈자리를 메운다.
//
// 결과는 상태를 명확히 구분해 돌려준다:
//  - status "ok" + profile null   → 프로필이 아직 없는 경우(정상, 빈 상태로 시작)
//  - status "ok" + profile 값     → 기존 프로필이 있는 경우(값을 채운다)
//  - status "error" + message     → 읽기 자체가 실패한 경우(빈값으로 덮어쓰면 안 됨)
// 이렇게 읽기 실패와 "프로필 없음"을 분리해야, 실패 시 기존 데이터를
// 빈값·기본값으로 덮어쓰는 사고를 막을 수 있다.
// ─────────────────────────────────────────────────────────────

export interface LoadedProfile {
  purposeId: string | null;
  purposeLabel: string | null;
  nickname: string | null;
  intro: string | null;
  region: string | null;
  lifeRhythm: string | null;
}

export type LoadProfileResult =
  | { status: "ok"; profile: LoadedProfile | null }
  | { status: "error"; message: string };

async function loadProfileOnce(
  userId: string,
): Promise<LoadProfileResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { status: "error", message: "Supabase가 연결되지 않았습니다." };
  }

  // 필요한 컬럼만 조회. role·verification_status 등 인증·권한 필드는
  // 읽기 전용으로 두고, 여기서 건드리지 않는다(관리자 권한 유지).
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "purpose_id, purpose_label, nickname, bio, region, life_rhythm",
      )
      .eq("id", userId)
      .maybeSingle();
  
    // 읽기 실패 → "프로필 없음"과 구분해서 돌려준다(빈값으로 덮어쓰기 금지).
    if (error) {
      return { status: "error", message: error.message };
    }
  
    // 프로필 row 자체가 없음(정상 케이스).
    if (!data) {
      return { status: "ok", profile: null };
    }
  
    return {
      status: "ok",
      profile: {
        purposeId: data.purpose_id ?? null,
        purposeLabel: data.purpose_label ?? null,
        nickname: data.nickname ?? null,
        intro: data.bio ?? null,
        region: data.region ?? null,
        lifeRhythm: data.life_rhythm ?? null,
      },
    };
  } catch {
    return { status: "error", message: "연결이 끊겨 프로필을 읽지 못했어요." };
  }
}

// 프로필 읽기에 시간 상한을 둔다. 넘으면 "읽기 실패"로 돌려준다(빈값으로 덮어쓰지 않는 기존 규칙 그대로).
export async function loadProfile(userId: string): Promise<LoadProfileResult> {
  try {
    return await withTimeout(loadProfileOnce(userId), READ_TIMEOUT_MS, 'loadProfile');
  } catch {
    return { status: "error", message: "응답이 늦어 프로필을 읽지 못했어요." };
  }
}
