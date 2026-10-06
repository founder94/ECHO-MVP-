import { useState } from 'react';
import AnimatedSection from '@/components/AnimatedSection';

const correctionButtons = [
  { id: 'agree', label: '맞아요', activeBg: 'bg-white/10 border-white/30', defaultBg: 'border-white/10 hover:border-white/25 hover:bg-white/5' },
  { id: 'alittle', label: '조금 달라요', activeBg: 'bg-white/10 border-white/30', defaultBg: 'border-white/10 hover:border-white/25 hover:bg-white/5' },
  { id: 'no', label: '그게 아니에요', activeBg: 'bg-white/15 border-white/40', defaultBg: 'border-white/10 hover:border-white/25 hover:bg-white/5' },
  { id: 'explain', label: '직접 설명할게요', activeBg: 'bg-white/10 border-white/30', defaultBg: 'border-white/10 hover:border-white/25 hover:bg-white/5' },
];

export default function DialogueSection() {
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  return (
    <section id="dialogue" className="relative w-full py-14 md:py-20">
      <div className="max-w-lg mx-auto px-6">
        <AnimatedSection direction="up" distance={30}>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-5 text-center">
            ECHO는 나를 단정하지 않아요.
          </h2>
        </AnimatedSection>

        <AnimatedSection direction="up" distance={30} delay={150}>
          <p className="text-sm text-white/75 font-medium leading-relaxed text-center mb-10">
            ECHO가 이해한 게 맞는지,<br />내가 직접 확인하고 고칠 수 있어요.
          </p>
        </AnimatedSection>

        {/* ECHO dialogue mockup */}
        <AnimatedSection direction="up" distance={20} delay={300}>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
            {/* ECHO message */}
            <div className="flex items-start gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-dot text-white/80">E</span>
              </div>
              <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-xs md:text-sm text-white/90 font-medium leading-relaxed">
                  오늘은 일이 많았던 것보다<br />
                  내 노력을 알아주지 않는다는 느낌이<br />
                  조금 더 마음에 남았던 것 같아.<br />
                  내가 이해한 게 맞아?
                </p>
              </div>
            </div>

            {/* 4 correction buttons */}
            <div className="grid grid-cols-2 gap-2">
              {correctionButtons.map((btn) => {
                const isActive = activeBtn === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setActiveBtn(isActive ? null : btn.id)}
                    className={`px-3 py-2.5 rounded-xl border text-xs transition-all duration-300 cursor-pointer whitespace-nowrap ${
                      isActive ? `${btn.activeBg} text-white font-semibold` : `${btn.defaultBg} text-white/75 font-medium`
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}