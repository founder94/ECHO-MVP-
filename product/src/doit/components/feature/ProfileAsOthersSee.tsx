import { useEffect, useState } from "react";
import { restorePhotos, type RestoredPhoto } from "@/doit/lib/photoStorage";
import { PHOTO_BASE_COUNT, isExtraSlot } from "@/doit/lib/photoPolicy";
import { FadedExtraPhoto, StoryLockButton } from "@/doit/components/feature/LockedProfileParts";
import { canTaste } from "@/doit/lib/unlockPrices";
import "./locked-profile.css";

// 내 프로필에서 「다른 사람에게는 이렇게 보여요」 미리보기(2026-10-06 대표 1단계).
// - 기본 5칸은 그대로, 추가 사진은 사진 전체에 35% 막(한 장은 맛보기), 스토리는 버튼 안 자물쇠. 대표 사진은 칸과 상관없이 늘 그대로 보인다.
// - 읽기만 한다(restorePhotos). 저장·KEY 차감 0.
export default function ProfileAsOthersSee({ userId }: { userId: string | null }) {
  // Codex PR #141 b7a8bb4 P1: 계정이 바뀌면(A → B) 앞 계정의 사진·실패 표시를 한 장도 보이지 않는다 — 상태마다 주인 계정을 함께 두고, 지금 계정 것이 아니면 버린다.
  // Codex PR #141 4500978: 불러오기 실패를 「사진 없음」으로 바꾸지 않는다 — 실패는 따로 보이고 「다시 불러오기」로 다시 받는다(옆 사진 묶음과 같은 방식).
  const [loaded, setLoaded] = useState<{ owner: string; photos: RestoredPhoto[] | "error" } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // 맛보기로 선명하게 본 칸(한 사람당 한 장 · 화면 상태만). 계정이 바뀌면 함께 비운다.
  const [tasted, setTasted] = useState<{ owner: string | null; slots: number[] }>({ owner: null, slots: [] });
  const [failedState, setFailed] = useState<{ owner: string | null; slots: number[] }>({ owner: null, slots: [] });
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoaded(null);
    void restorePhotos(userId).then((p) => { if (active) setLoaded({ owner: userId, photos: p }); }).catch(() => { if (active) setLoaded({ owner: userId, photos: "error" }); });
    return () => { active = false; };
  }, [userId, attempt]);
  if (!userId) return null;
  const mine = loaded && loaded.owner === userId ? loaded.photos : null;
  const loadError = mine === "error";
  const photos = mine === "error" ? null : mine;
  const failed = failedState.owner === userId ? failedState.slots : [];
  // Codex 1add81c: 사진 한 장만 실패해도 다시 받을 길이 있어야 한다 — 실패 칸에 「다시 불러오기」, 누르면 실패 표시를 비우고 주소를 새로 받는다.
  const retry = () => { setFailed({ owner: null, slots: [] }); setAttempt((n) => n + 1); };
  const markFailed = (slot: number) => setFailed((f) => ({ owner: userId, slots: f.owner === userId ? [...f.slots, slot] : [slot] }));
  const tastedSlots = tasted.owner === userId ? tasted.slots : [];
  const taste = (slot: number) => setTasted((t) => (t.owner === userId ? (canTaste(t.slots) ? { owner: userId, slots: [...t.slots, slot] } : t) : { owner: userId, slots: [slot] }));
  const list = (photos ?? []).slice().sort((a, b) => a.slot - b.slot);
  const extra = list.filter((p) => isExtraSlot(p.slot) && !p.isPrimary).length;
  return <section className="doit-as-others" aria-label="다른 사람에게 보이는 내 프로필">
    <div className="doit-profile-photos-heading"><h2>다른 사람에게는 이렇게 보여요</h2><span>미리보기</span></div>
    {loadError ? <div className="doit-profile-photos-empty" role="status"><p>사진을 불러오지 못했어요.</p><span>저장된 사진은 그대로 두었어요.</span><button type="button" onClick={retry}>다시 불러오기</button></div> :
      photos === null ? <p className="doit-profile-photo-note" role="status">불러오고 있어요.</p> :
      list.length === 0 ? <p className="doit-profile-photo-note">사진을 올리면 여기서 상대에게 보이는 모습을 미리 볼 수 있어요.</p> :
      <div className="doit-as-others-grid">{list.map((p) => failed.includes(p.slot) ? <div key={p.photoId} className="doit-faded doit-profile-photos-empty" role="status"><p>사진을 불러오지 못했어요.</p><button type="button" onClick={retry}>다시 불러오기</button></div> :
        isExtraSlot(p.slot) && !p.isPrimary
          ? <FadedExtraPhoto key={p.photoId} src={p.url} alt="추가 사진(상대에게는 살짝 흐리게 보임)" onError={() => markFailed(p.slot)} tasted={tastedSlots.includes(p.slot)} canTaste={canTaste(tastedSlots)} onTaste={() => taste(p.slot)} />
          : <div key={p.photoId} className="doit-faded"><img src={p.url} alt={`프로필 사진 ${p.slot + 1}`} loading="lazy" referrerPolicy="no-referrer" onError={() => markFailed(p.slot)} /></div>)}
      </div>}
    <StoryLockButton />
    <p className="doit-profile-photo-note">기본 사진 {PHOTO_BASE_COUNT}장은 그대로 보이고{extra > 0 ? `, 추가 사진 ${extra}장은 살짝 흐리게 보여요(한 장은 맛보기로 선명하게 볼 수 있어요)` : ", 「추가 사진」을 올리면 상대에게 살짝 흐리게 보여요"}. 스토리 쓰기와 KEY로 열기는 아직 준비 중이에요.</p>
  </section>;
}
