# 실제 사용자 피드백 반영 + 두 사이트 최종 ZIP (2026-09-25)

근거:
- 대표 「ECHO · ACTUAL USER FEEDBACK PATCH」
- 대표 「FINAL TWO-SITE DELIVERY LOCK」

## 대화 서버 — 운영 doit-agent 버전 4 = echo-agent-v1.4

- **원본 파일**: agent.ts `db292310…`, index.ts `5699f042…`. 운영에서 내려받은 파일이 로컬과 글자 단위로 같다.
- **보안 확인**: 무인증 · 가짜 토큰 · 공개 키 요청이 모두 401 이다.
- **run 11**(v1.4, gpt-4o-mini): 사전 규칙을 충족했다.
  - 치명 지표 0
  - help 분류 5/6
  - 추상 낱말 질문 비율 16/64(25%) — run 10 의 12/42(29%)보다 낮다
- **run 12**(v1.5): 추상 낱말 질문 4/63 으로 크게 좋아졌다.
  - 그러나 `same_question_again` 7 이 사전 규칙(<6)을 넘었다.
  - 사전 규칙대로 v1.4 를 배포했다. v1.5 는 `product/spike/agent-v1-20260925/candidate-v1.5/` 에 후보로 두었다(대표 결정).
- **내 실수**: 이 지표가 설계상 한 번 다시 보이기(먼저 답하기·help)도 세도록 규칙을 만들었다.
- **되돌리기**: 버전 3 파일은 커밋 198d91a 에 있다(agent.ts `898c2936…` · index.ts `331316e4…`).

## 두 ZIP

| 파일 | 올릴 곳(실측) | 크기 · 파일 수 | SHA-256 |
|---|---|---|---|
| 1_APP_여기에올릴것_doitmobile.zip | Netlify `doitmobile` · id `ff078012-fe79-4108-a210-201554ab0dea` · https://app.do-it.company · 지금 배포 `6ab64ad1…` | 3,987,485 B · 152 | `214efe1cd89eb2333f529bfaa15feea40bb8eb00f3cdb0d415a653fa7c52d84d` |
| 2_BRAND_여기에올릴것_do-it-company.zip | Netlify `echo-mvp-doit` · id `7a4934db-aff3-437d-815a-ffbf49d4b819` · https://do-it.company · 지금 배포 `6ab43fd0…` | 3,882,554 B · 109 | `4d8c35515d1746842e94ceedefa94321e779dd9972c4f16f9051cc141f2633e7` |

- 두 ZIP 모두 풀면 빌드 폴더와 같다. 소스맵 0 · .env 0 · 키 모양 0.
- BRAND 에서 운영과 달라지는 것:
  - 히어로 문구: 운영 「사람은 프로필보다…/지금 시작하기」(09-21) → 대표 최종 승인 09-24 「좋아하는 사람보다…/ECHO 시작하기」
  - 시작하는 법: 「나는 말하고, 찾는 건 ECHO가 해요」 · 3단계 · 「ECHO 시작하기」
  - 주소: 전체 주소(https://app.do-it.company)로 표기
- BRAND 에서 그대로인 것: 지구 그림 · 심볼 · 글꼴 · 크기 · 색 · 버튼 모양 · 링크(360·390·430·1440 실측, 가로 넘침 0, 오류 0).
