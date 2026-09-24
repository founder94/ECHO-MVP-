# v15.2 운영 배포 기록 (2026-09-24 20:28 KST 무렵)

근거: 대표 승인 「ECHO 전략본부 · v15.2 배포 승인」.
승인 범위:
① doit-understanding v15.2 운영 배포
② 배포 뒤 운영 파일 내려받아 대조
③ 대조가 일치할 때만 서버 배포 PASS
④ 앱 43차 ZIP 전달 준비
⑤ 앱은 서버 검증 뒤 진행

이번에 바꾸지 않은 것: DB · Migration · RLS · Auth · Secret · OpenAI 모델 · 결제 · 가격 · KEY · 운영 데이터.

## 1. 배포 전 확인
- 운영 버전: doit-understanding **25** (v15.1). 배포 직전에 다시 읽어 확인했다.
- 올릴 파일: `product/supabase/functions/doit-understanding/index.ts`
  - SHA-256 `fd2e1eee80ccf5648822245a074b935a6566ce831fd2c4933a163172cd3ffedd`, 186,093바이트
  - 검사 작업 폴더의 파일과 같다.

## 2. 올린 방법
- Supabase 관리 API(`functions/deploy`)에 로컬 파일을 **그대로** 올렸다.
- 전에는 MCP로 파일 내용을 옮겨 적어 올렸다. 그때 옮겨 적기 실수가 두 번 있었다(doit-understanding 버전 21, doit-connect 버전 4). 이번에는 옮겨 적기를 없앴다.
- 로그인 확인 설정(verify_jwt): true 그대로.

## 3. 결과 (실제 운영 서버 기준)
| 항목 | 결과 |
|---|---|
| 버전 | **26** / ACTIVE / verify_jwt=true / 수정 시각 2026-09-24T11:28:25Z |
| 운영에서 내려받은 index.ts | SHA-256 `fd2e1eee80ccf5648822245a074b935a6566ce831fd2c4933a163172cd3ffedd` · 186,093바이트 · 로컬 파일과 글자 단위 동일(`cmp`) |
| 로그인 없는 요청 | 401 (2회) |
| 가짜 토큰 | 401 |
| 공개 anon 키 요청 | 새 코드가 직접 `{"ok":false,"code":"UNAUTHORIZED"}` 로 답함 |
| 함수 기록 | `booted (time: 23ms)`, 오류 0건 (11:25~11:40Z) |
| 다른 함수 9개 | 버전·수정 시각 모두 그대로: get-step-question 48 · echo-payment 2 · echo-journey 26 · openai-chat 2 · admin-conversations 2 · admin-dashboard 1 · doit-photo-check 1 · doit-connect 5 · doit-account 1 |

→ **서버 배포 PASS**: 파일 대조가 일치하고 서버가 정상으로 떴다. 이것은 대화 품질 PASS가 아니다.

## 4. 되돌리기
- 서버: `rollback/doit-understanding.v25.ts` (SHA-256 `b3384b79…c7349c`, 운영 버전 25 원본)를 같은 이름으로 다시 배포한다(verify_jwt=true).
- 앱: Netlify `doitmobile` 배포 `6ab4f006cbad731637fc32b8`(42차)를 다시 게시한다.
- DB 변경이 없으므로 데이터는 되돌릴 필요가 없다.

## 5. 앱 43차 ZIP
- 파일: `1_APP_여기에올릴것_doitmobile.zip`
  - SHA-256 `c1e666d5525f7fb274af1d0a19a981c165a919bd347d75ba210035a2618c9043`, 3,055,593바이트, 149개 파일
  - `ZIP43_SHA256.txt` 와 같다.
- 압축을 풀어 빌드 폴더와 비교했다. 차이 0, 소스맵·.env·비밀키 모양 문자열 0.
- 이 작업 환경에서는 Netlify가 막혀 있다. 그래서 대표가 직접 올린다. 대상은 기존 사이트 `doitmobile` 하나뿐이다.

## 6. 실AI 검증 (대표 실제 실패 원문 재검사)
- 이 작업 환경에서는 운영 대화를 직접 돌릴 수 없다. 이유는 셋이다.
  - OpenAI 키가 없고, 새로 만들거나 Secret을 바꾸는 것은 금지다.
  - 검사 계정 비밀번호는 받지 않는다.
  - 로그인 우회는 금지다.
- 그래서 ①~⑦은 **확인 불가**다. 대표가 실기기로 다시 입력한 뒤, 운영 기록(읽기 전용)과 대표 화면 캡처로 판정한다.
- 판정 기준:
  - HTTP 200만으로 PASS 하지 않는다. 질문 품질이 이상하면 Conversation 품질 = FAIL.
  - 운영 기록에 `step:"bridge_fallback"` 이 찍힌 경우, 그 질문이 방금 답과 이어지는지 따로 본다.
- Conversation P0 = **FAIL 유지**. 대표 LEVEL 3 통과 전에는 PASS 후보로 올리지 않는다.
