# doit-agent 되돌리기(Rollback) 계약 — 2026-09-26

대표 「FINAL MISSING CONTRACTS · 9. ROLLBACK」. 문제가 생기면 **데이터를 되돌리지 않고 코드(에이전트·프롬프트·규칙)를 직전 검증판으로 되돌린다.** 운영 데이터 삭제 0.

## 판 목록

| 판 | agent.ts SHA-256(앞 8) | 실제 AI 검사 | 운영 |
|---|---|---|---|
| echo-agent-v1.8 | `f528d2b6` | run 15 · 사전 규칙 4개 충족 | doit-agent 버전 6 · **되돌리기 판(직전 검증판)** |
| echo-agent-v1.9 | `9a1f135f` | run 16 · 규칙 ① 미달(항의 저장 1) | 올리지 않음 |
| echo-agent-v2.0 | `3444032b` | run 17 · 사전 규칙 4개 충족 | 올리지 않음 |
| echo-agent-v2.1 | `27eb756c` | run 18(사전 등록 `why_v12`) | 올리지 않음 |
| echo-agent-v2.2 | `bf26a04a` | run 19 · 사전 규칙 4개 충족 | **지금 운영(doit-agent 버전 7 · 2026-09-26 대표 승인 배포 · 내려받아 바이트 같음 확인)** |

판 번호·SHA·실제 AI 결과의 원본은 `spike/ab-20260925/FROZEN_INPUTS.json` 의 `prod_agent_gate.history` 다. 턴 기록마다 `agent_version · prompt_version · policy_version · pipeline_version · model` 이 남으므로(v2.1~) 실패가 어느 판에서 났는지 관리자에서 가린다.

## 되돌리는 순서(대표 승인 뒤 · 운영 배포 작업)

1. 되돌릴 판의 `supabase/functions/doit-agent/agent.ts`·`index.ts` 를 그 판의 커밋에서 꺼낸다(v1.8 = PR #1 브랜치 `0d5fb59` 에서 운영 버전 6 과 바이트 같음이 확인됨).
2. `doit-agent` 함수만 다시 배포한다. DB·RLS·Secret·다른 함수는 건드리지 않는다.
3. 배포 뒤 받은 파일을 내려받아 바이트 비교, 인증 없는 호출 401 확인(run 14·15 와 같은 방법).

## 저장된 대화 상태와의 호환

- v2.x 가 남긴 상태 칸(`source_type`·`confirmed_at`·`corrected_from`·`superseded_at`·`rejected_at`·`guard`·`superseded`·판 칸)은 v1.8 이 **읽지 않고 무시**한다.
- v2.x 의 `SUPERSEDED` 값은 v1.8 이 `CONFIRMED` 만 쓰므로 **쓰이지 않는다**(정정 전 값이 되살아나지 않음).
- 실패 턴 기록(`status = failed`)은 v1.8 관리자 화면에서 `turn_index` 가 없어 턴에 붙지 않을 뿐, 지울 필요가 없다.
- 그래서 되돌릴 때 데이터 변환·삭제가 필요 없다.
