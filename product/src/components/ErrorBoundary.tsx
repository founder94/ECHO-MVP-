import { Component, type ErrorInfo, type ReactNode } from 'react';

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
      return (
        <div className="flex min-h-screen items-center justify-center bg-background-50 px-6">
          <div className="w-full max-w-sm text-center">
            <p className="text-sm text-foreground-700 mb-6">화면을 불러오지 못했어요. 다시 시도해 주세요.</p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary-500 px-6 py-2.5 text-sm font-semibold text-background-50 transition hover:bg-primary-600"
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