import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import FPSDiveProvider from "@/components/feature/FPSDiveProvider";
import AnalyticsProvider from "@/components/feature/AnalyticsProvider";

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <FPSDiveProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <AnalyticsProvider>
            <AppRoutes />
          </AnalyticsProvider>
        </BrowserRouter>
      </FPSDiveProvider>
    </I18nextProvider>
  );
}

export default App;