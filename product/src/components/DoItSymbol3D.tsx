import type { CSSProperties } from 'react';
import { SYMBOL_DISPLAY_SRC, fallbackToOriginal } from './symbolAssets';
import './doit-symbol-3d.css';

/**
 * 2026-10-04 대표 「우리 로고심볼 … 3D 효과 · 입체 그래픽 · 애니메이션」: 공식 심볼 그림 그대로(다시 그리지 않음)에
 * 두께(뒤로 겹친 판) · 천천히 도는 입체 기울기 · 지나가는 빛 · 바닥 그림자만 더한다.
 * - 장식이므로 읽기 프로그램은 건너뛴다(decorative 기본). 움직임 줄이기면 정지(살짝 기운 입체 모양만).
 * - 판 수(DEPTH)는 적게: 휴대폰에서도 가볍게.
 */
const DEPTH = 7;
export default function DoItSymbol3D({ size = 120, className = '', label }: { size?: number; className?: string; label?: string }) {
  const style = { '--sym-size': `${size}px` } as CSSProperties;
  const img = (k: number) => <img key={k} className={k === 0 ? 'doit-sym3d-face' : 'doit-sym3d-layer'} style={k ? ({ '--k': k } as CSSProperties) : undefined}
    src={SYMBOL_DISPLAY_SRC} onError={(e) => fallbackToOriginal(e.currentTarget)} width="512" height="512" alt="" decoding="async" draggable="false" />;
  return <div className={`doit-sym3d ${className}`} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <div className="doit-sym3d-turn">
      {Array.from({ length: DEPTH }, (_, i) => img(DEPTH - i))}
      {img(0)}
      <span className="doit-sym3d-sheen" style={{ WebkitMaskImage: `url(${SYMBOL_DISPLAY_SRC})`, maskImage: `url(${SYMBOL_DISPLAY_SRC})` }} />
    </div>
    <span className="doit-sym3d-floor" />
  </div>;
}
