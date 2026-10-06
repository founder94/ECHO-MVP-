import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function HeroSection() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const reveal = (delay: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });

  return (
    <section className="relative w-full min-h-[100svh] flex flex-col items-center justify-center overflow-x-hidden pt-24 pb-16 md:pb-20">
      <div className="relative z-10 text-center px-5 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center">
          {/* 점형 워드마크 ECHO */}
          <p
            style={reveal(0)}
            className="text-[11px] tracking-[0.5em] text-white/55 font-medium mb-6 uppercase whitespace-nowrap"
          >
            ECHO
          </p>

          {/* 브랜드 문구 */}
          <p
            style={reveal(120)}
            className="text-[15px] md:text-base font-semibold text-white/90 mb-3 whitespace-nowrap"
          >
            진짜 나를 찾아줘
          </p>

          {/* 가장 큰 메인 제목 */}
          <h1
            style={reveal(240)}
            className="text-[26px] md:text-[32px] leading-snug font-bold text-white mb-4"
          >
            오늘 내 마음의
            <br />
            날씨는 어때?
          </h1>

          {/* 서브 문구 */}
          <p
            style={reveal(360)}
            className="text-[13.5px] md:text-[15px] text-white/70 mb-10"
          >
            내 마음을 알면, 내가 보인다.
          </p>

          {/* 시작하기 버튼 → /start */}
          <Link
            to="/start"
            style={reveal(480)}
            className="w-full max-w-xs h-14 rounded-2xl bg-transparent border border-white/40 text-white text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/10 active:scale-[0.99] transition-all duration-200"
          >
            시작하기
            <i className="ri-arrow-right-line" />
          </Link>
        </div>
      </div>
    </section>
  );
}