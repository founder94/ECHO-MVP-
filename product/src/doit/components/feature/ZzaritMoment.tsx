import GuideHint from '@/components/guide/GuideHint';
import { useEffect, useRef } from 'react';
import './zzarit.css';
import LatticeStage from '@/doit/flora/LatticeStage';

// 찌릿(2026-10-04 대표 「홈페이지·모바일 디자인 교체」 · 최신 KEY·찌릿 지시). 서버가 mutual + match_id 를 준 뒤에만 부모가 이 화면을 연다
// (한쪽 선택만으로는 열리지 않음 · 같은 연결에서 한 번만 = lib/zzarit.ts). 이 화면은 연결을 열거나 상태를 바꾸지 않는다.
// 「찌릿! 텔레파시가 통했어요」는 매칭 기쁨의 비유일 뿐(속마음 판정 아님).
// 상대 사진·이름 0. 소리 0 · 진동은 아주 짧게 한 번(움직임 줄이기면 0). 다음 버튼은 처음부터 눌린다(연출을 기다리지 않음).
// 2026-10-10 대표 「모바일웹 전부 최종 후킹 · Lattice 효과 넣어라」: 2026-10-09 「추가 효과 배치」 §2 확정 문구로 —
//   후킹 「서로의 선택이, / 하나의 대화로.」 · 설명 「두 분 모두 연결을 선택했어요.」 · 버튼 「첫 대화 시작하기」. 「찌릿!」은 위 작은 줄로 남긴다(2026-10-04 찌릿 지시).
//   가운데 = Einstein–Rosen Lattice(빛의 통로). 위 글 / 가운데 효과 / 아래 버튼 — 세 층을 나눠 겹치지 않는다.
export const ZZARIT_COPY = { eyebrow: '찌릿! 텔레파시가 통했어요', title: ['서로의 선택이,', '하나의 대화로.'], body: '두 분 모두 연결을 선택했어요.', next: '첫 대화 시작하기' } as const;

function AnonNode() {
  return <span className="echo-zzarit-node" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="18" r="8" fill="currentColor" /><path d="M9 41c1.8-8 8-12.5 15-12.5S37.2 33 39 41" fill="currentColor" /></svg>
  </span>;
}

// 선택 대기(시안 7): 같은 익명 노드 둘 + 점선(아직 이어지지 않음). 움직임 0 · 상대 정보 0 · 상대가 골랐는지 추정해 보여 주지 않는다.
export function WaitingMark() {
  return <div className="echo-zzarit-mark echo-wait-mark" aria-hidden="true">
    <AnonNode />
    <span className="echo-wait-link" />
    <AnonNode />
  </div>;
}

export default function ZzaritMoment({ onStart, note }: { onStart: () => void; note?: string }) {
  const startRef = useRef<HTMLButtonElement>(null);
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!reduce) { try { navigator.vibrate?.(12); } catch { /* 진동이 없어도 그만 */ } }
    startRef.current?.focus({ preventScroll: true });
    // 휴대폰에서 아래 메뉴에 「첫 대화 시작하기」가 가리지 않게(버튼의 scroll-margin 만큼 띄워) 화면 안으로 — 연출을 기다리지 않고 바로 넘길 수 있게.
    startRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [reduce]);
  return <section className="doit-connect doit-mutual echo-zzarit" aria-label="서로 같은 선택" role="status">
    <p className="echo-zzarit-eyebrow">{ZZARIT_COPY.eyebrow}</p>
    <p className="doit-mutual-title echo-zzarit-title">{ZZARIT_COPY.title[0]}<br />{ZZARIT_COPY.title[1]}</p>
    <p className="doit-mutual-body echo-zzarit-body">{ZZARIT_COPY.body}</p>
    <LatticeStage play={reduce ? 'still' : 'live'} />
    <button ref={startRef} type="button" className="doit-product-action echo-zzarit-cta" onClick={onStart}>{ZZARIT_COPY.next} <span aria-hidden="true" className="echo-flora-arrow">→</span></button>
    <p className="doit-connect-note echo-zzarit-note">{note ?? '먼저 ECHO가 두 분께 같은 질문 하나를 드려요. 둘 다 답하면 서로의 이름과 사진이 열려요.'}</p>
    <GuideHint id="zzarit" linkLabel="‘찌릿!’이 뭐예요?" />
  </section>;
}
