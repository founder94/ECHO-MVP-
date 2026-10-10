import { Link } from 'react-router-dom';
import './fortune-doors.css';

// 2026-10-06 대표 「메인에는 사주 이미지 넣고 사용자가 버튼 누를 수 있게 · 타로 이미지는 타로 버튼」: 홈 아래 두 장의 그림 문.
// 누르면 사주·타로 첫 화면을 건너뛰고 바로 입력/카드 고르기로(/doit/fortune?mode=…). 재미로 보는 콘텐츠 — 나의 이해·연결에 쓰지 않는다.
// 2026-10-10 대표 「기존 디자인 다 삭제 · 심볼만 살려」: 그림 두 장 삭제 → Flora 유리 문(글만).
export default function FortuneDoors() {
  return <section className="doit-fortune-doors" aria-labelledby="fortune-doors-title">
    <p className="doit-fortune-doors-kicker" id="fortune-doors-title">잠깐 쉬어 가요</p>
    <div className="doit-fortune-doors-row">
      <Link className="doit-fortune-door" to="/doit/fortune?mode=saju">
        <span className="doit-fortune-door-text"><strong>사주</strong><small>내 안의 다섯 가지 기운 보기</small></span>
      </Link>
      <Link className="doit-fortune-door" to="/doit/fortune?mode=taro">
        <span className="doit-fortune-door-text"><strong>타로</strong><small>카드 한 장으로 오늘 흐름 보기</small></span>
      </Link>
    </div>
    <p className="doit-fortune-doors-note">재미로 보는 이야기예요. 나의 이해나 연결에는 쓰지 않아요.</p>
  </section>;
}
