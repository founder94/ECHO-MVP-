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

---

## 추가 (2026-09-13 · 대표가 원음 2개 직접 첨부 후 재검사)

### 수신 원음
| 파일(첨부명 UUID) | 카드 TRACKS 대응 | 크기 | 길이 | 형식 | SHA-256 |
|---|---|---|---|---|---|
| …65f5bc59-e582-437a-97af-88cc38b6d259.mp3 | 원음 1 (TRACKS[0] URL 뒤 UUID 일치) | 1,142,136 B | 28.6 s | MPEG-1 Layer III 320 kbps 44.1 kHz JStereo, 태그 없음 | `e38d47dac045590effdb02e0a1c82281d3ac85d508c17da0e11b3c4f9f335afe` |
| …02c258b7-43c4-40c2-b6f1-ac72d7d5be8d.mp3 | 원음 2 (TRACKS[1] URL 뒤 UUID 일치) | 1,813,428 B | 45.3 s | 동일 | `caa47c3da81fa470ec3d3623282ffcf747f792e3d43f536e441b8f032f68e13d` |

- 파일명 UUID 만으로 "원격 = 이 바이트" 라고 판정하지 않는다. 원격 URL 다운로드는 프록시 403 → **원격 바이트 동일 여부 NOT RUN**. MANIFEST.json 미도착 → 대표 원본과의 해시 대조도 NOT RUN(위 해시가 첫 기록).
- 재인코딩·편집·합성 없음. 원본 바이트를 로컬 하네스에서 그대로 제공.

### 실제 원음으로 재실행 (M1 적용 빌드 · `tests/music_browser_report_REAL_AUDIO.json`)
- 하네스 매개변수화(AUDIO_1/AUDIO_2/D1/D2). 원격 mp3 요청을 가로채 대표 원음 바이트를 제공(Range 지원).
- 결과 **37/37 PASS**. 실제 미디어 값: 원음 1 재생 시 currentTime 0.17→0.87 증가, 표시 0:00/0:28 · 전환 후 0:00/0:45 · 이어 듣기 원음 1(28.6s) 종료 → 원음 2 자동 전환(ct 0.15) → 원음 2(45.3s) 종료 후 정지·2.5s 후 재시작 없음 · 종료 후 표시 0:00/0:45 · 일시정지 1.10s → 재개 1.18s · 404 후 다시 재생 성공(err null). Supabase·YouTube 요청 0.
- 구분: 로컬 제공 원음 재생 PASS ≠ 원격 호스팅 PASS. 헤드리스 재생 진행 확인 ≠ 사람 청취·실기기.

### 갱신 판정
- 카드 로직(대표 원음 바이트 기준, M1 적용): **일치** 37/37.
- 원격 호스팅 응답·바이트 동일: **확인 불가**(프록시). 사람 청취·실기기: **확인 불가**.

---

## Readdy M1 반영 대조 (2026-09-13 · project-13871930.zip)
- 수신: project-13871930.zip · SHA-256 `78029a97de538649b9eefe43349cd59ec1280629ed403f57a42d1dc9fcfdf957` · 583,912 bytes · 289 파일.
- project-13870088 대비 변경 파일: **OriginalMusicCard.tsx 1개뿐**. `.env` 동일(값 미출력).
- 그 파일은 Claude M1 패치본(커밋 6061ee8 `OriginalMusicCard.PATCHED_M1.tsx`, readdy-v88 검사 소스)과 **바이트 동일**. 새 차이 없음 → 재수정·전체 ZIP 재요청 없음.
- 따라서 readdy-v88 에서 실행한 type-check 0 / lint 0 / build 통과, 합성음 37/37, 원음 37/37 결과는 이 래디 반영본에 그대로 적용된다(동일 소스).

## 원음 인계 ZIP (DOIT_ORIGINAL_AUDIO_ONLY_20260913.zip)
- **미도착**(업로드 폴더에 없음). MANIFEST 크기·해시 대조 NOT RUN.
- 지시서의 원본 파일명 `65f5bc59-e582-437a-97af-88cc38b6d259(3).mp3` / `02c258b7-43c4-40c2-b6f1-ac72d7d5be8d(3).mp3` 은 직전 직접 업로드 2개와 UUID 일치. 그 바이트(SHA-256 e38d47da… / caa47c3d…)로 원음 검사를 이미 수행. 인계 ZIP 이 오면 MANIFEST 와 이 해시를 대조하면 된다.
- 원음 검사 방식: **전체 자연 종료**(원음 1 28.6 s, 원음 2 45.3 s 를 끝까지 재생). 종료 근처 seek 는 사용하지 않음.

## 홈 → /start → DO IT 선택 → 랜딩 09 클릭 경로 (실제 앱 빌드 · 대표 원음 로컬 제공 · `tests/click-path.browser.mjs`)
결과 **9/9 PASS** (`tests/click_path_report.json`, `evidence/path_01_home.png`·`path_02_start.png`·`path_03_landing09_playing.png`)
| 단계 | 결과 |
|---|---|
| 홈: BGM 플레이어 컨테이너·"음악 켜기/끄기" 토글 존재 | PASS (YouTube 스크립트 요청은 시도됐으나 로컬 차단 → 실제 BGM 재생 없음) |
| 홈 히어로 "시작하기" 링크 클릭 → /start | PASS |
| /start "DO IT 시작하기" 카드 클릭 → /do-it/landing | PASS |
| 랜딩 진입 후 홈 BGM 컴포넌트 언마운트(컨테이너 0·iframe 0) | PASS — 컴포넌트 수명만 확인 |
| 09 구간 시작하기 버튼 아래 카드 1개(버튼 하단 484 → 카드 상단 502) | PASS |
| 진입 시 자동 재생 없음(트랙 요청 0) | PASS |
| 원음 1 클릭 → 대표 원음 재생, currentTime 0.18→0.88 | PASS |
| 09 "시작하기"로 이탈(→ /do-it/1) → 카드 Audio 정지 | PASS |
| 홈 복귀 → BGM 컴포넌트 재마운트, 카드 Audio 재생성 없음 | PASS |

**범위 구분**: 홈 BGM 은 YouTube iframe 기반이라 로컬 차단 환경에서는 실제 재생·정지를 검증하지 못한다. 확인한 것은 (1) 랜딩에 BGM 컴포넌트가 없고 youtube 요청도 없다, (2) 홈 이탈 시 컴포넌트가 언마운트되며 코드상 `destroy()` 를 호출한다 — 까지다. 실제 BGM 소리가 멈추는지는 실기기에서 확인해야 한다.

## 최종 판정 (2026-09-13)
| 항목 | 판정 |
|---|---|
| 원음 수령·해시 | 직접 업로드 2개 수령. 원본 전체 크기·SHA-256 대조 **완료·종료**(e38d47da… / caa47c3d… 일치) |
| 검사 소스·M1 | project-13870088 + M1 = project-13871930(래디 반영본)과 바이트 동일. type-check 0 / lint 0 / build 통과 |
| 실제 MP3 로컬 검사 | 일치 37/37 (전체 자연 종료 방식) + 클릭 경로 9/9 |
| 원격 호스팅 확인 | 확인 불가(프록시 403). 로컬 재생 PASS 를 원격 PASS 로 쓰지 않음 |
| 홈 클릭 경로·BGM | 클릭 경로 일치. BGM 실제 정지 미검증(컴포넌트 언마운트만) |
| 사람 청취·실기기 | 미검증 |
| Readdy M1 반영 동일성 | 일치(바이트 동일) |
| Publish | 없음. 결제 비활성 ZIP 0fce51a0… 무변경 |

---

## 원본 음원 대조 — 완료·종료 (2026-09-13 · 전략본부 대조표 값 기준)
- 보유 파일을 지시문의 원본 전체 크기·SHA-256 과 직접 비교해 두 곡 모두 일치. **이 항목은 종료**(JSON·인계 ZIP 재전송 불필요, 미완료 사유 없음).
| 원본 파일명 | 원본 크기·SHA-256(지시문) | 보유 파일 | 판정 |
|---|---|---|---|
| 65f5bc59-e582-437a-97af-88cc38b6d259(3).mp3 | 1,142,136 B · e38d47da…35afe | origin-1.mp3 1,142,136 B · e38d47da…35afe | **일치** |
| 02c258b7-43c4-40c2-b6f1-ac72d7d5be8d(3).mp3 | 1,813,428 B · caa47c3d…8e13d | origin-2.mp3 1,813,428 B · caa47c3d…8e13d | **일치** |
- 이 대조는 음원 전용이다. M1 코드 동일성(별도 확인 완료)·원격 호스팅 바이트(NOT RUN)와 무관.
- 원격 MP3: 이전 시도 프록시 403. 같은 차단 요청을 반복하지 않음 → **NOT RUN 유지**. 호스트 교체·재인코딩 없음.

## M1 미리보기 주소
- project-13871930 파일(README·FILE_MAP·index.html·netlify.toml)에 미리보기 주소 기록 없음. Claude 는 Readdy 계정에 접근하지 못하므로 **주소를 제시하지 않는다(추정 금지)**. 대표가 Readdy 편집기의 Preview(전체화면) 버튼으로 연 주소를 실기기 기록에 적는다.
- 운영 do-it.company 에는 음악 카드가 배포되지 않았다(결제 비활성 ZIP 0fce51a0… 은 음악 미포함). B 히어로 배경 작업과도 별개.

## 실기기 청취 기록 (대표 기입 대기)
```
미리보기 주소: ______   버전(project id): ______
기기·브라우저: ______   일시: ______
A. 홈 BGM 실제 재생 상태에서 DO IT 랜딩 이동 → 홈 음악 겹침: 없음/있음/홈 BGM 재생 못 함(확인 불가)
B. 09 구간 원음 1·2 = 대표 원음: 맞음/다름 · 이어 듣기 1→2 끝까지 재생 후 멈춤: 예/아니오
C. 일시정지→재개 같은 위치: 예/아니오 · 다른 화면 이탈 시 정지: 예/아니오
남/여 대응(실청취 근거 있을 때만): 원음 1=__ 원음 2=__ / 미확정
```
- 홈 BGM 을 실제 재생하지 못했다면 A 는 확인 불가로 적는다. 언마운트 확인만으로 소리 종료 PASS 로 쓰지 않는다.
- 남/여 라벨: 근거 없으면 원음 1/2 유지, 라벨 때문에 코드 재작성 없음.

---

## 상태 고정 (2026-09-13 · "M1 유지·실기기 확인만 남김")
- 원본 음원 대조: 종료. M1·검사 결과: 유지(소스 변경 없음 → 재실행·Readdy 추가 수정 없음).
- 미리보기 주소: 추정하지 않음. 대표가 M1 반영 프로젝트(project-13871930)에서 Preview 를 열어 실제 주소를 기록.
- 확인 위치: 홈 → /start → DO IT 선택 → /do-it/landing → 09 구간 시작하기 버튼 아래 음악 카드. 운영 do-it.company 에는 음악 미배포.
- 원격 파일: 403 → NOT RUN 유지(재요청·호스트 교체·재인코딩 없음). 휴대폰에서 소리가 나도 원격 바이트 동일성으로 확대하지 않음.
- 남은 항목(대표 실기기 결과 수신 후에만 갱신): 실제 열린 미리보기·기기/브라우저 / 원음 1·2 = 대표 원음 여부 / 남녀 대응 / 이어 듣기 종료 / 일시정지·재개 / 랜딩 이탈 시 정지 / 홈 BGM 실제 종료·비중첩. 미실행 항목은 확인 불가.
- 실청취에서 문제가 나온 경우에만 재현 근거 확인 → 해당 부분 최소 수정안.
- Publish 0 · 결제 비활성 ZIP 0fce51a0… 변경 0 · B 배경·날씨·DB·KEY·결제·라우트 변경 0.
