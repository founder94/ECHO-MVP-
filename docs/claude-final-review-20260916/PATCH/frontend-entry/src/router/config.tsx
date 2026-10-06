import { Navigate, type RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import { MAIN_ENTRY_PATH } from '@/lib/echo/appMode';

// A구조 서브앱(/doit/*) — 7화면 흐름(첫 기록 → 확인·수정 → 홈 → 타임라인 → 가치 → 패턴 → 선택 기억)
import doitRoutes from '@/doit/routes';

// 2026-09-20 대표 확정: 메인 진입(/)에서 B 홈(마음의 날씨)을 내린다.
// 예전 홈은 지우지 않고 /home 에 남기되, 지연 불러오기로 바꿔 첫 화면 번들에서 빠지게 한다.
const Home = lazy(() => import('@/pages/home/page'));
const StartPage = lazy(() => import('@/pages/do-it/start/page'));
const Signup = lazy(() => import('@/pages/signup/page'));
const Login = lazy(() => import('@/pages/login/page'));
const AuthCallbackPage = lazy(() => import('@/pages/auth/callback/page'));
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
const DoItIntroPage = lazy(() => import('@/pages/do-it/intro/page'));
const DoItHeroPage = lazy(() => import('@/pages/do-it/hero/page'));
const DoItLandingPage = lazy(() => import('@/pages/do-it/landing/page'));
const DoItPage1 = lazy(() => import('@/pages/do-it/1/page'));
const DoItPage2 = lazy(() => import('@/pages/do-it/2/page'));
const DoItPage3 = lazy(() => import('@/pages/do-it/3/page'));
const DoItPage4 = lazy(() => import('@/pages/do-it/4/page'));
const FortunePage = lazy(() => import('@/pages/do-it/fortune/page'));
const PhotoPage = lazy(() => import('@/pages/do-it/photo/page'));
const GradePage = lazy(() => import('@/pages/do-it/grade/page'));
const AdminLoginPage = lazy(() => import('@/pages/admin/login/page'));
const AdminMobilePage = lazy(() => import('@/pages/admin/page'));
const ComingSoonPage = lazy(() => import('@/pages/coming-soon/page'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const routes: RouteObject[] = [
  {
    // 메인 진입: Plan A 소개 흐름(랜딩 9구간 → 우주인 4장 → 목적 선택)
    path: '/',
    element: <Navigate to={MAIN_ENTRY_PATH} replace />,
  },
  {
    // 예전 B 홈(보존용). 메인 진입이 아니며 어떤 화면도 여기로 보내지 않는다.
    path: '/home',
    element: <Home />,
  },
  {
    path: '/start',
    element: <StartPage />,
  },
  {
    path: '/signup',
    element: <Signup />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/weather',
    element: <WeatherPage />,
  },
  {
    path: '/weather-check',
    element: <WeatherCheckPage />,
  },
  {
    path: '/story-start',
    element: <StoryStartPage />,
  },
  {
    path: '/step/2',
    element: <StepTwoPage />,
  },
  {
    path: '/understanding-check',
    element: <UnderstandingCheckPage />,
  },
  {
    path: '/white-door',
    element: <WhiteDoorPage />,
  },
  {
    path: '/payment',
    element: <PaymentPage />,
  },
  {
    path: '/payment/success',
    element: <PaymentSuccessPage />,
  },
  {
    path: '/payment/fail',
    element: <PaymentFailPage />,
  },
  {
    path: '/step/:n',
    element: <StepNPage />,
  },
  {
    path: '/report',
    element: <ReportPage />,
  },
  {
    path: '/locker',
    element: <LockerPage />,
  },
  {
    path: '/next-journey',
    element: <NextJourneyPage />,
  },
  // DO IT 구조 (A구조) - 우주 배경 히어로 및 페이지
  doitRoutes,
  {
    path: '/do-it/intro',
    element: <DoItIntroPage />,
  },
  {
    path: '/do-it/hero',
    element: <DoItHeroPage />,
  },
  {
    path: '/do-it/landing',
    element: <DoItLandingPage />,
  },
  {
    path: '/do-it/1',
    element: <DoItPage1 />,
  },
  {
    path: '/do-it/2',
    element: <DoItPage2 />,
  },
  {
    path: '/do-it/3',
    element: <DoItPage3 />,
  },
  {
    path: '/do-it/4',
    element: <DoItPage4 />,
  },
  // A구조 기능 화면 (사주·타로 / 사진 6장 / 등급)
  {
    path: '/do-it/fortune',
    element: <FortunePage />,
  },
  {
    path: '/do-it/photo',
    element: <PhotoPage />,
  },
  {
    path: '/do-it/grade',
    element: <GradePage />,
  },
  // 관리자 운영센터(와일드카드보다 앞에 위치)
  {
    path: '/admin',
    element: <Navigate to="/admin/mobile" replace />,
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/admin/mobile',
    element: <AdminMobilePage />,
  },
  {
    path: '/coming-soon/:feature',
    element: <ComingSoonPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
