import { useEffect, useRef, useCallback, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import MagneticButton from '@/components/base/MagneticButton';

gsap.registerPlugin(ScrollTrigger);

interface MissionCinematicOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTrialClick: () => void;
}

const PARTICLE_COUNT_DESKTOP = 8000;
const PARTICLE_COUNT_MOBILE = 3000;
const CONNECTION_DISTANCE = 12;
const MAX_CONNECTIONS = 3;

function isMobileDevice() {
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

const MissionCinematicOverlay = ({ isOpen, onClose, onTrialClick }: MissionCinematicOverlayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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
    ringTime: number;
    lightBurstTime: number;
    scrollProgress: number;
    cameraZ: number;
  } | null>(null);
  const [showFinalCTA, setShowFinalCTA] = useState(false);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const beamRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const initThree = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = isMobileDevice() ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    const mobile = isMobileDevice();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.015);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.z = 60;

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
      const x = (Math.random() - 0.5) * 140;
      const y = (Math.random() - 0.5) * 140;
      const z = (Math.random() - 0.5) * 100;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;
      velocities[i3] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.015;
      sizes[i] = Math.random() * 2.5 + 0.5;

      const shade = 0.6 + Math.random() * 0.4;
      colors[i3] = shade;
      colors[i3 + 1] = shade;
      colors[i3 + 2] = shade;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
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
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    particleDataRef.current = {
      scene,
      camera,
      renderer,
      particles,
      lines,
      positions,
      velocities,
      originalPositions,
      sizes,
      mouse: new THREE.Vector2(999, 999),
      targetMouse: new THREE.Vector2(999, 999),
      animId: 0,
      time: 0,
      ringTime: 0,
      lightBurstTime: 0,
      scrollProgress: 0,
      cameraZ: 60,
    };

    const animate = () => {
      const d = particleDataRef.current;
      if (!d) return;
      d.animId = requestAnimationFrame(animate);
      d.time += 0.003;

      const pos = d.positions;
      const vel = d.velocities;
      const orig = d.originalPositions;
      const pCount = pos.length / 3;
      const t = d.time;

      d.mouse.x += (d.targetMouse.x - d.mouse.x) * 0.04;
      d.mouse.y += (d.targetMouse.y - d.mouse.y) * 0.04;

      const mx = d.mouse.x;
      const my = d.mouse.y;
      const ringActive = d.ringTime > 0;
      const ringDecay = Math.max(0, d.ringTime - 0.016);
      d.ringTime = ringDecay;

      const lightActive = d.lightBurstTime > 0;
      const lightDecay = Math.max(0, d.lightBurstTime - 0.016);
      d.lightBurstTime = lightDecay;

      d.cameraZ += (50 - d.cameraZ) * 0.0005;
      d.camera.position.z = d.cameraZ + Math.sin(t * 0.3) * 2;

      let lineIdx = 0;
      const linePos = d.lines.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < pCount; i++) {
        const i3 = i * 3;
        const ox = orig[i3];
        const oy = orig[i3 + 1];
        const oz = orig[i3 + 2];

        const nx = Math.sin(t * 0.7 + i * 0.1) * 0.015;
        const ny = Math.cos(t * 0.5 + i * 0.13) * 0.015;
        const nz = Math.sin(t * 0.3 + i * 0.07) * 0.008;
        vel[i3] += nx;
        vel[i3 + 1] += ny;
        vel[i3 + 2] += nz;

        const cx = 0;
        const cy = 0;
        const cz = 0;
        const dx = pos[i3] - cx;
        const dy = pos[i3 + 1] - cy;
        const dz = pos[i3 + 2] - cz;
        const distC = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const suction = 0.0008 + (d.scrollProgress * 0.002);
        if (distC > 0.1) {
          vel[i3] -= (dx / distC) * suction;
          vel[i3 + 1] -= (dy / distC) * suction;
          vel[i3 + 2] -= (dz / distC) * suction;
        }

        const mdx = pos[i3] - mx;
        const mdy = pos[i3 + 1] - my;
        const mdz = pos[i3 + 2] - 0;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy + mdz * mdz);
        if (mDist < 30 && mDist > 0.1) {
          const force = (30 - mDist) / 30 * 0.15;
          vel[i3] += (mdx / mDist) * force;
          vel[i3 + 1] += (mdy / mDist) * force;
          vel[i3 + 2] += (mdz / mDist) * force * 0.3;
        }

        if (ringActive) {
          const angle = Math.atan2(oy, ox) + 0.02;
          const radius = Math.sqrt(ox * ox + oy * oy);
          const tx = Math.cos(angle) * radius;
          const ty = Math.sin(angle) * radius;
          vel[i3] += (tx - pos[i3]) * 0.003;
          vel[i3 + 1] += (ty - pos[i3 + 1]) * 0.003;
        }

        if (lightActive) {
          const burstForce = lightDecay * 0.4;
          const dirX = ox !== 0 ? ox / Math.abs(ox) : 0;
          const dirY = oy !== 0 ? oy / Math.abs(oy) : 0;
          vel[i3] += dirX * burstForce * 0.08;
          vel[i3 + 1] += dirY * burstForce * 0.08;
        }

        vel[i3] += (ox - pos[i3]) * 0.001;
        vel[i3 + 1] += (oy - pos[i3 + 1]) * 0.001;
        vel[i3 + 2] += (oz - pos[i3 + 2]) * 0.001;

        vel[i3] *= 0.965;
        vel[i3 + 1] *= 0.965;
        vel[i3 + 2] *= 0.965;

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
      const worldX = x * 60;
      const worldY = y * 60;
      d.targetMouse.set(worldX, worldY);
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleTouchMove = (e: TouchEvent) => {
      const d = particleDataRef.current;
      if (!d) return;
      if (e.touches.length > 0) {
        const t = e.touches[0];
        const x = (t.clientX / window.innerWidth) * 2 - 1;
        const y = -(t.clientY / window.innerHeight) * 2 + 1;
        const worldX = x * 60;
        const worldY = y * 60;
        d.targetMouse.set(worldX, worldY);
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
  }, []);

  const animateSectionReveal = useCallback((el: HTMLElement) => {
    const lines = el.querySelectorAll('.protocol-line');
    const tl = gsap.timeline();

    tl.fromTo(
      lines,
      { opacity: 0, y: 40, filter: 'blur(8px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 1.4,
        stagger: 0.18,
        ease: 'power3.out',
      }
    );

    return tl;
  }, []);

  const animateCardsReveal = useCallback((el: HTMLElement) => {
    const cards = el.querySelectorAll('.protocol-card');
    const tl = gsap.timeline();

    tl.fromTo(
      cards,
      { opacity: 0, y: 50, filter: 'blur(6px)' },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 1.0,
        stagger: 0.2,
        ease: 'power3.out',
      }
    );

    return tl;
  }, []);

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const ctx = gsap.context(() => {
      const masterTl = gsap.timeline();

      sectionRefs.current.forEach((el, i) => {
        if (!el) return;

        const isCards = el.querySelector('.protocol-card');

        ScrollTrigger.create({
          trigger: el,
          start: 'top 70%',
          end: 'bottom 30%',
          onEnter: () => {
            if (isCards) {
              const tl = animateCardsReveal(el);
              masterTl.add(tl, i * 0.3);
            } else {
              const tl = animateSectionReveal(el);
              masterTl.add(tl, i * 0.3);
            }
          },
          once: true,
        });

        ScrollTrigger.create({
          trigger: el,
          start: 'center top',
          end: 'bottom top',
          scrub: true,
          onUpdate: (self) => {
            const lines = el.querySelectorAll('.protocol-line, .protocol-card');
            if (self.progress > 0.7) {
              gsap.to(lines, {
                opacity: 1 - (self.progress - 0.7) / 0.3,
                duration: 0.1,
              });
            }
          },
        });
      });

      ScrollTrigger.create({
        trigger: '.protocol-final-trigger',
        start: 'top 70%',
        onEnter: () => {
          setShowFinalCTA(true);
          gsap.fromTo(
            '.protocol-final-content',
            { opacity: 0, y: 30, filter: 'blur(6px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out', stagger: 0.15 }
          );
        },
        once: true,
      });
    }, contentRef);

    return () => ctx.revert();
  }, [isOpen, animateSectionReveal, animateCardsReveal]);

  useEffect(() => {
    if (!isOpen) {
      setShowFinalCTA(false);
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.trigger && (st.vars.trigger as HTMLElement)?.closest?.('.mission-cinematic')) {
          st.kill();
        }
      });
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

  return (
    <div className="mission-cinematic fixed inset-0 z-[1000] bg-black" ref={containerRef}>
      {/* Three.js Canvas Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 1 }}
      />

      {/* Bloom / Glow overlay */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 50%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Volumetric Light Beam */}
      <div
        ref={beamRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 4,
          background: 'conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.03) 60deg, transparent 120deg, rgba(255,255,255,0.02) 180deg, transparent 240deg, rgba(255,255,255,0.03) 300deg, transparent 360deg)',
          animation: 'volumetric-rotate 20s linear infinite',
        }}
      />

      {/* Glass Reflection overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.02) 100%)',
        }}
      />

      {/* Motion Blur / Scanline */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 6,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 6px)',
          opacity: 0.1,
        }}
      />

      {/* Noise Distortion */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 7,
          opacity: 0.04,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")',
          backgroundSize: '200px 200px',
        }}
      />

      {/* Depth Light Beam */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 8,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-[50] flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm text-white cursor-pointer hover:bg-white/10 transition-all duration-300"
        aria-label="닫기"
      >
        <i className="ri-close-line text-lg" />
      </button>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 overflow-y-auto"
        style={{ zIndex: 10, scrollBehavior: 'smooth' }}
      >
        <div ref={contentRef} className="relative min-h-[600vh]">
          {/* ─── SECTION 1: ENTRY ─── */}
          <div
            ref={(el) => { sectionRefs.current[0] = el; }}
            className="h-screen flex items-center justify-center px-6"
          >
            <div className="text-center max-w-[560px]">
              <p className="protocol-line text-[10px] md:text-[11px] font-mono tracking-[0.6em] uppercase text-white/30 mb-8 md:mb-10">
                ECHO PROTOCOL
              </p>
              <h2
                className="protocol-line text-[20px] sm:text-[24px] md:text-[30px] font-normal leading-[1.6] md:leading-[1.7] text-white/90 mb-10 md:mb-14 tracking-[-0.01em]"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                지금부터, 당신의 관계를 읽습니다.
              </h2>
              <div className="protocol-line flex flex-col items-center gap-3">
                <p className="text-[11px] md:text-[12px] font-mono tracking-[0.3em] uppercase text-white/25">
                  ↓ 스크롤하여 시작하기
                </p>
                <div className="w-[1px] h-10 bg-white/20 animate-pulse mt-2" />
              </div>
            </div>
          </div>

          {/* ─── SECTION 2: WHY ─── */}
          <div
            ref={(el) => { sectionRefs.current[1] = el; }}
            className="h-screen flex items-center justify-center px-6"
          >
            <div className="text-center max-w-[640px]">
              <p className="protocol-line text-[10px] md:text-[11px] font-mono tracking-[0.5em] uppercase text-white/25 mb-10 md:mb-14">
                WHY
              </p>
              <p
                className="protocol-line text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[1.9] text-white/70 mb-4 md:mb-6"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                수많은 관계 속에서
              </p>
              <p
                className="protocol-line text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[1.9] text-white/70 mb-4 md:mb-6"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                우리는 매일 조금씩
                {' '}
                <span className="text-white/95">'나'</span>
                {' '}
                를 잃어갑니다.
              </p>
              <p
                className="protocol-line text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[1.9] text-white/70"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                ECHO는 그 흩어진 조각들을 다시 모읍니다.
              </p>
            </div>
          </div>

          {/* ─── SECTION 3: WHAT ─── */}
          <div
            ref={(el) => { sectionRefs.current[2] = el; }}
            className="h-screen flex items-center justify-center px-6"
          >
            <div className="text-center max-w-[640px]">
              <p className="protocol-line text-[10px] md:text-[11px] font-mono tracking-[0.5em] uppercase text-white/25 mb-10 md:mb-14">
                WHAT
              </p>
              <p
                className="protocol-line text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[1.9] text-white/70 mb-4 md:mb-6"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                흩어진 관계의 데이터가
              </p>
              <p
                className="protocol-line text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[1.9] text-white/70 mb-4 md:mb-6"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                하나의
                {' '}
                <span className="text-white/95">'나'</span>
                {' '}
                로 수렴할 때,
              </p>
              <p
                className="protocol-line text-[18px] sm:text-[22px] md:text-[26px] font-normal leading-[1.8] md:leading-[1.9] text-white/70"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                비로소 진짜 내가 보입니다.
              </p>
            </div>
          </div>

          {/* ─── SECTION 4: HOW (3 Steps) ─── */}
          <div
            ref={(el) => { sectionRefs.current[3] = el; }}
            className="min-h-screen flex items-center justify-center px-6 py-20 md:py-0"
          >
            <div className="w-full max-w-[900px]">
              <p className="protocol-line text-[10px] md:text-[11px] font-mono tracking-[0.5em] uppercase text-white/25 mb-4 md:mb-6 text-center">
                HOW
              </p>
              <h3
                className="protocol-line text-[20px] md:text-[26px] font-normal text-white/90 mb-12 md:mb-16 text-center tracking-[-0.02em]"
                style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
              >
                세 단계로, 나를 다시 만나다
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                {/* Card 01 */}
                <div className="protocol-card group bg-[#0a0a0a]/60 border border-white/[0.06] rounded-lg p-7 md:p-8 transition-all duration-500 hover:border-white/[0.14] hover:-translate-y-1">
                  <span
                    className="text-[48px] md:text-[56px] font-light text-white/[0.08] leading-none block mb-5 md:mb-6"
                    style={{ fontFamily: 'var(--font-label, monospace)' }}
                  >
                    01
                  </span>
                  <h4
                    className="text-[16px] md:text-[18px] font-medium text-white/90 mb-3 tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                  >
                    관계를 꺼내놓다
                  </h4>
                  <p className="text-[12px] md:text-[13px] text-white/40 leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
                    지나온 관계와 감정을 AI와 함께 정리합니다.
                  </p>
                  <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/0 group-hover:bg-white/8 transition-all duration-500 rounded-full" />
                </div>

                {/* Card 02 */}
                <div className="protocol-card group bg-[#0a0a0a]/60 border border-white/[0.06] rounded-lg p-7 md:p-8 transition-all duration-500 hover:border-white/[0.14] hover:-translate-y-1">
                  <span
                    className="text-[48px] md:text-[56px] font-light text-white/[0.08] leading-none block mb-5 md:mb-6"
                    style={{ fontFamily: 'var(--font-label, monospace)' }}
                  >
                    02
                  </span>
                  <h4
                    className="text-[16px] md:text-[18px] font-medium text-white/90 mb-3 tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                  >
                    나의 패턴을 마주하다
                  </h4>
                  <p className="text-[12px] md:text-[13px] text-white/40 leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
                    내가 반복하는 선택과 감정의 이유를 구조적으로 이해합니다.
                  </p>
                  <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/0 group-hover:bg-white/8 transition-all duration-500 rounded-full" />
                </div>

                {/* Card 03 */}
                <div className="protocol-card group bg-[#0a0a0a]/60 border border-white/[0.06] rounded-lg p-7 md:p-8 transition-all duration-500 hover:border-white/[0.14] hover:-translate-y-1">
                  <span
                    className="text-[48px] md:text-[56px] font-light text-white/[0.08] leading-none block mb-5 md:mb-6"
                    style={{ fontFamily: 'var(--font-label, monospace)' }}
                  >
                    03
                  </span>
                  <h4
                    className="text-[16px] md:text-[18px] font-medium text-white/90 mb-3 tracking-[-0.01em]"
                    style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                  >
                    진짜 나로 만나다
                  </h4>
                  <p className="text-[12px] md:text-[13px] text-white/40 leading-[1.7]" style={{ wordBreak: 'keep-all' }}>
                    나만의 기준이 생긴 채로, 나답게 사람을 만납니다.
                  </p>
                  <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/0 group-hover:bg-white/8 transition-all duration-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* ─── SECTION 5: FINAL ─── */}
          <div className="protocol-final-trigger h-screen flex items-center justify-center px-6">
            <div className="text-center max-w-[520px]">
              {showFinalCTA && (
                <>
                  <p className="protocol-final-content text-[10px] md:text-[11px] font-mono tracking-[0.5em] uppercase text-white/25 mb-10 md:mb-14">
                    PROTOCOL READY
                  </p>
                  <h2
                    className="protocol-final-content text-[24px] sm:text-[32px] md:text-[40px] font-normal leading-[1.5] md:leading-[1.6] text-white/90 mb-10 md:mb-14 tracking-[-0.02em]"
                    style={{ fontFamily: 'var(--font-heading, Georgia, serif)', wordBreak: 'keep-all' }}
                  >
                    당신의 프로토콜이
                    <br />
                    준비되었습니다.
                  </h2>
                  <div className="protocol-final-content">
                    <MagneticButton
                      onClick={() => {
                        onClose();
                        setTimeout(onTrialClick, 500);
                      }}
                      variant="primary"
                      size="lg"
                      className="text-[15px] md:text-[17px]"
                    >
                      작전 시작
                    </MagneticButton>
                  </div>
                  <p className="protocol-final-content mt-8 md:mt-10 text-[10px] md:text-[11px] text-white/20 tracking-[0.15em] uppercase">
                    ECHO — Human Relationship OS
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="h-[50vh]" />
        </div>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes volumetric-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MissionCinematicOverlay;