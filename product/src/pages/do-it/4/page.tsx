import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DoItPage4() {
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

  const goStart = () => {
    if (navLock.current) return;
    navLock.current = true;
    navigate('/doit/start-journey');
  };

  return (
    <div className="relative w-full h-svh overflow-hidden bg-black">
      {/* 배경 - 우주인 앞에 펼쳐진 빛의 연결망 */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://static.readdy.ai/image/e224f7e72060e6f454dd03772ed2f9f9/e2e97079b3eed5008b6b516100eacd64.png"
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
          STEP 04 — 메아리의 답
        </p>

        {/* 메인 문구 */}
        <h1
          style={reveal(200)}
          className="text-[28px] md:text-[36px] lg:text-[42px] leading-[1.25] font-bold text-white mb-4 md:mb-6"
        >
          메아리처럼
          <br />
          돌아오는 이야기.
        </h1>

        {/* 서브 문구 */}
        <p
          style={reveal(400)}
          className="text-[14px] md:text-[16px] leading-[1.6] text-white/80 mb-16 max-w-[280px] md:max-w-md"
        >
          당신이 남긴 오늘의 이야기가
          <br />
          우주를 돌아 당신에게 돌아옵니다.
          <br />
          내일, 뜻밖의 연결을 만나보세요.
        </p>

        {/* 시작 버튼 — 13구간 소개 마지막. 목적 선택(/doit/start-journey)으로 안내한다. */}
        <button
          type="button"
          onClick={goStart}
          style={reveal(600)}
          className="w-full max-w-xs h-14 rounded-full bg-white/10 border border-white/30 text-white text-[15px] font-medium flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          시작하기
          <span>→</span>
        </button>

        {/* 2026-09-20 대표 확정: 메인은 Plan A 하나다. 여기서 예전 B(마음 날씨) 선택 화면으로 가는 문을 닫는다.
            화면 파일은 지우지 않았고, 이 자리에 대체 버튼도 넣지 않는다. */}
      </div>
    </div>
  );
}