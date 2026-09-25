# ECHO Failure Intelligence — 저장·기억·실패 자산화 MASTER (대표 승인 2026-09-25)

이 문서는 대표 「저장·기억·실패 자산화 MASTER LOCK」을 Failure Intelligence 정본에 옮긴 것이다. 어디에 어떻게 반영했는지도 함께 적는다.
**대표 최신 결정이 이 문서보다 우선한다. 이 문서로 운영 STOP 권한을 넓히지 않는다.**

## 0. 원칙
```
FAILURE → EXPERIENCE → EVIDENCE → REPRODUCE → ROOT CAUSE → SOLUTION → COUNTER TEST → REAL VALIDATION → VERIFIED → TECHNOLOGY
```
- 실패와 실패한 해결책은 지우지 않는다.
- 「실패 발생 → 규칙 하나 추가」는 금지다. 검증된 교훈만 기술로 올린다.

## 1. 현재 상태 (파일 재계산값 · 2026-09-25)
| 항목 | 값 | 확인할 곳 |
|---|---|---|
| Current Agent A | 운영 doit-understanding v27 `1aab6423…` (동결) | `product/spike/ab-20260925/FROZEN_INPUTS.json` |
| Minimal Agent B | B-1.0 `a0031fcc…` (동결) | 같은 파일 |
| 실제 A/B 실AI | **1회(run1, 2026-09-25 · GitHub Actions)** · 블라인드 검수 대기 | `ACTION_LEDGER.md` P-01·P-07 · `REAL_AB_RUN1_분석_20260925.md` |
| B WIN | 확인 불가 | — |
| Conversation P0 | FAIL | — |
| 운영 변경 | 0 | — |
| Failure Library | **69건** (62 → 실AI run1 새 실패 5건 GF-63~67 → 실험 변수 미고정 GF-68 → MODEL_ACTIVITY_JUMP GF-69) | `FAILURE_LIBRARY.md` 머리 |
| Failed Solutions | 21건 | `FAILED_SOLUTIONS_ARCHIVE.md` |
| 고정 검사 입력 | 34개 · 대표 실제 입력 24개 | `golden-failures.json` |
| Golden 판정 기준 | 20 spec (사전 고정) | `golden-specs.json` |
| VERIFIED Defense | 0개 | `VERIFIED_DEFENSE_REGISTRY.md` |

## 2. OpenAI 실험 키 — 정확한 상태
- KEY_PROVIDED_BY_FOUNDER = **YES**
  - 대표가 `ECHO-B-AB-TEST-20260925` 를 발급해 채팅으로 전달했다.
- KEY_AVAILABLE_AS_CLOUD_ENVIRONMENT_VARIABLE = **NO**
- REAL_AI_EXECUTION(Claude 환경 안) = **BLOCKED_BY_ENVIRONMENT** · 대안 경로(GitHub Actions + 저장소 Secret `OPENAI_API_KEY_AB_TEST`, 대표 등록 2026-09-25)로 run1 실행 완료
  - Claude 클라우드 보안 장치가 채팅으로 받은 비밀 값을 실행 명령에 쓰는 것을 막았다.
- 원인은 「대표가 키를 준비하지 않음」이 아니다.
- 결정: 현재 키 유지.
  - 폐기(Revoke)·새 발급 반복 요구 금지.
  - 이미 실패한 Claude Edit 경로 반복 안내 금지.
  - 보안 장치 우회 금지.

## 3·24. 완료 행동 기억 — 다음 행동 전 대조
- 정본: `data/action-ledger.json` → `ACTION_LEDGER.md` (COMPLETED · DECIDED · BLOCKED · PENDING).
- COMPLETED 를 다시 요구하면 새 실패(F-ADVISOR)로 기록한다. 실제 사례: GF-54.

## 4. 우선순위
1. 대표 최신 직접 결정
2. 실제 운영 실측
3. 실제 코드/DB/파일
4. 승인된 MASTER
5. 과거 보고
6. AI 추론

## 5·6. 모든 실패 저장 · AI 조언자 실패
- Family `F-ADVISOR` 를 새로 만들었다. 근거 파일은 `evidence/ADVISOR_SESSION_20260925.md`.

| 대표 문서 이름 | Library | 증거 수준 |
|---|---|---|
| COMPLETED_ACTION_FORGOTTEN | GF-54 | ACTUAL |
| REPEATED_INSTRUCTION_FAILURE | GF-55 | ACTUAL |
| SECURITY_GUIDANCE_INCONSISTENCY | GF-56 | ACTUAL |
| COST_VISIBILITY_FAILURE | GF-57 | CANDIDATE(대표 진술 · 청구 여부 미확인) |
| HUMAN_ROUTER_OVERLOAD | GF-58 | ACTUAL(CLAUDE.md 자기 기록) |
| (잘못된 완료 보고) | GF-59 | ACTUAL |
| PREMATURE_SOLUTION_LOCK | GF-60 | CANDIDATE(인과 HYPOTHESIS) |

- GPT·Perplexity 판단 실패는 이 저장소에 근거 기록이 없어 아직 넣지 않았다(추정 금지).

## 7·8. Failure Record 필드와 사용자 피해 4축
- 필드: FAIL_ID · DATE · SOURCE · EVIDENCE_LEVEL(ACTUAL·CANDIDATE·HYPOTHESIS) · 상황 · 원문 · AI/시스템 행동 · 기대 행동 · FAMILY · 원인 Layer · 감정·정신·시간·물질 비용 · 재현 · 해결 시도 · 실패한 해결책 · 역검사 · MOCK 결과 · 실AI 결과 · 사용자 결과 · 현재 상태 · Golden · 관련 실패(Graph)
- 모르면 `UNKNOWN`. 숫자는 만들지 않는다.
- 데이터 검사(`fi.test.mjs`)가 빈칸, 대표 진술만으로 ACTUAL 표시, 근거 없는 승격을 막는다.

## 9·21. 비용도 품질이다
- 하네스가 실행마다 기록하는 값
  - 호출 수
  - 입력·출력 토큰(o200k 계산 + 실제 usage)
  - 지연 p50·p95·최대
  - 재시도
  - `api_cost_usd`
- `api_cost_usd` 는 공식 단가를 사람이 넣었을 때(`ECHO_PRICE_IN_PER_M`·`ECHO_PRICE_OUT_PER_M`)만 계산하고, 없으면 「확인 불가」다.
- 대표가 OpenAI 사용량 화면에서 비용 발생을 확인한 사실은 GF-57 로 보존했다. 청구 여부는 단정하지 않는다.

## 10. Failed Solutions
- 칸: 무엇을 막으려 했나 · 왜 골랐나 · 어떻게 · 나아진 것 · 새로 깨진 것 · 망가뜨린 정상 사례 · 왜 실패했나 · 지금 · 다시 쓸 조건.

## 11. 기술 승격
- `CANDIDATE → MOCK_VERIFIED → REAL_AI_VERIFIED → USER_VERIFIED`, 필요하면 이어서 `PRODUCTION_VERIFIED`.
- 현재 VERIFIED 0 을 정직하게 유지한다.

## 12. Golden Failure
- `golden-specs.json`(사전 고정)이 칸마다 가진 것
  - FAIL_ID · CONTEXT · ACTUAL INPUT(Flow·턴) · BAD BEHAVIOR · EXPECTED · FORBIDDEN
  - 기계 판정(PASS/FAIL) · 사람 판정 질문 · COUNTER TEST · SOURCE
- 기계 판정은 저장 여부·오류·반응 유무·실제로 나간 고정 문장 목록 대조뿐이다. 뜻 판정은 블라인드 검수로 한다.

## 13·14. Failure Compiler · Failure Graph
- Compiler: `product/spike/failure-intelligence/failure-compiler.mjs`
  - CANDIDATE 단계다. 결과는 항상 HUMAN_APPROVAL_REQUIRED 다.
- Graph: `data/failure-graph.json`
  - 관계 7종. 근거가 없는 관계는 HYPOTHESIS 로 표시한다.

## 15·16. 모델은 회사 기술이 아니다
- `MODEL_CAPABILITY_REGISTRY.md` 에는 같은 Golden 으로 실측한 것만 적는다. 실측 전에는 순위를 매기지 않는다.

## 17. B안 위험 = 실패 후보로 보존
- GF-61: 다른 의도 이름이면 반복을 놓침
- GF-62: 답한 의도가 쌓여 질문 후보가 소진됨
- 둘 다 HYPOTHESIS 다. 실제 AI 전에는 B WIN 을 선언하지 않는다.

## 18·19. 제품 P0 우선 · 대표 중계 피로 방지
- 실AI 실행 경로가 확보되면 A/B 실제 비교가 최우선이다.
- 대표 호출은 HARD STOP · 보안 위험 · 운영 위험 · 대표만 가능한 외부 행동 · 최종 결과에 한정한다.

## 20. HARD STOP
운영 DB · Migration · RLS · Auth · Secret 변경 · 운영 모델 · 새 Provider 로 실제 사용자 데이터 전송 · 운영 Edge 배포 · Netlify 운영 배포 · 결제 · 가격 · KEY · 운영 데이터 · main 운영 merge · 개인정보 정책.

## 22·23. 저장·표현 원칙
- 원본 증거를 덮어쓰지 않는다.
- 정정은 새 상태·새 버전으로 남긴다(예: `FROZEN_INPUTS.json` 이력, GF-34·40 출처 정정 메모).
- 허용되는 표현: 「ECHO 독자기술 후보」·「ECHO 고유 실패 데이터 자산」.
- 증거 없이 쓰지 않는 표현: 「세계 최초·유일·복제 불가」.
