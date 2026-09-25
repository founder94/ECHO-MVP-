import { useEffect, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { restorePhotos, type RestoredPhoto } from "@/doit/lib/photoStorage";
import "./profile-photos.css";

interface Props {
  userId: string | null;
  onManage?: () => void;
}

type PhotoState =
  | { kind: "loading" }
  | { kind: "ready"; photos: RestoredPhoto[] }
  | { kind: "error" };

// 계정이 바뀌면 이전 사진·임시 접근 주소·진행 중 조회 결과를 모두 화면에서 분리한다.
export default function ProfilePhotoGallery(props: Props) {
  if (!props.userId) return null;
  return <PhotoGallerySession key={props.userId} {...props} userId={props.userId} />;
}

function PhotoGallerySession({ userId, onManage }: Props & { userId: string }) {
  const [state, setState] = useState<PhotoState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [failedSlots, setFailedSlots] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    setFailedSlots([]);
    void restorePhotos(userId).then((photos) => {
      if (!active) return;
      setState({ kind: "ready", photos });
      setSelectedSlot(photos.find((photo) => photo.isPrimary)?.slot ?? photos[0]?.slot ?? null);
    }).catch(() => {
      if (active) setState({ kind: "error" });
    });
    return () => { active = false; };
  }, [userId, attempt]);

  const photos = state.kind === "ready" ? state.photos : [];
  const selected = photos.find((photo) => photo.slot === selectedSlot) ?? photos[0];
  const retry = () => setAttempt((value) => value + 1);
  const markFailed = (slot: number) => setFailedSlots((slots) => slots.includes(slot) ? slots : [...slots, slot]);

  return <section className="doit-profile-photos" aria-label="내 프로필 사진" aria-busy={state.kind === "loading"}>
    <div className="doit-profile-photos-heading"><h2>사진에 담긴 나</h2>
      {state.kind === "ready" && photos.length > 0 && <span>{photos.length}장 저장됨</span>}
    </div>
    {state.kind === "loading" && <div className="doit-profile-photos-empty" role="status"><Camera size={24} strokeWidth={1.25} /><p>내 사진을 불러오고 있어요.</p></div>}
    {state.kind === "error" && <div className="doit-profile-photos-empty" role="status"><p>사진을 불러오지 못했어요.</p><span>저장된 사진은 그대로 두었어요.</span><button type="button" onClick={retry}><RefreshCw size={14} /> 다시 불러오기</button></div>}
    {state.kind === "ready" && !selected && <div className="doit-profile-photos-empty"><Camera size={28} strokeWidth={1.25} /><p>지금의 나를 한 장씩 담아보세요.</p><span>아직 저장한 사진이 없어요.</span></div>}
    {selected && <>
      <div className="doit-profile-photo-main">
        {failedSlots.includes(selected.slot) ? <div className="doit-profile-photos-empty"><p>사진을 다시 불러와 주세요.</p><button type="button" onClick={retry}><RefreshCw size={14} /> 사진 새로 보기</button></div> :
          <img key={selected.url} src={selected.url} alt={selected.isPrimary ? "내 대표 프로필 사진" : `내 프로필 사진 ${selected.slot + 1}`} referrerPolicy="no-referrer" onError={() => markFailed(selected.slot)} />}
        {selected.isPrimary && <span className="doit-profile-photo-primary">대표 사진</span>}
      </div>
      {photos.length > 1 && <div className="doit-profile-photo-thumbnails">{photos.map((photo) => <button key={photo.photoId} type="button" aria-label={`사진 ${photo.slot + 1}${photo.isPrimary ? ", 대표 사진" : ""} 보기`} aria-pressed={photo.slot === selected.slot} onClick={() => setSelectedSlot(photo.slot)}>
        {failedSlots.includes(photo.slot) ? <Camera size={20} aria-hidden="true" /> : <img src={photo.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => markFailed(photo.slot)} />}
      </button>)}</div>}
    </>}
    {onManage && <button type="button" className="doit-profile-photo-manage" onClick={onManage}><Camera size={16} strokeWidth={1.5} />{state.kind === "ready" && photos.length === 0 ? "사진 추가하기" : "사진 추가·관리하기"}<span aria-hidden="true">↗</span></button>}
    <p className="doit-profile-photo-note">연결을 받으려면 전신·패션·취미 세 장이 필요해요. 최근 2개월 안에 찍은 본인 사진으로 올려 주세요. 사진 등록과 본인 인증은 별개예요.</p>
  </section>;
}
