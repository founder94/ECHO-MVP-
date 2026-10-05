# QA 배포 기록 — doit-agent v103 (2026-10-04 23:27 KST)

작성: 2026-10-05 · Claude Code(대표 지시 「ECHO 점검 후속」 1·2·3·4·5) · 읽기 전용 조회 + 이 가지(branch)에 기록만. 운영·DB·RLS·Secret·모델·결제·가격 변경 0, 운영 배포 0, main·echo-qa 병합 0.

## 1. 무엇이 올라가 있나(시험 서버 실측)

조회: Supabase `list_edge_functions` · `get_edge_function`(프로젝트 `mutniujeiyujhkobadkd` = ECHO-QA), 2026-10-05 조회.

| 항목 | 값 |
|---|---|
| 함수 | `doit-agent` · status ACTIVE · **version 103** · verify_jwt true |
| 마지막 갱신(updated_at) | 1791124043396 ms = **2026-10-04 14:27:23 UTC = 23:27:23 KST** |
| 묶음 경로 | `/tmp/user_fn_..._103/source/doit-agent/index.ts` (저장소 경로 `product/supabase/functions/...` 가 아닌 `doit-agent/` 루트에서 올림) |
| ezbr_sha256 | `7a5e42bd883b74150158890a7af004af91636d9a1852873d10c01cad2eb22459` |
| 묶음 파일 수 | 6 (`matching.ts` 없음 — 배포본은 이 파일을 import 하지 않음) |

배포본 파일 SHA-256:

```
41978e3b689cdc07c4462ca3a0d1fc7e8054c5c82b478374e233331c4cf4cab9  agent.ts
b36f03ac95fc31b447e9a1fe458a1eacea5aac8cd2d89521e61daf2558adc845  failure-intelligence.ts
e60f5ad332b847ab6b6ea8de70a22a942a1bb6b48696aa573313d10c0c0d219c  index.ts
1e414740480c815b069824f88949013a0f380e410e621359620fb05076220c60  modelRouter.ts
74799a9bc75ab8f905d12fd3251089be093801c2bc8c541b93129e1c7160b416  providers.ts
38c79ca1c6004374882d9b00bfa498e96d255e62843ae945e4dec6b1a20947db  run.ts
```

## 2. 저장소와의 관계(바이트 비교)

- 이 가지의 기록 커밋 = `e47a49b`(echo-qa, PR #128 병합) 위에 배포본 6개를 그대로 덮어씀. 기록 뒤 `cmp` 결과: **6개 모두 배포본과 바이트 단위 동일**.
- 저장소 전체 기록(모든 가지 1,090 커밋)에서:
  - `index.ts` · `modelRouter.ts` · `providers.ts` · `run.ts` · `failure-intelligence.ts` = 커밋 `b8574d8`(2026-10-05 08:47 KST, 다른 Claude 세션 `session_01LrNq9P…`, PR #132)의 파일과 **동일**. 배포가 그 커밋보다 9시간 먼저였으므로, 커밋 전 작업본에서 올린 것으로 보인다.
  - **`agent.ts` = 어느 커밋에도 없는 내용**(git blob `d1a1f6f8…` 미존재). `b8574d8` 와 165줄, 그 부모 `e47a49b` 와 119줄 다름 — 두 커밋 사이의 중간 작업본. 예: 처음 세 질문 보기 규칙·`turnPromptFor` 가 없고, 지시 줄이 turn 지시문에 항상 붙어 있음.

## 3. 누가, 어떤 승인으로(10/04 23:27 배포)

| 확인한 것 | 근거 | 판정 |
|---|---|---|
| 배포 실행자 | 이슈 #125(2026-10-04 14:33 UTC, founder94 계정 게시) 본문: 「Codex가 직접 완료한 결과: … QA v103 ACTIVE … 새로 압축 해제한 사용자 ZIP의 supabase/functions/doit-agent 6개만 배포 … SHA256SUMS 6/6 일치, 모의 12/12, deno check exit0」 | **Codex**(대표 환경의 Codex 작업, 게시는 founder94 계정) — Codex 자기 보고 기준 |
| 배포 원본 | 같은 본문: 「새로 압축 해제한 사용자 ZIP」 | 저장소 커밋이 아니라 ZIP. 위 2절의 바이트 비교와 맞음 |
| 승인 근거 | 같은 본문: 「v103은 승인 수정본」, 대표가 「이 대화에서」 AI_POLICY 활성화를 승인. 이슈 #125 댓글 5981119238: 「현재 QA 승인본 v103 유지」 | 승인은 **Codex–대표 대화 안**에서 이루어졌다고 기록됨. **대표 원문 승인 문장은 저장소·PR·이슈에 없음 → 원문 확인 불가** |
| 같은 분의 다른 실행 | 14:27:05 UTC `echo-netlify-deploy`(push · echo-qa `9ca08c9`, PR #124 병합) | 이 workflow 는 Supabase 함수를 올리지 않음(파일 주석 「DB/Supabase 변경 0」 · 배포 명령 없음) → 시각만 겹친 별개 실행 |
| GitHub Actions 의 함수 배포 | 저장소 workflow 에 `supabase functions deploy` 없음 | Actions 가 올린 것 아님 |
| 이전 판 | 이슈 #125: 「v102는 앞선 정책 교체 실패 후 v100으로 복구한 코드」 | Codex 보고 그대로 · 별도 확인 불가 |

## 4. 기록한 코드로 다시 돌린 검사(가짜 AI·가짜 DB · 실제 AI·운영 0)

위치: 이 가지 `product/` · Node v22.22.2 · npm 10.9.7.

| 명령 | 결과 |
|---|---|
| `npm ci` | exit 0 · 376개 설치 · npm audit 경고 high 10건(설치 로그 그대로, 이번에 고치지 않음) |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 |
| test(`node --test qa/*.test.mjs qa/*.test.ts` · package.json 에 `test` 스크립트 없음) | exit 1 · **tests 1181 · pass 1155 · fail 21 · todo 5** |
| 비교: 같은 커밋 `e47a49b` 원래 코드(배포본 덮기 전) | tests 1181 · pass 1176 · fail 0 · todo 5 |

→ 시험 서버에서 도는 v103 코드는 같은 시점 저장소 회귀 검사 21개를 통과하지 못한다. 실패 예: AI3 제공사 전환이 200 대신 502, PR103 미확인 사용량, 실행 단계(agent_run) 재전송 7건, 정정 뒤 질문 반복. `b8574d8` 커밋 설명(「flag rules are appended … only when the flag is on, so the default 30k request budget still leaves room for one retry/fallback」)과 같은 원인으로 보이나, 원인 확정은 하지 않았다(추정).

## 5. 함수 4개 판 번호가 내용 변화 없이 +10 안팎 오른 이유

| 함수 | version | 묶음 경로의 판(코드가 마지막으로 올라간 판) | 차이 | updated_at(KST) |
|---|---|---|---|---|
| doit-connect | 70 | 60 | +10 | 2026-10-03 08:30:40 |
| doit-understanding | 47 | 35 | +12 | 2026-09-28 18:19:17 |
| admin-web | 25 | 13 | +12 | 2026-09-28 18:19:20 |
| doit-connect-cto-qa | 14 | 3 | +11 | 2026-10-02 15:33:53 |

- 확인된 사실: 네 함수 모두 묶음 경로가 옛 판 번호를 그대로 가리킨다 → 그 뒤 판 번호 증가에 **새 코드 묶음이 없었다**(같은 묶음 재사용).
- 원인: **확인 불가.** 저장소 workflow 에는 함수 배포·설정 변경 명령이 없고, 판별 이력 API·배포 로그 조회 권한이 이 세션에 없다. 가능한 경우(검증 안 함): 수동으로 `supabase functions deploy`(이름 없이 = 전체 함수)를 반복 실행해 바뀌지 않은 함수도 판만 올라감, 또는 설정(verify_jwt 등)만 다시 저장. understanding·admin-web 의 갱신 시각이 3초 차이라 한 번에 여러 함수를 올린 묶음 작업으로 보인다(추정).

## 6. echo-auto-loop(무인 순회) — 설정 변경 0, 읽기만

출처: main `.github/workflows/echo-auto-loop.yml`, Actions 실행 기록.

- **npm 허용 범위:** `--allowedTools` 에 `Bash(npm:*)` — **npm 의 모든 하위 명령 허용**(`npm ci`·`npm run *`뿐 아니라 `npm install <임의 패키지>`, `npm exec`, `npm publish` 등도 허용 목록에 걸리지 않음). 함께 `Bash(node:*)` 도 전체 허용. 금지 목록에는 supabase·gh api·gh secret·강제 push·main/echo-qa push·`rm` 이 있으나 npm 하위 명령 제한은 없음. 프롬프트 문장(「no paid real API calls」 등)은 도구 제한이 아님.
- **실행 빈도·비용(실측):** 일정 `7,22,37,52 * * * *`(15분마다, 하루 최대 96회)이지만 실제 기록은 전체 10회, **최근 24시간 5회**(모두 schedule · 성공 · 합계 약 1.2분 · Claude 단계 0회). Claude 구현 단계가 실제로 돈 것은 2회(2026-10-03 수동 실행, 각 약 30초·50초).
- **비용:** 저장소가 공개(public)라 표준 GitHub Actions 실행 시간 요금 0원. Claude 단계는 `CLAUDE_CODE_OAUTH_TOKEN`(구독 인증)으로 돌아 실행당 금액이 기록되지 않음 → **현재 하루 실행 비용 = Actions 0원, Claude 사용량 0회(최근 24시간)**. 작업이 생기면 한 번에 최대 80턴까지 구독 사용량을 씀(금액 환산 확인 불가).
- 권장(실행하지 않음 · 대표 승인 필요): `Bash(npm:*)` → `Bash(npm ci)`, `Bash(npm run type-check)`, `Bash(npm run lint)`, `Bash(npm run build)` 처럼 필요한 것만.

## 7. 되돌리기

이 문서와 기록 커밋은 저장소 기록만이다(서버 변화 0). 가지 `claude/qa-doit-agent-v103-snapshot` 을 지우면 끝. 시험 서버 v103 은 손대지 않았다.
