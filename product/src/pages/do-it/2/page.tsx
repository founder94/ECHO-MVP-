import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DoItPage2() {
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
    navigate('/do-it/3');
  };

  return (
    <div className="relative w-full h-svh overflow-hidden bg-black">
      {/* 배경 - 분화구·푸른빛 */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/6de2e89fe45a7f48a9e9d74411d5078c.png"
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center bottom' }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/70" />
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 md:px-8 text-center">
        {/* 장면 라벨 */}
        <p
          style={reveal(0)}
          className="text-[11px] tracking-[0.4em] text-white/70 mb-8 uppercase"
        >
          STEP 02 — AI의 만남
        </p>

        {/* 메인 문구 */}
        <h1
          style={reveal(200)}
          className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.25] font-bold text-white mb-4 md:mb-6"
        >
          당신이 잠든 사이,
          <br />
          AI가 먼저 만나봅니다.
        </h1>

        {/* 서브 문구 */}
        <p
          style={reveal(400)}
          className="text-[14px] md:text-[16px] leading-[1.6] text-white/80 mb-16 max-w-[280px] md:max-w-md"
        >
          수천만 km를 넘어
          <br />
          당신의 하루를 바라보는 AI.
          <br />
          이제 서로의 이야기를 시작합니다.
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