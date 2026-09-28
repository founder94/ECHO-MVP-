import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminError } from './api';

export type Load<T> = { kind: 'loading' } | { kind: 'error'; code: string; message: string } | { kind: 'ready'; data: T };

// 한 화면의 자료 한 벌. deps 가 바뀌면 다시 읽는다. 늦게 온 옛 응답은 버린다.
export function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[]): [Load<T>, () => void] {
  const [state, setState] = useState<Load<T>>({ kind: 'loading' });
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    setState({ kind: 'loading' });
    fetcher().then(
      (data) => { if (n === seq.current) setState({ kind: 'ready', data }); },
      (e: unknown) => { if (n === seq.current) setState({ kind: 'error', code: e instanceof AdminError ? e.code : 'ERROR', message: e instanceof Error ? e.message : '불러오지 못했습니다.' }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return [state, run];
}
