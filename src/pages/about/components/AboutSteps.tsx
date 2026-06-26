import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const STEPS = [
  {
    num: '01',
    title: '관계를 꺼내놓다',
    desc: '지나온 관계와 감정을 AI와 함께 정리합니다.',
    detail:
      '과거의 대화, 감정의 흐름, 반복되는 패턴을 데이터로 읽어냅니다. 숨겨졌던 이야기가 조금씩 드러나기 시작합니다.',
  },
  {
    num: '02',
    title: '나의 패턴을 마주하다',
    desc: '내가 반복하는 선택과 감정의 이유를 구조적으로 이해합니다.',
    detail:
      '왜 같은 감정에 자주 빠지는지, 왜 특정 순간에 뒷걸음질 치는지. 나의 무의식적 패턴을 명확하게 봅니다.',
  },
  {
    num: '03',
    title: '진짜 나로 만나다',
    desc: '나만의 기준이 생긴 채로, 나답게 사람을 만납니다.',
    detail:
      '더 이상 맞추지 않습니다. 흐려진 정체성을 선명히 하고, 나답게 사랑하고 관계 맺는 법을 발견합니다.',
  },
];

export default function AboutSteps() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          gsap.fromTo(
            section.querySelector('.steps-label'),
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
          );
          gsap.fromTo(
            cardRefs.current.filter(Boolean),
            { opacity: 0, y: 50 },
            {
              opacity: 1,
              y: 0,
              duration: 1,
              stagger: 0.25,
              ease: 'power3.out',
              delay: 0.3,
            }
          );
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section
      ref={sectionRef}
      className="relative py-28 md:py-36 bg-[#0a0a0a] overflow-hidden px-6"
    >
      {/* Background rings */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full border border-white/[0.03]" />
        <div className="absolute bottom-[15%] right-[5%] w-[400px] h-[400px] rounded-full border border-white/[0.02]" />
      </div>

      <div className="max-w-[1000px] mx-auto relative z-10">
        {/* Section label */}
        <p
          className="steps-label text-[10px] md:text-[11px] font-mono tracking-[0.4em] uppercase text-white/30 mb-4 md:mb-6"
          style={{ opacity: 0 }}
        >
          어떻게 작동하나
        </p>
        <h2
          className="text-[22px] md:text-[28px] font-normal text-white/90 mb-16 md:mb-20 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
        >
          세 단계로, 나를 다시 만나다
        </h2>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="group relative bg-[#0f0f0f] border border-white/[0.06] rounded-lg p-7 md:p-8 transition-all duration-500 hover:border-white/[0.15] hover:-translate-y-1.5 cursor-default"
              style={{ opacity: 0 }}
            >
              {/* Step number */}
              <span
                className="text-[48px] md:text-[56px] font-light text-white/[0.08] leading-none block mb-5 md:mb-6"
                style={{ fontFamily: 'var(--font-label, monospace)' }}
              >
                {step.num}
              </span>

              {/* Title */}
              <h3
                className="text-[16px] md:text-[18px] font-medium text-white/90 mb-3 tracking-[-0.01em]"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                {step.title}
              </h3>

              {/* Desc */}
              <p
                className="text-[13px] md:text-[14px] text-white/50 leading-[1.7] mb-4"
                style={{ wordBreak: 'keep-all' }}
              >
                {step.desc}
              </p>

              {/* Detail — appears on hover */}
              <p
                className="text-[12px] md:text-[13px] text-white/30 leading-[1.7] transition-all duration-500 group-hover:text-white/50"
                style={{ wordBreak: 'keep-all' }}
              >
                {step.detail}
              </p>

              {/* Hover glow line */}
              <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/0 group-hover:bg-white/10 transition-all duration-500 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}