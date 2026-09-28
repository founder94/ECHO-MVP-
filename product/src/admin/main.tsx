// ADMIN WEB 입구(VITE_SITE_ROLE=admin 빌드에서만 쓰인다 — vite.config 가 index.html 의 입구를 이 파일로 바꾼다).
// 사용자 앱(App.tsx)·브랜드 화면은 이 빌드 묶음에 들어가지 않는다.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';
import { AuthProvider } from '@/context/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminApp from './AdminApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AdminApp />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
