"use client";

import { use, useEffect, useState, type ReactNode } from "react";

/**
 * Hydrate a server-rendered block only once the visitor nears it.
 *
 * Every block below the scene's stage sits in its own `<Suspense>`. Put this
 * inside one, around the block, and the block's hydration waits: the component
 * suspends while React hydrates, and React keeps the server HTML in place for
 * a boundary that suspends during hydration — then hydrates it, in place (no
 * remount, nothing re-created), once the gate opens. Hydrating every block at
 * once was the page's one long task at load: a few hundred reveals starting
 * their springs in a single commit (from relay, where it took mobile 68 → 83).
 *
 * The gate opens when the block (`id`) is on screen — or, from the visitor's
 * first gesture toward moving the page, within 1.5 viewports of it. Before
 * that gesture nothing below the hero can come near: the page opens at the
 * top, held off-screen under the preloader until the fold. `scroll` also
 * counts as that gesture, so a restored or hash-anchored position opens the
 * gates around it.
 *
 * On the server, and on a client render that is not hydration (a navigation
 * back to the page), the block renders at once: the element is not in the
 * document yet, so its gate is open. The robot form (D-016) goes through the
 * same gate — its served HTML already holds every block at rest.
 */
const LOOKAHEAD = "150% 0px 150% 0px";
const ENGAGE_EVENTS = [
  "pointerdown",
  "touchstart",
  "wheel",
  "keydown",
  "scroll",
] as const;

let engaged = false;
const engageWaiters = new Set<() => void>();
const engage = () => {
  if (engaged) return;
  engaged = true;
  for (const type of ENGAGE_EVENTS)
    window.removeEventListener(type, engage, true);
  for (const wake of engageWaiters) wake();
  engageWaiters.clear();
};
const onEngaged = (wake: () => void) => {
  if (engaged) {
    wake();
    return;
  }
  if (engageWaiters.size === 0) {
    for (const type of ENGAGE_EVENTS) {
      window.addEventListener(type, engage, { capture: true, passive: true });
    }
  }
  engageWaiters.add(wake);
};

const gates = new Map<string, Promise<void>>();

const gateFor = (id: string): Promise<void> => {
  const known = gates.get(id);
  if (known) return known;
  const gate = new Promise<void>((open) => {
    const el =
      document.getElementById(id) ??
      document.querySelector(`[data-hydrate-near="${id}"]`);
    if (!el) {
      open();
      return;
    }
    let io: IntersectionObserver | null = null;
    const watch = (rootMargin: string) => {
      io?.disconnect();
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          io?.disconnect();
          open();
        },
        { rootMargin },
      );
      io.observe(el);
    };
    watch("0px");
    onEngaged(() => watch(LOOKAHEAD));
  });
  gates.set(id, gate);
  return gate;
};

/**
 * 2026-10-09(Codex 검수 P1 · PR #151): 이 앱은 서버 HTML 을 hydrate 하지 않고 `createRoot` 로 그린다.
 * 원본처럼 `use(gateFor(id))` 를 render 중에 부르면 대상 요소가 아직 없어 문이 바로 열리고, 다섯 블록(Solaris ·
 * 격자 · 설치 · 이야기 · 바닥글)이 첫 화면에서 한꺼번에 마운트돼 WebGL 두 장면을 바로 만든다. 그래서 문이 닫힌 동안은
 * 같은 자리에 한 화면 높이의 자리표를 두고(그 id · 가까이 오면 IntersectionObserver), 열리면 그때 블록을 그린다.
 */
const openedGates = new Set<string>();

export const HydrateNear = ({
  id,
  children,
}: {
  /** The block's root element id — what the gate watches. */
  id: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(
    () => typeof window === "undefined" || openedGates.has(id),
  );
  useEffect(() => {
    if (open) return;
    let live = true;
    void gateFor(id).then(() => {
      openedGates.add(id);
      if (live) setOpen(true);
    });
    return () => {
      live = false;
    };
  }, [id, open]);
  if (open) return children;
  return (
    <div
      ref={(el) => {
        // 같은 id 의 요소(예: 바깥 `#financial` 틀)가 이미 있으면 그쪽을 지켜보고, 없으면 자리표가 그 id 가 된다(해시 이동 유지).
        if (el && !document.getElementById(id)) el.id = id;
      }}
      data-hydrate-near={id}
      aria-hidden
      className="min-h-lvh w-full"
    />
  );
};

/**
 * For a block that cannot be "neared": a `fixed` overlay faded by the scene
 * clock is always in the viewport, and its server HTML is already at its rest
 * state (opacity 0, `visibility: hidden`). It hydrates in an idle period of its
 * own once the page has loaded — before anyone can scroll the clock to it. Not
 * at the first gesture: that would hydrate it in the first frames of a scroll,
 * which the scroll test caught as dropped frames. One gate per `name`,
 * so each overlay is its own short task instead of a slice of the load's one.
 */
const idleGates = new Map<string, Promise<void>>();

const idleGateFor = (name: string, after?: string): Promise<void> => {
  const known = idleGates.get(name);
  if (known) return known;
  // Chained: opened together, two gates are one retry and one long task.
  const previous = after ? idleGateFor(after) : Promise.resolve();
  const gate = new Promise<void>((open) => {
    let opened = false;
    const once = () => {
      if (opened) return;
      opened = true;
      open();
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(once, { timeout: 1000 });
      } else {
        window.setTimeout(once, 200);
      }
    };
    void previous.then(() => {
      if (document.readyState === "complete") whenIdle();
      else window.addEventListener("load", whenIdle, { once: true });
    });
  });
  idleGates.set(name, gate);
  return gate;
};

export const HydrateIdle = ({
  name,
  after,
  children,
}: {
  /** One gate per name — a block's own idle period. */
  name: string;
  /** Another gate's name: this one waits for that one to open first. */
  after?: string;
  children: ReactNode;
}) => {
  if (typeof window !== "undefined") use(idleGateFor(name, after));
  return children;
};
