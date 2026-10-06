import { useEffect } from 'react';
import AdminGuard from './components/AdminGuard';
import AdminShell from './components/AdminShell';

export default function AdminMobilePage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'ECHO · DO IT 운영센터';

    // 검색엔진 제외 처리(noindex)
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const prevContent = meta.content;
    meta.content = 'noindex, nofollow';

    return () => {
      document.title = prevTitle;
      if (meta) meta.content = prevContent;
    };
  }, []);

  return (
    <AdminGuard>
      <AdminShell />
    </AdminGuard>
  );
}