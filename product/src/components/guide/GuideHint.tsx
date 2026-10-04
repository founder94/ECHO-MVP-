import { useEffect, useRef, useState } from 'react';
import { guideSection, type GuideSectionId } from '@/lib/guide/content';
import { hintSeen, markHintSeen, openGuide } from '@/lib/guide/bus';
import './guide.css';

// 처음 쓰는 기능 옆의 짧은 도움말(2026-10-04 대표 「이용 안내 통합」 §3·§6).
// - 처음 한 번만 한 줄 + 「자세히 보기」·「닫기」. 닫은 뒤에는 작은 「이 기능이 궁금해요」 글자 링크만 남는다.
// - 입력칸을 가리는 떠 있는 풍선이 아니다(자기 자리에만 놓인다) · 화면 이동 0 · 닫기는 어떤 동의도 아니다.
// - 「닫았다」는 이 기기 브라우저에만 남는다(다른 기기에서는 다시 보일 수 있다).
export default function GuideHint({ id, linkLabel = '이 기능이 궁금해요' }: { id: GuideSectionId; linkLabel?: string }) {
  const section = guideSection(id);
  const [seen, setSeen] = useState(() => hintSeen(id) || !section.hint);
  // 「자세히 보기」·「닫기」를 누르면 그 버튼이 작은 링크로 바뀐다(사라진다). 초점은 바뀐 링크로 옮기고,
  // 안내 창은 그 링크를 「닫은 뒤 돌아올 곳」으로 넘겨 연다(사라진 버튼에 초점을 돌려주지 못하는 문제 방지).
  const linkRef = useRef<HTMLButtonElement>(null);
  const [after, setAfter] = useState<'open' | 'focus' | null>(null);
  useEffect(() => {
    if (!seen || !after) return;
    const link = linkRef.current;
    if (after === 'open') openGuide(id, link); else link?.focus({ preventScroll: true });
    setAfter(null);
  }, [seen, after, id]);
  const more = () => { markHintSeen(id); setSeen(true); setAfter('open'); };
  if (seen) return <button ref={linkRef} type="button" className="echo-guide-link" onClick={() => openGuide(id)}>{linkLabel}</button>;
  return <div className="echo-guide-hint" role="note">
    <p>{section.hint}</p>
    <div className="echo-guide-hint-actions">
      <button type="button" className="echo-guide-link" onClick={more}>자세히 보기</button>
      <button type="button" className="echo-guide-link" onClick={() => { markHintSeen(id); setSeen(true); setAfter('focus'); }}>닫기</button>
    </div>
  </div>;
}
