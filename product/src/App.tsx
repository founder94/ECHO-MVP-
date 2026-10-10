import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ConsentGate from "./components/legal/ConsentGate";
import AppBackButton from "./components/AppBackButton";
import RouteScrollReset from "./components/RouteScrollReset";
import AppCornerMenu from "./components/AppCornerMenu";
import ThemeColorSync from "./components/ThemeColorSync";
import InstallIntentSheet from "./components/InstallIntentSheet";
import GuideHost from "./components/guide/GuideHost";
import InstallAppCard from "./doit/components/feature/InstallAppCard";
import { IS_BRAND_SITE } from "./lib/siteRole";


function App() {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter basename={__BASE_PATH__}>
              <ThemeColorSync />
              <RouteScrollReset />
              <ConsentGate />
              <AppBackButton />
              <AppCornerMenu />
              <AppRoutes />
              <InstallIntentSheet />
              {/* 2026-10-04 이용 안내 창 하나(앱). 홈페이지는 brand-home 이 검정 테마로 따로 둔다. 설치 항목에는 실제 기기 판별·설치 카드를 그대로 쓴다. */}
              {!IS_BRAND_SITE && <GuideHost theme="app" extra={{ install: <InstallAppCard variant="menu" /> }} />}
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}

export default App;