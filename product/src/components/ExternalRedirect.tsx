import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ADMIN_ORIGIN, appUrl } from '@/lib/siteRole';

// 브랜드 사이트(do-it.company)에서 제품 경로(/doit/…, /login 등)로 들어오면 같은 경로의 앱 주소로 보낸다.
// 화면을 그리지 않고 바로 이동한다. 뒤로가기로 브랜드 사이트에 남는 빈 화면이 생기지 않도록 replace 를 쓴다.
// 주소의 # 뒷부분(hash)도 함께 넘긴다. 로그인 복귀 토큰이 # 뒤에 실려 올 수 있어 떼면 로그인이 끊긴다.
export default function ExternalRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(appUrl(`${location.pathname}${location.search}`) + (location.hash || ''));
  }, [location.pathname, location.search, location.hash]);
  return null;
}

// 2026-09-28 대표 「ADMIN WEB」: 사용자 앱 주소로 관리자 경로에 들어오면 관리자 주소 첫 화면으로 보낸다(앱에는 관리자 화면·자료가 없다).
export function AdminRedirect() {
  useEffect(() => { window.location.replace(`${ADMIN_ORIGIN}/`); }, []);
  return null;
}
