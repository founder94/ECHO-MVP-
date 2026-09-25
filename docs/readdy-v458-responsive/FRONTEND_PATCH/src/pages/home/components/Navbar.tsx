import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { HOME_NAV_ATTR, scrollToSectionBelowHeader } from '@/pages/home/scrollToSection';

interface AppMenuItem {
  label: string;
  to: string;
  ready: boolean;
  icon: string;
}

const navLinks = [
  { label: 'ECHO', href: '#meaning' },
  { label: '경험', href: '#dialogue' },
  { label: '기록', href: '#jukebox' },
];

// A구조 햄버거 메뉴 항목 (11개).
// ready=true 항목은 실제 화면이 연결됨. ready=false 항목은 서버·DB 연동 전이라 "준비 중"으로 안내한다.
const appMenuItems: AppMenuItem[] = [
  { label: '홈', to: '/', ready: true, icon: 'ri-home-5-line' },
  { label: 'Just Try', to: '/doit/just-try', ready: true, icon: 'ri-seedling-line' },
  { label: '내 프로필', to: '/do-it/photo', ready: true, icon: 'ri-user-3-line' },
  { label: '내 스토리', to: '/coming-soon/story', ready: false, icon: 'ri-book-open-line' },
  { label: '공간과 미션', to: '/coming-soon/spaces', ready: false, icon: 'ri-compass-3-line' },
  { label: '등급과 활동', to: '/do-it/grade', ready: true, icon: 'ri-medal-line' },
  { label: 'KEY 내역', to: '/coming-soon/key', ready: false, icon: 'ri-key-2-line' },
  { label: 'ECHO 시작하기', to: '/start', ready: true, icon: 'ri-sun-cloudy-line' },
  { label: '보관함', to: '/locker', ready: true, icon: 'ri-archive-line' },
  { label: '설정', to: '/coming-soon/settings', ready: false, icon: 'ri-settings-3-line' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    // 2026-09-16 반응형 수정: 고정 헤더 높이만큼 보정해 섹션 제목이 헤더 뒤로 숨지 않게 한다.
    scrollToSectionBelowHeader(href.replace('#', ''));
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  return (
    <nav
      {...{ [HOME_NAV_ATTR]: '' }}
      // 2026-09-16 반응형 수정: 스크롤 후에도 투명이라 메뉴 글자가 본문 글자 위에 겹쳐 보였다.
      // 스크롤 전(히어로 위)은 그대로 투명, 스크롤 후에는 테마 배경색 75% 로 본문과 분리한다(블러 없음).
      // 상단 safe-area(노치·상태바) 만큼 안쪽 여백을 준다.
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 pt-[env(safe-area-inset-top)] ${
        scrolled ? 'bg-background-50/75' : 'bg-transparent'
      }`}
    >
      <div className="w-full max-w-full px-6 md:px-10 lg:px-16">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a
            href="/"
            className="hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            <img
              src="https://storage.helloreaddy.io/project_files/3af9018b-0984-400b-9a04-099fb48dbecd/5912610a-d750-489e-a762-bc08e53ee2aa_compressed_DO-it_logo.webp"
              alt="DO-IT"
              className="h-7 md:h-9 w-auto"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8 lg:gap-10">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleSmoothScroll(e, link.href)}
                className={`text-xs lg:text-sm font-semibold tracking-wider whitespace-nowrap relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:transition-all after:duration-300 hover:after:w-full transition-colors duration-300 ${
                  scrolled
                    ? 'text-foreground-200 hover:text-foreground-50 after:bg-foreground-50'
                    : 'text-white/90 hover:text-white after:bg-white'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Desktop hamburger */}
            <button
              type="button"
              onClick={() => setDesktopMenuOpen(!desktopMenuOpen)}
              className={`hidden md:flex w-10 h-10 rounded-full border items-center justify-center transition-all duration-300 relative ${
                scrolled
                  ? 'border-foreground-700 text-foreground-200 hover:text-foreground-50 hover:border-foreground-500 hover:bg-foreground-50/5'
                  : 'border-white text-white/90 hover:text-white hover:border-white hover:bg-white/10'
              }`}
              aria-label="Menu"
            >
              <i className={`ri-menu-line text-lg ${desktopMenuOpen ? 'hidden' : 'block'}`} />
              <i className={`ri-close-line text-lg ${desktopMenuOpen ? 'block' : 'hidden'}`} />
            </button>

            {/* Sign Up / Auth */}
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className={`px-5 py-2 rounded-full border text-xs md:text-sm transition-all duration-300 whitespace-nowrap cursor-pointer ${
                  scrolled
                    ? 'border-foreground-50 text-foreground-50 hover:bg-foreground-50 hover:text-background-50'
                    : 'border-white text-white hover:bg-white hover:text-black'
                }`}
              >
                로그아웃
              </button>
            ) : (
              <Link
                to="/signup"
                className={`px-5 py-2 rounded-full border text-xs md:text-sm transition-all duration-300 whitespace-nowrap ${
                  scrolled
                    ? 'border-foreground-50 text-foreground-50 hover:bg-foreground-50 hover:text-background-50'
                    : 'border-white text-white hover:bg-white hover:text-black'
                }`}
              >
                SIGN UP
              </Link>
            )}

            {/* Hamburger mobile — far right */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 md:hidden ${
                scrolled
                  ? 'border-foreground-700 text-foreground-200 hover:text-foreground-50 hover:border-foreground-500 hover:bg-foreground-50/5'
                  : 'border-white text-white/90 hover:text-white hover:border-white hover:bg-white/10'
              }`}
              aria-label="Toggle menu"
            >
              <i className="ri-menu-line text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Full-Screen Menu */}
      <div
        className={`fixed inset-0 z-[60] md:hidden bg-background-50/95 backdrop-blur-md transition-transform duration-500 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-6 pt-20 pb-8">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute top-4 right-6 w-10 h-10 rounded-full border border-foreground-700 flex items-center justify-center text-foreground-200 hover:text-foreground-50 hover:border-foreground-500 hover:bg-foreground-50/5 transition-all duration-300 cursor-pointer"
            aria-label="Close menu"
          >
            <i className="ri-close-line text-lg" />
          </button>

          <div className="flex flex-col gap-1">
            {appMenuItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={closeMenus}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-foreground-700 transition-colors hover:bg-background-100 hover:text-foreground-950"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background-200 text-foreground-600">
                  <i className={`${item.icon} text-base`} />
                </span>
                <span className="flex-1 text-base font-medium whitespace-nowrap">
                  {item.label}
                </span>
                {!item.ready && (
                  <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-medium text-secondary-900">
                    준비 중
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Full-Screen Menu */}
      <div
        className={`hidden md:block fixed inset-0 z-[60] bg-background-50/95 backdrop-blur-md transition-all duration-500 ease-out ${
          desktopMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto px-10 pt-24 pb-10">
          <button
            type="button"
            onClick={() => setDesktopMenuOpen(false)}
            className="absolute top-6 right-10 lg:right-16 w-12 h-12 rounded-full border border-foreground-700 flex items-center justify-center text-foreground-200 hover:text-foreground-50 hover:border-foreground-500 hover:bg-foreground-50/5 transition-all duration-300 cursor-pointer"
            aria-label="Close menu"
          >
            <i className="ri-close-line text-2xl" />
          </button>

          <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 lg:grid-cols-3">
            {appMenuItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={closeMenus}
                className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 px-4 py-4 text-foreground-700 transition-colors hover:bg-background-100 hover:text-foreground-950"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background-200 text-foreground-600">
                  <i className={`${item.icon} text-lg`} />
                </span>
                <span className="flex-1 text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
                {!item.ready && (
                  <span className="rounded-full bg-secondary-100 px-2.5 py-0.5 text-[11px] font-medium text-secondary-900">
                    준비 중
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}