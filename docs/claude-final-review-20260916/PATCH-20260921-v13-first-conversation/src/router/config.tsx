import { Navigate, type RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import DoItLandingPage from '@/pages/do-it/landing/page';
import DoItEntry from '@/pages/do-it/intro/DoItEntry';
import ExternalRedirect from '@/components/ExternalRedirect';

// A구조 서브앱(/doit/*) — 7화면 흐름(첫 기록 → 확인·수정 → 홈 → 타임라인 → 가치 → 패턴 → 선택 기억)
import doitRoutes from '@/doit/routes';

// ── 사이트 역할 (대표 확정 2026-09-21) ────────────────────────────────────────
// brand = do-it.company(브랜딩만) / app = app.do-it.company(제품 전부) / 없음 = 통합(7차까지의 검사 환경).
// import.meta.env 를 이 파일에서 직접 비교해야 빌드가 역할에 없는 화면의 lazy 조각을 만들지 않는다(QA 도구와 같은 방식).
const ROLE = import.meta.env.VITE_SITE_ROLE;
const PRODUCT = ROLE !== 'brand'; // 제품 화면을 등록하는가
const BRAND = ROLE !== 'app'; // 브랜드 화면(온보딩·랜딩·히어로)을 등록하는가

// 심볼 온보딩(1%→100%)·약관 문서·준비 중·NotFound 는 두 사이트 모두.
const DoItIntroPage = lazy(() => import('@/pages/do-it/intro/page'));
const TermsPage = lazy(() => import('@/pages/legal/terms/page'));
const PrivacyPage = lazy(() => import('@/pages/legal/privacy/page'));
const ComingSoonPage = lazy(() => import('@/pages/coming-soon/page'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// 브랜드 사이트로 들어온 제품 경로는 같은 경로의 앱 주소로 보낸다(화면 없이 이동).
const PRODUCT_PATHS_ON_BRAND = [
  '/home', '/start', '/signup', '/login', '/auth/*', '/legal/consent',
  '/weather', '/weather-check', '/story-start', '/step/*', '/understanding-check', '/white-door',
  '/payment/*', '/payment', '/report', '/locker', '/next-journey',
  '/doit/*', '/doit', '/do-it/1', '/do-it/2', '/do-it/3', '/do-it/4', '/do-it/fortune', '/do-it/photo', '/do-it/grade',
  '/admin/*', '/admin',
];

// 브랜드 화면 표. 함수 안의 lazy() 는 이 함수가 쓰이지 않는 빌드(app)에서 통째로 빠진다.
function brandRouteTable(): RouteObject[] {
  const DoItHeroPage = lazy(() => import('@/pages/do-it/hero/page'));
  return [
    { path: '/do-it/hero', element: <DoItHeroPage /> },
    { path: '/do-it/landing', element: <DoItLandingPage /> },
  ];
}

// 제품 화면 표. 브랜드 빌드에서는 이 함수가 쓰이지 않아 아래 화면들의 코드 조각이 만들어지지 않는다.
function productRouteTable(): RouteObject[] {
  // 2026-09-20 대표 확정: 메인 진입(/)에서 B 홈(마음의 날씨)을 내린다. 예전 홈은 /home 에 지연 불러오기로만 남긴다.
  const Home = lazy(() => import('@/pages/home/page'));
  const StartPage = lazy(() => import('@/pages/do-it/start/page'));
  const Signup = lazy(() => import('@/pages/signup/page'));
  const Login = lazy(() => import('@/pages/login/page'));
  const AuthCallbackPage = lazy(() => import('@/pages/auth/callback/page'));
  const ConsentPage = lazy(() => import('@/pages/legal/consent/page'));
  const WeatherPage = lazy(() => import('@/pages/do-it/weather/page'));
  const WeatherCheckPage = lazy(() => import('@/pages/do-it/weather-check/page'));
  const StoryStartPage = lazy(() => import('@/pages/do-it/story-start/page'));
  const StepTwoPage = lazy(() => import('@/pages/do-it/step-2/page'));
  const UnderstandingCheckPage = lazy(() => import('@/pages/do-it/understanding-check/page'));
  const WhiteDoorPage = lazy(() => import('@/pages/do-it/white-door/page'));
  const PaymentPage = lazy(() => import('@/pages/do-it/payment/page'));
  const PaymentSuccessPage = lazy(() => import('@/pages/do-it/payment/success/page'));
  const PaymentFailPage = lazy(() => import('@/pages/do-it/payment/fail/page'));
  const StepNPage = lazy(() => import('@/pages/do-it/step-n/page'));
  const ReportPage = lazy(() => import('@/pages/do-it/report/page'));
  const LockerPage = lazy(() => import('@/pages/do-it/locker/page'));
  const NextJourneyPage = lazy(() => import('@/pages/do-it/next-journey/page'));
  const FortunePage = lazy(() => import('@/pages/do-it/fortune/page'));
  const PhotoPage = lazy(() => import('@/pages/do-it/photo/page'));
  const GradePage = lazy(() => import('@/pages/do-it/grade/page'));
  const AdminLoginPage = lazy(() => import('@/pages/admin/login/page'));
  const AdminMobilePage = lazy(() => import('@/pages/admin/page'));
  // QA 검사 도구(/qa/doit-understanding) — 제품 기능이 아니다. VITE_QA_HARNESS=true 로 빌드했을 때만 라우트를 등록한다.
  // 이건 "노출 제어"이지 보안 경계가 아니다. 실제 경계는 서버(doit-understanding)의 verify_jwt → getUser() → 인증 uid → RPC/RLS 다.
  const QaDoitUnderstanding = import.meta.env.VITE_QA_HARNESS === 'true' ? lazy(() => import('@/qa/QaDoitUnderstanding')) : null;
  return [
    { path: '/home', element: <Home /> },
    { path: '/start', element: <StartPage /> },
    { path: '/signup', element: <Signup /> },
    { path: '/login', element: <Login /> },
    { path: '/auth/callback', element: <AuthCallbackPage /> },
    { path: '/legal/consent', element: <ConsentPage /> },
    { path: '/weather', element: <WeatherPage /> },
    { path: '/weather-check', element: <WeatherCheckPage /> },
    { path: '/story-start', element: <StoryStartPage /> },
    { path: '/step/2', element: <StepTwoPage /> },
    { path: '/understanding-check', element: <UnderstandingCheckPage /> },
    { path: '/white-door', element: <WhiteDoorPage /> },
    { path: '/payment', element: <PaymentPage /> },
    { path: '/payment/success', element: <PaymentSuccessPage /> },
    { path: '/payment/fail', element: <PaymentFailPage /> },
    { path: '/step/:n', element: <StepNPage /> },
    { path: '/report', element: <ReportPage /> },
    { path: '/locker', element: <LockerPage /> },
    { path: '/next-journey', element: <NextJourneyPage /> },
    // DO IT 구조 (A구조) - 우주 배경 히어로 및 페이지
    doitRoutes,
    // 예전 소개 링크도 중복 설명 없이 시작 흐름으로 연결한다. 원본 화면 파일은 보존한다.
    { path: '/do-it/1', element: <Navigate to="/doit/start-journey" replace /> },
    { path: '/do-it/2', element: <Navigate to="/doit/start-journey" replace /> },
    { path: '/do-it/3', element: <Navigate to="/doit/start-journey" replace /> },
    { path: '/do-it/4', element: <Navigate to="/doit/start-journey" replace /> },
    // A구조 기능 화면 (사주·타로 / 사진 / 등급)
    { path: '/do-it/fortune', element: <FortunePage /> },
    { path: '/do-it/photo', element: <PhotoPage /> },
    { path: '/do-it/grade', element: <GradePage /> },
    // 관리자 운영센터(와일드카드보다 앞에 위치)
    { path: '/admin', element: <Navigate to="/admin/mobile" replace /> },
    { path: '/admin/login', element: <AdminLoginPage /> },
    { path: '/admin/mobile', element: <AdminMobilePage /> },
    // QA 빌드에서만 존재한다. 일반 빌드에서는 와일드카드가 받아 NotFound 가 된다.
    ...(QaDoitUnderstanding ? [{ path: '/qa/doit-understanding', element: <QaDoitUnderstanding /> } as RouteObject] : []),
  ];
}

// 메인 진입(/): 이 세션에서 온보딩을 아직 안 봤으면 심볼 온보딩(/do-it/intro), 봤으면 브랜드는 랜딩, 앱은 시작 흐름.
// v14.2(대표 2026-09-22 "메인 페이지에서 시작을 해야 하는데 로그인이 되어 있다는 이유만으로 여기서 시작하는 건지"):
// 앱의 메인(/)은 시작 흐름이 아니라 **앱 홈**(하단 탭이 있는 화면)이다.
// 전에는 / → start-journey → (로그인돼 있으면 자동으로) 대화로 replace 이동해서,
// 메인 화면이 아예 없었고 뒤로가기도 안 됐다(두 번 다 replace 였다).
const entryLanding = BRAND ? <DoItLandingPage /> : <Navigate to="/doit/home" replace />;
// 앱에는 랜딩·히어로가 없다. 예전 링크는 시작 흐름으로.
const brandRoutes: RouteObject[] = BRAND ? brandRouteTable() : [
  { path: '/do-it/hero', element: <Navigate to="/" replace /> },
  { path: '/do-it/landing', element: <Navigate to="/" replace /> },
];
const productRoutes: RouteObject[] = PRODUCT ? productRouteTable() : PRODUCT_PATHS_ON_BRAND.map((path) => ({ path, element: <ExternalRedirect /> }));

const routes: RouteObject[] = [
  { path: '/', element: <DoItEntry landing={entryLanding} /> },
  { path: '/do-it/intro', element: <DoItIntroPage /> },
  { path: '/legal/terms', element: <TermsPage /> },
  { path: '/legal/privacy', element: <PrivacyPage /> },
  ...brandRoutes,
  ...productRoutes,
  { path: '/coming-soon/:feature', element: <ComingSoonPage /> },
  { path: '*', element: <NotFound /> },
];

export default routes;
