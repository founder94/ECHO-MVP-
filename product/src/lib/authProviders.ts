// 로그인 방법 표시 스위치. 기본은 켜짐(운영 동작 그대로).
// 2026-09-27 대표 실기기 QA: QA Supabase 에 Google 제공자가 꺼져 있는데 버튼이 보여 「provider is not enabled」 오류가 났다.
// 버튼을 보여 놓고 실패하게 두지 않는다 — 제공자가 꺼진 환경의 빌드에서만 VITE_AUTH_GOOGLE_ENABLED=false 로 숨긴다.
export const GOOGLE_LOGIN_ENABLED = import.meta.env.VITE_AUTH_GOOGLE_ENABLED !== 'false';
