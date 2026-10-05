import { useRef } from 'react';
import KeyIcon from './KeyIcon';
import { openGuide } from '@/lib/guide/bus';
import './key-chip.css';

// 2026-10-05 대표 「이 안에 키랑 다 같이 가져가는 거야」: 승인 시안 윗줄 오른쪽의 KEY 유리 알약(금빛 열쇠 + KEY).
// KEY 는 아직 준비 중이다(서버 잔액·차감 없음 — KeyIcon.tsx · 이용 안내 'key'). 그래서 숫자·잔액·차감을 보여 주지 않고,
// 누르면 이용 안내의 「KEY, 어디에 쓰나요?」가 열린다(닫으면 하던 화면 그대로).
export default function KeyChip() {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} type="button" className="echo-key-chip" aria-label="KEY 안내 열기" onClick={() => openGuide('key', ref.current)}>
      <KeyIcon size={20} tone="gold" />
      <span aria-hidden="true">KEY</span>
    </button>
  );
}
