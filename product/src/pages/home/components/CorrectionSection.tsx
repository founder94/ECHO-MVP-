import AnimatedSection from '@/components/AnimatedSection';

export default function CorrectionSection() {
  return (
    <section id="correction" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-4 text-center">
            아니라고 하면,<br />다시 물어요.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={100}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-8">
            틀린 해석을 그대로 밀고 가지 않아요.<br />
            내가 아니라고 하면,<br />다른 방향에서 다시 물어봐요.
          </p>
        </AnimatedSection>

        {/* BEFORE */}
        <AnimatedSection direction="up" distance={20} delay={200}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 mb-4">
            <p className="text-[11px] text-white/55 uppercase tracking-wider mb-3">BEFORE</p>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-dot text-white/80">E</span>
              </div>
              <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-xs md:text-sm text-white/90 font-medium leading-relaxed">
                  사람들이 내 노력을 알아주지 않아서<br />속상했던 걸까?
                </p>
              </div>
            </div>

            {/* User response */}
            <div className="flex justify-end mb-4">
              <span className="inline-block px-4 py-2 rounded-full bg-white/[0.08] border border-white/20 text-xs text-white/80 font-medium">
                그게 아니에요
              </span>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <i className="ri-arrow-down-line text-white/50 text-sm" />
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* AFTER */}
            <p className="text-[11px] text-white/55 uppercase tracking-wider mb-3">AFTER</p>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-dot text-white/80">E</span>
              </div>
              <div className="bg-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] border border-white/10">
                <p className="text-xs md:text-sm text-white/95 font-medium leading-relaxed">
                  알겠어요.<br />조금 다르게 볼게요.<br /><br />
                  사람들의 반응보다<br />
                  내가 기대했던 만큼 해내지 못했다는 느낌이<br />
                  더 마음에 남았을까?
                </p>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}