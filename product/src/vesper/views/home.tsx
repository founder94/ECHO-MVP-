/**
 * Home view — VESPER / V—0RB.
 *
 * A Server Component: it owns the copy and hands it to the client stage, which
 * is where the WebGL canvas, the scroll clock, and the HUD all live.
 */
import { RobotProvider, RobotView } from "@vesper/components/common/robot-view";
import { homeFooter, homeLoader } from "@vesper/data/mocks/home";
import { ScrollStage } from "./home/scroll-stage";

/** `robot`: the proxy's form for crawlers and lab tools (D-016) — no loader,
 *  a still of the scene, the copy at rest (`ScrollStage` reads it). */
export const HomeView = ({ robot = false }: { robot?: boolean }) => {
  return (
    <RobotProvider robot={robot}>
      {robot && <RobotView />}
      <ScrollStage loader={homeLoader} footer={homeFooter} />
    </RobotProvider>
  );
};
