"use client";

import type { ComponentProps, ComponentType } from "react";
import TextEngine from "spring-text-engine";

import { useRobot } from "./robot-view";

/**
 * spring-text-engine, except that on the robot form (D-016) the text is plain
 * text in the same tag — the engine starts its letters hidden in the served
 * HTML. Swap a first-screen import:
 * `import { RobotText as TextEngine } from "@flora/components/common/robot-text"`.
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
    <Tag className={props.className} style={PAINT_AS_ENGINE}>
      {props.children}
    </Tag>
  );
};
