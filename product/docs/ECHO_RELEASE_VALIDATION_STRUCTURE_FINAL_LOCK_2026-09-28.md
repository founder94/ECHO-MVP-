# ECHO RELEASE VALIDATION STRUCTURE — FINAL LOCK

Status: FINAL LOCK
Effective: 2026-09-28

## 1. Principle

대표는 테스트 담당자가 아니다.
대표는 마지막 승인자다.

대표에게 반복적인 기술 검수, 설정 확인, 배포 진단, DB 확인, QA/PROD 구분, 로그 해석을 요구하지 않는다.

## 2. Fixed validation order

1. Claude Code — 구현 + 자기검사
2. ChatGPT — GitHub / Supabase / Netlify / 서버 상태 대조 및 회사 기준 검수
3. Codex — 반대검수 / 회귀검사 / Release Gate
4. Automated QA — lint / type-check / tests / build / env guards / correction-rejection-session-matching contracts
5. QA Publish — 실제 게시가 필요한 시점에만 1회
6. Automated browser/device replay — iPhone WebKit / Galaxy Chrome 경로 재현
7. CEO — 사람의 체감이 필요한 최종 확인만 수행

## 3. CEO-only validation

대표가 직접 확인하는 것은 다음처럼 자동검사로 완전히 대체하기 어려운 사용자 체감 영역으로 제한한다.

- 질문이 자연스러운가
- 화면 전환이 거슬리지 않는가
- 실제 휴대폰에서 기대한 느낌인가
- 사람이 보기에 불편하거나 이상하지 않은가

대표에게 아래를 진단시키지 않는다.

- DB / RLS / migration
- QA / PROD 환경 혼입
- server / app / brand version parity
- rejected semantic recurrence
- correction / supersede integrity
- matching eligibility contract
- OAuth URL correctness
- build / deploy / log diagnosis
- token / secret correctness
- CI failure root cause

위 항목은 AI + 자동 QA 책임이다.

## 4. Cost Guard

- Git push = 검사만. 유료 Netlify Production Deploy 자동 실행 금지.
- QA 실제 게시 = 필요할 때만 수동 1회.
- PROD = CEO GO 없이는 게시/변경 금지.
- 유료 작업은 cost estimate + budget cap + owner approval 없이 반복 실행 금지.
- credit / usage threshold는 운영 경고 대상으로 관리한다.

## 5. Evidence hierarchy

실기기 사용자 경험
> live E2E
> live deploy verification
> automated browser replay
> build/test
> AI 추정

하위 증거만으로 상위 PASS를 선언하지 않는다.

## 6. Conflict control

Claude / ChatGPT / Codex는 같은 파일을 동시에 덮어쓰지 않는다.

Claude = 구현
ChatGPT = 기준/상태/서버/운영 검수
Codex = 반대검수/릴리스 게이트

공용 통합 지점은 echo-qa.
운영 반영은 고정 RC + PASS + CEO GO 이후에만 가능.

## 7. Completion rule

대표에게 최종 확인을 요청하기 전에 아래가 모두 닫혀야 한다.

- implementation complete
- automated QA pass
- environment guards pass
- server/db contract pass
- live QA publish complete when required
- automated device replay pass

그 후에만 CEO FINAL FEEL CHECK를 요청한다.

이 구조는 대표 직접 변경 없이는 해제하거나 약화하지 않는다.


## 8. AUTO / STOP execution policy — FINAL LOCK (2026-09-29)

The representative approved automatic continuation for reversible, non-paid QA work.

### AUTO — continue without asking the representative
- code inspection and implementation inside the approved scope
- lint / type-check / unit tests / regression tests
- build and role-separation checks
- Failure Intelligence checks
- correction / rejection / session / matching contract verification
- read-only GitHub / Supabase / Netlify state checks
- QA Edge Function deploys that do not create external paid hosting usage and are within the already-approved QA scope
- merge of an explicitly CEO-approved PR into echo-qa when its head SHA and scope are unchanged
- re-run of non-paid QA checks after a fix

### STOP — require explicit CEO GO
- any PROD deploy or production traffic switch
- production DB migration / destructive DB change
- production Auth configuration change
- any paid Netlify publish or other action that consumes credits
- payment / pricing / PG configuration
- secret rotation that may interrupt service
- deletion, irreversible data change, or security-sensitive permission escalation

### Reporting rule
Do not ask the CEO to say “continue” or “approve” for AUTO work.
Continue until either:
1. all AUTO gates pass, or
2. a STOP condition is reached.

At STOP, send one compact request containing:
- exact action
- why it is needed
- expected cost/risk
- rollback
- one requested answer: GO or HOLD

This policy may not be weakened without a new direct CEO decision.
