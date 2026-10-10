import { useState } from "react";
import { Lock } from "lucide-react";
import { EXTRA_PHOTO_FADE_PERCENT } from "@/doit/lib/photoPolicy";
import { UNLOCK_LIVE, keyCostBadge, unlockLabel } from "@/doit/lib/unlockPrices";
import { OPEN_PERIOD } from "@/doit/lib/openPeriod";
import "./locked-profile.css";

// 다른 사람의 프로필에서 KEY 로 여는 두 가지(2026-10-06 대표 「스토리는 버튼 안에 자물쇠 · 몇 KEY 인지 훅킹」 · 2026-10-10 대표 승인 「사진 전체 35% 막 + 후킹 4가지 + 스토리 12 · 추가 사진 8」).
// - 지금은 서버 KEY 원장이 없어 실제로 열리지 않는다(UNLOCK_LIVE=false). 누르면 KEY 로 열린다는 것과 「준비 중」만 알려 준다 — KEY 를 빼지 않는다. 개수는 대표 확인 뒤에만(UNLOCK_PRICES_APPROVED).
// - 안내 문장은 궁금하게 만들되 거짓 약속·불안 자극은 하지 않는다(「놓치면 끝」 같은 말 금지).

// 추가 사진(2026-10-10 대표 승인 「사진 전체 35% 막 + 후킹」):
// - 사진 전체에 35% 세기의 막(은은한 흐림 + 옅은 어둠). 장면·분위기는 보이고 자세한 부분만 흐리다 → 「선명하게 보고 싶다」.
// - 막 가운데 한 줄 힌트(teaser): 사진 올린 사람이 직접 적은 한 줄. 없으면 표시하지 않는다(지어낸 문장 0).
// - 맛보기: 한 사람당 한 장은 KEY 없이 선명하게(canTaste). 화면 상태로만 기억 — 영구 기록은 서버 원장 뒤.
// - 막은 화면 장식일 뿐 보안이 아니다(원본 주소는 같다). 실제 판매 전에는 서버가 흐린 사본을 따로 만들어 보내야 한다(별건 · 대표 승인).
export function FadedExtraPhoto({ src, alt, onError, teaser, tasted = false, canTaste = false, onTaste }: {
  src: string; alt: string; onError?: () => void; teaser?: string | null; tasted?: boolean; canTaste?: boolean; onTaste?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (tasted) {
    return <div className="doit-faded">
      <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={onError} />
      <span className="doit-faded-tasted">맛보기로 선명하게</span>
    </div>;
  }
  const line = teaser?.trim();
  return <div className="doit-faded doit-faded--veiled" style={{ ["--doit-fade" as string]: String(EXTRA_PHOTO_FADE_PERCENT / 100) }}>
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={onError} />
    <div className="doit-faded-veil" aria-hidden="true" />
    {line && <p className="doit-faded-teaser">{line}</p>}
    <button type="button" className="doit-faded-lock" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <Lock size={13} strokeWidth={2.2} aria-hidden="true" /> {keyCostBadge("extraPhoto")}<span className="doit-sr">로 선명하게 보기</span>
    </button>
    {open && <div className="doit-unlock-hint" role="status">
      <p>{UNLOCK_LIVE ? unlockLabel("extraPhoto") : `${unlockLabel("extraPhoto")} · 아직 KEY를 쓰지 않아요`}</p>
      {canTaste && onTaste && <button type="button" className="doit-faded-taste" onClick={() => { setOpen(false); onTaste(); }}>맛보기로 선명하게 보기</button>}
      {!canTaste && <p className="doit-faded-taste-used">맛보기는 한 사람당 한 장이에요.</p>}
    </div>}
  </div>;
}

// 스토리 버튼: 자물쇠가 버튼 「안」에 있다. 누르면 무엇이 있는지와 KEY 로 열린다는 것을 알려 준다(개수는 값이 정해진 뒤).
export function StoryLockButton({ who = "이 사람" }: { who?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="doit-story-lock">
    <button type="button" className="doit-story-lock-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <span className="doit-story-lock-icon" aria-hidden="true"><Lock size={16} strokeWidth={2.2} /></span>
      <span className="doit-story-lock-text"><b>스토리</b><small>{who}의 하루 이야기</small></span>
      <span className="doit-story-lock-cost">{keyCostBadge("story")}</span>
    </button>
    {open && <div className="doit-unlock-card" role="status">
      <p><b>{who}이 사진 밖에서 어떻게 지내는지,</b> 스토리에 담겨 있어요.</p>
      <p>{unlockLabel("story")}. 한 번 열면 이 사람의 스토리를 계속 볼 수 있게 할 거예요.</p>
      {!UNLOCK_LIVE && <p className="doit-unlock-soon">{OPEN_PERIOD.active ? OPEN_PERIOD.key : "지금은 준비 중이라 열리지 않아요."} 지금은 KEY도 쓰지 않아요.</p>}
    </div>}
  </div>;
}
