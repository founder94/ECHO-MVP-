# Backlog (이번 릴리스 제외 · 2026-09-27 대표 결정) — 조사 결과 보존

이번 운영 릴리스에는 넣지 않는다. 운영 배포 후 「Brand / Homepage / Mobile Experience 정리」 단계에서 다룬다.
기준: 2026-09-27 대표 「HOMEPAGE / MOBILE BRAND ARCHITECTURE · COMPANY LOCK」.

## 온보딩 (현재 실제 흐름 · QA 브라우저 확인)
Hero(`/`) → 「ECHO 시작하기」 → 선택창 AgentChoiceLayer(「대화 시작하기」 · 중복 시작) → SignupConsent(`/doit/start-journey`)
→ `/login`·`/signup`(가입 완료 후 「로그인하기」 재입력) → `/doit/conversation?from=journey` 첫 질문(목적) → AI 대화 → 「사진과 소개 채우기」(`?edit=profile`) → 연결 준비.
- 대표 목표 흐름: Hero → 시작하기 → 목적 → 가입/동의 → 프로필 → 사진 → AI 대화 → 이해 확인/정정 → Profile → Matching 준비
- 차이: ① 선택창 중복 시작 ② 목적이 가입 뒤(A_STRUCTURE_SERVER_ENABLED 분기) ③ 프로필·사진이 대화 뒤
- 판정: OnboardingCinematicOverlay REMOVED · DoItIntroFrame ACTIVE · `/do-it/start-journey` 없음(실제 `/doit/start-journey` ACTIVE) · PurposeSelect CONNECTED(스위치 ON 에서 미표시) · SignupConsent ACTIVE · PhotoCapture/ProfileReview CONNECTED(대화 뒤)
- 수정 예상: `src/pages/do-it/landing/page.tsx`, `src/doit/pages/do-it/start-journey/page.tsx`, `AgentConversation.tsx`/`CoreConversation.tsx` 마침 버튼

## D / 실버 심볼 · 로딩 (브랜드 전환 자산 — PWA 아이콘과 분리)
- 원본: `public/brand/doit-symbol-original.png`, 표시용 `doit-symbol-intro.webp`(ca7fb0e 이후 변경·삭제 0 · 운영 파일과 해시 동일)
- 첫 실행 `/do-it/intro`(IntroUniverse): 검정 배경 · 점들이 모여 D · 약 3.2초 → 히어로 (ACTIVE)
- 로딩 6곳(SymbolLoader · 점이 모이는 3D): 지금은 파스텔 배경(198d91a 9/25 · b94f6b0 9/26 「검정 번쩍임 0」)
- 과거 회전: cf4f227(9/22) 검정 배경 · 멈춘 심볼 + 1.6초 링 회전 · 숨쉬는 빛
- echoHaloOrbit / echoGodrayMove: 모든 이력에 0건
- 복원 후보(대표 승인 필요): 전환·대기 화면만 검정 + 기존 SymbolLoader · 검정→파스텔 부드러운 전환(COMPANY LOCK §5 「밖 → 안」)

## 앱 아이콘 (별도 자산)
- 현재 manifest/운영: 은색 E 아이콘(fc25367 「founder-designated」) · 대표 「검정 정본」 발언 후 후보: 9/23 검정 D 세트(ca7fb0e) / 남색 원형 favicon — 대표 선택 대기

## QA 환경
- QA DB `purposes` 누락 → 2026-09-27 운영과 같은 구조·10행으로 QA 에만 보완(완료)
