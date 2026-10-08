// next/navigation 대체: react-router-dom.
import { useLocation, useNavigate } from 'react-router-dom';

export function usePathname(): string {
  const { pathname, hash } = useLocation();
  return hash ? `${pathname}${hash}` : pathname;
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
