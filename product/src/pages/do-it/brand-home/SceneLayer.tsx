import { useEffect, useRef, type ReactNode } from 'react';

// 2026-10-05 대표 「핵심 4페이지만 스크롤 · 나머지는 버튼 누르면 배경 그림이 뜨고 설명」: 화면 가득 여는 장면 창.
// 열면 배경 사진이 앞으로 다가오며 선명해지고(움직임 줄이기면 정지) 글자가 올라온다. 닫기 = ✕ · Esc · 바깥 어두운 곳 누르기. 닫으면 누른 버튼으로 초점이 돌아간다.
// 뒤 화면은 스크롤되지 않게 이 창이 열린 동안만 html 의 overflow 를 잠근다(닫으면 원래 값으로).
export default function SceneLayer({ label, image, focus, pos = 'top', onClose, children, footer, opener: openerProp }: {
  label: string;
  // 사진 구도에 맞춘 글자 자리(이야기 장면의 pos · Codex PR #130 P2 4184522065). 기본 = 위.
  pos?: 'top' | 'middle' | 'bottom';
  opener?: HTMLElement | null;
  image?: string;
  focus?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const closeFn = useRef(onClose);
  useEffect(() => { closeFn.current = onClose; });

  useEffect(() => {
    // 닫으면 초점을 돌려줄 곳: 연 쪽이 넘겨준 단추(메뉴는 닫히며 사라지므로 메뉴 단추) · 없으면 연 순간의 초점(Codex PR #130 P2)
    const opener = openerProp ?? (document.activeElement as HTMLElement | null);
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeFn.current(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      // 초점이 창 밖으로 빠졌으면(예: 「영상 보기」 단추가 영상으로 바뀜) 창 안으로 되돌린다(Codex PR #130 P2)
      if (!boxRef.current.contains(document.activeElement)) { e.preventDefault(); closeRef.current?.focus(); return; }
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),video[controls],[tabindex="0"]'));
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); root.style.overflow = before; opener?.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 연 순간 한 번만(장면이 바뀌어도 초점·스크롤 잠금은 그대로)

  return (
    <div className="bh-layer" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="bh-layer-box">
        {/* 장면이 바뀔 때(이전·다음)는 배경·글자만 새로 들어온다 — 닫기·이동 버튼은 그대로라 초점이 사라지지 않는다 */}
        {/* 휴대폰에서는 창이 화면 전체라 「바깥」이 없다 → 사진의 빈 곳(글·단추가 아닌 곳)을 누르면 닫는다(Codex PR #130 P2) */}
        <div className={`bh-layer-scene bh-layer-scene--${pos}`} key={label} onClick={(e) => { if (!(e.target as HTMLElement).closest('.bh-layer-body > *')) onClose(); }}>
          {image ? <img className="bh-layer-bg" src={image} alt="" aria-hidden="true" decoding="async" style={focus ? { objectPosition: focus } : undefined} /> : <div className="bh-stars" aria-hidden="true" />}
          <div className="bh-layer-body">{children}</div>
        </div>
        <button ref={closeRef} type="button" className="bh-layer-close" onClick={onClose}><span className="bh-sr">닫기</span><span aria-hidden="true">✕</span></button>
        {footer && <div className="bh-layer-foot">{footer}</div>}
      </div>
    </div>
  );
}
