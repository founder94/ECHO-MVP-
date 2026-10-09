import { PressableLink } from "@vesper/components/ui/pressable";
import { homeFooter } from "@vesper/data/mocks/home";
import { GHOST, NAV_LINK, QUIET } from "@vesper/lib/springs/interaction";
import { appUrl } from "@/lib/siteRole";
import { HOME_V2, START_PATH } from "@/pages/do-it/brand-home/copy";

import { MobileNav } from "./mobile-nav";

/**
 * Fixed, site-wide header — the pill bar from the Figma hero.
 *
 * A centered glass bar with the wordmark left, primary nav centred, and a
 * Contact Us button right. Rendered once in the root layout so it floats above
 * every section as you scroll. Desktop sizes are the Figma pixels in `vw` (÷14.4).
 *
 * The row is `justify-between`, so the two gaps (logo→nav, nav→button) are equal.
 * The Contact Us button `self-stretch`es inside the `py`-padded row, so its top,
 * right, and bottom insets to the bar edge are the same value.
 *
 * Below 1024px (ADR-0029) the bar keeps the logo but hands the links to
 * {@link MobileNav} — a full-screen menu (owner review, 2026-10-06): a
 * `vw`-sized pill is 14px tall on a phone, and four links plus a button do not
 * fit that row at any legible size. This stays a Server
 * Component — only the toggle is a client leaf.
 */
// 2026-10-09 대표 「글씨는 내가 준 코드 원본 그대로 우선」 → 메뉴·버튼 글자는 원본 Vesper 그대로(로고만 DO IT).
const NAV = HOME_V2.nav;

export const SiteHeader = () => {
  return (
    <header className="pointer-events-auto fixed top-[0.694vw] left-1/2 z-50 h-[3.542vw] w-[49.514vw] max-w-[95vw] -translate-x-1/2 border border-white/10 bg-black/80 backdrop-blur-[8px] max-lg:top-[1rem] max-lg:h-[3.5rem] max-lg:w-[calc(100%-3rem)] max-sm:top-[0.75rem] max-sm:w-[calc(100%-2.5rem)]">
      <div className="flex h-full items-center justify-between py-[0.556vw] pr-[0.556vw] pl-[0.833vw] max-lg:py-[0.5rem] max-lg:pr-[0.5rem] max-lg:pl-[1rem]">
        <PressableLink
          href="/"
          aria-label="DO IT — home"
          interaction={QUIET}
          className="block h-[1.806vw] w-[5.86vw] shrink-0 max-lg:h-[1.5rem] max-lg:w-[4.875rem]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/doit-wordmark.webp"
            alt="DO IT"
            className="block h-full w-full object-contain object-left"
          />
        </PressableLink>

        <nav
          aria-label="Main"
          className="flex items-center gap-[2.222vw] font-general text-[1.111vw] leading-[1.2] font-normal whitespace-nowrap max-lg:hidden"
        >
          {NAV.map((item) => (
            <PressableLink
              key={item.label}
              href={item.href}
              interaction={NAV_LINK}
            >
              {item.label}
            </PressableLink>
          ))}
        </nav>

        {/* Border and background colours are sprung (GHOST), so the classes carry
            width and style only — an inline spring value would beat a `border-*`
            utility anyway, and having both would just be a lie in the markup. */}
        <PressableLink
          href={appUrl(START_PATH)}
          interaction={GHOST}
          className="flex shrink-0 items-center gap-[0.694vw] self-stretch border px-[1.111vw] font-general text-[1.111vw] leading-[1.2] font-normal whitespace-nowrap max-lg:hidden"
        >
          {HOME_V2.start}
          <span aria-hidden className="block size-[0.139vw] bg-current" />
        </PressableLink>

        <MobileNav items={NAV} tagline={homeFooter.tagline} />
      </div>
    </header>
  );
};
