// next/dynamic 대체: React.lazy + Suspense. { ssr: false } 는 Vite 에서 의미 없음(항상 클라이언트).
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

interface Options { ssr?: boolean; loading?: () => ReactNode }

export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>, opts: Options = {}): ComponentType<P> {
  const L = lazy(async () => {
    const m = await loader();
    return 'default' in (m as object) ? (m as { default: ComponentType<P> }) : { default: m as ComponentType<P> };
  });
  return function Dynamic(props: P) {
    return <Suspense fallback={opts.loading ? opts.loading() : null}><L {...(props as P & object)} /></Suspense>;
  };
}
