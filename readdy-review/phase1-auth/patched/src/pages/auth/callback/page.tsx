import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { consumeReturnPath } from '@/lib/auth/returnPath';

type Phase = 'waiting' | 'failed';

const SESSION_WAIT_MS = 8000;

function oauthErrorFromUrl(): string | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    );

    const code =
      search.get('error') ??
      hash.get('error');

    if (!code) return null;

    if (code === 'access_denied') {
      return '로그인을 취소했어요.';
    }

    return '로그인을 완료하지 못했어요. 다시 시도해 주세요.';
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [phase, setPhase] =
    useState<Phase>('waiting');

  const [message, setMessage] =
    useState('');

  const handledRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (handledRef.current) return;

      // 시간 초과는 "실패 화면 표시"일 뿐 처리 종료가 아니다.
      // handledRef를 세우지 않아, 늦게 세션이 복구되면 아래 effect가 정상 복귀시킨다.
      setPhase('failed');
      setMessage(
        '로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.',
      );
    }, SESSION_WAIT_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (handledRef.current) return;

    const urlError = oauthErrorFromUrl();

    if (urlError) {
      handledRef.current = true;
      setPhase('failed');
      setMessage(urlError);
      return;
    }

    if (loading) return;

    if (user) {
      handledRef.current = true;

      navigate(
        consumeReturnPath(),
        { replace: true },
      );
    }
  }, [
    user,
    loading,
    navigate,
  ]);

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {phase === 'waiting' ? (
          <>
            <span className="inline-block w-8 h-8 border-2 border-foreground-700 border-t-foreground-50 rounded-full animate-spin mb-4" />

            <p className="text-sm text-foreground-400">
              로그인 상태를 확인하고 있어요...
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-300 mb-6">
              {message}
            </p>

            <Link
              to="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors duration-300 whitespace-nowrap"
            >
              로그인 화면으로
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
