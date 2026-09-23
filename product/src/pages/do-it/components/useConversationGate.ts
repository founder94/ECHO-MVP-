import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// 로그인·대화 식별값(?c=) 확인 뒤 init 을 정확히 한 번 실행한다(STEP 1/2 화면과 같은 규칙).
// 로그인 전이면 현재 화면(returnPath)으로 돌아오도록 /login 에 넘긴다. 대화 식별값이 없으면 /weather-check.
export function useConversationGate(returnPath: string, init: () => void, requireConversation = true): { conversationId: string; userId: string } {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const conversationId = searchParams.get('c') ?? '';
  const initRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: returnPath } });
      return;
    }
    if (requireConversation && !conversationId) {
      navigate('/weather-check');
      return;
    }
    if (initRef.current) return;
    initRef.current = true;
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, conversationId]);

  return { conversationId, userId: user?.id ?? '' };
}