import AnimatedSection from '@/components/AnimatedSection';

export default function WeatherMeaningSection() {
  return (
    <section id="meaning" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-5 text-center">
            같은 날씨라도,<br />마음은 모두 다르니까.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-10">
            오늘 날씨가<br />
            무슨 뜻인지는 ECHO가 정하지 않아요.<br />
            당신에게 어떤 날씨인지부터 물어볼게요.
          </p>
        </AnimatedSection>

        {/* Product UI mockup */}
        <AnimatedSection direction="up" distance={20} delay={300}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <p className="text-sm text-white/90 font-medium mb-4 text-center">
              오늘의 날씨는<br />어떤 느낌에 가까워요?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {['개운해요', '차분해요', '조금 가라앉아요', '답답해요', '아직 잘 모르겠어요', '직접 말할게요'].map((label) => (
                <button
                  key={label}
                  type="button"
                  className="px-3 py-2.5 rounded-xl border border-white/15 text-xs text-white/80 font-medium hover:border-white/35 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer whitespace-nowrap"
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-white/55 text-center font-medium">
              정답은 없어요.<br />오늘의 나에게 가까운 걸 고르면 돼요.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}