import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const navigate = useNavigate();

  const {
    signInWithGoogle,
    user,
    loading,
  } = useAuth();

  const [signingIn, setSigningIn] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (loading || !user) return;

    let active = true;

    // 이미 로그인된 사용자: role 조회 결과를 세 갈래로 나눈다.
    // admin → 운영센터 이동 / 비관리자 → 안내 / 조회 실패 → 안내 (권한 없음과 구분)
    // 이전 코드는 조회 실패 시 unhandled rejection, 비관리자는 아무 표시 없이 대기했다.
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setError('권한을 확인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.');
          return;
        }

        if (data?.role === 'admin') {
          navigate('/admin/mobile', { replace: true });
          return;
        }

        setError('관리자 권한이 없는 계정이에요. 관리자 계정으로 다시 로그인해 주세요.');
      } catch {
        if (active) {
          setError('권한을 확인하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    loading,
    user,
    navigate,
  ]);

  const handleGoogle = async () => {
    if (signingIn) return;

    setSigningIn(true);
    setError('');

    try {
      const result =
        await signInWithGoogle('/admin/mobile');

      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError(
        '네트워크 연결을 확인해 주세요.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="light flex min-h-dvh items-center justify-center bg-background-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-background-200 bg-background-50 p-6">
          <div className="flex items-center gap-2 text-foreground-950">
            <i className="ri-shield-line text-xl text-primary-600" />
            <h1 className="text-lg font-semibold">
              관리자 로그인
            </h1>
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

            {signingIn
              ? '로그인 진행 중...'
              : 'Google로 관리자 로그인'}
          </button>

          {error && (
            <p className="mt-3 rounded-md bg-primary-100 px-3 py-2 text-xs leading-relaxed text-primary-900">
              {error}
            </p>
          )}
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
