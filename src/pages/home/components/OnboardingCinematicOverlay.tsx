import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import MagneticButton from '@/components/base/MagneticButton';

interface OnboardingCinematicOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTrialClick: () => void;
}

const PAINTING_COLORS = [
  '#FF6B9D', '#FF8FAB', '#FF8C69', '#FF7F50',
  '#B8A9C9', '#D4C4E0', '#9B59B6', '#8E44AD',
  '#E74C3C', '#FF6B6B', '#F39C12', '#FFB347',
  '#FFD700', '#D4AF37', '#FFFFFF', '#F8F8F8',
];

const QUESTIONS = [
  {
    question: '지금 ECHO를 시작한 이유는 무엇인가요?',
    options: [
      '그냥 궁금해서',
      '심심해서 한번 해보고 싶어서',
      '나를 더 알고 싶어서',
      '누군가와의 관계가 떠올라서',
      '반복되는 내 선택이 궁금해서',
      '최근 있었던 일을 정리하고 싶어서',
    ],
  },
  {
    question: '어떤 관계를 떠올리고 있나요?',
    options: [
      '연인',
      '썸 / 호감',
      '친구',
      '가족',
      '직장 / 동료',
      '아직 특정한 사람은 없음',
    ],
  },
  {
    question: '지금 가장 궁금한 것은 무엇인가요?',
    options: [
      '나는 어떤 사람인지',
      '왜 비슷한 선택을 반복하는지',
      '상대와 나의 관계 흐름이 어땠는지',
      '내 감정이 어디서 시작됐는지',
      '앞으로 어떻게 행동하면 좋을지',
      '그냥 AI가 나를 어떻게 비추는지',
    ],
  },
];

const vertexShader = `
  attribute float size;
  attribute vec3 color;
  attribute float phase;
  attribute float random;
  attribute float angle;
  attribute float radius;
  uniform float time;
  uniform float uGateProgress;
  uniform float uZoom;
  uniform float uScatter;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDist;

  void main() {
    vec3 pos = position;
    float t = time * 0.3 + phase;
    float gate = uGateProgress;
    float zoom = uZoom;
    float scatter = uScatter;

    // Gate formation - particles form a ring
    float targetAngle = angle + t * 0.2;
    float targetRadius = radius * gate + (1.0 - gate) * radius * 3.0;
    float targetX = cos(targetAngle) * targetRadius;
    float targetY = sin(targetAngle) * targetRadius;
    float targetZ = sin(t * 0.5 + random * 3.14) * 30.0 * gate;

    // Spiral inward during zoom
    float spiralAngle = targetAngle + t * 0.5;
    float spiralRadius = targetRadius * (1.0 - zoom * 0.8);
    float spiralX = cos(spiralAngle) * spiralRadius;
    float spiralY = sin(spiralAngle) * spiralRadius;
    float spiralZ = mix(targetZ, 0.0, zoom) + random * scatter * 50.0;

    // Mix positions
    pos.x = mix(pos.x, spiralX, gate);
    pos.y = mix(pos.y, spiralY, gate);
    pos.z = mix(pos.z, spiralZ, gate);

    // Add noise
    pos.x += sin(t * 0.8 + random * 6.28) * 5.0 * scatter;
    pos.y += cos(t * 0.6 + random * 4.28) * 5.0 * scatter;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (400.0 / -mvPosition.z) * (0.8 + 0.4 * sin(t + random * 3.14));

    vColor = color;
    vAlpha = 0.5 + 0.5 * sin(t + random * 3.14) * gate;
    vDist = -mvPosition.z;
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDist;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float soft = 1.0 - smoothstep(0.0, 0.5, dist);
    float core = 1.0 - smoothstep(0.0, 0.12, dist);
    float bloom = exp(-dist * dist * 10.0) * 0.5;

    vec3 finalColor = vColor * (core + soft * 0.6 + bloom);
    float alpha = (core + soft * 0.4 + bloom) * vAlpha * 0.95;

    float depthFade = smoothstep(800.0, 100.0, vDist);
    alpha *= depthFade;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const textReveal = (el: HTMLElement, text: string, delay: number = 0) => {
  el.innerHTML = '';
  const chars = text.split('');
  chars.forEach((char, i) => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char;
    span.style.opacity = '0';
    span.style.display = 'inline-block';
    span.style.transition = 'none';
    el.appendChild(span);
  });

  const children = el.querySelectorAll('span');
  children.forEach((span, i) => {
    gsap.to(span, {
      opacity: 1,
      y: 0,
      duration: 0.04,
      delay: delay + i * 0.04,
      ease: 'power2.out',
      from: { y: 20 },
    });
  });
};

export default function OnboardingCinematicOverlay({
  isOpen,
  onClose,
  onTrialClick,
}: OnboardingCinematicOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    geometry: THREE.BufferGeometry;
    points: THREE.Points;
    animFrame: number;
    time: number;
  } | null>(null);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showGate, setShowGate] = useState(true);
  const [showLogo, setShowLogo] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const introText1Ref = useRef<HTMLDivElement>(null);
  const introText2Ref = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const finalTextRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const introGlassRef = useRef<HTMLDivElement>(null);
  const introTitleRef = useRef<HTMLDivElement>(null);
  const introSubtitleRef = useRef<HTMLDivElement>(null);
  const introBodyRef = useRef<HTMLDivElement>(null);
  const introButtonRef = useRef<HTMLButtonElement>(null);

  const initThreeScene = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return null;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const particleCount = isMobile ? 1500 : 5000;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
    camera.position.set(0, 0, 600);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);
    container.appendChild(renderer.domElement);

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const randoms = new Float32Array(particleCount);
    const angles = new Float32Array(particleCount);
    const radii = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const color = new THREE.Color(PAINTING_COLORS[Math.floor(Math.random() * PAINTING_COLORS.length)]);

      positions[i3] = (Math.random() - 0.5) * width * 1.5;
      positions[i3 + 1] = (Math.random() - 0.5) * height * 1.5;
      positions[i3 + 2] = (Math.random() - 0.5) * 400;

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 3 + 0.5;
      phases[i] = Math.random() * Math.PI * 2;
      randoms[i] = Math.random();
      angles[i] = (i / particleCount) * Math.PI * 2;
      radii[i] = 80 + Math.random() * 120;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute('radius', new THREE.BufferAttribute(radii, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uGateProgress: { value: 0 },
        uZoom: { value: 0 },
        uScatter: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const state = { scene, camera, renderer, material, geometry, points, animFrame: 0, time: 0 };
    threeRef.current = state;
    return state;
  }, []);

  const animate = useCallback(() => {
    const state = threeRef.current;
    if (!state) return;
    state.time += 0.016;
    state.material.uniforms.time.value = state.time;
    state.renderer.render(state.scene, state.camera);
    state.animFrame = requestAnimationFrame(animate);
  }, []);

  // Gate animation
  const playGateAnimation = useCallback(() => {
    const state = threeRef.current;
    if (!state) return;

    // Particles converge to form gate
    gsap.to(state.material.uniforms.uGateProgress, {
      value: 1,
      duration: 3,
      ease: 'power3.inOut',
    });

    // Camera zoom toward gate
    gsap.to(state.camera.position, {
      z: 100,
      duration: 3.5,
      ease: 'power3.inOut',
      delay: 0.5,
    });

    gsap.to(state.camera.rotation, {
      z: 0.1,
      duration: 3,
      ease: 'power2.out',
    });
  }, []);

  // Zoom through gate
  const playZoomThrough = useCallback(() => {
    const state = threeRef.current;
    if (!state) return;

    gsap.to(state.material.uniforms.uZoom, {
      value: 1,
      duration: 2,
      ease: 'power2.inOut',
    });

    gsap.to(state.camera.position, {
      z: 0,
      duration: 2,
      ease: 'power2.inOut',
    });
  }, []);

  // Particle scatter effect on selection
  const playSelectionEffect = useCallback(() => {
    const state = threeRef.current;
    if (!state) return;

    gsap.fromTo(state.material.uniforms.uScatter,
      { value: 1 },
      { value: 0, duration: 0.5, ease: 'power2.out' }
    );
    gsap.to(state.material.uniforms.uScatter, {
      value: 1,
      duration: 1,
      ease: 'power2.out',
      delay: 0.5,
    });
  }, []);

  // Final convergence
  const playConvergence = useCallback(() => {
    const state = threeRef.current;
    if (!state) return;

    gsap.to(state.material.uniforms.uScatter, {
      value: 0,
      duration: 2,
      ease: 'power3.inOut',
    });

    gsap.to(state.material.uniforms.uGateProgress, {
      value: 0,
      duration: 2,
      ease: 'power3.inOut',
    });

    gsap.to(state.camera.position, {
      z: 200,
      duration: 2,
      ease: 'power3.inOut',
    });
  }, []);

  const handleContinue = useCallback(() => {
    setShowIntro(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animFrame);
        threeRef.current.renderer.dispose();
        threeRef.current.geometry.dispose();
        threeRef.current.material.dispose();
        if (canvasContainerRef.current) {
          canvasContainerRef.current.innerHTML = '';
        }
      }
      document.body.style.overflow = '';
      setShowIntro(false);
      setShowGate(false);
      setStep(0);
      setAnswers([]);
      setShowLogo(false);
      setShowFinal(false);
      return;
    }

    document.body.style.overflow = 'hidden';
    setShowIntro(true);
    setShowGate(true);
    const state = initThreeScene();
    if (!state) return;
    animate();

    setTimeout(() => playGateAnimation(), 500);

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      state.camera.aspect = w / h;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      cancelAnimationFrame(state.animFrame);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, initThreeScene, animate, onClose, playGateAnimation]);

  // Intro screen animation
  useEffect(() => {
    if (!showIntro) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(introGlassRef.current,
        { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
        { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out', delay: 0.2 }
      );
      gsap.fromTo(introTitleRef.current,
        { opacity: 0, y: 20, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out', delay: 0.4 }
      );
      gsap.fromTo(introSubtitleRef.current,
        { opacity: 0, y: 15, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', delay: 0.7 }
      );
      gsap.fromTo(introBodyRef.current,
        { opacity: 0, y: 15, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', delay: 1.0 }
      );
      gsap.fromTo(introButtonRef.current,
        { opacity: 0, y: 15, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', delay: 1.3 }
      );
    });
    return () => ctx.revert();
  }, [showIntro]);

  // Step flow orchestration
  useEffect(() => {
    if (!isOpen || showIntro) return;

    const runSequence = async () => {
      // Step 0: Gate formation
      setShowGate(true);
      setStep(0);
      await new Promise(r => setTimeout(r, 500));
      playGateAnimation();
      await new Promise(r => setTimeout(r, 3500));

      // Step 1: Intro text 1
      if (introText1Ref.current) {
        textReveal(introText1Ref.current, '진짜 나를 찾기 위한 여정을 시작합니다', 0);
      }
      await new Promise(r => setTimeout(r, 2500));

      // Step 2: Intro text 2
      if (introText2Ref.current) {
        gsap.to(introText1Ref.current, { opacity: 0, duration: 0.8, delay: 0.2 });
        await new Promise(r => setTimeout(r, 1000));
        textReveal(introText2Ref.current, '당신은 지금 누구를 이해하고 싶습니까?', 0);
      }
      await new Promise(r => setTimeout(r, 2500));

      // Zoom through gate
      playZoomThrough();
      await new Promise(r => setTimeout(r, 2000));
      setShowGate(false);

      // Step 3: Question 1
      setStep(1);
      await new Promise(r => setTimeout(r, 500));
      if (questionRef.current && optionsRef.current) {
        gsap.fromTo(questionRef.current,
          { y: 40, opacity: 0, filter: 'blur(10px)' },
          { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }
        );
        gsap.fromTo(optionsRef.current.children,
          { y: 30, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.4 }
        );
      }
    };

    runSequence();
  }, [isOpen, showIntro, playGateAnimation, playZoomThrough]);

  const handleOptionSelect = useCallback((optionIndex: number) => {
    const newAnswers = [...answers, optionIndex];
    setAnswers(newAnswers);
    playSelectionEffect();

    if (newAnswers.length < QUESTIONS.length) {
      // Next question
      if (questionRef.current && optionsRef.current) {
        gsap.to(questionRef.current, { opacity: 0, y: -30, duration: 0.6, ease: 'power2.in' });
        gsap.to(optionsRef.current.children, {
          opacity: 0, y: -20, duration: 0.4, stagger: 0.05, ease: 'power2.in',
          onComplete: () => {
            setStep(newAnswers.length + 1);
            setTimeout(() => {
              if (questionRef.current && optionsRef.current) {
                gsap.fromTo(questionRef.current,
                  { y: 40, opacity: 0, filter: 'blur(10px)' },
                  { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }
                );
                gsap.fromTo(optionsRef.current.children,
                  { y: 30, opacity: 0, scale: 0.95 },
                  { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.4 }
                );
              }
            }, 300);
          },
        });
      }
    } else {
      // Save answers to localStorage for report generation
      const answerTexts = newAnswers.map((idx, i) => QUESTIONS[i]?.options[idx] || '');
      try {
        localStorage.setItem('echo_onboarding_answers', JSON.stringify(answerTexts));
      } catch { /* ignore */ }

      // Final sequence
      if (questionRef.current && optionsRef.current) {
        gsap.to(questionRef.current, { opacity: 0, y: -30, duration: 0.6, ease: 'power2.in' });
        gsap.to(optionsRef.current.children, {
          opacity: 0, y: -20, duration: 0.4, stagger: 0.05, ease: 'power2.in',
          onComplete: () => {
            playConvergence();
            setTimeout(() => {
              setShowLogo(true);
              if (logoRef.current) {
                gsap.fromTo(logoRef.current,
                  { scale: 0.3, opacity: 0 },
                  { scale: 1, opacity: 1, duration: 2.0, ease: 'power3.out' }
                );
              }
            }, 1500);

            setTimeout(() => {
              setShowFinal(true);
              if (finalTextRef.current) {
                const lines = finalTextRef.current.querySelectorAll('.final-line');
                lines.forEach((line, i) => {
                  gsap.fromTo(line,
                    { y: 30, opacity: 0 },
                    { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out', delay: i * 0.8 }
                  );
                });
              }
            }, 3500);

            setTimeout(() => {
              if (taglineRef.current) {
                gsap.fromTo(taglineRef.current,
                  { y: 20, opacity: 0 },
                  { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out' }
                );
              }
            }, 7000);
          },
        });
      }
    }
  }, [answers, playSelectionEffect, playConvergence]);

  if (!isOpen) return null;

  const currentQuestion = QUESTIONS[step - 1];

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-hidden">
      {/* Three.js Canvas */}
      <div ref={canvasContainerRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 1 }} />

      {/* Vignette */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2, background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.8) 100%)' }} />

      {/* Content Overlay */}
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/50 hover:text-white/90 hover:bg-white/10 transition-all duration-300 cursor-pointer"
        >
          <i className="ri-close-line text-lg" />
        </button>

        {/* Intro Screen */}
        {showIntro && (
          <div className="absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
            <div
              ref={introGlassRef}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-48px)] max-w-[420px] text-center pointer-events-auto"
              style={{
                background: 'rgba(0, 0, 0, 0.42)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '28px',
                padding: '32px 22px',
                boxShadow: '0 0 60px rgba(255,255,255,0.08)',
                opacity: 0,
              }}
            >
              <div
                ref={introTitleRef}
                className="font-display font-extrabold"
                style={{
                  fontSize: 'clamp(34px, 9vw, 56px)',
                  color: '#ffffff',
                  letterSpacing: '-0.04em',
                  lineHeight: 1.05,
                  textShadow: '0 0 40px rgba(255,255,255,0.12)',
                  opacity: 0,
                }}
              >
                ECHO PROTOCOL
              </div>
              <div
                ref={introSubtitleRef}
                style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.82)',
                  letterSpacing: '0.08em',
                  marginTop: '16px',
                  opacity: 0,
                }}
              >
                호기심에서 시작되는 자기 이해.
              </div>
              <div
                ref={introBodyRef}
                style={{
                  fontSize: '15px',
                  lineHeight: 1.75,
                  color: 'rgba(255,255,255,0.78)',
                  marginTop: '22px',
                  opacity: 0,
                }}
              >
                누구나 들어올 수 있는 Human Relationship OS.
                <br />
                당신의 감정, 행동, 선택은
                <br />
                하나의 흐름으로 연결됩니다.
                <br />
                ECHO는 그 흐름을 따라
                <br />
                진짜 나를 더 선명하게 비춥니다.
              </div>
              <button
                ref={introButtonRef}
                onClick={handleContinue}
                className="w-full font-bold text-sm tracking-wide cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  marginTop: '28px',
                  height: '56px',
                  borderRadius: '999px',
                  background: '#ffffff',
                  color: '#000000',
                  fontWeight: 700,
                  opacity: 0,
                }}
              >
                계속하기
              </button>
            </div>
          </div>
        )}

        {/* Intro Phase */}
        {showGate && step === 0 && (
          <div className="text-center px-6">
            <div
              ref={introText1Ref}
              className="font-display font-bold tracking-tight leading-tight mb-8"
              style={{ fontSize: 'clamp(1.5rem, 4vw, 2.8rem)', color: '#FFFFFF' }}
            />
            <div
              ref={introText2Ref}
              className="font-display font-medium tracking-tight leading-relaxed"
              style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', color: 'rgba(255,255,255,0.7)' }}
            />
          </div>
        )}

        {/* Question Phase */}
        {step >= 1 && step <= 3 && currentQuestion && (
          <div className="text-center px-6 max-w-xl w-full">
            <div
              ref={questionRef}
              className="font-display font-bold tracking-tight leading-tight mb-10"
              style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)', color: '#FFFFFF' }}
            >
              {currentQuestion.question}
            </div>
            <div ref={optionsRef} className="flex flex-col gap-3">
              {currentQuestion.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleOptionSelect(i)}
                  className="group relative px-6 py-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-500 cursor-pointer text-left overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${PAINTING_COLORS[i * 3 % PAINTING_COLORS.length]}10, transparent)` }} />
                  <div className="relative flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border border-white/20 group-hover:border-white/40 transition-colors duration-300" style={{ color: PAINTING_COLORS[i * 3 % PAINTING_COLORS.length] }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-sm font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {option}
                    </span>
                    <i className="ri-arrow-right-line ml-auto text-white/20 group-hover:text-white/60 transition-colors duration-300 text-sm" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Logo Phase */}
        {showLogo && (
          <div className="text-center px-6">
            <div
              ref={logoRef}
              className="font-display font-bold tracking-[0.2em]"
              style={{
                fontSize: 'clamp(4rem, 12vw, 10rem)',
                background: 'linear-gradient(135deg, #FF6B9D, #FF8C69, #9B59B6, #FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 60px rgba(255,107,157,0.5))',
                opacity: 0,
              }}
            >
              ECHO
            </div>
          </div>
        )}

        {/* Final Text Phase */}
        {showFinal && (
          <div className="text-center px-6 max-w-lg">
            <div ref={finalTextRef} className="mb-8">
              <div className="final-line font-display font-medium leading-relaxed mb-3" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', color: 'rgba(255,255,255,0.6)', opacity: 0 }}>
                "호기심에서 시작되는 자기 이해."
              </div>
              <div className="final-line font-display font-medium leading-relaxed mb-3" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', color: 'rgba(255,255,255,0.6)', opacity: 0 }}>
                "당신의 감정, 행동, 선택은"
              </div>
              <div className="final-line font-display font-medium leading-relaxed mb-3" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', color: 'rgba(255,255,255,0.6)', opacity: 0 }}>
                "하나의 흐름으로 연결됩니다."
              </div>
              <div className="final-line font-display font-medium leading-relaxed mb-6" style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', color: 'rgba(255,255,255,0.6)', opacity: 0 }}>
                "ECHO는 그 흐름 속에서 진짜 나를 비춥니다."
              </div>
            </div>
            <div
              ref={taglineRef}
              className="font-display font-bold tracking-[0.15em]"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                color: '#FFD700',
                opacity: 0,
                textShadow: '0 0 40px rgba(255,215,0,0.3)',
              }}
            >
              "진짜 나를 찾아줘"
            </div>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ opacity: showFinal ? 1 : 0 }}>
              <MagneticButton
                onClick={() => {
                  onClose();
                  setTimeout(onTrialClick, 500);
                }}
                variant="primary"
                size="md"
              >
                ECHO 시작하기
                <i className="ri-arrow-right-line text-xs" />
              </MagneticButton>
              <button
                onClick={onClose}
                className="px-8 py-4 rounded-full text-sm font-medium tracking-wide transition-all duration-300 border border-white/20 text-white/50 hover:text-white/80 hover:border-white/40 whitespace-nowrap cursor-pointer"
              >
                돌아가기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}