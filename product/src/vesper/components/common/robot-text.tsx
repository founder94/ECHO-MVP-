"use client";

import type { ComponentProps, ComponentType } from "react";
import TextEngine from "spring-text-engine";

import { useRobot } from "./robot-view";

/**
 * spring-text-engine, except that on the robot form (D-016) the text is plain
 * text in the same tag — the engine starts its letters hidden in the served
 * HTML. Swap a first-screen import:
 * `import { RobotText as TextEngine } from "@vesper/components/common/robot-text"`.
 *
 * The identity transform keeps the engine's paint order: its letters are
 * transformed, which paints them in the positioned layer — above an overlay
 * (a legibility scrim) that plain in-flow text would sit under (evolve).
 */
const PAINT_AS_ENGINE = {
  transform: "translate(0)",
  // The engine lays each instance out as a wrapping flex row — so two inline
  // `<span>` engines stack as two lines (voxelia's headline "Play the board" /
  // "in real time." ran together without this), and `justify-*` classes align.
  display: "flex",
  flexWrap: "wrap",
} as const;

/**
 * The engine sets each line as a flex row, so a `justify-*` class aligns its
 * lines; on plain text that class does nothing. Carry it over as `text-align`
 * (helion's centred hero line rendered left-aligned without this) — unless the
 * author already aligns the text with a `text-*` class: an inline style would
 * beat its responsive variants (lumea's `text-center lg:text-left` headline
 * rendered centred on desktop).
 */
const alignOf = (className = "") =>
  /(^|\s|:)text-(left|center|right|start|end|justify)(\s|$)/.test(className)
    ? undefined
    : /(^|\s)justify-center(\s|$)/.test(className)
      ? "center"
      : /(^|\s)justify-end(\s|$)/.test(className)
        ? "right"
        : undefined;

export const RobotText = (props: ComponentProps<typeof TextEngine>) => {
  const robot = useRobot();
  if (!robot) return <TextEngine {...props} />;
  // Through `ComponentType`, not `ElementType`: with @react-three/fiber's JSX
  // augmentation a dynamic intrinsic tag types its children as `never` and a
  // project that type-checks its build (vesper) fails on it.
  const Tag = (props.tag ?? "div") as unknown as ComponentType<
    Record<string, unknown>
  >;
  return (
    <Tag
      className={props.className}
      style={{
        ...PAINT_AS_ENGINE,
        textAlign: alignOf(props.className),
        // At rest a scroll-scrubbed line (`mode="progress"`) is at progress 0 —
        // the engine's out-state, hidden. Showing it stacked house's whole
        // hero sequence on the first screen. (The text is still in the DOM.)
        visibility: props.mode === "progress" ? "hidden" : undefined,
      }}
    >
      {props.children}
    </Tag>
  );
};
