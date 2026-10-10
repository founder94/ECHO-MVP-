# 기억 회수 1단계 구현과 검증 기록

## 실제 범위와 담당

최신 대표 직접 요청에 따라 Claude 토큰 부족 상태에서 Codex가 구현을 맡았다. 실제 Manus 인증/작업은 하지 않았으며 Manus와 회의를 했다고 기록하지 않는다. 기존 PR149 작업 가지를 사용하고 다른 제품/자동화 담당 파일을 동시에 수정하지 않는다.

대표는 2026-10-08 이 수정 코드와 가상 검사 자료의 공개 업로드 확인 요청에 직접 「승인」했다. 이번 공개 반영의 부모는 실제 회수한 PR149 HEAD `fd21d69ff32e3984bba39e2d686e7b326beb5425`이며, 기존 Manus 연결 준비 파일을 그대로 보존한다. 승인은 준비된 코드와 합성 검사 자료 공개에 한정된다. 배포·병합·실제 Manus 인증/유료 작업·라이브 workflow 활성화·DB/Secret 변경 승인으로 확대하지 않는다.

최초 tree에 최신 QA의 부가 문서·그림·배포 요청·SQL 초안까지 포함되자 자동 승인 검토가 범위를 거절했다. 이를 실행하거나 다른 경로로 올리지 않았다. 최종 공개 범위는 기억 수정/합성 검사 15파일과, 이미 공개된 정확한 QA 커밋의 기존 런타임/관련 검사 14파일이다. 부가 문서·그림·실서버 검사 스크립트·배포 요청·SQL 초안 19파일은 제외한다. 기존 QA 파일은 이미 공개된 Git blob SHA를 그대로 사용한다. 공개 범위를 줄여도 검사한 product/src 및 supabase/functions 런타임 바이트는 그대로이며, 라이브 workflow·DB 실행·배포 요청 변경은 없다.

QA 기준은 `04d0086d901d86fe6aab4953c12fede2857f9828`, 기존 PR149는 `f6bae5a596335fd2526d2955ef78f9ba1520a0d5`였다. PR149는 QA와 갈라져 11개 파일의 합치기 충돌이 있었다. 최신 QA 서버·라우트·UI를 기준으로 해결하고 이 변경을 붙였다. 기존 PR149에만 있던 초안·이미지·unused pages·memory.ts·옛 API 검사 파일은 보존했다. 이 보존 파일들의 옛 agent_memory/agent_free API는 현재 QA 서버에서 활성화하지 않았다. 프런트 호환 함수를 현재 agent_get/agent_forget/free_talk에 연결했지만 기존 route를 켜지 않았다.

기존 PR 설명의 1428 검사 수와 실제 모델 비용은 과거 구현에 대한 owner 보고이다. 이번 HEAD 전체 검사·실제 모델·배포 증거로 쓰지 않는다. 최신 전체 SHA는 PR149의 이번 인계 댓글과 파일 manifest로 전달한다.

## 결론

기존 JSON 상태·원문·확정 정보 구조를 살려 **저장된 자기 대화의 원문을 직접 찾는 경로**를 구현했다. 숫자·처음 기록·정정 후 기록을 요약에만 의존하지 않고 출처와 함께 반환한다. 읽기 질문을 선호 사실로 저장하거나 Matching으로 승격하지 않는다.

이는 배포 완료나 모든 대화를 영구히 기억한다는 보장이 아니다. 일반 대화의 자동 기억 재료는 현재 세션에 한정되고, 다른 회차 기록은 사용자가 요청한 read-only history 경로로 찾는다. 자유 대화 신규 원문 보관, 전체 세션 간 정정/삭제 전파, 실제 DB/모델/실기기 검증은 남아 있다.

## 경로

인증된 사용자 → 기존 doit_request_events의 applied agent_session → 원문·정정·유효성/turn/revision/출처 구분 → server canonical 답 → 기존 UI 알림 및 원문 검색. 새 테이블·RLS·RPC·Migration·보관 기간·모델·가격 변경은 없다.

`history-retrieval.ts`는 own user 필터와 적용 상태를 다시 확인한다. 최대 50개 세션 페이지, 한 번에 6개/6000자 원문을 내며 다음 페이지를 표시한다. 전체를 읽지 않았으면 PARTIAL이고 NOT_FOUND/완전 기억으로 처리하지 않는다. 검색은 한글 조사 보정이 있는 낱말 검색이다. 의미가 비슷한 모든 표현을 찾는 semantic 검색이 아니다.

`agent_recall`은 모델 없는 읽기 action이다. 명시적 기억 질문은 기존 agent_turn에서 같은 경로로 전달한다. 일반 turn에는 관련된 현재 세션 원문만 기존 모델 입력에 붙이며 빈 검색 결과는 토큰/재시도 조건을 바꾸지 않는다. 새로운 AI 호출·제공사는 없다.

forgotten/superseded 원문을 최근 모델 재료에서 제외하고, 지울 때 summary/closing/intro/last_receipt 등 파생 초안을 무효화한다. 자유 대화의 기억 주장에는 정확한 현재 출처·원문을 요구하며, 유효한 원문 뒤에 붙인 가짜 숫자도 server canonical 인용으로 제거한다. 이 guard는 알려진 표현·정확한 거절 문구 검사이며 모든 의미 바꿔 말하기를 차단하는 보장이 아니다.

## 항목별 판정

| 기대 기능 | 이번 실제 구현/검사 | 판정과 한계 |
|---|---|---|
| 오래된 금액과 출처 찾기 | 최근 10개 밖의 500억 원을 원문 turn에서 회수; 다른 프로세스 재시작 후 같은 파일 자료 읽기 | source/mock PASS. 실제 DB/수개월 운영 미검증 |
| 최초 500억 / 현재 5,000억 구분 | 가상 정정 자료에서 HISTORICAL_ONLY와 CURRENT_CONFIRMED 분리 | 해당 현재 세션 PASS. 전 세션 자동 정정 전파 미검증 |
| 거절 재등장 방지 | 거절 AI 해석을 원문 사실로 회수하지 않음; 자유 대화 인용에 거절된 복사본 차단 | 실행한 exact 의미 PASS. semantic 전체 보장 아님 |
| 기록 없음 | NOT_FOUND·근거 없음·provider 0 | source/mock PASS |
| 다른 사용자 분리 | own-user 조회·외국 사용자 없음·DB 읽기 오류에 기존 상태 보존 | source/mock PASS. 실제 RLS/운영 검사 아님 |
| 삭제 | 기존 잊기 표시에 따른 회수 제외·파생 초안 무효화 | 논리적 제외 PASS. 원문/백업 전체 물리 삭제 미검증·이번 실행 0 |
| 숫자/날짜/이름을 요약에서 복원 | 저장된 원문을 검색하는 경로 추가 | 단어가 일치해야 함. 저장하지 않았거나 보관 정책상 없는 기록 복원 불가 |
| 많은 기록 | 세션 및 match 페이지·PARTIAL/READ_FAILED | source/mock PASS. 대규모 실측 미검증 |
| 세션 재시작 | 별도 프로세스·가상 파일 저장소에서 HTTP-shaped 회수 | PASS는 모의 범위. 실제 재로그인·기기간 검증 미실행 |
| 자유 대화 장기 보관 | 기존 미보관 정책·스위치 기본 OFF 유지 | 목표 미달. 동의/보관/삭제 검토 전 임의 원문 보관 0 |
| 초기에 저장한 명시적 자기 문장 보존 | 31번째 요청을 MEMORY_FULL로 거절, 이전 30개 보존 | source/mock PASS. 무제한 archive 구현 아님 |

기존 원문 저장 기간의 actual 운영 설정, 삭제/백업 주기, 모든 요약·추천 사본의 lifecycle은 이 작업에서 확인하지 않았다. 과거 감사 보고와 QA metadata만으로 이를 PASS로 바꾸지 않는다.

## 실행 증거

모든 자료는 가상이며 실제 키/계정/사용자 원문을 쓰지 않았다. 명령은 Codex의 로컬 product 작업 사본 기준이다. 자동 승인 검토가 처음에 서버 소스와 합성 대화·프로필 fixture 공개를 거절하여 로컬에 보존했고, 대표가 정확히 이 코드와 가상 검사 자료의 공개를 추가 승인한 뒤 PR149에 반영한다. 기존 거절을 다른 경로로 우회하지 않았다. fixture는 생성 코드·고정 가상 사용자·원본 mock store와 일치한다. 500억/5,000억은 대표 실제 목표가 아닌 승인된 가상 검사 숫자다. 공개 fixture와 검사/worker/harness를 함께 제공하여 같은 코드와 입력으로 재현할 수 있게 한다. 공개 업로드 승인만으로 행동 검사 조건은 달라지지 않아 동일 검사를 반복하지 않고, 저장소 Git blob과 검사한 원본 SHA256을 대조한다.

| 명령·조건 | 결과 | 범위 |
|---|---|---|
| `node --test --test-isolation=none qa/agent-server.test.mjs` | 85 passed / 0 failed / exit 0 | 기존 비용·CAS·재생·동시성 source/mock. 마지막 schema/cursor 변경 전 검사이며 일반 분기 조건은 불변 |
| `node --test --test-isolation=none qa/long-term-recall.test.mjs` | 기존 13 passed / 0 failed / exit 0 | 원문 회수·정정·분리·실패·잊기·용량 |
| `node --test --test-isolation=none --test-name-pattern='invalid and cross-scope\|explicit recall during' qa/long-term-recall.test.mjs` | 추가 cursor + 영향 기억 질문 2 passed / 0 failed / exit 0 | 최신 intent/cursor 경계. 기존 13 전체 재실행하지 않음 |
| `node --test --test-isolation=none qa/free-memory-grounding.test.mjs` | 5 passed / 0 failed / exit 0 | 인용 위조·추가 가짜 금액·거절 복사본·정상 답 |
| memory-receipt / fi018-agent-matching / free-talk 기존 검사 | 초기 29 passed / 파일 누락 1 failed / exit 1. 파일 조건 복원 1 passed / exit 0. 최신 free-talk 파일 12 passed / exit 0 | 입력·기대값 그대로. 최신 guard 변경 영향은 free-talk 12개로 확인했다. 이 명령은 QA의 기존 SQL 초안을 로컬 사본에 갖춘 조건이었다. 최종 공개에는 해당 SQL 초안을 제외하므로, 그 SQL 파일을 검사하는 1항목은 정확한 기존 QA 파일이 없으면 준비 오류가 난다. 이를 최종 PR 단독의 전체 검사 PASS로 주장하지 않는다 |
| 별도 worker write/read | writer/reader 다른 프로세스, provider 0, exit 0 | disk fixture + mock DB. 이전 프롬프트에 원문을 복붙하지 않음 |
| UI TypeScript `--noEmit --project tsconfig.app.json` | exit 0 | 최신 UI 타입 |
| synthetic Vite build | exit 0 | test mode, 가상 공개 환경 값. 실제 사이트/PROD 아님 |

Deno 미설치로 deno check 미실행. history module 자체 strict TypeScript 0 diagnostics는 Edge 전체 Deno 검사가 아니다. 브라우저·실서버·실기기·실제 모델·PROD·Netlify 배포는 실행하지 않았다. Codex가 구현한 변경이므로 이번 검사는 같은 구현자의 검사이며 **Manus/별도 reviewer의 독립 검수 완료가 아니다**.

일부 최초 실행에서 setup 경로/fixture historical aiCalls/희소 checkout 파일 오류가 났고 고쳤다. 초기 empty memory_context 토큰 추가가 기존 retry/fallback 6개를 실패시킨 실제 결함은 빈 context를 보내지 않는 최소 수정 후 원본 85개로 해결했다. 초기 FAIL 로그는 외부 감사 자료와 함께 보존한다.

## 남은 최소 조치

권한 있는 비운영 환경에서 정확한 SHA의 Deno·실제 저장 후 새 세션 원문 회수를 검증해야 한다. 실제 DB/보관/동의/삭제 정책 변경은 이 요청만으로 실행하지 않는다. 전면 재개발보다 기존 원문·확정 상태·CAS를 유지하며 회차 간 현재 사실과 tombstone 전파 계약을 별도 검토한다.

현재 사용자에게 약속 가능한 문장: **“저장된 내 대화에서 필요한 말을 찾아볼 수 있도록 준비했습니다. 기록과 정정 상태를 확인하고, 찾지 못한 내용은 기억한다고 말하지 않습니다.”** 실제 서비스 반영 전에는 “현재 사이트에서 사용 가능”이라고 쓰지 않는다.

## 복구

배포·DB 변경이 없으므로 런타임 복구 작업은 필요 없다. 코드 적용을 철회할 경우 이 문서/manifest에 표시된 변경만 QA 기준 `04d0086d901d86fe6aab4953c12fede2857f9828`과 대조해 되돌린다. 다른 담당의 최신 변경, 기존 상태/원문/불확실 비용 기록은 삭제하지 않는다. `.github/workflows`는 이 구현 변경에서 수정하지 않는다. 작업 가지의 두 workflow는 기존 PR149 바이트 그대로 보존하고 최신 QA의 workflow를 이 가지에 쓰지 않는다. 병합·실행 시 허용된 담당이 QA workflow 유지 여부를 다시 대조해야 한다. 이 작업은 보호 브랜치 병합을 하지 않는다.
