import AnimatedSection from '@/components/AnimatedSection';

const moodOptions = [
  '편안하게 듣고 싶어',
  '조금 신나고 싶어',
  '깊게 빠져들고 싶어',
  '내가 직접 고를래',
  'ECHO가 골라줘',
  '음악 없이 계속할게',
];

export default function MusicMoodSection() {
  return (
    <section id="music-mood" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-5 text-center">
            오늘 어떤 음악이 당겨?
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-10">
            오늘의 나와 함께 남겨두고 싶은<br />노래 한 곡을 골라봐요.
          </p>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={20} delay={300}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {moodOptions.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="px-3 py-3 rounded-xl border border-white/15 text-xs text-white/80 font-medium hover:border-white/35 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer whitespace-nowrap"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}