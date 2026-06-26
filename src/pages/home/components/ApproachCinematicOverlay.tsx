import { useRef, useEffect } from 'react';
import ApproachParticles, { type ApproachParticlesRef } from './ApproachParticles';
import ApproachFlow from './ApproachFlow';

interface ApproachCinematicOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTrialClick: () => void;
}

export default function ApproachCinematicOverlay({
  isOpen,
  onClose,
  onTrialClick,
}: ApproachCinematicOverlayProps) {
  const particlesRef = useRef<ApproachParticlesRef>(null);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <ApproachParticles ref={particlesRef} isActive={isOpen} />

      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          zIndex: 3,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 4px)',
        }}
      />

      <ApproachFlow
        particlesRef={particlesRef}
        onClose={onClose}
        onTrialClick={onTrialClick}
      />

      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-300 cursor-pointer"
      >
        <i className="ri-close-line text-lg" />
      </button>
    </div>
  );
}