import { Navigate, type RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import DoItLandingPage from '@/pages/do-it/landing/page';

// A구조 서브앱(/doit/*) — 7화면 흐름(첫 기록 → 확인·수정 → 홈 → 타임라인 → 가치 → 패턴 → 선택 기억)
import doitRoutes from '@/doit/routes';

// 2026-09-20 대표 확정: 메인 진입(/)에서 B 홈(마음의 날씨)을 내린다.
// 예전 홈은 지우지 않고 /home 에 남기되, 지연 불러오기로 바꿔 첫 화면 번들에서 빠지게 한다.
const Home = lazy(() => import('@/pages/home/page'));
const StartPage = lazy(() => import('@/pages/do-it/start/page'));
const Signup = lazy(() => import('@/pages/signup/page'));
const Login = lazy(() => import('@/pages/login/page'));
const AuthCallbackPage = lazy(() => import('@/pages/auth/callback/page'));
// 약관·개인정보 문서와 기존 회원 동의 화면(2026-09-21)
const TermsPage = lazy(() => import('@/pages/legal/terms/page'));
const PrivacyPage = lazy(() => import('@/pages/legal/privacy/page'));
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
const DoItHeroPage = lazy(() => import('@/pages/do-it/hero/page'));
// 2026-09-21 대표 지시: 심볼 온보딩(1%→100%)을 다시 연결한다. 한 브라우저 세션에 한 번만 재생하고, 그 뒤 / 는 바로 랜딩이다.
const DoItIntroPage = lazy(() => import('@/pages/do-it/intro/page'));
import DoItEntry from '@/pages/do-it/intro/DoItEntry';
const FortunePage = lazy(() => import('@/pages/do-it/fortune/page'));
const PhotoPage = lazy(() => import('@/pages/do-it/photo/page'));
const GradePage = lazy(() => import('@/pages/do-it/grade/page'));
const AdminLoginPage = lazy(() => import('@/pages/admin/login/page'));
const AdminMobilePage = lazy(() => import('@/pages/admin/page'));
const ComingSoonPage = lazy(() => import('@/pages/coming-soon/page'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// QA 검사 도구(/qa/doit-understanding) — 제품 기능이 아니다.
// VITE_QA_HARNESS=true 로 빌드했을 때만 라우트를 등록한다. 일반 빌드에는 이 화면 코드가 들어가지 않는다.
// 이건 "노출 제어"이지 보안 경계가 아니다. 실제 경계는 서버(doit-understanding)의 verify_jwt → getUser() → 인증 uid → RPC/RLS 다.
// lazy() 자체를 조건 안에 둬야 일반 빌드에서 이 화면의 코드 조각이 아예 만들어지지 않는다.
const QA_HARNESS_ENABLED = import.meta.env.VITE_QA_HARNESS === 'true';
const QaDoitUnderstanding = QA_HARNESS_ENABLED
  ? lazy(() => import('@/qa/QaDoitUnderstanding'))
  : null;

const routes: RouteObject[] = [
  {
    // 메인 진입: 이 세션에서 온보딩을 아직 안 봤으면 심볼 온보딩(/do-it/intro), 봤으면 바로 브랜드 소개.
    path: '/',
    element: <DoItEntry landing={<DoItLandingPage />} />,
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
    path: '/legal/terms',
    element: <TermsPage />,
  },
  {
    path: '/legal/privacy',
    element: <PrivacyPage />,
  },
  {
    path: '/legal/consent',
    element: <ConsentPage />,
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
    // 예전 소개 링크도 중복 설명 없이 시작 흐름으로 연결한다. 원본 화면 파일은 보존한다.
    path: '/do-it/1',
    element: <Navigate to="/doit/start-journey" replace />,
  },
  {
    path: '/do-it/2',
    element: <Navigate to="/doit/start-journey" replace />,
  },
  {
    path: '/do-it/3',
    element: <Navigate to="/doit/start-journey" replace />,
  },
  {
    path: '/do-it/4',
    element: <Navigate to="/doit/start-journey" replace />,
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
  // QA 빌드에서만 존재한다. 일반 빌드에서는 아래 와일드카드가 받아 NotFound 가 된다.
  ...(QaDoitUnderstanding
    ? [
        {
          path: '/qa/doit-understanding',
          element: <QaDoitUnderstanding />,
        } as RouteObject,
      ]
    : []),
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
