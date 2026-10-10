import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StoryView } from "./story-view";
import "./story.css";
import { installExternalLinks } from "@shared/echo-app";

installExternalLinks();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <StoryView />
    </StrictMode>,
  );
}
