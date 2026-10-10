"use client";

import {
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
} from "react";

import { RobotText } from "@vesper/components/common/robot-text";
import { useRobot } from "@vesper/components/common/robot-view";

type EngineProps = ComponentProps<typeof RobotText>;

/** Laid out as the engine lays itself out — a wrapping flex row. */
const AS_ENGINE = { display: "flex", flexWrap: "wrap" } as const;

/*
 * One engine per idle period. Each line used to ask for its own idle callback,
 * and the callbacks of one idle period ran back to back — React then mounted
 * every line's engine (a spring per letter or word) in one render: the load's
 * longest tasks after hydration. Here the lines queue, and each mounts in an
 * idle period of its own, after `load`.
 */
const queue: (() => void)[] = [];
let pumping = false;
let loaded = false;

const later = (run: () => void) => {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 200);
  }
};

const pump = () => {
  const next = queue.shift();
  if (!next) {
    pumping = false;
    return;
  }
  next();
  // React renders that mount in its own task before the next idle period.
  later(pump);
};

const start = () => {
  if (pumping || !queue.length) return;
  pumping = true;
  later(pump);
};

const enqueue = (run: () => void): (() => void) => {
  queue.push(run);
  if (loaded || document.readyState === "complete") {
    loaded = true;
    start();
  } else {
    window.addEventListener(
      "load",
      () => {
        loaded = true;
        start();
      },
      { once: true },
    );
  }
  return () => {
    const index = queue.indexOf(run);
    if (index >= 0) queue.splice(index, 1);
  };
};

/**
 * A line that is plain, hidden text until it is about to play.
 *
 * The hero's copy is hidden under the loader and only plays once the curtain
 * lifts (`enabled`); the galaxy and brain overlays' copy is hidden until the
 * scroll clock reaches them. Hydrating `spring-text-engine` created every
 * letter's and word's spring at load — the load's long hydration tasks on a
 * phone. Until the line is needed it is the same tag with the same classes,
 * the text in it at the engine's start pose (`visibility: hidden` — every unit
 * starts at opacity 0 anyway). The engine mounts in an idle period of its own
 * after load (one line per period), or the moment the line is enabled if that
 * comes first (helion: per-letter headings as plain spans until they play).
 */
export const HeroText = (props: EngineProps) => {
  const [ready, setReady] = useState(false);
  // The robot form (D-016) has its copy at rest from the served HTML.
  const robot = useRobot();
  const now = Boolean(props.enabled) || robot;

  useEffect(() => {
    if (ready || now) return;
    return enqueue(() => setReady(true));
  }, [ready, now]);

  if (ready || now) return <RobotText {...props} />;

  const Tag = (props.tag ?? "div") as unknown as ComponentType<
    Record<string, unknown>
  >;
  return (
    <Tag
      className={props.className}
      style={{
        ...AS_ENGINE,
        columnGap: `${props.columnGap ?? 0}em`,
        ...props.style,
        visibility: "hidden",
      }}
    >
      {props.children}
    </Tag>
  );
};
