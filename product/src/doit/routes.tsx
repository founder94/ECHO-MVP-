import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from "react";

const DoitApp = lazy(() => import("@/doit/DoitApp"));
const Fortune = lazy(() => import("@/doit/pages/do-it/fortune/page"));
const DoItHome = lazy(() => import("@/doit/pages/do-it/home/page"));
const FirstRecord = lazy(() => import("@/doit/pages/do-it/first-record/page"));
const Review = lazy(() => import("@/doit/pages/do-it/review/page"));
const Understanding = lazy(() => import("@/doit/pages/do-it/understanding/page"));
const Timeline = lazy(() => import("@/doit/pages/do-it/timeline/page"));
const Value = lazy(() => import("@/doit/pages/do-it/value/page"));
const Pattern = lazy(() => import("@/doit/pages/do-it/pattern/page"));
const Memory = lazy(() => import("@/doit/pages/do-it/memory/page"));
const Spaces = lazy(() => import("@/doit/pages/do-it/spaces/page"));
const StartJourney = lazy(() => import("@/doit/pages/do-it/start-journey/page"));
const Conversation = lazy(() => import("@/doit/pages/do-it/conversation/page"));
const Choose = lazy(() => import("@/doit/pages/do-it/choose/page"));
const World = lazy(() => import("@/doit/pages/do-it/world/page"));
const Room = lazy(() => import("@/doit/pages/do-it/room/page"));
const Key = lazy(() => import("@/doit/pages/do-it/key/page"));
const KeyOrder = lazy(() => import("@/doit/pages/do-it/key/order/page"));
const KeyResult = lazy(() => import("@/doit/pages/do-it/key/result/page"));
const Connections = lazy(() => import("@/doit/pages/do-it/connections/page"));
const Verify = lazy(() => import("@/doit/pages/do-it/verify/page"));
const Grade = lazy(() => import("@/doit/pages/do-it/grade/page"));
const JustTry = lazy(() => import("@/doit/pages/do-it/just-try/page"));
const Notifications = lazy(() => import("@/doit/pages/do-it/notifications/page"));
const Settings = lazy(() => import("@/doit/pages/do-it/settings/page"));
const Profile = lazy(() => import("@/doit/pages/do-it/profile/page"));
const AdminMobile = lazy(() => import("@/doit/pages/do-it/admin/page"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// DO IT(A 구조) 화면 전부는 /doit 아래에 산다. 원래 A 프로젝트의 경로에 /doit 만 앞에 붙었다.
// 예: A의 /home → /doit/home, A의 /key/order/:packageId → /doit/key/order/:packageId
const doitRoutes: RouteObject = {
  path: "/doit",
  element: <DoitApp />,
  children: [
    { index: true, element: <Navigate to="/doit/choose" replace /> },
    { path: "landing", element: <Navigate to="/doit/choose" replace /> },
    { path: "fortune", element: <Fortune /> },
    { path: "sign-up", element: <Navigate to="/doit/start-journey" replace /> },
    { path: "purpose", element: <Navigate to="/doit/start-journey" replace /> },
    { path: "verify", element: <Verify /> },
    { path: "photo", element: <Navigate to="/doit/start-journey" replace /> },
    { path: "home", element: <DoItHome /> },
    { path: "first-record", element: <FirstRecord /> },
    { path: "review", element: <Review /> },
    { path: "understanding", element: <Understanding /> },
    { path: "timeline", element: <Timeline /> },
    { path: "value", element: <Value /> },
    { path: "pattern", element: <Pattern /> },
    { path: "memory", element: <Memory /> },
    { path: "spaces", element: <Spaces /> },
    { path: "choose", element: <Choose /> },
    { path: "start-journey", element: <StartJourney /> },
    { path: "conversation", element: <Conversation /> },
    { path: "world", element: <World /> },
    { path: "room", element: <Room /> },
    { path: "grade", element: <Grade /> },
    { path: "just-try", element: <JustTry /> },
    { path: "connections", element: <Connections /> },
    { path: "key", element: <Key /> },
    { path: "key/order/:packageId", element: <KeyOrder /> },
    { path: "key/result", element: <KeyResult /> },
    { path: "notifications", element: <Notifications /> },
    { path: "settings", element: <Settings /> },
    { path: "profile", element: <Profile /> },
    { path: "admin/mobile", element: <AdminMobile /> },
    { path: "*", element: <NotFound /> },
  ],
};

export default doitRoutes;
