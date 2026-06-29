import { Link } from 'react-router-dom';
import { useRef, useLayoutEffect, useEffect } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import MagneticButton from '@/components/base/MagneticButton';

interface HeroProps {
  isDarkMode: boolean;
  onTrialClick?: () => void;
  musicPlaying?: boolean;
  onMusicToggle?: () => void;
}

const TUNNEL_RADIUS = 16;
const SEGMENT_DEPTH = 6;
const NUM_SEGMENTS = 22;
const RING_SECTORS = 16;
const PANEL_GRID_ANGULAR = 12;
const PANEL_GRID_DEPTH = 14;
const PIXEL_FILL_CHANCE = 0.78;
const PANEL_SPAWN_CHANCE = 0.55;

const MAX_TRAVEL = SEGMENT_DEPTH * NUM_SEGMENTS * 1.2;
const MAX_RECYCLES_PER_FRAME = 2;

let pixelTextureCache: THREE.Texture | null = null;
const getPixelTexture = (): THREE.Texture => {
  if (pixelTextureCache) return pixelTextureCache;
  const size = 16;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(1, 1, size - 2, size - 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  pixelTextureCache = tex;
  return tex;
};

const randomShade = (isDarkMode: boolean): number[] => {
  if (isDarkMode) {
    const bright = 0.7 + Math.random() * 0.3;
    return [bright, bright, bright];
  }
  const r = Math.random();
  if (r < 0.08) return [0.02 + Math.random() * 0.06, 0.02 + Math.random() * 0.06, 0.02 + Math.random() * 0.06];
  if (r < 0.25) return [0.1 + Math.random() * 0.15, 0.1 + Math.random() * 0.15, 0.1 + Math.random() * 0.15];
  return [0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.3, 0.3 + Math.random() * 0.3];
};

const createMosaicPanel = (
  radius: number,
  sectorIndex: number,
  sectorCount: number,
  depth: number,
  isDarkMode: boolean,
) => {
  const arcAngle = (Math.PI * 2) / sectorCount;
  const startAngle = sectorIndex * arcAngle;
  const angleMargin = arcAngle * 0.04;
  const depthMargin = depth * 0.04;

  const a0 = startAngle + angleMargin;
  const a1 = startAngle + arcAngle - angleMargin;
  const z0 = depthMargin;
  const z1 = depth - depthMargin;

  const cells: number[] = [];
  const cellColors: number[] = [];

  for (let ix = 0; ix < PANEL_GRID_ANGULAR; ix++) {
    for (let iz = 0; iz < PANEL_GRID_DEPTH; iz++) {
      if (Math.random() > PIXEL_FILL_CHANCE) continue;
      const tA = (ix + 0.5) / PANEL_GRID_ANGULAR;
      const tZ = (iz + 0.5) / PANEL_GRID_DEPTH;
      const angle = a0 + (a1 - a0) * tA;
      const z = -(z0 + (z1 - z0) * tZ);
      cells.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);

      const shade = randomShade(isDarkMode);
      cellColors.push(shade[0], shade[1], shade[2]);
    }
  }

  const positions = new Float32Array(cells);
  const colors = new Float32Array(cellColors);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.55,
    map: getPixelTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
    alphaTest: 0.5,
  });

  const points = new THREE.Points(geom, mat);
  points.name = 'mosaic_panel';
  gsap.to(mat, { opacity: 1, duration: 0.8, ease: 'power2.out' });
  return points;
};

const createRingWireframe = (radius: number, depth: number, isDarkMode: boolean) => {
  const positions: number[] = [];
  const segments = 64;

  for (let ring = 0; ring < 2; ring++) {
    const z = ring === 0 ? 0 : -depth;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      positions.push(Math.cos(a0) * radius, Math.sin(a0) * radius, z);
      positions.push(Math.cos(a1) * radius, Math.sin(a1) * radius, z);
    }
  }

  for (let i = 0; i < RING_SECTORS; i++) {
    const angle = (i / RING_SECTORS) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    positions.push(x, y, 0);
    positions.push(x, y, -depth);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const ringColor = isDarkMode ? 0xD4D4D4 : 0x3D3D3D;
  const mat = new THREE.LineBasicMaterial({
    color: ringColor,
    transparent: true,
    opacity: isDarkMode ? 0.55 : 0.5,
  });
  return new THREE.LineSegments(geom, mat);
};

const populatePanels = (group: THREE.Group, isDarkMode: boolean) => {
  for (let i = 0; i < RING_SECTORS; i++) {
    if (Math.random() < PANEL_SPAWN_CHANCE) {
      const panel = createMosaicPanel(
        TUNNEL_RADIUS - 0.05,
        i,
        RING_SECTORS,
        SEGMENT_DEPTH,
        isDarkMode,
      );
      group.add(panel);
    }
  }
};

const recolorPanels = (group: THREE.Group, isDarkMode: boolean) => {
  group.children.forEach((child) => {
    if (child instanceof THREE.Points && child.name === 'mosaic_panel') {
      const colorAttr = child.geometry.getAttribute('color') as THREE.BufferAttribute;
      const count = colorAttr.count;
      for (let i = 0; i < count; i++) {
        const shade = randomShade(isDarkMode);
        colorAttr.setXYZ(i, shade[0], shade[1], shade[2]);
      }
      colorAttr.needsUpdate = true;
    }
  });
};

const createSegment = (zPos: number, isDarkMode: boolean) => {
  const group = new THREE.Group();
  group.position.z = zPos;
  group.add(createRingWireframe(TUNNEL_RADIUS, SEGMENT_DEPTH, isDarkMode));
  populatePanels(group, isDarkMode);
  return group;
};

const Hero = ({ isDarkMode, onTrialClick }: HeroProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const segmentsRef = useRef<THREE.Group[]>([]);
  const isDarkModeRef = useRef(isDarkMode);

  const targetZRef = useRef(0);
  const currentZRef = useRef(0);
  const scrollProgressRef = useRef(0);
  const flickerAccumRef = useRef(0);
  const startTimeRef = useRef(performance.now());
  const autoDriftRef = useRef(0);

  useEffect(() => {
    isDarkModeRef.current = isDarkMode;
  }, [isDarkMode]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0a, SEGMENT_DEPTH * 4, SEGMENT_DEPTH * NUM_SEGMENTS * 0.75);
    sceneRef.current = scene;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const camera = new THREE.PerspectiveCamera(78, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    const segments: THREE.Group[] = [];
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      const z = -i * SEGMENT_DEPTH;
      const segment = createSegment(z, isDarkModeRef.current);
      segment.rotation.z = (i * Math.PI) / RING_SECTORS;
      scene.add(segment);
      segments.push(segment);
    }
    segmentsRef.current = segments;

    const findSection = (): HTMLElement | null => {
      let el: HTMLElement | null = containerRef.current;
      while (el) {
        if (el.tagName === 'SECTION') return el;
        el = el.parentElement;
      }
      return null;
    };
    const sectionEl = findSection();

    let scrollRafPending = false;
    const computeScroll = () => {
      scrollRafPending = false;
      let progress = 0;
      if (sectionEl) {
        const rect = sectionEl.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const totalScrollable = sectionEl.offsetHeight - viewportH;
        const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(totalScrollable, 1));
        progress = totalScrollable > 0 ? scrolled / totalScrollable : 0;
      } else {
        progress = Math.min(window.scrollY / 1200, 1);
      }
      scrollProgressRef.current = progress;
      const eased = progress * progress * (3 - 2 * progress);
      targetZRef.current = -eased * MAX_TRAVEL;
    };
    const updateScroll = () => {
      if (scrollRafPending) return;
      scrollRafPending = true;
      requestAnimationFrame(computeScroll);
    };
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    computeScroll();

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const cam = cameraRef.current;
      const scn = sceneRef.current;
      const rndr = rendererRef.current;
      if (!cam || !scn || !rndr) return;

      const elapsed = performance.now() - startTimeRef.current;
      if (elapsed < 1000 && scrollProgressRef.current < 0.02) {
        autoDriftRef.current = -(elapsed / 1000) * 8;
      } else {
        autoDriftRef.current = 0;
      }

      currentZRef.current += (targetZRef.current + autoDriftRef.current - currentZRef.current) * 0.24;
      cam.position.z = currentZRef.current;

      const progress = scrollProgressRef.current;
      cam.rotation.z = progress * Math.PI * 0.6;

      cam.position.x = Math.sin(progress * 6) * 0.15 * progress;
      cam.position.y = Math.cos(progress * 6) * 0.15 * progress;

      const camZ = cam.position.z;
      const dark = isDarkModeRef.current;

      const forwardLimit = SEGMENT_DEPTH * NUM_SEGMENTS;
      const segs = segmentsRef.current;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < segs.length; i++) {
        const z = segs[i].position.z;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }

      let recyclesLeft = MAX_RECYCLES_PER_FRAME;
      for (let i = 0; i < segs.length && recyclesLeft > 0; i++) {
        const segment = segs[i];
        const relZ = segment.position.z - camZ;

        if (relZ > SEGMENT_DEPTH) {
          minZ = minZ - SEGMENT_DEPTH;
          segment.position.z = minZ;
          segment.rotation.z += Math.PI / RING_SECTORS;
          recolorPanels(segment, dark);
          recyclesLeft--;
        } else if (relZ < -forwardLimit) {
          maxZ = maxZ + SEGMENT_DEPTH;
          segment.position.z = maxZ;
          segment.rotation.z -= Math.PI / RING_SECTORS;
          recolorPanels(segment, dark);
          recyclesLeft--;
        }
      }

      flickerAccumRef.current += 1;
      if (flickerAccumRef.current >= 3) {
        flickerAccumRef.current = 0;
        segmentsRef.current.forEach((segment) => {
          segment.children.forEach((child) => {
            if (child instanceof THREE.Points && child.name === 'mosaic_panel') {
              const colorAttr = child.geometry.getAttribute('color') as THREE.BufferAttribute;
              const count = colorAttr.count;
              const flickerCount = Math.max(1, Math.floor(count * 0.02));
              for (let k = 0; k < flickerCount; k++) {
                const idx = Math.floor(Math.random() * count);
                const shade = randomShade(dark);
                colorAttr.setXYZ(idx, shade[0], shade[1], shade[2]);
              }
              colorAttr.needsUpdate = true;
            }
          });
        });
      }

      rndr.render(scn, cam);
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
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;

    const bgHex = isDarkMode ? 0x0a0a0a : 0xf2f2f2;
    const fogHex = isDarkMode ? 0x050505 : 0xf2f2f2;
    const lineHex = isDarkMode ? 0xD4D4D4 : 0x3D3D3D;
    const lineOp = isDarkMode ? 0.55 : 0.5;

    sceneRef.current.background = new THREE.Color(bgHex);
    if (sceneRef.current.fog) {
      (sceneRef.current.fog as THREE.Fog).color.setHex(fogHex);
    }

    segmentsRef.current.forEach((segment) => {
      segment.children.forEach((child) => {
        if (child instanceof THREE.LineSegments) {
          const mat = child.material as THREE.LineBasicMaterial;
          mat.color.setHex(lineHex);
          mat.opacity = lineOp;
          mat.needsUpdate = true;
        } else if (child instanceof THREE.Points && child.name === 'mosaic_panel') {
          const colorAttr = child.geometry.getAttribute('color') as THREE.BufferAttribute;
          const count = colorAttr.count;
          for (let i = 0; i < count; i++) {
            const shade = randomShade(isDarkMode);
            colorAttr.setXYZ(i, shade[0], shade[1], shade[2]);
          }
          colorAttr.needsUpdate = true;
        }
      });
    });
  }, [isDarkMode]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.4 },
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen overflow-hidden transition-colors duration-700 ${
        isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#f2f2f2]'
      }`}
    >
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div
          className={`absolute inset-0 pointer-events-none ${
            isDarkMode
              ? 'bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]'
              : 'bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(200,200,200,0.5)_100%)]'
          }`}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(212,212,212,0.45) 0px, rgba(212,212,212,0.45) 1px, transparent 1px, transparent 3px)',
          }}
        />
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div
          ref={contentRef}
          className="text-center flex flex-col items-center max-w-[680px] px-6"
        >
          <h1
            className={`text-[32px] sm:text-[40px] md:text-[56px] font-bold leading-[1.2] mb-4 md:mb-6 transition-colors duration-500 tracking-[-0.02em] ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}
            style={{ wordBreak: 'keep-all', fontFamily: 'var(--font-heading, sans-serif)' }}
          >
            진짜 나를 찾아줘
          </h1>
          <p
            className={`text-[13px] sm:text-sm md:text-base leading-relaxed mb-2 md:mb-3 tracking-wide transition-colors duration-500 ${
              isDarkMode ? 'text-white/50' : 'text-black/50'
            }`}
            style={{ wordBreak: 'keep-all' }}
          >
            AI를 통해 사람의 관계 데이터를 자산으로 만드는 기업입니다
          </p>
          <p
            className={`text-xs sm:text-[13px] md:text-sm leading-relaxed mb-8 md:mb-10 tracking-wide transition-colors duration-500 ${
              isDarkMode ? 'text-white/35' : 'text-black/35'
            }`}
            style={{ wordBreak: 'keep-all' }}
          >
            나를 다시 만나는 모든 순간을 위해
          </p>

          <div className="flex items-center gap-4 md:gap-6">
            <MagneticButton
              onClick={onTrialClick}
              variant="primary"
              size="lg"
              className="text-[15px] md:text-[17px]"
            >
              시작하기
            </MagneticButton>
            <Link
              to="/about"
              className={`text-[15px] md:text-[17px] font-medium hover:opacity-70 transition-opacity flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}
            >
              더 알아보기 <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
      </div>

      <a
        href="https://marvelous-chaja-071247.netlify.app"
        target="_blank"
        rel="noopener noreferrer"
        className={`absolute bottom-6 left-5 sm:left-8 z-20 inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 ${
          isDarkMode
            ? 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80'
            : 'border-black/15 text-black/45 hover:border-black/30 hover:text-black/70'
        }`}
      >
        두잇 보러가기
      </a>

      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 ${
          isDarkMode ? 'text-white/40' : 'text-black/40'
        }`}
      >
        <div className={`w-[1px] h-8 ${isDarkMode ? 'bg-[#D4D4D4]/30' : 'bg-[#3D3D3D]/20'} animate-pulse`} />
      </div>
    </div>
  );
};

export default Hero;