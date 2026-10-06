import { useState } from "react";
import { Lock } from "lucide-react";
import { EXTRA_PHOTO_VISIBLE_PERCENT } from "@/doit/lib/photoPolicy";
import { UNLOCK_KEY_COST, UNLOCK_LIVE, unlockLabel } from "@/doit/lib/unlockPrices";
import { OPEN_PERIOD } from "@/doit/lib/openPeriod";
import "./locked-profile.css";

// 다른 사람의 프로필에서 KEY 로 여는 두 가지(2026-10-06 대표 「스토리는 버튼 안에 자물쇠 · 추가 사진은 65 보이고 35 흐리게 · 몇 KEY 인지 훅킹」).
// - 지금은 서버 KEY 원장이 없어 실제로 열리지 않는다(UNLOCK_LIVE=false). 누르면 몇 KEY 인지와 「준비 중」만 알려 준다 — KEY 를 빼지 않는다.
// - 안내 문장은 궁금하게 만들되 거짓 약속·불안 자극은 하지 않는다(「놓치면 끝」 같은 말 금지).

// 추가 사진: 위쪽 65%는 그대로, 아래 35%는 흐림 + 어두운 막. 흐린 부분도 같은 사진이라 「다음 장면」이 궁금해진다.
export function FadedExtraPhoto({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="doit-faded" style={{ ["--doit-visible" as string]: `${EXTRA_PHOTO_VISIBLE_PERCENT}%` }}>
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={onError} />
    <div className="doit-faded-veil" aria-hidden="true"><img src={src} alt="" referrerPolicy="no-referrer" /></div>
    <button type="button" className="doit-faded-lock" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <Lock size={13} strokeWidth={2.2} aria-hidden="true" /> KEY {UNLOCK_KEY_COST.extraPhoto}<span className="doit-sr">로 아래까지 보기</span>
    </button>
    {open && <p className="doit-unlock-hint" role="status">{UNLOCK_LIVE ? unlockLabel("extraPhoto") : `${unlockLabel("extraPhoto")} · 아직 KEY를 쓰지 않아요`}</p>}
  </div>;
}

// 스토리 버튼: 자물쇠가 버튼 「안」에 있다. 누르면 무엇이 있는지와 몇 KEY 인지 알려 준다.
export function StoryLockButton({ who = "이 사람" }: { who?: string }) {
  const [open, setOpen] = useState(false);
  return <div className="doit-story-lock">
    <button type="button" className="doit-story-lock-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
      <span className="doit-story-lock-icon" aria-hidden="true"><Lock size={16} strokeWidth={2.2} /></span>
      <span className="doit-story-lock-text"><b>스토리</b><small>{who}의 하루 이야기</small></span>
      <span className="doit-story-lock-cost">KEY {UNLOCK_KEY_COST.story}</span>
    </button>
    {open && <div className="doit-unlock-card" role="status">
      <p><b>{who}이 사진 밖에서 어떻게 지내는지,</b> 스토리에 담겨 있어요.</p>
      <p>{unlockLabel("story")}. 한 번 열면 이 사람의 스토리를 계속 볼 수 있게 할 거예요.</p>
      {!UNLOCK_LIVE && <p className="doit-unlock-soon">{OPEN_PERIOD.active ? OPEN_PERIOD.key : "지금은 준비 중이라 열리지 않아요."} 지금은 KEY도 쓰지 않아요.</p>}
    </div>}
  </div>;
}
