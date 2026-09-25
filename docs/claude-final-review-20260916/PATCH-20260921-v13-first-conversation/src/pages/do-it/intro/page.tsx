import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoItIntroFrame from '@/components/DoItIntroFrame';
import IntroUniverse from '@/components/IntroUniverse';
import { MAIN_ENTRY_PATH } from '@/lib/echo/appMode';
import { markIntroSeen } from '@/pages/do-it/intro/introSeen';

// 다음 화면(/do-it/landing)의 첫 배경을 미리 읽는다. 이미지 로드가 늦어도 온보딩 진행은 막지 않는다.
const LANDING_IMAGE =
  '/brand/doit-earth-original.png';

// ── 실행 시간 (일반 모드 총 ~3.2초) ──────────────────────────────
const HOLD_1_MS = 150; // 시작 150ms 동안 1%와 해당 심볼을 분명히 표시
const CLIMB_22_MS = 650; // 1% → 22%
const CLIMB_100_MS = 1850; // 22% → 100%
const HOLD_100_MS = 300; // 100% 유지
const FADE_MS = 250; // 부드럽게 사라지며 스크롤 소개로 전환
const REDUCED_MS = 600; // 동작 줄이기: 빠른 1% → 100%

// 시간(dt)에 따른 진행률(1~100 부동소수). 숫자와 픽셀이 하나의 시간 기준을 공유한다.
function progressAt(dt: number, reduced: boolean): number {
  if (reduced) {
    return Math.min(100, 1 + 99 * (dt / REDUCED_MS));
  }
  if (dt <= HOLD_1_MS) return 1;
  const t1 = dt - HOLD_1_MS;
  if (t1 <= CLIMB_22_MS) return 1 + 21 * (t1 / CLIMB_22_MS);
  const t2 = t1 - CLIMB_22_MS;
  if (t2 <= CLIMB_100_MS) return 22 + 78 * (t2 / CLIMB_100_MS);
  return 100;
}

export default function DoItIntroPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(1); // 1~100 부동소수 (숫자·픽셀 공용)
  const [leaving, setLeaving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  const rafRef = useRef(0);
  const navigatedRef = useRef(false);
  const leavingRef = useRef(false);
  const elapsedRef = useRef(0);
  const lastNowRef = useRef(0);

  // 동작 줄이기 감지. 실패 시 기본값(false)으로 정상 실행한다.
  useEffect(() => {
    let media: MediaQueryList | null = null;
    let onMedia: (() => void) | null = null;
    try {
      if (typeof window.matchMedia === 'function') {
        media = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(media.matches);
        onMedia = () => {
          try {
            setReducedMotion(media?.matches ?? false);
          } catch {
            /* 무시 */
          }
        };
        if (typeof media.addEventListener === 'function') {
          media.addEventListener('change', onMedia);
        } else if (
          typeof (media as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener ===
          'function'
        ) {
          (media as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(onMedia);
        }
      } else {
        setReducedMotion(false);
      }
    } catch {
      setReducedMotion(false);
    }
    return () => {
      if (media && onMedia) {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', onMedia);
        } else if (
          typeof (media as MediaQueryList & { removeListener?: (cb: () => void) => void })
            .removeListener === 'function'
        ) {
          (media as MediaQueryList & { removeListener: (cb: () => void) => void }).removeListener(
            onMedia,
          );
        }
      }
    };
  }, []);

  // 스크롤 소개 첫 배경 프리로드(비차단). 로드 결과와 무관하게 인트로는 자체 타임라인으로 완료된다.
  // 이미지가 실제로 로드되지 않았는데 "캐시 준비/로드 완료"로 기록하지 않는다(진행률은 브랜드 연출 진행률).
  useEffect(() => {
    try {
      const img = new Image();
      img.src = LANDING_IMAGE;
    } catch {
      /* 무시 */
    }
  }, []);

  // 진행률 엔진. engineStartedRef 같은 "한 번만" 잠금을 두지 않아, 다시 진입·개발 모드 재설정에서도 새 실행이 시작된다.
  useEffect(() => {
    if (reducedMotion === null) return;
    const reduced = reducedMotion;

    // 실행당 상태 초기화 (재진입·StrictMode 재실행에서 새 실행이 실제로 시작되도록)
    navigatedRef.current = false;
    leavingRef.current = false;
    elapsedRef.current = 0;
    lastNowRef.current = performance.now();
    setProgress(1);
    setLeaving(false);

    const completeAt = reduced ? REDUCED_MS : HOLD_1_MS + CLIMB_22_MS + CLIMB_100_MS;
    const fadeAt = completeAt + HOLD_100_MS;
    const navAt = fadeAt + FADE_MS;

    // 탭 숨김 → 재생 일시정지, 복귀 → 이어서 재생. 숨긴 동안의 시간이 경과 시간에 더해지지 않도록
    // 복귀 시점의 기준 타임스탬프를 갱신해 다음 프레임의 증가분(delta)이 튀지 않게 한다.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastNowRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 프레임마다 일정량을 더하지 않고 실제 경과 시간(delta)만 누적한다. 숫자·픽셀·페이드가 같은 dt를 공유한다.
    const tick = (now: number) => {
      if (navigatedRef.current) return;
      const delta = now - lastNowRef.current;
      lastNowRef.current = now;
      elapsedRef.current += delta;
      const dt = elapsedRef.current;

      setProgress(progressAt(dt, reduced));

      if (!leavingRef.current && dt >= fadeAt) {
        leavingRef.current = true;
        setLeaving(true);
      }
      if (dt >= navAt) {
        navigatedRef.current = true;
        markIntroSeen();
        navigate(MAIN_ENTRY_PATH, { replace: true });
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reducedMotion, navigate]);

  // 3D 연출(별 워프·점으로 모이는 심볼·기울기·빛 번짐)은 동작 줄이기 설정이 아닐 때만 그린다.
  return <DoItIntroFrame progress={progress} leaving={leaving} reducedMotion={Boolean(reducedMotion)} scene={reducedMotion === false ? <IntroUniverse progress={progress} leaving={leaving} /> : null} />;
}
