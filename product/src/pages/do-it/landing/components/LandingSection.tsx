import type { ReactNode } from 'react';
import '../landing-editorial.css';

interface LandingSectionProps {
  imageUrl: string;
  objectPosition?: string;
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
  showScrollIndicator?: boolean;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  eager?: boolean;
  headingAs?: 'h1' | 'h2';
  children?: ReactNode;
  layout?: 'feature' | 'side' | 'panel' | 'closing';
}

// 원본 사진을 겹치는 투명 가장자리 안에 놓는다. 글과 버튼에는 마스크를 적용하지 않는다.
export default function LandingSection({
  imageUrl,
  objectPosition = 'center center',
  eyebrow,
  title,
  subtitle,
  showScrollIndicator = false,
  actionLabel,
  actionDisabled = false,
  onAction,
  eager = false,
  headingAs = 'h2',
  children,
  layout = 'panel',
}: LandingSectionProps) {
  return (
    <section
      data-motion-scene
      className={`doit-story doit-story--${layout} relative w-full`}
    >
      <div className="doit-story-visual" aria-hidden="true">
        <img
          src={imageUrl}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          className="doit-story-image"
          style={{ objectPosition }}
        />
        <div className="doit-story-veil" />
      </div>

      {/* 콘텐츠 */}
      <div className="doit-story-content relative z-10">
        <p className="doit-story-eyebrow text-white/70">
          {eyebrow}
        </p>
        <div className="doit-story-body">
        {headingAs === 'h1' ? (
          <h1 className="doit-story-title font-bold text-white">
            {title}
          </h1>
        ) : (
          <h2 className="doit-story-title font-bold text-white">
            {title}
          </h2>
        )}
        <p className="doit-story-description text-white/80">
          {subtitle}
        </p>
        </div>

        {actionLabel && (
          <button
            type="button"
            disabled={actionDisabled}
            aria-disabled={actionDisabled ? 'true' : undefined}
            onClick={onAction}
            className={`doit-story-action w-full max-w-xs h-14 rounded-full border flex items-center justify-center gap-2 whitespace-nowrap text-[15px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              actionDisabled
                ? 'bg-white/5 border-white/15 text-white/40 cursor-not-allowed'
                : 'bg-white/10 border-white/30 text-white cursor-pointer hover:bg-white/20 active:scale-[0.98]'
            }`}
          >
            {actionLabel}
            <span>→</span>
          </button>
        )}
        {children && <div className="doit-story-extra">{children}</div>}
      </div>

      {/* 다음 구간 스크롤 표시. 움직임 줄이기 설정에서는 반복 움직임을 끈다. */}
      {showScrollIndicator && (
        <div className="absolute z-10 bottom-10 left-0 right-0 flex justify-center">
          <div className="flex flex-col items-center gap-2 text-white/60">
            <span className="text-[10px] tracking-[0.35em] uppercase">스크롤</span>
            <i className="ri-arrow-down-line text-[20px]" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}
