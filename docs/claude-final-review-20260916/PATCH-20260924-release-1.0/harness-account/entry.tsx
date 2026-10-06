import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { AuthProvider } from '@/doit/hooks/useAuth';
import Settings from '@/doit/pages/do-it/settings/page';
import Spaces from '@/doit/pages/do-it/spaces/page';

function Where() { const l = useLocation(); return <p id="where">{l.pathname}</p>; }
function Harness() {
  const navigate = useNavigate();
  return <div style={{ padding: 8 }}>
    <button id="h-login" onClick={async () => { await supabase.auth.signInWithPassword({ email: 'qa@example.com', password: 'x' }); try { localStorage.setItem('doit:request:11111111-1111-4111-8111-111111111111:abc', '1'); localStorage.setItem('doit:other', '1'); } catch { /* */ } navigate('/doit/settings'); }}>harness: 로그인</button>
    <button id="h-session" onClick={async () => { const { data } = await supabase.auth.getSession(); (window as unknown as { __session: string }).__session = data.session?.user?.id ?? 'none'; }}>harness: 세션</button>
    <button id="h-nav" onClick={() => navigate('/doit/spaces')}>harness: 메뉴 보기</button>
  </div>;
}
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={['/start']}>
      <Where />
      <Harness />
      <Routes>
        <Route path="/start" element={<p>시작</p>} />
        <Route path="/doit/settings" element={<Settings />} />
        <Route path="/doit/spaces" element={<Spaces />} />
        <Route path="/login" element={<p>로그인 화면</p>} />
        <Route path="/" element={<p id="home">처음 화면</p>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>,
);
