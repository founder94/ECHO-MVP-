import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';

// 2026-10-10 기기 호환: 여러 단계 화면(시작 흐름·사주·타로)에서 휴대폰 「뒤로」가 흐름 전체를 떠나지 않고 직전 단계로 가게 한다.
// - 화면 안 버튼으로 다음 단계에 가면 주소에 ?step= 을 붙여 기록 한 칸을 쌓는다(push).
// - 「뒤로」(POP)로 그 칸이 빠지면 주소의 단계로 돌아간다. 이번에 실제로 지나온 단계만 믿는다.
// - 화면이 스스로 정한 단계(첫 화면·서버 복원·로그아웃) = 첫 칸. 주소에 남은 ?step(직접 친 주소·새로고침)은 지우고(replace) 그 첫 칸을 보인다.
//   그래서 첫 칸에서의 「뒤로」는 예전과 같이 이 흐름을 떠나고, 설치 앱 시작 주소(?step 없이 replace 로 도착)도 그대로다.
// - 단계가 바뀌면 화면 맨 위부터 보인다.
export function useStepHistory<S extends string>(step: S, setStep: (next: S) => void, isStep: (value: string) => value is S) {
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const stepParam = search.get('step');
  const stepRef = useRef(step);
  stepRef.current = step;
  const sourceRef = useRef<'user' | 'pop' | null>(null);
  const baseRef = useRef<S>(step);
  const visitedRef = useRef<Set<S>>(new Set([step]));
  const firstRef = useRef(true);
  const seenKeyRef = useRef(location.key);

  useEffect(() => {
    const source = sourceRef.current;
    sourceRef.current = null;
    if (!firstRef.current) window.scrollTo(0, 0);
    firstRef.current = false;
    if (source) { visitedRef.current.add(step); return; }
    baseRef.current = step;
    visitedRef.current = new Set([step]);
    if (new URLSearchParams(window.location.search).has('step')) {
      setSearch((prev) => { const next = new URLSearchParams(prev); next.delete('step'); return next; }, { replace: true });
    }
    // setSearch 는 주소가 바뀔 때마다 새로 만들어진다 — 단계가 바뀔 때만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (seenKeyRef.current === location.key) return;
    seenKeyRef.current = location.key;
    if (navigationType !== 'POP') return;
    const want: S = stepParam && isStep(stepParam) && visitedRef.current.has(stepParam) ? stepParam : baseRef.current;
    if (want !== stepRef.current) { sourceRef.current = 'pop'; setStep(want); }
    // 지나오지 않은 단계가 주소에 있으면(직접 친 주소 등) 주소도 첫 칸으로 맞춘다.
    if (stepParam && stepParam !== want) {
      setSearch((prev) => { const next = new URLSearchParams(prev); next.delete('step'); return next; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, navigationType, stepParam]);

  return useCallback((next: S) => {
    if (next === stepRef.current) return;
    sourceRef.current = 'user';
    stepRef.current = next;
    setStep(next);
    setSearch((prev) => { const params = new URLSearchParams(prev); params.set('step', next); return params; });
  }, [setStep, setSearch]);
}

export default useStepHistory;
