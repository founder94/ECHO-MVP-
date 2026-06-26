import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface AuthCanvasProps {
  phase: string;
  mousePos: { x: number; y: number };
}

const COLORS = [
  new THREE.Color('#FF6B9D'), new THREE.Color('#FF8C69'), new THREE.Color('#D4C4E0'),
  new THREE.Color('#9B59B6'), new THREE.Color('#E74C3C'), new THREE.Color('#FFB347'),
  new THREE.Color('#FFD700'), new THREE.Color('#FFFFFF'), new THREE.Color('#C0C0C0'),
];

export default function AuthCanvas({ phase, mousePos }: AuthCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points;
    portalGroup: THREE.Group;
    portalTorus: THREE.Mesh;
    ringLayers: THREE.Mesh[];
    particlePositions: Float32Array;
    particleColors: Float32Array;
    particleTargets: Float32Array;
    targetGateProgress: number;
    currentGateProgress: number;
    targetConverge: number;
    currentConverge: number;
    time: number;
    animFrame: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const particleCount = isMobile ? 1200 : 2500;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.00008);

    // Camera
    const camera = new THREE.PerspectiveCamera(55, width / height, 1, 2000);
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);
    container.appendChild(renderer.domElement);

    // Portal group
    const portalGroup = new THREE.Group();

    // Main portal torus
    const torusGeom = new THREE.TorusGeometry(85, 2.5, 32, 128);
    const torusMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalTorus = new THREE.Mesh(torusGeom, torusMat);
    portalGroup.add(portalTorus);

    // Inner glow ring
    const innerTorusGeom = new THREE.TorusGeometry(85, 8, 16, 128);
    const innerTorusMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerGlow = new THREE.Mesh(innerTorusGeom, innerTorusMat);
    portalGroup.add(innerGlow);

    // Ring layers for depth
    const ringLayers: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ringGeom = new THREE.RingGeometry(75 - i * 12, 85 - i * 12, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.06 - i * 0.015,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.z = -i * 10;
      portalGroup.add(ring);
      ringLayers.push(ring);
    }

    // Outer accent rings
    for (let i = 0; i < 2; i++) {
      const accRingGeom = new THREE.TorusGeometry(105 + i * 20, 0.8, 16, 96);
      const accentColor = COLORS[(i * 3 + 2) % COLORS.length];
      const accRingMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.15 - i * 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const accRing = new THREE.Mesh(accRingGeom, accRingMat);
      accRing.rotation.x = Math.PI / 2;
      portalGroup.add(accRing);
    }

    scene.add(portalGroup);

    // Particles
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const targets = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const colorIdx = Math.floor(Math.random() * COLORS.length);
      const col = COLORS[colorIdx];

      // Initial scattered positions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const r = 150 + Math.random() * 400;

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi) - 100;
      targets[i3] = positions[i3];
      targets[i3 + 1] = positions[i3 + 1];
      targets[i3 + 2] = positions[i3 + 2];
      colors[i3] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;
      sizes[i] = Math.random() * 2.5 + 0.5;
    }

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create circular glow texture
    const glowSize = 32;
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowSize;
    glowCanvas.height = glowSize;
    const ctx = glowCanvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(glowSize / 2, glowSize / 2, 0, glowSize / 2, glowSize / 2, glowSize / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, glowSize, glowSize);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    const particleMat = new THREE.PointsMaterial({
      size: 3.5,
      map: glowTexture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    });

    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // Ambient starlight particles in background
    const bgStarCount = 400;
    const bgStarPositions = new Float32Array(bgStarCount * 3);
    for (let i = 0; i < bgStarCount; i++) {
      const i3 = i * 3;
      bgStarPositions[i3] = (Math.random() - 0.5) * 1000;
      bgStarPositions[i3 + 1] = (Math.random() - 0.5) * 600;
      bgStarPositions[i3 + 2] = -100 - Math.random() * 500;
    }
    const bgStarGeom = new THREE.BufferGeometry();
    bgStarGeom.setAttribute('position', new THREE.BufferAttribute(bgStarPositions, 3));
    const bgStarMat = new THREE.PointsMaterial({
      size: 1.2,
      map: glowTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.3,
    });
    const bgStars = new THREE.Points(bgStarGeom, bgStarMat);
    scene.add(bgStars);

    const state = {
      scene,
      camera,
      renderer,
      particles,
      portalGroup,
      portalTorus,
      ringLayers,
      particlePositions: positions,
      particleColors: colors,
      particleTargets: targets,
      targetGateProgress: 0,
      currentGateProgress: 0,
      targetConverge: 0,
      currentConverge: 0,
      time: 0,
      animFrame: 0,
      width,
      height,
    };
    stateRef.current = state;

    // Animation loop
    const animate = () => {
      const s = stateRef.current;
      if (!s) return;

      s.time += 0.016;
      const t = s.time;

      // Smooth interpolation
      s.currentGateProgress += (s.targetGateProgress - s.currentGateProgress) * 0.06;
      s.currentConverge += (s.targetConverge - s.currentConverge) * 0.08;

      const gate = s.currentGateProgress;
      const converge = s.currentConverge;

      // Camera movement
      const baseZ = 500 - gate * 320;
      const targetLookX = mousePos.x * 25;
      const targetLookY = -mousePos.y * 20;
      s.camera.position.z += (baseZ - s.camera.position.z) * 0.1;
      s.camera.position.x += (targetLookX * 0.3 - s.camera.position.x) * 0.08;
      s.camera.position.y += (targetLookY * 0.3 - s.camera.position.y) * 0.08;
      s.camera.lookAt(
        targetLookX * 0.5,
        targetLookY * 0.5,
        -converge * 100,
      );

      // Portal animation
      s.portalGroup.rotation.z += 0.003 + gate * 0.007;
      s.portalGroup.rotation.x = Math.sin(t * 0.2) * 0.04;
      s.portalTorus.scale.setScalar(1 + Math.sin(t * 1.5) * 0.03);
      s.portalGroup.visible = gate > 0.15;

      // Portal torus opacity
      const torusMat = s.portalTorus.material as THREE.MeshBasicMaterial;
      torusMat.opacity = gate * 0.4;
      torusMat.color.setHSL(
        (t * 0.03) % 1,
        0.1,
        0.5 + gate * 0.5,
      );

      // Ring layer opacity
      s.ringLayers.forEach((ring, i) => {
        const ringMat = ring.material as THREE.MeshBasicMaterial;
        ringMat.opacity = gate * (0.06 - i * 0.015);
        ring.rotation.z += 0.002 * (i + 1);
        ring.position.z = -i * 10 - converge * 5;
      });

      // Particle update
      const posArr = s.particlePositions;
      const targetArr = s.particleTargets;
      const count = posArr.length / 3;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const tx = targetArr[i3];
        const ty = targetArr[i3 + 1];
        const tz = targetArr[i3 + 2];

        // Lerp toward target
        posArr[i3] += (tx - posArr[i3]) * 0.06;
        posArr[i3 + 1] += (ty - posArr[i3 + 1]) * 0.06;
        posArr[i3 + 2] += (tz - posArr[i3 + 2]) * 0.06;

        // Add gentle floating
        posArr[i3 + 1] += Math.sin(t * 0.8 + i * 0.3) * 0.06;
      }
      s.particles.geometry.attributes.position.needsUpdate = true;

      // Background stars twinkle
      bgStars.rotation.y += 0.0002;

      s.renderer.render(s.scene, s.camera);
      s.animFrame = requestAnimationFrame(animate);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      state.width = w;
      state.height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(state.animFrame);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      torusGeom.dispose();
      torusMat.dispose();
      glowTexture.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update particle targets based on phase
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    const count = s.particleTargets.length / 3;
    const targets = s.particleTargets;

    switch (phase) {
      case 'entry': {
        s.targetGateProgress = 0;
        s.targetConverge = 0;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const r = 150 + Math.random() * 400;
          targets[i3] = r * Math.sin(phi) * Math.cos(theta);
          targets[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          targets[i3 + 2] = r * Math.cos(phi) - 100;
        }
        break;
      }
      case 'portal_forming': {
        s.targetGateProgress = 1;
        s.targetConverge = 0;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const angle = Math.random() * Math.PI * 2;
          const radius = 70 + Math.random() * 30;
          const ringDist = (Math.random() - 0.5) * 40;
          targets[i3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 20;
          targets[i3 + 1] = Math.sin(angle) * radius + (Math.random() - 0.5) * 20;
          targets[i3 + 2] = ringDist + (Math.random() - 0.5) * 20;
        }
        break;
      }
      case 'portal_active': {
        s.targetGateProgress = 1;
        s.targetConverge = 0;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const angle = Math.random() * Math.PI * 2;
          const radius = 75 + Math.random() * 25;
          targets[i3] = Math.cos(angle) * radius + Math.sin(s.time * 0.5 + i) * 8;
          targets[i3 + 1] = Math.sin(angle) * radius + Math.cos(s.time * 0.4 + i) * 8;
          targets[i3 + 2] = (Math.random() - 0.5) * 35 + Math.sin(s.time * 0.3 + i * 0.7) * 5;
        }
        break;
      }
      case 'selection': {
        s.targetGateProgress = 1;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const angle = Math.random() * Math.PI * 2;
          const radius = 60 + Math.random() * 50;
          targets[i3] = Math.cos(angle) * radius;
          targets[i3 + 1] = Math.sin(angle) * radius;
          targets[i3 + 2] = (Math.random() - 0.5) * 80;
        }
        // Brief scatter then reform
        setTimeout(() => {
          const s2 = stateRef.current;
          if (!s2) return;
          if (phase === 'selection') {
            s2.targetGateProgress = 1;
            s2.targetConverge = 0;
            for (let i = 0; i < count; i++) {
              const i3 = i * 3;
              const angle = Math.random() * Math.PI * 2;
              const radius = 75 + Math.random() * 25;
              targets[i3] = Math.cos(angle) * radius;
              targets[i3 + 1] = Math.sin(angle) * radius;
              targets[i3 + 2] = (Math.random() - 0.5) * 35;
            }
          }
        }, 300);
        break;
      }
      case 'form': {
        s.targetGateProgress = 1;
        s.targetConverge = 0.15;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const angle = Math.random() * Math.PI * 2;
          const radius = 70 + Math.random() * 20;
          targets[i3] = Math.cos(angle) * radius;
          targets[i3 + 1] = Math.sin(angle) * radius;
          targets[i3 + 2] = (Math.random() - 0.5) * 30;
        }
        break;
      }
      case 'converge': {
        s.targetGateProgress = 0.3;
        s.targetConverge = 1;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          targets[i3] = (Math.random() - 0.5) * 8;
          targets[i3 + 1] = (Math.random() - 0.5) * 8;
          targets[i3 + 2] = (Math.random() - 0.5) * 5;
        }
        break;
      }
      case 'mirror': {
        s.targetGateProgress = 0;
        s.targetConverge = 1;
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          const onSurface = Math.random() < 0.7;
          if (onSurface) {
            targets[i3] = (Math.random() - 0.5) * 50;
            targets[i3 + 1] = (Math.random() - 0.5) * 60;
            targets[i3 + 2] = (Math.random() - 0.5) * 3;
          } else {
            targets[i3] = (Math.random() - 0.5) * 120;
            targets[i3 + 1] = (Math.random() - 0.5) * 120;
            targets[i3 + 2] = (Math.random() - 0.5) * 30;
          }
        }
        break;
      }
      default:
        break;
    }
  }, [phase]);

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />
  );
}