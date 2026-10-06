import AnimatedSection from '@/components/AnimatedSection';

export default function DiscoverySection() {
  return (
    <section id="discovery" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-5 text-center">
            아, 내가 이래서 그랬구나.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-10">
            ECHO가 답을 정해주는 게 아니라,<br />
            이야기하다 보면<br />내가 내 마음을 조금씩 알아가게 돼요.
          </p>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={20} delay={300}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
            <p className="text-[11px] text-white/55 uppercase tracking-wider mb-4">오늘의 발견</p>

            <p className="text-sm md:text-base text-white/90 font-medium leading-relaxed mb-6">
              오늘은 일이 많았던 것보다<br />
              내가 기대했던 만큼 하지 못했다는 마음이<br />
              조금 더 크게 남아 있었어요.
            </p>

            <div className="h-px bg-white/8 mb-4" />

            <p className="text-[11px] text-white/55 text-center font-medium">
              내가 확인한 내용만 남겨요.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}