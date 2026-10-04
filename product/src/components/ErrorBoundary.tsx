import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IS_APP_SITE } from '@/lib/siteRole';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// 앱 최상단 오류 경계. 렌더링 중 예외가 발생해도 흰 화면 대신 안내 문구와 새로고침 버튼을 표시한다.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] 렌더링 오류:', error?.message ?? 'UnknownError', info?.componentStack ?? '');
    }
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* 새로고침 불가 시 무시 */
    }
  };

  render() {
    if (this.state.hasError) {
      // 앱(app.do-it.company)은 파스텔 + 짙은 청록 유리 판(흰 글자 7:1 이상). 홈페이지는 기존 검정. 새 CSS 파일 없이 Tailwind 값만 쓴다.
      const app = IS_APP_SITE;
      return (
        <div className={app ? 'flex min-h-screen items-center justify-center bg-gradient-to-b from-[#3fdcb3] via-[#7be5ca] to-[#e0927d] px-6' : 'flex min-h-screen items-center justify-center bg-background-50 px-6'}>
          <div className={app ? 'w-full max-w-sm text-center rounded-[24px] border border-white/50 bg-[rgb(8_70_80/0.9)] px-6 py-8' : 'w-full max-w-sm text-center'} role="alert">
            <p className={app ? 'text-base leading-relaxed text-white mb-6' : 'text-sm text-foreground-700 mb-6'}>화면을 불러오지 못했어요. 다시 시도해 주세요.</p>
            <button
              type="button"
              onClick={this.handleReload}
              className={app
                ? 'inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white bg-white px-6 py-2.5 text-base font-semibold text-[#053a44]'
                : 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600'}
            >
              <i className="ri-refresh-line" />
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}