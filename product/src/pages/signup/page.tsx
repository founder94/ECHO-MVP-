import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { sanitizeReturnPath } from '@/lib/auth/returnPath';
import DoItSymbol from '@/components/DoItSymbol';
import ConsentChecklist from '@/components/legal/ConsentChecklist';
import { EMPTY_CONSENT, rememberPendingConsent, requiredAllChecked, type ConsentChoice } from '@/lib/legal/consent';
import { authErrorText } from '@/lib/auth/authErrorText';

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const location = useLocation();
  // 로그인 화면에서 넘어온 복귀 경로를 이어받는다(없으면 기본 경로).
  const from = sanitizeReturnPath((location.state as { from?: string } | null)?.from);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'google'>('idle');
  // 약관 동의: 필수 3개가 켜져야 이메일 가입·Google 가입 버튼이 열린다.
  const [consent, setConsent] = useState<ConsentChoice>(EMPTY_CONSENT);
  const consentReady = requiredAllChecked(consent);

  // Google 로그인: 실제 signInWithOAuth 호출. 제공자 설정이 없으면 Supabase 오류를 그대로 표시한다(가짜 성공 없음).
  const handleGoogle = async () => {
    if (googleStatus !== 'idle' || formStatus === 'submitting' || !consentReady) return;
    setGoogleStatus('google');
    setErrorMessage('');
    try {
      // Google 화면을 거쳐 돌아오므로 동의 내용을 잠깐 보관했다가 로그인 뒤 서버에 옮긴다(AuthContext).
      rememberPendingConsent(consent);
      const result = await signInWithGoogle(from);
      if (result.error) {
        setFormStatus('error');
        setErrorMessage(authErrorText(result.error, '가입하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
      }
    } catch {
      setFormStatus('error');
      setErrorMessage('네트워크 연결을 확인해 주세요.');
    } finally {
      setGoogleStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setFormStatus('error');
      setErrorMessage('비밀번호가 서로 일치하지 않아요.');
      return;
    }
    if (password.length < 8) {
      setFormStatus('error');
      setErrorMessage('비밀번호는 8자 이상이어야 해요.');
      return;
    }
    if (!consentReady) {
      setFormStatus('error');
      setErrorMessage('필수 약관에 동의해 주세요.');
      return;
    }

    setFormStatus('submitting');
    setErrorMessage('');

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim() || '사용자',
        consent,
      });

      if (result.error) {
        setFormStatus('error');
        setErrorMessage(authErrorText(result.error, '가입하지 못했어요. 잠시 뒤 다시 시도해 주세요.'));
        return;
      }

      setNeedsEmailConfirm(result.needsEmailConfirm === true);
      setFormStatus('success');
    } catch {
      setFormStatus('error');
      setErrorMessage('네트워크 연결을 확인해 주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col">
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
              가입하기
            </h1>
            <p className="text-sm text-foreground-400 leading-relaxed">
              ECHO와 함께 진짜 나를 발견하는 여정을 시작하세요
            </p>
          </div>

          {/* Form */}
          {formStatus === 'success' ? (
            <div className="text-center py-12 px-6 rounded-2xl border border-background-200/60 bg-background-100/50">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-primary-500/15 flex items-center justify-center">
                <i className="ri-check-line text-2xl text-primary-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground-50 mb-2">가입이 완료되었습니다!</h2>
              <p className="text-sm text-foreground-400 mb-6">
                {needsEmailConfirm
                  ? '확인 이메일을 보내드렸습니다. 이메일을 확인한 뒤 로그인해 주세요.'
                  : '이제 바로 시작할 수 있어요.'}
              </p>
              <Link
                to="/login"
                state={{ from }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors duration-300 whitespace-nowrap"
              >
                <i className="ri-login-box-line" />
                로그인하기
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-8 rounded-2xl border border-background-200/60 bg-background-100/50"
            >
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground-300 mb-2">
                  이름
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 rounded-xl bg-background-50 border border-background-300/60 text-sm text-foreground-50 placeholder:text-foreground-700 focus:outline-none focus:border-primary-400/60 focus:ring-1 focus:ring-primary-400/30 transition-all duration-300"
                />
              </div>

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
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상 입력하세요"
                  className="w-full px-4 py-3 rounded-xl bg-background-50 border border-background-300/60 text-sm text-foreground-50 placeholder:text-foreground-700 focus:outline-none focus:border-primary-400/60 focus:ring-1 focus:ring-primary-400/30 transition-all duration-300"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground-300 mb-2">
                  비밀번호 확인
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full px-4 py-3 rounded-xl bg-background-50 border border-background-300/60 text-sm text-foreground-50 placeholder:text-foreground-700 focus:outline-none focus:border-primary-400/60 focus:ring-1 focus:ring-primary-400/30 transition-all duration-300"
                />
              </div>

              {/* 약관 동의 */}
              <ConsentChecklist value={consent} onChange={setConsent} disabled={formStatus === 'submitting' || googleStatus !== 'idle'} />

              {/* Error message */}
              {formStatus === 'error' && errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <i className="ri-error-warning-line text-red-400 text-sm mt-0.5" />
                  <p className="text-xs text-red-300">{errorMessage}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={formStatus === 'submitting' || !consentReady}
                className="w-full py-3 rounded-xl bg-white text-[#080808] text-sm font-semibold hover:bg-white/85 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
              >
                {formStatus === 'submitting' ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '가입하기'
                )}
              </button>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleStatus !== 'idle' || formStatus === 'submitting' || !consentReady}
                className="w-full py-3 rounded-xl border border-background-300/60 bg-background-50 text-sm font-medium text-foreground-200 hover:border-primary-400/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer"
              >
                {googleStatus === 'google' ? (
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

              {/* Login link */}
              <p className="text-center text-xs text-foreground-500 pt-2">
                이미 계정이 있으신가요?{' '}
                <Link to="/login" className="inline-flex min-h-[44px] items-center px-1 text-white underline underline-offset-4 hover:text-white/80 transition-colors">
                  로그인
                </Link>
              </p>
            </form>
          )}
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