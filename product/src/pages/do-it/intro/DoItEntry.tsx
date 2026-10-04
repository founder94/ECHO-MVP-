import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { hasSeenIntro } from '@/pages/do-it/intro/introSeen';
import { useAuth } from '@/context/AuthContext';
import { IS_BRAND_SITE, appUrl } from '@/lib/siteRole';

interface Props { landing: ReactElement }

// 전역 CSS 를 건드리지 않는 최소 대기 화면(검은 배경 위 한 줄).
const WAIT_STYLE: CSSProperties = { minHeight: '100svh', margin: 0, display: 'grid', placeItems: 'center', background: '#000', color: '#c4c4c4', fontSize: 13 };

// 앱(app.do-it.company)의 같은 대기 화면: 검정 대신 파스텔 + 밝은 파스텔 위라 어두운 청록 글자 16px(대비 7:1 이상).
const APP_WAIT_STYLE: CSSProperties = { ...WAIT_STYLE, background: 'linear-gradient(180deg,#3fdcb3,#7be5ca 50%,#e0927d)', color: '#053a44', fontSize: 16, padding: 24, textAlign: 'center' };

// 로그인 복귀 토큰이 주소 # 뒤에 실려 온 경우. Supabase 가 허용 목록에 없는 복귀 주소를 받으면 Site URL(이 사이트 루트)로 떨어뜨린다.
const OAUTH_TOKEN_HASH = /(^|[#&])access_token=/;
function landedWithOAuthTokens(): boolean {
  try { return OAUTH_TOKEN_HASH.test(window.location.hash); } catch { return false; }
}

// 메인 진입(/): 이 세션에서 온보딩을 아직 안 봤으면 심볼 온보딩으로, 봤으면 바로 랜딩.
// 랜딩은 첫 화면 번들에 그대로 남는다(지연 불러오기로 바꾸지 않는다).
export default function DoItEntry({ landing }: Props) {
  const [oauthLanding] = useState(landedWithOAuthTokens);
  if (oauthLanding) return <OAuthLanding landing={landing} />;
  if (!hasSeenIntro()) return <Navigate to="/do-it/intro" replace />;
  return landing;
}

// 로그인 복귀가 루트로 떨어진 경우: 세션이 잡히면 온보딩 없이 시작 흐름으로 보낸다(브랜드 사이트면 앱 주소로).
// 세션이 안 잡히면(취소·만료) 평소처럼 랜딩을 보여 준다. 사용자를 빈 화면에 두지 않는다.
function OAuthLanding({ landing }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !user) return;
    if (IS_BRAND_SITE) window.location.replace(appUrl('/doit/start-journey'));
    else navigate('/doit/start-journey', { replace: true });
  }, [user, loading, navigate]);
  if (loading || user) return <p role="status" style={IS_BRAND_SITE ? WAIT_STYLE : APP_WAIT_STYLE}>로그인 상태를 확인하고 있어요.</p>;
  return landing;
}
