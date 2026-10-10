# ECHO 1.0 · iPhone + Samsung Galaxy 호환 — 2026-10-10

대표 직접 정정(2026-10-10 「ECHO 1.0 · iPhone + Samsung FINAL LOCK」): 「iPhone만 검수」 폐기. ECHO 1.0 은 iPhone 과 Samsung Galaxy 를 **모두** 지원한다.
새 앱을 만들지 않는다 — 기존 ECHO 1.0 을 두 플랫폼에서 정상 작동하게 고친다. PROD 변경 0.

판정 원칙: **아이폰 PASS ≠ 삼성 PASS · PC 화면 흉내(Playwright) ≠ 실기기 PASS.** 두 기종 실기기 확인 전에는 모바일 최종 PASS 라고 쓰지 않는다.

## 1. 고친 것(코드)

| 영역 | 무엇이 깨졌나(기기) | 고친 것 | 파일 |
|---|---|---|---|
| Google 로그인 | 카카오톡·인스타·네이버·라인·페북·안드로이드 webview·iOS 앱 안 브라우저에서 Google 이 막힘(403 disallowed_useragent) — 두 기종 모두 | 앱 안 브라우저면 Google 버튼 대신 「기본 브라우저로 열기」(카카오 openExternal · 안드로이드 intent:// · 라인 openExternalBrowser) + 「주소 복사」 | `src/components/auth/InAppGoogleGate.tsx`, `src/doit/lib/installContext.ts` |
| 로그인 돌아오기 | 설치 앱(삼성 인터넷·iPhone 홈 화면)에서 Google 로그인이 다른 창으로 돌아오면 8초 뒤 막연한 오류 | 「로그인을 시작한 창과 다른 창으로 돌아왔어요…」 안내 · 돌아갈 화면·약관 동의는 localStorage(10분) | `src/pages/auth/callback/page.tsx`, `src/lib/auth/roundtripStorage.ts` |
| 설치형 앱 | 삼성 인터넷 「앱 설치」에 서비스 워커 필요 | 캐시 0 · 그대로 통과하는 최소 서비스 워커(앱 사이트 운영 빌드만) | `public/sw.js`, `src/lib/appBoot.ts` |
| 재접속 | 배포 뒤 열려 있던 앱이 옛 코드 조각을 HTML 로 받아 오류 · 네트워크 없이 깨어나면 로그아웃처럼 보임 | `/assets/*` 404 + 한 번 새로 고침 · 네트워크 오류면 로그인 상태를 기다림 | `public/_redirects`, `src/context/AuthContext.tsx`, `src/doit/hooks/useAuth.tsx` |
| 화면 크기·안전 여백 | iPhone 설치 앱/안드로이드 edge-to-edge 에서 대화 머리줄·카메라 닫기 버튼이 상태 표시줄 밑 · 100vh 화면의 아래 버튼이 주소창 뒤 | 상단·하단 safe-area 여백 · `.echo-min-h-svh`(100vh → 100svh) | `core-conversation.css`, `product-brand.css`, `CameraSheet.tsx`, `index.css` 외 |
| 접이식(Fold 덮개 280~344px · 펼침 690px) | 넓은 화면 기준 고정값 | 넘침 점검·수정, 기기별 검사 프리셋 | `saju.css`, `qa-browser/ux-flow.mjs`(UX_DEVICE) |
| 키보드·입력 보존 | 입력창이 키보드에 가림 · 옛 삼성 인터넷/iOS 에서 입력창이 안 늘어남 · 카메라 다녀오는 사이 안드로이드가 탭을 정리하면 쓰던 글 사라짐 | `interactive-widget=resizes-content` · 입력창 자동 높이 · 최신 말풍선 보이기 · 입력 중 아래 탭 숨김 · 쓰던 글 sessionStorage 보존(보낼 때 지움) | `index.html`, `src/lib/keyboard.ts`, `src/hooks/useDraftPersist.ts` |
| 뒤로가기·스크롤 | 안드로이드 뒤로/아이폰 밀어서 뒤로가 열린 창 대신 화면 전체를 떠남 · 단계 화면에서 뒤로 = 흐름 이탈 · 새 화면이 중간부터 보임 | `useBackClose`(바텀시트·메뉴·선택창·사진 창·카메라) · `?step=` 단계 기록 · 화면 이동 시 맨 위로 | `src/hooks/useBackClose.ts`, `src/hooks/useStepHistory.ts`, `RouteScrollReset` |
| 사진 업로드 | 200MP(S Ultra)·108MP(A) 사진을 통째로 풀다 탭이 죽음 · iPhone 밝기 조절이 저장본에 안 들어감 · 갤럭시 HEIF 사진이 고르기 화면에서 안 보임 | 머리 정보로 크기 먼저 확인·줄여서 풀기 · 밝기 픽셀 처리 대체 · 안드로이드 HEIC 받아 안내 | `recentPhoto.ts`, `photoCorrect.ts`, `PhotoCapture.tsx` |
| 카메라 | 앱 전환·화면 잠금 뒤 검은 화면 · 오류가 안 보임 · 저해상도 | 멈춤 감지 → 「카메라가 멈췄어요. 다시 켜 주세요.」 · 모든 상태에서 오류 표시 · 1920×1440 요청 | `camera.ts`, `CameraSheet.tsx` |
| 3D 미지원·저사양 | 안드로이드가 백그라운드에서 그래픽 문맥을 잃으면 빈 칸 · Galaxy A 발열 | 문맥 잃음 → 은은한 빛 대체 · 시험용 문맥 해제 · 손가락 화면 배율 1·초당 30장 · 지구 모형 15초 제한 | `src/doit/fx/*`, `FloraBackdrop.tsx`, `FloraBloom.tsx`, `dandelion-scene.ts` |
| Agent·연결·채팅 | 느린 망에서 요청이 끝없이 걸림 · 다시 열었을 때 옛 대화 · 오프라인도 막연한 오류 | 함수별 제한 시간(30~90초, 서버 예산보다 길게) → 기존 다시 시도 · 화면 복귀·온라인 때 새로 읽기 · 「인터넷 연결을 확인해 주세요.」 | `understandingApi.ts`, `photoStorage.ts`, `ConnectionMatches.tsx`, `ConnectionCandidates.tsx` |

## 2. PC 흉내 검사(실기기 아님)

`qa-browser/ux-flow.mjs` 를 `UX_DEVICE=` 로 같은 99~100개 장면을 기기 크기·삼성 인터넷/안드로이드 크롬 UA 로 돌린다:
`galaxy-s24`(360) · `galaxy-s24-ultra`(384) · `fold-cover`(344) · `fold-cover-narrow`(280) · `fold-open`(690) · `flip`(360×880). 기본(없음) = 390×844.
엔진은 PC 크롬(Chromium) 하나 — **iPhone 의 WebKit 엔진·삼성 인터넷 실제 엔진은 흉내 못 함.** 결과는 PR 본문에 적는다.

## 3. 실기기 확인 순서(대표 · Codex 독립 검수)

두 기종 각각, 브라우저(Safari / 삼성 인터넷·크롬)와 설치형 앱 둘 다. 하나라도 FAIL 이면 그 기종 모바일 PASS 아님.

| # | 확인 | iPhone | Galaxy |
|---|---|---|---|
| 1 | 설치: Safari 공유→홈 화면 추가 / 삼성 인터넷 「앱 설치」·크롬 「홈 화면에 추가」 → 아이콘으로 열기 | | |
| 2 | Google 로그인(브라우저) → 돌아와 로그인 유지 · 앱 닫았다 다시 열기 → 그대로 로그인 | | |
| 3 | 설치 앱에서 Google 로그인 → 다른 창으로 돌아오면 안내 문구가 나오는지 | | |
| 4 | 카카오톡으로 받은 링크 → 앱 안 브라우저에서 「기본 브라우저로 열기」 동작 | | |
| 5 | ECHO 대화: 키보드 올라와도 입력창·보내기 보임 · 긴 답 입력창 늘어남 · 새 질문이 화면에 보임 | | |
| 6 | 쓰던 글 보존: 대화 중 홈 버튼 → 다른 앱 → 돌아오기 | | |
| 7 | 뒤로: 메뉴·바텀시트·사진 창이 열린 상태에서 뒤로(안드로이드 뒤로 / iPhone 밀어서 뒤로) = 창만 닫힘 · 시작 단계에서 뒤로 = 이전 단계 | | |
| 8 | 사진: 앨범 사진(아이폰 HEIC 자동 변환 / 갤럭시 고효율 사진 켠 상태) · 카메라 촬영 · 밝기 조절이 저장본에 반영 | | |
| 9 | 카메라 켠 채 앱 전환·화면 잠금 → 돌아오면 「카메라가 멈췄어요」 → 다시 켜기 | | |
| 10 | 연결·찌릿(두 구슬)·채팅 · 앱 다시 열면 새 대화 보임 | | |
| 11 | 3D: 기다림 효과·찌릿 그림이 보이거나(또는 은은한 빛) 글·버튼은 항상 보임 · 30초 이상 써도 과열·버벅임 없는지(Galaxy A) | | |
| 12 | 화면: 상단 상태 표시줄·하단 홈 막대에 버튼이 가리지 않음 · Fold 덮개 화면/펼친 화면에서 가로 넘침 0 | | |

## 4. 남은 위험 · 한계
- 서비스 워커는 캐시를 하지 않는다(옛 화면이 남는 위험 0) — 삼성 인터넷이 이것만으로 「앱 설치」를 띄우는지는 실기기 확인 필요.
- 빌드의 CSS 압축이 `100vh` 같은 이중 선언 대체값을 지운다 — 그래서 `@supports` 로 감쌌다. 다른 오래된 대체값(`.echo-min-h-viewport`)도 같은 영향이 있어 별도 점검 대상.
- 운영(PROD) 서버에는 `CORS_ALLOWED_ORIGINS` 를 운영 주소로 넣어야 함(운영 배포 체크리스트 6번) — 대표 승인 대상.
