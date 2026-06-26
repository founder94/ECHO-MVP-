import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PuzzleTextReveal from './PuzzleTextReveal';

gsap.registerPlugin(ScrollTrigger);

interface CEOStatementProps {
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  onFounderClick: () => void;
}

const CEOStatement = ({ isAuthenticated, onAuthRequired, onFounderClick }: CEOStatementProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (textRef.current) {
        const paragraphs = textRef.current.querySelectorAll('.ceo-para');
        gsap.from(paragraphs, {
          y: 40,
          opacity: 0,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 75%',
            end: 'top 30%',
            toggleActions: 'play none none none',
          },
        });
      }
      if (quoteRef.current) {
        gsap.from(quoteRef.current, {
          scale: 0.9,
          opacity: 0,
          duration: 0.8,
          ease: 'back.out(1.4)',
          scrollTrigger: {
            trigger: quoteRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      }
      if (gateRef.current && !isAuthenticated) {
        gsap.fromTo(gateRef.current,
          { y: 20, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: {
              trigger: gateRef.current,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          },
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, [isAuthenticated]);

  const visibleParagraphs = [
    '안녕하세요.',
    'ECHO를 만든 박진욱입니다.',
    '저는 오랫동안 사람과 관계에 대해 고민해 왔습니다.',
    '10년이 넘는 시간 동안 다양한 만남을 경험했고, 소개팅, 소개팅 앱, 지인 소개, 커뮤니티, SNS 등 사람이 사람을 만나는 수많은 방식들을 직접 경험했습니다.',
    '그리고 한 가지 질문이 계속 남았습니다.',
    '왜 우리는 비슷한 패턴을 반복할까. 왜 관계가 변한 뒤에도 쉽게 앞으로 나아가지 못할까. 왜 새로운 사람을 만나도 같은 문제를 반복할까.',
    '처음에는 상대의 문제라고 생각했습니다. 하지만 시간이 지나면서 깨달았습니다.',
    '우리가 흔들리는 이유는 상대를 잃어서만이 아니라, 관계 속에서 내가 누구인지 잃어버렸기 때문일 수도 있다는 사실을.',
    '관계 안에서 우리는 생각보다 많은 것을 포기합니다. 인정받고 싶어 맞추고, 불안해서 감정을 숨기고, 사랑받기 위해 원래의 나를 조금씩 바꾸기도 합니다.',
  ];

  const hiddenParagraphs = [
    '그리고 관계가 변한 뒤에는 상대보다 먼저, 관계 속에서 흐려진 자기 자신을 다시 만나야 한다는 사실을 알게 됩니다.',
    'ECHO는 바로 그 질문에서 시작되었습니다. 누군가를 평가하거나 분석하기 위한 서비스가 아닙니다. 관계를 통해 나는 어떤 사람인지, 무엇을 중요하게 생각하는지, 어떤 관계를 원하는 사람인지를 다시 이해하도록 돕기 위한 여정입니다.',
    '저 역시 아직 완벽한 답을 찾은 사람은 아닙니다. 하지만 분명히 믿는 것이 있습니다. 사람은 결국 사람을 믿고 관계를 시작한다는 것. 그리고 관계는 사람을 흔들기도 하지만, 다시 성장하게 만들기도 한다는 것입니다.',
    'ECHO가 관계 속에서, 혹은 문득, 나를 다시 만나고 진짜 나를 찾아가는 작은 시작이 되기를 바랍니다.',
    '감사합니다.',
  ];

  return (
    <section ref={sectionRef} className="relative w-full overflow-hidden min-h-[500px] md:min-h-[600px]">
      {/* Background video — only visible to members */}
      <div className="absolute inset-0 w-full h-full">
        {isAuthenticated ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source
              src="https://storage.readdy-site.link/project_files/9ad157fd-fea5-4259-88ef-e04cd02aa948/fe8d772e-27f4-4d5e-acbe-c5e2d433b567__talkv_wzMqX2idlP_QkMSHJFikGofTSYSHW4mMk_talkv_high.mp4"
              type="video/mp4"
            />
          </video>
        ) : (
          <div className="w-full h-full bg-[#060606]" />
        )}
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-3xl mx-auto" ref={textRef}>
          {/* Section label */}
          <div className="ceo-para text-white/40 text-[11px] font-mono uppercase tracking-[0.3em] mb-8">
            Founder's Message
          </div>

          {/* Title */}
          <h2 className="ceo-para text-white text-2xl md:text-3xl font-semibold tracking-tight mb-10">
            대표 인사말
          </h2>

          {/* Visible paragraphs — always shown, puzzle reveal */}
          <div className="space-y-5">
            {visibleParagraphs.map((text, i) => (
              <PuzzleTextReveal
                key={`vis-${i}`}
                className="ceo-para text-white/90 text-sm md:text-base leading-[1.8]"
                staggerMs={14}
                totalDuration={0.4}
                scatterDistance={40}
              >
                {text}
              </PuzzleTextReveal>
            ))}
          </div>

          {/* Member-only gate — non-members */}
          {!isAuthenticated && (
            <div ref={gateRef} className="mt-12 pt-10 border-t border-white/[0.06]">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] mb-5">
                  <i className="ri-lock-line text-white/40 text-lg" />
                </div>
                <p className="text-white/60 font-display text-base md:text-lg tracking-tight mb-1.5">
                  여기서부터는 회원에게만 공개됩니다.
                </p>
                <p className="text-white/25 text-xs mb-6">
                  대표 인사말 전문과 영상 메시지를 확인하세요.
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); onAuthRequired(); }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium tracking-wide whitespace-nowrap transition-all duration-300 cursor-pointer hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, #FF6B9D, #9B59B6)',
                    color: '#FFFFFF',
                    boxShadow: '0 0 30px rgba(255,107,157,0.25)',
                  }}
                >
                  회원가입하고 끝까지 보기
                  <i className="ri-arrow-right-line" />
                </button>
              </div>
            </div>
          )}

          {/* Full content — members only */}
          {isAuthenticated && (
            <>
              <div className="space-y-5 mt-6">
                {hiddenParagraphs.map((text, i) => (
                  <PuzzleTextReveal
                    key={`full-${i}`}
                    className="ceo-para text-white/90 text-sm md:text-base leading-[1.8]"
                    staggerMs={14}
                    totalDuration={0.4}
                    scatterDistance={40}
                  >
                    {text}
                  </PuzzleTextReveal>
                ))}
              </div>

              {/* Signature */}
              <div className="ceo-para mt-10 text-right">
                <p className="text-white text-lg font-semibold mb-1">박진욱</p>
                <p className="text-white/60 text-sm font-mono">Founder & Relationship Designer</p>
              </div>

              {/* Highlight quote */}
              <div ref={quoteRef} className="mt-14 text-center">
                <div className="inline-block px-8 py-5 border border-white/20 rounded-lg bg-white/5 backdrop-blur-sm">
                  <p className="text-white text-lg md:text-2xl font-bold tracking-tight">
                    &ldquo;진짜 나를 찾아줘.&rdquo;
                  </p>
                </div>
              </div>

              {/* Founder Story CTA */}
              <div className="ceo-para mt-10 text-center">
                <button
                  onClick={onFounderClick}
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer hover:scale-105"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,107,157,0.12), rgba(155,89,182,0.12))',
                    border: '1px solid rgba(255,107,157,0.2)',
                    color: '#FFFFFF',
                  }}
                >
                  <i className="ri-user-star-line text-sm" />
                  Founder Story — ECHO의 시작
                  <i className="ri-arrow-right-line transition-all duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default CEOStatement;