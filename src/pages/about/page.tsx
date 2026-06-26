import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import AboutNav from './components/AboutNav';
import AboutIntro from './components/AboutIntro';
import AboutDefinition from './components/AboutDefinition';
import AboutSteps from './components/AboutSteps';
import AboutAudience from './components/AboutAudience';
import AboutCTA from './components/AboutCTA';

gsap.registerPlugin(ScrollTrigger);

export default function AboutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="relative bg-[#050505] min-h-screen">
      <AboutNav />

      <section id="intro">
        <AboutIntro />
      </section>

      <section id="definition">
        <AboutDefinition />
      </section>

      <section id="steps">
        <AboutSteps />
      </section>

      <section id="audience">
        <AboutAudience />
      </section>

      <section id="cta">
        <AboutCTA />
      </section>

      {/* Minimal footer bar */}
      <footer className="relative py-8 md:py-10 bg-[#050505] border-t border-white/[0.04] px-6">
        <div className="max-w-[1000px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/20">
            ECHO — Human Relationship OS
          </p>
          <div className="flex items-center gap-5">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/30 hover:text-white/50 transition-colors duration-300 cursor-pointer"
            >
              Home
            </a>
            <a
              href="/auth"
              onClick={(e) => {
                e.preventDefault();
                navigate('/auth');
              }}
              className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/30 hover:text-white/50 transition-colors duration-300 cursor-pointer"
            >
              시작하기
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}