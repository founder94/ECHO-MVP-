// next/navigation 대체: react-router-dom.
import { useLocation, useNavigate } from 'react-router-dom';

// Next 의 usePathname 과 같이 해시(#…)는 빼고 경로만 돌려준다. 2026-10-09 Codex 검수(19f01bc): 해시를 붙이면 휴대폰 메뉴가
// 「홈」(/) 을 다른 페이지로 보고 router.push 만 해 맨 위로 올라가지 않았다(같은 페이지면 lenis 로 0 까지 굴려야 함).
export function usePathname(): string {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (to: string) => navigate(to),
    replace: (to: string) => navigate(to, { replace: true }),
    back: () => navigate(-1),
    prefetch: (_to: string) => undefined,
  };
}
