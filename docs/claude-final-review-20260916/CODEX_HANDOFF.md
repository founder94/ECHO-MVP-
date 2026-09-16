# Codex(ChatGPT) 인계 — Netlify 배포·검수 (2026-09-16, 대표 승인)

이 문서는 대표가 "채치 PT(Codex)가 Netlify 에 올린다"고 정한 뒤 Claude 가 넘기는 실행 지시다. 아래 순서대로 하고, 각 단계의 결과(배포 ID·상태·확인 시각)를 그대로 보고한다. 추정으로 "완료"라고 쓰지 않는다.

## 0. 넘기는 파일
| 파일 | 용도 | SHA-256 |
|---|---|---|
| `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip` | Netlify 드래그 배포용 정적 빌드(100 파일: `index.html`, `_redirects`, `_headers`, `favicon.svg`, `assets/`) | `b89f9c19d40e35e9b4aea91fd952052c57cfe43e2dbf4d6467d2c8e8e695c63f` |
| `ECHO_CLAUDE_FINAL_REVIEW_IMPLEMENTATION_20260916.zip` | 검수용: PATCH 35파일(프로젝트 상대경로), server.diff, frontend.diff, 구조 의견, 매니페스트(전후 해시), 검사 보고, 배포 계획, 증거 | 최종 보고의 값 |

배포 전에 반드시 ZIP 의 SHA-256 을 다시 계산해 위 값과 같은지 확인한다. 다르면 배포하지 않는다.

## 1. 서버(Supabase) 상태 — Claude 가 대표 승인으로 처리
| 함수 | 이전 | 지금 | 비고 |
|---|---|---|---|
| echo-journey | v10 | **v11 배포됨** (2026-09-16 UTC 13:xx) | 후보 질문 끝 장식 정리, `[ej]` 진단 로그, 리포트 confirmed 서버 판정(anchor 대조) |
| get-step-question | v19 | v20 배포 결과는 Claude 최종 보고의 값으로 확인 | 질문 검증 규칙(tidy·soften) + 형태 로그 |
| echo-payment / admin-dashboard / admin-conversations / openai-chat / doit-understanding | 변경 없음 | 변경 없음 | — |
| DB / RLS / 마이그레이션 / 시크릿 | 변경 없음 | 변경 없음 | — |

프론트와 서버의 응답 계약(상태값·필드)은 바뀌지 않았으므로 Netlify 배포 순서는 서버 앞뒤 어느 쪽이어도 안전하다.

## 2. Netlify 배포 순서
1. 사이트 `echo-mvp-doit`(ID `7a4934db-aff3-437d-815a-ffbf49d4b819`) > Deploys > "Drag and drop" 에 `ECHO_CLAUDE_NETLIFY_DRAG_20260916.zip` 을 올린다. 원본(소스) 업로드가 아니라 **정적 빌드 ZIP** 이다. Netlify 가 다시 빌드하게 두지 않는다.
2. 배포 상태가 `ready` 가 되면 배포 ID 를 기록한다.
3. https://do-it.company 를 새로고침해 `index.html` 이 `assets/index-CqAhazqn.js` 를 불러오는지 확인한다(이전 운영본은 `index-fz8cj8NF.js`).
4. 다음을 실제 브라우저에서 확인한다.
   - 홈: 갤럭시 Chrome 에서 초록 배경이 화면 중간에서 직각으로 끊기지 않는다. 스크롤을 내리면 헤더에 어두운 배경이 생긴다.
   - `/payment?c=…`(로그인·STEP 7 완료 대화): "결제 준비 중" 버튼이 비활성이고 "현재 결제 서비스를 준비하고 있어요" 문구가 보인다. 결제창이 열리면 실패다.
   - `/step/7`: 답변 저장 뒤에만 White Door 로 이동한다.
   - 아이폰 Safari: 입력칸을 눌러도 화면이 확대되지 않는다.
5. 문제가 보이면 직전 배포 `6aaa6f4662ecb9daa734d6da` 를 "Publish deploy" 로 되돌리고 Claude 에게 화면 사진과 배포 ID 를 전달한다.

## 3. 배포 뒤 보고 형식(그대로 채워서)
```
[Netlify 배포 보고]
ZIP SHA-256 재계산: (값) / 문서값과 일치: 예·아니오
배포 ID: (값) / 상태: (ready 등) / 시각(KST):
운영 index.html 이 부르는 JS: assets/index-________.js
갤럭시 홈 배경 직각 잘림: 있음·없음 / 헤더 겹침: 있음·없음
결제 화면: 결제 준비 중(비활성) 확인: 예·아니오 / 결제창 열림: 예·아니오
아이폰 입력칸 확대: 있음·없음
되돌림 실행 여부: 예·아니오 (이유)
```

## 4. 하지 말 것
- `.env`·키·토큰을 ZIP 이나 보고서에 넣지 않는다. Toss 결제 설정·`PAYMENT_GATE` 를 바꾸지 않는다.
- Supabase 함수·DB·RLS 를 건드리지 않는다(이미 Claude 가 승인 범위만 처리).
- 홈 히어로 문구·디자인 자산을 바꾸지 않는다.
- 실기기 확인 전 "운영 확인 완료"라고 쓰지 않는다.
