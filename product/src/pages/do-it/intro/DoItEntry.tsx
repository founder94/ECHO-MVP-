import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { hasSeenIntro } from '@/pages/do-it/intro/introSeen';
import { useAuth } from '@/context/AuthContext';
import { IS_BRAND_SITE, appUrl } from '@/lib/siteRole';

interface Props { landing: ReactElement }

// 전역 CSS 를 건드리지 않는 최소 대기 화면(검은 배경 위 한 줄).
const WAIT_STYLE: CSSProperties = { minHeight: '100svh', margin: 0, display: 'grid', placeItems: 'center', background: '#000', color: '#c4c4c4', fontSize: 13 };

// 로그인 복귀 토큰이 주소 # 뒤에 실려 온 경우. Supabase 가 허용 목록에 없는 복귀 주소를 받으면 Site URL(이 사이트 루트)로 떨어뜨린다.
const OAUTH_TOKEN_HASH = /(^|[#&])access_token=/;
function landedWithOAuthTokens(): boolean {
  try { return OAUTH_TOKEN_HASH.test(window.location.hash); } catch { return false; }
}
// 2026-10-10: 지금 로그인은 PKCE 라 복귀 정보가 # 이 아니라 ?code= 로 온다. 루트로 떨어진 code 는 로그인 복귀 화면(/auth/callback)이
// 주소 그대로 이어받는다(돌아갈 경로·「다른 창」 안내를 거기서 처리). 코드 교환은 SDK 가 처음 열릴 때 이미 시작했으므로 여기서 하지 않는다.
function oauthCodeQuery(): string | null {
  try { return new URLSearchParams(window.location.search).get('code') ? window.location.search : null; } catch { return null; }
}

// 메인 진입(/): 이 세션에서 온보딩을 아직 안 봤으면 심볼 온보딩으로, 봤으면 바로 랜딩.
// 랜딩은 첫 화면 번들에 그대로 남는다(지연 불러오기로 바꾸지 않는다).
export default function DoItEntry({ landing }: Props) {
  const [oauthLanding] = useState(landedWithOAuthTokens);
  const [codeQuery] = useState(oauthCodeQuery);
  if (codeQuery) return <OAuthCodeLanding query={codeQuery} />;
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
  if (loading || user) return <p role="status" style={WAIT_STYLE}>로그인 상태를 확인하고 있어요.</p>;
  return landing;
}

// 브랜드 사이트에는 로그인 화면이 없다(로그인은 앱 주소에서 시작했다) → 앱 주소의 /auth/callback 으로 넘긴다.
function OAuthCodeLanding({ query }: { query: string }) {
  useEffect(() => {
    if (IS_BRAND_SITE) window.location.replace(appUrl(`/auth/callback${query}`));
  }, [query]);
  if (IS_BRAND_SITE) return <p role="status" style={WAIT_STYLE}>로그인 상태를 확인하고 있어요.</p>;
  return <Navigate to={`/auth/callback${query}`} replace />;
}
