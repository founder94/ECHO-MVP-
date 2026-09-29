import { useEffect, useState } from 'react';
import DoItSymbol from './DoItSymbol';
import './route-fallback.css';

/**
 * 화면 조각을 내려받는 동안 비어 있던 자리를 대신한다.
 *
 * - 빠르게 열리는 화면에서 글자가 번쩍이지 않도록 {@link QUIET_MS} 동안은 아무것도 그리지 않는다.
 * - 진행률(%)이나 남은 시간을 만들어 내지 않는다. 서버에서 받는 값이 아니라 거짓이 되기 때문이다.
 * - 랜딩(/)은 지연 불러오기를 쓰지 않으므로 이 화면을 거치지 않는다.
 */
export const QUIET_MS = 250;

export default function RouteFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), QUIET_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="echo-route-fallback" role="status" aria-live="polite">
      <div className="echo-route-fallback-inner">
        <span className="echo-route-fallback-orbit" aria-hidden="true">
          <DoItSymbol decorative />
        </span>
        <p>화면을 준비하고 있어요.</p>
      </div>
    </div>
  );
}
