import { useRef, useState, useCallback, type MouseEvent, type ReactNode } from 'react';

interface MagneticButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  magneticStrength?: number;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  asAnchor?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export default function MagneticButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  magneticStrength = 0.3,
  disabled = false,
  type = 'button',
  asAnchor = false,
  href,
  target,
  rel,
}: MagneticButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; angle: number }[]>([]);
  const rippleIdRef = useRef(0);
  const particleIdRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setMagneticOffset({
      x: x * magneticStrength,
      y: y * magneticStrength,
    });
  }, [magneticStrength, disabled]);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    setIsHovered(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setMagneticOffset({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  const createRipple = useCallback((x: number, y: number) => {
    const id = rippleIdRef.current++;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  }, []);

  const createParticles = useCallback((x: number, y: number) => {
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: particleIdRef.current++,
      x,
      y,
      angle: (i / 8) * 360,
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 700);
  }, []);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    createRipple(x, y);
    createParticles(x, y);
    onClick?.(e);
  }, [disabled, createRipple, createParticles, onClick]);

  const sizeClasses = {
    sm: 'px-5 py-2.5 text-xs',
    md: 'px-7 py-3.5 text-sm',
    lg: 'px-10 py-4 text-base',
  };

  const variantClasses = {
    primary: 'bg-white text-black hover:bg-white/90',
    secondary: 'bg-white/10 text-white hover:bg-white/20 border border-white/10',
    outline: 'bg-transparent text-white/70 hover:text-white border border-white/20 hover:border-white/40',
    ghost: 'bg-transparent text-white/50 hover:text-white hover:bg-white/5',
  };

  const baseClasses = [
    'magnetic-btn',
    'relative',
    'inline-flex items-center justify-center gap-2',
    'rounded-full',
    'font-medium tracking-wide',
    'whitespace-nowrap',
    'cursor-pointer',
    'select-none',
    'transition-all duration-200',
    'overflow-visible',
    sizeClasses[size],
    variantClasses[variant],
    disabled ? 'opacity-40 cursor-not-allowed' : '',
    className,
  ].join(' ');

  const content = (
    <>
      {/* Glass reflection overlay */}
      <span
        className="absolute inset-0 rounded-full pointer-events-none overflow-hidden opacity-0 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(255,107,157,0.12) 0%, rgba(155,89,182,0.08) 30%, rgba(255,215,0,0.06) 60%, transparent 100%)',
          }}
        />
        {/* Light sweep */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: isHovered ? 'btn-sweep 1.2s ease-in-out infinite' : 'none',
          }}
        />
      </span>

      {/* Glow ring */}
      <span
        className="absolute -inset-[2px] rounded-full pointer-events-none opacity-0 transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: 'linear-gradient(135deg, rgba(255,107,157,0.25), rgba(155,89,182,0.2), rgba(255,215,0,0.15), rgba(255,127,80,0.2))',
          filter: 'blur(8px)',
          zIndex: -1,
        }}
      />

      {/* Ripples */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
            background: 'rgba(255,255,255,0.3)',
            transform: 'translate(-50%, -50%)',
            animation: 'btn-ripple 0.6s ease-out forwards',
          }}
        />
      ))}

      {/* Particle burst */}
      {particles.map(particle => (
        <span
          key={particle.id}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: particle.x,
            top: particle.y,
            width: 4,
            height: 4,
            background: `hsl(${particle.angle + 320}, 80%, 65%)`,
            animation: `btn-particle-burst 0.7s ease-out forwards`,
            '--particle-angle': `${particle.angle}deg`,
          } as React.CSSProperties}
        />
      ))}

      {/* Content wrapper */}
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </>
  );

  if (asAnchor && href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={baseClasses}
        onMouseMove={handleMouseMove as any}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e: any) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          createRipple(x, y);
          createParticles(x, y);
        }}
        style={{
          transform: `translate(${magneticOffset.x}px, ${magneticOffset.y}px)`,
          boxShadow: isHovered
            ? '0 0 30px rgba(255,107,157,0.15), 0 0 60px rgba(155,89,182,0.1), 0 0 90px rgba(255,215,0,0.05)'
            : 'none',
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={baseClasses}
      style={{
        transform: `translate(${magneticOffset.x}px, ${magneticOffset.y}px)`,
        boxShadow: isHovered
          ? '0 0 30px rgba(255,107,157,0.15), 0 0 60px rgba(155,89,182,0.1), 0 0 90px rgba(255,215,0,0.05)'
          : 'none',
      }}
    >
      {content}
    </button>
  );
}