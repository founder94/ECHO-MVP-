import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MagneticButton from '@/components/base/MagneticButton';

interface Section6Props {
  isDarkMode: boolean;
}

gsap.registerPlugin(ScrollTrigger);

const contactCards = [
  { icon: 'ri-mail-line', label: 'Email', value: '0423doit@gmail.com', href: 'mailto:0423doit@gmail.com', color: '#EA4335' },
  { icon: 'ri-map-pin-line', label: 'Location', value: 'Seoul, Korea', href: 'https://maps.google.com/?q=Seoul,Korea', color: '#34A853' },
  { icon: 'ri-linkedin-line', label: 'LinkedIn', value: 'jinwookpark-founder', href: 'https://www.linkedin.com/in/jinwookpark-founder', color: '#0A66C2' },
  { icon: 'ri-global-line', label: 'Parent Brand', value: 'DO IT COMPANY', href: 'https://do-it.company/', color: '#D4D4D4' },
  { icon: 'ri-instagram-line', label: 'Instagram', value: '@parkobserver', href: 'https://www.instagram.com/parkobserver/', color: '#E4405F' },
  { icon: 'ri-youtube-line', label: 'YouTube', value: 'ECHO Channel', href: 'https://youtube.com/channel/UCixQI2A67_pMgugbO-GYK6Q', color: '#FF0000' },
  { icon: 'ri-google-line', label: 'Google', value: 'ECHO Search', href: 'https://www.google.com/search?q=ECHO+DO+IT+COMPANY', color: '#4285F4' },
];

export default function Section6({ isDarkMode }: Section6Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgTextRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      if (bgTextRef.current) {
        gsap.fromTo(bgTextRef.current,
          { y: 180, opacity: 0, scale: 0.82 },
          { y: 0, opacity: 1, scale: 1, duration: 2.0, ease: 'power3.out',
            scrollTrigger: { trigger: bgTextRef.current, start: 'top 90%', toggleActions: 'play none none none' } }
        );
      }
      if (titleRef.current) {
        gsap.fromTo(titleRef.current,
          { y: 100, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: 'power4.out',
            scrollTrigger: { trigger: titleRef.current, start: 'top 82%', toggleActions: 'play none none none' } }
        );
      }
      if (descRef.current) {
        gsap.fromTo(descRef.current,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', delay: 0.18,
            scrollTrigger: { trigger: descRef.current, start: 'top 85%', toggleActions: 'play none none none' } }
        );
      }
      if (formRef.current) {
        gsap.fromTo(formRef.current,
          { y: 80, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 1.3, ease: 'power4.out', delay: 0.3,
            scrollTrigger: { trigger: formRef.current, start: 'top 92%', toggleActions: 'play none none none' } }
        );
      }
      if (cardsRef.current) {
        gsap.fromTo(cardsRef.current,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', delay: 0.22,
            scrollTrigger: { trigger: cardsRef.current, start: 'top 88%', toggleActions: 'play none none none' } }
        );
      }
    }, sectionRef);
    return () => ctx.revert();
  }, [isDarkMode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const honeypotEl = form.querySelector<HTMLInputElement>('[name="company_alt"]');
    if (honeypotEl && honeypotEl.value.trim() !== '') {
      setSubmitStatus('success');
      setTimeout(() => setSubmitStatus('idle'), 3000);
      return;
    }
    setSubmitStatus('submitting');
    try {
      const formData = new FormData(form);
      if (honeypotEl) formData.delete('company_alt');
      const urlEncoded = new URLSearchParams(formData as any).toString();
      await fetch('https://readdy.ai/api/form/d8tq88ob9jno5e72bocg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: urlEncoded,
      });
      setSubmitStatus('success');
      form.reset();
      setTimeout(() => setSubmitStatus('idle'), 4000);
    } catch {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 4000);
    }
  };

  const accentColor = isDarkMode ? '#D4D4D4' : '#3D3D3D';
  const bgTextOpacity = isDarkMode ? 0.04 : 0.025;

  return (
    <section
      id="contact"
      ref={sectionRef}
      className={`relative w-full py-44 md:py-60 overflow-hidden ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-[#f8f8f8] text-black'}`}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      <div
        ref={bgTextRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
      >
        <div
          className="font-display font-bold tracking-tighter leading-none whitespace-nowrap"
          style={{
            fontSize: 'clamp(9rem, 20vw, 30rem)',
            color: isDarkMode ? `rgba(255,255,255,${bgTextOpacity})` : `rgba(0,0,0,${bgTextOpacity})`,
            textShadow: isDarkMode ? '0 0 200px rgba(255,255,255,0.03)' : '0 0 200px rgba(0,0,0,0.02)',
          }}
        >
          CONNECT
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {[0, 1].map((n) => (
          <div
            key={n}
            className="absolute rounded-full border border-white/[0.05]"
            style={{
              width: `${200 + n * 100}px`,
              height: `${200 + n * 100}px`,
              top: `${25 - n * 10}%`,
              left: `${-8 + n * 4}%`,
              animation: `float-3d-${n + 1} ${24 + n * 2}s ${n * 3}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 md:px-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-14 md:gap-20">
          <div className="lg:col-span-3">
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-[1px]" style={{ background: accentColor, opacity: 0.5 }} />
                <span className="text-[10px] font-mono tracking-[0.5em] uppercase" style={{ color: accentColor, opacity: 0.7 }}>
                  Contact
                </span>
              </div>
              <h2
                ref={titleRef}
                className="font-display font-bold tracking-tighter leading-[0.92] mb-8"
                style={{ fontSize: 'clamp(2.8rem, 8vw, 6.5rem)' }}
              >
                Let's Build<br />
                <span style={{ color: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }}>
                  Together
                </span>
              </h2>
              <p
                ref={descRef}
                className="text-base md:text-lg leading-relaxed max-w-md"
                style={{ color: isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)' }}
              >
                관계의 운영체제, ECHO. 당신의 이야기를 들려주세요.
                우리는 당신이 진짜 나를 찾는 여정에 함께합니다.
              </p>
            </div>

            <div ref={cardsRef} className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-5">
              {contactCards.map((card, i) => {
                const isHovered = hoveredCard === i;
                const CardWrapper = card.href ? 'a' : 'div';
                const wrapperProps = card.href
                  ? { href: card.href, target: '_blank', rel: 'noopener noreferrer', className: 'cursor-pointer' }
                  : {};

                return (
                  <CardWrapper
                    key={card.label}
                    {...wrapperProps}
                    onMouseEnter={() => setHoveredCard(i)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className={`relative rounded-xl p-5 md:p-6 transition-all duration-600 border ${
                      isHovered
                        ? 'bg-white/[0.05] border-white/[0.15] scale-[1.03]'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.10]'
                    } ${card.href ? 'block' : ''}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-all duration-600 ${
                        isHovered ? 'scale-110' : ''
                      }`}
                      style={{
                        color: isHovered ? card.color : `${card.color}66`,
                        backgroundColor: isHovered ? `${card.color}14` : `${card.color}08`,
                      }}
                    >
                      <i className={`${card.icon} text-sm`} />
                    </div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.25em] mb-1.5 text-white/22">{card.label}</p>
                    <p className="text-xs md:text-sm font-medium text-white/60">{card.value}</p>
                  </CardWrapper>
                );
              })}
            </div>
          </div>

          <div ref={formRef} className="lg:col-span-2">
            <div className="rounded-xl p-8 md:p-10 border border-white/[0.08] bg-white/[0.02]">
              <h3 className="text-lg font-display font-semibold tracking-tight mb-1.5">프로젝트 문의</h3>
              <p className="text-sm mb-8 text-white/30">아래 정보를 남겨주시면 48시간 이내에 연락드립니다.</p>

              <form data-readdy-form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <input
                  type="text"
                  name="company_alt"
                  className="hp-field"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex-1">
                    <label className="text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block text-white/22">이름 *</label>
                    <input
                      type="text"
                      name="name"
                      required
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]"
                      placeholder="홍길동"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block text-white/22">이메일 *</label>
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]"
                      placeholder="hello@example.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-5">
                  <div className="flex-1">
                    <label className="text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block text-white/22">회사명</label>
                    <input
                      type="text"
                      name="company"
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]"
                      placeholder="회사명 (선택)"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block text-white/22">관심 서비스</label>
                    <select
                      name="service_interest"
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border appearance-none cursor-pointer bg-white/[0.03] border-white/[0.08] text-white focus:border-white/[0.18] focus:bg-white/[0.05]"
                    >
                      <option value="">선택해주세요</option>
                      <option value="human-experience">Human Experience Design</option>
                      <option value="relationship-intelligence">Relationship Intelligence</option>
                      <option value="identity-recovery">Identity Recovery</option>
                      <option value="ai-coaching">AI Coaching</option>
                      <option value="data-platform">Data Platform</option>
                      <option value="other">기타 문의</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-[0.25em] mb-2 block text-white/22">문의 내용 *</label>
                  <textarea
                    name="message"
                    required
                    maxLength={500}
                    rows={4}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all duration-300 border resize-none bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/10 focus:border-white/[0.18] focus:bg-white/[0.05]"
                    placeholder="프로젝트에 대해 알려주세요 (500자 이내)"
                  />
                </div>

                <MagneticButton
                  type="submit"
                  disabled={submitStatus === 'submitting'}
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  {submitStatus === 'submitting' ? '전송 중...' : '문의 보내기'}
                </MagneticButton>

                {submitStatus === 'success' && (
                  <p className="text-sm text-center text-green-400/70 mt-1">
                    문의가 접수되었습니다. 48시간 이내에 연락드리겠습니다.
                  </p>
                )}
                {submitStatus === 'error' && (
                  <p className="text-sm text-center text-red-400/70 mt-1">
                    오류가 발생했습니다. 0423doit@gmail.com 으로 직접 연락 부탁드립니다.
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}