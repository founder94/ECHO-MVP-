# 운영 첫 화면에서 마음 날씨 제거 (2026-09-20)

## 실제 원인
`src/router/config.tsx`의 `/` 경로가 B 구조 홈(`@/pages/home/page`)에 직접 연결돼 있었고,
그 홈만 지연 불러오기가 아닌 **정적 import**였다. 따라서 첫 화면 번들(index-*.js)에 홈 전체가 들어갔고,
`/`로 들어온 모든 사용자에게 Navbar(ECHO·경험·기록), HeroSection('진짜 나를 찾아줘' + 날씨 선택),
IdentitySection·FounderMessageSection('내 마음을 알면, 내가 보인다', '오늘 내 마음의 날씨')가 그대로 렌더링됐다.

두 번째 경로: `src/lib/auth/returnPath.ts`의 `defaultReturnPath()`가 `entryPathForMode(getAppMode())`를 반환했다.
브라우저 localStorage에 `echo:app-mode = 'echo'`가 남아 있으면 로그인 직후 `/weather`로 끌려갔다.

## 이전 "도달 불가" 판정이 틀린 이유
그때 확인한 것은 `/weather`로 **보내는 링크**가 메인 흐름에 없다는 점뿐이었다.
`/` 자체가 무엇을 렌더링하는지, 빌드 산출물의 첫 화면 번들에 무엇이 들어 있는지는 확인하지 않았다.
정적 코드 읽기만으로 판정했고 실제 렌더 결과를 보지 않았다. 판정 근거가 부족했다.

## 실제 수정 파일 (3개, 화면 파일 삭제 0)
| 파일 | 변경 |
| --- | --- |
| `src/lib/echo/appMode.ts` | `MAIN_ENTRY_PATH = '/do-it/landing'` 추가 |
| `src/router/config.tsx` | `/` → `<Navigate to={MAIN_ENTRY_PATH} replace />` · 예전 홈은 지연 불러오기로 바꿔 `/home`에 보존 |
| `src/lib/auth/returnPath.ts` | `defaultReturnPath()` → `MAIN_ENTRY_PATH` 고정 |

## 실제 렌더 검증 (LIVE/serve.mjs + LIVE/check-entry.mjs, Chromium 헤드리스)
빌드 산출물 `out`을 Netlify와 같은 방식(`_redirects: /* → /index.html 200`)으로 띄우고 그려진 DOM 텍스트로 판정했다.

| 검사 | 결과 |
| --- | --- |
| `/` 첫 화면에 "오늘 내 마음의 날씨는 어때?" | 0건 PASS |
| `/` 첫 화면에 "내 마음을 알면, 내가 보인다" | 0건 PASS |
| `/` 첫 화면 상단에 예전 홈 내비(경험·기록) | 0건 PASS |
| `/` 첫 화면이 Plan A 랜딩 01 구간 | PASS |
| `/auth/callback`이 마음 날씨 화면을 그리지 않음 | PASS |
| 예전 홈이 `/home`에 보존됨(삭제 아님) | PASS |

`/` 렌더 결과 앞부분: `01 — 당신의 하루 / 오늘의 발자국이 내일의 연결로 이어집니다.`

## 빌드 환경 사고 (기록)
지시대로 `npm ci`를 실행했으나 이 작업본의 `package-lock.json`은 모든 패키지를
`"resolved": "../../implementation/project/node_modules/…", "link": true`로 기록하고 있었고,
그 경로는 존재하지 않는다. `npm ci`가 기존 `node_modules`를 지우고 깨진 링크만 만들어 빌드 도구가 사라졌다.
저장소 체크아웃(`/home/user/ECHO-MVP-/node_modules`)의 실제 모듈을 복사하고 부족한 `motion@12.41.0`만
따로 받아 복구했다. 제품 소스는 손대지 않았다. lock 파일 오염은 별도 정리 대상이다.

## 남은 사실
- `<title>`은 `ECHO | 진짜 나를 찾아줘`로 유지했다(브랜드 문장, 본문 아님).
- `appMode` 청크에 `ECHO_BRAND_SENTENCE = '오늘 내 마음의 날씨는 어때?'` 문자열이 남아 있다.
  `/doit/settings`에서 'both' 모드 사용자에게만 보이는 링크 문구이며 `/` 첫 화면에는 렌더되지 않는다.
- Google 로그인 왕복(실제 세션 복귀)은 이 환경에서 실행할 수 없어 **확인 불가**. 코드상 기본 복귀지는 `/do-it/landing`이다.

## 삭제 후보 (삭제하지 않음, 보고만)
`src/pages/home/**` 전체(B 홈 섹션 18개 + Navbar). 현재 `/home`에서만 열리고 메인 흐름에서 참조되지 않는다.
