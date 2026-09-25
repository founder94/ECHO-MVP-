import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import '../admin.css';

// 관리자 권한 가드. 화면을 숨기는 것만으로 보호하지 않고,
// Supabase RLS(profiles.role='admin')와 UI 가드를 함께 사용한다.
// 상태 5종: 확인 중 / 로그인 필요 / 권한 없음 / 불러오기 실패 / 접근 허용.
type GuardState = 'checking' | 'signed_out' | 'denied' | 'error' | 'ok';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<GuardState>('checking');
  const [email, setEmail] = useState<string | null>(null);

  // 실제 사용자를 다시 확인(getUser)하고, 그 UUID와 같은 profiles 행의 role이 'admin'인 경우만 허용.
  const check = useCallback(async () => {
    setState('checking');

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    if (userError || !user) {
      setEmail(null);
      setState('signed_out');
      return;
    }

    setEmail(user.email ?? null);

    // 프로필 키는 id(uuid). role 컬럼이 정확히 'admin'인지 확인(DB is_admin() 함수와 동일 기준).
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setState('error');
      return;
    }
    if (!data) {
      setState('denied');
      return;
    }
    setState(data.role === 'admin' ? 'ok' : 'denied');
  }, []);

  useEffect(() => {
    void check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        // 세션 만료·로그아웃 시 즉시 본문 제거(메모리 캐시 정리)
        setEmail(null);
        setState('signed_out');
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void check();
      }
    });

    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [check]);

  // 로그인 필요 상태: 관리자 로그인 화면으로 이동
  useEffect(() => {
    if (state === 'signed_out') {
      navigate('/admin/login', { replace: true });
    }
  }, [state, navigate]);

  if (state === 'checking' || state === 'signed_out') {
    return (
      <div className="echo-admin light flex min-h-dvh items-center justify-center bg-background-50 px-4">
        <div className="flex flex-col items-center gap-3 text-foreground-600">
          <i className="ri-loader-4-line animate-spin text-3xl" />
          <p className="text-sm">관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="echo-admin light flex min-h-dvh items-center justify-center bg-background-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-6 text-center">
          <i className="ri-lock-line text-3xl text-foreground-400" />
          <h1 className="mt-3 text-lg font-semibold text-foreground-950">관리자 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-foreground-600">
            현재 계정({email ?? '—'})은 관리자가 아니어서 운영센터에 접근할 수 없습니다.
          </p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-background-200 px-4 py-2 text-sm font-medium text-foreground-900 transition hover:bg-background-300"
          >
            <i className="ri-logout-box-line" />
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="echo-admin light flex min-h-dvh items-center justify-center bg-background-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-background-200 bg-background-50 p-6 text-center">
          <i className="ri-error-warning-line text-3xl text-foreground-400" />
          <h1 className="mt-3 text-lg font-semibold text-foreground-950">권한 확인에 실패했습니다</h1>
          <p className="mt-2 text-sm text-foreground-600">
            관리자 권한을 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => void check()}
            className="mt-5 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
          >
            <i className="ri-refresh-line" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
