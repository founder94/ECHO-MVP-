"use client";

import { animated } from "@react-spring/web";
import Link from "next/link";

import { usePressable } from "@vesper/components/ui/pressable";
import { GHOST } from "@vesper/lib/springs/interaction";
import { appUrl } from "@/lib/siteRole";
import { HOME_V2, START_PATH } from "@/pages/do-it/brand-home/copy";

/**
 * The Figma "Send Request" CTA — the text block plus the arrow tile beside it.
 *
 * Shared by {@link Hero} and {@link SectionBrain}, which rendered it identically.
 *
 * 2026-10-09 대표 승인: 흰 바탕(SOLID_CTA)을 버리고 투명 바탕 + 밝은 글자 + 얇은 외곽선(GHOST).
 * 화살표 칸도 흰 네모 없이 외곽선만 — 아이콘 SVG 는 흰 배경 도형만 뺀 사본(send-icon-light.svg).
 * 손끝 반응(hover·press)은 GHOST 의 옅은 빛으로 유지하고, 버튼 전체 투명도는 낮추지 않는다.
 *
 * The pointer meets the whole `<Link>` (the block **and** the arrow), but the sprung
 * border/background live on the inner `<span>` — which is why `usePressable` hands
 * back `bind` and `style` separately.
 */
export const SendRequest = () => {
  const { style, bind } = usePressable(GHOST);

  return (
    <Link
      href={appUrl(START_PATH)}
      {...bind}
      className="flex items-center gap-[0.278vw] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal max-lg:gap-[0.25rem]"
    >
      <animated.span
        style={style}
        className="flex min-h-[48px] items-center justify-center border px-[4.167vw] py-[1.111vw] font-general text-[1.111vw] leading-[1.2] font-normal max-lg:grow max-lg:px-[1.5rem] max-lg:py-[0.9375rem] max-lg:text-[1rem]"
      >
        {HOME_V2.start}
      </animated.span>
      <animated.span
        aria-hidden
        style={style}
        className="flex size-[3.542vw] shrink-0 items-center justify-center border max-lg:size-[3.125rem]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vesper/assets/hero/send-icon-light.svg" alt="" className="block size-full" />
      </animated.span>
    </Link>
  );
};
