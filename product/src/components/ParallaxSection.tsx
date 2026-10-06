import type { ReactNode } from 'react';
import { useParallax } from '@/context/ParallaxContext';

interface ParallaxSectionProps {
  children: ReactNode;
  intensity?: number;
  className?: string;
  withBackground?: boolean;
}

export default function ParallaxSection({
  children,
  intensity = 0.25,
  className = '',
  withBackground = false,
}: ParallaxSectionProps) {
  const { rotateX, rotateY, bgX, bgY, contentX, contentY } = useParallax();

  const rx = rotateX * intensity;
  const ry = rotateY * intensity;
  const cx = contentX * intensity;
  const cy = contentY * intensity;
  const bx = bgX * intensity;
  const by = bgY * intensity;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
    >
      {/* Optional subtle parallax background layer */}
      {withBackground && (
        <div
          className="absolute inset-[-40px] z-0 pointer-events-none"
          style={{
            transform: `translate3d(${bx}px, ${by}px, 0)`,
            transition: 'transform 0.05s linear',
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              backgroundColor: 'rgba(255, 160, 160, 0.14)',
              width: '22rem',
              height: '22rem',
              top: '-10%',
              left: '-8%',
              filter: 'blur(80px)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              backgroundColor: 'rgba(160, 210, 255, 0.12)',
              width: '20rem',
              height: '20rem',
              top: '30%',
              right: '-6%',
              filter: 'blur(70px)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              backgroundColor: 'rgba(210, 180, 255, 0.12)',
              width: '24rem',
              height: '24rem',
              bottom: '-10%',
              left: '20%',
              filter: 'blur(75px)',
            }}
          />
        </div>
      )}

      {/* Tilted content layer */}
      <div
        className="relative z-10"
        style={{
          transform: `rotateX(${rx}deg) rotateY(${ry}deg) translate3d(${cx}px, ${cy}px, 0)`,
          transition: 'transform 0.05s linear',
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </div>
  );
}