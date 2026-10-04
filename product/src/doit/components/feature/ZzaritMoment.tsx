import { useEffect, useRef } from 'react';
import './zzarit.css';

// 찌릿(2026-10-04 대표 「홈페이지·모바일 디자인 교체」 · 최신 KEY·찌릿 지시). 서버가 mutual + match_id 를 준 뒤에만 부모가 이 화면을 연다
// (한쪽 선택만으로는 열리지 않음 · 같은 연결에서 한 번만 = lib/zzarit.ts). 이 화면은 연결을 열거나 상태를 바꾸지 않는다.
// 두 익명 노드 사이에 청록·흰색 전류가 0.75초 이어짐 → 「찌릿! 텔레파시가 통했어요」. 매칭 기쁨의 비유일 뿐(속마음·궁합 판정 아님).
// 상대 사진·이름 0(익명 노드). 소리 0 · 진동은 아주 짧게 한 번(움직임 줄이기면 0) · 반복 0. 다음 버튼은 처음부터 눌린다(연출을 기다리지 않음).
export const ZZARIT_COPY = { title: '찌릿! 텔레파시가 통했어요', body: '서로 대화를 원했어요.', next: '다음 단계 보기' } as const;

function AnonNode() {
  return <span className="echo-zzarit-node" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="18" r="8" fill="currentColor" /><path d="M9 41c1.8-8 8-12.5 15-12.5S37.2 33 39 41" fill="currentColor" /></svg>
  </span>;
}

export default function ZzaritMoment({ onStart, note }: { onStart: () => void; note?: string }) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) { try { navigator.vibrate?.(12); } catch { /* 진동이 없어도 그만 */ } }
    startRef.current?.focus({ preventScroll: true });
  }, []);
  return <section className="doit-connect doit-mutual echo-zzarit" aria-label="서로 같은 선택" role="status">
    <div className="echo-zzarit-mark" aria-hidden="true">
      <AnonNode />
      <span className="echo-zzarit-link"><span className="echo-zzarit-current" /></span>
      <AnonNode />
    </div>
    <p className="doit-mutual-title echo-zzarit-title">{ZZARIT_COPY.title}</p>
    <p className="doit-mutual-body echo-zzarit-body">{ZZARIT_COPY.body}</p>
    <button ref={startRef} type="button" className="doit-product-action echo-zzarit-cta" onClick={onStart}>{ZZARIT_COPY.next}</button>
    <p className="doit-connect-note echo-zzarit-note">{note ?? '먼저 ECHO가 두 분께 같은 질문 하나를 드려요. 둘 다 답하면 서로의 이름과 사진이 열려요.'}</p>
  </section>;
}
