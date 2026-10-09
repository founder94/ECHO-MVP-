"use client";

import { animated } from "@react-spring/web";
import Link from "next/link";

import { usePressable } from "@vesper/components/ui/pressable";
import { SOLID_CTA } from "@vesper/lib/springs/interaction";

/**
 * The Figma "Send Request" CTA — a filled block plus the arrow tile beside it.
 *
 * Shared by {@link Hero} and {@link SectionBrain}, which rendered it identically.
 *
 * The pointer meets the whole `<Link>` (the block **and** the arrow), but the fill
 * lives on the inner `<span>` — which is why `usePressable` hands back `bind` and
 * `style` separately. Springing the span alone would leave the arrow inert, so the
 * button would fail to light up from a third of its own hit area.
 *
 * The block has no `bg-*` / `text-*` class: the spring owns those colours, and an
 * inline spring value beats a utility anyway. Declaring both would just be a lie
 * in the markup.
 */
export const SendRequest = () => {
  const { style, bind } = usePressable(SOLID_CTA);

  return (
    <Link
      href="/#contact"
      {...bind}
      className="flex items-center gap-[0.278vw] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal max-lg:gap-[0.25rem]"
    >
      <animated.span
        style={style}
        className="flex items-center justify-center px-[4.167vw] py-[1.111vw] font-general text-[1.111vw] leading-[1.2] font-medium max-lg:grow max-lg:px-[1.5rem] max-lg:py-[0.9375rem] max-lg:text-[1rem]"
      >
        Send Request
      </animated.span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/vesper/assets/hero/send-icon.svg"
        alt=""
        className="block size-[3.542vw] shrink-0 max-lg:size-[3.125rem]"
      />
    </Link>
  );
};
