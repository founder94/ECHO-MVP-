import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { Suspense, createElement, useEffect } from "react";
import routes from "./config";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });
  return createElement(
    Suspense,
    {
      fallback: createElement(
        "div",
        {
          className: "echo-min-h-viewport bg-[#07111f] text-white flex flex-col items-center justify-center gap-3",
          role: "status",
          "aria-live": "polite",
        },
        createElement("p", { className: "text-[12px] tracking-[0.5em] text-white/75" }, "ECHO"),
        createElement("p", { className: "text-[14px] text-white/65" }, "화면을 준비하고 있어요."),
      ),
    },
    element,
  );
}
