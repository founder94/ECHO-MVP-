import { useEffect, useRef, useCallback, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import MagneticButton from '@/components/base/MagneticButton';

gsap.registerPlugin(ScrollTrigger);

// ─── Types ───────────────────────────────────────────

export interface ExperienceCard {
  number?: string;
  title: string;
  description: string;
  image?: string;
}

export interface ExperienceStep {
  label: string;
  type: 'hero' | 'text' | 'cards' | 'cta';
  headline?: string;
  headlineLines?: string[];
  subheadline?: string;
  paragraphs?: string[];
  cards?: ExperienceCard[];
  ctaText?: string;
  ctaAction?: 'close' | 'trial' | 'report';
  bottomTag?: string;
}

export interface ExperienceConfig {
  id: string;
  namespace: string; // for class scoping, e.g. "about-sequence"
  steps: ExperienceStep[];
  particleCount?: number;
  particleCountMobile?: number;
}

interface SequenceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTrialClick: () => void;
  config: ExperienceConfig;
}

// ─── Constants ───────────────────────────────────────

const CONNECTION_DISTANCE = 10;
const MAX_CONNECTIONS = 3;

function isMobileDevice() {
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

// ─── Component ───────────────────────────────────────

const SequenceOverlay = ({ isOpen, onClose, onTrialClick, config }: SequenceOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const particleDataRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points;
    lines: THREE.LineSegments;
    positions: Float32Array;
    velocities: Float32Array;
    originalPositions: Float32Array;
    sizes: Float32Array;
    mouse: THREE.Vector2;
    targetMouse: THREE.Vector2;
    animId: number;
    time: number;
    scrollProgress: number;
  } | null>(null);
  const [showFinalCTA, setShowFinalCTA] = useState(false);
  const hasTriggeredRef = useRef(false);

  const particleCount = config.particleCount ?? 6000;
  const particleCountMobile = config.particleCountMobile ?? 2000;

  // ─── Three.js Init ──────────────────────────────────

  const initThree = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = isMobileDevice() ? particleCountMobile : particleCount;
    const mobile = isMobileDevice();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.018);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 55;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 2));
    renderer.setClearColor(0x000000, 1);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = (Math.random() - 0.5) * 130;
      const y = (Math.random() - 0.5) * 130;
      const z = (Math.random() - 0.5) * 90;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;
      velocities[i3] = (Math.random() - 0.5) * 0.012;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.012;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.006;
      sizes[i] = Math.random() * 2.2 + 0.5;

      const shade = 0.55 + Math.random() * 0.45;
      colors[i3] = shade;
      colors[i3 + 1] = shade;
      colors[i3 + 2] = shade;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(count * MAX_CONNECTIONS * 6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    particleDataRef.current = {
      scene, camera, renderer, particles, lines,
      positions, velocities, originalPositions, sizes,
      mouse: new THREE.Vector2(999, 999),
      targetMouse: new THREE.Vector2(999, 999),
      animId: 0, time: 0, scrollProgress: 0,
    };

    const animate = () => {
      const d = particleDataRef.current;
      if (!d) return;
      d.animId = requestAnimationFrame(animate);
      d.time += 0.0025;

      const pos = d.positions;
      const vel = d.velocities;
      const orig = d.originalPositions;
      const pCount = pos.length / 3;
      const t = d.time;

      d.mouse.x += (d.targetMouse.x - d.mouse.x) * 0.04;
      d.mouse.y += (d.targetMouse.y - d.mouse.y) * 0.04;

      const mx = d.mouse.x;
      const my = d.mouse.y;

      let lineIdx = 0;
      const linePos = d.lines.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < pCount; i++) {
        const i3 = i * 3;
        const ox = orig[i3];
        const oy = orig[i3 + 1];
        const oz = orig[i3 + 2];

        vel[i3] += Math.sin(t * 0.6 + i * 0.1) * 0.012;
        vel[i3 + 1] += Math.cos(t * 0.5 + i * 0.12) * 0.012;
        vel[i3 + 2] += Math.sin(t * 0.25 + i * 0.06) * 0.006;

        const dx = pos[i3];
        const dy = pos[i3 + 1];
        const distC = Math.sqrt(dx * dx + dy * dy);
        const suction = 0.0006 + (d.scrollProgress * 0.0015);
        if (distC > 0.1) {
          vel[i3] -= (dx / distC) * suction;
          vel[i3 + 1] -= (dy / distC) * suction;
        }

        const mdx = pos[i3] - mx;
        const mdy = pos[i3 + 1] - my;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < 28 && mDist > 0.1) {
          const force = (28 - mDist) / 28 * 0.12;
          vel[i3] += (mdx / mDist) * force;
          vel[i3 + 1] += (mdy / mDist) * force;
        }

        vel[i3] += (ox - pos[i3]) * 0.0008;
        vel[i3 + 1] += (oy - pos[i3 + 1]) * 0.0008;
        vel[i3 + 2] += (oz - pos[i3 + 2]) * 0.0006;

        vel[i3] *= 0.97;
        vel[i3 + 1] *= 0.97;
        vel[i3 + 2] *= 0.97;

        pos[i3] += vel[i3];
        pos[i3 + 1] += vel[i3 + 1];
        pos[i3 + 2] += vel[i3 + 2];

        if (i < pCount - 1) {
          let connections = 0;
          for (let j = i + 1; j < pCount && connections < MAX_CONNECTIONS; j++) {
            const j3 = j * 3;
            const cdx = pos[i3] - pos[j3];
            const cdy = pos[i3 + 1] - pos[j3 + 1];
            const cdz = pos[i3 + 2] - pos[j3 + 2];
            const cDist = Math.sqrt(cdx * cdx + cdy * cdy + cdz * cdz);
            if (cDist < CONNECTION_DISTANCE) {
              linePos[lineIdx++] = pos[i3];
              linePos[lineIdx++] = pos[i3 + 1];
              linePos[lineIdx++] = pos[i3 + 2];
              linePos[lineIdx++] = pos[j3];
              linePos[lineIdx++] = pos[j3 + 1];
              linePos[lineIdx++] = pos[j3 + 2];
              connections++;
            }
          }
        }
      }

      for (let k = lineIdx; k < linePos.length; k++) {
        linePos[k] = 0;
      }

      d.particles.geometry.attributes.position.needsUpdate = true;
      d.lines.geometry.attributes.position.needsUpdate = true;
      d.renderer.render(d.scene, d.camera);
    };

    animate();

    const handleResize = () => {
      const d = particleDataRef.current;
      if (!d) return;
      const w2 = window.innerWidth;
      const h2 = window.innerHeight;
      d.camera.aspect = w2 / h2;
      d.camera.updateProjectionMatrix();
      d.renderer.setSize(w2, h2);
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const d = particleDataRef.current;
      if (!d) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      d.targetMouse.set(x * 55, y * 55);
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleTouchMove = (e: TouchEvent) => {
      const d = particleDataRef.current;
      if (!d) return;
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const x = (t.clientX / window.innerWidth) * 2 - 1;
        const y = -(t.clientY / window.innerHeight) * 2 + 1;
        d.targetMouse.set(x * 55, y * 55);
      }
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    const handleScroll = () => {
      const d = particleDataRef.current;
      if (!d || !scrollContainerRef.current) return;
      const maxScroll = scrollContainerRef.current.scrollHeight - window.innerHeight;
      d.scrollProgress = maxScroll > 0 ? scrollContainerRef.current.scrollTop / maxScroll : 0;
    };
    scrollContainerRef.current?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      const d = particleDataRef.current;
      if (!d) return;
      cancelAnimationFrame(d.animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      scrollContainerRef.current?.removeEventListener('scroll', handleScroll);
      d.renderer.dispose();
      d.particles.geometry.dispose();
      (d.particles.material as THREE.Material).dispose();
      d.lines.geometry.dispose();
      (d.lines.material as THREE.Material).dispose();
    };
  }, [particleCount, particleCountMobile]);

  // ─── Section Reveal Animations ──────────────────────

  const animateSectionReveal = useCallback((el: HTMLElement) => {
    const lines = el.querySelectorAll('.seq-line');
    return gsap.fromTo(lines,
      { opacity: 0, y: 35, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, stagger: 0.16, ease: 'power3.out' }
    );
  }, []);

  const animateCardsReveal = useCallback((el: HTMLElement) => {
    const cards = el.querySelectorAll('.seq-card');
    return gsap.fromTo(cards,
      { opacity: 0, y: 45, filter: 'blur(4px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.18, ease: 'power3.out' }
    );
  }, []);

  // ─── ScrollTrigger Setup ────────────────────────────

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const ctx = gsap.context(() => {
      const cssNS = `.${config.namespace}`;

      sectionRefs.current.forEach((el, i) => {
        if (!el) return;
        const isCards = el.querySelector('.seq-card');

        ScrollTrigger.create({
          trigger: el,
          start: 'top 72%',
          onEnter: () => {
            if (isCards) animateCardsReveal(el);
            else animateSectionReveal(el);
          },
          once: true,
        });
      });

      ScrollTrigger.create({
        trigger: `${cssNS}-final-trigger`,
        start: 'top 72%',
        onEnter: () => {
          setShowFinalCTA(true);
          gsap.fromTo(
            `${cssNS}-final-content`,
            { opacity: 0, y: 28, filter: 'blur(4px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.12 }
          );
        },
        once: true,
      });
    }, contentRef);

    return () => ctx.revert();
  }, [isOpen, config.namespace, animateSectionReveal, animateCardsReveal]);

  // ─── Open/Close Effects ─────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      setShowFinalCTA(false);
      hasTriggeredRef.current = false;
      return;
    }

    document.body.style.overflow = 'hidden';
    const cleanup = initThree();

    return () => {
      document.body.style.overflow = '';
      if (cleanup) cleanup();
      const data = particleDataRef.current;
      if (data) {
        cancelAnimationFrame(data.animId);
        data.renderer.dispose();
      }
      particleDataRef.current = null;
    };
  }, [isOpen, initThree]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ─── Render ─────────────────────────────────────────

  const renderStep = (step: ExperienceStep, index: number) => {
    if (step.type === 'hero') {
      return (
        <div
          key={step.label}
          ref={(el) => { sectionRefs.current[index] = el; }}
          className="h-screen flex items-center justify-center px-4 md:px-6"
        >
          <div className="text-center max-w-[480px] md:max-w-[540px]">
            <p className="seq-line text-[9px] md:text-[11px] font-mono tracking-[0.45em] md:tracking-[0.6em] uppercase text-white/28 mb-6 md:mb-10">
              {step.label}
            </p>
            <h2
              className="seq-line text-[17px] sm:text-[22px] md:text-[30px] font-normal leading-[1.55] md:leading-[1.7] text-white/90 mb-8 md:mb-14 tracking-[-0.01em]"
              style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
            >
              {step.headline}
            </h2>
            <div className="seq-line flex flex-col items-center gap-2 md:gap-3">
              <p className="text-[10px] md:text-[12px] font-mono tracking-[0.2em] md:tracking-[0.25em] uppercase text-white/22">
                {step.subheadline || '↓ 스크롤하여 시작하기'}
              </p>
              <div className="w-[1px] h-8 md:h-10 bg-white/18 animate-pulse mt-1 md:mt-2" />
            </div>
          </div>
        </div>
      );
    }

    if (step.type === 'text') {
      return (
        <div
          key={step.label}
          ref={(el) => { sectionRefs.current[index] = el; }}
          className="h-screen flex items-center justify-center px-4 md:px-6"
        >
          <div className="text-center max-w-[540px] md:max-w-[640px]">
            <p className="seq-line text-[9px] md:text-[11px] font-mono tracking-[0.35em] md:tracking-[0.45em] uppercase text-white/22 mb-8 md:mb-14">
              {step.label}
            </p>
            {step.headlineLines ? (
              step.headlineLines.map((line, li) => (
                <p
                  key={li}
                  className={`seq-line text-[15px] sm:text-[19px] md:text-[26px] font-normal leading-[1.75] md:leading-[1.95] text-white/68 ${li < (step.headlineLines?.length ?? 0) - 1 ? 'mb-3 md:mb-6' : ''}`}
                  style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                >
                  {line}
                </p>
              ))
            ) : step.headline ? (
              <p
                className="seq-line text-[18px] sm:text-[24px] md:text-[32px] font-normal leading-[1.6] md:leading-[1.7] text-white/72"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                {step.headline}
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    if (step.type === 'cards') {
      return (
        <div
          key={step.label}
          ref={(el) => { sectionRefs.current[index] = el; }}
          className="min-h-screen flex items-center justify-center px-4 md:px-6 py-14 md:py-0"
        >
          <div className="w-full max-w-[680px] md:max-w-[900px]">
            <p className="seq-line text-[9px] md:text-[11px] font-mono tracking-[0.35em] md:tracking-[0.45em] uppercase text-white/22 mb-3 md:mb-6 text-center">
              {step.label}
            </p>
            {step.headline && (
              <h3
                className="seq-line text-[17px] sm:text-[22px] md:text-[26px] font-normal text-white/88 mb-10 md:mb-16 text-center tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                {step.headline}
              </h3>
            )}
            <div className={`grid grid-cols-1 ${(step.cards?.length ?? 3) >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 md:gap-6`}>
              {step.cards?.map((card, ci) => (
                <div
                  key={ci}
                  className="seq-card group bg-[#0a0a0a]/50 border border-white/[0.05] rounded-lg overflow-hidden transition-all duration-500 hover:border-white/[0.12] active:border-white/[0.16] active:scale-[0.98] active:bg-white/[0.03] hover:-translate-y-1 cursor-default touch-manipulation"
                >
                  {card.image && (
                    <div className="relative w-full h-28 sm:h-36 md:h-48 overflow-hidden">
                      <img
                        src={card.image}
                        alt={card.title}
                        className="w-full h-full object-cover object-top transition-all duration-700 group-hover:scale-105 group-active:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />
                    </div>
                  )}
                  <div className="p-5 md:p-8">
                    {card.number && (
                      <span
                        className="text-[36px] md:text-[54px] font-light text-white/[0.07] leading-none block mb-4 md:mb-6"
                        style={{ fontFamily: 'var(--font-label, monospace)' }}
                      >
                        {card.number}
                      </span>
                    )}
                    <h4
                      className="text-[14px] md:text-[18px] font-medium text-white/88 mb-2 md:mb-3 tracking-[-0.01em]"
                      style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                    >
                      {card.title}
                    </h4>
                    <p className="text-[11px] md:text-[13px] text-white/38 leading-[1.65] md:leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
                      {card.description}
                    </p>
                  </div>
                  <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/0 group-hover:bg-white/7 transition-all duration-500 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step.type === 'cta') {
      return (
        <div
          key={step.label}
          className={`${config.namespace}-final-trigger h-screen flex items-center justify-center px-4 md:px-6`}
          ref={(el) => { sectionRefs.current[index] = el; }}
        >
          <div className="text-center max-w-[420px] md:max-w-[520px]">
            {showFinalCTA && (
              <>
                <p className={`${config.namespace}-final-content text-[9px] md:text-[11px] font-mono tracking-[0.35em] md:tracking-[0.45em] uppercase text-white/22 mb-8 md:mb-14`}>
                  {step.label}
                </p>
                {step.headline && (
                  <h2
                    className={`${config.namespace}-final-content text-[20px] sm:text-[28px] md:text-[40px] font-normal leading-[1.45] md:leading-[1.6] text-white/88 mb-8 md:mb-14 tracking-[-0.02em]`}
                    style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                  >
                    {step.headline}
                  </h2>
                )}
                <div className={`${config.namespace}-final-content`}>
                  <MagneticButton
                    onClick={() => {
                      if (step.ctaAction === 'trial' || step.ctaAction === 'report') {
                        onClose();
                        setTimeout(onTrialClick, 500);
                      } else {
                        onClose();
                      }
                    }}
                    variant="primary"
                    size="lg"
                    className="text-[14px] md:text-[17px]"
                  >
                    {step.ctaText || '닫기'}
                  </MagneticButton>
                </div>
                {step.bottomTag && (
                  <p className={`${config.namespace}-final-content mt-6 md:mt-10 text-[9px] md:text-[11px] text-white/18 tracking-[0.1em] md:tracking-[0.12em] uppercase`}>
                    {step.bottomTag}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const totalScreens = config.steps.length;

  return (
    <div className={`${config.namespace} fixed inset-0 z-[1000] bg-black`} ref={containerRef}>
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }} />

      {/* Glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 45%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Volumetric light beam */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 4,
          background: 'conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.025) 60deg, transparent 120deg, rgba(255,255,255,0.02) 180deg, transparent 240deg, rgba(255,255,255,0.025) 300deg, transparent 360deg)',
          animation: 'seq-volumetric-rotate 22s linear infinite',
        }}
      />

      {/* Glass reflection */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.015) 100%)',
        }}
      />

      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 6,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 6px)',
          opacity: 0.08,
        }}
      />

      {/* Noise */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 7,
          opacity: 0.035,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 md:top-6 md:right-6 z-[50] flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-full border border-white/18 bg-black/35 backdrop-blur-sm text-white cursor-pointer hover:bg-white/8 active:bg-white/12 active:scale-95 transition-all duration-300 touch-manipulation"
        style={{ top: `calc(1rem + var(--safe-inset-top, 0px))`, right: `calc(1rem + var(--safe-inset-right, 0px))` }}
        aria-label="닫기"
      >
        <i className="ri-close-line text-base md:text-lg" />
      </button>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 overflow-y-auto"
        style={{ zIndex: 10, scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={contentRef} className="relative" style={{ minHeight: `${totalScreens * 100}vh` }}>
          {config.steps.map((step, i) => renderStep(step, i))}
          <div className="h-[20vh] md:h-[40vh]" />
        </div>
      </div>

      <style>{`
        @keyframes seq-volumetric-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SequenceOverlay;