import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { sanitizeReturnPath } from '@/lib/auth/returnPath';
import DoItSymbol from '@/components/DoItSymbol';
import { PASSKEY_ERROR_TEXT, PASSKEY_LOGIN_ENABLED, currentPasskeySupport, signInWithFace } from '@/lib/auth/passkey';
import { authErrorText } from '@/lib/auth/authErrorText';
import '@/doit/components/feature/app-pastel.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'google' | 'face'>('idle');
  // 2026-09-24 얼굴·지문 로그인(패스키). 이 브라우저가 못 하면 버튼을 숨긴다 — 기존 로그인은 그대로(빠져나갈 문).
  const [faceSupport] = useState(currentPasskeySupport);
  const [error, setError] = useState('');

  // 로그인 후 돌아갈 곳은 안전한 내부 경로만 허용한다(외부 주소·스킴은 '/'로 대체).
  const from = sanitizeReturnPath((location.state as { from?: string } | null)?.from);

  const handleGoogle = async () => {
    if (status !== 'idle') return;
    setStatus('google');
    setError('');
    try {
      const result = await signInWithGoogle(from);
      if (result.error) {
        setError(authErrorText(result.error));
      }
      // 성공 시 브라우저가 Google로 이동한다. 돌아오면 /auth/callback 이 처리한다.
    } catch {
      setError('네트워크 연결을 확인해 주세요.');
    } finally {
      setStatus('idle');
    }
  };

  const handleFace = async () => {
    if (status !== 'idle') return;
    setStatus('face');
    setError('');
    const result = await signInWithFace();
    setStatus('idle');
    if (result.ok) {
      navigate(from, { replace: true });
      return;
    }
    setError(PASSKEY_ERROR_TEXT[result.kind ?? 'unknown']);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status !== 'idle') return;
    setStatus('submitting');
    setError('');

    try {
      const result = await signIn(email.trim(), password);
      if (result.error) {
        setError(authErrorText(result.error));
        return;
      }

      navigate(from, { replace: true });
    } catch {
      setError('네트워크 연결을 확인해 주세요.');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="doit-app-pastel min-h-screen flex flex-col">{/* 2026-09-26 대표: 히어로 밖 화면은 파스텔(검정 바탕 0) */}
      {/* Top logo bar */}
      <header className="w-full px-6 md:px-10 lg:px-16 py-5">
        <Link to="/" aria-label="DO IT 홈으로" className="inline-flex min-h-[44px] items-center gap-2.5 hover:opacity-80 transition-opacity">
          <DoItSymbol decorative className="!h-8 !w-8 md:!h-10 md:!w-10" />
          <span className="text-lg font-bold tracking-tight text-white">DO IT</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              로그인
            </h1>
            <p className="text-sm text-foreground-400 leading-relaxed">
              다시 돌아오신 걸 환영합니다
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 p-8 rounded-2xl border border-background-200/60 bg-background-100/50"
          >
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground-300 mb-2">
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-xl bg-background-50 border border-background-300/60 text-sm text-foreground-50 placeholder:text-foreground-700 focus:outline-none focus:border-primary-400/60 focus:ring-1 focus:ring-primary-400/30 transition-all duration-300"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground-300 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 rounded-xl bg-background-50 border border-background-300/60 text-sm text-foreground-50 placeholder:text-foreground-700 focus:outline-none focus:border-primary-400/60 focus:ring-1 focus:ring-primary-400/30 transition-all duration-300"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <i className="ri-error-warning-line text-red-400 text-sm mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status !== 'idle'}
              className="w-full py-3 rounded-xl echo-primary bg-white text-[#080808] text-sm font-semibold hover:bg-white/85 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
            >
              {status === 'submitting' ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </button>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={status !== 'idle'}
              className="w-full py-3 rounded-xl border border-background-300/60 bg-background-50 text-sm font-medium text-foreground-200 hover:border-primary-400/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
            >
              {status === 'google' ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Google로 이동 중...
                </>
              ) : (
                <>
                  <i className="ri-google-fill" />
                  Google로 계속하기
                </>
              )}
            </button>

            {/* 얼굴·지문 로그인: 이 기기에 등록해 둔 사람만. 처음이면 위 방법으로 로그인한 뒤 설정에서 등록한다. */}
            {PASSKEY_LOGIN_ENABLED && faceSupport === 'ok' && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => { void handleFace(); }}
                  disabled={status !== 'idle'}
                  className="w-full py-3 rounded-xl border border-background-300/60 bg-background-50 text-sm font-medium text-foreground-200 hover:border-primary-400/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
                >
                  {status === 'face' ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      얼굴을 확인하는 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-fingerprint-line" />
                      얼굴·지문으로 로그인
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-foreground-500">
                  이 휴대폰에 등록해 둔 경우에만 돼요. 처음이면 위 방법으로 로그인한 뒤 설정에서 등록해 주세요.
                </p>
              </div>
            )}
            {PASSKEY_LOGIN_ENABLED && faceSupport === 'in-app' && (
              <p className="text-center text-[11px] leading-relaxed text-foreground-500">
                얼굴·지문 로그인은 카카오톡 같은 앱 안에서는 안 돼요. 사파리나 크롬에서 열어 주세요.
              </p>
            )}

            {/* Signup link */}
            <p className="text-center text-xs text-foreground-500 pt-2">
              아직 계정이 없으신가요?{' '}
              <Link to="/signup" state={{ from }} className="inline-flex min-h-[44px] items-center px-1 text-white underline underline-offset-4 hover:text-white/80 transition-colors">
                가입하기
              </Link>
            </p>
            {/* 2026-09-26 대표 「LEGAL / PRIVACY / AUTH」 §14·§15: 로그인 전에도 정책 전문을 바로 열어 볼 수 있게. */}
            <p className="text-center text-xs text-foreground-500">
              <Link to="/legal/terms" className="inline-flex min-h-[44px] items-center px-2 underline underline-offset-4 hover:text-white/80">이용약관</Link>
              <span aria-hidden="true">·</span>
              <Link to="/legal/privacy" className="inline-flex min-h-[44px] items-center px-2 underline underline-offset-4 hover:text-white/80">개인정보 처리방침</Link>
            </p>
          </form>

          {/* Back to home */}
          <div className="text-center mt-6">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs text-foreground-500 hover:text-foreground-300 transition-colors"
            >
              <i className="ri-arrow-left-line" />
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </main>

      {/* Soft glow background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-primary-500/10 blur-[100px]" />
        <div className="absolute bottom-1/3 -right-32 w-[400px] h-[400px] rounded-full bg-accent-500/8 blur-[90px]" />
      </div>
    </div>
  );
}