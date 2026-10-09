import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ConnectedView } from "./connected-view";
import "./connected.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ConnectedView />
    </StrictMode>,
  );
}
