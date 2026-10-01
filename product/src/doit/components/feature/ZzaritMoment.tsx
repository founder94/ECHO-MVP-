import { useEffect, useRef } from 'react';
import DoItSymbol from '@/components/DoItSymbol';
import './zzarit.css';

// ZZARIT — 서로 같은 선택을 한 순간(대표 2026-10-01). 서버가 mutual + match_id 를 준 뒤에만 부모가 이 화면을 연다.
// 두 신호가 맞춰짐 → 심볼의 은빛 테두리를 따라 파스텔 블루 전류 → 은청색 파동 한 번 → 화면이 3~5% 밝아짐. 약 1.2초, 한 번.
// 하트·폭죽·네온 0. 진동은 아주 짧게, 지원하는 기기에서만(움직임 줄이기 설정이면 0). 소리 0.
export default function ZzaritMoment({ onStart, note }: { onStart: () => void; note?: string }) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) { try { navigator.vibrate?.(12); } catch { /* 진동이 없어도 그만 */ } }
    const t = window.setTimeout(() => startRef.current?.focus({ preventScroll: true }), reduce ? 0 : 1200);
    return () => window.clearTimeout(t);
  }, []);
  return <section className="doit-connect doit-mutual echo-zzarit" aria-label="서로 같은 선택" role="status">
    <span className="echo-zzarit-lift" aria-hidden="true" />
    <div className="echo-zzarit-mark" aria-hidden="true">
      <span className="echo-zzarit-signal" /><span className="echo-zzarit-signal" />
      <span className="echo-zzarit-ring"><DoItSymbol decorative className="echo-zzarit-symbol" /></span>
      <span className="echo-zzarit-current" />
      <span className="echo-zzarit-wave" />
    </div>
    <p className="doit-mutual-title echo-zzarit-title">텔레파시가 통했어요.</p>
    <p className="doit-mutual-body echo-zzarit-body">서로 같은 선택을 했어요.</p>
    <button ref={startRef} type="button" className="doit-product-action echo-zzarit-cta" onClick={onStart}>첫 이야기 시작하기<span aria-hidden="true">↗</span></button>
    <p className="doit-connect-note echo-zzarit-note">{note ?? '먼저 ECHO가 두 분께 같은 질문 하나를 드려요. 둘 다 답하면 서로의 이름과 사진이 열려요.'}</p>
  </section>;
}
