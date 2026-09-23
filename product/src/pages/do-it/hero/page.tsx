import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HERO_IMAGE =
  'https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/bb9c1b4084985309d99ad7bd36d3e768.png';

export default function DoItHeroPage() {
  const [loaded, setLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 동작 줄이기 감지. 접근 불가·오류 시 기본값(false)으로 정상 실행하고,
  // addEventListener 미지원 브라우저에서는 addListener 로 폴백한다. 해제 시 감지기도 제거한다.
  useEffect(() => {
    let media: MediaQueryList | null = null;
    let onMedia: (() => void) | null = null;

    try {
      if (typeof window.matchMedia === 'function') {
        media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(media.matches);
        onMedia = () => {
          try {
            setReducedMotion(media?.matches ?? false);
          } catch {
            /* 무시 */
          }
        };
        if (typeof media.addEventListener === 'function') {
          media.addEventListener('change', onMedia);
        } else if (typeof (media as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener === 'function') {
          (media as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onMedia);
        }
      }
    } catch {
      /* 감지 실패 시 기본값 유지 */
    }

    return () => {
      if (media && onMedia) {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', onMedia);
        } else if (typeof (media as MediaQueryList & { removeListener?: (cb: () => void) => void }).removeListener === 'function') {
          (media as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(onMedia);
        }
      }
    };
  }, []);

  const reveal = (delay: number) => {
    if (reducedMotion) {
      return { opacity: 1, transform: 'translateY(0)', transition: 'none' };
    }
    return {
      opacity: loaded ? 1 : 0,
      transform: loaded ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 800ms ease ${delay}ms, transform 800ms ease ${delay}ms`,
    };
  };

  const handleStart = () => {
    if (navigating) return;
    setNavigating(true);
    navigate('/do-it/landing');
  };

  return (
    <div className="relative w-full min-h-svh bg-black overflow-x-hidden">
      {/* 모바일 상단 DOIT 원본 이미지 영역 */}
      <div
        className="relative w-full md:hidden"
        style={{
          backgroundImage: `url(${HERO_IMAGE})`,
          backgroundSize: '155% auto',
          backgroundPosition: '50% 5%',
          backgroundRepeat: 'no-repeat',
          height: 'clamp(340px, 88vw, 410px)',
          overflow: 'hidden',
        }}
      >
        {/* 하단 그라데이션 — 원본 이미지 속 문구/버튼 완전히 숨김 */}
        <div className="absolute bottom-0 left-0 right-0 h-[48%] bg-gradient-to-t from-black via-black/92 to-transparent pointer-events-none" />
      </div>

      {/* 데스크톱 전체 배경 이미지 */}
      <img
        src={HERO_IMAGE}
        alt=""
        loading="eager"
        decoding="async"
        className="hidden md:block absolute inset-0 w-full h-full object-cover"
        draggable={false}
        aria-hidden="true"
      />

      {/* 데스크톱 가림막 — 원본 이미지 속 작은 문구·가짜 버튼을 실제 문구·버튼과 겹치지 않게 숨긴다. DO IT 큰 글자(상단)는 가리지 않는다. */}
      <div className="hidden md:block absolute inset-0 z-[1] bg-gradient-to-b from-black/30 via-black/50 to-black/85 pointer-events-none" aria-hidden="true" />

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center px-5 pb-8 text-center md:absolute md:inset-0 md:justify-end md:px-8 md:pb-16">
        {/* 제목 — 정확히 두 줄 */}
        <h1
          style={{
            fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: '-0.04em',
            wordBreak: 'keep-all',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            ...reveal(0),
          }}
          className="text-white mt-[40px] text-[clamp(27px,7.7vw,32px)] md:text-[37px] md:mt-0"
        >
          <span className="block">당신이 잠든 사이,</span>
          <span className="block">AI가 먼저 만나봅니다.</span>
        </h1>

        {/* 서브 문구 — 실제 HTML 글자, 정확히 한 줄 (제목 아래 24px) */}
        <p
          style={{
            ...reveal(120),
            whiteSpace: 'nowrap',
            wordBreak: 'keep-all',
          }}
          className="mt-6 text-white/85 text-[clamp(13px,3.7vw,15px)] md:text-[16px] max-w-full px-1"
        >
          프로필보다, 함께한 행동을 봅니다.
        </p>

        {/* 시작 버튼 (서브 문구 아래 48px) */}
        <button
          type="button"
          onClick={handleStart}
          disabled={navigating}
          style={reveal(200)}
          className="mt-12 w-full max-w-[480px] h-[64px] min-h-[64px] rounded-full bg-black/70 border border-white/30 text-white text-[15px] font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-black/80 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:w-[280px]"
        >
          지금 시작하기
          <span>→</span>
        </button>
      </div>
    </div>
  );
}