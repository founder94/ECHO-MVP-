# ECHO PASTEL UI · 운영 배포 기록 (2026-09-25)

근거: 대표 「PASTEL CONVERSATION UI · 운영 배포 승인」 — 승인 대상 = 앱 ZIP `42df9c26…` 하나, 대상 사이트 = doitmobile 하나.
이번 승인은 UI 배포만 포함한다. Agent v1.1 서버·Prompt·Model 배포는 포함하지 않는다.

## 1. 배포 전 마지막 대조 (2026-09-25, 이 환경에서 실제 파일로 확인)
| 항목 | 값 |
|---|---|
| 파일명 | `1_APP_여기에올릴것_doitmobile.zip` |
| SHA-256 | `42df9c26535dcdacb11f6881cfc7c04c2254838bbaa155b0c061544a9900c8ab` = 승인 지문과 일치 |
| 크기 | 3,056,327바이트 |
| 파일 수 | 144개(폴더 항목 제외) |
| .env | 0개 |
| 소스맵 | `.map` 파일 0개 · `sourceMappingURL` 0곳 |
| 비밀키 | 0개. `sk-` 0곳 · `service_role` 0곳 · `PRIVATE KEY` 0곳 · `OPENAI_API_KEY` 0곳. `sb_secret_` 1곳이 걸렸지만 키 값이 아니다. supabase 로그인 부품 코드가 키 종류를 앞글자로 가리는 비교문 `startsWith('sb_secret_')` 이다. 뒤에 붙은 글자는 0자다. |

- 새로 빌드하지 않았다. 승인된 파일 그대로다.

## 2. 대상 · 되돌리기
- 대상: Netlify `doitmobile`. 사이트 번호 `ff078012-fe79-4108-a210-201554ab0dea`, 주소 https://app.do-it.company
- **배포 전 운영 배포 번호(되돌릴 곳) = `6ab52bc9ddf4404ca8d43575`**
  - 상태: ready · 수동 drop
  - 게시: 2026-09-24T13:55:51Z = 22:55 KST
  - 기록: "94 new files"
  - 앱 44차로 추정
- 되돌리는 방법(대표):
  1) app.netlify.com/projects/doitmobile 을 연다.
  2) 위 메뉴 「Deploys」를 누른다.
  3) 목록에서 `6ab52bc9…` 줄을 누른다.
  4) 「Publish deploy」를 누른다.

## 3. 배포 시도 결과 — 이 환경에서 올릴 수 없음
- 이 작업 환경의 바깥 인터넷 규칙이 Netlify 연결을 막는다.
  - 막힌 곳: `api.netlify.com` · `doitmobile.netlify.app` · `app.do-it.company`
  - 기록: `$HTTPS_PROXY/__agentproxy/status` → `connect_rejected` · `gateway answered 403 to CONNECT`
  - 확인 시각: 2026-09-24T19:09Z
- Netlify 도구(MCP)는 읽기만 된다. 올리는 기능은 이 막힌 주소로 명령을 돌리는 방식이라 같은 이유로 실패한다(2026-09-22 기록과 같다).
- 그래서 **업로드는 대표 수동**이다. 승인된 ZIP 을 그대로 대표에게 전달했다.

## 4. 배포 후 확인 (대표 업로드 뒤에 채운다)
| 항목 | 결과 |
|---|---|
| 새 배포가 doitmobile 에 올라갔는지 | 대기 |
| 운영 주소가 새 배포를 가리키는지 | 대기 |
| 첫 화면·히어로 동일 | 확인 불가. 이 환경에서 앱 주소 403 |
| 대화 파스텔 배경 · 흰 글씨 · 입력/버튼/스크롤 · 콘솔 오류 | 확인 불가. 앱 주소 403 → 대표 실기기 |
| Galaxy / iPhone | 미실행 |

- 배포를 올려도 표준 대비(WCAG) 4.5:1 미달이라는 측정 사실은 그대로다.
  - 근거: `PATCH-20260925-text-legibility-stop` 보고서
  - 실기기에서 읽기 어려우면 FAIL 로 보고한다. 임의로 고치거나 다시 배포하지 않는다.
- **Conversation P0 = FAIL 유지.** Agent v1.1 실제 OpenAI 검증 전이다.
- 변경 0건: doit-understanding · Prompt · Model · DB/RLS/Auth/Secret · 결제 · KEY · 홈페이지

## 5. 배포 후 기록 (대표 업로드 뒤에 채운다)
