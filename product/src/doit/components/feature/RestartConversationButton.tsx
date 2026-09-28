import { useRestartConversation } from '@/doit/hooks/useRestartConversation';
import './glass-button.css';

// 「처음부터 다시 시작하기」 버튼 — 대화 화면 밖(홈·나의 이해·연결 준비)에서 쓰는 한 가지 모양. 누르면 곧바로 ECHO 첫 대화 화면.
export default function RestartConversationButton({ userId, className = 'doit-restart-pill' }: { userId: string; className?: string }) {
  const { restart, busy, error } = useRestartConversation(userId);
  return <>
    <button type="button" className={`echo-glass-btn echo-glass-btn--secondary ${className}`} disabled={busy} aria-busy={busy} onClick={() => void restart()}><span aria-hidden="true">↺</span>{busy ? '새로 여는 중이에요' : '처음부터 다시 시작하기'}</button>
    {error && <p className="doit-product-error" role="alert">{error}</p>}
  </>;
}
