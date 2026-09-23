import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DoItPage1() {
  const [loaded, setLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const navigate = useNavigate();
  const navLock = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onMedia = () => setReducedMotion(media.matches);
    media.addEventListener('change', onMedia);
    return () => media.removeEventListener('change', onMedia);
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

  const goNext = () => {
    if (navLock.current) return;
    navLock.current = true;
    navigate('/do-it/2');
  };

  return (
    <div className="relative w-full h-svh overflow-hidden bg-black">
      {/* 배경 - 태블릿·별자리 우주인 */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/7091ddeb2fd2553d5ad75230c7401c39.png"
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center bottom' }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 md:px-8 text-center">
        {/* 장면 라벨 */}
        <p
          style={reveal(0)}
          className="text-[11px] tracking-[0.4em] text-white/70 mb-8 uppercase"
        >
          STEP 01 — 당신의 하루
        </p>

        {/* 메인 문구 */}
        <h1
          style={reveal(200)}
          className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.25] font-bold text-white mb-4 md:mb-6"
        >
          오늘의 발자국이
          <br />
          내일의 연결로 이어집니다.
        </h1>

        {/* 서브 문구 */}
        <p
          style={reveal(400)}
          className="text-[14px] md:text-[16px] leading-[1.6] text-white/80 mb-16 max-w-[280px] md:max-w-md"
        >
          당신의 하루를 우주에 남겨두세요.
          <br />
          AI가 당신의 이야기를 먼저 만나봅니다.
        </p>

        {/* 다음 버튼 */}
        <button
          type="button"
          style={reveal(600)}
          onClick={goNext}
          className="w-full max-w-xs h-14 rounded-full bg-white/10 border border-white/30 text-white text-[15px] font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          다음으로
          <span>→</span>
        </button>
      </div>
    </div>
  );
}