import AnimatedSection from '@/components/AnimatedSection';

export default function StorySection() {
  return (
    <section id="story" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-5 text-center">
            날씨 하나에서,<br />오늘의 이야기가 시작돼요.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-10">
            길게 쓰지 않아도 괜찮아요.<br />한 문장부터 시작해도 돼요.
          </p>
        </AnimatedSection>

        {/* Input mockup */}
        <AnimatedSection direction="up" distance={20} delay={300}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <p className="text-sm text-white/90 font-medium mb-4 text-center">
              오늘 이 날씨에는<br />어떤 이야기가 있어?
            </p>

            <div className="relative">
              <textarea
                rows={2}
                placeholder="오늘 있었던 일을 편하게 적어주세요."
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/40 resize-none focus:outline-none focus:border-white/30 transition-colors"
                readOnly
              />
            </div>

            <p className="text-[11px] text-white/55 text-center mt-3 font-medium">
              한두 문장이면 충분해요.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}