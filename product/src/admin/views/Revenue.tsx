// 수익 — 결제·환불·직접 비용. 지금 출시 범위에 결제가 없고 관리자 서버(admin-web)에 결제 자료 창구가 없다(0 으로 보이지 않게 「연결 필요」).
import { adminCall } from '../api';
import { useLoad } from '../useLoad';
import { Loading, Notice, Section, Stat } from '../ui';

// 2026-10-06 유료 자유 대화(대화 서버 doit-agent 의 이번 달 사용량 요약 · 수치만 · 글 0). 결제는 아직 연결 전이라 「수익」이 아니라 「AI 비용」이다.
interface FreeSummary { enabled: boolean; users: number; requests: number; failed: number; calls: number; tokens_in: number; tokens_out: number; krw: number | null; price_known: boolean; limits: { trial: number; daily: number; user_month_krw: number; company_month_krw: number } }

export default function Revenue() {
  const [free, reload] = useLoad(() => adminCall<FreeSummary>('doit-agent', { action: 'admin_free_summary' }), []);
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
      <Section title="유료 자유 대화 · 이번 달 AI 비용">
        {free.kind === 'loading' ? <Loading /> : free.kind === 'error' ? <Notice kind="연결 필요">{free.message} <button type="button" className="aw-btn aw-btn--ghost" onClick={reload}>다시 불러오기</button></Notice> : <>
          <p className="aw-muted">스위치 {free.data.enabled ? '켜짐' : '꺼짐(기본)'} · {free.data.price_known ? '단가·환율 확인됨' : '단가·환율 없음 — 켜도 AI 를 부르지 않아요'} · 맛보기 {free.data.limits.trial}회 · 하루 {free.data.limits.daily}회 · 한 사람 한 달 {free.data.limits.user_month_krw.toLocaleString()}원 · 회사 한 달 {free.data.limits.company_month_krw.toLocaleString()}원</p>
          <div className="aw-grid">
            <Stat label="이번 달 사용자" value={free.data.users} />
            <Stat label="이번 달 요청" value={free.data.requests} hint={`실패 ${free.data.failed}`} />
            <Stat label="AI 호출" value={free.data.calls} />
            <Stat label="이번 달 금액(원)" value={free.data.krw} missing="연결 필요" hint="토큰 × 정책 단가 × 고정 환율(청구서 아님)" />
          </div>
        </>}
      </Section>
    </div>
  );
}
