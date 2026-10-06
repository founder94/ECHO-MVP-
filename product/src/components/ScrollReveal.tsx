import type { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export type RevealVariant =
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale-up'
  | 'scale-down'
  | 'blur-in'
  | 'rotate-in'
  | 'zoom-up'
  | 'flip-up';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  variant?: RevealVariant;
  delay?: number;
  distance?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
}

export default function ScrollReveal({
  children,
  className = '',
  variant = 'fade-up',
  delay = 0,
  distance = 60,
  duration = 800,
  threshold = 0.12,
  once = true,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollAnimation({ threshold, triggerOnce: once });

  const getInitialStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = { opacity: 0 };
    switch (variant) {
      case 'fade-up':
        return { ...base, transform: `translateY(${distance}px)` };
      case 'fade-down':
        return { ...base, transform: `translateY(-${distance}px)` };
      case 'fade-left':
        return { ...base, transform: `translateX(${distance}px)` };
      case 'fade-right':
        return { ...base, transform: `translateX(-${distance}px)` };
      case 'scale-up':
        return { ...base, transform: `scale(0.85)` };
      case 'scale-down':
        return { ...base, transform: `scale(1.15)` };
      case 'blur-in':
        return { ...base, transform: `translateY(${distance * 0.5}px)`, filter: 'blur(12px)' };
      case 'rotate-in':
        return { ...base, transform: `rotate(-8deg) translateY(${distance}px) scale(0.95)` };
      case 'zoom-up':
        return { ...base, transform: `scale(0.7) translateY(${distance}px)` };
      case 'flip-up':
        return { ...base, transform: `perspective(800px) rotateX(25deg) translateY(${distance}px)` };
      default:
        return { ...base, transform: `translateY(${distance}px)` };
    }
  };

  const getVisibleStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'blur-in':
        return { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' };
      case 'rotate-in':
        return { opacity: 1, transform: 'rotate(0deg) translateY(0) scale(1)' };
      case 'flip-up':
        return { opacity: 1, transform: 'perspective(800px) rotateX(0deg) translateY(0)' };
      default:
        return { opacity: 1, transform: 'translate(0, 0) scale(1)' };
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...getInitialStyles(),
        ...(isVisible ? getVisibleStyles() : {}),
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform, filter',
      }}
    >
      {children}
    </div>
  );
}