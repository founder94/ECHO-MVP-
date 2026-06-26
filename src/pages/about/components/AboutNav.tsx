import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MagneticButton from '@/components/base/MagneticButton';

const NAV_ITEMS = [
  { label: 'ECHO', href: '/' },
  { label: 'Intro', href: '#intro' },
  { label: 'ECHO란', href: '#definition' },
  { label: 'Steps', href: '#steps' },
  { label: 'For', href: '#audience' },
  { label: 'Start', href: '#cta' },
];

export default function AboutNav() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => {
      setNavScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = useCallback(
    (href: string) => {
      setMobileMenuOpen(false);
      if (href === '/') {
        navigate('/');
        return;
      }
      if (href.startsWith('#')) {
        const id = href.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    [navigate]
  );

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-5 md:px-8 py-4 transition-all duration-700 ${
          navScrolled
            ? 'bg-[#0a0a0a]/85 backdrop-blur-xl border-b border-white/[0.03]'
            : ''
        }`}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="text-xs font-semibold tracking-[0.25em] uppercase text-white cursor-pointer"
        >
          ECHO
        </a>

        <div className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                handleNavClick(item.href);
              }}
              className="text-[10px] font-medium tracking-[0.15em] uppercase transition-all duration-300 hover:opacity-50 cursor-pointer text-white/60"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-7 h-7 flex items-center justify-center"
          >
            <i className={`text-sm text-white ${mobileMenuOpen ? 'ri-close-line' : 'ri-menu-line'}`} />
          </button>
          <MagneticButton
            onClick={() => navigate('/auth')}
            variant="primary"
            size="sm"
            className="hidden md:inline-flex text-[10px] tracking-[0.1em] uppercase"
          >
            시작하기
          </MagneticButton>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-20 md:hidden flex flex-col bg-[#050505]/98 backdrop-blur-xl">
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {NAV_ITEMS.map((item, idx) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                }}
                className="text-2xl font-light tracking-[0.3em] uppercase transition-all duration-500 cursor-pointer text-white/80 hover:text-white"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/auth');
              }}
              className="mt-4 px-8 py-3 rounded-full text-sm font-medium tracking-wide whitespace-nowrap cursor-pointer transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #FF6B9D, #9B59B6)',
                color: '#FFFFFF',
                boxShadow: '0 0 30px rgba(255,107,157,0.2)',
              }}
            >
              작전 시작
            </button>
          </div>
        </div>
      )}
    </>
  );
}