/**
 * Onyx Cubes — 원본(onyx-cubes.html · three 0.170.0 · cannon-es 0.20.0)의 장면을 값 그대로 옮긴 엔진.
 *
 * 원본에서 바꾼 것은 「통합에 필요한 변경」뿐이다(시각 값 변경 0). 바꾼 곳마다 [통합] 표시를 단다.
 *   [통합] 크기: 창(window) 전체 → 효과 영역(컨테이너) 크기. ResizeObserver 로 따라간다.
 *   [통합] 포인터 좌표: 창 기준 → 캔버스 사각형 기준(효과 영역 안의 위치로 계산).
 *   [통합] 이벤트: window 전역 → 캔버스에만. 끌기 중에는 setPointerCapture 로 캔버스가 계속 받는다.
 *   [통합] 입력 모드: 'watch'(기본 — 잡기·던지기 없음, 마우스로 움직일 때만 물결 밀기, 터치는 스크롤에 양보)
 *          / 'play'(체험 모드 — 원본 잡기·던지기 그대로). 대표 지시: 모바일 기본은 세로 스크롤 우선.
 *   [통합] 실행 주기: 화면에 보일 때 + 탭이 보일 때만 그린다(IntersectionObserver · visibilitychange).
 *          움직임 줄이기: 처음 한 장만 그리고 멈춘다(체험 모드는 사용자가 직접 켠 경우에만 움직인다).
 *   [통합] 화면 비율: 원본은 창 전체(가로가 긴 16:10 안팎)를 채운다. 효과 영역이 그보다 좁으면 같은 무리가
 *          양옆에서 잘리므로, 카메라 거리만 비율만큼 늘려 원본과 같은 가로 폭을 담는다(시야각 32°·재질·조명·물리 그대로).
 *   [통합] 정리: dispose() 가 그리기 반복·이벤트·물리 세계·GPU 자원을 모두 푼다.
 *   제외: 조절 패널(UI PANEL)·localStorage 설정 덮어쓰기·Inter 웹폰트(@import, 캔버스에 글자 없음).
 */
import * as CANNON from "cannon-es";
import * as THREE from "three-onyx";
import { RoundedBoxGeometry } from "three-onyx/examples/jsm/geometries/RoundedBoxGeometry.js";

/* ---------- CONFIG — 원본 고정값(대표 전달 값과 같다) ---------- */
const CONFIG = {
  bgTop: "#fbfcfd",
  bgBottom: "#cfd4db",
  cubeColor: "#0b0c10",
  envTint: "#191b21",
  exposure: 1.0,
  metalness: 1.0,
  roughness: 0.16,
  clearcoat: 0.6,
  envIntensity: 1.0,
  cubeCount: 12,
  cubeSize: 1.05,
  sizeVar: 0.32,
  cornerR: 0.1,
  spawnSpread: 2.6,
  centerPull: 5.5,
  bob: 0.9,
  bobSpeed: 0.55,
  linDamp: 0.32,
  angDamp: 0.28,
  spin: 0.8,
  restitution: 0.28,
  pushRadius: 2.3,
  pushStrength: 34,
  dragForce: 90,
  keyLight: 0.55,
  ambient: 0.55,
  rim: 0.35,
  shadowOpacity: 0.16,
  shadowY: -3.4,
  fov: 32,
  camDist: 10.0,
  parallax: 0.4,
} as const;

export type OnyxMode = "watch" | "play";

export interface OnyxHandle {
  setMode: (mode: OnyxMode) => void;
  dispose: () => void;
}

interface Options {
  reducedMotion: boolean;
  mode: OnyxMode;
}

/** WebGL 을 쓸 수 없으면 null — 부르는 쪽이 대체 화면을 보여 준다. */
export const createOnyx = (canvas: HTMLCanvasElement, host: HTMLElement, options: Options): OnyxHandle | null => {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  let mode: OnyxMode = options.mode;
  const reduced = options.reducedMotion;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 100);
  // [통합] 효과 영역 비율이 원본 화면(16:10)보다 좁을 때만 카메라를 뒤로 — resize() 에서 정한다.
  const ORIGINAL_ASPECT = 16 / 10;
  let camDist: number = CONFIG.camDist;
  camera.position.set(0, 0, CONFIG.camDist);
  camera.lookAt(0, 0, 0);

  /* ---------- BACKGROUND — soft vertical studio gradient (원본 그대로) ---------- */
  const makeBackground = (top: string, bottom: string) => {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 512);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const background = makeBackground(CONFIG.bgTop, CONFIG.bgBottom);
  scene.background = background;

  /* ---------- ENVIRONMENT — dark studio rig baked to a PMREM (원본 그대로) ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(CONFIG.envTint);
  const envDisposables: { dispose: () => void }[] = [];
  const panel = (v: number, pos: [number, number, number], scale: [number, number], rot: [number, number, number]) => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), toneMapped: false, side: THREE.DoubleSide });
    envDisposables.push(geo, mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.scale.set(scale[0], scale[1], 1);
    envScene.add(m);
  };
  panel(7.0, [0, 11, 3], [16, 8], [Math.PI / 2, 0, 0]); // big overhead softbox
  panel(5.0, [7, 3, 4], [4, 12], [0, -Math.PI / 2.3, 0]); // right key strip
  panel(3.2, [-7, 2, 3], [4, 12], [0, Math.PI / 2.3, 0]); // left fill strip
  panel(1.1, [0, 0, 10], [18, 12], [0, 0, 0]); // faint front fill
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  for (const d of envDisposables) d.dispose();

  /* ---------- LIGHTS (원본 그대로) ---------- */
  scene.add(new THREE.AmbientLight(0xffffff, CONFIG.ambient));
  const key = new THREE.DirectionalLight(0xffffff, CONFIG.keyLight);
  key.position.set(3.5, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 10;
  key.shadow.bias = -0.0005;
  const sc = key.shadow.camera;
  sc.near = 1;
  sc.far = 30;
  sc.left = -8;
  sc.right = 8;
  sc.top = 8;
  sc.bottom = -8;
  sc.updateProjectionMatrix();
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, CONFIG.rim);
  rim.position.set(-4, 2, -6);
  scene.add(rim);

  /* ---------- CONTACT SHADOW (원본 그대로) ---------- */
  const shadowGeo = new THREE.PlaneGeometry(40, 40);
  const shadowMat = new THREE.ShadowMaterial({ opacity: CONFIG.shadowOpacity });
  const shadowFloor = new THREE.Mesh(shadowGeo, shadowMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = CONFIG.shadowY;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  /* ---------- PHYSICS WORLD — weightless (원본 그대로) ---------- */
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = false;
  const cubeMat = new CANNON.Material("cube");
  world.addContactMaterial(new CANNON.ContactMaterial(cubeMat, cubeMat, { friction: 0.15, restitution: CONFIG.restitution }));

  /* ---------- THE SWARM (원본 그대로) ---------- */
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(CONFIG.cubeColor),
    metalness: CONFIG.metalness,
    roughness: CONFIG.roughness,
    clearcoat: CONFIG.clearcoat,
    clearcoatRoughness: 0.12,
    envMapIntensity: CONFIG.envIntensity,
  });
  interface Cube { mesh: THREE.Mesh; body: CANNON.Body; phase: number }
  const cubes: Cube[] = [];
  let seed = 1;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  {
    seed = 1;
    const R = CONFIG.spawnSpread;
    for (let i = 0; i < CONFIG.cubeCount; i++) {
      const s = CONFIG.cubeSize * (1 - CONFIG.sizeVar * 0.5 + rand() * CONFIG.sizeVar);
      const geo = new RoundedBoxGeometry(s, s, s, 4, Math.min(CONFIG.cornerR, s * 0.45));
      // 예제 모듈의 타입 선언이 "three"(0.184) 타입을 가리켜 형식만 맞춘다 — 실제 객체는 three-onyx(0.170) 것.
      const geometry = geo as unknown as THREE.BufferGeometry;
      const mesh = new THREE.Mesh(geometry, material);
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
  const hitPoint = new THREE.Vector3();

  // [통합] 창 기준 → 캔버스 사각형 기준 NDC
  const setNDC = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  // [통합] 'watch' 모드의 터치·펜은 스크롤에 양보 — 물결 밀기도 하지 않는다(마우스만)
  const acceptsHover = (e: PointerEvent) => mode === "play" || e.pointerType === "mouse";

  const onDown = (e: PointerEvent) => {
    if (mode !== "play") return; // [통합] 잡기·던지기는 체험 모드에서만
    setNDC(e);
    pointerInside = true;
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
    const n = new THREE.Vector3();
    camera.getWorldDirection(n);
    dragPlane.setFromNormalAndCoplanarPoint(n, p);
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!acceptsHover(e)) return;
    setNDC(e);
    pointerInside = true;
    if (grabbed && pointerBody) {
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) pointerBody.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
    }
  };
  const endGrab = (e?: PointerEvent) => {
    if (dragConstraint) {
      world.removeConstraint(dragConstraint);
      dragConstraint = null;
    }
    if (pointerBody) {
      world.removeBody(pointerBody);
      pointerBody = null;
    }
    grabbed = null;
    if (e && e.pointerId != null) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* 이미 놓였다 */
      }
    }
  };
  const onLeave = () => {
    pointerInside = false;
  };
  // [통합] window → canvas (끌기 중 포인터 캡처로 캔버스 밖 움직임도 받는다)
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", endGrab);
  canvas.addEventListener("pointercancel", endGrab);
  canvas.addEventListener("pointerleave", onLeave);

  /* ---------- PER-FRAME FORCES (원본 그대로) ---------- */
  const ray = new THREE.Ray();
  const closest = new THREE.Vector3();
  const bodyPos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const force = new CANNON.Vec3();
  const applyForces = (t: number) => {
    raycaster.setFromCamera(ndc, camera);
    ray.copy(raycaster.ray);
    for (const c of cubes) {
      const b = c.body;
      b.applyForce(force.set(-b.position.x * CONFIG.centerPull, -b.position.y * CONFIG.centerPull, -b.position.z * CONFIG.centerPull));
      b.applyForce(
        force.set(
          Math.sin(t * CONFIG.bobSpeed + c.phase) * CONFIG.bob * 0.5,
          Math.cos(t * CONFIG.bobSpeed * 0.8 + c.phase) * CONFIG.bob,
          Math.sin(t * CONFIG.bobSpeed * 1.1 + c.phase * 1.7) * CONFIG.bob * 0.5,
        ),
      );
      if (pointerInside && c !== grabbed) {
        bodyPos.set(b.position.x, b.position.y, b.position.z);
        ray.closestPointToPoint(bodyPos, closest);
        const d = bodyPos.distanceTo(closest);
        if (d < CONFIG.pushRadius) {
          const falloff = 1 - d / CONFIG.pushRadius;
          const gain = Math.min(1, pointerSpeed * 8) * 0.85 + 0.15;
          dir.copy(bodyPos).sub(closest);
          if (dir.lengthSq() < 1e-6) dir.set(rand() - 0.5, rand() - 0.5, rand() - 0.5);
          dir.normalize().multiplyScalar(falloff * falloff * CONFIG.pushStrength * gain);
          b.applyForce(force.set(dir.x, dir.y, dir.z));
        }
      }
    }
  };

  /* ---------- RESIZE — [통합] 창 → 효과 영역 ---------- */
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camDist = CONFIG.camDist * Math.max(1, ORIGINAL_ASPECT / camera.aspect);
    camera.position.z = camDist;
    camera.lookAt(0, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) renderer.render(scene, camera);
  });
  ro.observe(host);

  /* ---------- RENDER LOOP (원본 그대로) + [통합] 보일 때만 ---------- */
  const clock = new THREE.Clock(false);
  let raf = 0;
  let running = false;
  let inView = false;
  const frame = () => {
    raf = requestAnimationFrame(frame);
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
    camera.position.z = camDist;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  const shouldRun = () => inView && !document.hidden && (!reduced || mode === "play");
  const sync = () => {
    const want = shouldRun();
    if (want && !running) {
      running = true;
      clock.start(); // 멈췄던 시간만큼 한꺼번에 흐르지 않게 다시 잰다(getDelta 는 1/30 로도 묶여 있다)
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
      clock.stop();
      endGrab();
    }
  };
  // 움직임 줄이기·첫 화면: 한 장은 그려 둔다(물리 1 회 위치 그대로).
  for (const c of cubes) {
    c.mesh.position.copy(c.body.position as unknown as THREE.Vector3);
    c.mesh.quaternion.copy(c.body.quaternion as unknown as THREE.Quaternion);
  }
  renderer.render(scene, camera);

  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      sync();
    },
    { threshold: 0.05 },
  );
  io.observe(host);
  const onVisibility = () => sync();
  document.addEventListener("visibilitychange", onVisibility);

  return {
    setMode: (next) => {
      mode = next;
      if (next === "watch") {
        endGrab();
        pointerInside = false;
      }
      sync();
    },
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endGrab);
      canvas.removeEventListener("pointercancel", endGrab);
      canvas.removeEventListener("pointerleave", onLeave);
      endGrab();
      for (const c of cubes) {
        c.mesh.geometry.dispose();
        world.removeBody(c.body);
      }
      material.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      background.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};
