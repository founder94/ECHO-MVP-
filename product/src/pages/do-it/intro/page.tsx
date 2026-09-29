import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DoItIntroFrame from '@/components/DoItIntroFrame';
import IntroUniverse, { type SymbolStatus } from '@/components/IntroUniverse';
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
// 3D 연출에 심볼을 넘기는 것은 점이 모이는 연출이 아직 자연스러운 초반(약 40%)까지만 허용한다.
// 그 뒤에 준비가 끝나면 이미 보이던 원본 심볼을 그대로 둔다(화면이 깜빡이지 않는다).
const HANDOFF_LIMIT_MS = 1200;

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

// 확인 모드(주소 뒤 ?check=1, 대표 2026-09-23 "아이폰으로 했을 때도 성공 여부 체크해서"):
// 다음 화면으로 넘어가지 않고 마지막 장면에서 멈춘 뒤, 심볼이 어느 길로 보였는지 화면에 글자로 적는다.
// 대표가 아이폰·갤럭시에서 그 화면을 캡처하면, 진짜 기기에서의 성공 여부가 남는다. 저장·전송은 하지 않는다.
function describeDevice(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return /CriOS|FxiOS|EdgiOS|Whale/i.test(ua) ? '아이폰 · 사파리 아닌 브라우저' : '아이폰 · 사파리';
  if (/Android/i.test(ua)) return /SamsungBrowser/i.test(ua) ? '안드로이드 · 삼성 인터넷' : '안드로이드 · 크롬 계열';
  return '컴퓨터';
}
function describeStatus(status: SymbolStatus | null): string {
  if (!status) return '아직 읽는 중';
  if (status.kind === 'ok') return `3D 연출 성공 (${status.src === 'display' ? '표시용 작은 판' : '공식 원본'})`;
  if (status.kind === 'retried') return `3D 연출 성공 — 처음엔 빈 그림, 다시 옮겨서 성공 (${status.src === 'display' ? '표시용 작은 판' : '공식 원본'})`;
  if (status.kind === 'blank') return '3D 연출 실패 — 빈 그림만 나옴 → 원래 그림으로 대신 표시';
  return '3D 연출 실패 — 그림을 받지 못함 → 원래 그림으로 대신 표시';
}

export default function DoItIntroPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [checkMode] = useState(() => search.get('check') === '1');
  const [symbolStatus, setSymbolStatus] = useState<SymbolStatus | null>(null);
  const [finalCheck, setFinalCheck] = useState<{ imgShown: boolean; reveal: 'canvas' | 'img' } | null>(null);
  const [progress, setProgress] = useState(1); // 1~100 부동소수 (숫자·픽셀 공용)
  const [leaving, setLeaving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  // 3D 연출이 심볼을 맡았는지. false 인 동안에는 원본 심볼 <img> 가 그대로 보인다.
  const [symbolReady, setSymbolReady] = useState(false);

  const rafRef = useRef(0);
  const navigatedRef = useRef(false);
  const leavingRef = useRef(false);
  const elapsedRef = useRef(0);
  const lastNowRef = useRef(0);
  const handoffDecidedRef = useRef(false);

  // 3D 연출이 "심볼을 그릴 준비가 끝났다"고 알려 올 때. 한 번만 판단한다.
  // 준비 신호가 아예 오지 않아도(그림이 늦거나 못 읽어도) 심볼은 <img> 로 계속 보인다.
  const handleSymbolReady = useCallback(() => {
    if (handoffDecidedRef.current) return;
    handoffDecidedRef.current = true;
    if (elapsedRef.current <= HANDOFF_LIMIT_MS) setSymbolReady(true);
  }, []);

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
  // 이 화면에 실제로 필요한 그림은 심볼이다. 다음 화면 배경이 회선을 먼저 차지하지 않도록 조금 뒤에 받는다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const img = new Image();
        img.src = LANDING_IMAGE;
      } catch {
        /* 무시 */
      }
    }, 1000);
    return () => window.clearTimeout(timer);
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

      if (checkMode && dt >= fadeAt) {
        // 확인 모드: 사라지지도 넘어가지도 않고 마지막 장면(100%)에 멈춘다. 이때 원래 그림이 실제로 보였는지 잰다.
        navigatedRef.current = true;
        const img = document.querySelector<HTMLImageElement>('[data-doit-intro-frame] img');
        const opacity = img ? Number(getComputedStyle(img).opacity) : 0;
        setFinalCheck({ imgShown: !!img && img.complete && img.naturalWidth > 0 && opacity > 0.5, reveal: opacity > 0.5 ? 'img' : 'canvas' });
        return;
      }
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
  }, [reducedMotion, navigate, checkMode]);

  // 3D 연출(별 워프·점으로 모이는 심볼·기울기·빛 번짐)은 동작 줄이기 설정이 아닐 때만 그린다.
  const frame = <DoItIntroFrame progress={progress} leaving={leaving} reducedMotion={Boolean(reducedMotion)} symbolReady={symbolReady} scene={reducedMotion === false ? <IntroUniverse progress={progress} leaving={leaving} onSymbolReady={handleSymbolReady} onSymbolStatus={setSymbolStatus} /> : null} />;
  if (!checkMode) return frame;

  // 확인 모드 결과: 끝 장면에서 심볼이 보였는가(캔버스가 그렸거나, 원래 그림이 보였거나).
  const passed = finalCheck ? (finalCheck.reveal === 'canvas' ? symbolReady : finalCheck.imgShown) : null;
  return (
    <div style={{ position: 'relative' }}>
      {frame}
      <div role="status" style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 12px)', left: 12, right: 12, zIndex: 5, padding: '14px 16px', borderRadius: 14, background: 'rgba(12,13,16,.86)', border: '1px solid rgba(233,236,240,.28)', color: '#eceef1', fontSize: 13, lineHeight: 1.75, fontFamily: 'ui-sans-serif, system-ui, sans-serif', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        <div style={{ fontWeight: 700, letterSpacing: '.02em' }}>
          {passed === null ? '심볼 확인 중…' : passed ? '✅ 성공 — 끝 장면에 심볼이 보입니다' : '❌ 실패 — 끝 장면에 심볼이 없습니다'}
        </div>
        <div>기기: {describeDevice(navigator.userAgent)}</div>
        <div>3D 연출: {reducedMotion ? '동작 줄이기 설정 — 3D 없이 심볼만 표시' : describeStatus(symbolStatus)}</div>
        {finalCheck && <div>끝 장면: {finalCheck.reveal === 'canvas' ? '3D 연출이 점을 모아 심볼을 그림' : finalCheck.imgShown ? '원래 심볼 그림이 끝에 나타남' : '원래 심볼 그림도 보이지 않음'}</div>}
        {finalCheck && <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 10, minHeight: 40, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(233,236,240,.4)', background: 'transparent', color: '#eceef1', fontSize: 13 }}>처음부터 다시 보기</button>}
      </div>
    </div>
  );
}
