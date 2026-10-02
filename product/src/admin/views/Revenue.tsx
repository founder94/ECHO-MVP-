// 수익 — 결제·환불·직접 비용. 지금 출시 범위에 결제가 없고 관리자 서버(admin-web)에 결제 자료 창구가 없다(0 으로 보이지 않게 「연결 필요」).
import { Notice, Section, Stat } from '../ui';

export default function Revenue() {
  return (
    <div className="aw-page">
      <Notice kind="연결 필요">결제·환불·비용 자료는 아직 관리자 서버에 연결되지 않았어요. 가격·결제·환불 정책은 대표 승인 뒤 서버가 기록한 값만 보여 줘요.</Notice>
      <Section title="수익">
        <div className="aw-grid">
          <Stat label="결제" value={null} missing="연결 필요" />
          <Stat label="환불" value={null} missing="연결 필요" />
          <Stat label="확인된 직접 비용" value={null} missing="연결 필요" hint="AI 호출 비용 포함 · 청구서 기준" />
        </div>
      </Section>
    </div>
  );
}
