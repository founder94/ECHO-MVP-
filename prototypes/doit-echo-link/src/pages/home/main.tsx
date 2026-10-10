import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ReducedMotion } from "@clarix/components/common/reduced-motion";
import { ScrollLayout } from "@clarix/layouts/scroll-layout";

import { HomeView } from "./home-view";
import "./home.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ScrollLayout>
        <ReducedMotion />
        <HomeView />
      </ScrollLayout>
    </StrictMode>,
  );
}
