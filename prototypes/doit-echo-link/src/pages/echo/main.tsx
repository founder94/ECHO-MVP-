import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AdaptiveGrid } from "@flora/components/common/grid";
import { ReducedMotion } from "@flora/components/common/reduced-motion";
import { ScrollLayout } from "@flora/layouts/scroll-layout";

import { EchoView } from "./echo-view";
import "./echo.css";
import { installExternalLinks } from "@shared/echo-app";

installExternalLinks();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ScrollLayout>
        <AdaptiveGrid coef={1} />
        <ReducedMotion />
        <EchoView />
      </ScrollLayout>
    </StrictMode>,
  );
}
