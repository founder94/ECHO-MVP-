import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

const PARTICLE_COLORS = [
  new THREE.Color('#FF6B9D'),
  new THREE.Color('#FF8FAB'),
  new THREE.Color('#FF7F50'),
  new THREE.Color('#FF8C69'),
  new THREE.Color('#9B59B6'),
  new THREE.Color('#8E44AD'),
  new THREE.Color('#FFD700'),
  new THREE.Color('#D4AF37'),
  new THREE.Color('#2B3E8C'),
  new THREE.Color('#FFFFFF'),
  new THREE.Color('#F8F8F8'),
];

const vertexShader = `
  attribute float size;
  attribute vec3 color;
  attribute float phase;
  attribute float random;
  attribute vec3 originalPos;
  uniform float time;
  uniform float uSpeed;
  uniform vec3 uSuctionPos;
  uniform float uSuctionStrength;
  uniform float uSpread;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = originalPos;
    float t = time * uSpeed;

    pos.x += sin(t * 2.0 + phase * 6.28) * 80.0 * uSpread;
    pos.y += cos(t * 1.5 + phase * 4.28) * 60.0 * uSpread;
    pos.z += sin(t * 0.8 + originalPos.x * 0.02) * 40.0;

    if (uSuctionStrength > 0.0) {
      vec3 dir = uSuctionPos - pos;
      float dist = length(dir);
      float pull = uSuctionStrength * smoothstep(300.0, 0.0, dist);
      pos += normalize(dir) * pull * 150.0;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * (400.0 / -mvPosition.z) * (0.8 + 0.4 * sin(t * 3.0 + phase * 3.14));
    vColor = color;
    vAlpha = 0.5 + 0.5 * sin(t * 3.0 + phase * 3.14);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    float soft = 1.0 - smoothstep(0.0, 0.5, dist);
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float bloom = exp(-dist * dist * 8.0) * 0.5;
    vec3 finalColor = vColor * (core + soft * 0.5 + bloom);
    float alpha = (core + soft * 0.3 + bloom) * vAlpha * 0.9;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export interface ApproachParticlesRef {
  triggerSuction: (x: number, y: number) => void;
  zoomToStep: (step: number) => void;
}

const ApproachParticles = forwardRef<ApproachParticlesRef, { isActive: boolean }>(function ApproachParticles({ isActive }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    animFrame: number;
    time: number;
    suctionStrength: number;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    triggerSuction: (x: number, y: number) => {
      const state = stateRef.current;
      if (!state) return;
      const vector = new THREE.Vector3(
        (x / window.innerWidth) * 2 - 1,
        -(y / window.innerHeight) * 2 + 1,
        0.5,
      );
      vector.unproject(state.camera);
      const dir = vector.sub(state.camera.position).normalize();
      const dist = -state.camera.position.z / dir.z;
      const pos = state.camera.position.clone().add(dir.multiplyScalar(dist));
      state.material.uniforms.uSuctionPos.value = pos;
      state.suctionStrength = 1.0;
    },
    zoomToStep: (step: number) => {
      const state = stateRef.current;
      if (!state) return;
      const targetZ = 500 - step * 70;
      const targetX = Math.sin(step * 1.5) * 40;
      const targetY = Math.cos(step * 1.2) * 30;
      gsap.to(state.camera.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.8,
        ease: 'power3.inOut',
      });
    },
  }));

  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const particleCount = isMobile ? 2000 : 6000;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
    camera.position.set(0, 0, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);
    container.appendChild(renderer.domElement);

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const originalPositions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const randoms = new Float32Array(particleCount);
    const spreadX = width * 0.8;
    const spreadY = height * 0.8;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
      const ox = (Math.random() - 0.5) * spreadX;
      const oy = (Math.random() - 0.5) * spreadY;
      const oz = (Math.random() - 0.5) * 600;
      positions[i3] = ox;
      positions[i3 + 1] = oy;
      positions[i3 + 2] = oz;
      originalPositions[i3] = ox;
      originalPositions[i3 + 1] = oy;
      originalPositions[i3 + 2] = oz;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      sizes[i] = Math.random() * 4 + 1;
      phases[i] = Math.random() * Math.PI * 2;
      randoms[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('originalPos', new THREE.BufferAttribute(originalPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uSpeed: { value: 3.0 },
        uSuctionPos: { value: new THREE.Vector3(0, 0, 0) },
        uSuctionStrength: { value: 0 },
        uSpread: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const state = {
      scene, camera, renderer, material,
      animFrame: 0, time: 0, suctionStrength: 0,
    };
    stateRef.current = state;

    const animate = () => {
      state.time += 0.016;
      state.material.uniforms.time.value = state.time;

      if (state.suctionStrength > 0) {
        state.suctionStrength -= 0.02;
        if (state.suctionStrength < 0) state.suctionStrength = 0;
        state.material.uniforms.uSuctionStrength.value = state.suctionStrength;
      }

      renderer.render(scene, camera);
      state.animFrame = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(state.animFrame);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container.innerHTML = '';
    };
  }, [isActive]);

  return <div ref={containerRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 1 }} />;
});

export default ApproachParticles;