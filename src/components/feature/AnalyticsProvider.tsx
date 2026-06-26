import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  recordPageView,
  recordButtonClick,
  recordGoogleForm,
  recordSectionEnter,
  recordSectionExit,
  recordAuthEvent,
  recordWhiteDoorEnter,
  getOrCreateVisitorId,
} from '@/hooks/useAnalytics';

/**
 * AnalyticsProvider — 자동 방문자/클릭/섹션 추적
 *
 * 앱 전체를 감싸서 모든 이벤트를 자동 기록합니다.
 * 기존 홈페이지 컴포넌트를 전혀 수정하지 않고 동작합니다.
 */

const GOOGLE_FORM_URL = 'forms.gle';

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/auth': 'Login / Signup',
  '/admin': 'Admin',
  '/portfolio': 'Portfolio',
  '/thank-you': 'Thank You',
  '/about': 'About',
};

const TRACKED_BUTTON_PATTERNS = [
  { pattern: '무료로 시작', name: '무료로 시작하기' },
  { pattern: '시작하기', name: '시작하기' },
  { pattern: 'echo 시작', name: 'ECHO 시작하기' },
  { pattern: '더 알아보기', name: '더 알아보기' },
  { pattern: 'mission', name: 'MISSION' },
  { pattern: 'our approach', name: 'Our Approach' },
  { pattern: 'google form', name: 'Google Form 이동' },
  { pattern: '구글 폼', name: 'Google Form 이동' },
  { pattern: '로그인', name: '로그인' },
  { pattern: '회원가입', name: '회원가입' },
  { pattern: 'sign up', name: '회원가입' },
  { pattern: 'signup', name: '회원가입' },
  { pattern: 'google로 계속', name: 'Google 로그인' },
  { pattern: 'apple로 계속', name: 'Apple 로그인' },
  { pattern: 'kakao로 계속', name: '카카오 로그인' },
  { pattern: 'echo로 돌아가기', name: 'ECHO로 돌아가기' },
  { pattern: '인증하기', name: 'Admin 로그인' },
  { pattern: '체험 신청', name: '체험 신청하기' },
  { pattern: '문의하기', name: '문의하기' },
  { pattern: '가입하기', name: '가입하기' },
  { pattern: 'white door', name: 'White Door' },
  { pattern: '메뉴', name: '메뉴' },
];

const TRACKED_SECTIONS = [
  { selector: '[data-section="hero"]', name: 'Hero' },
  { selector: '[data-section="identity"]', name: 'Identity' },
  { selector: '[data-section="mission"]', name: 'Mission' },
  { selector: '[data-section="approach"]', name: 'Our Approach' },
  { selector: '[data-section="portfolio"]', name: 'Portfolio' },
  { selector: '[data-section="faq"]', name: 'FAQ' },
  { selector: '[data-section="white-door"]', name: 'White Door' },
  { selector: '[data-section="footer"]', name: 'Footer' },
];

function resolvePageName(pathname: string): string {
  return PAGE_LABELS[pathname] || pathname.replace(/^\//, '') || 'Unknown';
}

export default function AnalyticsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const lastPathRef = useRef<string>('');
  const lastClickRef = useRef<number>(0);

  // Section timing
  const sectionTimers = useRef<Map<string, number>>(new Map());
  const activeSection = useRef<string | null>(null);

  // Initialize visitor ID on first mount
  useEffect(() => {
    getOrCreateVisitorId();
  }, []);

  // Track page views on route change
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (currentPath === lastPathRef.current) return;
    lastPathRef.current = currentPath;

    const pageName = resolvePageName(location.pathname);
    recordPageView(pageName, currentPath);
  }, [location]);

  // Safari bfcache support
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const pageName = resolvePageName(location.pathname);
        recordPageView(pageName, location.pathname + location.search);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [location.pathname, location.search]);

  // Section enter/exit tracking via Intersection Observer
  useEffect(() => {
    if (location.pathname !== '/') {
      // Clear any pending section timers when navigating away from home
      if (activeSection.current) {
        const start = sectionTimers.current.get(activeSection.current);
        if (start) {
          recordSectionExit(activeSection.current, Date.now() - start);
        }
        activeSection.current = null;
      }
      return;
    }

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const sectionEl = entry.target;
            const sectionName = sectionEl.getAttribute('data-tracked-section') || '';

            if (entry.isIntersecting) {
              // Section entered
              activeSection.current = sectionName;
              sectionTimers.current.set(sectionName, Date.now());
              recordSectionEnter(sectionName);
            } else {
              // Section exited — record duration
              const start = sectionTimers.current.get(sectionName);
              if (start) {
                const duration = Date.now() - start;
                recordSectionExit(sectionName, duration);
                sectionTimers.current.delete(sectionName);
              }
              if (activeSection.current === sectionName) {
                activeSection.current = null;
              }
            }
          });
        },
        { threshold: 0.3 }
      );

      // Observe all tracked sections
      TRACKED_SECTIONS.forEach(({ selector }) => {
        const el = document.querySelector(selector);
        if (el) {
          el.setAttribute('data-tracked-section', el.getAttribute('data-section') || '');
          observer.observe(el);
        }
      });

      // Also observe elements with data-tracked-section attribute
      const trackedEls = document.querySelectorAll('[data-tracked-section]');
      trackedEls.forEach((el) => {
        if (!el.hasAttribute('data-section')) {
          observer.observe(el);
        }
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Global click delegation for button tracking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastClickRef.current < 300) return;
      lastClickRef.current = now;

      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], .cursor-pointer') as HTMLElement | null;
      if (!clickable) return;

      const textContent = (clickable.textContent || '').toLowerCase().trim();
      if (!textContent) return;

      const matched = TRACKED_BUTTON_PATTERNS.find((p) =>
        textContent.includes(p.pattern.toLowerCase())
      );
      if (!matched) return;

      const pageName = resolvePageName(location.pathname);

      const anchorHref =
        (clickable as HTMLAnchorElement).href ||
        clickable.getAttribute('href') ||
        '';
      const isGoogleForm =
        anchorHref.includes(GOOGLE_FORM_URL) ||
        textContent.includes('google form') ||
        textContent.includes('구글 폼');

      if (isGoogleForm) {
        recordGoogleForm();
        recordButtonClick(matched.name, pageName);
      } else {
        recordButtonClick(matched.name, pageName);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [location.pathname]);

  // Expose helper for auth events
  const trackAuth = useCallback(
    (eventName: string, type: 'auth_signup' | 'auth_login' | 'auth_logout', userId?: string) => {
      recordAuthEvent(eventName, type, userId);
    },
    []
  );
  const trackWhiteDoor = useCallback(() => {
    recordWhiteDoorEnter();
  }, []);

  // Store on window for external access
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__echoTrackAuth = trackAuth;
    (window as unknown as Record<string, unknown>).__echoTrackWhiteDoor = trackWhiteDoor;
  }

  return <>{children}</>;
}