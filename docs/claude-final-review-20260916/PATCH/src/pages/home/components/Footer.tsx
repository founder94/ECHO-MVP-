import AnimatedSection from '@/components/AnimatedSection';
import { scrollToSectionBelowHeader } from '@/pages/home/scrollToSection';

export default function Footer() {
  // 2026-09-16 반응형 수정: 푸터의 섹션 앵커도 메뉴와 같이 고정 헤더 높이만큼 보정해 이동한다.
  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (scrollToSectionBelowHeader(id)) e.preventDefault();
  };
  return (
    <footer className="relative w-full py-10 md:py-16">
      {/* Top blur transition */}
      <div
        className="absolute -top-16 left-0 right-0 h-16 bg-black/10 backdrop-blur-md pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to bottom, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />
      {/* Bottom blur transition */}
      <div
        className="absolute -bottom-16 left-0 right-0 h-16 bg-black/10 backdrop-blur-md pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to top, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
        }}
      />
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
        <AnimatedSection direction="up" distance={20}>
          <div className="px-8 py-10 md:px-14 md:py-14">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              {/* Left: Logo & company info */}
              <div className="flex-1">
                <a
                  href="/"
                  className="inline-block mb-6 hover:opacity-70 transition-opacity"
                >
                  <div className="inline-block rounded-lg px-3 py-2">
                    <img
                      src="https://storage.helloreaddy.io/project_files/3af9018b-0984-400b-9a04-099fb48dbecd/697db453-f00b-4cce-a1a1-54a0d4141d86_compressed_logo.webp"
                      alt="DO-IT"
                      className="h-8 md:h-10 w-auto"
                    />
                  </div>
                </a>

                <div className="text-xs text-white leading-relaxed space-y-0.5">
                  <p>두잇(DO IT)|대표 박진욱</p>
                  <p>사업자등록번호: 121-46-51503|통신판매업 신고: 제 2026-다산-0583호</p>
                  <p>사업장 주소: 경기도 남양주시 강변북로632번길 41-7, 102동 101호(수석동)</p>
                  <p>
                    고객문의:{" "}
                    <a href="mailto:0423doit@gmail.com" className="hover:text-white/90 transition-colors">
                      0423doit@gmail.com
                    </a>
                  </p>
                </div>

                <p className="text-xs text-white mt-6">
                  &copy; 2026 DO IT COMPANY &middot; ECHO. All rights reserved.
                </p>
              </div>

              {/* Right: Links & social */}
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-6 md:gap-8">
                  <a href="/" className="text-sm text-white hover:text-white/90 transition-colors whitespace-nowrap">
                    처음
                  </a>
                  <a href="#meaning" onClick={(e) => handleAnchor(e, 'meaning')} className="text-sm text-white hover:text-white/90 transition-colors whitespace-nowrap">
                    ECHO
                  </a>
                  <a href="#jukebox" onClick={(e) => handleAnchor(e, 'jukebox')} className="text-sm text-white hover:text-white/90 transition-colors whitespace-nowrap">
                    기록
                  </a>
                </div>

                <div className="flex items-center gap-4">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="w-9 h-9 flex items-center justify-center rounded-full border text-[#E4405F] border-[#E4405F] hover:text-[#C13584] hover:border-[#C13584] transition-all"
                  >
                    <i className="ri-instagram-line text-sm" />
                  </a>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="w-9 h-9 flex items-center justify-center rounded-full border text-[#0A66C2] border-[#0A66C2] hover:text-[#004182] hover:border-[#004182] transition-all"
                  >
                    <i className="ri-linkedin-fill text-sm" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </footer>
  );
}