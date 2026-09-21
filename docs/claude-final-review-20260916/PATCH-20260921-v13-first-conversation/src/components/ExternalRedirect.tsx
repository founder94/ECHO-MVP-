import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { appUrl } from '@/lib/siteRole';

// 브랜드 사이트(do-it.company)에서 제품 경로(/doit/…, /login 등)로 들어오면 같은 경로의 앱 주소로 보낸다.
// 화면을 그리지 않고 바로 이동한다. 뒤로가기로 브랜드 사이트에 남는 빈 화면이 생기지 않도록 replace 를 쓴다.
export default function ExternalRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(appUrl(`${location.pathname}${location.search}`));
  }, [location.pathname, location.search]);
  return null;
}
