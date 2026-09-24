# Conversation P0 v15.1 운영 배포 기록 (2026-09-24)

근거: 대표 승인 「Conversation P0 v15.1 · 대표 승인 운영배포 + LEVEL 3 최종검증 실행명령 · FINAL EXECUTION LOCK」.
승인 범위: ① doit-understanding v15.1 ② doit-connect v15.1 ③ 앱 42차 ④ 운영 검증 준비 ⑤ 배포 뒤 대표 실기기 LEVEL 3.

기존 운영 버전은 대표가 실기기로 써 봤고, 그때 나온 실패 데이터도 있다.
v15.1 수정본으로 하는 LEVEL 3 운영 실기기 검증은 아직 하지 않았다.

## 1. 배포 전 확인(읽기 전용) — STOP 조건 0건

| 확인 | 결과 |
|---|---|
| 운영 버전 다시 읽기 | doit-understanding **24**, doit-connect **3** (배포 직전 재확인) |
| 올릴 파일 지문 | doit-understanding `b3384b7969f997f1f5bddaa5f1baf612351c44f0b3fa704b16ae7a3637c7349c` (181,961바이트) · doit-connect `9c2bac1448a90cde818ef898590c858c823974af074b8af7e5db616264c48124` (51,803바이트) — 저장소 `product/` 사본과 동일 |
| 앱 42차 ZIP 지문 | `a1e529ffa97aa97e410f93296ea64fad5f029e652e685cc69e69d2887d413f73` · 3,055,591바이트 · 149개 파일 = `ZIP42_SHA256.txt` 와 같다 |
| 후보 안의 .env·키·소스맵 | 0 |
| DB·RLS·마이그레이션·Auth·Secret·모델·결제·가격 변경 필요 | 없음 (새 표·칸 0, OpenAI 설정은 운영 것 그대로) |
| 되돌리기 수단 | 아래 3절 — 파일로 확보하고 지문까지 맞췄다 |

## 2. DEPLOY ORDER

1. **doit-understanding v15.1** (운영 24 → 25)
2. **doit-connect v15.1** (운영 3 → 4 → 5, 아래 "내 실수" 참고)
3. **앱 42차 ZIP** (Netlify `doitmobile` 기존 사이트에만)

이 순서로 한 이유: 새 서버는 지금 운영에 있는 옛 앱(37·41차)의 요청도 그대로 받는다(하위 호환). 반대로 새 앱이 옛 서버를 만나면 새 분류·카드·거절 저장 요청을 옛 서버가 모른다. 그래서 서버를 먼저 올리고, 앱은 그 뒤에 올린다.

## 3. 되돌리기 세트

| 대상 | 되돌릴 판 | 지문 | 위치 |
|---|---|---|---|
| doit-understanding | 운영 버전 24 (v14.4) | `bc3b780b…a8a2` | `rollback/doit-understanding.v24.ts` |
| doit-connect | 운영 버전 3 (v1.2) | `e9246182…0ae0f3` | `rollback/doit-connect.v3.ts` |
| 앱 | Netlify 배포 `6ab46ba03a6339c62d449d00` (ready) | — | Netlify 배포 목록에서 「Publish deploy」 |

되돌리는 방법: 서버는 위 파일을 같은 이름으로 다시 배포(verify_jwt=true), 앱은 옛 배포를 다시 게시한다. DB 변경이 없으므로 데이터 되돌리기는 필요 없다.

## 4. 결과 — 실제 운영 버전을 다시 읽어 확인함

| 함수 | 결과 | 버전 | verify_jwt | 운영에서 내려받은 index.ts SHA-256 | 로컬과 같은가 |
|---|---|---|---|---|---|
| doit-understanding | **DEPLOYED** | 25 | true | `b3384b7969f997f1f5bddaa5f1baf612351c44f0b3fa704b16ae7a3637c7349c` | 글자 단위 동일(cmp) |
| doit-connect | **DEPLOYED** | 5 | true | `9c2bac1448a90cde818ef898590c858c823974af074b8af7e5db616264c48124` | 글자 단위 동일(cmp) |

- 로그인 없는 요청: 두 함수 모두 401(2회씩), 가짜 토큰도 401.
- 코드가 실제로 뜨는지: 공개 anon 키로 요청해 봤다. 게이트웨이를 지나 **새 코드가 직접** `{"ok":false,"code":"UNAUTHORIZED"}` 로 답했다. 부팅 오류는 없었다.
- 다른 함수 8개는 버전과 수정 시각이 그대로다: get-step-question 48 · echo-journey 26 · echo-payment 2 · openai-chat 2 · admin-conversations 2 · admin-dashboard 1 · doit-photo-check 1 · doit-account 1.
- 배포 뒤 함수 기록(09:20~09:40Z): 요청은 내 확인 요청(401)뿐이다. 실제 사용자 요청은 0건, 오류도 0건이다.

**내 실수**
- doit-connect 버전 4에서 빈 줄 하나(540번째 줄)를 빠뜨리고 올렸다. 동작은 같았다.
- 올린 파일을 내려받아 대조하다가 찾았다(지문 `23cd46a9…` ≠ `9c2bac14…`).
- 곧바로 정확한 파일로 버전 5를 올렸고, 글자 단위로 같은지 확인했다.
- 버전 4는 약 6분 동안 운영에 있었다(09:28~09:34Z).

## 5. 앱 42차

- 이 작업 환경에서는 바깥 인터넷 규칙이 `api.netlify.com`·`doitmobile.netlify.app`·`app.do-it.company` 를 막는다(connect_rejected). 그래서 내가 직접 올리지 못했다.
- 빌드는 손대지 않았다. ZIP 1개를 대표에게 전달했다: `1_APP_여기에올릴것_doitmobile.zip`, SHA-256 `a1e529ff…`.
- 대표가 수동으로 올린다. 대상은 기존 사이트 `doitmobile` 하나뿐이다. 새 사이트는 만들지 않는다.

## 6. 스모크·LEVEL 2·LEVEL 3 현황

| 항목 | 상태 |
|---|---|
| 서버 스모크(부팅·인증 거절·버전·지문) | PASS (실제 운영 서버 기준) |
| 로그인 뒤 스모크(앱 열림·로그인·대화 진입·첫 질문·답 저장·다음 질문·무한 로딩 없음) | **확인 불가** — 이 환경에서는 앱 접속이 막혀 있다. 검사 계정 비밀번호도 받지 않는다. 대표가 실기기로 확인한다 |
| LEVEL 2(실제 OpenAI) | 새 키는 만들지 않는다. 대표 LEVEL 3 대화에서 운영 서버가 부른 실제 OpenAI 호출을 증거로 쓴다. 아직 0회 |
| LEVEL 3(대표 실기기 A~G) | **아직 하지 않음.** 검사표는 `LEVEL3_실기기_검사표_v15.1.md` |

## 7. 앱 42차 반영 확인 (2026-09-24 18:45 KST 무렵, 읽기 전용)
- ZIP 재확인: `1_APP_여기에올릴것_doitmobile.zip` SHA-256 `a1e529ffa97aa97e410f93296ea64fad5f029e652e685cc69e69d2887d413f73` · 3,055,591바이트 · 149개 파일 = `ZIP42_SHA256.txt` 확정값과 같다 → **[APP42 DEPLOY CANDIDATE = 일치]**.
- Netlify 기록: `doitmobile` 현재 배포 = `6ab4f006cbad731637fc32b8`. 방식은 수동 drop, 상태는 ready. 게시 시각은 2026-09-24T09:40:33Z(18:40 KST)로, ZIP을 전달한 09:36Z 뒤다. 기록에는 "98 new files uploaded"가 남았고, 이 배포가 이전 배포 `6ab46ba0…`를 교체했다.
- 이 환경에서는 `app.do-it.company` 와 netlify.app 접속이 막혀 있어 올라간 파일 내용을 글자 단위로 대조하지 못했다. 그래서 42차라는 판단은 **Netlify 기록과 시각으로 한 추정**이다.
- 이후 새 개발은 하지 않는다. 대표 LEVEL 3(A~J)를 기다린다. 실패가 나오면 실패 원문 → 직전 질문/답 → 기대 → 실제 → 서버 상태 → 원인 파일/함수 → 최소 수정 → 같은 실패 재검사 순서로만 처리한다.
