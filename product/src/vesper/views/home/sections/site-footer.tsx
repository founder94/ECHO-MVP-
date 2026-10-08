"use client";

import { RobotText as TextEngine } from "@vesper/components/common/robot-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { PressableButton, PressableLink } from "@vesper/components/ui/pressable";
import type { FooterCopy } from "@vesper/data/mocks/home";
import { GHOST_SIGNAL, MUTED_LINK } from "@vesper/lib/springs/interaction";
import { FollowLineBlur } from "../line-blur";
import { LETTER_FADE, UNIT_REVEAL } from "../reveal";
import { SendRequest } from "../send-request";
import { LEGAL } from "@/pages/do-it/brand-home/copy";
import { openGuide } from "@/lib/guide/bus";

export interface SiteFooterProps {
  copy: FooterCopy;
}

/**
 * Site footer — the Figma closing band. Sits under the FAQ card, **transparent
 * over the live background shader** (no opaque surface, so the scene keeps
 * drawing behind it). A centred display heading, then the contact form (Name /
 * Email / Contact Us), a full-width divider, and the logo + tagline on the left
 * with three link columns pushed to the right (`justify-between`). The heading
 * reveals letter-by-letter; it is in flow, so no `position` fix is needed.
 * Desktop measurements are the Figma pixels in `vw` (÷14.4).
 *
 * Below 1024px (ADR-0029) the one-row contact pill becomes a stacked form — two
 * inputs over a full-width button — and the link columns become a two-column grid
 * under the wordmark.
 */
const TITLE = "JUST TRY.";

export const SiteFooter = ({ copy }: SiteFooterProps) => {
  return (
    <footer
      id="site-footer"
      className="w-full pt-[4.444vw] text-white max-lg:px-[1.5rem] max-lg:pt-[4rem] max-sm:px-[1.25rem]"
    >
      <FollowLineBlur letters={TITLE.length}>
        {(onTextStart) => (
          <TextEngine
            tag="h2"
            mode="once"
            {...LETTER_FADE}
            onTextStart={onTextStart}
            className="justify-center text-center font-general text-[5.556vw] leading-[0.9] font-light max-lg:text-[3rem] max-sm:text-[2.375rem]"
          >
            {TITLE}
          </TextEngine>
        )}
      </FollowLineBlur>

      {/* 원본의 연락 폼(이름·이메일) 대신 시작 버튼 + 이용 안내(개인정보를 받는 칸 0). */}
      <Inview
        mode="once"
        from={UNIT_REVEAL.from}
        to={UNIT_REVEAL.to}
        config={UNIT_REVEAL.config}
        className="mx-auto mt-[2.917vw] flex w-[38.264vw] flex-col items-center gap-[1.111vw] max-lg:mt-[2rem] max-lg:w-full max-lg:max-w-[30rem] max-lg:gap-[1rem]"
      >
        <SendRequest />
        <PressableButton
          type="button"
          onClick={() => openGuide()}
          interaction={GHOST_SIGNAL}
          className="flex items-center gap-[0.694vw] border px-[1.111vw] py-[0.694vw] font-general text-[1.111vw] leading-[1.2] whitespace-nowrap max-lg:gap-[0.5rem] max-lg:px-[1.25rem] max-lg:py-[0.875rem] max-lg:text-[1rem]"
        >
          이용 안내
          <span aria-hidden className="block size-[0.139vw] shrink-0 bg-current max-lg:size-[0.1875rem]" />
        </PressableButton>
      </Inview>

      {/* Full-width divider (edge to edge, wider than the inset content). */}
      <div className="mt-[4.444vw] border-t border-white/15 max-lg:mt-[3rem]" />

      <div className="mx-auto mt-[2.014vw] flex w-[96.667vw] items-start justify-between pb-[4.444vw] max-lg:mt-[2rem] max-lg:w-full max-lg:flex-col max-lg:gap-[2.5rem] max-lg:pb-[3rem]">
        <Inview
          mode="once"
          from={UNIT_REVEAL.from}
          to={UNIT_REVEAL.to}
          config={UNIT_REVEAL.config}
          className="flex w-[27.5vw] flex-col gap-[1.667vw] max-lg:w-full max-lg:gap-[1rem]"
        >
          <span className="block h-[1.806vw] w-[5.86vw] max-lg:h-[1.5rem] max-lg:w-[4.875rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/doit-wordmark.webp"
              alt={copy.wordmark}
              className="block h-full w-full object-contain object-left"
            />
          </span>
          <p className="font-tag text-[1.111vw] leading-[1.2] text-white uppercase max-lg:text-[0.8125rem]">
            {copy.tagline}
          </p>
        </Inview>

        <nav
          aria-label="Footer"
          className="flex gap-[6.25vw] max-lg:grid max-lg:w-full max-lg:grid-cols-2 max-lg:gap-[2rem]"
        >
          {copy.columns.map((column, index) => (
            <Inview
              key={column.heading}
              mode="once"
              delayIn={100 + index * 100}
              from={UNIT_REVEAL.from}
              to={UNIT_REVEAL.to}
              config={UNIT_REVEAL.config}
              className="flex w-[12.5vw] flex-col gap-[1.667vw] max-lg:w-full max-lg:gap-[1rem]"
            >
              <p className="font-tag text-[1.111vw] leading-[1.2] text-white uppercase max-lg:text-[0.8125rem]">
                {column.heading}
              </p>
              <ul className="flex flex-col gap-[1.111vw] max-lg:gap-[0.75rem]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {/* Was a bare `hover:text-white` — an instant swap. Same
                        destination, but sprung, so it matches every other control. */}
                    <PressableLink
                      href={link.href}
                      interaction={MUTED_LINK}
                      className="inline-block font-general text-[1.111vw] leading-[1.2] max-lg:text-[0.9375rem]"
                    >
                      {link.label}
                    </PressableLink>
                  </li>
                ))}
              </ul>
            </Inview>
          ))}
        </nav>
      </div>

      {/* 사업자 정보 · 법적 고지(옛 홈페이지 바닥글 그대로) */}
      <div className="mx-auto w-[96.667vw] border-t border-white/15 pt-[1.389vw] pb-[2.222vw] font-general text-[0.833vw] leading-[1.6] text-white/70 max-lg:w-full max-lg:pt-[1rem] max-lg:pb-[2rem] max-lg:text-[0.8125rem]">
        <p className="m-0">{LEGAL.company} · {LEGAL.registration}</p>
        <p className="m-0">{LEGAL.address}</p>
        <p className="m-0">
          <a href="/legal/terms" className="underline underline-offset-4">이용약관</a> · <a href="/legal/privacy" className="underline underline-offset-4">개인정보처리방침</a> · <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-4">문의 · {LEGAL.email}</a>
        </p>
        <p className="m-0">{LEGAL.copyright}</p>
      </div>
    </footer>
  );
};
