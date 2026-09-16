# Codex 인계 — 최종본 배포 지시 (2026-09-17, 대표 승인 완료)

이 문서 하나만 보고 실행하면 된다. 추정으로 "완료"라고 쓰지 않는다. 실행한 것만 보고한다.

## 0. 넘기는 파일
| 파일 | 용도 | SHA-256 |
|---|---|---|
| `ECHO_CLAUDE_NETLIFY_DRAG_20260917.zip` | **Netlify 드래그 배포용 정적 빌드**(102파일: `index.html`, `_redirects`, `_headers`, `favicon.svg`, `assets/`) | `308e8e5392f47bc475dd196557bfdab6ffde285e7ca91993b29c303ea4c9c4d8` |
| `ECHO_CLAUDE_TRUST_FIRST_*.zip` | 검수용(서버 코드 원문·diff·검사·증거). 배포 대상 아님 | 최종 보고의 값 |

배포 전에 ZIP 의 SHA-256 을 다시 계산해 위 값과 같은지 확인한다. 다르면 배포하지 않는다.

## 1. 서버(Supabase) — Claude 가 대표 승인으로 처리 완료
| 함수 | 버전 | 내용 |
|---|---|---|
| echo-journey | v12 → **v13** | 되물음은 단계를 진행하지 않음, 고정 회피 문장 금지·답변 품질 검사, 거절 해석 답변 차단, 확인된 기억 사용, 리포트 이후 대화, 시도 예산 11초, 토큰 사용량 로그 |
| get-step-question | v21 → **v22** | 같은 규칙 + 이해 확인 4버튼 결과를 `doit_insights` 에 기억으로 저장 |
| echo-payment / admin-* / openai-chat / doit-understanding | 변경 없음 | — |
| DB 스키마 / RLS / 마이그레이션 / 시크릿 / Toss | **변경 없음** | 4,900원 단건, PAYMENT_GATE 그대로 |

프론트와 서버의 응답 계약은 그대로다(필드 추가만). 배포 순서는 서버 앞뒤 어느 쪽이어도 안전하다.

## 2. Netlify 배포 순서
1. 사이트 `echo-mvp-doit`(ID `7a4934db-aff3-437d-815a-ffbf49d4b819`) > Deploys > "Drag and drop" 에 `ECHO_CLAUDE_NETLIFY_DRAG_20260917.zip` 을 올린다. **정적 빌드 ZIP** 이므로 Netlify 가 다시 빌드하게 두지 않는다.
2. 상태가 `ready` 가 되면 배포 ID 를 기록한다.
3. https://do-it.company 를 새로고침해 `index.html` 이 `assets/index-PTm_2znC.js` 를 부르는지 확인한다.
4. 실제 브라우저에서 확인한다.
   - 홈: 갤럭시 Chrome 에서 초록 배경이 중간에서 직각으로 끊기지 않는다.
   - `/payment?c=…`: "결제 준비 중" 비활성 버튼 + 안내 문구. 결제창이 열리면 실패다.
   - `/step/7`: 답변 저장 뒤에만 White Door 로 이동한다.
   - 아이폰 Safari: 입력칸을 눌러도 화면이 확대되지 않는다.
   - 리포트 화면(구매자 계정): 맨 아래 "리포트를 보고 더 이야기하기" 버튼이 보인다. 미구매 계정에서는 리포트 화면 자체가 열리지 않아야 한다.
5. 문제가 보이면 직전 배포 `6aaa6f4662ecb9daa734d6da` 를 "Publish deploy" 로 되돌리고 화면 사진과 배포 ID 를 Claude 에게 전달한다.

## 3. 배포 뒤 보고 형식(그대로 채워서)
```
[Netlify 배포 보고]
ZIP SHA-256 재계산: (값) / 문서값과 일치: 예·아니오
배포 ID: (값) / 상태: (ready 등) / 시각(KST):
운영 index.html 이 부르는 JS: assets/index-________.js
갤럭시 홈 배경 직각 잘림: 있음·없음 / 헤더 겹침: 있음·없음
결제 화면: 결제 준비 중(비활성) 확인: 예·아니오 / 결제창 열림: 예·아니오
아이폰 입력칸 확대: 있음·없음
리포트 화면 "더 이야기하기" 버튼: 보임·안 보임
되돌림 실행 여부: 예·아니오 (이유)
```

## 4. 하지 말 것
- `.env`·키·토큰을 ZIP·보고서에 넣지 않는다. Toss 결제 설정·`PAYMENT_GATE`·가격(4,900원)을 바꾸지 않는다.
- Supabase 함수·DB·RLS 를 건드리지 않는다(서버는 Claude 가 승인 범위만 처리했다).
- 홈 히어로 문구·디자인 자산을 바꾸지 않는다.
- 실기기 확인 전에 "운영 확인 완료"라고 쓰지 않는다.
