"use client";

import { RobotText as TextEngine } from "@vesper/components/common/robot-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { LEGAL } from "@/pages/do-it/brand-home/copy";
// 2026-10-09 대표 「글씨는 내가 준 코드 원본 그대로 우선」 → 원본 Vesper 바닥글 그대로(연락 폼은 원본처럼 서버 없음 · 보내지 않음).
// 남긴 것: 로고(DO IT) · 맨 아래 사업자 정보·약관·개인정보(법적 고지 — 대표가 빼라 하면 뺀다).
import { PressableButton, PressableLink } from "@vesper/components/ui/pressable";
import type { FooterCopy } from "@vesper/data/mocks/home";
import { GHOST_SIGNAL, MUTED_LINK } from "@vesper/lib/springs/interaction";
import { FollowLineBlur } from "../line-blur";
import { LETTER_FADE, UNIT_REVEAL } from "../reveal";

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
const TITLE = "Let's talk.";

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

      {/* Contact form — a header-style glass pill, centred on the shader. Not yet
          wired to a backend (no `/api/contact` route); submit is a stub. */}
      <Inview
        mode="once"
        from={UNIT_REVEAL.from}
        to={UNIT_REVEAL.to}
        config={UNIT_REVEAL.config}
        className="mx-auto mt-[2.917vw] w-[38.264vw] max-lg:mt-[2rem] max-lg:w-full max-lg:max-w-[30rem]"
      >
        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex h-[3.542vw] w-full items-center border border-white/20 bg-black/80 py-[0.556vw] pr-[0.556vw] pl-[1.667vw] backdrop-blur-[8px] max-lg:h-auto max-lg:flex-col max-lg:items-stretch max-lg:gap-[0.75rem] max-lg:p-[1rem]"
        >
          {/* The inputs had `outline-none` with nothing put back — invisible to a
              keyboard, and on a live shader the UA default would vanish anyway.
              The focus ring is deliberately *not* sprung: a focus indicator that
              eases in is a focus indicator that is briefly wrong. */}
          <input
            aria-label="Name"
            name="name"
            placeholder="Name"
            className="w-[12.5vw] bg-transparent font-general text-[1.111vw] leading-[1.2] text-white outline-none placeholder:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal max-lg:w-full max-lg:border-b max-lg:border-white/20 max-lg:pb-[0.5rem] max-lg:text-[1rem] max-lg:placeholder:text-white/60"
          />
          <input
            aria-label="Email"
            name="email"
            type="email"
            placeholder="Email"
            className="ml-[1.111vw] w-[12.5vw] bg-transparent font-general text-[1.111vw] leading-[1.2] text-white outline-none placeholder:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal max-lg:ml-0 max-lg:w-full max-lg:border-b max-lg:border-white/20 max-lg:pb-[0.5rem] max-lg:text-[1rem] max-lg:placeholder:text-white/60"
          />
          <PressableButton
            type="submit"
            interaction={GHOST_SIGNAL}
            className="ml-auto flex items-center gap-[0.694vw] self-stretch border px-[1.111vw] font-general text-[1.111vw] leading-[1.2] whitespace-nowrap max-lg:ml-0 max-lg:justify-center max-lg:gap-[0.5rem] max-lg:py-[0.875rem] max-lg:text-[1rem]"
          >
            Contact Us
            <span
              aria-hidden
              className="block size-[0.139vw] shrink-0 bg-current max-lg:size-[0.1875rem]"
            />
          </PressableButton>
        </form>
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
      {/* 사업자 정보 · 법적 고지 */}
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
