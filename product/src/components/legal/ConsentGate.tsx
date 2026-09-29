import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isConsentGateOpenPath } from '@/lib/legal/gatePaths';

// 로그인한 회원인데 현재 버전 약관 동의가 서버에 없으면 제품 화면 대신 /legal/consent 로 보낸다.
// - 공개 화면(홈·문서·로그인·가입·인증 복귀·운영센터)은 막지 않는다(lib/legal/gatePaths).
// - 동의 여부를 조회하지 못한 상태('unknown')는 막지 않는다(연결 문제로 사용자를 가두지 않는 구제).

export default function ConsentGate() {
  const { user, consentStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || consentStatus !== 'required') return;
    if (isConsentGateOpenPath(location.pathname)) return;
    navigate('/legal/consent', { replace: true, state: { from: `${location.pathname}${location.search}` } });
  }, [user, consentStatus, location.pathname, location.search, navigate]);

  return null;
}
