import './doit-symbol.css';
import { SYMBOL_DISPLAY_SRC, fallbackToOriginal } from './symbolAssets';

/**
 * 대표가 제공한 공식 심볼. 형태를 다시 그리거나 다른 심볼로 대체하지 않는다.
 * 이 자리는 화면에서 32~44px 로 쓰므로 표시용 작은 판을 받는다(못 읽으면 공식 원본).
 */
export default function DoItSymbol({ className = '', decorative = false }: { className?: string; decorative?: boolean }) {
  return <img className={`doit-official-symbol ${className}`} src={SYMBOL_DISPLAY_SRC} onError={(event) => fallbackToOriginal(event.currentTarget)} width="512" height="512" alt={decorative ? '' : 'DO IT 공식 심볼'} aria-hidden={decorative || undefined} decoding="async" draggable="false" />;
}
