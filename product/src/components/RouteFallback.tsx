import { useEffect, useState } from 'react';
import SymbolLoader from './SymbolLoader';
import { IS_APP_SITE } from '@/lib/siteRole';
import { APP_PASTEL, themeColorFor } from '@/lib/themeColor';
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

  // 2026-09-26 대표 PRE-DEPLOY FIX #2: 파스텔 앱 화면(/doit) 사이에서는 기다리는 화면도 파스텔(검정 번쩍임 0). 히어로·관리자는 그대로 검정.
  const pastel = IS_APP_SITE && themeColorFor(window.location.pathname) === APP_PASTEL;

  return (
    <div className={`echo-route-fallback${pastel ? ' echo-route-fallback--pastel' : ''}`}>
      {/* 2026-09-23: 기다리는 동안 심볼 3D 효과(흩어진 빛이 D 로 모였다 흩어진다). 진행률은 만들지 않는다. */}
      <SymbolLoader size={140} label="다음 화면을 여는 중이에요." />
    </div>
  );
}
