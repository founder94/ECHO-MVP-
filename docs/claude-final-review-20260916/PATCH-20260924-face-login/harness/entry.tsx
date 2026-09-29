import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { AuthProvider } from '@/context/AuthContext';
import Login from '@/pages/login/page';
import FaceLoginSettings from '@/doit/pages/do-it/settings/FaceLoginSettings';

function Where() { const l = useLocation(); return <p id="where">{l.pathname}</p>; }
function Harness() {
  const navigate = useNavigate();
  return <div style={{ padding: 16 }}>
    <button id="h-login" onClick={async () => { const r = await supabase.auth.signInWithPassword({ email: 'qa@example.com', password: 'x' }); (window as unknown as { __pw: string }).__pw = r.error ? 'err' : 'ok'; navigate('/settings'); }}>harness: 이메일 로그인</button>
    <button id="h-logout" onClick={async () => { await supabase.auth.signOut({ scope: 'local' }); navigate('/login'); }}>harness: 로그아웃 후 로그인 화면</button>
    <button id="h-session" onClick={async () => { const { data } = await supabase.auth.getSession(); (window as unknown as { __session: string }).__session = data.session?.user?.id ?? 'none'; }}>harness: 세션 확인</button>
  </div>;
}
createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={['/start']}>
      <Where />
      <Harness />
      <Routes>
        <Route path="/start" element={<p>시작</p>} />
        <Route path="/settings" element={<div className="do-it-app doit-product"><div className="doit-settings"><FaceLoginSettings /></div></div>} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p id="home">홈(로그인 뒤)</p>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>,
);
