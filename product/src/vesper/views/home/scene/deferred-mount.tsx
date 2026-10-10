"use client";

import { useThree } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type * as THREE from "three";

/**
 * Mounts the scene's later forms one at a time, each in an idle period of its
 * own after the page has loaded — behind the loader, long before the scroll
 * clock reaches them.
 *
 * The orb is the first screen and mounts with the canvas. The galaxy, the
 * brain and the atmosphere used to mount in the same commit, and drei's
 * `<Preload all />` then compiled every program at once: one long task at load
 * on a phone (~175 + 155 ms at 4× CPU, the r3f chunk's share of mobile TBT).
 * Here each form builds and compiles in a short task of its own.
 *
 * `order` sets the queue: 0 first. Compiling is done per form on mount
 * (`WarmOnMount`), so nothing reaches the GPU for the first time mid-scroll.
 */
let loaded = false;
let next = 0;
const waiting = new Map<number, () => void>();
/** Codex 11차(1ce8595): 장면이 다시 마운트되면(워커 불가 → 메인 스레드 장면 재진입) 줄을 0 부터 다시 — 모든 인스턴스가 내려가면 초기화. */
let mounted = 0;
/** Codex 13차(b1f0b19): 줄이 초기화되면 세대가 바뀐다 — 이미 예약된 idle 콜백은 자기 세대가 아니면 아무것도 하지 않는다. */
let generation = 0;

/** The next idle period — or, where there is none (the scene worker), a beat. */
const later = (callback: () => void): void => {
  if (typeof globalThis.requestIdleCallback === "function") {
    globalThis.requestIdleCallback(callback, { timeout: 600 });
  } else {
    globalThis.setTimeout(callback, 50);
  }
};

const pump = (): void => {
  const run = waiting.get(next);
  if (!run) return;
  const mine = generation;
  later(() => {
    if (mine !== generation) return;
    waiting.delete(next);
    next += 1;
    run();
    // The next form gets an idle period of its own.
    later(() => {
      if (mine === generation) pump();
    });
  });
};

const enqueue = (order: number, run: () => void): (() => void) => {
  mounted += 1;
  waiting.set(order, run);
  if (loaded) {
    if (order === next) pump();
  } else if (
    // In the scene worker there is no document — and no load to wait for.
    typeof document === "undefined" ||
    document.readyState === "complete"
  ) {
    loaded = true;
    pump();
  } else {
    window.addEventListener(
      "load",
      () => {
        loaded = true;
        pump();
      },
      { once: true },
    );
  }
  return () => {
    waiting.delete(order);
    mounted -= 1;
    if (mounted <= 0) {
      mounted = 0;
      next = 0;
      waiting.clear();
      generation += 1;
    }
  };
};

/**
 * Compiles a freshly mounted form's programs once, while it is still hidden —
 * the per-form share of what `<Preload all />` did for the whole scene.
 * `compile` walks visible objects only, so the group is shown for the call.
 */
const WarmOnMount = ({ children }: { children: ReactNode }) => {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const ref = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    const hidden: THREE.Object3D[] = [];
    group.traverse((object) => {
      if (!object.visible) {
        hidden.push(object);
        object.visible = true;
      }
    });
    gl.compile(group, camera, scene);
    for (const object of hidden) object.visible = false;
  });

  return <group ref={ref}>{children}</group>;
};

export const DeferredMount = ({
  order,
  children,
}: {
  order: number;
  children: ReactNode;
}) => {
  const [ready, setReady] = useState(false);
  useEffect(() => enqueue(order, () => setReady(true)), [order]);
  return ready ? <WarmOnMount>{children}</WarmOnMount> : null;
};
