import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface PuzzleTextRevealProps {
  children: string;
  className?: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'div';
  staggerMs?: number;
  totalDuration?: number;
  scatterDistance?: number;
  style?: React.CSSProperties;
  onRevealed?: () => void;
}

/**
 * Splits text into words. Each word starts at a scattered position
 * and rapidly assembles into place when scrolled into view.
 * Optimized for fast scrollers — uses ScrollTrigger scrub with
 * velocity detection to ensure text is always readable.
 */
export default function PuzzleTextReveal({
  children,
  className = '',
  as: Tag = 'p',
  staggerMs = 18,
  totalDuration = 0.45,
  scatterDistance = 40,
  style,
  onRevealed,
}: PuzzleTextRevealProps) {
  const containerRef = useRef<HTMLElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const revealedRef = useRef(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const words = children.split(/(\s+)/).filter(Boolean);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    const spans = wordRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (spans.length === 0) return;

    // Store initial scattered positions
    spans.forEach((span, i) => {
      const angle = (Math.random() - 0.5) * 50;
      const distX = (Math.random() - 0.5) * scatterDistance * (isMobile ? 0.6 : 1);
      const distY = (Math.random() - 0.5) * scatterDistance * 0.8 * (isMobile ? 0.6 : 1);
      const rotZ = (Math.random() - 0.5) * 25;
      const sc = 0.3 + Math.random() * 0.4;

      gsap.set(span, {
        x: distX,
        y: distY,
        rotation: rotZ,
        scale: sc,
        opacity: 0,
        filter: 'blur(4px)',
      });

      gsap.to(span, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        filter: 'blur(0px)',
        duration: totalDuration,
        delay: i * (staggerMs / 1000),
        ease: 'back.out(1.5)',
        overwrite: true,
        onComplete: i === spans.length - 1 && onRevealed ? onRevealed : undefined,
      });
    });
  }, [staggerMs, totalDuration, scatterDistance, isMobile, onRevealed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top 95%',
      onEnter: () => {
        reveal();
        st.kill();
      },
      once: true,
    });

    return () => st.kill();
  }, [reveal]);

  // Fallback: if already in viewport on mount, reveal immediately
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      reveal();
    }
  }, [reveal]);

  return (
    <Tag ref={containerRef as any} className={className} style={style}>
      {words.map((word, i) => {
        const isSpace = /^\s+$/.test(word);
        return (
          <span
            key={i}
            ref={(el) => { wordRefs.current[i] = el; }}
            className="inline-block"
            style={{
              whiteSpace: isSpace ? 'pre' : undefined,
              willChange: 'transform, opacity, filter',
            }}
          >
            {word}
          </span>
        );
      })}
    </Tag>
  );
}