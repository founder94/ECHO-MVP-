# A 음악 카드 실행검수 (2026-09-13)

## 검사한 소스
- **project-13870088.zip** (대표 첨부) · SHA-256 `8ec6504f23f1983372a5f908e83d9d34f7ac6439c8fb6143bc3e93f962dbb6dd` · 583,777 bytes · 289 파일. 래디 최신 전체 프로젝트(PATCH C 반영 + 음악 카드).
- 이전 기준본 project-13865617 대비 변경 파일: toss.ts / payment/page.tsx / payment/success/page.tsx (PATCH C) · landing/page.tsx · landing/components/LandingSection.tsx · **신규** hero/components/OriginalMusicCard.tsx. 그 외 동일.
- `.env` 종류만 확인: Supabase URL host = zyyhhxyupizcqhxqnxuu(운영), anon = sb_publishable_(46자), Toss 클라이언트 키 = 비어 있음. 값 미출력.
- DOIT_A_MUSIC_CLAUDE_REVIEW_HANDOFF_20260913.zip(원음·MANIFEST·PROVENANCE): **미도착**.

## Readdy 반영본 대조
- PATCH C 3파일: 래디 반영본 vs Claude 후보(readdy-new) — **기능 동일, 주석·줄바꿈만 차이**(toss.ts 주석 5줄, payment/page.tsx 주석 1줄 + JSX 줄바꿈, success/page.tsx 주석 1줄). 코드 경로·상수·조건 동일.
- 음악 카드: 래디 보고문의 retryPlay/togglePlay 전문·diff C-1~C-7 과 실제 파일 **일치**(일시정지 분기 requestIdRef 증가, errorState 3값, isNotAllowedError, playing 이벤트 기준 표시).
- 배치: landing/page.tsx 09 구간 `<LandingSection …>` 의 children 으로 `<OriginalMusicCard />` 1개. LandingSection 은 children prop 만 추가(액션 버튼 바로 아래 렌더). 라우트·다른 구간·hero 페이지 변경 없음.

## 원음 검사
| 항목 | 결과 |
|---|---|
| 원격 URL 2개(storage.helloreaddy.io) 응답·바이트 | **NOT RUN** — 프록시 CONNECT 403 |
| 첨부 원음 vs MANIFEST 해시 | **NOT RUN** — 인계 ZIP 미도착 |
| 브라우저 실재생 | 합성 대체음(사인파 5s/3s, 로컬 생성)으로 **로직만** 검사. 원음·청취 검사 아님 |

## 정적 검사 (동일 소스, /home/user/readdy-v88 격리 사본, node_modules 는 동일 package.json 재사용)
- 교정 전: type-check 0 · lint 0 · build 통과 (`tests/CHECKS_project-13870088_pre-patch.log`)
- 교정 후(PATCH M1): type-check 0 · lint 0 · build 통과

## 실제 브라우저 검사 (Playwright + 헤드리스 크로미움 · 실제 앱 빌드 /do-it/landing · 390px 기본)
- 하네스: `tests/music-card.browser.mjs`. 원격 mp3 요청을 가로채 합성 대체음 제공(Range 지원), 지연·1회 404 주입 가능. Audio 생성자 래핑으로 실제 엘리먼트 상태(currentTime/paused/ended/error) 관측. Supabase·YouTube·기타 외부 전부 차단·집계(supabase 0 · youtube 0).
- 합성 이벤트 시험(H)은 `HTMLMediaElement.prototype.play` 를 1회 대체해 오류를 주입한 것으로, 실제 미디어 시험과 구분해 표기.

### 교정 전 결과: 35/37 (FAIL 2 = 시나리오 I)
재현: 원음 2 요청에 404 1회 → "음원을 재생하지 못했어요" 안내 표시(정상) → 서버 정상 복구 후 **다시 재생** 클릭 → media error 4 유지 · currentTime 0 · 안내 유지 · 재생 안 됨.
원인: `retryPlay` 가 로드 실패로 `audio.error` 가 남은 엘리먼트에 `play()` 만 호출. HTML 미디어 사양상 로드 실패 상태는 src 재설정/`load()` 전엔 복구되지 않아 play() 가 다시 거절됨(NotSupportedError → 'failed').

### 최소 수정 PATCH M1 (`PATCH_M1_retryPlay_reload.diff`, OriginalMusicCard.tsx retryPlay 만)
`audio.error` 가 있을 때만 같은 곡 src 를 다시 설정(표시 시간 0 초기화) 후 play(). 브라우저 차단(NotAllowedError)은 error 가 없으므로 기존대로 위치 보존 재생. 다른 함수·JSX·배치·디자인 변경 없음.

### 교정 후 결과: **37/37 PASS** (`tests/music_browser_report.json`)
| 시나리오 | 결과 |
|---|---|
| 배치: 09 구간 시작하기 버튼 바로 아래(버튼 하단 482px → 카드 상단 502px) · 카드 1개 | PASS |
| 홈 BGM(YouTube iframe) 랜딩에 없음 · youtube 요청 0 | PASS |
| A. 최초 무음(요청 0) → 원음 1 클릭 → playing → currentTime 0.22→0.92 증가 | PASS |
| B. 1→2 전환: src 교체 · Audio 인스턴스 1개 유지 | PASS |
| C. 이어 듣기 1→2 자동 전환 → 2 종료 후 정지 · 2.5s 후 재시작 없음 | PASS |
| D. 일시정지 위치 유지(1.12s) → 재개 1.21s 부터 | PASS |
| E. 음악 끄기 → src 비움 · 2.5s 후 재시작 없음 · 0:00/0:00 | PASS |
| F. 느린 로딩(1.5s) 중 일시정지·같은 곡 재클릭 | PASS |
| G. 느린 로딩 중 끄기 → 늦은 응답 후 정지 유지 · 빠른 1→2 전환 후 원음1 복귀 없음 | PASS |
| H(합성). NotAllowedError→차단 문구 / 일반 오류→실패 문구 / AbortError→무표시 | PASS |
| I. 원음 2 404 → 실패 안내 → 다시 재생 → 재생·안내 해제·media error 해제 | PASS (M1 후) |
| J. 표시 시간 = 실제(0:00/0:05, 전환 후 0:00/0:03, 종료 후 0:00/0:03) | PASS |
| 이탈(/do-it/hero) → Audio 정지·해제 · 뒤로가기 재방문 자동재생 없음 | PASS |
| 키보드 Enter/Space · 버튼 접근 가능한 이름 5종 | PASS |
| 360/390/430px 카드 폭 312/342/382 · 가로 넘침 없음 · 시작하기 가림 없음 | PASS |

증거: `evidence/music_01_initial_390.png`(초기) · `music_02_playing_390.png`(재생 중) · `music_03_after_sequence_390.png` · `music_04_failed_notice_390.png` · `music_05_section09_{360,390,430}.png`.
스크린샷에서 아이콘(remixicon)·배경 이미지(static.readdy.ai)가 비어 보이는 것은 하네스가 외부 CDN 을 차단했기 때문이며 제품 문제 아님.

## 확인 불가 / NOT RUN
- 원음 2곡 원격 응답·바이트 동일·실제 청취(사람 귀) · 실기기(iOS Safari 자동재생 정책 포함).
- 홈 → /start → DO IT 선택 → 랜딩의 실제 클릭 경로(홈은 YouTube·Supabase 의존, 로컬 차단 환경에서 미실행). 랜딩 직접 진입·이탈·복귀만 실행.
- 성별 매핑 근거 없음 → 원음 1/2 표기 유지.

## 판정
- 소스 기준본: project-13870088 = 래디 최신. 래디 보고문과 실제 파일 **일치**.
- 카드 로직: PATCH M1 적용 시 **일치**(37/37, 합성 대체음). M1 미적용 시 시나리오 I **불일치**(재현됨).
- 원음·청취·실기기: **확인 불가**.
- 이번 검수에 Publish 승인 없음. 결제 비활성 ZIP(0fce51a0…)은 변경·교체 없음. 음악 포함 배포 후보는 M1 반영 후 별도 결정.
