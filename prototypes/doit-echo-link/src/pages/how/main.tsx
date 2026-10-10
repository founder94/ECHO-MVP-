import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { HowView } from "./how-view";
import "./how.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HowView />
    </StrictMode>,
  );
}
