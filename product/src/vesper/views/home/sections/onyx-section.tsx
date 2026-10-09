"use client";
// GetLayers 3D Scenes 「Onyx Cubes」 원본(onyx-cubes.html) 그대로 — 2026-10-09 대표 「이것도 추가로 · 효과들 코드 준 대로 그대로」.
// 바꾼 것: CDN importmap(three 0.170 · cannon-es 0.20.0) → 번들 three 0.186 + cannon-es 0.20.0 · 제어판·localStorage 제거 ·
// 캔버스는 이 구간(section) 크기 · 보일 때만 그림 · 움직임 줄이기/이용 안내 열림이면 한 장만. 글은 아직 없음(대표: 효과 자리 먼저).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { pageMotionPaused } from "@vesper/lib/scene/page-motion";

/* ---------- CONFIG (원본 값 그대로) ---------- */
const CONFIG = {
  bgTop: '#fbfcfd', bgBottom: '#cfd4db', cubeColor: '#0b0c10', envTint: '#191b21', exposure: 1.0,
  metalness: 1.0, roughness: 0.16, clearcoat: 0.6, envIntensity: 1.0,
  cubeCount: 12, cubeSize: 1.05, sizeVar: 0.32, cornerR: 0.1, spawnSpread: 2.6,
  centerPull: 5.5, bob: 0.9, bobSpeed: 0.55, linDamp: 0.32, angDamp: 0.28, spin: 0.8, restitution: 0.28,
  pushRadius: 2.3, pushStrength: 34, dragForce: 90,
  keyLight: 0.55, ambient: 0.55, rim: 0.35,
  shadowOpacity: 0.16, shadowY: -3.4,
  fov: 32, camDist: 10.0, parallax: 0.4,
};

export const OnyxSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch { return; }
    const size = () => ({ w: host.clientWidth || 1, h: host.clientHeight || 1 });
    let { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CONFIG.fov, w / h, 0.1, 100);
    camera.position.set(0, 0, CONFIG.camDist);
    camera.lookAt(0, 0, 0);

    /* ---------- BACKGROUND — soft vertical studio gradient ---------- */
    const makeBackground = (top: string, bottom: string) => {
      const c = document.createElement('canvas'); c.width = 16; c.height = 512;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 512);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const background = makeBackground(CONFIG.bgTop, CONFIG.bgBottom);
    scene.background = background;

    /* ---------- ENVIRONMENT — dark studio rig baked to a PMREM ---------- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(CONFIG.envTint);
    const panel = (v: number, pos: [number, number, number], scale: [number, number], rot: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), toneMapped: false, side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(rot[0], rot[1], rot[2]); m.scale.set(scale[0], scale[1], 1);
      envScene.add(m);
    };
    panel(7.0, [0, 11, 3], [16, 8], [Math.PI / 2, 0, 0]);
    panel(5.0, [7, 3, 4], [4, 12], [0, -Math.PI / 2.3, 0]);
    panel(3.2, [-7, 2, 3], [4, 12], [0, Math.PI / 2.3, 0]);
    panel(1.1, [0, 0, 10], [18, 12], [0, 0, 0]);
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;

    /* ---------- LIGHTS ---------- */
    const ambient = new THREE.AmbientLight(0xffffff, CONFIG.ambient);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, CONFIG.keyLight);
    key.position.set(3.5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 10;
    key.shadow.bias = -0.0005;
    const sc = key.shadow.camera;
    sc.near = 1; sc.far = 30; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8;
    sc.updateProjectionMatrix();
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe6ff, CONFIG.rim);
    rim.position.set(-4, 2, -6);
    scene.add(rim);

    /* ---------- CONTACT SHADOW ---------- */
    const shadowMat = new THREE.ShadowMaterial({ opacity: CONFIG.shadowOpacity });
    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), shadowMat);
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.position.y = CONFIG.shadowY;
    shadowFloor.receiveShadow = true;
    scene.add(shadowFloor);

    /* ---------- PHYSICS WORLD ---------- */
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = false;
    const cubeMat = new CANNON.Material('cube');
    world.addContactMaterial(new CANNON.ContactMaterial(cubeMat, cubeMat, { friction: 0.15, restitution: CONFIG.restitution }));

    /* ---------- THE SWARM ---------- */
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(CONFIG.cubeColor), metalness: CONFIG.metalness, roughness: CONFIG.roughness,
      clearcoat: CONFIG.clearcoat, clearcoatRoughness: 0.12, envMapIntensity: CONFIG.envIntensity,
    });
    type Cube = { mesh: THREE.Mesh; body: CANNON.Body; phase: number };
    const cubes: Cube[] = [];
    let seed = 1;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const R = CONFIG.spawnSpread;
    for (let i = 0; i < CONFIG.cubeCount; i++) {
      const s = CONFIG.cubeSize * (1 - CONFIG.sizeVar * 0.5 + rand() * CONFIG.sizeVar);
      const geo = new RoundedBoxGeometry(s, s, s, 4, Math.min(CONFIG.cornerR, s * 0.45));
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      scene.add(mesh);
      const px = (rand() * 2 - 1) * R;
      const py = (rand() * 2 - 1) * R * 0.7;
      const pz = (rand() * 2 - 1) * R * 0.6;
      const body = new CANNON.Body({ mass: 1, material: cubeMat });
      body.addShape(new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)));
      body.position.set(px, py, pz);
      body.quaternion.setFromEuler(rand() * 6.28, rand() * 6.28, rand() * 6.28);
      body.linearDamping = CONFIG.linDamp;
      body.angularDamping = CONFIG.angDamp;
      const sp = CONFIG.spin;
      body.angularVelocity.set((rand() * 2 - 1) * sp, (rand() * 2 - 1) * sp, (rand() * 2 - 1) * sp);
      world.addBody(body);
      cubes.push({ mesh, body, phase: rand() * 6.28 });
    }

    /* ---------- POINTER — bow-wave push + grab-drag ---------- */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ndcPrev = new THREE.Vector2();
    let pointerSpeed = 0;
    let pointerInside = false;
    const parallax = new THREE.Vector2();
    let grabbed: Cube | null = null;
    let pointerBody: CANNON.Body | null = null;
    let dragConstraint: CANNON.PointToPointConstraint | null = null;
    const dragPlane = new THREE.Plane();
    const _hit = new THREE.Vector3();
    // Codex 8차(7fda8b7): 구간(section) 밖의 포인터 이동은 받지 않는다(잡고 있을 때만 예외) — 안 그러면 머리띠 위·반쯤 보일 때 엉뚱한 광선으로 반응.
    const setNDC = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      // Codex 14차(P2): 위에 덮인 메뉴·안내 창 위의 포인터는 받지 않는다 — 사각형 안이어도 대상이 이 구간 요소가 아니면 밖.
      const target = e.target instanceof Node ? e.target : null;
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom && (target === null || host.contains(target));
      if (inside || grabbed) ndc.set(Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)), Math.max(-1, Math.min(1, -((e.clientY - r.top) / r.height) * 2 + 1)));
      return inside;
    };
    const onDown = (e: PointerEvent) => {
      setNDC(e); pointerInside = true;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(cubes.map((c) => c.mesh));
      if (!hits.length) return;
      const rec = cubes.find((c) => c.mesh === hits[0].object);
      if (!rec) return;
      grabbed = rec;
      const p = hits[0].point;
      pointerBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
      pointerBody.position.set(p.x, p.y, p.z);
      world.addBody(pointerBody);
      const pivotA = rec.body.pointToLocalFrame(new CANNON.Vec3(p.x, p.y, p.z));
      dragConstraint = new CANNON.PointToPointConstraint(rec.body, pivotA, pointerBody, new CANNON.Vec3(), CONFIG.dragForce);
      world.addConstraint(dragConstraint);
      const n = new THREE.Vector3(); camera.getWorldDirection(n);
      dragPlane.setFromNormalAndCoplanarPoint(n, p);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* 지원 안 하는 브라우저 */ }
    };
    const onMove = (e: PointerEvent) => {
      const inside = setNDC(e);
      if (!inside && !grabbed) { pointerInside = false; ndc.set(0, 0); return; }
      pointerInside = true;
      if (grabbed && pointerBody) {
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragPlane, _hit)) pointerBody.position.set(_hit.x, _hit.y, _hit.z);
      }
    };
    const endGrab = (e?: PointerEvent) => {
      if (dragConstraint) { world.removeConstraint(dragConstraint); dragConstraint = null; }
      if (pointerBody) { world.removeBody(pointerBody); pointerBody = null; }
      grabbed = null;
      if (e && e.pointerId != null) { try { canvas.releasePointerCapture(e.pointerId); } catch { /* 이미 풀림 */ } }
    };
    const onLeave = () => { pointerInside = false; };
    // Codex 8차(7fda8b7)·14차(P1): 휴대폰 세로 스크롤은 캔버스 위에서도 브라우저가 가져간다(touch-action: pan-y · touchmove 차단 0).
    // 잡은 채 세로로 밀면 브라우저가 pointercancel 을 보내 잡기가 풀리고 스크롤이 된다. 가로 끌기·탭은 그대로.
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', endGrab);
    window.addEventListener('pointercancel', endGrab);
    canvas.addEventListener('pointerleave', onLeave);

    /* ---------- PER-FRAME FORCES ---------- */
    const _ray = new THREE.Ray();
    const _closest = new THREE.Vector3();
    const _bodyPos = new THREE.Vector3();
    const _dir = new THREE.Vector3();
    const _force = new CANNON.Vec3();
    const applyForces = (t: number) => {
      raycaster.setFromCamera(ndc, camera);
      _ray.copy(raycaster.ray);
      for (const c of cubes) {
        const b = c.body;
        b.applyForce(_force.set(-b.position.x * CONFIG.centerPull, -b.position.y * CONFIG.centerPull, -b.position.z * CONFIG.centerPull));
        b.applyForce(_force.set(
          Math.sin(t * CONFIG.bobSpeed + c.phase) * CONFIG.bob * 0.5,
          Math.cos(t * CONFIG.bobSpeed * 0.8 + c.phase) * CONFIG.bob,
          Math.sin(t * CONFIG.bobSpeed * 1.1 + c.phase * 1.7) * CONFIG.bob * 0.5,
        ));
        if (pointerInside && c !== grabbed) {
          _bodyPos.set(b.position.x, b.position.y, b.position.z);
          _ray.closestPointToPoint(_bodyPos, _closest);
          const d = _bodyPos.distanceTo(_closest);
          if (d < CONFIG.pushRadius) {
            const falloff = 1 - d / CONFIG.pushRadius;
            const gain = Math.min(1, pointerSpeed * 8) * 0.85 + 0.15;
            _dir.copy(_bodyPos).sub(_closest);
            if (_dir.lengthSq() < 1e-6) _dir.set(rand() - 0.5, rand() - 0.5, rand() - 0.5);
            _dir.normalize().multiplyScalar(falloff * falloff * CONFIG.pushStrength * gain);
            b.applyForce(_force.set(_dir.x, _dir.y, _dir.z));
          }
        }
      }
    };

    /* ---------- RESIZE ---------- */
    let stillDrawn = false;
    const resize = () => {
      ({ w, h } = size());
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // 크기가 바뀌면 버퍼가 지워진다: 멈춤 중이어도 다음 프레임에 한 장 다시.
      stillDrawn = false;
    };
    window.addEventListener('resize', resize);

    let visible = false;
    const io = new IntersectionObserver((entries) => { for (const e of entries) visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(host);

    /* ---------- RENDER LOOP ---------- */
    const clock = new THREE.Clock();
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      // 움직임 줄이기 · 이용 안내 창 열림 → 한 장만 그리고 멈춤(풀리면 다시 진행).
      const paused = pageMotionPaused();
      if (paused && stillDrawn) { clock.getDelta(); return; }
      stillDrawn = paused;
      const dt = Math.min(clock.getDelta(), 1 / 30);
      const t = clock.elapsedTime;
      pointerSpeed = ndc.distanceTo(ndcPrev);
      ndcPrev.copy(ndc);
      applyForces(t);
      world.step(1 / 120, dt, 4);
      for (const c of cubes) {
        c.mesh.position.copy(c.body.position as unknown as THREE.Vector3);
        c.mesh.quaternion.copy(c.body.quaternion as unknown as THREE.Quaternion);
      }
      const px = grabbed ? 0 : ndc.x * CONFIG.parallax;
      const py = grabbed ? 0 : ndc.y * CONFIG.parallax;
      parallax.x += (px - parallax.x) * 0.05;
      parallax.y += (py - parallax.y) * 0.05;
      camera.position.x = parallax.x;
      camera.position.y = parallax.y;
      camera.position.z = CONFIG.camDist;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endGrab); window.removeEventListener('pointercancel', endGrab); canvas.removeEventListener('pointerleave', onLeave);
      for (const c of cubes) { scene.remove(c.mesh); c.mesh.geometry.dispose(); world.removeBody(c.body); }
      material.dispose(); shadowMat.dispose(); shadowFloor.geometry.dispose(); background.dispose(); envRT.dispose(); pmrem.dispose(); renderer.dispose();
    };
  }, []);

  return (
    <section ref={hostRef} id="onyx" aria-label="Onyx Cubes" className="relative h-lvh w-full overflow-hidden bg-[#eef0f3]">
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full touch-pan-y" />
    </section>
  );
};
