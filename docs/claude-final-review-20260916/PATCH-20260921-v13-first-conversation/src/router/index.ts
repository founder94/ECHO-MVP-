import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { Suspense, createElement, useEffect } from "react";
import routes from "./config";
import RouteFallback from "@/components/RouteFallback";

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
      // 랜딩(/)은 지연 불러오기를 쓰지 않아 여기를 거치지 않는다 — 여전히 즉시 표시된다.
      // 나머지 화면은 조각을 받는 동안 빈 화면이 아니라 조용한 대기 화면을 보여 준다.
      // 가짜 진행률이나 별도 도입 화면은 여전히 넣지 않는다.
      fallback: createElement(RouteFallback),
    },
    element,
  );
}
