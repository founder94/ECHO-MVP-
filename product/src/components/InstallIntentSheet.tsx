import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import InstallAppCard from '@/doit/components/feature/InstallAppCard';
import { IS_APP_SITE } from '@/lib/siteRole';
import { useBackClose } from '@/hooks/useBackClose';
import './install-intent.css';

// 2026-09-30 대표 마감 지시 §15: 홈페이지 「모바일 앱 깔기」(do-it.company) → 앱 주소(?install=1)로 넘어온 경우에만
// 온보딩(시작 그림·인트로)이 끝난 뒤 첫 화면 아래에 기존 설치 카드(InstallAppCard · 갤럭시 설치 창 / 아이폰 홈 화면 추가 안내 / 이미 설치됨)를 한 번 띄운다.
// 새 다운로드 페이지 0 · 자동 설치 0 · 닫으면 이번 세션에서 다시 띄우지 않는다. 앱 빌드에서만 켠다.
const KEY = 'echo:install-intent';

function readIntent(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('install') === '1') sessionStorage.setItem(KEY, '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('install') === '1';
  }
}

export default function InstallIntentSheet() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => IS_APP_SITE && readIntent());
  useEffect(() => { if (!open) { try { sessionStorage.removeItem(KEY); } catch { /* 저장이 막힌 환경 */ } } }, [open]);
  // 2026-10-10 기기 호환: 보이는 동안 휴대폰 「뒤로」는 이 카드만 닫는다(인트로 화면에서는 아직 안 보이므로 기록도 쌓지 않음).
  const visible = open && !pathname.startsWith('/do-it/intro');
  useBackClose(visible, () => setOpen(false));
  if (!visible) return null;
  return (
    <div className="doit-install-intent" role="dialog" aria-label="홈 화면에 ECHO 추가">
      <InstallAppCard variant="menu" />
      <button type="button" className="doit-install-intent-close" onClick={() => setOpen(false)}>닫기</button>
    </div>
  );
}
