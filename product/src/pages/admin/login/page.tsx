import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase/client';
import '../admin.css';

// 관리자 로그인 화면. 일반 사용자와 같은 Google OAuth 흐름 하나를 공용으로 사용한다.
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, user, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  // 이미 관리자로 로그인돼 있으면 운영센터로 바로 이동
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.role === 'admin') {
          navigate('/admin/mobile', { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [loading, user, navigate]);

  const handleGoogle = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setError('');
    try {
      const result = await signInWithGoogle('/admin/mobile');
      if (result.error) {
        setError(result.error);
      }
      // 성공 시 Google로 이동하고, 돌아오면 /auth/callback → /admin/mobile 로 복귀한다.
      // 실패 시 이 화면(/admin/login)에 그대로 남아 안내한다(일반 로그인 화면으로 보내지 않음).
    } catch {
      setError('네트워크 연결을 확인해 주세요.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="echo-admin light flex min-h-dvh items-center justify-center bg-background-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-background-200 bg-background-50 p-6">
          <div className="flex items-center gap-2 text-foreground-950">
            <i className="ri-shield-line text-xl text-primary-600" />
            <h1 className="text-lg font-semibold">관리자 로그인</h1>
          </div>
          <p className="mt-2 text-sm text-foreground-600">
            ECHO · DO IT 운영센터에 접근하려면 관리자 계정으로 로그인해 주세요.
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={signingIn}
            className="mt-5 flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-60"
          >
            {signingIn ? (
              <i className="ri-loader-4-line animate-spin" />
            ) : (
              <i className="ri-google-fill" />
            )}
            {signingIn ? '로그인 진행 중...' : 'Google로 관리자 로그인'}
          </button>

          {error && (
            <p className="mt-3 rounded-md bg-primary-100 px-3 py-2 text-xs leading-relaxed text-primary-900">
              {error}
            </p>
          )}

          <div className="mt-5 rounded-md bg-secondary-50 px-3 py-3">
            <p className="text-xs leading-relaxed text-secondary-900">
              일반 사용자 계정으로 로그인하면 관리자 권한이 없어 접근이 거부됩니다.
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-foreground-500 transition hover:text-foreground-700"
          >
            <i className="ri-arrow-left-line" />
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
