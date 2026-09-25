import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyTurns, turnsMessage, type MyTurns } from '@/doit/lib/connectApi';
import './connect.css';

// 앱 홈의 "내 차례" 카드(v1.2, 대표 2026-09-24 "최종완성하라고"). 문자·푸시 알림이 아직 없어서,
// 앱을 열면 여기서 먼저 알려 준다. 서버는 개수만 준다(이름·질문·이야기 내용 없음).
// 못 불러오면 아무것도 그리지 않는다 — 홈의 다른 할 일을 막지 않는다. 내 연결 화면에서 다시 확인할 수 있다.
export default function ConnectionTurnsCard({ userId }: { userId: string }) {
  const [turns, setTurns] = useState<MyTurns['turns'] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyTurns(userId).then((out) => { if (alive) setTurns(out.turns); }).catch(() => { if (alive) setTurns(null); });
    return () => { alive = false; };
  }, [userId]);

  const message = turns ? turnsMessage(turns) : null;
  if (!message) return null;
  return <Link className="doit-turns" to="/doit/connections" aria-label={`${message.title}. 내 연결 보기`}>
    <strong>{message.title}</strong>
    <span>{message.detail}</span>
    <em className="doit-turns-go">내 연결 보기 →</em>
  </Link>;
}
