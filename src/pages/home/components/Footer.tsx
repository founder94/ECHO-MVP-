import { useState } from 'react';

interface FooterProps {
  isDarkMode: boolean;
}

const Footer = ({ isDarkMode }: FooterProps) => {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  return (
    <footer className="relative w-full overflow-hidden">
      {/* Background image section with ECHO logo */}
      <div className="relative w-full">
        {/* Background image */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src="https://readdy.ai/api/search-image?query=Dark%20charcoal%20background%20with%20large%20metallic%20silver%20ECHO%20text%20logo%20in%20center%2C%20minimalist%20luxury%20brand%20style%2C%20subtle%20gradient%20from%20dark%20gray%20to%20black%2C%20matte%20texture%20surface%2C%20elegant%20typography%2C%20professional%20corporate%20aesthetic%2C%20high-end%20design%20studio%20feel%2C%20soft%20ambient%20lighting%20on%20letters&width=1200&height=800&seq=footer-echo-bg-01&orientation=landscape"
            alt="ECHO background"
            className="w-full h-full object-cover object-center"
          />
          {/* Overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* Content on top of background */}
        <div className="relative z-10 px-6 md:px-12 pt-20 pb-10">
          <div className="max-w-7xl mx-auto">
            {/* Top navigation grid */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-8 md:gap-6 mb-16">
              {/* Brand column */}
              <div className="col-span-2 md:col-span-5">
                <div className="text-white text-lg md:text-xl font-semibold tracking-[0.4em] mb-2 leading-none whitespace-nowrap">
                  E C H O
                </div>
                <div className="text-white/50 text-[11px] font-mono tracking-[0.3em] uppercase mb-5">
                  DO IT COMPANY
                </div>
                <p className="text-white/60 text-sm md:text-base leading-relaxed max-w-sm mb-8">
                  Human Relationship Operating System. 데이터와 감성의 교차점에서
                  인간 경험을 설계합니다.
                </p>
                <div className="flex items-center gap-3">
                  {[
                    { icon: 'ri-instagram-line', href: 'https://www.instagram.com/parkobserver/' },
                    { icon: 'ri-linkedin-fill', href: 'https://www.linkedin.com/in/jinwookpark-founder' },
                    { icon: 'ri-youtube-line', href: 'https://youtube.com/channel/UCixQI2A67_pMgugbO-GYK6Q' },
                    { icon: 'ri-mail-line', href: 'mailto:0423doit@gmail.com' },
                  ].map((s) => (
                    <a
                      key={s.icon}
                      href={s.href}
                      target={s.href.startsWith('mailto') ? undefined : '_blank'}
                      rel={s.href.startsWith('mailto') ? undefined : 'noopener noreferrer'}
                      className="w-9 h-9 flex items-center justify-center rounded-full border border-white/20 hover:bg-white hover:text-black transition-colors cursor-pointer text-white"
                    >
                      <i className={`${s.icon} text-sm`}></i>
                    </a>
                  ))}
                </div>
              </div>

              {/* Navigate column */}
              <div className="md:col-span-2">
                <div className="text-white/40 text-[11px] font-mono uppercase tracking-[0.25em] mb-5">
                  Navigate
                </div>
                <ul className="space-y-3">
                  {[
                    { label: 'Mission', href: '#section1' },
                    { label: 'About', href: '#section2' },
                    { label: 'Approach', href: '#approach' },
                    { label: 'Services', href: '#services' },
                    { label: 'Projects', href: '#work' },
                    { label: 'Identity', href: '#find-me' },
                    { label: 'Contact', href: '#contact' },
                  ].map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-white/70 text-sm hover:text-white transition-colors"
                        onMouseEnter={() => setHoveredLink(link.label)}
                        onMouseLeave={() => setHoveredLink(null)}
                      >
                        {link.label}
                        {hoveredLink === link.label && (
                          <span className="ml-2 text-white/40 text-xs">→</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Team column */}
              <div className="md:col-span-2">
                <div className="text-white/40 text-[11px] font-mono uppercase tracking-[0.25em] mb-5">
                  Team
                </div>
                <ul className="space-y-3">
                  {['Design Team', 'AI Research', 'Data Science', 'HX Design', 'Product'].map(
                    (link) => (
                      <li key={link}>
                        <span className="text-white/70 text-sm hover:text-white transition-colors cursor-default">
                          {link}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              {/* Contact column */}
              <div className="md:col-span-2">
                <div className="text-white/40 text-[11px] font-mono uppercase tracking-[0.25em] mb-5">
                  Contact
                </div>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="mailto:0423doit@gmail.com"
                      className="text-white/70 text-sm hover:text-white transition-colors"
                    >
                      0423doit@gmail.com
                    </a>
                  </li>
                  <li>
                    <span className="text-white/70 text-sm">Seoul, Korea</span>
                  </li>
                  <li>
                    <a
                      href="https://www.linkedin.com/in/jinwookpark-founder"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/70 text-sm hover:text-white transition-colors"
                    >
                      LinkedIn
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.instagram.com/parkobserver/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/70 text-sm hover:text-white transition-colors"
                    >
                      @parkobserver
                    </a>
                  </li>
                </ul>
              </div>

              {/* Legal column */}
              <div className="col-span-2 md:col-span-1">
                <div className="text-white/40 text-[11px] font-mono uppercase tracking-[0.25em] mb-5">
                  Legal
                </div>
                <ul className="space-y-3">
                  {['Privacy', 'Terms', 'Imprint'].map((link) => (
                    <li key={link}>
                      <span className="text-white/70 text-sm hover:text-white transition-colors cursor-default">
                        {link}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-8 border-t border-white/10">
              <div className="text-white/40 text-xs font-mono">
                © 2026 DO IT COMPANY · ECHO. All rights reserved.
              </div>
              <div className="flex items-center gap-2 text-white/40 text-[11px] font-mono uppercase tracking-[0.25em]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4D4D4] animate-pulse" />
                Creatively Rational
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;