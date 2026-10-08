# Manus 연결 준비 — 2026-10-08

대표가 GitHub Actions Secret `MANUS_API_KEY` 등록을 보고했다. 이 연결에서 Secrets 목록 조회는 지원되지 않고, Actions 실행 도구와 셸 주입 자격증명도 없다. 따라서 **등록은 대표 보고, 실제 인증은 미실행, 실제 유료 작업은 0건**이다. 키를 다시 요청하거나 Secret 값을 추출하지 않는다.

## 구현 범위

| 파일 | 하는 일 |
|---|---|
| `client.cjs` | 공식 v2 API 읽기 인증, 고정 합성 작업 생성, 상태·메시지 페이지 조회, 요청 시간 제한 |
| `auth-probe.cjs` | Actions가 주입한 키로 GET `/v2/user.me`; 키·계정 식별자를 출력하지 않음 |
| `receipt-store.cjs` | PR118 기존 `load/save(expectedRevision,state)` CAS 인터페이스 연결; 다른 작업·STOP 보존 |
| `smoke-runner.cjs` | 한 번 제출 → 제한된 결과 회수 → 타입·정확한 합성 JSON 검증 → CAS 영수증 저장 |
| `../proposed/manus-auth-check.yml` | 수동 인증만 하는 검토용 workflow. 현재 live workflow 아님 |

한시적 파일 저장소를 실제 runner 간 영속성으로 사용하지 않는다. PR118의 `tools/automation/queue-store-git.cjs`를 새로 구현하거나 수정하지 않았으며, 어댑터는 인터페이스만 받는다. 라이브 queue와 연결하거나 Git CAS 영속성을 실제로 검사하지 않았다.

본문의 PASS, 리뷰 없음, stopped 상태만으로 성공을 판정하지 않는다. `has_running_background_jobs=false`, 인증된 같은 task ID의 모든 메시지 페이지, `assistant_message.delivery_kind=result`, 정확한 `{"echo":"ECHO_MANUS_SYNTHETIC_V1"}`가 모두 필요하다. 이것도 **합성 연결 시험 영수증**일 뿐 ECHO 제품 검수 PASS나 다음 READY 실행 권한이 아니다.

생성 응답을 잃으면 CREATE_UNCERTAIN을 유지하고 다시 만들지 않는다. polling 시간 초과는 같은 task ID 조회로 이어가며, 취소·삭제·새 유료 작업으로 우회하지 않는다. source SHA/실제 principal/owner가 달라지면 기존 영수증을 받지 않는다. Bot 기본값이나 User 사칭은 없다.

## 실제 인증을 실행할 정확한 준비물

1. 실행 권한이 있는 담당이 `tools/proposed/manus-auth-check.yml`의 구체 diff, 최신 대표 승인, 환경 허용을 대조한다. 기존 workflow write 거절이나 STOP을 우회하지 않는다.
2. 허용된 절차로 `.github/workflows/manus-auth-check.yml`에 적용한다. 이 작업에서는 그 위치에 쓰지 않았다.
3. 이미 등록한 `MANUS_API_KEY`를 그대로 Actions에서 주입한다. 공개 실행 입력이나 셸로 옮기지 않는다.
4. 검토된 전체 40자 커밋 SHA로 수동 실행한다. Secret 주입 전에 HEAD와 probe/client SHA256을 검증한다.
5. 실제 로그의 `credential_present`/`authentication`만 반환한다. 등록 또는 인증 성공을 작업 왕복 성공으로 확대하지 않는다.

이 workflow는 contents:read, 수동 1회, 3분 제한, 동시 실행 1개이다. 유료 task, 자동 댓글 호출, 일정, 배포, Secret 관리, 외부 데이터 전송을 하지 않는다. 키가 없으면 NOT_RUN이며 등록 실패라고 단정하지 않는다.

## 유료 시험은 아직 BLOCKED

시험 범위는 개인정보·내부 명세·파일을 포함하지 않는 고정 문장 한 개, private, lite, connectors=[] 한 작업이다. API 키 계정의 기본 enabled skills는 공식 문서상 자동 로드될 수 있어 빈 enable_skills를 확실한 비활성화라고 주장하지 않는다.

공식 task.create에는 사전 크레딧 견적이나 강제 최대 크레딧 필드가 없다. **실제 예상 크레딧은 확인 불가**이며, 검사 코드의 `estimated_credits=1`은 가상 입력이다. 실측 또는 계정 근거가 있는 예상 사용량·위험·범위를 먼저 보고하고 승인된 값만 전달해야 한다. `approved_credits`는 제공사에서 강제되는 비용 상한이 아니다. 반환된 credit_usage가 없으면 0으로 만들지 않고 null/미확인으로 남긴다.

따라서 실제 유료 작업, ECHO 명세 전달, Manus의 기억 코드 독립 검수, 연속 무인 실행은 하지 않았다. 작업 결과를 받은 뒤 검수·FAIL 전달을 이어가는 실제 업무 연결은 별도 실행 증거가 필요하다.

## 실행한 검사

```sh
node --test --test-isolation=none tools/manus/client.test.cjs tools/manus/smoke-runner.test.cjs
node --test --test-isolation=none tools/manus/receipt-store.test.cjs
```

각각 합성 API/CAS에서 18 passed, 0 failed, exit 0 / 5 passed, 0 failed, exit 0. 실제 Manus 인증·작업·Git 영속성 검사가 아니다. 외부 호출 0, 유료 작업 0. Node 기본 단일 wrapper 집계 대신 위 옵션으로 개별 검사를 확인했다.

## 근거 문서

- https://open.manus.ai/docs/v2/authentication
- https://open.manus.ai/docs/v2/task.create
- https://open.manus.ai/docs/v2/task-lifecycle
- https://open.manus.ai/docs/v2/task.listMessages

현재 공식 OpenAPI의 `Task`에는 stop_reason이 없다. 누락된 필드를 만들어 완료를 증명하지 않는다.

## 복구

현재 미활성 proposal이므로 비활성화를 위한 외부 변경이 필요 없다. 이후 허용된 인증 workflow 적용 시에는 해당 workflow만 비활성화한다. 진행 중/불확실 작업의 영수증이나 기존 queue를 삭제하지 않는다. Secret·DB·PROD 변경은 없다.
