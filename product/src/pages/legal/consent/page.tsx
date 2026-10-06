import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { sanitizeReturnPath } from '@/lib/auth/returnPath';
import ConsentChecklist from '@/components/legal/ConsentChecklist';
import { consentMetadata, EMPTY_CONSENT, persistConsent, requiredAllChecked, type ConsentChoice } from '@/lib/legal/consent';
import { LEGAL_VERSION } from '@/lib/legal/documents';
import '@/pages/legal/legal.css';

// 로그인은 됐는데 현재 버전 약관 동의가 서버에 없는 회원이 오는 화면(ConsentGate 가 보낸다).
// - 필수 3개 동의 → 서버 저장 → 원래 가려던 화면으로 돌아간다.
// - 구제: 동의하지 않으면 로그아웃할 수 있다. 저장 실패는 화면에 보이고 다시 누를 수 있다.
export default function ConsentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, consentStatus, markConsented, signOut } = useAuth();
  const from = sanitizeReturnPath((location.state as { from?: string } | null)?.from);
  const [choice, setChoice] = useState<ConsentChoice>(EMPTY_CONSENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // 로그인 전이면 로그인으로. 이미 동의돼 있으면 바로 원래 화면으로.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true, state: { from } });
      return;
    }
    if (consentStatus === 'ok') navigate(from, { replace: true });
  }, [loading, user, consentStatus, from, navigate]);

  const submit = async () => {
    if (!user || inFlight.current || !requiredAllChecked(choice)) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const failure = await persistConsent(supabase, user.id, consentMetadata(choice));
      if (failure) {
        setError(failure);
        return;
      }
      markConsented();
      navigate(from, { replace: true });
    } catch {
      setError('동의 내용을 저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const leave = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await signOut();
      navigate('/', { replace: true });
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div className="legal-page">
      <header className="legal-page-nav">
        <Link to="/" className="legal-page-home">DO IT <span>COMPANY</span></Link>
      </header>
      <main className="legal-page-body">
        <p className="legal-page-eyebrow">계속하기 전에 · {LEGAL_VERSION}</p>
        <h1>이용약관과 개인정보 처리방침에<br />동의가 필요해요.</h1>
        <p className="legal-page-lead">
          내 이야기와 사진을 안전하게 보관하기 위한 약속이에요. 각 문서는 "보기"를 눌러 전체를 읽을 수 있어요.
        </p>

        <ConsentChecklist value={choice} onChange={setChoice} disabled={saving} />

        {error && <p className="legal-page-error" role="alert">{error}</p>}

        <div className="legal-page-actions">
          <button type="button" className="legal-page-primary" onClick={() => { void submit(); }} disabled={saving || !requiredAllChecked(choice)} aria-busy={saving}>
            {saving ? '저장 중' : '동의하고 계속하기'}
          </button>
          <button type="button" className="legal-page-text-button" onClick={() => { void leave(); }} disabled={saving}>
            동의하지 않고 로그아웃
          </button>
        </div>
        <p className="legal-page-fine">동의 내용은 계정에 저장되며, 약관이 바뀌면 다시 안내해요.</p>
      </main>
    </div>
  );
}
