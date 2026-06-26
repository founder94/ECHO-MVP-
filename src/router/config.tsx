import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import PortfolioPage from "../pages/portfolio/page";
import ThankYouPage from "../pages/thank-you/page";
import AdminPage from "../pages/admin/page";
import AuthPage from "../pages/auth/page";
import AboutPage from "../pages/about/page";
import ReportPage from "../pages/report/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/about",
    element: <AboutPage />,
  },
  {
    path: "/portfolio",
    element: <PortfolioPage />,
  },
  {
    path: "/thank-you",
    element: <ThankYouPage />,
  },
  {
    path: "/admin",
    element: <AdminPage />,
  },
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/report",
    element: <ReportPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;