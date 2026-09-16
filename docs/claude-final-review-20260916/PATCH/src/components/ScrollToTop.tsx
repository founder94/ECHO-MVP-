import { useState, useEffect } from 'react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] right-6 md:right-10 z-40 w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary-500 via-accent-500 to-secondary-500 text-white flex items-center justify-center transition-all duration-500 cursor-pointer hover:scale-110 animate-gradient-text ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <i className="ri-arrow-up-line text-xl md:text-2xl" />
    </button>
  );
}