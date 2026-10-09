import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StoryView } from "./story-view";
import "./story.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <StoryView />
    </StrictMode>,
  );
}
