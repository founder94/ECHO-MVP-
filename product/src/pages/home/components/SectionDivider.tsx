import AnimatedSection from '@/components/AnimatedSection';

interface SectionDividerProps {
  index: number;
}

// 섹션 사이를 잇는 연결 요소 — 번호 + 흐르는 선 + 아래 화살표
export default function SectionDivider({ index }: SectionDividerProps) {
  return (
    <div className="relative w-full flex items-center justify-center py-4 md:py-6">
      <AnimatedSection direction="up" distance={16}>
        <div className="flex flex-col items-center gap-2.5">
          {/* 번호 표시 */}
          <span className="text-[10px] md:text-[11px] tracking-[0.35em] text-white/40 font-medium select-none">
            {String(index).padStart(2, '0')}
          </span>

          {/* 흐르는 세로 선 */}
          <div className="relative w-px h-7 md:h-9 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-transparent" />
            <div
              className="absolute top-0 left-0 w-px h-3 bg-white/50 animate-flow-line"
            />
          </div>

          {/* 아래 화살표 */}
          <i className="ri-arrow-down-s-line text-white/35 text-base md:text-lg animate-scroll-cue" />
        </div>
      </AnimatedSection>
    </div>
  );
}