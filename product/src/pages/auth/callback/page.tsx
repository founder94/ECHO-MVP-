import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { consumeReturnPath } from '@/lib/auth/returnPath';
import '@/components/state-screens.css';

// Google OAuth 콜백: Supabase 클라이언트(detectSessionInUrl)가 주소의 세션 정보를 복원한다.
// 이 화면은 세션이 생기면 안전한 내부 경로로 돌려보내고, 취소·실패면 명시적으로 알린다.
type Phase = 'waiting' | 'failed';

const SESSION_WAIT_MS = 8000;

function oauthErrorFromUrl(): string | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = search.get('error') ?? hash.get('error');
    if (!code) return null;
    if (code === 'access_denied') return '로그인을 취소했어요.';
    return '로그인을 완료하지 못했어요. 다시 시도해 주세요.';
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [message, setMessage] = useState('');
  // 콜백을 두 번 처리하지 않도록 가드한다(성공·실패 중 하나만 실행).
  const handledRef = useRef(false);

  // 전체 제한시간: 화면 진입과 동시에 시작. 세션 복원이 끝나지 않아도 무한 대기를 막는다.
  // 다만 timeout 이후에도 세션이 늦게 복구되면 성공 이동을 허용해야 하므로 handledRef는 건드리지 않는다.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (handledRef.current) return;
      setPhase('failed');
      setMessage('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.');
    }, SESSION_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (handledRef.current) return;

    // 취소·실패가 URL에 남아 있으면 바로 안내한다.
    const urlError = oauthErrorFromUrl();
    if (urlError) {
      handledRef.current = true;
      setPhase('failed');
      setMessage(urlError);
      return;
    }

    // 아직 세션 복원 중이면 대기(전체 제한시간이 안전망).
    if (loading) return;

    if (user) {
      handledRef.current = true;
      // 성공: URL의 인증·오류 정보를 지우고(replace) 안전한 내부 경로로 이동.
      // 뒤로가기로 인증 정보가 다시 실행되지 않도록 replace로 이동한다.
      navigate(consumeReturnPath(), { replace: true });
    }
    // loading이 끝났는데 user가 없으면 세션이 아직 없음 → 전체 제한시간이 실패로 처리한다.
  }, [user, loading, navigate]);

  // 2026-10-04: 인증 대기·실패 화면만 앱 틀(민트 + 짙은 청록 유리)로. 위의 인증·이동 로직은 그대로.
  return (
    <main className="echo-state">
      <section className="echo-state-panel" role={phase === 'waiting' ? 'status' : 'alert'}>
        {phase === 'waiting' ? (
          <>
            <span className="echo-state-spinner" aria-hidden="true" />
            <p style={{ margin: 0 }}>로그인 상태를 확인하고 있어요.</p>
          </>
        ) : (
          <>
            <h1>로그인을 마치지 못했어요.</h1>
            <p>{message}</p>
            <Link to="/login" className="echo-state-action">로그인 화면으로</Link>
          </>
        )}
      </section>
    </main>
  );
}