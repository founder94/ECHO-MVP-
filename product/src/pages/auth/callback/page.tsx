import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { consumeReturnPath } from '@/lib/auth/returnPath';
import { supabase } from '@/lib/supabase/client';

// Google OAuth 콜백: SDK가 이 주소에서 시작한 PKCE verifier로 인증 코드를 교환한다.
// 이 화면은 세션이 생기면 안전한 내부 경로로 돌려보내고, 취소·실패면 명시적으로 알린다.
type Phase = 'waiting' | 'failed';

const SESSION_WAIT_MS = 8000;

// 2026-10-10 갤럭시·아이폰 호환: 홈 화면 앱이 Google 로그인을 브라우저(사파리·삼성 인터넷)로 넘기면,
// 로그인을 시작한 곳의 확인값(PKCE verifier)이 돌아온 곳에 없어 코드 교환이 아예 시작되지 않는다.
// 이때는 8초를 기다려 막연한 실패를 보이는 대신, 무엇을 하면 되는지 바로 알린다.
const OTHER_WINDOW_TEXT = '로그인을 시작한 창과 다른 창으로 돌아왔어요. 앱(또는 처음 연 브라우저)으로 돌아가 다시 「Google로 시작하기」를 눌러 주세요.';

function authCodeInUrl(): boolean {
  try {
    return Boolean(new URLSearchParams(window.location.search).get('code'));
  } catch {
    return false;
  }
}

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

  // 확인값이 없어 코드 교환을 못 한 경우를 가린다. 코드는 여기서 다시 교환하지 않는다(SDK 가 처음 열릴 때 한 번만 한다).
  // SDK 첫 준비(initialize)가 끝난 뒤: 세션이 있으면 성공 흐름 그대로. 세션이 없는데 주소에 code 가 남아 있으면
  //  - 오류 없이 끝남 = SDK 가 확인값을 못 찾아 교환을 건너뜀
  //  - 오류 코드 pkce_code_verifier_not_found = 교환하려다 확인값이 없음
  // 둘 다 「다른 창」 안내. 그 밖의 오류는 지금처럼 전체 제한시간이 처리한다.
  useEffect(() => {
    if (!authCodeInUrl()) return;
    let cancelled = false;
    (async () => {
      const init = await supabase.auth.initialize();
      const { data } = await supabase.auth.getSession();
      if (cancelled || handledRef.current || data.session || !authCodeInUrl()) return;
      if (!init.error || init.error.code === 'pkce_code_verifier_not_found') {
        handledRef.current = true;
        setPhase('failed');
        setMessage(OTHER_WINDOW_TEXT);
      }
    })().catch(() => {
      /* 확인 실패는 전체 제한시간이 안전망 */
    });
    return () => {
      cancelled = true;
    };
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

  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {phase === 'waiting' ? (
          <>
            <span className="inline-block w-8 h-8 border-2 border-foreground-700 border-t-foreground-50 rounded-full animate-spin mb-4" />
            <p className="text-sm text-foreground-400">로그인 상태를 확인하고 있어요...</p>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground-300 mb-6">{message}</p>
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