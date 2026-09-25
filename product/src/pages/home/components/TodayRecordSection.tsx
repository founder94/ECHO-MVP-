import AnimatedSection from '@/components/AnimatedSection';
import drizzleIcon from './weather-icons/weather-drizzle.svg';

export default function TodayRecordSection() {
  return (
    <section id="today-record" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-8 text-center">
            오늘의 나를,<br />노래 한 곡과 함께 남겨요.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={20} delay={150}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
            {/* Date */}
            <p className="text-sm text-white/60 mb-4">2026.08.08</p>

            {/* Weather */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src={drizzleIcon} alt="부슬비" className="w-6 h-6" />
              </div>
              <span className="text-sm text-white/90 font-medium">부슬비</span>
            </div>

            {/* Today's story */}
            <div className="mb-4">
              <p className="text-[10px] text-white/55 uppercase tracking-wider mb-2">오늘의 이야기</p>
              <p className="text-sm text-white/85 font-medium leading-relaxed">
                오늘은 생각보다 마음이 복잡했다.
              </p>
            </div>

            {/* Today's discovery */}
            <div className="mb-4">
              <p className="text-[10px] text-white/55 uppercase tracking-wider mb-2">오늘 내가 알게 된 것</p>
              <p className="text-sm text-white/90 font-medium leading-relaxed">
                사람들의 반응보다<br />
                내가 나에게 기대했던 마음이<br />
                더 크게 남아 있었다.
              </p>
            </div>

            {/* Today's song */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/8">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <i className="ri-music-line text-sm text-white/60" />
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium">SONG 01</p>
                <p className="text-[10px] text-white/55">ARTIST</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-white/55 text-center mt-5 font-medium">
            오늘의 마음과 이야기가<br />하나의 기억으로 남아요.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}